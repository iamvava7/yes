// Deliverables generated from a space: Wavefront OBJ, floor-plan SVG.
import { bounds, centroid, distance2, normalizePolygon, polygonArea, roomMesh } from '../shared/geometry.js';

export function toObj(space) {
  const lines = [`# ${space.name} — exported by SpaceTwin`, '# units: metres, y up'];
  let base = 1;
  for (const room of space.rooms) {
    const { positions } = roomMesh(room);
    lines.push(`o ${sanitize(room.name)}`);
    for (let i = 0; i < positions.length; i += 3) {
      lines.push(`v ${fmt(positions[i])} ${fmt(positions[i + 1])} ${fmt(positions[i + 2])}`);
    }
    const count = positions.length / 3;
    for (let i = 0; i < count; i += 3) lines.push(`f ${base + i} ${base + i + 1} ${base + i + 2}`);
    base += count;
  }
  return lines.join('\n') + '\n';
}

export function toFloorPlanSvg(space) {
  const scale = 80; // px per metre
  const pad = 60;
  const all = space.rooms.flatMap((r) => r.points);
  if (!all.length) {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="120"><text x="20" y="60" font-family="sans-serif">No rooms traced yet</text></svg>';
  }
  const b = bounds(all);
  const w = (b.maxX - b.minX) * scale + pad * 2;
  const h = (b.maxZ - b.minZ) * scale + pad * 2;
  const X = (x) => (x - b.minX) * scale + pad;
  const Y = (z) => (z - b.minZ) * scale + pad;
  const out = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w.toFixed(0)}" height="${h.toFixed(0)}" viewBox="0 0 ${w.toFixed(0)} ${h.toFixed(0)}" font-family="Helvetica, Arial, sans-serif">`,
    `<rect width="100%" height="100%" fill="#ffffff"/>`,
  ];
  for (const room of space.rooms) {
    const pts = normalizePolygon(room.points);
    out.push(`<polygon points="${pts.map(([x, z]) => `${X(x).toFixed(1)},${Y(z).toFixed(1)}`).join(' ')}" fill="#f3f1ec" stroke="#222" stroke-width="5" stroke-linejoin="miter"/>`);
  }
  for (const room of space.rooms) {
    const pts = normalizePolygon(room.points);
    const [cx, cz] = centroid(pts);
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length];
      const len = distance2(p, q);
      if (len < 0.5) continue;
      // label sits just inside the wall (walls are wound so the interior is on the left)
      const mx = (p[0] + q[0]) / 2, mz = (p[1] + q[1]) / 2;
      const nx = -(q[1] - p[1]) / len, nz = (q[0] - p[0]) / len;
      out.push(`<text x="${X(mx + nx * 0.25).toFixed(1)}" y="${Y(mz + nz * 0.25).toFixed(1)}" font-size="13" fill="#666" text-anchor="middle" dominant-baseline="middle">${formatLength(len)}</text>`);
    }
    out.push(`<text x="${X(cx).toFixed(1)}" y="${(Y(cz) - 8).toFixed(1)}" font-size="16" font-weight="600" fill="#222" text-anchor="middle">${escapeXml(room.name)}</text>`);
    out.push(`<text x="${X(cx).toFixed(1)}" y="${(Y(cz) + 12).toFixed(1)}" font-size="13" fill="#555" text-anchor="middle">${polygonArea(pts).toFixed(1)} m²</text>`);
  }
  out.push('</svg>');
  return out.join('\n');
}

export function formatLength(m) {
  return `${m.toFixed(2)} m`;
}

function fmt(n) {
  return Number(n.toFixed(4)).toString();
}

function sanitize(s) {
  return s.replace(/[^\w-]+/g, '_') || 'room';
}

function escapeXml(s) {
  return s.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]);
}
