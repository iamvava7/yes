import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fillHoles } from '../shared/fill.js';

test('unphotographed ceiling and floor are filled smoothly toward each pole', () => {
  const W = 64, H = 32;
  const px = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const hole = y < 6 || y >= H - 4; // top cap and bottom cap missing
      // walls: left half warm, right half cool, so the pole average is in between
      px.set(hole ? [0, 0, 0, 0] : x < W / 2 ? [200, 150, 100, 255] : [100, 150, 200, 255], i);
    }
  }
  const filled = fillHoles(px, W, H);
  assert.equal(filled, W * 10);
  for (let i = 3; i < px.length; i += 4) assert.equal(px[i], 255, 'no holes left');
  // top row is the averaged pole colour; the first filled row stays close to the wall below it
  const at = (x, y) => [...px.subarray((y * W + x) * 4, (y * W + x) * 4 + 3)];
  assert.deepEqual(at(5, 0), [150, 150, 150]);
  assert.deepEqual(at(60, 0), [150, 150, 150]);
  const near = at(10, 5);
  assert.ok(Math.abs(near[0] - 200) < 30 && Math.abs(near[2] - 100) < 30, `edge row ${near}`);
  // photographed pixels are untouched
  assert.deepEqual(at(10, 10), [200, 150, 100]);
});

test('a fully photographed panorama is left alone', () => {
  const px = new Uint8ClampedArray(16 * 8 * 4).fill(255);
  assert.equal(fillHoles(px, 16, 8), 0);
});
