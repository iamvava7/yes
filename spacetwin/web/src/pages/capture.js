import { Vector3 } from 'three';
import { api } from '../api.js';
import {
  angleBetween, captureTargets, deviceQuaternion, forwardOf, headingCorrection, intrinsics, projectToFrame, yawPitchOf,
} from '../capture/geometry.js';
import { sharpnessOf } from '../capture/sharpness.js';
import { stitchPanorama } from '../capture/stitch.js';
import { sfx, unlock } from '../sound.js';
import { h, icon, toast } from '../ui.js';

const DEG = Math.PI / 180;
const AIM_TOLERANCE = 3.5 * DEG; // how close to a dot counts as "on target"
const STEADY_MS = 350; // hold still this long before a shot
const STEADY_MAX = 0.7 * DEG; // max wobble while holding still
const GUIDE_VFOV = 65; // typical iPhone main camera in portrait; the stitcher calibrates the real value
const MAX_PHOTO_SIDE = 1440;
const BURST = 5; // frames grabbed per dot; the sharpest is kept (all 5 blurred is rare)
const FAST_TURN = 30 * DEG; // per second; faster than this smears the photo
const MAX_TILT = 10 * DEG; // sideways roll before we ask for an upright phone

/**
 * Guided 360° capture with the phone's camera: aim at each dot, hold still,
 * and it shoots automatically. Afterwards the photos are stitched into an
 * equirectangular panorama on the phone and uploaded as a scan.
 */
export async function renderCapture(app, spaceId) {
  let space;
  try {
    space = await api.getSpace(spaceId);
  } catch (err) {
    app.append(h('main.not-found', h('h1', 'Space not found'), h('p', err.message), h('a', { href: '#/' }, 'Back to spaces')));
    return null;
  }
  document.title = `Capture · ${space.name}`;
  const root = h('div.capture');
  app.append(root);
  let session = null;
  showIntro();
  return () => session?.stop();

  // ---------------------------------------------------------------- screens

  function showIntro() {
    const n = space.scans.length + 1;
    const name = h('input', { value: `Spot ${n}`, maxLength: 120, 'aria-label': 'Spot name' });
    const mount = h('div.segmented', { role: 'radiogroup', 'aria-label': 'How is the phone held' });
    let height = 1.5;
    const heightInput = h('input', { type: 'number', min: 0.5, max: 2.5, step: 0.05, value: height, 'aria-label': 'Camera height in metres', oninput: (e) => { height = Number(e.target.value); } });
    for (const [label, value] of [['Tripod', 1.5], ['Handheld', 1.35]]) {
      mount.append(h('button', {
        type: 'button', role: 'radio', 'aria-checked': value === 1.5,
        onclick: (e) => {
          height = value;
          heightInput.value = value;
          for (const b of mount.children) b.setAttribute('aria-checked', b === e.currentTarget);
        },
      }, label));
    }
    const problems = [];
    if (!window.isSecureContext) problems.push('Camera capture needs a secure (https://) link. Open SpaceTwin through its https address on your phone.');
    if (!navigator.mediaDevices?.getUserMedia) problems.push('This browser has no camera access.');
    root.replaceChildren(h('div.capture-intro',
      h('header.row.spread', h('a.icon-btn', { href: `#/space/${spaceId}`, title: 'Back to editor' }, icon('back')), h('strong', space.name), h('span')),
      h('h1', 'Capture a 360° spot'),
      h('ol.tips',
        h('li', h('strong', 'Light it up. '), 'Turn on every light and open the blinds. Don’t aim straight at bright lamps.'),
        h('li', h('strong', 'Turn around the phone, not yourself. '), 'Keep the lens in one spot: on a tripod, or hold it at chest height and step around it. This is what makes seams disappear.'),
        h('li', h('strong', 'Follow the dots. '), 'Aim the centre circle at each dot and hold still; it shoots by itself. About 30 shots, one minute.'),
        h('li', h('strong', 'Next spot 1.5–3 m away. '), 'Closer in hallways and doorways, so the tour flows between spots.'),
      ),
      h('label.field', h('span', 'Name'), name),
      h('label.field', h('span', 'Phone height'), h('div.input-row', mount, heightInput, h('span.suffix', 'm'))),
      problems.length ? h('div.capture-problem', problems.map((p) => h('p', p))) : null,
      h('button.primary.big', {
        disabled: problems.length > 0,
        onclick: () => {
          unlock(); // iOS only allows audio to start from a tap
          start({ name: name.value.trim() || `Spot ${n}`, cameraHeight: height });
        },
      }, icon('walk'), 'Start capture'),
      h('p.dim', 'Have a 360° camera instead? ', h('a', { href: `#/space/${spaceId}` }, 'Upload its photos in the editor'), '.'),
    ));
  }

  async function start(opts) {
    // iOS only grants motion access from inside the tap handler, before any await.
    const motionPermission = typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission
      ? DeviceOrientationEvent.requestPermission().catch(() => 'denied')
      : Promise.resolve('granted');
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1440 } },
      });
    } catch (err) {
      toast(`Camera unavailable: ${err.message}`, 'error');
      return;
    }
    if ((await motionPermission) !== 'granted') {
      stream.getTracks().forEach((t) => t.stop());
      toast('Motion access was denied. Allow it so the app knows where the camera points.', 'error');
      return;
    }
    session = new CaptureSession(root, stream, opts, {
      onDone: (frames) => process(frames, opts),
      onCancel: () => { session = null; showIntro(); },
    });
  }

  async function process(frames, opts) {
    session = null;
    const label = h('p.processing-step', 'Preparing…');
    const bar = h('div.progress', h('div'));
    root.replaceChildren(h('div.capture-processing', h('h2', 'Stitching your 360°'), bar, label, h('p.dim', 'Keep this page open. This takes about half a minute.')));
    try {
      const result = await stitchPanorama(frames, {
        initialVfov: GUIDE_VFOV,
        onProgress: (step, f) => {
          label.textContent = step;
          bar.firstChild.style.width = `${Math.round(f * 100)}%`;
        },
      });
      window.__spacetwinLastStitch = { result, frames }; // inspection handle for tests/debugging
      review(result, frames, opts);
    } catch (err) {
      console.error(err);
      root.replaceChildren(h('div.capture-processing', h('h2', 'Stitching failed'), h('p', err.message),
        h('button.primary', { onclick: showIntro }, 'Try again')));
    }
  }

  function review(result, frames, opts) {
    const url = URL.createObjectURL(result.blob);
    const { alignmentErrorBefore: before, alignmentErrorAfter: after } = result.report;
    const quality = after < 4 ? 'Excellent' : after < 7 ? 'Good' : after < 11 ? 'Fair: some seams may show' : 'Poor: retake, keeping the phone in one spot';
    const save = h('button.primary.big', {
      onclick: async () => {
        save.disabled = true;
        save.textContent = 'Uploading…';
        try {
          const file = new File([result.blob], `${opts.name}.jpg`, { type: 'image/jpeg' });
          const updated = await api.uploadScans(spaceId, [file]);
          const scan = updated.scans.at(-1);
          await api.updateScan(spaceId, scan.id, { cameraHeight: opts.cameraHeight });
          space = await api.getSpace(spaceId);
          URL.revokeObjectURL(url);
          sfx.success();
          saved(scan);
        } catch (err) {
          toast(err.message, 'error');
          save.disabled = false;
          save.textContent = 'Save spot';
        }
      },
    }, 'Save spot');
    root.replaceChildren(h('div.capture-review',
      h('h2', opts.name),
      h('img.pano-preview', { src: url, alt: 'Stitched 360° panorama' }),
      h('dl.facts',
        h('dt', 'Alignment'), h('dd', `${quality}`),
        h('dt', 'Seam error'), h('dd', `${before.toFixed(1)} → ${after.toFixed(1)} grey levels after alignment`),
        h('dt', 'Lens'), h('dd', `${result.vfov.toFixed(1)}° vertical field of view (calibrated)`),
        h('dt', 'Photos'), h('dd', String(frames.length)),
      ),
      h('div.row', save, h('button.secondary.big', { onclick: () => { URL.revokeObjectURL(url); showIntro(); } }, 'Retake')),
    ));
  }

  function saved(scan) {
    root.replaceChildren(h('div.capture-processing',
      h('h2', `Saved “${scan.name}”`),
      h('p', space.scans.length > 1
        ? 'Move 1.5–3 m to the next spot and capture again. Afterwards, place the spots on the plan in the editor.'
        : 'Move 1.5–3 m to the next spot and capture again, or open the tour.'),
      h('div.row',
        h('button.primary.big', { onclick: showIntro }, 'Capture next spot'),
        h('a.button.secondary.big', { href: `#/space/${spaceId}` }, 'Open editor'),
      ),
    ));
  }
}

/** Resolve on the next decoded video frame (falls back to two animation frames). */
function nextVideoFrame(video) {
  return new Promise((resolve) => {
    if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(() => resolve());
    else requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

/** Live camera view with aiming dots; collects one photo per target. */
class CaptureSession {
  constructor(root, stream, opts, { onDone, onCancel }) {
    this.stream = stream;
    this.opts = opts;
    this.onDone = onDone;
    this.targets = captureTargets();
    this.frames = [];
    this.q = null; // aligned camera orientation
    this.align = null; // heading correction fixed at the first reading
    this.history = [];
    this.lastShot = 0;
    this.busy = false;

    this.video = h('video', { autoplay: true, muted: true, playsInline: true });
    this.video.setAttribute('playsinline', '');
    this.video.srcObject = stream;
    this.overlay = h('canvas.capture-overlay');
    this.counter = h('div.capture-counter');
    this.hint = h('div.capture-hint', 'Hold the phone upright and aim at the first dot');
    this.flash = h('div.capture-flash');
    const stopBtn = h('button.ghost.capture-cancel', { onclick: () => { this.stop(); onCancel(); } }, icon('x'), 'Cancel');
    const finishBtn = h('button.secondary.capture-finish', { hidden: true, onclick: () => this.finish() }, 'Finish now');
    this.finishBtn = finishBtn;
    root.replaceChildren(h('div.capture-live', this.video, this.overlay, this.flash, h('div.capture-top', stopBtn, this.counter, finishBtn), this.hint));
    this.video.play().catch(() => {});

    this.onOrientation = (e) => {
      if (e.alpha == null) return;
      const angle = screen.orientation?.angle ?? window.orientation ?? 0;
      const q = deviceQuaternion(e.alpha, e.beta, e.gamma, angle);
      if (!this.align) this.align = headingCorrection(yawPitchOf(forwardOf(q)).yaw);
      this.q = this.align.clone().multiply(q);
      const now = performance.now();
      this.history.push({ t: now, f: forwardOf(this.q) });
      while (this.history.length && now - this.history[0].t > STEADY_MS) this.history.shift();
    };
    window.addEventListener('deviceorientation', this.onOrientation);
    this.sensorTimer = setTimeout(() => {
      if (!this.q) this.hint.textContent = 'No motion sensor readings. Capture needs a phone or tablet with a gyroscope.';
    }, 2000);
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  stop() {
    cancelAnimationFrame(this.raf);
    clearTimeout(this.sensorTimer);
    window.removeEventListener('deviceorientation', this.onOrientation);
    this.stream.getTracks().forEach((t) => t.stop());
  }

  remaining() {
    return this.targets.filter((t) => !t.done);
  }

  steady() {
    if (this.history.length < 3) return false;
    const last = this.history.at(-1);
    if (last.t - this.history[0].t < STEADY_MS * 0.8) return false;
    return this.history.every((s) => angleBetween(s.f, last.f) < STEADY_MAX);
  }

  /** The dot to guide toward: the next in order, unless another is already closer to the crosshair. */
  activeTarget(fwd) {
    const left = this.remaining();
    if (!left.length) return null;
    const near = left.find((t) => angleBetween(t.dir, fwd) < AIM_TOLERANCE);
    return near ?? left[0];
  }

  async loop() {
    this.raf = requestAnimationFrame(this.loop);
    this.draw();
    if (!this.q || this.busy || !this.video.videoWidth) return;
    const fwd = forwardOf(this.q);
    const target = this.activeTarget(fwd);
    if (!target) return this.finish();
    const off = angleBetween(target.dir, fwd);
    if (off < AIM_TOLERANCE && this.steady() && performance.now() - this.lastShot > 250) {
      this.busy = true;
      try {
        await this.shoot(target);
      } finally {
        this.busy = false;
      }
    }
  }

  /**
   * Grab a short burst while the phone is steady on the dot and keep the
   * sharpest frame (variance of the Laplacian), which removes most handshake
   * and rolling-shutter blur without asking the user to do anything.
   */
  async shoot(target) {
    const vw = this.video.videoWidth, vh = this.video.videoHeight;
    const scale = Math.min(1, MAX_PHOTO_SIDE / Math.max(vw, vh));
    this.scoreCtx ??= document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    let best = null;
    for (let k = 0; k < BURST; k++) {
      if (k) await nextVideoFrame(this.video);
      const q = this.q.clone();
      if (angleBetween(target.dir, forwardOf(q)) > AIM_TOLERANCE * 1.5) break; // drifted off the dot
      const score = sharpnessOf(this.video, vw, vh, this.scoreCtx);
      if (best && score <= best.score) continue;
      const canvas = best?.canvas ?? h('canvas', { width: Math.round(vw * scale), height: Math.round(vh * scale) });
      canvas.getContext('2d').drawImage(this.video, 0, 0, canvas.width, canvas.height);
      best = { score, q, canvas };
    }
    if (!best) return;
    const blob = await new Promise((r) => best.canvas.toBlob(r, 'image/jpeg', 0.92));
    target.done = true;
    this.frames.push({ blob, q: best.q, width: best.canvas.width, height: best.canvas.height, targetId: target.id, sharpness: best.score });
    this.lastShot = performance.now();
    sfx.shutter();
    // chime when a whole ring is done: horizon (12), upper (20), lower (28)
    if ([12, 20, 28].includes(this.frames.length)) setTimeout(() => sfx.ding(), 120);
    this.flash.classList.remove('on');
    void this.flash.offsetWidth;
    this.flash.classList.add('on');
    if (this.frames.length >= 12) this.finishBtn.hidden = false;
  }

  /** Degrees per second the view is turning, from the recent orientation history. */
  turnRate() {
    if (this.history.length < 2) return 0;
    const a = this.history[0], b = this.history.at(-1);
    return b.t > a.t ? angleBetween(a.f, b.f) / ((b.t - a.t) / 1000) : 0;
  }

  /** Sideways tilt of the phone (roll), radians; 0 when held upright. */
  roll() {
    const right = new Vector3(1, 0, 0).applyQuaternion(this.q);
    return Math.asin(Math.max(-1, Math.min(1, right.y)));
  }

  finish() {
    if (this.finished) return;
    this.finished = true;
    this.stop();
    this.onDone(this.frames);
  }

  // ---------------------------------------------------------------- overlay

  /** Map normalised camera coordinates to screen pixels (the video is shown with object-fit: cover). */
  frameToScreen(u, v, w, h) {
    const vw = this.video.videoWidth || 3, vh = this.video.videoHeight || 4;
    const s = Math.max(w / vw, h / vh);
    return { x: (w - vw * s) / 2 + u * vw * s, y: (h - vh * s) / 2 + v * vh * s };
  }

  draw() {
    const c = this.overlay;
    const w = c.clientWidth, hgt = c.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(hgt * dpr); }
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, hgt);
    const done = this.frames.length, total = this.targets.length;
    this.counter.textContent = `${done} / ${total}`;
    const cx = w / 2, cy = hgt / 2;
    if (!this.q) return;

    const aspect = (this.video.videoWidth || 3) / (this.video.videoHeight || 4);
    const intr = intrinsics(GUIDE_VFOV, aspect);
    const qInv = this.q.clone().invert();
    const fwd = forwardOf(this.q);
    const active = this.activeTarget(fwd);

    for (const t of this.targets) {
      const p = projectToFrame(t.dir, qInv, intr);
      if (!p) continue;
      const s = this.frameToScreen(p.u, p.v, w, hgt);
      ctx.beginPath();
      if (t.done) {
        ctx.arc(s.x, s.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(80, 220, 140, 0.9)';
        ctx.fill();
      } else {
        ctx.arc(s.x, s.y, t === active ? 16 : 10, 0, Math.PI * 2);
        ctx.fillStyle = t === active ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.35)';
        ctx.fill();
      }
    }

    // crosshair ring fills while holding steady on target
    const off = active ? angleBetween(active.dir, fwd) : Infinity;
    const onTarget = off < AIM_TOLERANCE;
    ctx.lineWidth = 3;
    ctx.strokeStyle = onTarget ? '#50dc8c' : 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(cx, cy, 26, 0, Math.PI * 2);
    ctx.stroke();
    if (onTarget && this.history.length > 1) {
      const held = Math.min(1, (this.history.at(-1).t - this.history[0].t) / STEADY_MS) * (this.steady() ? 1 : 0.4);
      ctx.beginPath();
      ctx.arc(cx, cy, 26, -Math.PI / 2, -Math.PI / 2 + held * Math.PI * 2);
      ctx.lineWidth = 6;
      ctx.stroke();
    }

    // spirit level: a short horizon line that turns green when the phone is upright
    const tiltNow = this.roll();
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-tiltNow);
    ctx.strokeStyle = Math.abs(tiltNow) < MAX_TILT ? 'rgba(80,220,140,0.9)' : 'rgba(255,190,60,0.95)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-70, 0); ctx.lineTo(-36, 0);
    ctx.moveTo(36, 0); ctx.lineTo(70, 0);
    ctx.stroke();
    ctx.restore();

    if (!active) return;
    // arrow + words when the dot is off screen or far away
    const p = projectToFrame(active.dir, qInv, intr);
    const sp = p && this.frameToScreen(p.u, p.v, w, hgt);
    const visible = sp && sp.x > 20 && sp.x < w - 20 && sp.y > 60 && sp.y < hgt - 60;
    const tp = yawPitchOf(active.dir), cp = yawPitchOf(fwd);
    let dyaw = tp.yaw - cp.yaw;
    while (dyaw > Math.PI) dyaw -= 2 * Math.PI;
    while (dyaw < -Math.PI) dyaw += 2 * Math.PI;
    const dpitch = tp.pitch - cp.pitch;
    const vertical = Math.abs(active.pitch) > 80 * DEG;
    let text;
    const tilt = this.roll();
    const nearDot = off < 15 * DEG;
    if (!vertical && Math.abs(tilt) > MAX_TILT) text = `Hold the phone upright (tilted ${Math.round(Math.abs(tilt) / DEG)}°)`;
    else if (nearDot && this.turnRate() > FAST_TURN) text = 'Slow down: fast turns blur photos';
    else if (onTarget) text = this.steady() ? 'Hold still…' : 'Steady…';
    else if (vertical) text = active.pitch > 0 ? 'Point the phone straight up' : 'Point the phone straight down';
    else if (Math.abs(dpitch) > 10 * DEG && Math.abs(dyaw) < 25 * DEG) text = dpitch > 0 ? 'Tilt up' : 'Tilt down';
    else text = dyaw < 0 ? 'Turn right' : 'Turn left';
    this.hint.textContent = text;
    if (!visible && !vertical) {
      const ang = Math.atan2(-dpitch, -dyaw); // screen: +x right is negative yaw
      const r = Math.min(w, hgt) * 0.32;
      const ax = cx + Math.cos(ang) * r, ay = cy + Math.sin(ang) * r;
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.moveTo(18, 0); ctx.lineTo(-10, -13); ctx.lineTo(-10, 13); ctx.closePath();
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.fill();
      ctx.restore();
    }
  }
}

