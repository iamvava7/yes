import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  bestScanForRoom, isSimplePolygon, normalizePolygon, pointInPolygon, polygonArea, roomMesh, signedArea, triangulate,
} from '../shared/geometry.js';

const L = [[0, 0], [4, 0], [4, 2], [2, 2], [2, 4], [0, 4]]; // L-shape, 12 m²

test('area and orientation', () => {
  assert.equal(polygonArea(L), 12);
  const cw = L.slice().reverse();
  assert.ok(signedArea(cw) < 0);
  assert.ok(signedArea(normalizePolygon(cw)) > 0);
});

test('normalizePolygon drops duplicates and collinear points', () => {
  const pts = normalizePolygon([[0, 0], [1, 0], [2, 0], [2, 0], [2, 2], [0, 2]]);
  assert.deepEqual(pts, [[0, 0], [2, 0], [2, 2], [0, 2]]);
});

test('triangulation of a concave room covers its area exactly', () => {
  const tris = triangulate(L);
  assert.equal(tris.length, L.length - 2);
  const sum = tris.reduce((s, [a, b, c]) => s + polygonArea([L[a], L[b], L[c]]), 0);
  assert.ok(Math.abs(sum - 12) < 1e-9);
});

test('self-intersecting polygons are rejected', () => {
  assert.equal(isSimplePolygon([[0, 0], [2, 2], [2, 0], [0, 2]]), false);
  assert.equal(isSimplePolygon(L), true);
});

test('room mesh faces: floor up, walls inward, ceiling down', () => {
  const room = { points: [[0, 0], [3, 0], [3, 2], [0, 2]], height: 2.5 };
  const { positions, surfaces } = roomMesh(room);
  const center = [1.5, 1.25, 1];
  for (let i = 0; i < positions.length; i += 9) {
    const a = positions.slice(i, i + 3), b = positions.slice(i + 3, i + 6), c = positions.slice(i + 6, i + 9);
    const u = b.map((v, k) => v - a[k]), w = c.map((v, k) => v - a[k]);
    const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const toCenter = center.map((v, k) => v - a[k]);
    const facing = n[0] * toCenter[0] + n[1] * toCenter[1] + n[2] * toCenter[2];
    assert.ok(facing > 0, `triangle ${i / 9} (surface ${surfaces[i / 3]}) faces away from the room interior`);
  }
});

test('bestScanForRoom prefers a scan standing inside the room', () => {
  const room = { points: [[0, 0], [4, 0], [4, 4], [0, 4]] };
  const scans = [{ id: 'out', position: { x: 2, z: 4.5 } }, { id: 'in', position: { x: 3.8, z: 3.8 } }];
  assert.equal(bestScanForRoom(room, scans).id, 'in');
  assert.equal(pointInPolygon([2, 4.5], room.points), false);
});
