import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createApp } from '../server/app.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sampleDir = path.join(root, 'assets', 'sample');
let server, base, dataDir;

before(async () => {
  dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spacetwin-test-'));
  const app = await createApp({ dataDir, sampleDir });
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});

after(async () => {
  server.close();
  await fs.rm(dataDir, { recursive: true, force: true });
});

const json = (method, url, body) =>
  fetch(base + url, { method, headers: { 'content-type': 'application/json' }, body: body && JSON.stringify(body) });

async function uploadPano(id, file, name = 'pano.jpg', type = 'image/jpeg') {
  const form = new FormData();
  form.append('panorama', new Blob([await fs.readFile(file)], { type }), name);
  return fetch(`${base}/spaces/${id}/scans`, { method: 'POST', body: form });
}

test('space lifecycle: create, upload, position, rooms, tags, exports, delete', async () => {
  let res = await json('POST', '/spaces', { name: 'Flat 4B' });
  assert.equal(res.status, 201);
  const { id } = await res.json();

  res = await uploadPano(id, path.join(sampleDir, 'scan-1.jpg'), 'Kitchen.jpg');
  assert.equal(res.status, 201);
  let space = await res.json();
  assert.equal(space.scans.length, 1);
  assert.equal(space.scans[0].name, 'Kitchen');
  assert.equal(space.scans[0].width, 4096);
  const scanId = space.scans[0].id;

  res = await fetch(`${base}/spaces/${id}/scans/${scanId}/pano`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'image/jpeg');

  res = await json('PATCH', `/spaces/${id}/scans/${scanId}`, { position: { x: 1, z: 2 }, heading: -90 });
  space = await res.json();
  assert.deepEqual(space.scans[0].position, { x: 1, z: 2 });
  assert.equal(space.scans[0].heading, 270);

  // clockwise input is normalised; area is reported back
  res = await json('PUT', `/spaces/${id}/rooms`, { rooms: [{ name: 'Kitchen', height: 2.5, points: [[0, 0], [0, 3], [4, 3], [4, 0]] }] });
  assert.equal(res.status, 200);
  space = await res.json();
  assert.equal(space.stats.totalArea, 12);
  assert.ok(space.rooms[0].points.length === 4);

  res = await json('POST', `/spaces/${id}/tags`, { label: 'Boiler', position: [1, 1.2, 0] });
  assert.equal(res.status, 201);
  const tag = await res.json();
  res = await json('PATCH', `/spaces/${id}/tags/${tag.id}`, { description: 'Serviced 2026' });
  assert.equal((await res.json()).description, 'Serviced 2026');

  const obj = await (await fetch(`${base}/spaces/${id}/export/model.obj`)).text();
  assert.match(obj, /^o Kitchen$/m);
  assert.equal(obj.split('\n').filter((l) => l.startsWith('f ')).length, 2 + 2 + 8); // floor, ceiling, 4 walls

  const svg = await (await fetch(`${base}/spaces/${id}/export/floorplan.svg`)).text();
  assert.match(svg, /12\.0 m²/);
  assert.match(svg, /4\.00 m/);

  res = await fetch(`${base}/spaces/${id}`, { method: 'DELETE' });
  assert.equal(res.status, 204);
  assert.equal((await fetch(`${base}/spaces/${id}`)).status, 404);
});

test('rejects non-panoramic images and bad geometry', async () => {
  const { id } = await (await json('POST', '/spaces', { name: 'Validation' })).json();

  const square = path.join(dataDir, 'square.png');
  // 1×1 PNG
  await fs.writeFile(square, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));
  let res = await uploadPano(id, square, 'square.png', 'image/png');
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /2:1/);

  res = await json('PUT', `/spaces/${id}/rooms`, { rooms: [{ points: [[0, 0], [2, 2], [2, 0], [0, 2]] }] });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /cross/);

  res = await json('PUT', `/spaces/${id}/rooms`, { rooms: [{ points: [[0, 0], [1, 1]] }] });
  assert.equal(res.status, 400);

  res = await json('POST', `/spaces/${id}/tags`, { label: '', position: [0, 0, 0] });
  assert.equal(res.status, 400);

  assert.equal((await fetch(`${base}/spaces/../../etc`)).status, 404);
  assert.equal((await fetch(`${base}/spaces/zzzzzzzzzzzz`)).status, 404);
});

test('concurrent scan edits are serialised, not lost', async () => {
  const space = await (await json('POST', '/sample')).json();
  const [a, b] = space.scans;
  await Promise.all([
    json('PATCH', `/spaces/${space.id}/scans/${a.id}`, { name: 'First' }),
    json('PATCH', `/spaces/${space.id}/scans/${b.id}`, { name: 'Second' }),
  ]);
  const after = await (await fetch(`${base}/spaces/${space.id}`)).json();
  assert.deepEqual(after.scans.map((s) => s.name), ['First', 'Second']);
  assert.equal(after.stats.roomCount, 2);
  assert.ok(Math.abs(after.stats.totalArea - 34) < 1e-9);
});
