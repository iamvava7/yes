#!/usr/bin/env node
// Validatorul de scenarii. Folosire: node scripts/valideaza.js scenarii/<id>.json
// Iese cu cod 1 dacă există erori; avertismentele doar se afișează.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const T = require('../sablon/tranzitii.js');

const RADACINA = path.resolve(__dirname, '..');

// Limitele din ghidul de producție (secțiunea 3).
const REGULI = {
  rezolutie: [1080, 1920],
  fps: [24, 30],
  durata_min: 30,
  durata_max: 50,
  scene_min: 4,
  scene_max: 20,
  zona_sus: 120,
  zona_jos: 1920 - 120,
  stanga_jos: { x_max: 540, y_min: 1500 }, // butoanele/descrierea Instagram
  latime_text: 960,
  text_min: 48,
  cifre_min: 90,
  pauza_max: 1.5,
  respiratii_max: 2,
  respiratie_max: 2.5, // o „respirație” lasă cadrul nemișcat cel mult încă o secundă
  hook_secunde: 10,
};

const PERMISE = {
  tip: ['text', 'contor', 'marcaj', 'bare', 'lista', 'punct', 'logo'],
  intrare: ['slam', 'sus', 'cuvinte', 'litere'],
  culoare: ['alb', 'gri', 'galben', 'verde', 'rosu', 'bleumarin'],
  fundal: ['inchis', 'galben', 'negru'],
  tranzitie: ['taiere', 'zoom', 'glisare', 'estompare'],
  forma: ['cerc', 'subliniere'],
};

const areCifre = (s) => /\d/.test(String(s ?? ''));

// Estimare (fără browser) a numărului de rânduri; testul din teste/ verifică apoi casetele reale.
function randuriEstimate(text, marime, greutate) {
  const factor = greutate >= 800 ? 0.58 : 0.54;
  return Math.ceil((text.length * marime * factor) / REGULI.latime_text);
}

function durataAudio(fisier) {
  try {
    const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', fisier]);
    return parseFloat(out.toString());
  } catch {
    return null;
  }
}

function valideaza(sc, { radacina = RADACINA, verificaFisiere = true } = {}) {
  const erori = [];
  const avert = [];
  const E = (m) => erori.push(m);
  const W = (m) => avert.push(m);

  if (!sc.id || !/^[a-z0-9-]+$/.test(sc.id)) E('id lipsă sau invalid (doar a-z, 0-9, -)');
  if (!REGULI.fps.includes(sc.fps)) E(`fps trebuie să fie 24 sau 30 (este ${sc.fps})`);
  if (!Array.isArray(sc.rezolutie) || sc.rezolutie[0] !== 1080 || sc.rezolutie[1] !== 1920) E('rezoluția trebuie să fie 1080 × 1920');

  // Durată și scene
  const scene = Array.isArray(sc.scene) ? sc.scene : [];
  if (scene.length < REGULI.scene_min || scene.length > REGULI.scene_max)
    E(`număr de scene ${scene.length}, permis ${REGULI.scene_min}–${REGULI.scene_max}`);
  const suma = +scene.reduce((s, x) => s + (x.durata || 0), 0).toFixed(3);
  if (Math.abs(suma - sc.durata) > 0.001) E(`durata totală ${sc.durata} s ≠ suma scenelor ${suma} s`);
  if (suma < REGULI.durata_min || suma > REGULI.durata_max) E(`durata ${suma} s în afara intervalului 30–50 s`);
  const ids = new Set();

  // Surse
  const surse = sc.surse || {};
  for (const [id, s] of Object.entries(surse)) {
    if (!s.publicatie) E(`sursa „${id}”: lipsește numele publicației`);
    if (!/^https:\/\//.test(s.url || '')) E(`sursa „${id}”: lipsește linkul https`);
    if (s.verificat !== 'da') W(`sursa „${id}” nu e marcată verificat: "da" (${s.verificat || 'nemarcată'}) – ${s.nota || ''}`);
  }
  const cereSursa = (unde, id) => {
    if (!id) E(`${unde}: conține cifre, dar nu are câmpul "sursa"`);
    else if (!surse[id]) E(`${unde}: sursa „${id}” nu există în "surse"`);
  };

  // Elemente
  let start = 0;
  for (const s of scene) {
    const unde = `scena „${s.id}”`;
    if (!s.id) E('scenă fără id');
    if (ids.has(s.id)) E(`${unde}: id duplicat`);
    ids.add(s.id);
    if (!(s.durata > 0)) E(`${unde}: durată invalidă`);
    if (s.fundal && !PERMISE.fundal.includes(s.fundal)) E(`${unde}: fundal „${s.fundal}” nu e în șablon`);
    if (s.tranzitie && !PERMISE.tranzitie.includes(s.tranzitie)) E(`${unde}: tranziția „${s.tranzitie}” nu e în șablon`);
    if (s.speed_ramp) {
      const r = s.speed_ramp;
      if (!(r.de >= 0 && r.la > r.de && r.la <= s.durata)) E(`${unde}: speed_ramp invalid`);
      if (T.warp(s.durata, r) < s.durata - 1e-6) E(`${unde}: speed_ramp nu se recuperează până la finalul scenei`);
    }
    (s.elemente || []).forEach((e, i) => {
      const u = `${unde}, elementul ${i} (${e.tip}${e.text ? ` „${e.text}”` : ''})`;
      if (!PERMISE.tip.includes(e.tip)) return E(`${u}: tip necunoscut`);
      if (typeof e.t !== 'number' || e.t < 0 || e.t >= s.durata) E(`${u}: t=${e.t} în afara scenei (0–${s.durata})`);
      if (e.culoare && !PERMISE.culoare.includes(e.culoare)) E(`${u}: culoarea „${e.culoare}” nu e în șablon`);
      if (e.intrare && !PERMISE.intrare.includes(e.intrare)) E(`${u}: intrarea „${e.intrare}” nu e în șablon`);

      if (e.tip === 'text' || e.tip === 'contor') {
        const text = e.tip === 'text' ? e.text : `${e.prefix || ''}${e.la}${e.sufix || ''}`;
        if (!text) E(`${u}: text gol`);
        if (!(e.marime >= REGULI.text_min)) E(`${u}: mărimea ${e.marime}px sub minimul de ${REGULI.text_min}px`);
        const randuri = randuriEstimate(text || '', e.marime, e.greutate || 700);
        if (randuri > 2) E(`${u}: textul ar ocupa ~${randuri} rânduri (maxim 2); scurtează-l sau micșorează-l`);
        if (e.x != null && (e.x - 480 < 0 || e.x + 480 > 1080)) W(`${u}: x=${e.x} – caseta de 960px iese din cadru; testul de zone verifică textul real`);
        const sus = e.y, jos = e.y + randuri * e.marime * 1.1;
        if (sus < REGULI.zona_sus) E(`${u}: y=${sus} în zona de siguranță de sus (<${REGULI.zona_sus}px)`);
        if (jos > REGULI.zona_jos) E(`${u}: se termină la ~${Math.round(jos)}px, în zona de siguranță de jos`);
        if (jos > REGULI.stanga_jos.y_min) E(`${u}: textul centrat ajunge în zona stânga-jos (butoanele Instagram)`);
        if (areCifre(text)) {
          cereSursa(u, e.sursa);
          if (e.tip === 'contor' && e.marime < REGULI.cifre_min) E(`${u}: cifrele principale trebuie să aibă minimum ${REGULI.cifre_min}px`);
        }
      }
      if (e.tip === 'bare') {
        if (!Array.isArray(e.bare) || e.bare.length < 2) E(`${u}: trebuie cel puțin două bare`);
        cereSursa(u, e.sursa);
        if (e.y < REGULI.zona_sus || e.y + e.inaltime > REGULI.stanga_jos.y_min) E(`${u}: graficul iese din zona sigură`);
        for (const b of e.bare || []) if (b.t < e.t || b.t >= s.durata) E(`${u}: bara „${b.eticheta}” are t în afara intervalului`);
      }
      if (e.tip === 'lista') {
        if (!(e.marime >= REGULI.text_min)) E(`${u}: mărimea ${e.marime}px sub minimul de ${REGULI.text_min}px`);
        const jos = e.y + e.puncte.length * e.marime * 1.7;
        if (e.y < REGULI.zona_sus || jos > REGULI.stanga_jos.y_min) E(`${u}: lista iese din zona sigură`);
        for (const p of e.puncte || []) {
          if (p.t < e.t || p.t >= s.durata) E(`${u}: punctul „${p.text}” are t în afara intervalului`);
          if (areCifre(p.text)) cereSursa(`${u} / „${p.text}”`, p.sursa || e.sursa);
        }
      }
      if (e.tip === 'marcaj') {
        if (!PERMISE.forma.includes(e.forma)) E(`${u}: forma „${e.forma}” nu e în șablon`);
        const tinta = (s.elemente || [])[e.tinta];
        if (!tinta || !['text', 'contor', 'lista'].includes(tinta.tip)) E(`${u}: ținta ${e.tinta} nu e un text, contor sau listă`);
        else if (e.tinta >= i) E(`${u}: ținta trebuie să fie un element anterior`);
      }
    });
    start += s.durata || 0;
  }

  // Ritm: schimbare de cadru la cel mult 1,5 s; maximum două „respirații” de până la 2,5 s.
  const batai = T.batai(sc).map((b) => b.t);
  batai.push(suma);
  const pauze = [];
  for (let i = 1; i < batai.length; i++) {
    const g = +(batai[i] - batai[i - 1]).toFixed(3);
    if (g > REGULI.pauza_max + 1e-6) pauze.push({ la: +batai[i - 1].toFixed(2), g });
  }
  const prealungi = pauze.filter((p) => p.g > REGULI.respiratie_max);
  for (const p of prealungi) E(`ritm: cadrul stă nemișcat ${p.g} s de la ${p.la} s (maxim ${REGULI.pauza_max} s)`);
  const respiratii = pauze.filter((p) => p.g <= REGULI.respiratie_max);
  if (respiratii.length > REGULI.respiratii_max)
    E(`ritm: ${respiratii.length} pauze peste ${REGULI.pauza_max} s (maxim ${REGULI.respiratii_max} momente de respirație): ${respiratii.map((p) => `${p.la}s`).join(', ')}`);

  // Hook-ul trebuie să fie cea mai densă parte.
  const inHook = batai.filter((b) => b < REGULI.hook_secunde).length / REGULI.hook_secunde;
  const restul = batai.filter((b) => b >= REGULI.hook_secunde).length / Math.max(1, suma - REGULI.hook_secunde);
  if (inHook < restul) W(`hook-ul are ${inHook.toFixed(2)} schimbări/s, mai puțin decât restul (${restul.toFixed(2)}/s)`);

  // Audio și licențe
  const abs = (p) => path.resolve(radacina, p);
  if (!sc.voce || !sc.voce.fisier) E('lipsește vocea (voce.fisier)');
  else {
    if (!sc.voce.voice_id) E('voce: lipsește ID-ul vocii ElevenLabs');
    if (!sc.voce.licenta) E('voce: lipsește fișierul de licență');
    if (!Array.isArray(sc.voce.surse) || !sc.voce.surse.length) E('voce: textul vorbit trebuie să aibă surse');
    for (const id of sc.voce.surse || []) if (!surse[id]) E(`voce: sursa „${id}” nu există`);
    if (!sc.dezvaluire_ai) E('lipsește dezvăluirea „voce generată cu AI”');
    const dezv = scene.flatMap((s) => s.elemente || []).some((e) => e.rol === 'dezvaluire' && e.text === sc.dezvaluire_ai);
    if (!dezv) E('dezvăluirea AI nu apare pe ecran (element cu rol: "dezvaluire")');
    if (verificaFisiere) {
      if (!fs.existsSync(abs(sc.voce.fisier))) E(`voce: fișierul ${sc.voce.fisier} nu există`);
      else {
        const d = durataAudio(abs(sc.voce.fisier));
        if (d != null && d > suma) E(`voce: ${d.toFixed(2)} s, mai lungă decât Reel-ul (${suma} s)`);
      }
      if (sc.voce.licenta && !fs.existsSync(abs(sc.voce.licenta))) E(`voce: licența ${sc.voce.licenta} nu există`);
    }
  }
  if (sc.muzica) {
    if (!sc.muzica.fisier || !sc.muzica.licenta) E('muzica are nevoie de "fisier" și "licenta"');
    else if (verificaFisiere) {
      if (!fs.existsSync(abs(sc.muzica.fisier))) E(`muzica: fișierul ${sc.muzica.fisier} nu există`);
      if (!fs.existsSync(abs(sc.muzica.licenta))) E(`muzica: licența ${sc.muzica.licenta} nu există – nu se randează fără licență`);
    }
  } else {
    W('fără muzică: nu există încă o piesă licențiată în audio/muzica/');
  }
  if (!sc.sfx || !sc.sfx.licenta) E('lipsește licența efectelor sonore (sfx.licenta)');
  else if (verificaFisiere && !fs.existsSync(abs(sc.sfx.licenta))) E(`sfx: licența ${sc.sfx.licenta} nu există`);

  return { erori, avertismente: avert, durata: suma, batai: batai.length };
}

module.exports = { valideaza, REGULI, PERMISE };

if (require.main === module) {
  const f = process.argv[2];
  if (!f) {
    console.error('Folosire: node scripts/valideaza.js scenarii/<id>.json');
    process.exit(2);
  }
  const sc = JSON.parse(fs.readFileSync(f, 'utf8'));
  const r = valideaza(sc);
  console.log(`Scenariu ${sc.id}: ${r.durata} s, ${sc.scene.length} scene, ${r.batai} schimbări de cadru`);
  for (const w of r.avertismente) console.log(`  ! ${w}`);
  for (const e of r.erori) console.log(`  ✗ ${e}`);
  if (r.erori.length) {
    console.log(`RESPINS: ${r.erori.length} erori`);
    process.exit(1);
  }
  console.log('OK');
}
