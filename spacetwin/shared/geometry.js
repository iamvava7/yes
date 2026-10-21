// Floor-plan geometry shared by the server (stats, exports) and the browser (meshes).
// Coordinates: metres, y up, rooms are polygons in the xz plane given as [x, z] pairs.
// Rooms are normalised to positive shoelace area; with that winding the wall
// quads built below face into the room, so back-face culling hides the near
// walls in the dollhouse view.

export function signedArea(points) {
  let a = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, z1] = points[i];
    const [x2, z2] = points[(i + 1) % points.length];
    a += x1 * z2 - x2 * z1;
  }
  return a / 2;
}

export function polygonArea(points) {
  return Math.abs(signedArea(points));
}

export function perimeter(points) {
  let p = 0;
  for (let i = 0; i < points.length; i++) p += distance2(points[i], points[(i + 1) % points.length]);
  return p;
}

export function distance2([x1, z1], [x2, z2]) {
  return Math.hypot(x2 - x1, z2 - z1);
}

export function centroid(points) {
  const a = signedArea(points);
  if (Math.abs(a) < 1e-9) {
    const n = points.length;
    return [points.reduce((s, p) => s + p[0], 0) / n, points.reduce((s, p) => s + p[1], 0) / n];
  }
  let cx = 0, cz = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, z1] = points[i];
    const [x2, z2] = points[(i + 1) % points.length];
    const f = x1 * z2 - x2 * z1;
    cx += (x1 + x2) * f;
    cz += (z1 + z2) * f;
  }
  return [cx / (6 * a), cz / (6 * a)];
}

/** Drop repeated/collinear vertices and orient the polygon with positive area. */
export function normalizePolygon(points, eps = 1e-6) {
  let pts = points.filter((p, i) => distance2(p, points[(i + 1) % points.length]) > eps);
  let changed = true;
  while (changed && pts.length > 3) {
    changed = false;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[(i + pts.length - 1) % pts.length], b = pts[i], c = pts[(i + 1) % pts.length];
      if (Math.abs(cross(a, b, c)) < eps) {
        pts.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  if (signedArea(pts) < 0) pts = pts.slice().reverse();
  return pts;
}

function cross(a, b, c) {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function segmentsIntersect(p1, p2, p3, p4) {
  const d1 = cross(p3, p4, p1), d2 = cross(p3, p4, p2);
  const d3 = cross(p1, p2, p3), d4 = cross(p1, p2, p4);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

/** True when no two non-adjacent edges cross. */
export function isSimplePolygon(points) {
  const n = points.length;
  if (n < 3) return false;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (j === i + 1 || (i === 0 && j === n - 1)) continue;
      if (segmentsIntersect(points[i], points[(i + 1) % n], points[j], points[(j + 1) % n])) return false;
    }
  }
  return true;
}

export function pointInPolygon([x, z], points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, zi] = points[i], [xj, zj] = points[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

/** Ear-clipping triangulation of a positive-area simple polygon. Returns index triples. */
export function triangulate(points) {
  const idx = points.map((_, i) => i);
  const tris = [];
  let guard = 0;
  while (idx.length > 3 && guard++ < 10000) {
    let clipped = false;
    for (let i = 0; i < idx.length; i++) {
      const ia = idx[(i + idx.length - 1) % idx.length], ib = idx[i], ic = idx[(i + 1) % idx.length];
      const a = points[ia], b = points[ib], c = points[ic];
      if (cross(a, b, c) <= 1e-12) continue; // reflex vertex
      const contains = idx.some((k) => k !== ia && k !== ib && k !== ic && inTriangle(points[k], a, b, c));
      if (contains) continue;
      tris.push([ia, ib, ic]);
      idx.splice(i, 1);
      clipped = true;
      break;
    }
    if (!clipped) break; // degenerate input; return what we have
  }
  if (idx.length === 3) tris.push([idx[0], idx[1], idx[2]]);
  return tris;
}

function inTriangle(p, a, b, c) {
  return cross(a, b, p) >= 0 && cross(b, c, p) >= 0 && cross(c, a, p) >= 0;
}

/**
 * Build the triangle mesh of one room: floor (facing up), walls (facing in) and
 * ceiling (facing down). Returns flat position array plus per-vertex surface ids
 * (0 floor, 1 wall, 2 ceiling) so renderers can treat ceilings differently.
 */
export function roomMesh(room) {
  const pts = normalizePolygon(room.points);
  const h = room.height;
  const positions = [];
  const surfaces = [];
  const push = (surface, ...verts) => {
    for (const v of verts) positions.push(...v);
    for (let i = 0; i < verts.length; i++) surfaces.push(surface);
  };
  for (const [a, b, c] of triangulate(pts)) {
    const A = pts[a], B = pts[b], C = pts[c];
    push(0, [A[0], 0, A[1]], [C[0], 0, C[1]], [B[0], 0, B[1]]);
    push(2, [A[0], h, A[1]], [B[0], h, B[1]], [C[0], h, C[1]]);
  }
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    const a = [p[0], 0, p[1]], b = [q[0], 0, q[1]], c = [q[0], h, q[1]], d = [p[0], h, p[1]];
    push(1, a, b, c, a, c, d);
  }
  return { positions, surfaces };
}

/** Pick the scan that best "sees" a room: one standing inside it, else the nearest. */
export function bestScanForRoom(room, scans) {
  if (!scans.length) return null;
  const inside = scans.filter((s) => pointInPolygon([s.position.x, s.position.z], room.points));
  const c = centroid(room.points);
  const pool = inside.length ? inside : scans;
  return pool.reduce((best, s) =>
    distance2([s.position.x, s.position.z], c) < distance2([best.position.x, best.position.z], c) ? s : best);
}

export function bounds(points) {
  const xs = points.map((p) => p[0]), zs = points.map((p) => p[1]);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) };
}

export function spaceStats(space) {
  const rooms = space.rooms.map((r) => ({
    id: r.id,
    name: r.name,
    area: polygonArea(r.points),
    perimeter: perimeter(r.points),
    height: r.height,
    volume: polygonArea(r.points) * r.height,
  }));
  return {
    scanCount: space.scans.length,
    roomCount: rooms.length,
    totalArea: rooms.reduce((s, r) => s + r.area, 0),
    rooms,
  };
}
