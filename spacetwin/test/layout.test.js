import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import jpeg from 'jpeg-js';
import { createApp } from '../server/app.js';
import { estimateLayout, placeRoom, polygonArea, toGrey } from '../server/layout.js';
import { createVerificasaClient } from '../server/verificasa.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sampleDir = path.join(root, 'assets', 'sample');
const manifest = JSON.parse(await fs.readFile(path.join(sampleDir, 'manifest.json'), 'utf8'));

// Every true corner has a detected corner within `tol` metres.
function closeOutline(found, truth, tol) {
  return truth.every(([x, z]) => found.some(([a, b]) => Math.hypot(a - x, b - z) < tol));
}

test('the room around each sample panorama is found from the photo alone', async () => {
  for (const [i, scan] of manifest.scans.entries()) {
    const img = jpeg.decode(await fs.readFile(path.join(sampleDir, scan.file)), { useTArray: true });
    const { grey, W, H } = toGrey(img.data, img.width, img.height, 1024);
    const layout = estimateLayout(grey, W, H, { cameraHeight: scan.cameraHeight });
    const truth = manifest.rooms[i];
    assert.ok(layout, `${scan.name}: a room was found`);
    const world = placeRoom(layout, scan);
    assert.equal(world.length, 4, `${scan.name}: four walls (got ${JSON.stringify(world)})`);
    assert.ok(closeOutline(world, truth.points, 0.25), `${scan.name}: corners within 25 cm: ${JSON.stringify(world)}`);
    assert.ok(Math.abs(layout.height - truth.height) < 0.15, `${scan.name}: height ${layout.height} vs ${truth.height}`);
    assert.ok(Math.abs(polygonArea(world) - polygonArea(truth.points)) / polygonArea(truth.points) < 0.08, `${scan.name}: area`);
    assert.ok(layout.confidence > 0.7, `${scan.name}: confidence ${layout.confidence}`);
  }
});

test('a plain grey panorama has no walls to find', () => {
  const W = 512, H = 256;
  assert.equal(estimateLayout(new Float32Array(W * H).fill(128), W, H), null);
});

test('API: detect a spot\'s room, then add it to the floor plan', async () => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spacetwin-layout-'));
  const app = await createApp({ dataDir, sampleDir, proStitch: false, verificasa: createVerificasaClient({ config: { api: 'off', appId: '', site: '' } }) });
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  try {
    const space = await (await fetch(`${base}/sample`, { method: 'POST' })).json();
    const scan = space.scans[1];
    let res = await fetch(`${base}/spaces/${space.id}/scans/${scan.id}/auto-room`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    let out = await res.json();
    assert.equal(res.status, 200, JSON.stringify(out));
    assert.ok(closeOutline(out.room.points, manifest.rooms[1].points, 0.25));
    assert.equal(out.space, undefined, 'a proposal only');

    res = await fetch(`${base}/spaces/${space.id}/scans/${scan.id}/auto-room`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"save":true}' });
    out = await res.json();
    const before = space.rooms.length;
    assert.equal(out.space.rooms.length, before + 1);
    res = await fetch(`${base}/spaces/${space.id}/scans/${scan.id}/auto-room`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"save":true}' });
    out = await res.json();
    assert.equal(out.space.rooms.length, before + 1, 'detecting again replaces the room, never duplicates it');
  } finally {
    server.close();
    await fs.rm(dataDir, { recursive: true, force: true });
  }
});
