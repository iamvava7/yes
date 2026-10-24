// Automatic room outline from one 360° panorama, so the floor plan and the
// dollhouse appear without tracing corners by hand.
//
// The idea is the one learned layout methods use (HorizonNet: one boundary
// value per image column): find, in every column of the panorama, where the
// walls meet the ceiling, and where they meet the floor. Here the boundaries
// come from image edges and a smoothest-path search instead of a network:
//
//   1. strong horizontal edges in the ceiling band and the floor band,
//   2. one smooth path per band around the whole panorama (dynamic programming),
//   3. ceiling boundary → points on the ceiling plane; floor boundary at the
//      known camera height → the scale (ceiling is rarely hidden by furniture,
//      the floor gives metres),
//   4. walls at right angles ("Manhattan" rooms, true for almost every flat):
//      find the dominant wall direction, split the outline into straight runs,
//      and intersect neighbouring walls into corners.
//
// Directions follow the viewer: column u looks at azimuth θ = (u − 0.5)·2π,
// with d = (sin θ cos φ, sin φ, −cos θ cos φ); row 0 is straight up.

const DEG = Math.PI / 180;

/** Box-filter an RGBA image down to a grey W×H image (W×H must divide evenly or close). */
export function toGrey(rgba, srcW, srcH, W = 1024) {
  const H = W / 2;
  const out = new Float32Array(W * H);
  const sx = srcW / W, sy = srcH / H;
  for (let y = 0; y < H; y++) {
    const y0 = Math.floor(y * sy), y1 = Math.max(y0 + 1, Math.floor((y + 1) * sy));
    for (let x = 0; x < W; x++) {
      const x0 = Math.floor(x * sx), x1 = Math.max(x0 + 1, Math.floor((x + 1) * sx));
      let s = 0, n = 0;
      for (let yy = y0; yy < y1; yy += 2) {
        for (let xx = x0; xx < x1; xx += 2) {
          const i = (yy * srcW + xx) * 4;
          s += 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2];
          n++;
        }
      }
      out[y * W + x] = s / n;
    }
  }
  return { grey: out, W, H };
}

const rowOf = (phi, H) => (0.5 - phi / Math.PI) * H; // elevation → row
const phiOf = (row, H) => (0.5 - (row + 0.5) / H) * Math.PI;

/** Edge strength for a horizontal boundary at each pixel, averaged over 3 columns. */
function edges(grey, W, H) {
  const g = new Float32Array(W * H);
  for (let y = 3; y < H - 3; y++) {
    for (let x = 0; x < W; x++) {
      let s = 0;
      for (let dx = -1; dx <= 1; dx++) {
        const xx = (x + dx + W) % W;
        const above = grey[(y - 1) * W + xx] + grey[(y - 2) * W + xx] + grey[(y - 3) * W + xx];
        const below = grey[(y + 1) * W + xx] + grey[(y + 2) * W + xx] + grey[(y + 3) * W + xx];
        s += Math.abs(above - below) / 3;
      }
      g[y * W + x] = s / 3;
    }
  }
  return g;
}

/**
 * The smoothest strong-edge path around the panorama between rows r0..r1:
 * maximises edge strength minus a cost for every row it moves between
 * neighbouring columns. Run over the image twice so the path closes on itself.
 */
function boundaryPath(g, W, H, r0, r1, { jump = 4, smooth = 1.2, preferTop = 0 } = {}) {
  r0 = Math.max(3, Math.round(r0));
  r1 = Math.min(H - 4, Math.round(r1));
  const R = r1 - r0 + 1;
  const cols = 2 * W;
  let prev = new Float32Array(R);
  const back = new Int16Array(cols * R);
  for (let c = 0; c < cols; c++) {
    const x = c % W;
    const cur = new Float32Array(R);
    for (let r = 0; r < R; r++) {
      let best = -Infinity, arg = r;
      for (let k = -jump; k <= jump; k++) {
        const p = r + k;
        if (p < 0 || p >= R) continue;
        const v = prev[p] - smooth * Math.abs(k);
        if (v > best) { best = v; arg = p; }
      }
      // preferTop: the ceiling line is the highest long edge; door and window
      // tops sit below it, so lower edges count for less
      cur[r] = (c ? best : 0) + g[(r0 + r) * W + x] * (1 - preferTop * r / R);
      back[c * R + r] = arg;
    }
    prev = cur;
  }
  let r = 0;
  for (let i = 1; i < R; i++) if (prev[i] > prev[r]) r = i;
  const rows = new Float32Array(W);
  const strength = new Float32Array(W);
  for (let c = cols - 1; c >= 0; c--) {
    if (c < W) { rows[c] = r0 + r; strength[c] = g[(r0 + r) * W + c]; }
    r = back[c * R + r];
  }
  return { rows, strength };
}

function quantile(arr, q) {
  const a = [...arr].filter(Number.isFinite).sort((x, y) => x - y);
  if (!a.length) return NaN;
  return a[Math.min(a.length - 1, Math.max(0, Math.round(q * (a.length - 1))))];
}

const median = (arr) => quantile(arr, 0.5);

/** Area of a polygon [[x, z], ...] (positive either winding). */
export function polygonArea(pts) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, z1] = pts[i], [x2, z2] = pts[(i + 1) % pts.length];
    s += x1 * z2 - x2 * z1;
  }
  return Math.abs(s) / 2;
}

function containsPoint(pts, x, z) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, zi] = pts[i], [xj, zj] = pts[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

function selfIntersects(pts) {
  const n = pts.length;
  const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      const a = pts[i], b = pts[(i + 1) % n], c = pts[j], d = pts[(j + 1) % n];
      if (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0) return true;
    }
  }
  return false;
}

/** Dominant wall direction (radians, 0..π/2) from the outline's local directions. */
function wallDirection(P) {
  const bins = new Float32Array(90);
  const n = P.length;
  for (let i = 0; i < n; i++) {
    const a = P[(i + n - 3) % n], b = P[(i + 3) % n];
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const len = Math.hypot(dx, dz);
    if (!len || len > 1.5) continue; // jumps across corners say nothing
    let ang = Math.atan2(dz, dx) % (Math.PI / 2);
    if (ang < 0) ang += Math.PI / 2;
    bins[Math.floor(ang / (Math.PI / 2) * 90) % 90] += len;
  }
  let best = 0, bestV = -1;
  for (let i = 0; i < 90; i++) {
    let v = 0;
    for (let k = -3; k <= 3; k++) v += bins[(i + k + 90) % 90] * (4 - Math.abs(k));
    if (v > bestV) { bestV = v; best = i; }
  }
  return (best + 0.5) * DEG;
}

/**
 * Right-angled outline through the points (already rotated so walls run
 * along x and z). Returns corners or null.
 */
function manhattanOutline(Q, { minRun = 6, trust } = {}) {
  const n = Q.length;
  const cls = new Array(n);
  for (let i = 0; i < n; i++) {
    if (trust && !trust[i]) { cls[i] = null; continue; }
    const a = Q[(i + n - 2) % n], b = Q[(i + 2) % n];
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const len = Math.hypot(dx, dz);
    if (!len || len > 1.2) { cls[i] = null; continue; }
    const s = Math.abs(dz) / len;
    cls[i] = s < 0.35 ? 'H' : s > 0.94 ? 'V' : null; // within ~20° of an axis
  }
  // Start right after a change so no run is split by the wrap-around.
  let start = 0;
  for (let i = 0; i < n; i++) if (cls[i] && cls[(i + n - 1) % n] !== cls[i]) { start = i; break; }
  let runs = [];
  for (let k = 0; k < n; k++) {
    const i = (start + k) % n;
    if (!cls[i]) continue;
    const last = runs.at(-1);
    if (last && last.cls === cls[i] && last.end === k - 1) {
      last.vals.push(cls[i] === 'H' ? Q[i][1] : Q[i][0]);
      last.end = k;
    } else {
      runs.push({ cls: cls[i], vals: [cls[i] === 'H' ? Q[i][1] : Q[i][0]], end: k, first: i });
    }
  }
  runs = runs.filter((r) => r.vals.length >= minRun).map((r) => ({ cls: r.cls, at: median(r.vals), w: r.vals.length, first: r.first }));
  // Neighbouring runs of the same kind: the same wall (merge) or a step whose
  // short perpendicular wall was too small to see (insert it).
  for (let pass = 0; pass < 3 && runs.length > 1; pass++) {
    const out = [];
    for (const r of runs) {
      const last = out.at(-1);
      if (last && last.cls === r.cls) {
        if (Math.abs(last.at - r.at) < 0.3) {
          last.at = (last.at * last.w + r.at * r.w) / (last.w + r.w);
          last.w += r.w;
          continue;
        }
        const p = Q[r.first];
        out.push({ cls: r.cls === 'H' ? 'V' : 'H', at: r.cls === 'H' ? p[0] : p[1], w: 1 });
      }
      out.push({ ...r });
    }
    if (out.length > 1 && out[0].cls === out.at(-1).cls && Math.abs(out[0].at - out.at(-1).at) < 0.3) {
      const a = out.pop();
      out[0].at = (out[0].at * out[0].w + a.at * a.w) / (out[0].w + a.w);
      out[0].w += a.w;
    }
    runs = out;
  }
  if (runs.length < 4 || runs.length % 2) return null;
  for (let i = 0; i < runs.length; i++) if (runs[i].cls === runs[(i + 1) % runs.length].cls) return null;
  const corners = [];
  for (let i = 0; i < runs.length; i++) {
    const a = runs[i], b = runs[(i + 1) % runs.length];
    corners.push(a.cls === 'H' ? [b.at, a.at] : [a.at, b.at]);
  }
  return corners;
}

/** Fallback: the rectangle of the walls seen in front, behind, left and right. */
function boxOutline(Q, trust) {
  const side = { L: [], R: [], F: [], B: [] };
  for (const [i, [x, z]] of Q.entries()) {
    if (trust && !trust[i]) continue;
    if (Math.abs(x) > Math.abs(z)) (x > 0 ? side.R : side.L).push(x);
    else (z > 0 ? side.B : side.F).push(z);
  }
  if (Object.values(side).some((s) => s.length < 5)) return null;
  const [l, r, f, b] = [median(side.L), median(side.R), median(side.F), median(side.B)];
  return [[l, f], [r, f], [r, b], [l, b]];
}

/**
 * Estimate the room around the camera of one panorama.
 * @param grey   grey image (Float32Array, W×H, equirectangular, row 0 = up)
 * @param opts.cameraHeight  metres from the floor to the lens
 * @returns { points: [[x, z], ...] in the panorama's frame (metres, camera at 0,0),
 *            height, confidence (0..1), shape: 'manhattan' | 'box' } or null
 */
export function estimateLayout(grey, W, H, { cameraHeight = 1.5 } = {}) {
  const g = edges(grey, W, H);
  const ceil = boundaryPath(g, W, H, rowOf(80 * DEG, H), rowOf(6 * DEG, H), { preferTop: 0.6 });
  const floor = boundaryPath(g, W, H, rowOf(-6 * DEG, H), rowOf(-80 * DEG, H));

  const theta = (c) => ((c + 0.5) / W - 0.5) * 2 * Math.PI;
  // distance to the wall in each column: from the ceiling with a unit ceiling
  // height above the lens, and from the floor in metres
  const dCeil = new Float64Array(W), dFloor = new Float64Array(W);
  for (let c = 0; c < W; c++) {
    dCeil[c] = 1 / Math.tan(Math.max(2 * DEG, phiOf(ceil.rows[c], H)));
    dFloor[c] = cameraHeight / Math.tan(Math.max(2 * DEG, -phiOf(floor.rows[c], H)));
  }
  // Scale: furniture hides the floor line (it then looks closer), never farther,
  // so trust the upper part of the floor/ceiling ratios.
  const ratios = [];
  for (let c = 0; c < W; c++) if (floor.strength[c] > 4 && ceil.strength[c] > 4) ratios.push(dFloor[c] / dCeil[c]);
  let above = quantile(ratios.length > W / 8 ? ratios : Array.from(dFloor, (d, c) => d / dCeil[c]), 0.55);
  if (!Number.isFinite(above)) above = 1.1;
  const height = Math.min(4.5, Math.max(2.1, cameraHeight + above));
  above = height - cameraHeight;

  const P = [];
  for (let c = 0; c < W; c++) {
    const d = Math.min(25, dCeil[c] * above);
    P.push([Math.sin(theta(c)) * d, -Math.cos(theta(c)) * d]);
  }
  // A door or window top mistaken for the ceiling line puts the wall much
  // farther than the floor line does there; leave those columns out.
  const trust = Array.from(dCeil, (d, c) => !(floor.strength[c] > 4 && d * above > 1.6 * dFloor[c]));
  const alpha = wallDirection(P.filter((_, c) => trust[c]));
  const ca = Math.cos(-alpha), sa = Math.sin(-alpha);
  const Q = P.map(([x, z]) => [x * ca - z * sa, x * sa + z * ca]);

  let shape = 'manhattan';
  let corners = manhattanOutline(Q, { minRun: Math.max(4, Math.round(W / 170)), trust });
  const ok = (pts) => pts && pts.length >= 4 && pts.length <= 16 && !selfIntersects(pts) && containsPoint(pts, 0, 0)
    && polygonArea(pts) > 1.5 && polygonArea(pts) < 250;
  if (!ok(corners)) {
    shape = 'box';
    corners = boxOutline(Q, trust);
    if (!ok(corners)) return null;
  }
  const cb = Math.cos(alpha), sb = Math.sin(alpha);
  const points = corners.map(([x, z]) => [x * cb - z * sb, x * sb + z * cb]);

  // How well the walls explain what was seen: share of columns within 15 cm
  // (scaled with distance) of the outline, times edge clarity.
  let near = 0;
  for (const [x, z] of Q) {
    let best = Infinity;
    for (let i = 0; i < corners.length; i++) {
      const [x1, z1] = corners[i], [x2, z2] = corners[(i + 1) % corners.length];
      best = Math.min(best, distToSegment(x, z, x1, z1, x2, z2));
    }
    if (best < 0.08 + 0.04 * Math.hypot(x, z)) near++;
  }
  const clarity = Math.min(1, median(ceil.strength) / 12);
  const confidence = Math.round((near / W) * (0.5 + 0.5 * clarity) * 100) / 100;
  return { points, height: Math.round(height * 100) / 100, confidence, shape };
}

function distToSegment(px, pz, x1, z1, x2, z2) {
  const dx = x2 - x1, dz = z2 - z1;
  const L = dx * dx + dz * dz;
  const t = L ? Math.max(0, Math.min(1, ((px - x1) * dx + (pz - z1) * dz) / L)) : 0;
  return Math.hypot(px - (x1 + t * dx), pz - (z1 + t * dz));
}

/**
 * The detected room placed in the space: the panorama frame turned by the
 * scan's heading and moved to its position. Points rounded to centimetres.
 */
export function placeRoom(layout, scan) {
  const h = (scan.heading ?? 0) * DEG;
  const c = Math.cos(h), s = Math.sin(h);
  return layout.points.map(([x, z]) => [
    Math.round((scan.position.x + c * x + s * z) * 100) / 100,
    Math.round((scan.position.z - s * x + c * z) * 100) / 100,
  ]);
}
