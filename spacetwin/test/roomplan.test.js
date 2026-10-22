import assert from 'node:assert/strict';
import { test } from 'node:test';
import { polygonArea } from '../shared/geometry.js';
import { capturedRoomToRooms, transformPoint } from '../server/roomplan.js';

// Build a CapturedRoom-like JSON the way RoomPlan describes walls: a rectangle
// centred on its transform, local x along the wall, y up, `dimensions` [w, h, 0].
function wallJson([x1, z1], [x2, z2], height, floorY, { flip = false, shrink = 0, nested = false } = {}) {
  if (flip) [x1, z1, x2, z2] = [x2, z2, x1, z1];
  const len = Math.hypot(x2 - x1, z2 - z1);
  const ax = [(x2 - x1) / len, 0, (z2 - z1) / len];
  const up = [0, 1, 0];
  const nz = [ax[1] * up[2] - ax[2] * up[1], ax[2] * up[0] - ax[0] * up[2], ax[0] * up[1] - ax[1] * up[0]];
  const c = [(x1 + x2) / 2, floorY + height / 2, (z1 + z2) / 2];
  const flat = [...ax, 0, ...up, 0, ...nz, 0, ...c, 1];
  return {
    identifier: crypto.randomUUID(),
    category: { wall: {} },
    confidence: { high: {} },
    dimensions: [len - 2 * shrink, height, 0],
    transform: nested ? [flat.slice(0, 4), flat.slice(4, 8), flat.slice(8, 12), flat.slice(12)] : flat,
  };
}

const L = [[0, 0], [6, 0], [6, 3], [3, 3], [3, 5], [0, 5]]; // 24 m²

test('walls are chained into the room outline, whatever their order and direction', () => {
  const walls = L.map((p, i) => wallJson(p, L[(i + 1) % L.length], 2.6, -1.4, { flip: i % 2 === 1, shrink: 0.04, nested: i === 2 }));
  const shuffled = [walls[3], walls[0], walls[5], walls[1], walls[4], walls[2]];
  const door = { ...wallJson([1, 0], [2, 0], 2.0, -1.4), category: { door: { isOpen: false } } };
  const rooms = capturedRoomToRooms({ walls: shuffled, doors: [door], windows: [], objects: [] }, { name: 'Lounge' });
  assert.equal(rooms.length, 1);
  assert.equal(rooms[0].name, 'Lounge');
  assert.equal(rooms[0].height, 2.6);
  assert.equal(rooms[0].points.length, 6);
  // corners come from intersecting wall lines, so the 4 cm gaps at each end vanish
  assert.ok(Math.abs(polygonArea(rooms[0].points) - 24) < 1e-6, `area ${polygonArea(rooms[0].points)}`);
});

test('iOS 17 floor outlines are used when present', () => {
  // floor surface lying flat: local x → world x, local y → world -z, local z → world up
  const m = [1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, 1, -1.4, 1, 1];
  const corners = [[-2, -1.5, 0], [2, -1.5, 0], [2, 1.5, 0], [-2, 1.5, 0]];
  assert.deepEqual(transformPoint(m, corners[0]).map((v) => Math.round(v * 1000) / 1000), [-1, -1.4, 2.5]);
  const rooms = capturedRoomToRooms({
    walls: [wallJson([0, 0], [1, 0], 2.4, -1.4)],
    floors: [{ category: { floor: {} }, dimensions: [4, 3, 0], transform: m, polygonCorners: corners }],
  });
  assert.equal(rooms.length, 1);
  assert.ok(Math.abs(polygonArea(rooms[0].points) - 12) < 1e-6);
  assert.equal(rooms[0].height, 2.4);
});

test('multi-room structures produce one room each', () => {
  const box = (x0) => [[x0, 0], [x0 + 3, 0], [x0 + 3, 3], [x0, 3]];
  const room = (pts) => ({ walls: pts.map((p, i) => wallJson(p, pts[(i + 1) % 4], 2.5, 0)) });
  const rooms = capturedRoomToRooms({ rooms: [room(box(0)), room(box(3))] }, { name: 'Floor' });
  assert.deepEqual(rooms.map((r) => r.name), ['Floor 1', 'Floor 2']);
  assert.deepEqual(rooms.map((r) => polygonArea(r.points)), [9, 9]);
});

test('an incomplete scan is reported, not guessed', () => {
  const walls = L.slice(0, 4).map((p, i) => wallJson(p, L[i + 1], 2.6, 0));
  assert.throws(() => capturedRoomToRooms({ walls }), /closed room outline/);
  assert.throws(() => capturedRoomToRooms({ walls: [{ dimensions: [1, 2, 0], transform: [1, 2, 3] }] }), /4×4/);
});
