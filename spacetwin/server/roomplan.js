// Convert Apple RoomPlan output (a JSON-encoded CapturedRoom) into SpaceTwin
// rooms. RoomPlan works in ARKit world space: metres, y up, the same frame the
// native capture app reports scan positions in, so no conversion is needed.
//
// Two sources, best first:
//   - floors[].polygonCorners (iOS 17+): the floor outline RoomPlan measured
//   - walls[]: each wall is a rectangle centred on its transform, `dimensions.x`
//     wide along its local x axis; walls are chained end to end into a loop.
import { normalizePolygon, polygonArea } from '../shared/geometry.js';

const JOIN_TOLERANCE = 0.35; // m: wall ends further apart than this don't connect

/** simd_float4x4 is encoded either flat (16 numbers) or as 4 columns of 4. Column-major. */
export function readMatrix(m) {
  const flat = Array.isArray(m?.[0]) ? m.flat() : m;
  if (!Array.isArray(flat) || flat.length !== 16 || !flat.every(Number.isFinite)) throw new Error('transform must be a 4×4 matrix');
  return flat;
}

function readVec3(v) {
  if (!Array.isArray(v) || v.length < 3 || !v.slice(0, 3).every(Number.isFinite)) throw new Error('expected [x, y, z]');
  return v.slice(0, 3);
}

/** Apply a column-major 4×4 transform to a point. */
export function transformPoint(m, [x, y, z]) {
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
  ];
}

function categoryOf(surface) {
  const c = surface?.category;
  return typeof c === 'string' ? c : c && typeof c === 'object' ? Object.keys(c)[0] : undefined;
}

/** A wall as a floor-plan segment: its two ends projected onto the floor. */
function wallSegment(wall) {
  const m = readMatrix(wall.transform);
  const [w, h] = readVec3(wall.dimensions);
  const a = transformPoint(m, [-w / 2, 0, 0]);
  const b = transformPoint(m, [w / 2, 0, 0]);
  return { a: [a[0], a[2]], b: [b[0], b[2]], height: h, bottom: m[13] - h / 2 };
}

const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);

/** Where the infinite lines through two wall segments cross; null if (nearly) parallel. */
function lineIntersection(s, t) {
  const d1 = [s.b[0] - s.a[0], s.b[1] - s.a[1]], d2 = [t.b[0] - t.a[0], t.b[1] - t.a[1]];
  const den = d1[0] * d2[1] - d1[1] * d2[0];
  if (Math.abs(den) < 1e-6 * Math.hypot(...d1) * Math.hypot(...d2)) return null;
  const k = ((t.a[0] - s.a[0]) * d2[1] - (t.a[1] - s.a[1]) * d2[0]) / den;
  return [s.a[0] + d1[0] * k, s.a[1] + d1[1] * k];
}

/**
 * Chain wall segments end to end into closed loops. Corners are where
 * consecutive walls' lines meet, which is more accurate than either wall's
 * measured end.
 */
export function wallsToLoops(segments) {
  const unused = new Set(segments.map((_, i) => i));
  const loops = [];
  while (unused.size >= 3) {
    const first = unused.values().next().value;
    unused.delete(first);
    const chain = [{ ...segments[first] }];
    let closed = false;
    while (true) {
      const end = chain.at(-1).b;
      if (chain.length >= 3 && dist(end, chain[0].a) < JOIN_TOLERANCE) {
        closed = true;
        break;
      }
      let best = null;
      for (const i of unused) {
        const s = segments[i];
        // a wall can be walked either way; orient it to start where the chain ends
        for (const [from, to] of [[s.a, s.b], [s.b, s.a]]) {
          const d = dist(end, from);
          if (d < JOIN_TOLERANCE && (!best || d < best.d)) best = { i, d, seg: { ...s, a: from, b: to } };
        }
      }
      if (!best) break;
      unused.delete(best.i);
      chain.push(best.seg);
    }
    if (!closed) continue; // an open run of walls (e.g. a partial scan) can't bound a room
    const corners = chain.map((s, i) => {
      const prev = chain[(i + chain.length - 1) % chain.length];
      return lineIntersection(prev, s) ?? s.a;
    });
    loops.push({ points: corners, height: Math.max(...chain.map((s) => s.height)) });
  }
  return loops;
}

/**
 * @param captured  JSON-decoded CapturedRoom (or { rooms: [CapturedRoom] } from
 *                  a multi-room CapturedStructure)
 * @returns [{ name, height, points: [[x, z], ...] }]
 */
export function capturedRoomToRooms(captured, { name = 'Scanned room' } = {}) {
  if (!captured || typeof captured !== 'object') throw new Error('expected a CapturedRoom object');
  if (Array.isArray(captured.rooms)) {
    return captured.rooms.flatMap((r, i) => capturedRoomToRooms(r, { name: `${name} ${i + 1}` }));
  }
  const walls = (captured.walls ?? []).filter((w) => !categoryOf(w) || categoryOf(w) === 'wall');
  const wallHeight = walls.length ? Math.max(...walls.map((w) => readVec3(w.dimensions)[1])) : 2.5;

  const floors = (captured.floors ?? []).filter((f) => Array.isArray(f.polygonCorners) && f.polygonCorners.length >= 3);
  let rooms;
  if (floors.length) {
    rooms = floors.map((f) => {
      const m = readMatrix(f.transform);
      return { height: wallHeight, points: f.polygonCorners.map((c) => { const p = transformPoint(m, readVec3(c)); return [p[0], p[2]]; }) };
    });
  } else {
    rooms = wallsToLoops(walls.map(wallSegment));
  }
  if (!rooms.length) throw new Error('could not find a closed room outline in this scan (are all walls captured?)');
  return rooms
    .map((r) => ({ height: round(r.height), points: normalizePolygon(r.points.map(([x, z]) => [round(x), round(z)])) }))
    .filter((r) => r.points.length >= 3 && polygonArea(r.points) > 0.5)
    .map((r, i, all) => ({ name: all.length > 1 ? `${name} ${i + 1}` : name, ...r }));
}

function round(n) {
  return Math.round(n * 1000) / 1000;
}
