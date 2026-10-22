// End-to-end test of phone capture without a phone. The camera and gyroscope
// are simulated in the page:
//   - the "camera" renders what a pinhole camera would see inside a known
//     panorama (the sample living room), with a field of view (62°) that the
//     app does not know (it assumes 65° and must calibrate),
//   - the "gyroscope" reports each orientation with up to ±1.5° of error,
//   - every photo gets a different exposure,
//   - every other video frame is smeared with motion blur, so the capture
//     burst must pick a sharp one.
// The device-orientation maths here is written independently from the W3C
// spec (R = Rz(alpha)·Rx(beta)·Ry(gamma)), so it also checks the app's.
// We then compare the stitched panorama with the original.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { createApp } from '../server/app.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const shots = path.join(root, 'test-e2e', 'screenshots');
await fs.mkdir(shots, { recursive: true });
const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spacetwin-capture-'));
const app = await createApp({ dataDir, sampleDir: path.join(root, 'assets', 'sample'), webDist: path.join(root, 'web', 'dist') });
const server = app.listen(0);
await new Promise((r) => server.once('listening', r));
const base = `http://127.0.0.1:${server.address().port}`;

const TRUE_VFOV = 62;
const NOISE_DEG = Number(process.env.NOISE_DEG ?? 1.5);

// Runs in the page before the app: fake camera + gyroscope.
function simulator({ vfov, panoUrl }) {
  const W = 360, H = 480; // portrait frames
  const sim = (window.__sim = { alpha: 0, beta: 90, gamma: 0, noise: { alpha: 0, beta: 0, gamma: 0 }, exposure: 1, ready: false, motionBlur: true, frameNo: 0 });
  const img = new Image();
  img.src = panoUrl;
  img.onload = () => {
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const cx = c.getContext('2d');
    cx.drawImage(img, 0, 0);
    sim.pano = { w: img.width, h: img.height, data: cx.getImageData(0, 0, img.width, img.height).data };
    sim.ready = true;
  };
  const frame = document.createElement('canvas');
  frame.width = W;
  frame.height = H;
  const fctx = frame.getContext('2d');
  const out = fctx.createImageData(W, H);
  const rad = Math.PI / 180;

  // W3C: R = Rz(alpha) Rx(beta) Ry(gamma) takes device coords to earth (x east, y north, z up)
  function rotation(a, b, g) {
    const [ca, sa, cb, sb, cg, sg] = [Math.cos(a), Math.sin(a), Math.cos(b), Math.sin(b), Math.cos(g), Math.sin(g)];
    return [
      [ca * cg - sa * sb * sg, -cb * sa, ca * sg + cg * sa * sb],
      [cg * sa + ca * sb * sg, ca * cb, sa * sg - ca * cg * sb],
      [-cb * sg, sb, cb * cg],
    ];
  }
  function render() {
    requestAnimationFrame(render);
    if (!sim.ready) return;
    const R = rotation(sim.alpha * rad, sim.beta * rad, sim.gamma * rad);
    const ty = Math.tan((vfov * rad) / 2), tx = ty * (W / H);
    const { w: pw, h: ph, data } = sim.pano;
    for (let j = 0; j < H; j++) {
      for (let i = 0; i < W; i++) {
        const x = ((i + 0.5) / W - 0.5) * 2 * tx, y = (0.5 - (j + 0.5) / H) * 2 * ty;
        // rear camera looks along device -z; image right = device x, image up = device y
        const ex = R[0][0] * x + R[0][1] * y - R[0][2];
        const ey = R[1][0] * x + R[1][1] * y - R[1][2];
        const ez = R[2][0] * x + R[2][1] * y - R[2][2];
        // earth → app world: x east, y up, -z north
        const dx = ex, dy = ez, dz = -ey;
        const n = Math.hypot(dx, dy, dz);
        const u = 0.5 + Math.atan2(dx, -dz) / (2 * Math.PI);
        const v = 0.5 - Math.asin(dy / n) / Math.PI;
        const px = Math.min(pw - 1, Math.floor(u * pw)), py = Math.min(ph - 1, Math.floor(v * ph));
        const s = (py * pw + px) * 4, d = (j * W + i) * 4;
        out.data[d] = Math.min(255, data[s] * sim.exposure);
        out.data[d + 1] = Math.min(255, data[s + 1] * sim.exposure);
        out.data[d + 2] = Math.min(255, data[s + 2] * sim.exposure);
        out.data[d + 3] = 255;
      }
    }
    const blurred = sim.motionBlur && Math.random() < 0.5;
    if (blurred) {
      // horizontal smear, like turning during the exposure
      const d = out.data, tmp = new Uint8ClampedArray(d);
      const R = 6;
      for (let j = 0; j < H; j++) {
        for (let i = 0; i < W; i++) {
          for (let c = 0; c < 3; c++) {
            let acc = 0;
            for (let k = -R; k <= R; k++) acc += tmp[(j * W + Math.min(W - 1, Math.max(0, i + k))) * 4 + c];
            d[(j * W + i) * 4 + c] = acc / (2 * R + 1);
          }
        }
      }
    }
    // corner marker so the test can tell which frames the app kept: red = blurred
    for (let j = 0; j < 6; j++) for (let i = 0; i < 6; i++) {
      const d = (j * W + i) * 4;
      out.data[d] = blurred ? 255 : 0; out.data[d + 1] = blurred ? 0 : 255; out.data[d + 2] = 0;
    }
    fctx.putImageData(out, 0, 0);
  }
  requestAnimationFrame(render);
  const stream = frame.captureStream(30);
  navigator.mediaDevices.getUserMedia = async () => stream;
  setInterval(() => {
    window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', {
      alpha: sim.alpha + sim.noise.alpha, beta: sim.beta + sim.noise.beta, gamma: sim.gamma + sim.noise.gamma, absolute: false,
    }));
  }, 30);
}

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const step = (s) => console.log(`• ${s}`);

try {
  const space = await (await fetch(`${base}/api/sample`, { method: 'POST' })).json();
  const truth = space.scans[0];
  const panoUrl = `/api/spaces/${space.id}/scans/${truth.id}/pano`;
  await page.addInitScript(simulator, { vfov: TRUE_VFOV, panoUrl });

  step('capture intro');
  await page.goto(`${base}/#/capture/${space.id}`);
  await page.getByRole('heading', { name: 'Capture a 360° spot' }).waitFor();
  await page.screenshot({ path: path.join(shots, 'c1-capture-intro.png') });
  await page.waitForFunction(() => window.__sim.ready);
  await page.getByRole('button', { name: 'Start capture' }).click();
  await page.locator('.capture-live').waitFor();
  await page.waitForTimeout(500);

  step('aim at every dot');
  // Same order and positions as captureTargets(): yaw turns right (negative).
  const targets = [];
  for (let i = 0; i < 12; i++) targets.push([-(i * 30), 0]);
  for (let i = 0; i < 8; i++) targets.push([-(i * 45 + 22.5), 48]);
  for (let i = 0; i < 8; i++) targets.push([-(i * 45 + 22.5), -48]);
  targets.push([0, 89.9], [0, -89.9]);
  const window_truths = []; // true (alpha, beta, gamma) of each photo
  let rng = 7;
  const rand = () => ((rng = (rng * 16807) % 2147483647) / 2147483647) * 2 - 1;
  for (let k = 0; k < targets.length; k++) {
    const [yaw, pitch] = targets[k];
    // first shot is the heading reference; give the rest gyro error and exposure changes
    const noise = k === 0 ? { alpha: 0, beta: 0, gamma: 0 } : { alpha: rand() * NOISE_DEG, beta: rand() * NOISE_DEG, gamma: rand() * NOISE_DEG };
    const exposure = k === 0 ? 1 : 1 + rand() * 0.15;
    window_truths.push([yaw - noise.alpha, 90 + pitch - noise.beta, -noise.gamma]);
    // the app aims with the (noisy) reading, so point the reading at the dot
    await page.evaluate(({ yaw, pitch, noise, exposure }) => {
      Object.assign(window.__sim, { alpha: yaw - noise.alpha, beta: 90 + pitch - noise.beta, gamma: -noise.gamma, noise, exposure });
    }, { yaw, pitch, noise, exposure });
    await page.waitForFunction((n) => document.querySelector('.capture-counter')?.textContent.startsWith(`${n} /`) || !document.querySelector('.capture-live'), k + 1, { timeout: 8000 });
    if (k === 5) await page.screenshot({ path: path.join(shots, 'c2-capture-live.png') });
  }

  step('stitch');
  await page.locator('.capture-processing').waitFor();
  await page.screenshot({ path: path.join(shots, 'c3-stitching.png') });
  await page.locator('.capture-review').waitFor({ timeout: 300_000 });
  await page.screenshot({ path: path.join(shots, 'c4-review.png') });
  const facts = await page.locator('.capture-review .facts').textContent();
  // Per-photo orientation error after alignment, against the simulator's truth.
  const orient = await page.evaluate((truths) => {
    const { result, frames } = window.__spacetwinLastStitch;
    const errs = (qs) => qs.map((q, i) => {
      const [a, b, g] = truths[i];
      // truth quaternion from the same construction the app uses (verified by the end-to-end match)
      const r = (d) => d * Math.PI / 180;
      const e = { x: r(b), y: r(a), z: -r(g) };
      const c1 = Math.cos(e.x / 2), c2 = Math.cos(e.y / 2), c3 = Math.cos(e.z / 2), s1 = Math.sin(e.x / 2), s2 = Math.sin(e.y / 2), s3 = Math.sin(e.z / 2);
      let t = { x: s1 * c2 * c3 + c1 * s2 * s3, y: c1 * s2 * c3 - s1 * c2 * s3, z: c1 * c2 * s3 - s1 * s2 * c3, w: c1 * c2 * c3 + s1 * s2 * s3 }; // YXZ
      const m = (p, q2) => ({ w: p.w * q2.w - p.x * q2.x - p.y * q2.y - p.z * q2.z, x: p.w * q2.x + p.x * q2.w + p.y * q2.z - p.z * q2.y, y: p.w * q2.y - p.x * q2.z + p.y * q2.w + p.z * q2.x, z: p.w * q2.z + p.x * q2.y - p.y * q2.x + p.z * q2.w });
      t = m(t, { x: -Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 });
      const dot = Math.abs(t.x * q.x + t.y * q.y + t.z * q.z + t.w * q.w);
      return (2 * Math.acos(Math.min(1, dot)) * 180) / Math.PI;
    });
    return { raw: errs(frames.map((f) => f.q)), refined: errs(result.quaternions) };
  }, window_truths);
  const stats = (a) => `max ${Math.max(...a).toFixed(2)}, mean ${(a.reduce((s, x) => s + x, 0) / a.length).toFixed(2)}`;
  console.log(`  gyro orientation error before alignment (deg): ${stats(orient.raw)}`);
  const blurredKept = await page.evaluate(async () => {
    let n = 0;
    const which = [];
    for (const f of window.__spacetwinLastStitch.frames) {
      const bmp = await createImageBitmap(f.blob);
      const c = new OffscreenCanvas(4, 4);
      c.getContext('2d').drawImage(bmp, 0, 0, 4, 4, 0, 0, 4, 4);
      const [r, g] = c.getContext('2d').getImageData(1, 1, 1, 1).data;
      if (r > g) { n++; which.push(`#${f.targetId} (sharpness ${f.sharpness.toFixed(0)})`); }
    }
    return { n, which };
  });
  console.log(`  blurred photos kept: ${blurredKept.n} of 30 (half of all video frames are blurred) ${blurredKept.which.join(', ')}`);
  console.log(`  orientation error after alignment (deg):        ${stats(orient.refined)}`);
  console.log(`  worst photos: ${orient.refined.map((e, i) => [i, e]).sort((x, y) => y[1] - x[1]).slice(0, 5).map(([i, e]) => `#${i} ${e.toFixed(2)}°`).join(', ')}`);
  console.log(`  ${facts.replace(/\s+/g, ' ')}`);

  step('compare with the original panorama');
  const metrics = await page.evaluate(async (truthUrl) => {
    const load = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
    const [a, b] = await Promise.all([load(document.querySelector('.pano-preview').src), load(truthUrl)]);
    const W = 1024, H = 512;
    const pix = (im) => { const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); x.drawImage(im, 0, 0, W, H); return x.getImageData(0, 0, W, H).data; };
    const pa = pix(a), pb = pix(b);
    // skip the bottom 8% (nadir: where the photographer/tripod would be)
    let sum = 0, n = 0;
    for (let y = 0; y < H * 0.92; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      sum += Math.abs(pa[i] - pb[i]) + Math.abs(pa[i + 1] - pb[i + 1]) + Math.abs(pa[i + 2] - pb[i + 2]);
      n += 3;
    }
    const blob = await (await fetch(document.querySelector('.pano-preview').src)).blob();
    return { meanAbsError: sum / n, width: a.naturalWidth, height: a.naturalHeight, bytes: blob.size, dataUrl: await new Promise((r) => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(blob); }) };
  }, panoUrl);
  await fs.writeFile(path.join(shots, 'c5-stitched.jpg'), Buffer.from(metrics.dataUrl.split(',')[1], 'base64'));
  console.log(`  stitched ${metrics.width}×${metrics.height}, mean abs error vs truth ${metrics.meanAbsError.toFixed(2)}/255`);
  assert.equal(metrics.width, 2 * metrics.height);
  const vfov = Number(facts.match(/([\d.]+)° vertical/)[1]);
  assert.ok(Math.abs(vfov - TRUE_VFOV) <= 1, `calibrated vfov ${vfov}, truth ${TRUE_VFOV}`);
  // with a perfect gyroscope this pipeline scores ~6.2 (resampling + JPEG)
  assert.ok(metrics.meanAbsError < 7.5, `stitched panorama differs from the truth by ${metrics.meanAbsError.toFixed(1)}/255`);
  assert.ok(blurredKept.n <= 4, `${blurredKept.n} blurred photos were kept`);
  const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
  if (NOISE_DEG > 0) assert.ok(mean(orient.refined) < mean(orient.raw), 'alignment should reduce orientation error');

  step('save the spot');
  await page.getByRole('button', { name: 'Save spot' }).click();
  await page.getByRole('heading', { name: /Saved/ }).waitFor({ timeout: 30_000 });
  const after = await (await fetch(`${base}/api/spaces/${space.id}`)).json();
  assert.equal(after.scans.length, 3);
  assert.equal(after.scans[2].cameraHeight, 1.5);
  assert.equal(after.scans[2].name, 'Spot 3');

  assert.deepEqual(errors, [], errors.join('\n'));
  console.log('CAPTURE OK');
} finally {
  await browser.close();
  server.close();
  await fs.rm(dataDir, { recursive: true, force: true });
}
