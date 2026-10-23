// Posed-capture endpoint: render photos from the sample panorama at known
// ARKit-style poses, upload them, and compare the stitched result with the
// original panorama.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import jpeg from 'jpeg-js';
import { createApp } from '../server/app.js';
import { detectProStitch } from '../server/proStitch.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sampleDir = path.join(root, 'assets', 'sample');
let server, base, builtinServer, builtinBase, dataDir, pano, hasOpenCv;

async function listen(app) {
  const s = app.listen(0);
  await new Promise((r) => s.once('listening', r));
  return [s, `http://127.0.0.1:${s.address().port}/api`];
}

before(async () => {
  dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spacetwin-captures-'));
  [server, base] = await listen(await createApp({ dataDir, sampleDir }));
  [builtinServer, builtinBase] = await listen(await createApp({ dataDir, sampleDir, proStitch: false }));
  hasOpenCv = Boolean(await detectProStitch());
  pano = jpeg.decode(await fs.readFile(path.join(sampleDir, 'scan-1.jpg')), { useTArray: true, maxMemoryUsageInMB: 512 });
});

after(async () => {
  server.close();
  builtinServer.close();
  await fs.rm(dataDir, { recursive: true, force: true });
});

const W = 640, H = 480, FX = 554, FY = 554, CX = 319.5, CY = 239.5; // landscape, ~60° wide

function samplePano(dx, dy, dz) {
  const u = 0.5 + Math.atan2(dx, -dz) / (2 * Math.PI);
  const v = 0.5 - Math.asin(Math.max(-1, Math.min(1, dy))) / Math.PI;
  const x = Math.min(pano.width - 1, Math.floor(u * pano.width)), y = Math.min(pano.height - 1, Math.floor(v * pano.height));
  return (y * pano.width + x) * 4;
}

/** Camera → world transform (column-major) looking along (yaw, pitch), image upright. */
function pose(yawDeg, pitchDeg, position) {
  const yaw = (yawDeg * Math.PI) / 180, pitch = (pitchDeg * Math.PI) / 180;
  const f = [-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)];
  const ref = Math.abs(f[1]) > 0.99 ? [-Math.sin(yaw), 0, -Math.cos(yaw)] : [0, 1, 0];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (a) => { const l = Math.hypot(...a); return a.map((v) => v / l); };
  const right = norm(cross(f, ref)), up = cross(right, f);
  return [...right, 0, ...up, 0, ...f.map((v) => -v), 0, ...position, 1];
}

function renderFrame(t, exposure) {
  const out = Buffer.alloc(W * H * 4);
  for (let v = 0; v < H; v++) {
    for (let u = 0; u < W; u++) {
      const x = (u - CX) / FX, y = -(v - CY) / FY;
      const dx = t[0] * x + t[4] * y - t[8], dy = t[1] * x + t[5] * y - t[9], dz = t[2] * x + t[6] * y - t[10];
      const n = Math.hypot(dx, dy, dz);
      const s = samplePano(dx / n, dy / n, dz / n), o = (v * W + u) * 4;
      for (let c = 0; c < 3; c++) out[o + c] = Math.min(255, pano.data[s + c] * exposure);
      out[o + 3] = 255;
    }
  }
  return jpeg.encode({ data: out, width: W, height: H }, 92).data;
}

async function stitchAndCompare(base, expectedStitcher) {
  const { id } = await (await fetch(`${base}/spaces`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"name":"Native"}' })).json();
  const position = [2, 0.1, 2.2]; // ARKit y=0 is wherever the session started
  const floorY = -1.4;
  const shots = [];
  for (let i = 0; i < 10; i++) shots.push([-i * 36, 0]);
  for (let i = 0; i < 8; i++) shots.push([-i * 45 - 22.5, 45], [-i * 45 - 22.5, -45]);
  shots.push([0, 90], [0, -90]);
  const form = new FormData();
  const frames = [];
  shots.forEach(([yaw, pitch], i) => {
    const t = pose(yaw, pitch, position);
    form.append('frames', new Blob([renderFrame(t, 1 + 0.12 * Math.sin(i * 1.7))], { type: 'image/jpeg' }), `f${i}.jpg`);
    frames.push({ transform: t, intrinsics: [FX, 0, 0, 0, FY, 0, CX, CY, 1] });
  });
  form.append('meta', JSON.stringify({ name: 'Hall', floorY, width: 1024, frames }));
  const res = await fetch(`${base}/spaces/${id}/captures`, { method: 'POST', body: form });
  const space = await res.json();
  assert.equal(res.status, 201, JSON.stringify(space));
  const scan = space.scans[0];
  assert.equal(scan.name, 'Hall');
  assert.deepEqual(scan.position, { x: 2, z: 2.2 });
  assert.equal(scan.cameraHeight, 1.5); // 0.1 - (-1.4)
  assert.equal(scan.width, 1024);
  assert.equal(scan.stitcher, expectedStitcher);

  const stitched = jpeg.decode(Buffer.from(await (await fetch(`${base}/spaces/${id}/scans/${scan.id}/pano`)).arrayBuffer()), { useTArray: true });
  // compare structure after fitting out global tone (the finish changes it on purpose)
  const pairs = [];
  for (let y = 0; y < 512 * 0.92; y++) {
    for (let x = 0; x < 1024; x++) {
      const lat = (0.5 - (y + 0.5) / 512) * Math.PI, lon = ((x + 0.5) / 1024 - 0.5) * 2 * Math.PI;
      const s = samplePano(Math.cos(lat) * Math.sin(lon), Math.sin(lat), -Math.cos(lat) * Math.cos(lon));
      const o = (y * 1024 + x) * 4;
      for (let c = 0; c < 3; c++) pairs.push([c, stitched.data[o + c], pano.data[s + c]]);
    }
  }
  const fit = [0, 1, 2].map((c) => {
    let sx = 0, sy = 0, sxx = 0, sxy = 0, k = 0;
    for (const [ch, x, y] of pairs) if (ch === c) { sx += x; sy += y; sxx += x * x; sxy += x * y; k++; }
    const a = (k * sxy - sx * sy) / (k * sxx - sx * sx);
    return { a, b: (sy - a * sx) / k };
  });
  let sum = 0, n = 0;
  for (const [c, x, y] of pairs) { sum += Math.abs(fit[c].a * x + fit[c].b - y); n++; }
  const err = sum / n;
  assert.ok(err < 6, `stitched panorama differs from the original by ${err.toFixed(2)}/255 after tone fit`);
  assert.ok(fit.every((f) => f.a > 0.75 && f.a < 1.25), 'tone finish should stay gentle');
}

test('posed photos are stitched into a scan placed where they were taken (built-in stitcher)', () => stitchAndCompare(builtinBase, 'builtin'));

test('posed photos are stitched with OpenCV seams and multi-band blending when installed', async (t) => {
  if (!hasOpenCv) return t.skip('Python with OpenCV is not installed (pip install opencv-python-headless)');
  await stitchAndCompare(base, 'opencv');
  const caps = await (await fetch(`${base}/capabilities`)).json();
  assert.equal(caps.proStitch, true);
});

test('/stitch returns a panorama without saving it, and needs OpenCV', async () => {
  const form = new FormData();
  const frames = [];
  for (let i = 0; i < 8; i++) {
    const t = pose(-i * 45, 0, [0, 0, 0]);
    form.append('frames', new Blob([renderFrame(t, 1)], { type: 'image/jpeg' }), `f${i}.jpg`);
    frames.push({ transform: t, intrinsics: [FX, 0, 0, 0, FY, 0, CX, CY, 1] });
  }
  form.append('meta', JSON.stringify({ width: 512, frames }));
  const res = await fetch(`${hasOpenCv ? base : builtinBase}/stitch`, { method: 'POST', body: form });
  if (!hasOpenCv) {
    assert.equal(res.status, 501);
    return;
  }
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('x-stitcher'), 'opencv');
  const img = jpeg.decode(Buffer.from(await res.arrayBuffer()));
  assert.deepEqual([img.width, img.height], [512, 256]);
  const off = await (await fetch(`${builtinBase}/stitch`, { method: 'POST', body: form })).json();
  assert.match(off.error, /OpenCV/);
});

test('bad capture uploads are rejected with a reason', async () => {
  const { id } = await (await fetch(`${base}/spaces`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"name":"Bad"}' })).json();
  const form = new FormData();
  form.append('frames', new Blob([Buffer.from('x')], { type: 'image/jpeg' }), 'a.jpg');
  form.append('meta', '{"frames": []}');
  const res = await fetch(`${base}/spaces/${id}/captures`, { method: 'POST', body: form });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /at least two/);

  const rp = await fetch(`${base}/spaces/${id}/roomplan`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ capturedRoom: { walls: [] } }) });
  assert.equal(rp.status, 400);
  assert.match((await rp.json()).error, /closed room outline/);
});
