// Shared engine: helpers, background, subtitles, logo reveal, scene timeline.
const C = CFG.colors, W = CFG.W, H = CFG.H;
const stage = document.getElementById('stage');
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, p) => a + (b - a) * p;
const win = (t, a, d) => clamp((t - a) / d);
const eio = p => p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
const eo = p => 1 - Math.pow(1 - p, 3);
// critically damped spring (no overshoot) and a discreet pop (tiny overshoot)
const spr = p => p <= 0 ? 0 : p >= 1 ? 1 : (1 - (1 + 7 * p) * Math.exp(-7 * p)) / (1 - 8 * Math.exp(-7));
const pop = p => { if (p <= 0) return 0; if (p >= 1) return 1; const c = 1.25; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); };
const NS = 'http://www.w3.org/2000/svg';
function el(tag, cls, parent, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; (parent || stage).appendChild(e); return e; }
function sv(tag, attrs, parent) { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
function svgBox(parent, x, y, w, h) { const s = sv('svg', { width: w, height: h, viewBox: `0 0 ${w} ${h}` }); s.style.cssText = `position:absolute;left:${x}px;top:${y}px;overflow:visible`; parent.appendChild(s); return s; }
function place(e, x, y, op = 1, sc = 1, blur = 0) { e.style.transform = `translate(${x}px,${y}px) scale(${sc})`; e.style.opacity = op; e.style.filter = blur > .05 ? `blur(${blur}px)` : 'none'; }
const pstr = pts => pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
// text block centred at y; returns element
function textAt(parent, html, y, cls) { const d = el('div', 'tx ' + (cls || ''), parent, html); d.style.top = y + 'px'; return d; }
// shrink a label so it fits the safe width
function fit(e, maxW = 940) { const w = e.scrollWidth; if (w > maxW) e.style.fontSize = (parseFloat(getComputedStyle(e).fontSize) * maxW / w) + 'px'; }
function reveal(e, lt, start, dy = 26) { const p = eo(win(lt, start, .55)); e.style.opacity = p; e.style.transform = `translateY(${(1 - p) * dy}px)`; e.style.filter = p < .98 ? `blur(${(1 - p) * 8}px)` : 'none'; }

// ---------- global defs (gradients) ----------
const defs = sv('svg', { width: 0, height: 0 }); defs.style.position = 'absolute'; stage.appendChild(defs);
defs.innerHTML = `<defs>
 <linearGradient id="gAcc" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.g1}"/><stop offset="1" stop-color="${C.g2}"/></linearGradient>
 <linearGradient id="gAccH" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${C.g1}"/><stop offset="1" stop-color="${C.g2}"/></linearGradient>
 <linearGradient id="gFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.g1}" stop-opacity=".22"/><stop offset="1" stop-color="${C.g2}" stop-opacity=".06"/></linearGradient>
</defs>`;

// ---------- background: glow + blueprint grid + scan line ----------
const bg = el('div', 'bg');
const glowA = el('div', 'glow', bg), glowB = el('div', 'glow', bg);
const grid = svgBox(bg, 0, 0, W, H);
grid.innerHTML = `<defs><pattern id="gp" width="60" height="60" patternUnits="userSpaceOnUse"><path d="M60 0H0V60" fill="none" stroke="rgba(249,250,251,.045)" stroke-width="1"/></pattern>
 <pattern id="gp2" width="300" height="300" patternUnits="userSpaceOnUse"><path d="M300 0H0V300" fill="none" stroke="rgba(46,204,113,.07)" stroke-width="1"/></pattern></defs>
 <rect width="${W}" height="${H}" fill="url(#gp)"/><rect width="${W}" height="${H}" fill="url(#gp2)"/>`;
const scan = el('div', 'scan', bg);
function renderBg(t) {
  const on = clamp(t / 1.4);
  glowA.style.opacity = .9 * eio(on); glowB.style.opacity = .55 * eio(on);
  glowA.style.transform = `translate(${540 - 650 + Math.sin(t * .25) * 140}px,${860 - 650 + Math.cos(t * .19) * 180}px)`;
  glowB.style.transform = `translate(${300 - 450 + Math.cos(t * .21) * 160}px,${1350 - 450 + Math.sin(t * .17) * 120}px)`;
  grid.style.opacity = .35 + .65 * eio(on);
  const y = ((t * 110) % (H + 400)) - 200; scan.style.transform = `translateY(${y}px)`; scan.style.opacity = .5 * on;
}

// ---------- timeline ----------
const A = CFG.audioOffset;
const LINE_START = CFG.lines.map(l => l.t[0] + A);
const AUDIO_END = CFG.lines[CFG.lines.length - 1].t[1] + A;
const DURATION = Math.ceil((AUDIO_END + CFG.tail) * CFG.fps) / CFG.fps;
const PRE = 3 / CFG.fps;                      // entrance starts ~3 frames early
const SC_START = LINE_START.map((s, i) => i === 0 ? 0 : s - PRE);
const SC_END = SC_START.map((s, i) => i < SC_START.length - 1 ? SC_START[i + 1] : DURATION + 1);

// ---------- subtitles (word by word, current word green) ----------
const WORDS = CFG.lines.map(l => {
  const ws = l.text.split(' ');
  const parts = l.parts || [[l.t[0], l.t[1], ws.length]];
  const out = []; let wi = 0;
  for (const [a, b, n] of parts) {
    const grp = ws.slice(wi, wi + n); wi += n;
    const wts = grp.map(w => w.replace(/[^\p{L}\p{N}]/gu, '').length + 1.2), tot = wts.reduce((s, v) => s + v, 0);
    let c = a; grp.forEach((w, i) => { const d = (b - a) * wts[i] / tot; out.push({ w, s: c + A, e: c + d + A }); c += d; });
  }
  return out;
});
const sub = el('div', 'sub');
const subLines = WORDS.map(ws => { const d = el('div', 'subl', sub); const spans = ws.map(o => el('span', '', d, o.w)); return { d, spans }; });
function renderSub(t) {
  CFG.lines.forEach((l, i) => {
    const s = LINE_START[i] - .12, e = i < CFG.lines.length - 1 ? Math.min(LINE_START[i + 1] - .15, l.t[1] + A + .9) : l.t[1] + A + .6;
    const a = Math.min(win(t, s, .15), clamp((e - t) / .2));
    const L = subLines[i]; L.d.style.display = a > 0 ? 'block' : 'none'; if (a <= 0) return;
    L.d.style.opacity = a;
    WORDS[i].forEach((o, k) => {
      const sp = L.spans[k]; const p = win(t, o.s - .06, .14);
      sp.style.opacity = p; sp.style.transform = `translateY(${(1 - eo(p)) * 10}px)`;
      sp.className = (t >= o.s - .06 && t < o.e + .02) ? 'cur' : '';
    });
  });
}

// ---------- logo (official PNG, revealed with masks: V tick -> C arc -> house pop) ----------
let LOGO_N = 0;
function Logo(parent, size, cx, cy) {
  const n = ++LOGO_N, k = size / 864;
  const wrap = el('div', 'logo', parent);
  wrap.style.cssText = `position:absolute;left:${cx - 456 * k}px;top:${cy - 433 * k}px;width:${size}px;height:${size}px`;
  const glow = el('div', 'lglow', wrap);
  glow.style.cssText += `left:${456 * k - size * .75}px;top:${433 * k - size * .75}px;width:${size * 1.5}px;height:${size * 1.5}px`;
  const s = sv('svg', { width: size, height: size, viewBox: '0 0 864 864' }); s.style.cssText = 'position:absolute;left:0;top:0;overflow:visible'; wrap.appendChild(s);
  const arc = 'M755.9 271.5 A202 202 0 1 0 769.8 591.7';
  s.innerHTML = `<defs>
   <mask id="mV${n}" maskUnits="userSpaceOnUse" x="0" y="0" width="864" height="864">
     <path id="pV${n}" d="M152 206 L390 642 L496 536" fill="none" stroke="#fff" stroke-width="112" stroke-linecap="round" stroke-linejoin="round" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="1"/>
     <circle cx="640" cy="437" r="202" fill="none" stroke="#000" stroke-width="124"/>
     <rect x="515" y="318" width="247" height="210" fill="#000"/></mask>
   <mask id="mC${n}" maskUnits="userSpaceOnUse" x="0" y="0" width="864" height="864">
     <path id="pC${n}" d="${arc}" fill="none" stroke="#fff" stroke-width="124" stroke-linecap="butt" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="1"/>
     <rect x="515" y="318" width="247" height="210" fill="#000"/></mask>
   <mask id="mH${n}" maskUnits="userSpaceOnUse" x="0" y="0" width="864" height="864"><rect x="515" y="318" width="247" height="210" fill="#fff"/></mask>
  </defs>
  <g id="gV${n}" mask="url(#mV${n})"><image href="../logo_alb.png" width="864" height="864"/></g>
  <g id="gC${n}" mask="url(#mC${n})"><image href="../logo_alb.png" width="864" height="864"/></g>
  <g id="gH${n}"><g mask="url(#mH${n})"><image href="../logo_alb.png" width="864" height="864"/></g></g>
  <image id="full${n}" href="../logo_alb.png" width="864" height="864" opacity="0"/>`;
  const q = id => s.querySelector('#' + id + n);
  const pV = q('pV'), pC = q('pC'), gV = q('gV'), gC = q('gC'), gH = q('gH'), full = q('full');
  return {
    wrap, glow,
    // pv, pc, ph in [0,1]
    set(pv, pc, ph, glowA = 1) {
      pV.setAttribute('stroke-dashoffset', 1 - eio(pv));
      pC.setAttribute('stroke-dashoffset', 1 - eio(pc));
      const hs = pop(ph);
      gH.setAttribute('transform', `translate(637 423) scale(${Math.max(.001, hs)}) translate(-637 -423)`);
      gH.setAttribute('opacity', clamp(ph * 2.5));
      const done = pv >= 1 && pc >= 1 && ph >= 1;
      full.setAttribute('opacity', done ? 1 : 0);            // finished state = original PNG, untouched
      [gV, gC, gH].forEach(g => g.style.display = done ? 'none' : 'inline');
      glow.style.opacity = glowA;
    },
  };
}

// ---------- 3D projection ----------
function P(p, c) {
  const x = p[0] - c.cx, y = p[1] - c.cy, z = p[2] || 0;
  const cy = Math.cos(c.yaw), sy = Math.sin(c.yaw);
  const x1 = x * cy - y * sy, y1 = x * sy + y * cy;
  const cp = Math.cos(c.pitch), sp = Math.sin(c.pitch);
  const down = -(y1 * cp + z * sp), depth = -y1 * sp + z * cp, f = c.D / (c.D - depth);
  return [c.ox + x1 * c.k * f, c.oy + down * c.k * f, depth];
}
function faces(g, list, cam) {
  const pr = list.map(f => { const q = f.pts.map(p => P(p, cam)); return { f, q, d: q.reduce((s, p) => s + p[2], 0) / q.length }; }).sort((a, b) => a.d - b.d);
  g.innerHTML = pr.map(({ f, q }) => `<polygon points="${pstr(q)}" fill="${f.fill || 'none'}" stroke="${f.stroke || C.g1}" stroke-width="${f.sw || 2.5}" stroke-opacity="${f.so ?? 1}" stroke-linejoin="round"/>`).join('');
}
function boxF(x0, y0, z0, x1, y1, z1, o = {}) {
  const v = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
  return [[4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]].map(ix => ({ pts: ix.map(i => v[i]), ...o }));
}

// ---------- glass card ----------
function card(parent, x, y, w, h, r = 40) { const c = el('div', 'card', parent); Object.assign(c.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px', borderRadius: r + 'px' }); return c; }
function label(parent, text, y) { const d = textAt(parent, text, y, 'label'); fit(d); return d; }

// ---------- scene registry & master render ----------
const SCENES = [];
function scene(i, init) { const root = el('div', 'scene'); const api = init(root) || {}; SCENES[i] = { root, ...api }; }
window.render = function (t) {
  renderBg(t);
  SCENES.forEach((s, i) => {
    const st = SC_START[i], en = SC_END[i], lt = t - st;
    const a = Math.min(i === 0 ? 1 : win(t, st, .3), clamp((en + .25 - t) / .35));
    s.root.style.display = a > 0 ? 'block' : 'none';
    if (a <= 0) return;
    s.root.style.opacity = a;
    s.update && s.update(lt, a, t);
  });
  renderSub(t);
};
window.TIMELINE = { DURATION, SC_START, SC_END, LINE_START, AUDIO_END, WORDS };
