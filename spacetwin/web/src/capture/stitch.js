import * as THREE from 'three';
import { forwardOf, intrinsics, projectToFrame, rayFromFrame } from './geometry.js';

// Turns ~30 phone photos plus the gyroscope orientation of each into one
// equirectangular 360° panorama. The gyroscope alone is ~1–2° off, which is
// 10–20 px of seam at 4K, and the camera's exact field of view and exposure are
// unknown, so before blending we estimate all three from the overlaps:
//
//   1. field of view: try candidates, keep the one where overlaps agree best
//   2. rotations: nudge each photo until it lines up with its neighbours
//   3. exposure: per-photo gains so overlapping areas have equal brightness
//
// All three run on small grayscale thumbnails on the CPU; the final blend runs
// on the GPU at full resolution.

const THUMB_SMALL = 160; // coarse alignment: smooth error surface, few false minima
const THUMB_LARGE = 320; // fine alignment: sub-pixel detail at 4K output
const GRID = 36; // samples per side when comparing two overlapping photos
const DEG = Math.PI / 180;
// Cost of moving a photo away from its gyroscope reading, per degree², in the
// same units as pairError (squared grey levels). Neighbouring photos can agree
// with each other while the whole ring slowly twists, especially over plain
// walls; the gyroscope has no such drift, so it anchors the solution.
const GYRO_PRIOR = 25;

/**
 * @param frames [{ blob, q: THREE.Quaternion, width, height }]  q maps camera → world
 * @returns { blob, width, height, vfov, gains, quaternions, report }
 */
export async function stitchPanorama(frames, { width = 4096, onProgress = () => {}, initialVfov = 65 } = {}) {
  if (frames.length < 2) throw new Error('need at least two photos');
  const aspect = frames[0].width / frames[0].height;
  onProgress('Reading photos', 0.02);
  const small = [], large = [];
  for (const f of frames) {
    const bmp = await createImageBitmap(f.blob);
    small.push(makeThumb(bmp, aspect, THUMB_SMALL));
    large.push(makeThumb(bmp, aspect, THUMB_LARGE));
    bmp.close?.();
  }
  const qs = frames.map((f) => f.q.clone());
  const gyro = frames.map((f) => f.q.clone());

  onProgress('Calibrating lens', 0.12);
  let vfov = calibrateFov(small, qs, aspect, range(initialVfov - 15, initialVfov + 15, 1));
  const before = alignmentError(large, qs, intrinsics(vfov, aspect));

  onProgress('Aligning photos', 0.25);
  for (const step of [1.0, 0.5, 0.25, 0.12]) refineRotations(small, qs, intrinsics(vfov, aspect), step * DEG, gyro);
  vfov = calibrateFov(small, qs, aspect, range(vfov - 1.5, vfov + 1.5, 0.25));
  onProgress('Aligning photos', 0.35);
  for (const step of [0.12, 0.06, 0.03]) refineRotations(large, qs, intrinsics(vfov, aspect), step * DEG, gyro);
  const intr = intrinsics(vfov, aspect);
  const after = alignmentError(large, qs, intr);

  onProgress('Balancing exposure', 0.45);
  const gains = estimateGains(small, qs, intr);

  onProgress('Blending', 0.55);
  const blob = await renderEquirect(frames, qs, gains, intr, width, (p) => onProgress('Blending', 0.55 + p * 0.4));
  onProgress('Done', 1);
  return {
    blob, width, height: width / 2, vfov, gains, quaternions: qs,
    report: { alignmentErrorBefore: before, alignmentErrorAfter: after },
  };
}

function range(a, b, step) {
  const out = [];
  for (let v = a; v <= b + 1e-9; v += step) out.push(Math.round(v * 1000) / 1000);
  return out;
}

function makeThumb(bmp, aspect, w) {
  const h = Math.round(w / aspect);
  const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  const lum = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) lum[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  return { w, h, lum };
}

function sample(t, u, v) {
  const x = u * (t.w - 1), y = v * (t.h - 1);
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, t.w - 1), y1 = Math.min(y0 + 1, t.h - 1);
  const fx = x - x0, fy = y - y0;
  const a = t.lum[y0 * t.w + x0], b = t.lum[y0 * t.w + x1], c = t.lum[y1 * t.w + x0], d = t.lum[y1 * t.w + x1];
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
}

/** Pairs of photos whose view directions are close enough to overlap. */
function neighbours(qs, maxAngle) {
  const fwd = qs.map((q) => forwardOf(q));
  const pairs = [];
  for (let i = 0; i < qs.length; i++) {
    for (let j = i + 1; j < qs.length; j++) {
      if (fwd[i].angleTo(fwd[j]) < maxAngle) pairs.push([i, j]);
    }
  }
  return pairs;
}

const tmpRay = new THREE.Vector3(), tmpProj = new THREE.Vector3();

/** Luminance pairs where photo i's samples land inside photo j. */
function overlapSamples(ti, tj, qi, qjInv, intr) {
  const a = [], b = [];
  const m = 0.03; // stay off the very edges
  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      const u = m + ((gx + 0.5) / GRID) * (1 - 2 * m), v = m + ((gy + 0.5) / GRID) * (1 - 2 * m);
      const p = projectToFrame(rayFromFrame(u, v, qi, intr, tmpRay), qjInv, intr, tmpProj);
      if (!p || p.u < m || p.u > 1 - m || p.v < m || p.v > 1 - m) continue;
      a.push(sample(ti, u, v));
      b.push(sample(tj, p.u, p.v));
    }
  }
  return { a, b };
}

/**
 * Mismatch between two overlapping photos as mean squared grey-level
 * difference (lower is better), after removing each side's mean so exposure
 * differences don't read as misalignment. Plain, featureless overlaps score
 * near zero whatever the rotation, so textured overlaps drive the alignment.
 * Returns null if the photos barely overlap.
 */
function pairError(ti, tj, qi, qj, intr) {
  const { a, b } = overlapSamples(ti, tj, qi, qj.clone().invert(), intr);
  if (a.length < 25) return null;
  let ma = 0, mb = 0;
  for (let k = 0; k < a.length; k++) { ma += a[k]; mb += b[k]; }
  ma /= a.length; mb /= b.length;
  let e = 0;
  for (let k = 0; k < a.length; k++) e += ((a[k] - ma) - (b[k] - mb)) ** 2;
  return { error: e / a.length, n: a.length };
}

/** RMS grey-level disagreement across all overlaps (0–255 scale). */
export function alignmentError(thumbs, qs, intr) {
  let total = 0, n = 0;
  for (const [i, j] of neighbours(qs, 75 * DEG)) {
    const r = pairError(thumbs[i], thumbs[j], qs[i], qs[j], intr);
    if (r) { total += r.error * r.n; n += r.n; }
  }
  return n ? Math.sqrt(total / n) : Infinity;
}

/**
 * Pick the field of view under which overlapping photos agree best. Pairs
 * that stop overlapping under a candidate count as a bad match rather than
 * being skipped; otherwise a too-narrow lens would look good simply by
 * comparing less.
 */
function calibrateFov(thumbs, qs, aspect, candidates) {
  const pairs = neighbours(qs, 75 * DEG);
  const LOST_PAIR = { error: 40 * 40, n: GRID * GRID * 0.15 };
  const score = (vfov) => {
    const intr = intrinsics(vfov, aspect);
    let total = 0, n = 0;
    for (const [i, j] of pairs) {
      const r = pairError(thumbs[i], thumbs[j], qs[i], qs[j], intr) ?? LOST_PAIR;
      total += r.error * r.n;
      n += r.n;
    }
    return total / n;
  };
  let best = { vfov: candidates[Math.floor(candidates.length / 2)], error: Infinity };
  for (const vfov of candidates) {
    const e = score(vfov);
    if (e < best.error) best = { vfov, error: e };
  }
  return best.vfov;
}

/**
 * Coordinate descent on each photo's rotation (photo 0 stays put and anchors
 * the heading): try small turns about the camera's own axes and keep any that
 * reduce disagreement with overlapping neighbours, without straying far from
 * the gyroscope reading.
 */
function refineRotations(thumbs, qs, intr, step, gyro) {
  const pairs = neighbours(qs, 75 * DEG);
  const nbrs = qs.map(() => []);
  for (const [i, j] of pairs) { nbrs[i].push(j); nbrs[j].push(i); }
  const axes = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];
  const frameError = (i, q) => {
    let total = 0, n = 0;
    for (const j of nbrs[i]) {
      const r = pairError(thumbs[i], thumbs[j], q, qs[j], intr);
      if (r) { total += r.error * r.n; n += r.n; }
    }
    const drift = q.angleTo(gyro[i]) / DEG;
    return (n ? total / n : 0) + GYRO_PRIOR * drift * drift;
  };
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 1; i < qs.length; i++) {
      let current = frameError(i, qs[i]);
      for (const axis of axes) {
        for (const sign of [1, -1]) {
          let improved = true;
          while (improved) {
            improved = false;
            const trial = qs[i].clone().multiply(new THREE.Quaternion().setFromAxisAngle(axis, sign * step));
            const e = frameError(i, trial);
            if (e < current - 1e-6) {
              qs[i].copy(trial);
              current = e;
              improved = true;
            }
          }
        }
      }
    }
  }
}

/**
 * Gain compensation (Brown & Lowe): choose per-photo gains g so that
 * g_i·mean_i ≈ g_j·mean_j over every overlap, with a weak pull toward 1.
 */
function estimateGains(thumbs, qs, intr) {
  const n = qs.length;
  const A = Array.from({ length: n }, () => new Float64Array(n));
  const rhs = new Float64Array(n);
  const sigmaN = 10, sigmaG = 0.1;
  for (const [i, j] of neighbours(qs, 75 * DEG)) {
    const { a, b } = overlapSamples(thumbs[i], thumbs[j], qs[i], qs[j].clone().invert(), intr);
    if (a.length < 25) continue;
    const Ii = a.reduce((s, x) => s + x, 0) / a.length, Ij = b.reduce((s, x) => s + x, 0) / b.length;
    const N = a.length / (GRID * GRID);
    // d/dg_i and d/dg_j of N (g_i Ii - g_j Ij)^2 / sigmaN^2
    A[i][i] += (N * Ii * Ii) / sigmaN ** 2; A[i][j] -= (N * Ii * Ij) / sigmaN ** 2;
    A[j][j] += (N * Ij * Ij) / sigmaN ** 2; A[j][i] -= (N * Ii * Ij) / sigmaN ** 2;
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

// ------------------------------------------------------------------ GPU blend

const accumulateShader = {
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D photo;
    uniform mat3 worldToCam;
    uniform vec2 tanHalf;
    uniform float gain;
    varying vec2 vUv;
    const float PI = 3.141592653589793;
    void main() {
      float lon = (vUv.x - 0.5) * 2.0 * PI;
      float lat = (vUv.y - 0.5) * PI;
      vec3 d = vec3(cos(lat) * sin(lon), sin(lat), -cos(lat) * cos(lon));
      vec3 c = worldToCam * d;
      if (c.z >= -1e-4) discard;
      vec2 p = c.xy / -c.z;
      vec2 uv = vec2(0.5 + p.x / (2.0 * tanHalf.x), 0.5 + p.y / (2.0 * tanHalf.y));
      if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) discard;
      // Each pixel is dominated by the photo it sits most centrally in, with a
      // narrow cross-fade where two photos are about equally central. A wide
      // fade would show any residual misalignment as a double image.
      vec2 e = min(uv, 1.0 - uv) * 2.0;
      // floor keeps weights representable in the half-float accumulator (min normal ~6e-5)
      float w = max(pow(e.x * e.y, 8.0), 1e-3);
      vec3 rgb = texture2D(photo, vec2(uv.x, 1.0 - uv.y)).rgb * gain;
      gl_FragColor = vec4(rgb * w, w);
    }
  `,
};

const normalizeShader = {
  vertexShader: accumulateShader.vertexShader,
  fragmentShader: /* glsl */ `
    uniform sampler2D accum;
    varying vec2 vUv;
    void main() {
      vec4 a = texture2D(accum, vUv);
      gl_FragColor = a.a > 0.0 ? vec4(a.rgb / a.a, 1.0) : vec4(0.5, 0.5, 0.5, 1.0);
    }
  `,
};

async function renderEquirect(frames, qs, gains, intr, width, onProgress) {
  const height = width / 2;
  const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: false });
  renderer.setPixelRatio(1);
  renderer.setSize(16, 16, false);
  renderer.autoClear = false; // photos accumulate; we clear once below
  const maxSize = renderer.capabilities.maxTextureSize;
  if (width > maxSize) {
    renderer.dispose();
    return renderEquirect(frames, qs, gains, intr, maxSize, onProgress);
  }
  const accum = new THREE.WebGLRenderTarget(width, height, { type: THREE.HalfFloatType, depthBuffer: false });
  const output = new THREE.WebGLRenderTarget(width, height, { type: THREE.UnsignedByteType, depthBuffer: false });
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  quad.frustumCulled = false;
  scene.add(quad);

  const accMat = new THREE.ShaderMaterial({
    ...accumulateShader,
    uniforms: { photo: { value: null }, worldToCam: { value: new THREE.Matrix3() }, tanHalf: { value: new THREE.Vector2(intr.tx, intr.ty) }, gain: { value: 1 } },
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.OneFactor,
    depthTest: false,
    depthWrite: false,
  });
  quad.material = accMat;
  renderer.setRenderTarget(accum);
  renderer.setClearColor(0x000000, 0);
  renderer.clear();

  for (let i = 0; i < frames.length; i++) {
    const bmp = await createImageBitmap(frames[i].blob);
    const tex = new THREE.Texture(bmp);
    tex.flipY = false;
    tex.colorSpace = THREE.NoColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    accMat.uniforms.photo.value = tex;
    accMat.uniforms.worldToCam.value.setFromMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(qs[i].clone().invert()));
    accMat.uniforms.gain.value = gains[i];
    // the shader samples with v flipped, so photos are uploaded top-row-first (flipY = false)
    renderer.render(scene, camera);
    tex.dispose();
    bmp.close?.();
    onProgress((i + 1) / frames.length);
    await new Promise((r) => setTimeout(r, 0)); // let the progress UI paint
  }

  quad.material = new THREE.ShaderMaterial({ ...normalizeShader, uniforms: { accum: { value: accum.texture } }, depthTest: false, depthWrite: false });
  renderer.setRenderTarget(output);
  renderer.render(scene, camera);
  const pixels = new Uint8Array(width * height * 4);
  renderer.readRenderTargetPixels(output, 0, 0, width, height, pixels);
  renderer.setRenderTarget(null);
  accum.dispose();
  output.dispose();
  renderer.dispose();

  // WebGL rows run bottom-up; images run top-down.
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(width, height);
  const row = width * 4;
  for (let y = 0; y < height; y++) img.data.set(pixels.subarray((height - 1 - y) * row, (height - y) * row), y * row);
  ctx.putImageData(img, 0, 0);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('could not encode panorama'))), 'image/jpeg', 0.9));
}
