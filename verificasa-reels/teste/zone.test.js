// Textul real (randat în Chromium) stă în zonele de siguranță, are cel puțin 48 px și nu se suprapune.
const test = require('node:test');
const assert = require('node:assert');
const { chromium } = require('playwright');
const { deschideSablon } = require('../scripts/randare.js');
const { REGULI } = require('../scripts/valideaza.js');
const T = require('../sablon/tranzitii.js');
const sc = require('../scenarii/ancpi-h1.json');

// Momentul în care fiecare scenă e complet afișată: ultimul cadru dinaintea tăieturii,
// sau dinaintea animației de ieșire (care scoate intenționat textul din cadru).
function momente() {
  let start = 0;
  const out = [];
  for (const s of sc.scene) { out.push({ id: s.id, t: start + s.durata - (s.iesire ? 0.36 : 0.05) }); start += s.durata; }
  return out;
}

test('textul vizibil respectă zonele de siguranță, mărimea minimă și nu se suprapune', async () => {
  const browser = await chromium.launch();
  try {
    const page = await deschideSablon(browser, sc);
    const probleme = [];
    for (const m of momente()) {
      const cutii = await page.evaluate((t) => {
        window.render(t);
        const out = [];
        for (const n of document.querySelectorAll('[data-text]')) {
          if (!n.offsetParent && getComputedStyle(n).position !== 'fixed') continue; // scenă ascunsă
          if (getComputedStyle(n).visibility === 'hidden' || +getComputedStyle(n).opacity < 0.05) continue;
          // caseta reală a glifelor, nu a containerului de 960 px
          const rs = [...n.querySelectorAll('.bucata')].flatMap((b) => [...b.getClientRects()]);
          const lista = rs.length ? rs : [...n.getClientRects()];
          if (!lista.length) continue;
          const r = lista.reduce((a, b) => ({ l: Math.min(a.l, b.left), t: Math.min(a.t, b.top), r: Math.max(a.r, b.right), b: Math.max(a.b, b.bottom) }),
            { l: 1e9, t: 1e9, r: -1e9, b: -1e9 });
          out.push({ text: n.dataset.text, px: parseFloat(getComputedStyle(n).fontSize), ...r });
        }
        return out;
      }, m.t);
      for (const c of cutii) {
        const u = `${m.id} „${c.text}”`;
        if (c.px < REGULI.text_min) probleme.push(`${u}: ${c.px}px`);
        if (c.t < REGULI.zona_sus) probleme.push(`${u}: sus la ${Math.round(c.t)}px`);
        if (c.b > REGULI.zona_jos) probleme.push(`${u}: jos la ${Math.round(c.b)}px`);
        if (c.l < 0 || c.r > 1080) probleme.push(`${u}: iese lateral (${Math.round(c.l)}–${Math.round(c.r)})`);
        if (c.b > REGULI.stanga_jos.y_min && c.l < REGULI.stanga_jos.x_max) probleme.push(`${u}: în zona stânga-jos`);
      }
      for (let i = 0; i < cutii.length; i++) for (let j = i + 1; j < cutii.length; j++) {
        const a = cutii[i], b = cutii[j];
        if (a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b && a.text !== 'VerifiCasa' && b.text !== 'VerifiCasa')
          probleme.push(`${m.id}: „${a.text}” se suprapune cu „${b.text}”`);
      }
      assert.ok(cutii.length > 0, `${m.id}: niciun text vizibil`);
    }
    assert.deepStrictEqual(probleme, []);
  } finally {
    await browser.close();
  }
});

test('sursele apar pe ecran la final', async () => {
  const browser = await chromium.launch();
  try {
    const page = await deschideSablon(browser, sc);
    const texte = await page.evaluate((t) => {
      window.render(t);
      return [...document.querySelectorAll('[data-text]')]
        .filter((n) => n.offsetParent && getComputedStyle(n).visibility !== 'hidden')
        .map((n) => n.dataset.text);
    }, sc.durata - 0.05);
    // sursele trebuie să rămână pe ecran până la ultimul cadru
    assert.ok(texte.some((t) => /^Surse:/.test(t)), 'lipsesc sursele de pe ecran');
  } finally {
    await browser.close();
  }
});

test('speed ramp: timpul animației e continuu și se recuperează', () => {
  const sr = sc.scene.find((s) => s.speed_ramp).speed_ramp;
  let prev = 0;
  for (let u = 0; u <= 5; u += 0.01) {
    const a = T.warp(u, sr);
    assert.ok(a >= prev - 1e-9, `warp descrește la ${u}`);
    assert.ok(Math.abs(T.unwarp(a, sr) - u) < 1e-6, `unwarp nu inversează warp la ${u}`);
    prev = a;
  }
  assert.ok(Math.abs(T.warp(5, sr) - 5) < 1e-9);
});
