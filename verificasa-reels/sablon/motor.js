// Motorul de randare: construiește DOM-ul o singură dată, apoi render(t) setează starea fiecărui element
// strict în funcție de timp (fără animații CSS), ca fiecare cadru să fie determinist.
(function () {
  const T = window.Tranzitii;
  const { clamp, lerp, ease, prog } = T;

  const el = (tag, cls, parent) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (parent) parent.appendChild(n);
    return n;
  };
  const SVG = 'http://www.w3.org/2000/svg';
  const svgEl = (tag, attrs, parent) => {
    const n = document.createElementNS(SVG, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  };
  const CULORI = { verde: '#22c55e', galben: '#facc15', rosu: '#ef4444', alb: '#f8fafc' };

  // Caseta reală a textului (unirea bucăților inline), în coordonatele scenei.
  function caseta(nodes) {
    let r = null;
    for (const n of nodes) {
      for (const b of n.getClientRects()) {
        if (!b.width) continue;
        r = r ? { l: Math.min(r.l, b.left), t: Math.min(r.t, b.top), r: Math.max(r.r, b.right), b: Math.max(r.b, b.bottom) }
              : { l: b.left, t: b.top, r: b.right, b: b.bottom };
      }
    }
    return r;
  }

  // ---------- elemente ----------

  function textNou(def, strat, peGalben) {
    const box = el('div', `text c-${def.culoare || 'alb'}`, strat);
    box.dataset.text = def.text;
    if (def.rol) box.dataset.rol = def.rol;
    box.style.top = def.y + 'px';
    box.style.fontSize = def.marime + 'px';
    box.style.fontWeight = def.greutate || 700;
    if (def.x != null) { box.style.left = (def.x - 480) + 'px'; }
    const accent = new Set((def.accent || []).map((w) => w.toLowerCase()));
    const bucati = [];
    const cuvinte = def.text.split(' ');
    cuvinte.forEach((w, i) => {
      const cuv = el('span', 'rand', box);
      if (accent.has(w.toLowerCase().replace(/[?.,!]/g, ''))) cuv.classList.add('accent');
      if (def.intrare === 'litere') {
        for (const ch of w) { const s = el('span', 'bucata', cuv); s.textContent = ch; bucati.push(s); }
      } else {
        const s = el('span', 'bucata', cuv); s.textContent = w; bucati.push(s);
      }
      if (i < cuvinte.length - 1) box.appendChild(document.createTextNode(' '));
    });
    return {
      def, nod: box, tinta: () => caseta(bucati),
      update(a) {
        const s = a - def.t;
        if (s < 0) { box.style.visibility = 'hidden'; return; }
        box.style.visibility = 'visible';
        if (def.intrare === 'slam') {
          const p = clamp(s / 0.2);
          const sc = s < 0.2 ? lerp(1.9, 0.96, ease.outCubic(p)) : lerp(0.96, 1, prog(s, 0.2, 0.12));
          box.style.transform = `scale(${sc})`;
          box.style.opacity = clamp(s / 0.06);
          box.style.filter = s < 0.12 ? `blur(${lerp(8, 0, s / 0.12)}px)` : 'none';
        } else if (def.intrare === 'sus') {
          const p = prog(s, 0, 0.38);
          box.style.transform = `translateY(${lerp(70, 0, p)}px)`;
          box.style.opacity = p;
        } else {
          const pas = def.intrare === 'litere' ? 0.03 : 0.09;
          const dur = def.intrare === 'litere' ? 0.2 : 0.3;
          bucati.forEach((b, k) => {
            const sk = s - k * pas;
            const p = prog(sk, 0, dur);
            b.style.opacity = clamp(sk / (dur * 0.6));
            b.style.transform = `translateY(${lerp(def.intrare === 'litere' ? 28 : 60, 0, p)}px) scale(${lerp(0.9, 1, p)})`;
          });
        }
      },
    };
  }

  function contorNou(def, strat) {
    const box = el('div', `text cifre c-${def.culoare || 'alb'}`, strat);
    box.style.top = def.y + 'px';
    box.style.fontSize = def.marime + 'px';
    box.style.fontWeight = 900;
    const final = `${def.prefix || ''}${def.la}${def.sufix || ''}`;
    box.dataset.text = final;
    const span = el('span', 'bucata', box);
    span.textContent = final;
    const dur = def.durata_anim ?? 1.2;
    return {
      def, nod: box, tinta: () => caseta([span]),
      update(a) {
        const s = a - def.t;
        if (s < 0) { box.style.visibility = 'hidden'; return; }
        box.style.visibility = 'visible';
        const p = prog(s, 0, dur, ease.outExpo);
        const v = Math.round(lerp(def.de, def.la, p));
        span.textContent = `${def.prefix || ''}${v}${def.sufix || ''}`;
        const pop = s > dur ? 1 + 0.08 * Math.max(0, 1 - (s - dur) / 0.25) : lerp(0.85, 1, prog(s, 0, 0.3));
        box.style.transform = `scale(${pop})`;
        box.style.opacity = clamp(s / 0.1);
      },
    };
  }

  function marcajNou(def, strat, elemente) {
    const tinta = elemente[def.tinta];
    const svg = svgEl('svg', { class: 'marcaj', width: 1080, height: 1920, viewBox: '0 0 1080 1920' }, strat);
    svg.style.left = '0'; svg.style.top = '0';
    let forma = null;
    return {
      def, nod: svg,
      masoara() {
        const r = tinta.tinta();
        const culoare = CULORI[def.culoare] || CULORI.verde;
        if (def.forma === 'cerc') {
          const cx = (r.l + r.r) / 2, cy = (r.t + r.b) / 2;
          forma = svgEl('ellipse', { cx, cy, rx: (r.r - r.l) / 2 + 46, ry: (r.b - r.t) / 2 + 30,
            stroke: culoare, 'stroke-width': 10, pathLength: 1, 'stroke-dasharray': 1,
            transform: `rotate(-4 ${cx} ${cy})` }, svg);
        } else {
          const y = r.b + 8;
          forma = svgEl('path', { d: `M ${r.l - 10} ${y} Q ${(r.l + r.r) / 2} ${y + 16} ${r.r + 10} ${y - 4}`,
            stroke: culoare, 'stroke-width': 12, pathLength: 1, 'stroke-dasharray': 1 }, svg);
        }
      },
      update(a) {
        const s = a - def.t;
        svg.style.visibility = s < 0 ? 'hidden' : 'visible';
        if (forma) forma.setAttribute('stroke-dashoffset', 1 - prog(s, 0, 0.45, ease.inOutCubic));
      },
    };
  }

  function bareNou(def, strat) {
    const zona = el('div', '', strat);
    Object.assign(zona.style, { position: 'absolute', left: '60px', top: def.y + 'px', width: '960px', height: def.inaltime + 'px' });
    const max = Math.max(...def.bare.map((b) => b.valoare));
    const latime = 200, etichetaH = 100;
    const centre = def.bare.map((_, i) => 200 + i * 240);
    const items = def.bare.map((b, i) => {
      const bar = el('div', `bara ${b.culoare || 'gri'}`, zona);
      const hMax = (def.inaltime - etichetaH) * (b.valoare / max);
      Object.assign(bar.style, { left: centre[i] - latime / 2 + 'px', width: latime + 'px', bottom: etichetaH + 'px' });
      const et = el('div', 'text c-gri', zona);
      et.dataset.text = b.eticheta;
      Object.assign(et.style, { left: centre[i] - 150 + 'px', width: '300px', top: def.inaltime - etichetaH + 22 + 'px', fontSize: '52px', fontWeight: 700 });
      el('span', 'bucata', et).textContent = b.eticheta;
      return { b, bar, et, hMax };
    });
    return {
      def, nod: zona,
      update(a) {
        zona.style.visibility = a < def.t ? 'hidden' : 'visible';
        for (const it of items) {
          const s = a - it.b.t;
          const p = prog(s, 0, 0.8, ease.outExpo);
          it.bar.style.height = Math.max(0, it.hMax * p) + 'px';
          it.bar.style.opacity = s < 0 ? 0 : 1;
          it.et.style.opacity = clamp(s / 0.25);
          it.et.style.transform = `translateY(${lerp(30, 0, prog(s, 0, 0.3))}px)`;
        }
      },
    };
  }

  function listaNou(def, strat) {
    const items = def.puncte.map((p, i) => {
      const y = def.y + i * def.marime * 1.7;
      const dot = el('div', 'punct-lista', strat);
      Object.assign(dot.style, { left: '150px', top: y + def.marime * 0.32 + 'px' });
      const tx = el('div', 'text c-alb', strat);
      tx.dataset.text = p.text;
      Object.assign(tx.style, { left: '220px', width: '760px', textAlign: 'left', top: y + 'px', fontSize: def.marime + 'px', fontWeight: 700 });
      el('span', 'bucata', tx).textContent = p.text;
      return { p, dot, tx };
    });
    return {
      def, nod: null,
      tinta: () => caseta(items.map((i) => i.tx.firstChild)),
      update(a) {
        for (const it of items) {
          const s = a - it.p.t;
          const vizibil = a >= def.t;
          it.dot.style.visibility = vizibil ? 'visible' : 'hidden';
          const aprins = s >= 0;
          it.dot.style.background = aprins ? '#22c55e' : 'transparent';
          it.dot.style.transform = `scale(${aprins ? 1 + 0.5 * Math.max(0, 1 - s / 0.2) : 1})`;
          it.dot.style.opacity = vizibil ? (aprins ? 1 : 0.35) : 0;
          it.tx.style.visibility = aprins ? 'visible' : 'hidden';
          it.tx.style.opacity = clamp(s / 0.15);
          it.tx.style.transform = `translateX(${lerp(-50, 0, prog(s, 0, 0.3))}px)`;
        }
      },
    };
  }

  function punctNou(def, strat, durata) {
    const d = el('div', 'punct-lumina', strat);
    return {
      def, nod: d,
      update(a) {
        const s = a - def.t;
        d.style.visibility = s < 0 ? 'hidden' : 'visible';
        const x = lerp(430, 650, s / durata);
        d.style.left = x - 13 + 'px';
        d.style.top = def.y - 13 + 'px';
        d.style.opacity = clamp(s / 0.3) * (0.75 + 0.25 * Math.sin(s * 6));
      },
    };
  }

  function logoNou(def, strat) {
    const box = el('div', 'logo', strat);
    box.style.top = def.y + 'px';
    const svg = svgEl('svg', { width: 110, height: 110, viewBox: '0 0 100 100' }, box);
    svgEl('path', { d: 'M12 48 L50 16 L88 48 L88 88 L12 88 Z', fill: 'none', stroke: '#22c55e', 'stroke-width': 8, 'stroke-linejoin': 'round' }, svg);
    const bifa = svgEl('path', { d: 'M32 60 L45 73 L70 46', fill: 'none', stroke: '#f8fafc', 'stroke-width': 9, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', pathLength: 1, 'stroke-dasharray': 1 }, svg);
    const nume = el('div', 'nume', box);
    nume.innerHTML = 'Verifi<b>Casa</b>';
    nume.dataset.text = 'VerifiCasa';
    return {
      def, nod: box,
      update(a) {
        const s = a - def.t;
        box.style.visibility = s < 0 ? 'hidden' : 'visible';
        box.style.opacity = clamp(s / 0.2);
        box.style.transform = `scale(${lerp(0.8, 1, prog(s, 0, 0.35, ease.outBack))})`;
        bifa.setAttribute('stroke-dashoffset', 1 - prog(s, 0.2, 0.4));
      },
    };
  }

  // ---------- scenă ----------

  async function construieste(radacina, scenariu) {
    await Promise.all([500, 600, 700, 800, 900].map((w) => document.fonts.load(`${w} 100px "VC Display"`)));
    await document.fonts.ready;
    const scene = [];
    let start = 0;
    for (const sc of scenariu.scene) {
      const wrap = el('div', '', radacina);
      Object.assign(wrap.style, { position: 'absolute', inset: '0', overflow: 'hidden' });
      wrap.dataset.scena = sc.id;
      const fundal = el('div', `fundal ${sc.fundal || 'inchis'}`, wrap);
      const strat = el('div', 'strat' + (sc.fundal === 'galben' ? ' pe-galben' : ''), wrap);
      const elemente = [];
      for (const def of sc.elemente) {
        let e;
        if (def.tip === 'text') e = textNou(def, strat);
        else if (def.tip === 'contor') e = contorNou(def, strat);
        else if (def.tip === 'marcaj') e = marcajNou(def, strat, elemente);
        else if (def.tip === 'bare') e = bareNou(def, strat);
        else if (def.tip === 'lista') e = listaNou(def, strat);
        else if (def.tip === 'punct') e = punctNou(def, strat, sc.durata);
        else if (def.tip === 'logo') e = logoNou(def, strat);
        else throw new Error(`Tip de element necunoscut: ${def.tip}`);
        elemente.push(e);
      }
      scene.push({ sc, wrap, fundal, strat, elemente, start });
      start += sc.durata;
    }
    // Măsurăm marcajele după ce fonturile și layout-ul sunt gata, cu toate scenele vizibile și fără transformări.
    for (const s of scene) for (const e of s.elemente) if (e.masoara) e.masoara();
    stare.scene = scene;
    stare.total = start;
    render(0);
  }

  const stare = { scene: [], total: 0 };

  function render(t) {
    const { scene } = stare;
    let idx = scene.findIndex((s) => t >= s.start && t < s.start + s.sc.durata);
    if (idx < 0) idx = scene.length - 1;
    scene.forEach((s, i) => { s.wrap.style.display = i === idx ? 'block' : 'none'; });
    const s = scene[idx];
    const u = t - s.start;
    const sr = s.sc.speed_ramp;
    const a = T.warp(u, sr);

    // Fundal în mișcare continuă.
    s.fundal.style.setProperty('--gx', `${50 + 12 * Math.sin(t * 0.7)}%`);
    s.fundal.style.setProperty('--gy', `${35 + 6 * Math.cos(t * 0.5)}%`);
    s.fundal.style.setProperty('--grila', `${(t * 36) % 120}px`);
    s.fundal.style.setProperty('--dungi', `${t * 160}px`);

    // Cameră: tranziția de intrare, zoom lent continuu, tremur la „slam”, zoom în rampă.
    const tr = T.intrare_scena(s.sc.tranzitie, u);
    let zoom = 1 + 0.04 * (u / s.sc.durata);
    let blur = tr.blur;
    if (sr) {
      const d = sr.la - sr.de;
      if (u >= sr.de && u < sr.la) zoom *= 1 + 0.12 * ease.outCubic((u - sr.de) / d);
      else if (u >= sr.la) zoom *= 1 + 0.12 * (1 - prog(u, sr.la, 0.35, ease.outExpo));
      blur += 7 * T.faza_rapida(u, sr);
    }
    let sx = 0, sy = 0;
    for (const e of s.elemente) {
      if (e.def.intrare !== 'slam') continue;
      const k = a - e.def.t;
      if (k >= 0 && k < 0.28) {
        const amp = 16 * (1 - k / 0.28);
        sx += amp * Math.sin(k * 95);
        sy += amp * Math.cos(k * 77);
      }
    }
    s.strat.style.transform = `translate(${tr.x + sx}px, ${sy}px) scale(${tr.scale * zoom})`;
    s.strat.style.opacity = tr.opacity;
    s.strat.style.filter = blur > 0.2 ? `blur(${blur.toFixed(2)}px)` : 'none';

    for (const e of s.elemente) e.update(a);
  }

  window.Motor = { construieste };
  window.render = render;
})();
