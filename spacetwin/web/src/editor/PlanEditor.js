import { centroid, distance2, normalizePolygon, pointInPolygon, polygonArea } from '../../../shared/geometry.js';

const DEG = Math.PI / 180;
const SCAN_R = 11; // px
const HANDLE_D = 34; // px from scan centre to the heading handle
const SNAP_PX = 12;
const GRID = 0.05; // m

/**
 * Top-down 2D editor for a space's layout. It edits a local copy of the rooms
 * and reports changes through callbacks: `preview` while a drag is in progress
 * (for live 3D feedback) and `commit` when the user lets go.
 */
export class PlanEditor {
  constructor(canvas, callbacks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cb = callbacks;
    this.space = null;
    this.rooms = [];
    this.tool = 'select';
    this.selection = null; // { type: 'scan' | 'room', id }
    this.draft = null; // points of a room being drawn
    this.hover = null;
    this.scale = 50; // px per metre
    this.offset = { x: 0, y: 0 }; // screen position of world origin
    this.drag = null;
    this.bind();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement);
  }

  dispose() {
    this.resizeObserver.disconnect();
    window.removeEventListener('keydown', this.onKey);
  }

  setSpace(space, { fit = false } = {}) {
    const firstLoad = !this.space;
    this.space = space;
    if (!this.drag) this.rooms = structuredClone(space.rooms);
    if (this.selection?.type === 'scan' && !space.scans.some((s) => s.id === this.selection.id)) this.select(null);
    if (this.selection?.type === 'room' && !this.rooms.some((r) => r.id === this.selection.id)) this.select(null);
    if (firstLoad || fit) this.fit();
    this.draw();
  }

  setTool(tool) {
    this.tool = tool;
    this.draft = tool === 'draw' ? [] : null;
    this.canvas.dataset.tool = tool;
    this.draw();
  }

  select(sel) {
    this.selection = sel;
    this.cb.onSelect?.(sel);
    this.draw();
  }

  // ------------------------------------------------------------ coordinates

  resize() {
    const p = this.canvas.parentElement;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = p.clientWidth * dpr;
    this.canvas.height = p.clientHeight * dpr;
    this.canvas.style.width = `${p.clientWidth}px`;
    this.canvas.style.height = `${p.clientHeight}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!this.userMoved) this.fit(); // keep it framed until the user pans or zooms
    this.draw();
  }

  fit() {
    this.userMoved = false;
    const w = this.canvas.parentElement.clientWidth, h = this.canvas.parentElement.clientHeight;
    if (!w || !h || !this.space) return;
    const pts = [...this.rooms.flatMap((r) => r.points), ...this.space.scans.map((s) => [s.position.x, s.position.z])];
    if (!pts.length) pts.push([-3, -3], [3, 3]);
    const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
    const minX = Math.min(...xs) - 1, maxX = Math.max(...xs) + 1, minZ = Math.min(...zs) - 1, maxZ = Math.max(...zs) + 1;
    this.scale = Math.min(w / (maxX - minX), h / (maxZ - minZ), 140);
    this.offset = { x: w / 2 - ((minX + maxX) / 2) * this.scale, y: h / 2 - ((minZ + maxZ) / 2) * this.scale };
  }

  toScreen([x, z]) {
    return [x * this.scale + this.offset.x, z * this.scale + this.offset.y];
  }

  toWorld(sx, sy) {
    return [(sx - this.offset.x) / this.scale, (sy - this.offset.y) / this.scale];
  }

  eventPos(e) {
    const r = this.canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  /** Snap to nearby existing corners (so rooms share walls), else to a 5 cm grid. */
  snap([x, z], { exclude, free } = {}) {
    if (free) return [x, z];
    let best = null;
    const candidates = [...this.rooms.flatMap((r) => r.points.filter((p) => p !== exclude)), ...(this.draft ?? [])];
    for (const p of candidates) {
      const d = distance2(p, [x, z]) * this.scale;
      if (d < SNAP_PX && (!best || d < best.d)) best = { p, d };
    }
    if (best) return [...best.p];
    return [Math.round(x / GRID) * GRID, Math.round(z / GRID) * GRID].map((v) => Math.round(v * 1000) / 1000);
  }

  // ------------------------------------------------------------ hit testing

  hitTest(sx, sy) {
    const scans = this.space?.scans ?? [];
    for (const s of scans) {
      const [cx, cy] = this.toScreen([s.position.x, s.position.z]);
      const th = (s.heading ?? 0) * DEG;
      const hx = cx - Math.sin(th) * HANDLE_D, hy = cy - Math.cos(th) * HANDLE_D;
      if (this.selection?.id === s.id && Math.hypot(sx - hx, sy - hy) < 8) return { type: 'heading', scan: s };
      if (Math.hypot(sx - cx, sy - cy) < SCAN_R + 2) return { type: 'scan', scan: s };
    }
    for (const room of this.rooms) {
      for (const p of room.points) {
        const [px, py] = this.toScreen(p);
        if (Math.hypot(sx - px, sy - py) < 8) return { type: 'vertex', room, point: p };
      }
    }
    const w = this.toWorld(sx, sy);
    for (let i = this.rooms.length - 1; i >= 0; i--) {
      if (pointInPolygon(w, this.rooms[i].points)) return { type: 'room', room: this.rooms[i] };
    }
    return null;
  }

  // ------------------------------------------------------------ input

  bind() {
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => {
      c.setPointerCapture(e.pointerId);
      const [sx, sy] = this.eventPos(e);
      if (e.button === 1 || e.button === 2) {
        this.drag = { kind: 'pan', sx, sy, offset: { ...this.offset } };
        return;
      }
      if (this.tool === 'draw') return this.drawClick(sx, sy, e);
      const hit = this.hitTest(sx, sy);
      const w = this.toWorld(sx, sy);
      if (!hit) {
        this.select(null);
        this.drag = { kind: 'pan', sx, sy, offset: { ...this.offset } };
      } else if (hit.type === 'scan') {
        this.select({ type: 'scan', id: hit.scan.id });
        this.drag = { kind: 'scan', scan: hit.scan, start: w, origin: { ...hit.scan.position } };
      } else if (hit.type === 'heading') {
        this.drag = { kind: 'heading', scan: hit.scan };
      } else if (hit.type === 'vertex') {
        this.select({ type: 'room', id: hit.room.id });
        this.drag = { kind: 'vertex', room: hit.room, point: hit.point };
      } else {
        this.select({ type: 'room', id: hit.room.id });
        this.drag = { kind: 'room', room: hit.room, start: w, origin: hit.room.points.map((p) => [...p]) };
      }
    });
    c.addEventListener('pointermove', (e) => {
      const [sx, sy] = this.eventPos(e);
      this.hover = this.toWorld(sx, sy);
      const d = this.drag;
      if (!d) {
        if (this.tool === 'draw') this.draw();
        else c.style.cursor = this.hitTest(sx, sy) ? 'grab' : 'default';
        return;
      }
      d.moved = true;
      const w = this.toWorld(sx, sy);
      if (d.kind === 'pan') {
        this.userMoved = true;
        this.offset = { x: d.offset.x + sx - d.sx, y: d.offset.y + sy - d.sy };
      } else if (d.kind === 'scan') {
        const [x, z] = this.snap([d.origin.x + w[0] - d.start[0], d.origin.z + w[1] - d.start[1]], { free: true });
        d.scan.position = { x: round(x), z: round(z) };
        this.cb.onScanPreview?.(d.scan);
      } else if (d.kind === 'heading') {
        const dx = w[0] - d.scan.position.x, dz = w[1] - d.scan.position.z;
        let deg = Math.atan2(-dx, -dz) / DEG;
        if (!e.altKey) deg = Math.round(deg / 5) * 5; // 5° steps unless Alt
        d.scan.heading = ((deg % 360) + 360) % 360;
        this.cb.onScanPreview?.(d.scan);
      } else if (d.kind === 'vertex') {
        const [x, z] = this.snap(w, { exclude: d.point, free: e.altKey });
        d.point[0] = x;
        d.point[1] = z;
        this.cb.onRoomsPreview?.(this.rooms);
      } else if (d.kind === 'room') {
        const dx = Math.round((w[0] - d.start[0]) / GRID) * GRID, dz = Math.round((w[1] - d.start[1]) / GRID) * GRID;
        d.room.points = d.origin.map(([x, z]) => [round(x + dx), round(z + dz)]);
        this.cb.onRoomsPreview?.(this.rooms);
      }
      this.draw();
    });
    c.addEventListener('pointerup', () => {
      const d = this.drag;
      this.drag = null;
      if (!d?.moved) return;
      if (d.kind === 'scan') this.cb.onScanCommit?.(d.scan, { position: d.scan.position });
      if (d.kind === 'heading') this.cb.onScanCommit?.(d.scan, { heading: d.scan.heading });
      if (d.kind === 'vertex' || d.kind === 'room') this.commitRooms();
    });
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      const [sx, sy] = this.eventPos(e);
      const before = this.toWorld(sx, sy);
      this.userMoved = true;
      this.scale = Math.min(400, Math.max(8, this.scale * Math.exp(-e.deltaY * 0.0015)));
      this.offset = { x: sx - before[0] * this.scale, y: sy - before[1] * this.scale };
      this.draw();
    }, { passive: false });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('dblclick', (e) => {
      if (this.tool !== 'draw') return;
      e.preventDefault();
      this.closeDraft();
    });

    this.onKey = (e) => {
      if (e.target.closest?.('input, textarea, select')) return;
      if (!this.canvas.isConnected) return;
      if (this.tool === 'draw') {
        if (e.key === 'Enter') this.closeDraft();
        if (e.key === 'Escape') this.cb.onToolDone?.();
        if (e.key === 'Backspace' && this.draft?.length) {
          this.draft.pop();
          this.draw();
        }
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && this.selection?.type === 'room') {
        this.deleteRoom(this.selection.id);
      }
    };
    window.addEventListener('keydown', this.onKey);
  }

  drawClick(sx, sy, e) {
    const p = this.snap(this.toWorld(sx, sy), { free: e.altKey });
    if (this.draft.length >= 3) {
      const [fx, fy] = this.toScreen(this.draft[0]);
      if (Math.hypot(sx - fx, sy - fy) < SNAP_PX) return this.closeDraft();
    }
    this.draft.push(p);
    this.draw();
  }

  closeDraft() {
    if (!this.draft || this.draft.length < 3) return;
    const points = normalizePolygon(this.draft);
    this.draft = [];
    if (points.length < 3) return this.draw();
    this.cb.onRoomCreate?.({ name: `Room ${this.rooms.length + 1}`, height: 2.6, points });
  }

  deleteRoom(id) {
    this.rooms = this.rooms.filter((r) => r.id !== id);
    this.select(null);
    this.commitRooms();
  }

  commitRooms() {
    this.cb.onRoomsCommit?.(this.rooms);
  }

  // ------------------------------------------------------------ drawing

  draw() {
    const ctx = this.ctx;
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    const css = getComputedStyle(this.canvas);
    const color = (name) => css.getPropertyValue(name).trim();
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = color('--plan-bg');
    ctx.fillRect(0, 0, w, h);
    if (!this.space) return;

    // grid: 1 m lines, plus 0.5 m when zoomed in
    const step = this.scale > 60 ? 0.5 : 1;
    const [x0, z0] = this.toWorld(0, 0), [x1, z1] = this.toWorld(w, h);
    ctx.lineWidth = 1;
    for (let x = Math.floor(x0 / step) * step; x <= x1; x += step) {
      ctx.strokeStyle = Math.abs(x % 1) < 1e-6 ? color('--plan-grid-major') : color('--plan-grid');
      const [sx] = this.toScreen([x, 0]);
      ctx.beginPath(); ctx.moveTo(Math.round(sx) + 0.5, 0); ctx.lineTo(Math.round(sx) + 0.5, h); ctx.stroke();
    }
    for (let z = Math.floor(z0 / step) * step; z <= z1; z += step) {
      ctx.strokeStyle = Math.abs(z % 1) < 1e-6 ? color('--plan-grid-major') : color('--plan-grid');
      const [, sy] = this.toScreen([0, z]);
      ctx.beginPath(); ctx.moveTo(0, Math.round(sy) + 0.5); ctx.lineTo(w, Math.round(sy) + 0.5); ctx.stroke();
    }

    for (const room of this.rooms) {
      const selected = this.selection?.type === 'room' && this.selection.id === room.id;
      const pts = room.points.map((p) => this.toScreen(p));
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.fillStyle = selected ? color('--plan-room-selected') : color('--plan-room');
      ctx.fill();
      ctx.lineWidth = selected ? 4 : 3;
      ctx.strokeStyle = selected ? color('--accent') : color('--plan-wall');
      ctx.stroke();

      ctx.font = '11px system-ui, sans-serif';
      ctx.fillStyle = color('--plan-dim');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const n = normalizePolygon(room.points);
      for (let i = 0; i < n.length; i++) {
        const p = n[i], q = n[(i + 1) % n.length];
        const len = distance2(p, q);
        if (len * this.scale < 40) continue;
        const nx = -(q[1] - p[1]) / len, nz = (q[0] - p[0]) / len;
        const [lx, ly] = this.toScreen([(p[0] + q[0]) / 2 + nx * (14 / this.scale), (p[1] + q[1]) / 2 + nz * (14 / this.scale)]);
        ctx.fillText(`${len.toFixed(2)}`, lx, ly);
      }
      const [cx, cy] = this.toScreen(centroid(n));
      ctx.fillStyle = color('--text');
      ctx.font = '600 12px system-ui, sans-serif';
      ctx.fillText(room.name, cx, cy - 7);
      ctx.font = '11px system-ui, sans-serif';
      ctx.fillStyle = color('--plan-dim');
      ctx.fillText(`${polygonArea(room.points).toFixed(1)} m²`, cx, cy + 8);

      if (selected) {
        for (const [x, y] of pts) {
          ctx.beginPath();
          ctx.arc(x, y, 5, 0, Math.PI * 2);
          ctx.fillStyle = color('--surface');
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = color('--accent');
          ctx.stroke();
        }
      }
    }

    for (const tag of this.space.tags) {
      const [x, y] = this.toScreen([tag.position[0], tag.position[2]]);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = color('--tag');
      ctx.fillRect(-4, -4, 8, 8);
      ctx.restore();
    }

    this.space.scans.forEach((s, i) => {
      const [x, y] = this.toScreen([s.position.x, s.position.z]);
      const selected = this.selection?.type === 'scan' && this.selection.id === s.id;
      const th = (s.heading ?? 0) * DEG;
      const hx = x - Math.sin(th) * HANDLE_D, hy = y - Math.cos(th) * HANDLE_D;
      // view cone for the panorama's forward direction
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.arc(x, y, 26, -Math.PI / 2 - th - 0.45, -Math.PI / 2 - th + 0.45);
      ctx.closePath();
      ctx.fillStyle = color('--scan-cone');
      ctx.fill();
      if (selected) {
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(hx, hy);
        ctx.strokeStyle = color('--accent'); ctx.lineWidth = 2; ctx.stroke();
        ctx.beginPath(); ctx.arc(hx, hy, 6, 0, Math.PI * 2);
        ctx.fillStyle = color('--accent'); ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(x, y, SCAN_R, 0, Math.PI * 2);
      ctx.fillStyle = selected ? color('--accent') : color('--scan');
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = color('--surface');
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = '600 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(i + 1), x, y + 0.5);
    });

    if (this.draft) {
      const pts = [...this.draft];
      if (this.hover) pts.push(this.snap(this.hover));
      ctx.beginPath();
      pts.map((p) => this.toScreen(p)).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.strokeStyle = color('--accent');
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      this.draft.forEach((p, i) => {
        const [x, y] = this.toScreen(p);
        ctx.beginPath();
        ctx.arc(x, y, i === 0 && this.draft.length >= 3 ? 7 : 4, 0, Math.PI * 2);
        ctx.fillStyle = color('--accent');
        ctx.fill();
      });
      if (pts.length >= 2) {
        const a = pts.at(-2), b = pts.at(-1);
        const [mx, my] = this.toScreen([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
        ctx.fillStyle = color('--text');
        ctx.font = '600 12px system-ui, sans-serif';
        ctx.fillText(`${distance2(a, b).toFixed(2)} m`, mx, my - 12);
      }
    }

    // scale bar
    const bar = niceLength(100 / this.scale);
    ctx.fillStyle = color('--plan-dim');
    ctx.fillRect(16, h - 22, bar * this.scale, 3);
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${bar} m`, 16, h - 32);
  }
}

function round(n) {
  return Math.round(n * 1000) / 1000;
}

function niceLength(m) {
  for (const v of [0.25, 0.5, 1, 2, 5, 10, 20, 50]) if (v >= m) return v;
  return 100;
}
