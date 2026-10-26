#!/usr/bin/env node
// Randare: validează scenariul, desenează cadrele PNG cu Playwright, construiește pista de efecte
// și asamblează MP4-ul în preview/. Nu publică nimic.
// Folosire: node scripts/randare.js scenarii/<id>.json [--pastreaza-cadre] [--pana-la <secunde>] [--paralel <n>]
//           [--doar-asamblare]  refolosește cadrele din randare/<id>/ (după o rulare cu --pastreaza-cadre)
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');
const { valideaza } = require('./valideaza.js');
const T = require('../sablon/tranzitii.js');

const RADACINA = path.resolve(__dirname, '..');

function argumente(argv) {
  const a = { fisier: null, pastreaza: false, panaLa: null, paralel: 4, doarAsamblare: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--pastreaza-cadre') a.pastreaza = true;
    else if (argv[i] === '--doar-asamblare') a.doarAsamblare = a.pastreaza = true;
    else if (argv[i] === '--pana-la') a.panaLa = parseFloat(argv[++i]);
    else if (argv[i] === '--paralel') a.paralel = parseInt(argv[++i], 10);
    else a.fisier = argv[i];
  }
  return a;
}

// Logo-ul oficial, dacă a fost pus în media/brand/; altfel șablonul folosește doar wordmark-ul tipografic.
function logoOficial() {
  const f = path.join(RADACINA, 'media', 'brand', 'logo.svg');
  return fs.existsSync(f) ? 'data:image/svg+xml;base64,' + fs.readFileSync(f).toString('base64') : null;
}

// Deschide șablonul cu scenariul injectat; folosit și de teste.
async function deschideSablon(browser, scenariu) {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await page.addInitScript(([sc, logo]) => { window.__SCENARIU = sc; window.__LOGO = logo; }, [scenariu, logoOficial()]);
  await page.goto('file://' + path.join(RADACINA, 'sablon', 'index.html'));
  await page.waitForFunction(() => window.__gata === true, null, { timeout: 30000 });
  return page;
}

async function deseneazaCadre(scenariu, dir, { panaLa, paralel }) {
  const fps = scenariu.fps;
  const total = Math.round((panaLa ?? scenariu.durata) * fps);
  const browser = await chromium.launch();
  try {
    const pagini = await Promise.all(Array.from({ length: paralel }, () => deschideSablon(browser, scenariu)));
    let urmator = 0, gata = 0;
    const t0 = Date.now();
    await Promise.all(pagini.map(async (page) => {
      while (urmator < total) {
        const i = urmator++;
        await page.evaluate((t) => window.render(t), i / fps);
        await page.screenshot({ path: path.join(dir, `f_${String(i).padStart(5, '0')}.png`), type: 'png' });
        if (++gata % fps === 0) process.stdout.write(`\r  cadre ${gata}/${total} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
      }
    }));
    process.stdout.write(`\r  cadre ${total}/${total} în ${((Date.now() - t0) / 1000).toFixed(0)} s\n`);
  } finally {
    await browser.close();
  }
  return total;
}

// Coperta: o scenă statică randată o singură dată, la final de animație.
async function exportCoperta(scenariu, iesire) {
  if (!scenariu.coperta) return false;
  const c = scenariu.coperta;
  const mini = { ...scenariu, scene: [{ id: 'coperta', durata: 1, fundal: c.fundal, tranzitie: 'taiere', elemente: c.elemente }] };
  const browser = await chromium.launch();
  try {
    const page = await deschideSablon(browser, mini);
    await page.evaluate(() => window.render(0.999));
    await page.screenshot({ path: iesire, type: 'png' });
  } finally {
    await browser.close();
  }
  return true;
}

// Pista de efecte: fiecare sunet pus la momentul lui, apoi amestecate.
function pistaSfx(scenariu, iesire, durata) {
  const sunete = T.sunete(scenariu).filter((s) => s.t < durata);
  const sfxDir = path.join(RADACINA, 'audio', 'sfx');
  const args = ['-hide_banner', '-loglevel', 'error', '-y'];
  const filtre = [];
  sunete.forEach((s, i) => {
    args.push('-i', path.join(sfxDir, `${s.sunet}.wav`));
    const ms = Math.round(s.t * 1000);
    filtre.push(`[${i}:a]adelay=${ms}|${ms}[d${i}]`);
  });
  args.push('-f', 'lavfi', '-t', String(durata), '-i', 'anullsrc=r=48000:cl=mono');
  const n = sunete.length;
  filtre.push(`${sunete.map((_, i) => `[d${i}]`).join('')}[${n}:a]amix=inputs=${n + 1}:normalize=0:duration=longest,atrim=0:${durata}[out]`);
  args.push('-filter_complex', filtre.join(';'), '-map', '[out]', '-ar', '48000', '-ac', '1', iesire);
  execFileSync('ffmpeg', args, { stdio: 'inherit' });
  return sunete.length;
}

async function main() {
  const a = argumente(process.argv.slice(2));
  if (!a.fisier) {
    console.error('Folosire: node scripts/randare.js scenarii/<id>.json [--pastreaza-cadre] [--pana-la <s>] [--paralel <n>]');
    process.exit(2);
  }
  const scenariu = JSON.parse(fs.readFileSync(a.fisier, 'utf8'));

  const v = valideaza(scenariu);
  for (const w of v.avertismente) console.log(`  ! ${w}`);
  if (v.erori.length) {
    for (const e of v.erori) console.log(`  ✗ ${e}`);
    console.error('Scenariul nu trece validarea; nu randez.');
    process.exit(1);
  }

  const dir = path.join(RADACINA, 'randare', scenariu.id);
  if (a.doarAsamblare) {
    if (!fs.existsSync(path.join(dir, 'f_00000.png'))) throw new Error(`Nu există cadre în ${dir}`);
  } else {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Randez ${scenariu.id} (${scenariu.durata} s, ${scenariu.fps} fps)`);
    await deseneazaCadre(scenariu, dir, a);
  }
  const durata = a.panaLa ?? scenariu.durata;
  const n = pistaSfx(scenariu, path.join(dir, 'sfx.wav'), durata);
  console.log(`  efecte sonore: ${n}`);

  const iesire = path.join(RADACINA, 'preview', `${scenariu.id}${a.panaLa ? '-partial' : ''}.mp4`);
  const env = {
    ...process.env,
    CADRE: dir,
    FPS: String(scenariu.fps),
    DURATA: String(durata),
    VOCE: path.join(RADACINA, scenariu.voce.fisier),
    SFX: path.join(dir, 'sfx.wav'),
    MUZICA: scenariu.muzica ? path.join(RADACINA, scenariu.muzica.fisier) : '',
    IESIRE: iesire,
  };
  execFileSync(path.join(__dirname, 'asambleaza.sh'), { stdio: 'inherit', env });
  const coperta = path.join(RADACINA, 'preview', `${scenariu.id}-coperta.png`);
  if (await exportCoperta(scenariu, coperta)) console.log(`  copertă: ${path.relative(RADACINA, coperta)}`);
  if (!a.pastreaza) fs.rmSync(dir, { recursive: true, force: true });
  console.log(`Preview: ${path.relative(RADACINA, iesire)} (nepublicat – așteaptă aprobarea)`);
}

module.exports = { deschideSablon, exportCoperta };

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
