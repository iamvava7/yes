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
  const CULORI = {
    verde: '#22c55e', galben: '#facc15', rosu: '#ef4444', alb: '#f8fafc', gri: '#cbd5e1', bleumarin: '#0b1b3a',
  };
  const culoareText = (c, peGalben) => (c === 'rosu' && peGalben ? '#a3161a' : CULORI[c || 'alb']);

  // Easing-ul implicit pentru fiecare intrare; un element îl poate suprascrie cu "ease" (validat în valideaza.js).
  const EASE = {
    slam: 'back.out(2.2)',
    sus: 'power3.out',
    cuvinte: 'power3.out',
    litere: 'power2.out',
    masca: 'expo.out',
    rotire: 'back.out(1.6)',
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

  // Casetele pe rânduri: bucățile grupate după poziția verticală (pentru highlight pe fiecare rând).
  function randuri(nodes) {
    const linii = [];
    for (const n of nodes) {
      for (const b of n.getClientRects()) {
        if (!b.width) continue;
        let l = linii.find((x) => Math.abs(x.t - b.top) < b.height * 0.5);
        if (!l) { l = { l: b.left, t: b.top, r: b.right, b: b.bottom }; linii.push(l); }
        l.l = Math.min(l.l, b.left); l.r = Math.max(l.r, b.right); l.b = Math.max(l.b, b.bottom);
      }
    }
    return linii.sort((a, b) => a.t - b.t);
  }

  // Pseudo-aleator determinist: același t dă mereu același rezultat (cadre reproductibile).
  const zgomot = (x) => { const s = Math.sin(x * 12.9898) * 43758.5453; return s - Math.floor(s); };

  // Undă de șoc la impact: un inel care se extinde din centrul textului.
  function unda(strat, tl, cutie, t, culoare) {
    const d = 260;
    const inel = el('div', 'unda', strat);
    Object.assign(inel.style, {
      left: (cutie.l + cutie.r) / 2 - d / 2 + 'px', top: (cutie.t + cutie.b) / 2 - d / 2 + 'px',
      width: d + 'px', height: d + 'px', borderColor: culoare,
    });
    // starea inițială e invizibilă, ca inelul să nu apară înainte de impact
    tl.fromTo(inel, { autoAlpha: 0, scale: 0.2 }, { autoAlpha: 0.75, duration: 0.01 }, t);
    tl.to(inel, { autoAlpha: 0, scale: 4, duration: 0.6, ease: 'expo.out' }, t + 0.01);
  }

  // ---------- elemente: fiecare adaugă tween-uri în timeline-ul scenei ----------

  function text(def, strat, tl, ctx) {
    const box = el('div', `text c-${def.culoare || 'alb'}`, strat);
    box.dataset.text = def.text;
    Object.assign(box.style, { top: def.y + 'px', fontSize: def.marime + 'px', fontWeight: def.greutate || 700 });
    if (def.x != null) box.style.left = (def.x - 480) + 'px';
    const accent = new Set((def.accent || []).map((w) => w.toLowerCase()));
    const bucati = [];
    const litere = [];
    const cuvinte = def.text.split(' ');
    const peLitere = def.intrare === 'litere' || def.intrare === 'masina';
    cuvinte.forEach((w, i) => {
      const cuv = el('span', 'rand', box);
      if (accent.has(w.toLowerCase().replace(/[?.,!]/g, ''))) cuv.classList.add('accent');
      if (peLitere) {
        for (const ch of w) { const s = el('span', 'bucata', cuv); s.textContent = ch; bucati.push(s); litere.push(s); }
      } else {
        const s = el('span', 'bucata', cuv); s.textContent = w; bucati.push(s);
      }
      if (i < cuvinte.length - 1) {
        if (def.intrare === 'masina') { const sp = el('span', 'bucata', box); sp.textContent = ' '; litere.push(sp); }
        else box.appendChild(document.createTextNode(' '));
      }
    });
    let cursor = null;
    if (def.intrare === 'masina') cursor = el('span', 'cursor', box);

    // Caseta se măsoară acum, înainte ca fromTo să aplice starea inițială (scale, y) pe element.
    const cutie = caseta(bucati);
    const linii = randuri(bucati.filter((b) => b.textContent.trim()));
    const ease = def.ease || EASE[def.intrare];
    switch (def.intrare) {
      case 'slam':
        tl.fromTo(box, { autoAlpha: 0, scale: 1.9, filter: 'blur(10px)' },
          { autoAlpha: 1, scale: 1, filter: 'blur(0px)', duration: 0.32, ease }, def.t);
        if (def.unda !== false) unda(strat, tl, cutie, def.t + 0.05, culoareText(def.culoare, ctx.peGalben));
        break;
      case 'sus':
        tl.fromTo(box, { autoAlpha: 0, y: 70 }, { autoAlpha: 1, y: 0, duration: 0.4, ease }, def.t);
        break;
      case 'masca':
        // dezvăluire prin mască: textul urcă dintr-o fantă invizibilă
        tl.fromTo(box, { autoAlpha: 1, clipPath: 'inset(0% 0% 100% 0%)', y: 60 },
          { clipPath: 'inset(0% 0% 0% 0%)', y: 0, duration: 0.6, ease }, def.t);
        break;
      case 'rotire':
        box.style.perspective = '900px';
        tl.fromTo(box, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.01 }, def.t);
        tl.fromTo(bucati, { autoAlpha: 0, rotationX: -95, y: 40, transformOrigin: '50% 100% -40px' },
          { autoAlpha: 1, rotationX: 0, y: 0, duration: 0.5, ease, stagger: 0.08 }, def.t);
        break;
      case 'masina': {
        // typewriter: câte o literă, cu cursor care clipește
        const cps = def.viteza || 22;
        tl.fromTo(box, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.01 }, def.t);
        litere.forEach((s, i) => tl.fromTo(s, { display: 'none' }, { display: 'inline-block', duration: 0.001 }, def.t + i / cps));
        const gata = def.t + litere.length / cps;
        tl.fromTo(cursor, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.001 }, gata + 0.08);
        for (let k = gata + 0.35; k < gata + 2; k += 0.5) {
          tl.set(cursor, { autoAlpha: 1 }, k);
          tl.set(cursor, { autoAlpha: 0 }, k + 0.25);
        }
        break;
      }
      default: { // cuvinte, litere
        tl.fromTo(box, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.01 }, def.t);
        tl.fromTo(bucati, { autoAlpha: 0, y: peLitere ? 28 : 60, scale: 0.9 },
          { autoAlpha: 1, y: 0, scale: 1, duration: peLitere ? 0.22 : 0.34, ease, stagger: peLitere ? 0.03 : 0.09 }, def.t);
      }
    }
    // Schimbări de culoare pe ritm (stil Matt Lou)
    for (const c of def.culori || []) {
      tl.to(box, { color: culoareText(c.culoare, ctx.peGalben), duration: 0.12, ease: 'none' }, c.t);
      tl.fromTo(box, { scale: 1 }, { scale: 1.06, duration: 0.1, yoyo: true, repeat: 1, ease: 'power2.out', immediateRender: false }, c.t);
    }
    const glitch = def.efect === 'glitch';
    return {
      def, nod: box, tinta: () => cutie, linii: () => linii,
      // Glitch: decalaj RGB și tăieturi orizontale, puternic la intrare și în scurte rafale după.
      tick(a) {
        if (!glitch) return;
        const s = a - def.t;
        const rafala = s >= 0 && (s < 0.5 || (s % 1.1) < 0.12);
        if (!rafala) { box.style.textShadow = 'none'; box.style.clipPath = ''; return; }
        const k = Math.floor(a * 24);
        const dx = (zgomot(k) - 0.5) * 22, dy = (zgomot(k + 7) - 0.5) * 6;
        box.style.textShadow = `${dx}px ${dy}px 0 rgba(0,229,255,0.85), ${-dx}px ${-dy}px 0 rgba(255,0,92,0.85)`;
        const y1 = Math.floor(zgomot(k + 3) * 80), h = 6 + Math.floor(zgomot(k + 5) * 18);
        box.style.clipPath = zgomot(k + 9) > 0.5 ? `polygon(0 0,100% 0,100% ${y1}%,0 ${y1}%,0 ${y1 + h}%,100% ${y1 + h}%,100% 100%,0 100%)` : '';
      },
    };
  }

  function contor(def, strat, tl, ctx) {
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
    // „pop” + undă când cifra se oprește: marchează momentul-cheie
    tl.to(box, { scale: 1.1, duration: 0.12, ease: 'power2.out', yoyo: true, repeat: 1 }, def.t + dur);
    unda(strat, tl, cutie, def.t + dur, CULORI[def.culoare] || CULORI.alb);
    for (const c of def.culori || []) tl.to(box, { color: culoareText(c.culoare, ctx.peGalben), duration: 0.12 }, c.t);
    return { def, nod: box, tinta: () => cutie };
  }

  function marcaj(def, strat, tl, ctx) {
    const tinta = ctx.elemente[def.tinta];
    const svg = svgEl('svg', { class: 'marcaj', width: 1080, height: 1920, viewBox: '0 0 1080 1920' }, null);
    // „fundal” (highlight de marker) stă în spatele textului; cercul și sublinierea deasupra
    if (def.forma === 'fundal') strat.insertBefore(svg, strat.firstChild); else strat.appendChild(svg);
    Object.assign(svg.style, { left: '0', top: '0' });
    const r = tinta.tinta();
    const culoare = CULORI[def.culoare] || CULORI.verde;
    let forma;
    if (def.forma === 'cerc') {
      const cx = (r.l + r.r) / 2, cy = (r.t + r.b) / 2;
      forma = svgEl('ellipse', { cx, cy, rx: (r.r - r.l) / 2 + 50, ry: (r.b - r.t) / 2 + 42,
        stroke: culoare, 'stroke-width': 10, pathLength: 1, 'stroke-dasharray': 1,
        transform: `rotate(-4 ${cx} ${cy})` }, svg);
      tl.fromTo(forma, { attr: { 'stroke-dashoffset': 1 }, autoAlpha: 0 },
        { attr: { 'stroke-dashoffset': 0 }, autoAlpha: 1, duration: 0.45, ease: def.ease || EASE.marcaj }, def.t);
    } else if (def.forma === 'fundal') {
      // câte o bandă de marker pe fiecare rând, trasă de la stânga la dreapta, rând după rând
      const pad = 18;
      const linii = tinta.linii ? tinta.linii() : [r];
      linii.forEach((ln, i) => {
        const banda = svgEl('rect', { x: ln.l - pad, y: ln.t + (ln.b - ln.t) * 0.1, width: ln.r - ln.l + 2 * pad,
          height: (ln.b - ln.t) * 0.84, rx: 10, fill: culoare, opacity: 0.92 }, svg);
        tl.fromTo(banda, { scaleX: 0, svgOrigin: `${ln.l - pad} ${ln.t}` }, { scaleX: 1, duration: 0.3, ease: 'power3.out' }, def.t + i * 0.12);
      });
      // textul de deasupra devine închis la culoare, ca să rămână lizibil pe marker
      if (tinta.nod) tl.to(tinta.nod, { color: CULORI.bleumarin, duration: 0.15 }, def.t + 0.12);
    } else {
      const y = r.b + 8;
      forma = svgEl('path', { d: `M ${r.l - 10} ${y} Q ${(r.l + r.r) / 2} ${y + 16} ${r.r + 10} ${y - 4}`,
        stroke: culoare, 'stroke-width': 12, pathLength: 1, 'stroke-dasharray': 1 }, svg);
      tl.fromTo(forma, { attr: { 'stroke-dashoffset': 1 }, autoAlpha: 0 },
        { attr: { 'stroke-dashoffset': 0 }, autoAlpha: 1, duration: 0.45, ease: def.ease || EASE.marcaj }, def.t);
    }
    return { def, nod: svg };
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
    return { def, nod: zona };
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
    return { def, tinta: () => cutie, noduri: items.flatMap((i) => [i.dot, i.tx]) };
  }

  // Diagramă orbitală (stil Pooya Taheri): un centru și noduri pe un inel care se rotește încet.
  // Fiecare nod poate primi un „X” roșu (blocat) la momentul lui.
  function orbita(def, strat, tl, ctx) {
    const R = def.raza || 260;
    const cx = 540, cy = def.y;
    const halou = el('div', 'orbita-halou', strat);
    Object.assign(halou.style, { left: cx - 170 + 'px', top: cy - 170 + 'px' });
    const zona = el('div', 'orbita', strat);
    Object.assign(zona.style, { left: cx - R + 'px', top: cy - R + 'px', width: 2 * R + 'px', height: 2 * R + 'px' });
    const inel = el('div', 'orbita-inel', zona);
    const rotor = el('div', 'orbita-rotor', zona);
    const centru = el('div', 'text orbita-centru c-alb', strat);
    centru.dataset.text = def.centru;
    Object.assign(centru.style, { top: cy - 42 + 'px', fontSize: '76px', fontWeight: 900 });
    el('span', 'bucata', centru).textContent = def.centru;

    tl.fromTo(inel, { autoAlpha: 0, scale: 0.4, rotation: -60 }, { autoAlpha: 1, scale: 1, rotation: 0, duration: 0.7, ease: 'expo.out' }, def.t);
    tl.fromTo([centru, halou], { autoAlpha: 0, scale: 0.6 }, { autoAlpha: 1, scale: 1, duration: 0.45, ease: 'back.out(2)' }, def.t);
    // rotație lentă și continuă a nodurilor; etichetele se contra-rotesc ca să rămână drepte
    const grade = def.rotatie ?? 20;
    const durRot = ctx.durata - def.t;
    tl.fromTo(rotor, { rotation: 0 }, { rotation: grade, duration: durRot, ease: 'none' }, def.t);

    const n = def.noduri.length;
    def.noduri.forEach((nd, i) => {
      const ung = (-90 + (360 / n) * i) * Math.PI / 180;
      const x = R + R * Math.cos(ung), y = R + R * Math.sin(ung);
      const nod = el('div', 'orbita-nod', rotor);
      Object.assign(nod.style, { left: x + 'px', top: y + 'px' });
      const contra = el('div', 'orbita-contra', nod);
      const punct = el('div', 'orbita-punct', contra);
      const et = el('div', 'orbita-eticheta', contra);
      et.dataset.text = nd.text;
      el('span', 'bucata', et).textContent = nd.text;
      // eticheta stă în afara inelului: deasupra nodurilor de sus, dedesubt pentru cele de jos
      et.style.top = (Math.sin(ung) > -0.2 ? 44 : -104) + 'px';
      tl.fromTo(nod, { autoAlpha: 0, scale: 0 }, { autoAlpha: 1, scale: 1, duration: 0.4, ease: 'back.out(2.5)' }, nd.t);
      tl.fromTo(contra, { rotation: 0 }, { rotation: -grade, duration: durRot, ease: 'none' }, def.t);
      if (nd.blocat != null) {
        const x2 = el('div', 'orbita-x', contra);
        tl.fromTo(x2, { autoAlpha: 0, scale: 2.2, rotation: -30 }, { autoAlpha: 1, scale: 1, rotation: 0, duration: 0.3, ease: 'back.out(2)' }, nd.blocat);
        tl.to(punct, { backgroundColor: CULORI.rosu, boxShadow: '0 0 40px 10px rgba(239,68,68,0.6)', duration: 0.2 }, nd.blocat);
        tl.to(et, { color: CULORI.rosu, duration: 0.2 }, nd.blocat);
      }
    });
    if (def.alerta != null) {
      tl.to(inel, { borderColor: 'rgba(239,68,68,0.9)', duration: 0.25 }, def.alerta);
      tl.to(halou, { backgroundColor: 'rgba(239,68,68,0.22)', duration: 0.25 }, def.alerta);
    }
    return { def, noduri: [zona, centru, halou], tinta: () => caseta([centru.firstChild]) };
  }

  function punct(def, strat, tl, ctx) {
    const d = el('div', 'punct-lumina', strat);
    Object.assign(d.style, { left: '417px', top: def.y - 13 + 'px' });
    const rest = ctx.durata - def.t;
    tl.fromTo(d, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 }, def.t);
    tl.fromTo(d, { x: 0 }, { x: 220, duration: rest, ease: 'none' }, def.t);
    tl.fromTo(d, { scale: 1 }, { scale: 1.35, duration: 0.5, ease: 'sine.inOut', yoyo: true, repeat: Math.max(1, Math.floor(rest / 0.5) - 1) }, def.t);
    return { def, nod: d };
  }

  // Logo: simbolul oficial din media/brand/ (injectat de randare) + numele „VerifiCasa”.
  // "doar_simbol": true afișează doar simbolul. Fără fișierul oficial rămâne doar wordmark-ul tipografic.
  function logo(def, strat, tl, ctx) {
    const box = el('div', 'logo', strat);
    box.style.top = def.y + 'px';
    const src = window.__LOGO && (ctx.peGalben ? window.__LOGO.inchis : window.__LOGO.deschis);
    let simbol = null;
    if (src) {
      simbol = el('img', 'simbol', box);
      simbol.src = src;
      simbol.alt = 'VerifiCasa';
      simbol.style.height = (def.inaltime || 150) + 'px';
    }
    if (!src || !def.doar_simbol) {
      const nume = el('div', 'nume' + (ctx.peGalben ? ' c-bleumarin' : ''), box);
      nume.innerHTML = 'Verifi<b>Casa</b>';
      nume.dataset.text = 'VerifiCasa';
    }
    tl.fromTo(box, { autoAlpha: 0, scale: 0.85 }, { autoAlpha: 1, scale: 1, duration: 0.4, ease: 'back.out(1.7)' }, def.t);
    // simbolul intră puțin rotit și se așază, ca o ștampilă de „verificat”
    if (simbol) tl.fromTo(simbol, { rotation: -12, scale: 0.6 }, { rotation: 0, scale: 1, duration: 0.55, ease: 'back.out(2.2)' }, def.t);
    return { def, nod: box };
  }

  const FABRICI = { text, contor, marcaj, bare, lista, orbita, punct, logo };

  // Ieșirea de final de scenă: toate elementele pleacă eșalonat înainte de tăietură (kinetic out).
  const IESIRI = {
    sus: { y: -140, autoAlpha: 0, ease: 'power3.in' },
    jos: { y: 160, autoAlpha: 0, ease: 'power3.in' },
    stanga: { x: -700, autoAlpha: 0, ease: 'power3.in' },
    zoom: { scale: 1.8, autoAlpha: 0, filter: 'blur(12px)', ease: 'power2.in' },
    estompare: { autoAlpha: 0, ease: 'none' },
  };

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
      const peGalben = sc.fundal === 'galben';
      const strat = el('div', 'strat' + (peGalben ? ' pe-galben' : ''), wrap);
      const flash = el('div', 'flash', wrap);
      const tl = gsap.timeline({ paused: true });
      const elemente = [];
      const ctx = { elemente, durata: sc.durata, peGalben };
      for (const def of sc.elemente) {
        const f = FABRICI[def.tip];
        if (!f) throw new Error(`Tip de element necunoscut: ${def.tip}`);
        elemente.push(f(def, strat, tl, ctx));
      }
      if (sc.iesire && IESIRI[sc.iesire]) {
        const noduri = elemente.flatMap((e) => e.noduri || (e.nod ? [e.nod] : []));
        const { ease, ...vars } = IESIRI[sc.iesire];
        tl.to(noduri, { ...vars, duration: 0.26, ease, stagger: 0.025 }, sc.durata - 0.32);
      }
      tl.set({}, {}, sc.durata); // timeline-ul acoperă toată scena
      scene.push({ sc, wrap, fundal, strat, flash, elemente, tl, start, slam: sc.elemente.filter((e) => e.intrare === 'slam').map((e) => e.t) });
      start += sc.durata;
    }
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
    s.fundal.style.setProperty('--praf', `${(t * 22) % 300}px`);

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
    gsap.set(s.strat, { x: tr.x + sx, y: sy, scale: tr.scale * zoom, rotation: tr.rotatie || 0, opacity: tr.opacity, filter: blur > 0.2 ? `blur(${blur.toFixed(2)}px)` : 'none' });
    s.flash.style.opacity = tr.flash || 0;

    s.tl.time(a, false);
    for (const e of s.elemente) if (e.tick) e.tick(a);
  }

  window.Motor = { construieste };
  window.render = render;
})();
