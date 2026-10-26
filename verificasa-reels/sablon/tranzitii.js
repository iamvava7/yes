// Funcții de timp comune: easing, speed ramp, tranziții și evenimente (bătăi, sunete).
// Rulează și în browser (window.Tranzitii) și în Node (require), ca validatorul
// și randarea să folosească exact aceleași calcule.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Tranzitii = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, p) => a + (b - a) * p;

  const ease = {
    linear: (p) => p,
    outCubic: (p) => 1 - Math.pow(1 - p, 3),
    inOutCubic: (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
    outExpo: (p) => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p)),
    outBack: (p) => {
      const c1 = 1.70158, c3 = c1 + 1;
      return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
    },
  };

  // Progres 0..1 al unei animații care începe la `start` și durează `dur`.
  const prog = (u, start, dur, fn = ease.outCubic) => fn(clamp((u - start) / dur));

  // Speed ramp: între `de` și `la` timpul curge cu viteza `lent`, apoi accelerează
  // (viteza RAMP_RAPID) până recuperează întârzierea. După aceea timpul e normal.
  const RAMP_RAPID = 2.5;
  function warp(u, sr) {
    if (!sr) return u;
    const r = sr.lent ?? 0.3;
    const d = sr.la - sr.de;
    const recuperare = (d * (1 - r)) / (RAMP_RAPID - 1);
    if (u < sr.de) return u;
    if (u < sr.la) return sr.de + (u - sr.de) * r;
    if (u < sr.la + recuperare) return sr.de + d * r + (u - sr.la) * RAMP_RAPID;
    return u;
  }
  // Inversa lui warp: momentul real la care timpul animației ajunge la `a`.
  function unwarp(a, sr) {
    if (!sr) return a;
    const r = sr.lent ?? 0.3;
    const d = sr.la - sr.de;
    const recuperare = (d * (1 - r)) / (RAMP_RAPID - 1);
    if (a < sr.de) return a;
    if (a < sr.de + d * r) return sr.de + (a - sr.de) / r;
    if (a < sr.la + recuperare) return sr.la + (a - sr.de - d * r) / RAMP_RAPID;
    return a;
  }

  // Faza de accelerare a rampei (0..1), folosită pentru blur de mișcare.
  function faza_rapida(u, sr) {
    if (!sr) return 0;
    const d = sr.la - sr.de;
    const recuperare = (d * (1 - (sr.lent ?? 0.3))) / (RAMP_RAPID - 1);
    if (u < sr.la || u > sr.la + recuperare) return 0;
    return Math.sin(Math.PI * (u - sr.la) / recuperare);
  }

  const DURATA_TRANZITIE = 0.32;
  // Starea scenei care intră: transform CSS + opacitate + blur.
  function intrare_scena(tip, u) {
    const p = clamp(u / DURATA_TRANZITIE);
    switch (tip) {
      case 'zoom': {
        const e = ease.outExpo(p);
        return { scale: lerp(1.35, 1, e), x: 0, opacity: clamp(p * 3), blur: lerp(10, 0, e) };
      }
      case 'glisare': {
        const e = ease.outExpo(p);
        return { scale: 1, x: lerp(1080, 0, e), opacity: 1, blur: lerp(14, 0, e) };
      }
      case 'estompare': {
        const q = clamp(u / 0.45);
        return { scale: lerp(1.04, 1, q), x: 0, opacity: q, blur: 0 };
      }
      default:
        return { scale: 1, x: 0, opacity: 1, blur: 0 };
    }
  }

  // Momentele (în secunde, absolute) la care se schimbă ceva important în cadru.
  function batai(scenariu) {
    const out = [];
    let start = 0;
    for (const sc of scenariu.scene) {
      out.push({ t: start, scena: sc.id, ce: 'scena' });
      for (const el of sc.elemente || []) {
        const timpi = [el.t];
        for (const sub of el.bare || el.puncte || []) timpi.push(sub.t);
        if (el.diferenta) timpi.push(el.diferenta.t);
        for (const tt of new Set(timpi)) {
          if (typeof tt !== 'number') continue;
          out.push({ t: start + unwarp(tt, sc.speed_ramp), scena: sc.id, ce: el.tip });
        }
      }
      start += sc.durata;
    }
    return out.sort((a, b) => a.t - b.t);
  }

  // Efectele sonore: whoosh la fiecare tăiere, impact la slam și la oprirea contorului, click pe liste și marcaje.
  function sunete(scenariu) {
    const out = [];
    let start = 0;
    for (const sc of scenariu.scene) {
      if (start > 0) out.push({ t: Math.max(0, start - 0.12), sunet: 'whoosh' });
      for (const el of sc.elemente || []) {
        const t = (x) => start + unwarp(x, sc.speed_ramp);
        if (el.tip === 'text' && el.intrare === 'slam') out.push({ t: t(el.t), sunet: 'impact' });
        if (el.tip === 'contor') out.push({ t: t(el.t + (el.durata_anim ?? 1.2)), sunet: 'impact' });
        if (el.tip === 'marcaj') out.push({ t: t(el.t), sunet: 'click' });
        for (const p of el.puncte || []) out.push({ t: t(p.t), sunet: 'click' });
        for (const b of el.bare || []) out.push({ t: t(b.t), sunet: 'whoosh' });
        if (el.diferenta) out.push({ t: t(el.diferenta.t + 0.25), sunet: 'click' });
      }
      start += sc.durata;
    }
    return out.sort((a, b) => a.t - b.t);
  }

  // Easing-uri GSAP permise în scenarii (câmpul "ease"); parametrii între paranteze sunt opționali.
  const EASE_PERMISE = /^(none|(power[1-4]|sine|expo|circ|back|elastic|bounce)\.(in|out|inOut)(\([\d., ]*\))?)$/;

  return { EASE_PERMISE, clamp, lerp, ease, prog, warp, unwarp, faza_rapida, intrare_scena, DURATA_TRANZITIE, batai, sunete };
});
