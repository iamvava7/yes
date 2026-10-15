// Renders src/index.html frame by frame (deterministic window.render(t)) to JPEGs.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { mkdirSync } from 'fs';
const [,, out, fps='30', dur='35', only] = process.argv;
mkdirSync(out, { recursive: true });
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5 });
await p.goto('file://' + new URL('./index.html', import.meta.url).pathname);
await p.evaluate(() => document.fonts.ready);
const times = only ? only.split(',').map(Number) : [...Array(Math.round(+fps * +dur)).keys()].map(i => i / +fps);
for (let i = 0; i < times.length; i++) {
  await p.evaluate(t => window.render(t), times[i]);
  await p.screenshot({ path: `${out}/${only ? 't' + times[i] : String(i).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 93 });
}
await b.close();
