// Usage:
//   node render.mjs stills            -> frames/scena_XX.png (one still per scene, for approval)
//   node render.mjs frames <outDir>   -> every frame as JPEG for the final MP4
//   node render.mjs times <outDir> 1.2,3.4 [guides]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const dir = path.dirname(fileURLToPath(import.meta.url));
const [, , mode = 'stills', outArg, timesArg, guides] = process.argv;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
await page.goto('file://' + path.join(dir, 'src/index.html') + (guides ? '?guides=1' : ''));
await page.evaluate(() => document.fonts.ready);
const TL = await page.evaluate(() => window.TIMELINE);

async function shot(t, file, type = 'png') {
  await page.evaluate(t => window.render(t), t);
  await page.screenshot({ path: file, type, ...(type === 'jpeg' ? { quality: 95 } : {}) });
}

if (mode === 'stills') {
  const out = path.join(dir, 'frames'); mkdirSync(out, { recursive: true });
  // representative moment of each scene (after entrance animations settle)
  const pick = [1.9, 2.75, 2.2, 2.0, 2.4, 2.75, 1.25, 1.6, 1.0, 3.6];
  for (let i = 0; i < 10; i++) {
    const t = Math.min(TL.SC_START[i] + pick[i], (TL.SC_END[i] ?? TL.DURATION) - .05);
    await shot(t, path.join(out, `scena_${String(i + 1).padStart(2, '0')}.png`));
    console.log('scena', i + 1, 't=', t.toFixed(2));
  }
} else if (mode === 'frames') {
  const out = outArg; mkdirSync(out, { recursive: true });
  const n = Math.round(TL.DURATION * 30);
  for (let f = 0; f < n; f++) await shot(f / 30, path.join(out, String(f).padStart(5, '0') + '.jpg'), 'jpeg');
  console.log('frames', n, 'duration', TL.DURATION);
} else if (mode === 'times') {
  mkdirSync(outArg, { recursive: true });
  for (const t of timesArg.split(',').map(Number)) await shot(t, path.join(outArg, `t${t.toFixed(2)}.png`));
}
await browser.close();
