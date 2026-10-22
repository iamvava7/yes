import assert from 'node:assert/strict';
import { test } from 'node:test';
import { laplacianVariance } from '../web/src/capture/sharpness.js';

test('blur lowers the variance-of-Laplacian score', () => {
  const W = 96, H = 64;
  const sharp = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) sharp[y * W + x] = ((x >> 3) + (y >> 3)) % 2 ? 220 : 40; // checkerboard
  const blurred = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let acc = 0;
      for (let k = -4; k <= 4; k++) acc += sharp[y * W + Math.min(W - 1, Math.max(0, x + k))];
      blurred[y * W + x] = acc / 9;
    }
  }
  const s = laplacianVariance(sharp, W, H), b = laplacianVariance(blurred, W, H);
  assert.ok(s > 4 * b, `sharp ${s.toFixed(0)} vs blurred ${b.toFixed(0)}`);
  assert.equal(laplacianVariance(new Float32Array(W * H).fill(128), W, H), 0);
});
