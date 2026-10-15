// Scene components. Each scene(i, root => ({ update(lt, alpha, t) })) – lt = local time in seconds.
const G = C.g1, WHITE_SOFT = 'rgba(249,250,251,.28)';

// =========== 1. Imobiliarele se schimbă. ===========
scene(0, root => {
  const t1 = textAt(root, CFG.s1.title, 400, 'h1');
  const t2 = textAt(root, CFG.s1.accent, 530, 'serif acc');
  const s = svgBox(root, 0, 0, W, H);
  const house = sv('path', { d: 'M300 1200 L780 1200 L780 930 L540 740 L300 930 Z M495 1200 V1080 H585 V1200 M370 980 H460 V1060 H370 Z M620 980 H710 V1060 H620 Z', fill: 'none', stroke: G, 'stroke-width': 4, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', pathLength: 1, 'stroke-dasharray': '1 1' }, s);
  const gridG = sv('g', {}, s), dots = sv('g', {}, s);
  const xs = [], ys = []; for (let x = 300; x <= 780; x += 60) xs.push(x); for (let y = 740; y <= 1200; y += 60) ys.push(y);
  return {
    update(lt) {
      reveal(t1, lt, .15); reveal(t2, lt, .55);
      house.setAttribute('stroke-dashoffset', 1 - eio(win(lt, .15, 1.0)));
      const g = eio(win(lt, 1.05, .9));
      house.setAttribute('stroke-opacity', 1 - .55 * g);
      let h = '';
      xs.forEach((x, i) => { const p = clamp(g * 1.6 - i * .05); if (p > 0) h += `<line x1="${x}" y1="${970 - 230 * p}" x2="${x}" y2="${970 + 230 * p}" stroke="${G}" stroke-opacity="${.35 * p}" stroke-width="1.5"/>`; });
      ys.forEach((y, i) => { const p = clamp(g * 1.6 - i * .05); if (p > 0) h += `<line x1="${540 - 240 * p}" y1="${y}" x2="${540 + 240 * p}" y2="${y}" stroke="${G}" stroke-opacity="${.35 * p}" stroke-width="1.5"/>`; });
      gridG.innerHTML = h;
      let d = ''; if (g > .4) xs.forEach((x, i) => ys.forEach((y, j) => { const p = clamp((g - .4) * 3 - ((i + j) % 5) * .08); if (p > 0) d += `<circle cx="${x}" cy="${y}" r="${3 + 1.5 * Math.sin(lt * 5 + i + j)}" fill="${G}" opacity="${.7 * p}"/>`; }));
      dots.innerHTML = d;
    }
  };
});

// =========== 2. Iar VerifiCasa e aproape gata de lansare. ===========
scene(1, root => {
  const logo = Logo(root, 600, 540, 830);
  const wm = textAt(root, `<span>${CFG.s2.wordA}</span><span class="acc">${CFG.s2.wordB}</span>`, 1150, 'wordmark');
  return {
    update(lt) {
      logo.set(win(lt, .1, .6), win(lt, .6, .75), win(lt, 1.3, .5), .35 + .65 * eio(win(lt, 1.2, .8)));
      const p = eio(win(lt, 1.5, .8));
      wm.style.clipPath = `inset(0 ${100 - p * 100}% 0 0)`; wm.style.opacity = p > 0 ? 1 : 0;
    }
  };
});

// =========== 3. Cumpărătorii vor să vadă totul ===========
scene(2, root => {
  const t1 = textAt(root, `${CFG.s3.a} <span class="serif acc">${CFG.s3.accent}</span>`, 360, 'h2');
  const t2 = textAt(root, CFG.s3.b, 490, 'sub2');
  const phone = card(root, 320, 630, 440, 740, 64);
  const s = svgBox(root, 0, 0, W, H);
  const listing = `
   <rect x="352" y="720" width="376" height="290" rx="22" fill="rgba(46,204,113,.06)" stroke="${WHITE_SOFT}" stroke-width="2"/>
   <path d="M440 960 H640 V860 L540 790 L440 860 Z M520 960 V915 H560 V960 M465 875 H500 V905 H465 Z M580 875 H615 V905 H580 Z" fill="none" stroke="${G}" stroke-width="3.5" stroke-linejoin="round"/>
   <line x1="380" y1="990" x2="700" y2="990" stroke="${G}" stroke-opacity=".35" stroke-width="2"/>`;
  s.innerHTML = `<rect x="490" y="662" width="100" height="22" rx="11" fill="rgba(249,250,251,.12)"/>${listing}
   <rect x="352" y="1040" width="250" height="22" rx="11" fill="rgba(249,250,251,.5)"/>
   <rect x="352" y="1080" width="330" height="16" rx="8" fill="rgba(249,250,251,.18)"/>
   <rect x="352" y="1110" width="290" height="16" rx="8" fill="rgba(249,250,251,.18)"/>
   <rect x="352" y="1160" width="150" height="40" rx="20" fill="url(#gAccH)"/>
   <rect x="352" y="1230" width="376" height="80" rx="20" fill="rgba(249,250,251,.05)" stroke="rgba(249,250,251,.1)"/>
   <defs><clipPath id="lensClip"><circle id="lensC" cx="0" cy="0" r="88"/></clipPath></defs>
   <g clip-path="url(#lensClip)"><circle id="lensBg" r="88" fill="#0d1a14"/><g id="lensZoom">${listing}</g></g>
   <g id="lens"><circle r="88" fill="none" stroke="#F9FAFB" stroke-width="6"/><circle r="88" fill="rgba(46,204,113,.06)"/><line x1="64" y1="64" x2="128" y2="128" stroke="#F9FAFB" stroke-width="16" stroke-linecap="round"/></g>`;
  const lens = s.querySelector('#lens'), lc = s.querySelector('#lensC'), lb = s.querySelector('#lensBg'), lz = s.querySelector('#lensZoom');
  return {
    update(lt) {
      reveal(t1, lt, .05); reveal(t2, lt, .3);
      const p = spr(win(lt, 0, .8)); place(phone, 0, (1 - p) * 60, clamp(p * 1.4)); s.style.opacity = clamp(p * 1.4); s.style.transform = `translateY(${(1 - p) * 60}px)`;
      const m = eio(win(lt, .7, 2.2)), lx = 470 + 140 * Math.sin(m * Math.PI * 1.2), ly = 880 + 40 * Math.cos(m * Math.PI * 2);
      const la = clamp((lt - .6) * 3);
      lens.setAttribute('transform', `translate(${lx} ${ly})`); lens.setAttribute('opacity', la);
      lc.setAttribute('cx', lx); lc.setAttribute('cy', ly); lb.setAttribute('cx', lx); lb.setAttribute('cy', ly);
      lz.setAttribute('transform', `translate(${lx} ${ly}) scale(1.7) translate(${-lx} ${-ly})`); lz.parentNode.setAttribute('opacity', la);
    }
  };
});

// =========== 4. Tururi virtuale 3D ===========
const ROOM = (() => {
  const soft = { fill: 'rgba(46,204,113,.05)', so: .9 };
  let f = [
    { pts: [[0, 0, 0], [6, 0, 0], [6, 5, 0], [0, 5, 0]], fill: 'rgba(46,204,113,.08)' },
    { pts: [[0, 5, 0], [6, 5, 0], [6, 5, 2.6], [0, 5, 2.6]], ...soft },
    { pts: [[0, 0, 0], [0, 5, 0], [0, 5, 2.6], [0, 0, 2.6]], ...soft },
    { pts: [[6, 0, 0], [6, 5, 0], [6, 5, 2.6], [6, 0, 2.6]], ...soft },
    { pts: [[1.6, 4.98, .9], [3.6, 4.98, .9], [3.6, 4.98, 2.1], [1.6, 4.98, 2.1]], stroke: '#F9FAFB', so: .7, sw: 2 },
    { pts: [[5.98, 1.2, 0], [5.98, 2.2, 0], [5.98, 2.2, 2.1], [5.98, 1.2, 2.1]], stroke: '#F9FAFB', so: .5, sw: 2 },
  ];
  f = f.concat(boxF(.6, 3.7, 0, 3.2, 4.6, .75, { fill: 'rgba(10,13,18,.85)' }), boxF(1.4, 1.9, 0, 2.6, 2.8, .42, { fill: 'rgba(10,13,18,.85)' }), boxF(4.5, 3.9, 0, 5.4, 4.7, 1.7, { fill: 'rgba(10,13,18,.85)' }));
  return f;
})();
scene(3, root => {
  const lb = label(root, CFG.s4.label, 400);
  const cd = card(root, 90, 600, 900, 770);
  const s = svgBox(root, 0, 0, W, H); const g = sv('g', {}, s), hot = sv('g', {}, s);
  return {
    update(lt) {
      reveal(lb, lt, .05);
      const p = spr(win(lt, 0, .8)); place(cd, 0, (1 - p) * 50, clamp(p * 1.4));
      const cam = { cx: 3, cy: 2.5, yaw: -.75 + eio(clamp(lt / 3.6)) * 1.0, pitch: .98, k: 108, D: 40, ox: 540, oy: 990 };
      faces(g, ROOM, cam);
      const clear = eio(win(lt, .15, 1.3));
      s.style.filter = clear < .99 ? `blur(${(1 - clear) * 14}px)` : 'none'; s.style.opacity = .25 + .75 * clear;
      hot.innerHTML = [[1.5, 1], [4.6, 1.6], [3, 3.1]].map(([x, y], i) => { const q = P([x, y, 0], cam); return `<circle cx="${q[0]}" cy="${q[1]}" r="${20 + 5 * Math.sin(lt * 4 + i)}" fill="rgba(46,204,113,.18)"/><circle cx="${q[0]}" cy="${q[1]}" r="9" fill="${C.bg}" stroke="${G}" stroke-width="3"/>`; }).join('');
      hot.style.opacity = win(lt, 1.2, .5);
    }
  };
});

// =========== 5. Planuri de etaj -> planuri 3D ===========
const WALLS = [[0, 0, 10, 0], [10, 0, 10, 7], [10, 7, 0, 7], [0, 7, 0, 0], [6, 0, 6, 2.4], [6, 3.4, 6, 7], [6, 3.6, 10, 3.6], [0, 4.4, 2.4, 4.4], [3.4, 4.4, 6, 4.4]];
const DOORS = [[6, 2.4, 6, 3.4], [2.4, 4.4, 3.4, 4.4]];
scene(4, root => {
  const l1 = label(root, CFG.s5.label1, 360);
  const l2 = label(root, `<span class="arrow">→</span> ${CFG.s5.label2}`, 450);
  const cd = card(root, 90, 620, 900, 750);
  const s = svgBox(root, 0, 0, W, H); const g = sv('g', {}, s);
  return {
    update(lt) {
      reveal(l1, lt, .05); reveal(l2, lt, 1.25);
      const p = spr(win(lt, 0, .8)); place(cd, 0, (1 - p) * 50, clamp(p * 1.4));
      const tilt = eio(win(lt, 1.15, 1.2)), h = 2.5 * eo(win(lt, 1.3, 1.1));
      const cam = { cx: 5, cy: 3.5, yaw: -.6 * tilt, pitch: 1.0 * tilt, k: lerp(78, 66, tilt), D: 60, ox: 540, oy: lerp(990, 1020, tilt) };
      let out = `<polygon points="${pstr([[0, 0], [10, 0], [10, 7], [0, 7]].map(q => P([q[0], q[1], 0], cam)))}" fill="rgba(46,204,113,.06)"/>`;
      if (h < .02) {
        WALLS.forEach((w, i) => { const q = eo(win(lt, .1 + i * .06, .45)); if (q <= 0) return; const a = P([w[0], w[1], 0], cam), b = P([lerp(w[0], w[2], q), lerp(w[1], w[3], q), 0], cam);
          out += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${G}" stroke-width="${i < 4 ? 7 : 5}" stroke-linecap="round"/>`; });
        DOORS.forEach((d, i) => { const q = win(lt, .7 + i * .1, .3); if (q <= 0) return; const a = P([d[0], d[1], 0], cam), b = P([d[2], d[3], 0], cam); const r = Math.hypot(b[0] - a[0], b[1] - a[1]);
          out += `<path d="M${a[0]} ${a[1]} A${r} ${r} 0 0 1 ${b[0]} ${b[1]}" fill="none" stroke="#F9FAFB" stroke-opacity="${.6 * q}" stroke-width="2" stroke-dasharray="6 6"/>`; });
        g.innerHTML = out;
      } else {
        const list = WALLS.map(w => ({ pts: [[w[0], w[1], 0], [w[2], w[3], 0], [w[2], w[3], h], [w[0], w[1], h]], fill: 'rgba(46,204,113,.14)', sw: 2.5 }));
        g.innerHTML = out; const gg = sv('g', {}, g); faces(gg, list, cam);
      }
    }
  };
});

// =========== 6. Home staging virtual ===========
scene(5, root => {
  const lb = label(root, CFG.s6.label, 400);
  const cd = card(root, 90, 620, 900, 750);
  const s = svgBox(root, 0, 0, W, H);
  const room = `<rect x="140" y="680" width="800" height="430" fill="none" stroke="${WHITE_SOFT}" stroke-width="2"/>
   <path d="M140 1110 L95 1370 M940 1110 L985 1370" stroke="${WHITE_SOFT}" stroke-width="2"/>
   <rect x="640" y="760" width="200" height="190" rx="6" fill="rgba(46,204,113,.05)" stroke="#F9FAFB" stroke-opacity=".55" stroke-width="2.5"/><line x1="740" y1="760" x2="740" y2="950" stroke="#F9FAFB" stroke-opacity=".55" stroke-width="2.5"/>`;
  s.innerHTML = `<defs><clipPath id="cpAfter"><rect id="cpR" x="90" y="600" width="900" height="820"/></clipPath></defs>
   <g>${room}</g><g clip-path="url(#cpAfter)" id="furn"></g>
   <g id="slider"><line x1="0" y1="640" x2="0" y2="1355" stroke="#F9FAFB" stroke-width="3"/><circle cx="0" cy="1012" r="34" fill="${C.card}" stroke="#F9FAFB" stroke-width="3"/><path d="M-12 1000 L-22 1012 L-12 1024 M12 1000 L22 1012 L12 1024" fill="none" stroke="${G}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></g>`;
  const F = [
    [`<ellipse cx="470" cy="1300" rx="300" ry="50" fill="rgba(46,204,113,.10)" stroke="${G}" stroke-opacity=".5" stroke-width="2"/>`, 470, 1300],
    [`<path d="M250 1100 V1040 a30 30 0 0 1 30 -30 H630 a30 30 0 0 1 30 30 V1100" fill="rgba(46,204,113,.10)" stroke="${G}" stroke-width="3.5"/><rect x="225" y="1100" width="460" height="90" rx="26" fill="rgba(46,204,113,.16)" stroke="${G}" stroke-width="3.5"/><line x1="455" y1="1110" x2="455" y2="1180" stroke="${G}" stroke-width="2.5"/><path d="M250 1190 v24 M660 1190 v24" stroke="${G}" stroke-width="5" stroke-linecap="round"/>`, 455, 1214],
    [`<rect x="380" y="1255" width="190" height="16" rx="8" fill="${C.bg}" stroke="#F9FAFB" stroke-width="2.5"/><path d="M400 1271 v34 M550 1271 v34" stroke="#F9FAFB" stroke-width="3"/>`, 475, 1305],
    [`<path d="M780 1250 V1010" stroke="#F9FAFB" stroke-width="3"/><path d="M745 1010 H815 L800 965 H760 Z" fill="rgba(46,204,113,.15)" stroke="${G}" stroke-width="3"/><path d="M755 1250 H805" stroke="#F9FAFB" stroke-width="4" stroke-linecap="round"/>`, 780, 1250],
    [`<rect x="850" y="1200" width="56" height="60" rx="8" fill="${C.bg}" stroke="#F9FAFB" stroke-width="2.5"/><path d="M878 1200 C860 1160 850 1130 870 1100 C880 1130 878 1160 878 1200 C882 1150 895 1120 912 1105 C915 1140 900 1170 878 1200" fill="rgba(46,204,113,.18)" stroke="${G}" stroke-width="2.5"/>`, 878, 1260],
    [`<rect x="270" y="780" width="250" height="160" rx="6" fill="rgba(46,204,113,.05)" stroke="#F9FAFB" stroke-opacity=".8" stroke-width="2.5"/><path d="M290 920 L360 850 L410 895 L445 865 L500 920 Z" fill="rgba(46,204,113,.2)" stroke="${G}" stroke-width="2"/>`, 395, 860],
  ];
  const furn = s.querySelector('#furn'); F.forEach(f => { f.g = sv('g', {}, furn); f.g.innerHTML = f[0]; });
  const cpR = s.querySelector('#cpR'), slider = s.querySelector('#slider');
  const cB = el('div', 'chip', root, CFG.s6.before), cA = el('div', 'chip', root, CFG.s6.after);
  return {
    update(lt) {
      reveal(lb, lt, .05);
      const p = spr(win(lt, 0, .8)); place(cd, 0, (1 - p) * 50, clamp(p * 1.4)); s.style.opacity = clamp(p * 1.4);
      F.forEach((f, i) => { const q = pop(win(lt, .35 + i * .17, .45)); f.g.setAttribute('transform', `translate(${f[1]} ${f[2]}) scale(${Math.max(.001, .6 + .4 * q)}) translate(${-f[1]} ${-f[2]})`); f.g.setAttribute('opacity', clamp(q * 2)); });
      const sx = lerp(90, 540, eio(win(lt, 1.65, 1.0)));
      cpR.setAttribute('x', sx); cpR.setAttribute('width', 990 - sx);
      const sa = win(lt, 1.5, .3); slider.setAttribute('transform', `translate(${sx} 0)`); slider.setAttribute('opacity', sa);
      const ca = win(lt, 1.9, .4); place(cB, 150, 650, ca); place(cA, 820, 650, ca);
    }
  };
});

// =========== 7. Randări video 3D ===========
scene(6, root => {
  const lb = label(root, CFG.s7.label, 420);
  const cd = card(root, 90, 700, 900, 506, 32);
  const s = svgBox(root, 90, 700, 900, 506);
  s.innerHTML = `<defs><clipPath id="vclip"><rect width="900" height="506" rx="32"/></clipPath></defs><g clip-path="url(#vclip)"><g id="fly"></g>
   <rect x="40" y="460" width="820" height="5" rx="2.5" fill="rgba(249,250,251,.15)"/><rect id="bar" x="40" y="460" width="0" height="5" rx="2.5" fill="url(#gAccH)"/></g>
   <g id="play"><circle cx="450" cy="253" r="70" fill="rgba(17,24,33,.75)" stroke="rgba(249,250,251,.35)" stroke-width="2"/><path d="M430 218 L485 253 L430 288 Z" fill="#F9FAFB"/></g>`;
  const fly = s.querySelector('#fly'), bar = s.querySelector('#bar'), play = s.querySelector('#play');
  const pr = (x, y, z, cz, px) => { const d = Math.max(.3, z - cz), f = 330 / d; return [450 + (x - px) * f, 230 + y * f]; };
  return {
    update(lt) {
      reveal(lb, lt, .05);
      const p = spr(win(lt, 0, .7)); place(cd, 0, (1 - p) * 40, clamp(p * 1.4)); s.style.opacity = clamp(p * 1.4);
      const m = eio(win(lt, .3, 1.6)), cz = -2 + 4.2 * m, px = Math.sin(m * 2) * .6;
      const L = (a, b, o = .9, w = 2.5, c = G) => { const A2 = pr(...a, cz, px), B = pr(...b, cz, px); return `<line x1="${A2[0]}" y1="${A2[1]}" x2="${B[0]}" y2="${B[1]}" stroke="${c}" stroke-opacity="${o}" stroke-width="${w}"/>`; };
      let h = ''; const X = 3, Y = 1.5, Z = 10;
      [[-X, -Y], [X, -Y], [X, Y], [-X, Y]].forEach(([x, y]) => h += L([x, y, 0], [x, y, Z]));
      [2, 4, 6, 8].forEach(z => { h += L([-X, Y, z], [X, Y, z], .25, 1.5); h += L([-X, -Y, z], [X, -Y, z], .12, 1.5); });
      [-2, -1, 0, 1, 2].forEach(x => h += L([x, Y, 0], [x, Y, Z], .18, 1.5));
      const bw = [[-X, -Y, Z], [X, -Y, Z], [X, Y, Z], [-X, Y, Z]].map(q => pr(...q, cz, px));
      h += `<polygon points="${pstr(bw)}" fill="rgba(46,204,113,.06)" stroke="${G}" stroke-width="2.5"/>`;
      const door = [[.6, -.3, Z], [1.6, -.3, Z], [1.6, Y, Z], [.6, Y, Z]].map(q => pr(...q, cz, px)); h += `<polygon points="${pstr(door)}" fill="none" stroke="#F9FAFB" stroke-opacity=".7" stroke-width="2"/>`;
      const wnd = [[-X, -.7, 4], [-X, -.7, 6.5], [-X, .5, 6.5], [-X, .5, 4]].map(q => pr(...q, cz, px)); h += `<polygon points="${pstr(wnd)}" fill="rgba(249,250,251,.06)" stroke="#F9FAFB" stroke-opacity=".7" stroke-width="2"/>`;
      const sofa = [[-1.6, .9, 7.5], [.4, .9, 7.5], [.4, Y, 7.5], [-1.6, Y, 7.5]].map(q => pr(...q, cz, px)); h += `<polygon points="${pstr(sofa)}" fill="rgba(46,204,113,.15)" stroke="${G}" stroke-width="2.5"/>`;
      fly.innerHTML = h;
      bar.setAttribute('width', 820 * clamp((lt - .3) / 1.5));
      const pp = win(lt, .2, .35); play.setAttribute('opacity', 1 - pp); play.setAttribute('transform', `translate(450 253) scale(${1 - .25 * eo(pp)}) translate(-450 -253)`);
    }
  };
});

// =========== 8. Cameră foto smart ===========
scene(7, root => {
  const lb = label(root, CFG.s8.label, 400);
  const cd = card(root, 170, 600, 740, 770, 44); cd.style.background = 'rgba(8,11,15,.85)';
  const s = svgBox(root, 170, 600, 740, 770);
  s.innerHTML = `<defs><clipPath id="vf"><rect width="740" height="770" rx="44"/></clipPath>
    <radialGradient id="sun" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#F9FAFB" stop-opacity=".55"/><stop offset="1" stop-color="#F9FAFB" stop-opacity="0"/></radialGradient></defs>
   <g clip-path="url(#vf)"><g id="photo">
     <rect width="740" height="770" fill="#0f151c"/>
     <rect x="0" y="560" width="740" height="210" fill="rgba(46,204,113,.07)"/>
     <rect x="420" y="170" width="220" height="250" rx="6" fill="rgba(249,250,251,.10)" stroke="#F9FAFB" stroke-opacity=".6" stroke-width="3"/><line x1="530" y1="170" x2="530" y2="420" stroke="#F9FAFB" stroke-opacity=".6" stroke-width="3"/>
     <circle id="sunC" cx="530" cy="290" r="260" fill="url(#sun)"/>
     <path d="M90 600 V540 a28 28 0 0 1 28 -28 H380 a28 28 0 0 1 28 28 V600" fill="rgba(46,204,113,.12)" stroke="${G}" stroke-width="3.5"/><rect x="66" y="600" width="366" height="80" rx="24" fill="rgba(46,204,113,.18)" stroke="${G}" stroke-width="3.5"/>
     <rect x="560" y="560" width="70" height="80" rx="10" fill="none" stroke="#F9FAFB" stroke-opacity=".6" stroke-width="3"/><path d="M595 560 C575 515 565 480 590 450 C600 485 597 520 595 560 C600 505 615 475 640 462 C640 505 620 535 595 560" fill="rgba(46,204,113,.2)" stroke="${G}" stroke-width="2.5"/>
     <rect x="140" y="160" width="200" height="140" rx="4" fill="none" stroke="#F9FAFB" stroke-opacity=".5" stroke-width="2.5"/></g>
     <rect id="dim" width="740" height="770" fill="#000"/>
     <g stroke="rgba(249,250,251,.28)" stroke-width="1.5"><line x1="247" y1="0" x2="247" y2="770"/><line x1="493" y1="0" x2="493" y2="770"/><line x1="0" y1="257" x2="740" y2="257"/><line x1="0" y1="513" x2="740" y2="513"/></g>
     <rect id="flash" width="740" height="770" fill="#F9FAFB" opacity="0"/></g>
   <g stroke="#F9FAFB" stroke-width="5" fill="none" stroke-linecap="round"><path d="M36 96V36h60"/><path d="M644 36h60v60"/><path d="M704 674v60h-60"/><path d="M96 734H36v-60"/></g>
   <rect id="focus" fill="none" stroke="#F9FAFB" stroke-width="3"/>
   <g id="level"><line x1="300" y1="410" x2="345" y2="410" stroke-width="4" stroke-linecap="round"/><line x1="395" y1="410" x2="440" y2="410" stroke-width="4" stroke-linecap="round"/></g>`;
  const q = id => s.querySelector('#' + id); const dim = q('dim'), flash = q('flash'), focus = q('focus'), level = q('level'), photo = q('photo');
  return {
    update(lt) {
      reveal(lb, lt, .05);
      const p = spr(win(lt, 0, .8)); place(cd, 0, (1 - p) * 50, clamp(p * 1.4)); s.style.opacity = clamp(p * 1.4);
      const lev = 1 - eio(win(lt, .35, .7)); const ang = 5 * lev;
      photo.setAttribute('transform', `rotate(${ang} 370 410) scale(1.06) translate(-21 -24)`);
      level.setAttribute('transform', `rotate(${-ang} 370 410)`); level.setAttribute('stroke', lev < .03 ? G : '#F9FAFB');
      const f = eo(win(lt, .7, .45)), fs = lerp(200, 130, f);
      focus.setAttribute('x', 370 - fs / 2); focus.setAttribute('y', 410 - fs / 2); focus.setAttribute('width', fs); focus.setAttribute('height', fs); focus.setAttribute('stroke', f > .97 ? G : '#F9FAFB');
      const FL = 1.35, fl = lt > FL ? Math.exp(-(lt - FL) * 7) * clamp((lt - FL) / .03) : 0;
      flash.setAttribute('opacity', .85 * fl);
      dim.setAttribute('opacity', lt < FL ? .5 : .5 * (1 - eio(win(lt, FL, .5))));
    }
  };
});

// =========== 9. Și multe altele. ===========
const PILL_ICONS = [
  'M12 7v5l3 2 M3.5 12a8.5 8.5 0 1 0 2.5-6 M3 4v4h4',
  'M7 3h7l4 4v14H7z M14 3v4h4 M10 12h5 M10 16h5',
  'M12 3l2 6.5L20.5 12 14 14.5 12 21l-2-6.5L3.5 12 10 9.5z',
  'M5 11V8a7 7 0 0 1 14 0v3 M4 11h16v10H4z M12 15v2',
];
scene(8, root => {
  const pills = CFG.s9.pills.map((txt, i) => { const d = el('div', 'pill', root, `<svg viewBox="0 0 24 24"><path d="${PILL_ICONS[i]}"/></svg><span>${txt}</span>`); return d; });
  return {
    update(lt, a, t) {
      const conv = eio(win(t, SC_END[8] - .05, .55));      // converge to centre as scene 10 begins
      pills.forEach((d, i) => {
        const p = spr(win(lt, i * .16, .6)); const w = d.offsetWidth, y0 = 720 + i * 150;
        const x = 540 - w / 2, y = lerp(y0 + (1 - p) * 90, 860, conv);
        place(d, x, y, clamp(p * 1.5) * (1 - conv), lerp(1, .4, conv), conv * 6);
      });
    }
  };
});

// =========== 10. VerifiCasa. În curând. + final ===========
scene(9, root => {
  const s = svgBox(root, 0, 0, W, H); const rays = sv('g', {}, s);
  const logo = Logo(root, 620, 540, 820);
  const acc = textAt(root, CFG.s10.accent, 1135, 'serif acc big');
  const url = textAt(root, CFG.s10.url, 1305, 'url');
  const st = textAt(root, CFG.s10.stores, 1385, 'stores'); fit(st);
  const FINAL = AUDIO_END + .05 - SC_START[9];
  return {
    update(lt) {
      const c = eio(win(lt, 0, .7));
      let h = ''; for (let i = 0; i < 18; i++) { const an = i / 18 * Math.PI * 2, r0 = lerp(760, 120, c), r1 = lerp(900, 160, c);
        h += `<line x1="${540 + Math.cos(an) * r0}" y1="${820 + Math.sin(an) * r0}" x2="${540 + Math.cos(an) * r1}" y2="${820 + Math.sin(an) * r1}" stroke="${G}" stroke-width="2" stroke-opacity="${.5 * (1 - win(lt, .5, .4))}"/>`; }
      rays.innerHTML = h;
      logo.set(win(lt, .3, .45), win(lt, .62, .6), win(lt, 1.12, .45), .4 + .6 * eio(win(lt, 1.0, .8)) * (.9 + .1 * Math.sin(lt * 2.4)));
      reveal(acc, lt, .75);
      reveal(url, lt, FINAL); reveal(st, lt, FINAL + .25);
    }
  };
});
