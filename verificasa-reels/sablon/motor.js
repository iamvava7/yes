// Motorul de randare. Fiecare scenă are un gsap.timeline({ paused: true }) construit o singură dată;
// render(t) alege scena și face tl.time(t), deci fiecare cadru e determinist (fără ceas, fără requestAnimationFrame).
(function () {
  const T = window.Tranzitii;
  const { clamp } = T;

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
  const CULORI = { verde: '#22c55e', galben: '#facc15', rosu: '#ef4444', alb: '#f8fafc', gri: '#cbd5e1' };

  // Easing-ul implicit pentru fiecare intrare; un element îl poate suprascrie cu "ease" (validat în valideaza.js).
  const EASE = {
    slam: 'back.out(2.2)',
    sus: 'power3.out',
    cuvinte: 'power3.out',
    litere: 'power2.out',
    contor: 'expo.out',
    marcaj: 'power2.inOut',
    bara: 'elastic.out(1, 0.75)',
  };

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

  // ---------- elemente: fiecare adaugă tween-uri în timeline-ul scenei ----------

  function text(def, strat, tl) {
    const box = el('div', `text c-${def.culoare || 'alb'}`, strat);
    box.dataset.text = def.text;
    if (def.rol) box.dataset.rol = def.rol;
    Object.assign(box.style, { top: def.y + 'px', fontSize: def.marime + 'px', fontWeight: def.greutate || 700 });
    if (def.x != null) box.style.left = (def.x - 480) + 'px';
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

    // Caseta se măsoară acum, înainte ca fromTo să aplice starea inițială (scale, y) pe element.
    const cutie = caseta(bucati);
    const ease = def.ease || EASE[def.intrare];
    if (def.intrare === 'slam') {
      tl.fromTo(box, { autoAlpha: 0, scale: 1.9, filter: 'blur(10px)' },
        { autoAlpha: 1, scale: 1, filter: 'blur(0px)', duration: 0.32, ease }, def.t);
    } else if (def.intrare === 'sus') {
      tl.fromTo(box, { autoAlpha: 0, y: 70 }, { autoAlpha: 1, y: 0, duration: 0.4, ease }, def.t);
    } else {
      const litere = def.intrare === 'litere';
      tl.fromTo(box, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.01 }, def.t);
      tl.fromTo(bucati, { autoAlpha: 0, y: litere ? 28 : 60, scale: 0.9 },
        { autoAlpha: 1, y: 0, scale: 1, duration: litere ? 0.22 : 0.34, ease, stagger: litere ? 0.03 : 0.09 }, def.t);
    }
    return { def, tinta: () => cutie };
  }

  function contor(def, strat, tl) {
    const box = el('div', `text cifre c-${def.culoare || 'alb'}`, strat);
    Object.assign(box.style, { top: def.y + 'px', fontSize: def.marime + 'px', fontWeight: 900 });
    const format = (v) => `${def.prefix || ''}${v}${def.sufix || ''}`;
    box.dataset.text = format(def.la);
    const span = el('span', 'bucata', box);
    span.textContent = format(def.la);
    const cutie = caseta([span]);
    const dur = def.durata_anim ?? 1.2;
    const val = { v: def.de };
    tl.fromTo(box, { autoAlpha: 0, scale: 0.85 }, { autoAlpha: 1, scale: 1, duration: 0.3, ease: 'power3.out' }, def.t);
    tl.fromTo(val, { v: def.de }, {
      v: def.la, duration: dur, ease: def.ease || EASE.contor,
      onUpdate: () => { span.textContent = format(Math.round(val.v)); },
    }, def.t);
    // „pop” când cifra se oprește: marchează momentul-cheie
    tl.to(box, { scale: 1.08, duration: 0.12, ease: 'power2.out', yoyo: true, repeat: 1 }, def.t + dur);
    return { def, tinta: () => cutie };
  }

  function marcaj(def, strat, tl, elemente) {
    const tinta = elemente[def.tinta];
    const svg = svgEl('svg', { class: 'marcaj', width: 1080, height: 1920, viewBox: '0 0 1080 1920' }, strat);
    Object.assign(svg.style, { left: '0', top: '0' });
    return {
      def,
      // Forma se calculează după încărcarea fonturilor, din caseta reală a țintei.
      masoara() {
        const r = tinta.tinta();
        const culoare = CULORI[def.culoare] || CULORI.verde;
        let forma;
        if (def.forma === 'cerc') {
          const cx = (r.l + r.r) / 2, cy = (r.t + r.b) / 2;
          forma = svgEl('ellipse', { cx, cy, rx: (r.r - r.l) / 2 + 50, ry: (r.b - r.t) / 2 + 42,
            stroke: culoare, 'stroke-width': 10, pathLength: 1, 'stroke-dasharray': 1,
            transform: `rotate(-4 ${cx} ${cy})` }, svg);
        } else {
          const y = r.b + 8;
          forma = svgEl('path', { d: `M ${r.l - 10} ${y} Q ${(r.l + r.r) / 2} ${y + 16} ${r.r + 10} ${y - 4}`,
            stroke: culoare, 'stroke-width': 12, pathLength: 1, 'stroke-dasharray': 1 }, svg);
        }
        tl.fromTo(forma, { attr: { 'stroke-dashoffset': 1 }, autoAlpha: 0 },
          { attr: { 'stroke-dashoffset': 0 }, autoAlpha: 1, duration: 0.45, ease: def.ease || EASE.marcaj }, def.t);
      },
    };
  }

  function bare(def, strat, tl) {
    const zona = el('div', '', strat);
    Object.assign(zona.style, { position: 'absolute', left: '60px', top: def.y + 'px', width: '960px', height: def.inaltime + 'px' });
    const max = Math.max(...def.bare.map((b) => b.valoare));
    const latime = 200, etichetaH = 100;
    const centre = def.bare.map((_, i) => 200 + i * 240);
    const hUtil = def.inaltime - etichetaH;
    const items = def.bare.map((b, i) => {
      const bar = el('div', `bara ${b.culoare || 'gri'}`, zona);
      const h = hUtil * (b.valoare / max);
      Object.assign(bar.style, { left: centre[i] - latime / 2 + 'px', width: latime + 'px', height: h + 'px', bottom: etichetaH + 'px', transformOrigin: '50% 100%' });
      const et = el('div', 'text c-gri', zona);
      et.dataset.text = b.eticheta;
      Object.assign(et.style, { left: centre[i] - 150 + 'px', width: '300px', top: hUtil + 22 + 'px', fontSize: '52px', fontWeight: 700 });
      el('span', 'bucata', et).textContent = b.eticheta;
      // scaleY, nu height: animăm doar transformări
      tl.fromTo(bar, { autoAlpha: 0, scaleY: 0 }, { autoAlpha: 1, scaleY: 1, duration: 0.9, ease: b.ease || EASE.bara }, b.t);
      tl.fromTo(et, { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.3, ease: 'power3.out' }, b.t);
      return { h, x: centre[i] };
    });
    // Diferența: linie punctată la nivelul primei bare + paranteză galbenă care măsoară scăderea.
    if (def.diferenta && items.length >= 2) {
      const [a, b] = items;
      const svg = svgEl('svg', { width: 960, height: def.inaltime, viewBox: `0 0 960 ${def.inaltime}` }, zona);
      Object.assign(svg.style, { position: 'absolute', left: 0, top: 0, overflow: 'visible' });
      const yA = hUtil - a.h, yB = hUtil - b.h;
      const xB = b.x + latime / 2 + 34;
      const linie = svgEl('path', { d: `M ${a.x - latime / 2} ${yA} H ${xB}`, stroke: CULORI.alb, 'stroke-width': 4,
        'stroke-dasharray': '14 12', fill: 'none', opacity: 0.7 }, svg);
      const paranteza = svgEl('path', { d: `M ${xB - 16} ${yA} H ${xB} V ${yB} H ${xB - 16}`, stroke: CULORI.galben,
        'stroke-width': 8, fill: 'none', 'stroke-linejoin': 'round', pathLength: 1, 'stroke-dasharray': 1 }, svg);
      const t = def.diferenta.t;
      tl.fromTo(linie, { autoAlpha: 0, clipPath: 'inset(0 100% 0 0)' }, { autoAlpha: 1, clipPath: 'inset(0 0% 0 0)', duration: 0.5, ease: 'power2.out' }, t);
      tl.fromTo(paranteza, { autoAlpha: 0, attr: { 'stroke-dashoffset': 1 } }, { autoAlpha: 1, attr: { 'stroke-dashoffset': 0 }, duration: 0.45, ease: 'power2.inOut' }, t + 0.25);
    }
    return { def };
  }

  function lista(def, strat, tl) {
    const texte = [];
    const items = def.puncte.map((p, i) => {
      const y = def.y + i * def.marime * 1.7;
      const dot = el('div', 'punct-lista', strat);
      Object.assign(dot.style, { left: '150px', top: y + def.marime * 0.32 + 'px' });
      const tx = el('div', 'text c-alb', strat);
      tx.dataset.text = p.text;
      Object.assign(tx.style, { left: '220px', width: '760px', textAlign: 'left', top: y + 'px', fontSize: def.marime + 'px', fontWeight: 700 });
      el('span', 'bucata', tx).textContent = p.text;
      texte.push(tx.firstChild);
      // Cercurile goale apar odată cu lista și se umplu când e spus punctul: arată progresul, nu decorează.
      tl.fromTo(dot, { autoAlpha: 0 }, { autoAlpha: 0.35, duration: 0.2 }, def.t);
      tl.fromTo(dot, { backgroundColor: 'rgba(34,197,94,0)', scale: 1 },
        { backgroundColor: 'rgba(34,197,94,1)', autoAlpha: 1, scale: 1.5, duration: 0.12, ease: 'power2.out', immediateRender: false }, p.t);
      tl.to(dot, { scale: 1, duration: 0.2, ease: 'power2.in' }, p.t + 0.12);
      return { p, dot, tx };
    });
    const cutie = caseta(texte);
    for (const { p, tx } of items) tl.fromTo(tx, { autoAlpha: 0, x: -50 }, { autoAlpha: 1, x: 0, duration: 0.32, ease: 'power3.out' }, p.t);
    return { def, tinta: () => cutie };
  }

  function punct(def, strat, tl, durata) {
    const d = el('div', 'punct-lumina', strat);
    Object.assign(d.style, { left: '417px', top: def.y - 13 + 'px' });
    const rest = durata - def.t;
    tl.fromTo(d, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 }, def.t);
    tl.fromTo(d, { x: 0 }, { x: 220, duration: rest, ease: 'none' }, def.t);
    tl.fromTo(d, { scale: 1 }, { scale: 1.35, duration: 0.5, ease: 'sine.inOut', yoyo: true, repeat: Math.max(1, Math.floor(rest / 0.5) - 1) }, def.t);
    return { def };
  }

  // Logo: fișierul oficial (media/brand/logo.svg, injectat de randare) dacă există, altfel doar wordmark tipografic.
  function logo(def, strat, tl) {
    const box = el('div', 'logo', strat);
    box.style.top = def.y + 'px';
    if (window.__LOGO) {
      const img = el('img', '', box);
      img.src = window.__LOGO;
      img.style.height = (def.inaltime || 120) + 'px';
    } else {
      const nume = el('div', 'nume', box);
      nume.innerHTML = 'Verifi<b>Casa</b>';
      nume.dataset.text = 'VerifiCasa';
    }
    tl.fromTo(box, { autoAlpha: 0, scale: 0.8 }, { autoAlpha: 1, scale: 1, duration: 0.4, ease: 'back.out(1.7)' }, def.t);
    return { def };
  }

  const FABRICI = { text, contor, marcaj, bare, lista, punct, logo };

  // ---------- scenă ----------

  const stare = { scene: [], total: 0 };

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
      const tl = gsap.timeline({ paused: true });
      const elemente = [];
      for (const def of sc.elemente) {
        const f = FABRICI[def.tip];
        if (!f) throw new Error(`Tip de element necunoscut: ${def.tip}`);
        elemente.push(f(def, strat, tl, def.tip === 'marcaj' ? elemente : sc.durata));
      }
      scene.push({ sc, wrap, fundal, strat, elemente, tl, start, slam: sc.elemente.filter((e) => e.intrare === 'slam').map((e) => e.t) });
      start += sc.durata;
    }
    // Formele marcajelor se construiesc din casetele măsurate la crearea elementelor (fonturi încărcate, fără transformări).
    for (const s of scene) for (const e of s.elemente) if (e.masoara) e.masoara();
    for (const s of scene) s.tl.set({}, {}, s.sc.durata); // timeline-ul acoperă toată scena
    stare.scene = scene;
    stare.total = start;
    render(0);
  }

  const easeCam = gsap.parseEase('power3.out');
  const easeRevenire = gsap.parseEase('expo.out');

  function render(t) {
    const { scene } = stare;
    let idx = scene.findIndex((s) => t >= s.start && t < s.start + s.sc.durata);
    if (idx < 0) idx = scene.length - 1;
    scene.forEach((s, i) => { s.wrap.style.display = i === idx ? 'block' : 'none'; });
    const s = scene[idx];
    const u = t - s.start;
    const sr = s.sc.speed_ramp;
    const a = T.warp(u, sr);

    // Fundal în mișcare continuă, lent, ca să nu concureze cu textul.
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
      if (u >= sr.de && u < sr.la) zoom *= 1 + 0.12 * easeCam((u - sr.de) / d);
      else if (u >= sr.la) zoom *= 1 + 0.12 * (1 - easeRevenire(clamp((u - sr.la) / 0.35)));
      blur += 7 * T.faza_rapida(u, sr);
    }
    let sx = 0, sy = 0;
    for (const ts of s.slam) {
      const k = a - ts;
      if (k >= 0 && k < 0.28) {
        const amp = 16 * (1 - k / 0.28);
        sx += amp * Math.sin(k * 95);
        sy += amp * Math.cos(k * 77);
      }
    }
    gsap.set(s.strat, { x: tr.x + sx, y: sy, scale: tr.scale * zoom, opacity: tr.opacity, filter: blur > 0.2 ? `blur(${blur.toFixed(2)}px)` : 'none' });

    s.tl.time(a, false);
  }

  window.Motor = { construieste };
  window.render = render;
})();
