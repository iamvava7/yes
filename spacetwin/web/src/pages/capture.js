import { Vector3 } from 'three';
import { api, exportUrl, panoUrl } from '../api.js';
import { brand } from '../brand.js';
import {
  angleBetween, captureTargets, deviceQuaternion, forwardOf, headingCorrection, intrinsics, onTarget, RING_SHOTS, yawPitchOf,
} from '../capture/geometry.js';
import { Mosaic } from '../capture/mosaic.js';
import { PanoPreview } from '../capture/panoPreview.js';
import { sharpnessOf } from '../capture/sharpness.js';
import { stitchPanorama } from '../capture/stitch.js';
import { formatArea } from '../listing.js';
import { sfx, unlock } from '../sound.js';
import { h, icon, toast } from '../ui.js';
import { Viewer } from '../viewer/Viewer.js';

const DEG = Math.PI / 180;
const AIM_TOLERANCE = 3.5 * DEG; // how close to a ring dot counts as "on target"
const STEADY_MS = 350; // hold still this long before a shot
const STEADY_MAX = 0.7 * DEG; // max wobble while holding still
const GUIDE_VFOV = 65; // typical iPhone main camera in portrait; the stitcher calibrates the real value
const MAX_PHOTO_SIDE = 1440;
const BURST = 5; // frames grabbed per dot; the sharpest is kept (all 5 blurred is rare)
const FAST_TURN = 30 * DEG; // per second; faster than this smears the photo
const MAX_TILT = 10 * DEG; // sideways roll before we ask for an upright phone
const MIN_SHOTS = 12; // the horizon ring: enough for a usable (if partial) panorama
// The gyroscope reports a new direction at once, but camera frames arrive a
// little later. After any movement, wait for this many new camera frames
// before shooting, so the photo shows where the phone points now.
const FRESH_FRAMES = 3;
const FRESH_MS = 250; // ...and at least this long
const MOVE_EPS = 0.25 * DEG; // per orientation reading: more than this counts as movement

const STEPS = [
  ['Reading photos', 'Reading photos'],
  ['Calibrating lens', 'Measuring your lens'],
  ['Aligning photos', 'Lining up every photo'],
  ['Balancing exposure', 'Evening out the light'],
  ['Blending', 'Blending into one 360°'],
];

/**
 * Capture flow, all on the phone:
 *   intro → shoot (photos land on a sphere around you) → stitch (watch the
 *   ball of photos come together) → look around the result → save →
 *   outline the room → see the 3D model and floor plan grow.
 */
export async function renderCapture(app, spaceId) {
  let space;
  try {
    space = await api.getSpace(spaceId);
  } catch (err) {
    app.append(h('main.not-found', h('h1', 'Property not found'), h('p', err.message), h('a', { href: '#/' }, 'Back to properties')));
    return null;
  }
  document.title = `Capture · ${space.listing?.address || space.name} · ${brand.name}`;
  const root = h('div.capture');
  app.append(root);
  let teardown = null; // disposes whatever the current screen created
  const show = (node, dispose = null) => {
    teardown?.();
    teardown = dispose;
    root.replaceChildren(node);
  };
  showIntro();
  return () => teardown?.();

  // ---------------------------------------------------------------- intro

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
    if (!window.isSecureContext) problems.push('Camera capture needs a secure (https://) address. Open the app through its https link on your phone.');
    if (!navigator.mediaDevices?.getUserMedia) problems.push('This browser has no camera access.');
    show(h('div.capture-intro',
      h('header.row.spread', h('a.icon-btn', { href: `#/space/${spaceId}`, title: 'Back to the property' }, icon('back')), h('strong', space.listing?.address || space.name), h('span')),
      h('h1', space.scans.length ? `Spot ${n}` : 'Your first spot'),
      h('ol.tips',
        h('li', h('strong', 'Light it up. '), 'Turn on every light and open the blinds.'),
        h('li', h('strong', 'Turn around the phone, not yourself. '), 'Keep the lens in one place, at chest height or on a tripod. This is what makes seams disappear.'),
        h('li', h('strong', 'Follow the dots. '), 'Put the ring on each dot and hold still. It shoots by itself, and every photo appears in place around you.'),
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
      }, icon('camera'), 'Start capture'),
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
    const wrap = h('div.capture-live');
    let session = null;
    show(wrap, () => session?.dispose());
    session = new CaptureSession(wrap, stream, {
      onDone: (frames, mosaic) => {
        session.handOver(); // the mosaic stays on screen while stitching
        process(frames, opts, wrap, mosaic);
      },
      onCancel: () => showIntro(),
    });
  }

  // ---------------------------------------------------------------- stitching

  async function process(frames, opts, wrap, mosaic) {
    teardown = () => mosaic.dispose();
    mosaic.startOrbit();
    const list = h('ol.steps', STEPS.map(([key, label]) => h('li', { dataset: { step: key } }, h('span.step-dot'), label)));
    const bar = h('div.progress', h('div'));
    const card = h('div.capture-processing',
      h('h2', 'Building your 360°'),
      h('p.dim', `${frames.length} photos · keep this page open`),
      bar, list,
    );
    wrap.replaceChildren(wrap.querySelector('.mosaic-canvas'), card);
    let current = null;
    try {
      const result = await stitchPanorama(frames, {
        initialVfov: GUIDE_VFOV,
        onProgress: (step, f) => {
          bar.firstChild.style.width = `${Math.round(f * 100)}%`;
          if (step === current || !STEPS.some(([k]) => k === step)) return;
          current = step;
          let reached = false;
          for (const li of list.children) {
            const here = li.dataset.step === step;
            li.classList.toggle('active', here);
            li.classList.toggle('done', !here && !reached);
            if (here) reached = true;
          }
          sfx.tap();
        },
      });
      window.__spacetwinLastStitch = { result, frames }; // inspection handle for tests/debugging
      for (const li of list.children) { li.classList.remove('active'); li.classList.add('done'); }
      sfx.ding();
      setTimeout(() => review(result, frames, opts), 450);
    } catch (err) {
      console.error(err);
      show(h('div.capture-message', h('h2', 'Stitching failed'), h('p', err.message),
        h('button.primary.big', { onclick: showIntro }, 'Try again')));
    }
  }

  // ---------------------------------------------------------------- review

  function review(result, frames, opts) {
    const url = URL.createObjectURL(result.blob);
    const { alignmentErrorBefore: before, alignmentErrorAfter: after } = result.report;
    // seam error is ~4 grey levels with a perfect gyroscope (resampling alone)
    const [quality, grade] = after < 6 ? ['Excellent', 'good'] : after < 10 ? ['Good', 'good'] : after < 14 ? ['Fair: some seams may show', 'fair'] : ['Poor: retake, keeping the phone in one spot', 'poor'];
    const stage = h('div.review-stage');
    const save = h('button.primary.big', {
      onclick: async () => {
        save.disabled = true;
        save.textContent = 'Saving…';
        try {
          const file = new File([result.blob], `${opts.name}.jpg`, { type: 'image/jpeg' });
          const updated = await api.uploadScans(spaceId, [file]);
          const scan = updated.scans.at(-1);
          await api.updateScan(spaceId, scan.id, { cameraHeight: opts.cameraHeight, position: besideThePlan() });
          space = await api.getSpace(spaceId);
          sfx.success();
          saved(space.scans.find((s) => s.id === scan.id));
        } catch (err) {
          toast(err.message, 'error');
          save.disabled = false;
          save.textContent = 'Save spot';
        }
      },
    }, 'Save spot');
    const node = h('div.capture-review',
      stage,
      h('header.review-top', h('strong', opts.name), h('span.quality-chip', { dataset: { grade } }, quality.split(':')[0])),
      h('div.review-sheet',
        h('p.review-hint', 'Drag to look around. This is how the spot will look in the tour.'),
        h('dl.facts',
          h('dt', 'Alignment'), h('dd', quality),
          h('dt', 'Seam error'), h('dd', `${before.toFixed(1)} → ${after.toFixed(1)} grey levels after alignment`),
          h('dt', 'Lens'), h('dd', `${result.vfov.toFixed(1)}° vertical field of view (calibrated)`),
          h('dt', 'Photos'), h('dd', String(frames.length)),
        ),
        h('img.pano-preview', { src: url, alt: 'The stitched 360° panorama, unrolled' }),
        h('div.row', save, h('button.secondary.big', { onclick: () => { sfx.tap(); showIntro(); } }, 'Retake')),
      ),
    );
    let preview = null;
    show(node, () => { preview?.dispose(); URL.revokeObjectURL(url); });
    preview = new PanoPreview(stage, url);
  }

  /**
   * Where to put a new spot until it's arranged: 4 m to the right of
   * everything mapped so far, so the room outlined from it doesn't land on
   * top of existing rooms.
   */
  function besideThePlan() {
    const pts = [...space.rooms.flatMap((r) => r.points), ...space.scans.map((s) => [s.position.x, s.position.z])];
    if (!pts.length) return { x: 0, z: 0 };
    const maxX = Math.max(...pts.map((p) => p[0]));
    const zs = pts.map((p) => p[1]);
    return { x: Math.round((maxX + 4) * 100) / 100, z: Math.round(((Math.min(...zs) + Math.max(...zs)) / 2) * 100) / 100 };
  }

  // ---------------------------------------------------------------- saved

  function saved(scan) {
    show(h('div.capture-message',
      h('div.saved-mark', icon('check')),
      h('h2', `Saved “${scan.name}”`),
      h('p', 'Next, outline this room so it appears in 3D and on the floor plan. It takes about a minute: you point at each corner.'),
      h('div.stack',
        h('button.primary.big', { onclick: () => { sfx.tap(); outline(scan); } }, icon('trace'), 'Outline this room'),
        h('button.secondary.big', { onclick: () => { sfx.tap(); showIntro(); } }, icon('camera'), 'Capture next spot'),
        h('button.ghost', { onclick: () => result() }, 'See the 3D result'),
      ),
    ));
  }

  // ---------------------------------------------------------------- outline the room

  function outline(scan) {
    const stage = h('div.outline-stage');
    const title = h('h2');
    const text = h('p');
    // one primary button whose action follows the step (corners, then height)
    const addBtn = h('button.primary.big', { onclick: () => primary() }, icon('plus'), 'Add corner');
    const defaultName = /^Spot \d+$/.test(scan.name) ? `Room ${space.rooms.length + 1}` : scan.name;
    const nameInput = h('input', { value: defaultName, maxLength: 100, 'aria-label': 'Room name' });
    const undoBtn = h('button.secondary', { onclick: () => { viewer.traceUndo(); sfx.tap(); } }, 'Undo');
    const closeBtn = h('button.secondary', { onclick: () => { viewer.closeTrace(); sfx.ding(); } }, 'Close room');
    const skipBtn = h('button.ghost', { onclick: () => viewer.finishTrace(2.6) }, 'Skip (2.6 m)');
    const node = h('div.outline',
      stage,
      h('div.crosshair', { 'aria-hidden': true }),
      h('header.review-top', h('button.icon-btn', { title: 'Stop outlining', onclick: () => saved(scan) }, icon('x')), h('strong', 'Outline the room'), h('span')),
      h('div.outline-card', title, text, h('label.field.outline-name', h('span', 'Room name'), nameInput), h('div.row', undoBtn, closeBtn, skipBtn), addBtn),
    );
    let viewer;
    show(node, () => viewer?.dispose());
    viewer = new Viewer(stage, {
      panoUrl: panoUrl(spaceId),
      onTraceProgress: () => render(),
      onTraceComplete: async ({ points, height }) => {
        try {
          const roomName = nameInput.value.trim() || defaultName;
          space = await api.putRooms(spaceId, [...space.rooms, { name: roomName, height, points }]);
          sfx.success();
          result(roomName);
        } catch (err) {
          toast(err.message, 'error');
        }
      },
    });
    viewer.currentScanId = scan.id;
    viewer.setPanoOnly(true);
    viewer.setSpace(space);
    viewer.setLook(viewer.yaw, -0.45); // look down toward the floor corners
    viewer.setTool('trace');
    viewer.centerAim = true;
    stage.viewer = viewer; // handle for tests

    function primary() {
      if (viewer.trace?.stage === 'ceiling') {
        if (viewer.traceCeilingAtCenter()) sfx.shutter();
        else { sfx.warn(); toast('Aim higher, at the ceiling above the red corner.'); }
      } else if (viewer.traceAddAtCenter()) {
        sfx.shutter();
      } else {
        sfx.warn();
        toast('Aim lower: the crosshair must be on the floor.');
      }
    }
    function render() {
      const t = viewer.trace;
      if (!t) return;
      const n = t.points.length;
      if (t.stage === 'floor') {
        title.textContent = n === 0 ? 'Point at a floor corner' : `${n} corner${n === 1 ? '' : 's'}`;
        text.textContent = n < 3
          ? 'Turn until the crosshair sits where two walls meet the floor, then tap Add corner. Go around the room in order.'
          : 'Add every corner, then tap Close room.';
        addBtn.replaceChildren(icon('plus'), 'Add corner');
        closeBtn.hidden = false;
        closeBtn.disabled = n < 3;
        skipBtn.hidden = true;
        undoBtn.disabled = n === 0;
      } else {
        title.textContent = 'Now the ceiling';
        text.textContent = 'Aim the crosshair at the top of the first corner (the red one), where the walls meet the ceiling, then tap Set height.';
        addBtn.replaceChildren(icon('check'), 'Set height');
        closeBtn.hidden = true;
        skipBtn.hidden = false;
        undoBtn.disabled = false;
      }
    }
    render();
  }

  // ---------------------------------------------------------------- result

  async function result(newRoom) {
    space = await api.getSpace(spaceId);
    const stage = h('div.result-3d');
    const area = formatArea(space.stats.totalArea);
    const node = h('div.capture-result',
      h('header.result-head',
        h('a.icon-btn', { href: `#/space/${spaceId}`, title: 'Open the editor' }, icon('back')),
        h('div', h('p.eyebrow', newRoom ? `${newRoom} added` : 'Your property so far'), h('h2', space.listing?.address || space.name)),
      ),
      h('ul.result-stats',
        h('li', h('strong', String(space.scans.length)), h('span', space.scans.length === 1 ? 'spot' : 'spots')),
        h('li', h('strong', String(space.rooms.length)), h('span', space.rooms.length === 1 ? 'room' : 'rooms')),
        h('li', h('strong', area.m2), h('span', area.ft2)),
      ),
      h('section.result-panel', h('h3', '3D model'), stage),
      h('section.result-panel', h('h3', 'Floor plan'),
        space.rooms.length
          ? h('img.result-plan', { src: `${exportUrl(spaceId, 'floorplan.svg')}?v=${Date.now()}`, alt: 'Floor plan' })
          : h('p.dim', 'Outline a room to start the floor plan.')),
      space.scans.length > 1 && space.rooms.length > 1
        ? h('p.dim', 'Rooms outlined from different spots start side by side. Drag them into place once in the editor; the 3D model and floor plan follow.')
        : null,
      h('div.stack',
        h('button.primary.big', { onclick: () => { sfx.tap(); showIntro(); } }, icon('camera'), 'Capture next spot'),
        h('a.button.secondary.big', { href: `#/view/${spaceId}` }, icon('walk'), 'Open the tour'),
        h('a.button.ghost', { href: `#/space/${spaceId}` }, 'Arrange in the editor'),
      ),
    );
    let viewer = null;
    show(node, () => viewer?.dispose());
    if (space.rooms.length || space.scans.length) {
      viewer = new Viewer(stage, { panoUrl: panoUrl(spaceId) });
      viewer.setSpace(space);
      if (space.rooms.length) viewer.setMode('dollhouse', { animate: false });
    }
  }
}

/** Resolve on the next decoded video frame (falls back to two animation frames). */
function nextVideoFrame(video) {
  return new Promise((resolve) => {
    if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(() => resolve());
    else requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

/**
 * Live capture: a sphere view that turns with the phone, the live camera in a
 * frame at its centre, dots to aim at, and each photo landing as a tile.
 */
class CaptureSession {
  constructor(wrap, stream, { onDone, onCancel }) {
    this.stream = stream;
    this.onDone = onDone;
    this.targets = captureTargets();
    this.frames = [];
    this.tiles = [];
    this.q = null; // aligned camera orientation
    this.align = null; // heading correction fixed at the first reading
    this.history = [];
    this.lastShot = 0;
    this.busy = false;

    this.mosaic = new Mosaic(wrap);
    this.video = h('video.capture-frame', { autoplay: true, muted: true, playsInline: true });
    this.video.setAttribute('playsinline', '');
    this.video.srcObject = stream;
    this.video.addEventListener('loadedmetadata', () => {
      this.mosaic.setIntrinsics(intrinsics(GUIDE_VFOV, this.video.videoWidth / this.video.videoHeight));
    });
    this.mosaic.onResize = (r) => {
      this.video.style.width = `${r.width}px`;
      this.video.style.height = `${r.height}px`;
    };
    this.mosaic.resize();
    this.overlay = h('canvas.capture-overlay');
    this.counter = h('div.capture-counter');
    this.hint = h('div.capture-hint', 'Hold the phone upright and put the ring on the first dot');

    const ring = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    ring.setAttribute('viewBox', '0 0 72 72');
    ring.setAttribute('aria-hidden', 'true');
    ring.setAttribute('class', 'ring');
    ring.innerHTML = '<circle cx="36" cy="36" r="33" class="ring-track"/><circle cx="36" cy="36" r="33" class="ring-fill" pathLength="100"/>';
    this.ringFill = ring.querySelector('.ring-fill');
    this.finishBtn = h('button.finish-btn', { 'aria-label': 'Finish and build the 360°', title: 'Finish', disabled: true, onclick: () => this.finish() }, ring, icon('check'));
    this.undoBtn = h('button.bar-btn', { 'aria-label': 'Undo last photo', title: 'Undo last photo', disabled: true, onclick: () => this.undo() }, icon('undo'));
    const cancelBtn = h('button.bar-btn', {
      'aria-label': 'Cancel capture', title: 'Cancel',
      onclick: () => {
        if (this.frames.length && !confirm(`Discard ${this.frames.length} photo${this.frames.length === 1 ? '' : 's'}?`)) return;
        this.dispose();
        onCancel();
      },
    }, icon('x'));
    wrap.append(this.video, this.overlay,
      h('div.capture-top', this.counter, this.hint),
      h('div.capture-bar', this.undoBtn, this.finishBtn, cancelBtn));
    this.video.play().catch(() => {});

    // count camera frames as they arrive
    this.videoFrameNo = 0;
    this.moveFrameNo = 0;
    const countFrame = () => {
      this.videoFrameNo++;
      if (this.video.requestVideoFrameCallback) this.frameCb = this.video.requestVideoFrameCallback(countFrame);
      else this.frameCb = requestAnimationFrame(countFrame);
    };
    countFrame();

    this.onOrientation = (e) => {
      if (e.alpha == null) return;
      const angle = screen.orientation?.angle ?? window.orientation ?? 0;
      const q = deviceQuaternion(e.alpha, e.beta, e.gamma, angle);
      if (!this.align) this.align = headingCorrection(yawPitchOf(forwardOf(q)).yaw);
      this.q = this.align.clone().multiply(q);
      const now = performance.now();
      const f = forwardOf(this.q);
      const prev = this.history.at(-1);
      if (!prev || angleBetween(prev.f, f) > MOVE_EPS) {
        this.moveFrameNo = this.videoFrameNo;
        this.moveTime = now;
      }
      this.history.push({ t: now, f });
      while (this.history.length && now - this.history[0].t > STEADY_MS) this.history.shift();
    };
    window.addEventListener('deviceorientation', this.onOrientation);
    this.sensorTimer = setTimeout(() => {
      if (!this.q) this.hint.textContent = 'No motion sensor readings. Capture needs a phone or tablet with a gyroscope.';
    }, 2000);
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  /** Stop the camera and sensors; the mosaic is disposed too unless handed over. */
  dispose() {
    this.stopSensing();
    if (!this.handedOver) this.mosaic.dispose();
  }

  stopSensing() {
    cancelAnimationFrame(this.raf);
    if (this.video.cancelVideoFrameCallback) this.video.cancelVideoFrameCallback(this.frameCb);
    cancelAnimationFrame(this.frameCb);
    clearTimeout(this.sensorTimer);
    window.removeEventListener('deviceorientation', this.onOrientation);
    this.stream.getTracks().forEach((t) => t.stop());
  }

  /** The next screen takes ownership of the mosaic. */
  handOver() {
    this.handedOver = true;
  }

  ringsDone() {
    return this.targets.filter((t) => !t.pole).every((t) => t.done);
  }

  steady() {
    if (this.history.length < 3) return false;
    const last = this.history.at(-1);
    if (last.t - this.history[0].t < STEADY_MS * 0.8) return false;
    return this.history.every((s) => angleBetween(s.f, last.f) < STEADY_MAX);
  }

  /**
   * The dot to guide toward: ring dots in order, then the optional ceiling and
   * floor; but any remaining dot the ring is already on wins.
   */
  activeTarget(fwd) {
    const left = this.targets.filter((t) => !t.done);
    if (!left.length) return null;
    return left.find((t) => onTarget(t, fwd, AIM_TOLERANCE)) ?? left[0];
  }

  async loop() {
    this.raf = requestAnimationFrame(this.loop);
    if (this.q) this.mosaic.setOrientation(this.q);
    this.draw();
    if (!this.q || this.busy || !this.video.videoWidth) return;
    const fwd = forwardOf(this.q);
    const target = this.activeTarget(fwd);
    if (!target) return this.finish();
    const fresh = this.videoFrameNo - this.moveFrameNo >= FRESH_FRAMES && performance.now() - (this.moveTime ?? 0) >= FRESH_MS;
    if (onTarget(target, fwd, AIM_TOLERANCE) && this.steady() && fresh && performance.now() - this.lastShot > 250) {
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
    // every burst frame is a new one (never the frame that was already on screen)
    for (let k = 0; k < BURST; k++) {
      await nextVideoFrame(this.video);
      const q = this.q.clone();
      if (!onTarget(target, forwardOf(q), AIM_TOLERANCE * 1.5)) break; // drifted off the dot
      if (this.videoFrameNo - this.moveFrameNo < FRESH_FRAMES) break; // moved: frames from now on lag behind
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
    this.tiles.push(this.mosaic.addTile(best.canvas, best.q));
    this.lastShot = performance.now();
    sfx.shutter();
    this.video.classList.remove('shot');
    void this.video.offsetWidth;
    this.video.classList.add('shot');
    // chime when a whole ring is done: horizon (12), upper (20), lower (28)
    if ([12, 20, 28].includes(this.frames.filter((f) => !this.targets[f.targetId].pole).length)) setTimeout(() => sfx.ding(), 120);
    this.updateBar();
  }

  undo() {
    const last = this.frames.pop();
    if (!last) return;
    this.targets.find((t) => t.id === last.targetId).done = false;
    this.mosaic.removeTile(this.tiles.pop());
    sfx.tap();
    this.updateBar();
  }

  updateBar() {
    const rings = this.frames.filter((f) => !this.targets[f.targetId].pole).length;
    this.ringFill.style.strokeDashoffset = String(100 - Math.min(100, (rings / RING_SHOTS) * 100));
    this.finishBtn.disabled = this.frames.length < MIN_SHOTS;
    this.finishBtn.classList.toggle('ready', this.ringsDone());
    this.undoBtn.disabled = !this.frames.length;
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
    if (this.finished || this.frames.length < MIN_SHOTS) return;
    this.finished = true;
    this.stopSensing();
    sfx.ding();
    this.onDone(this.frames, this.mosaic);
  }

  // ---------------------------------------------------------------- overlay

  draw() {
    const c = this.overlay;
    const w = c.clientWidth, hgt = c.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(hgt * dpr); }
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, hgt);
    this.counter.textContent = `${this.frames.length} / ${this.targets.length}`;
    const cx = w / 2, cy = hgt / 2;
    if (!this.q) return;
    const fwd = forwardOf(this.q);
    const active = this.activeTarget(fwd);
    const amber = getComputedStyle(c).getPropertyValue('--capture-accent').trim() || '#e5a43a';
    const on = active ? onTarget(active, fwd, AIM_TOLERANCE) : false;
    const held = on && this.history.length > 1
      ? Math.min(1, (this.history.at(-1).t - this.history[0].t) / STEADY_MS) * (this.steady() ? 1 : 0.4)
      : 0;

    // remaining dots: small and quiet; the next one large, in the accent colour
    for (const t of this.targets) {
      if (t.done) continue;
      const p = this.mosaic.project(t.dir);
      if (!p?.inFront) continue;
      ctx.beginPath();
      if (t === active) {
        ctx.arc(p.x, p.y, 15, 0, Math.PI * 2);
        ctx.fillStyle = amber;
        ctx.fill();
        if (held > 0) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 21, -Math.PI / 2, -Math.PI / 2 + held * Math.PI * 2);
          ctx.strokeStyle = amber;
          ctx.lineWidth = 4;
          ctx.stroke();
        }
      } else {
        ctx.arc(p.x, p.y, t.pole ? 7 : 5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.fill();
      }
    }

    // the ring you aim with, fixed at the centre
    ctx.beginPath();
    ctx.arc(cx, cy, 30, 0, Math.PI * 2);
    ctx.strokeStyle = on ? amber : 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // spirit level: short horizon marks that turn amber when the phone tilts sideways
    const tilt = this.roll();
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-tilt);
    ctx.strokeStyle = Math.abs(tilt) < MAX_TILT ? 'rgba(255,255,255,0.7)' : amber;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-64, 0); ctx.lineTo(-40, 0);
    ctx.moveTo(40, 0); ctx.lineTo(64, 0);
    ctx.stroke();
    ctx.restore();

    if (!active) return;
    const p = this.mosaic.project(active.dir);
    const visible = p?.inFront && p.x > 24 && p.x < w - 24 && p.y > 90 && p.y < hgt - 140;
    const tp = yawPitchOf(active.dir), cp = yawPitchOf(fwd);
    let dyaw = tp.yaw - cp.yaw;
    while (dyaw > Math.PI) dyaw -= 2 * Math.PI;
    while (dyaw < -Math.PI) dyaw += 2 * Math.PI;
    const dpitch = tp.pitch - cp.pitch;
    let text;
    const nearDot = !active.pole && angleBetween(active.dir, fwd) < 15 * DEG;
    if (!active.pole && Math.abs(tilt) > MAX_TILT) text = `Hold the phone upright (tilted ${Math.round(Math.abs(tilt) / DEG)}°)`;
    else if (nearDot && this.turnRate() > FAST_TURN) text = 'Slow down: fast turns blur photos';
    else if (on) text = this.steady() ? 'Hold still…' : 'Steady…';
    else if (active.pole) text = `${active.pole > 0 ? 'Optional: point up at the ceiling' : 'Optional: point down at the floor'}, or tap ✓ to finish`;
    else if (Math.abs(dpitch) > 10 * DEG && Math.abs(dyaw) < 25 * DEG) text = dpitch > 0 ? 'Tilt up' : 'Tilt down';
    else text = dyaw < 0 ? 'Turn right' : 'Turn left';
    this.hint.textContent = text;
    if (!visible && !active.pole) {
      const ang = Math.atan2(-dpitch, -dyaw); // screen: +x right is negative yaw
      const r = Math.min(w, hgt) * 0.34;
      ctx.save();
      ctx.translate(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r);
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.moveTo(18, 0); ctx.lineTo(-10, -13); ctx.lineTo(-10, 13); ctx.closePath();
      ctx.fillStyle = amber;
      ctx.fill();
      ctx.restore();
    }
  }
}
