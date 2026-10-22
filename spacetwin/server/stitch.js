// Server-side panorama stitching for photos that arrive with exact poses, i.e.
// from the native iOS app, where ARKit tracks the camera to well under a
// degree and reports the lens intrinsics. With poses that good no alignment
// search is needed: we balance exposure between photos, then blend them into
// an equirectangular panorama with the same weighting the browser stitcher
// uses (web/src/capture/stitch.js).
//
// ARKit conventions (all matrices column-major, as simd encodes them):
//   transform   camera → world, camera looks down -z, x right, y up
//   intrinsics  3×3 [fx 0 0, 0 fy 0, cx cy 1]; pixel v grows downward
import jpeg from 'jpeg-js';

/** Decode a JPEG and check its pose. */
export function prepareFrame(buffer, { transform, intrinsics }) {
  const img = jpeg.decode(buffer, { useTArray: true, formatAsRGBA: true, maxMemoryUsageInMB: 512 });
  const m = flatten(transform, 16, 'transform');
  const k = flatten(intrinsics, 9, 'intrinsics');
  // world → camera rotation is the transpose of the camera → world rotation
  const rt = [m[0], m[1], m[2], m[4], m[5], m[6], m[8], m[9], m[10]]; // rows of R^T
  const fx = k[0], fy = k[4], cx = k[6], cy = k[7];
  if (!(fx > 0 && fy > 0)) throw new Error('intrinsics need positive focal lengths');
  const { width: w, height: h } = img;
  const forward = [-m[8], -m[9], -m[10]];
  const halfDiag = Math.atan(Math.hypot(Math.max(cx, w - cx) / fx, Math.max(cy, h - cy) / fy));
  return { data: img.data, w, h, rt, fx, fy, cx, cy, forward, cosCull: Math.cos(Math.min(halfDiag, Math.PI / 2 - 1e-3)), position: [m[12], m[13], m[14]] };
}

function flatten(v, n, name) {
  const flat = Array.isArray(v?.[0]) ? v.flat() : v;
  if (!Array.isArray(flat) || flat.length !== n || !flat.every(Number.isFinite)) throw new Error(`${name} must have ${n} numbers`);
  return flat;
}

/** Project a world direction into a frame: pixel coordinates, or null if outside. */
function project(f, dx, dy, dz) {
  const r = f.rt;
  const x = r[0] * dx + r[1] * dy + r[2] * dz;
  const y = r[3] * dx + r[4] * dy + r[5] * dz;
  const z = r[6] * dx + r[7] * dy + r[8] * dz;
  if (z >= -1e-6) return null;
  const u = f.cx + (f.fx * x) / -z, v = f.cy - (f.fy * y) / -z;
  if (u < 0 || v < 0 || u > f.w - 1 || v > f.h - 1) return null;
  return [u, v];
}

function bilinear(f, u, v, out) {
  const x0 = Math.floor(u), y0 = Math.floor(v);
  const x1 = Math.min(x0 + 1, f.w - 1), y1 = Math.min(y0 + 1, f.h - 1);
  const ax = u - x0, ay = v - y0;
  const d = f.data, w = f.w;
  for (let c = 0; c < 3; c++) {
    const p00 = d[(y0 * w + x0) * 4 + c], p10 = d[(y0 * w + x1) * 4 + c];
    const p01 = d[(y1 * w + x0) * 4 + c], p11 = d[(y1 * w + x1) * 4 + c];
    out[c] = (p00 * (1 - ax) + p10 * ax) * (1 - ay) + (p01 * (1 - ax) + p11 * ax) * ay;
  }
  return out;
}

/** Per-photo exposure gains from overlap brightness (same model as the browser stitcher). */
export function estimateGains(frames) {
  const n = frames.length;
  const A = Array.from({ length: n }, () => new Float64Array(n));
  const rhs = new Float64Array(n);
  const sigmaN = 10, sigmaG = 0.1, G = 24;
  const px = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const fi = frames[i], fj = frames[j];
      const dot = fi.forward[0] * fj.forward[0] + fi.forward[1] * fj.forward[1] + fi.forward[2] * fj.forward[2];
      if (dot < Math.cos(80 * Math.PI / 180)) continue;
      let si = 0, sj = 0, cnt = 0;
      for (let gy = 0; gy < G; gy++) {
        for (let gx = 0; gx < G; gx++) {
          // ray through a grid point of photo i, in world space (R = (R^T)^T)
          const x = ((gx + 0.5) / G * fi.w - fi.cx) / fi.fx, y = -((gy + 0.5) / G * fi.h - fi.cy) / fi.fy;
          const r = fi.rt;
          const dx = r[0] * x + r[3] * y - r[6], dy = r[1] * x + r[4] * y - r[7], dz = r[2] * x + r[5] * y - r[8];
          const p = project(fj, dx, dy, dz);
          if (!p) continue;
          bilinear(fi, (gx + 0.5) / G * (fi.w - 1), (gy + 0.5) / G * (fi.h - 1), px);
          si += 0.299 * px[0] + 0.587 * px[1] + 0.114 * px[2];
          bilinear(fj, p[0], p[1], px);
          sj += 0.299 * px[0] + 0.587 * px[1] + 0.114 * px[2];
          cnt++;
        }
      }
      if (cnt < 20) continue;
      const Ii = si / cnt, Ij = sj / cnt, N = cnt / (G * G);
      A[i][i] += (N * Ii * Ii) / sigmaN ** 2; A[i][j] -= (N * Ii * Ij) / sigmaN ** 2;
      A[j][j] += (N * Ij * Ij) / sigmaN ** 2; A[j][i] -= (N * Ii * Ij) / sigmaN ** 2;
    }
  }
  for (let i = 0; i < n; i++) { A[i][i] += 1 / sigmaG ** 2; rhs[i] += 1 / sigmaG ** 2; }
  return solve(A, rhs).map((g) => Math.min(2, Math.max(0.5, g)));
}

function solve(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = c + 1; r < n; r++) {
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r][n];
    for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k];
    x[r] = s / M[r][r];
  }
  return x;
}

/**
 * Blend posed photos into a width×width/2 equirectangular JPEG.
 * Panorama convention (shared with the viewer): u = 0.5 looks toward world -z.
 */
export function stitchPosed(frames, { width = 4096, quality = 90 } = {}) {
  const height = width / 2;
  const gains = estimateGains(frames);
  const out = Buffer.alloc(width * height * 4);
  const px = [0, 0, 0];
  for (let y = 0; y < height; y++) {
    const lat = (0.5 - (y + 0.5) / height) * Math.PI;
    const cl = Math.cos(lat), sl = Math.sin(lat);
    for (let x = 0; x < width; x++) {
      const lon = ((x + 0.5) / width - 0.5) * 2 * Math.PI;
      const dx = cl * Math.sin(lon), dy = sl, dz = -cl * Math.cos(lon);
      let r = 0, g = 0, b = 0, wsum = 0;
      for (let i = 0; i < frames.length; i++) {
        const f = frames[i];
        if (f.forward[0] * dx + f.forward[1] * dy + f.forward[2] * dz < f.cosCull) continue;
        const p = project(f, dx, dy, dz);
        if (!p) continue;
        const ex = Math.min(p[0], f.w - 1 - p[0]) / ((f.w - 1) / 2), ey = Math.min(p[1], f.h - 1 - p[1]) / ((f.h - 1) / 2);
        const w = Math.max((ex * ey) ** 8, 1e-3);
        bilinear(f, p[0], p[1], px);
        r += px[0] * gains[i] * w; g += px[1] * gains[i] * w; b += px[2] * gains[i] * w;
        wsum += w;
      }
      const o = (y * width + x) * 4;
      if (wsum > 0) {
        out[o] = Math.min(255, r / wsum); out[o + 1] = Math.min(255, g / wsum); out[o + 2] = Math.min(255, b / wsum);
      } else {
        out[o] = out[o + 1] = out[o + 2] = 128; // never seen (usually straight down, under the phone)
      }
      out[o + 3] = 255;
    }
  }
  return { jpeg: jpeg.encode({ data: out, width, height }, quality).data, width, height, gains };
}
