// End-to-end test of the shared tour page: listing panel, minimap, room sign,
// guided tour, snapshot, share and sound, on desktop and phone sizes.
// Run `npm run build` first.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { createApp } from '../server/app.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const shots = path.join(root, 'test-e2e', 'screenshots');
await fs.mkdir(shots, { recursive: true });
const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spacetwin-tour-'));
const app = await createApp({ dataDir, sampleDir: path.join(root, 'assets', 'sample'), webDist: path.join(root, 'web', 'dist') });
const server = app.listen(0);
await new Promise((r) => server.once('listening', r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const errors = [];
const step = (s) => console.log(`• ${s}`);

try {
  const space = await (await fetch(`${base}/api/sample`, { method: 'POST' })).json();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const viewer = () => page.evaluate(() => {
    const v = document.querySelector('.viewer-stage').viewer;
    return { scan: v.currentScanId, mode: v.mode, yaw: v.yaw, transitioning: v.transitioning };
  });

  step('listing beside the tour');
  await page.goto(`${base}/#/view/${space.id}`);
  await page.waitForFunction(() => [...(document.querySelector('.viewer-stage')?.viewer?.textures.values() ?? [])].every((t) => t.ready));
  assert.match(await page.locator('.price').textContent(), /285,000/);
  assert.match(await page.locator('.facts-row').textContent(), /1 bed.*1 bath.*34\.0 m²/);
  assert.equal(await page.locator('.room-list li').count(), 2);
  assert.ok(await page.locator('.minimap').isVisible(), 'minimap shows inside');

  step('room sign when entering a room');
  await page.getByRole('button', { name: /Bedroom/ }).first().click();
  await page.waitForFunction(() => document.querySelector('.room-sign.show .room-sign-name')?.textContent === 'Bedroom');
  assert.match(await page.locator('.room-sign-area').textContent(), /14\.0 m² · 151 ft²/);

  step('minimap tap walks to the nearest spot');
  const box = await page.locator('.minimap').boundingBox();
  await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.5); // left room on the map
  await page.waitForTimeout(1300);
  assert.equal((await viewer()).scan, space.scans[0].id);

  step('guided tour moves between spots and looks around');
  const before = await viewer();
  await page.getByRole('button', { name: 'Play guided tour' }).click();
  await page.waitForTimeout(2500);
  const mid = await viewer();
  assert.notEqual(mid.yaw, before.yaw, 'tour pans the view');
  await page.waitForFunction((id) => document.querySelector('.viewer-stage').viewer.currentScanId !== id, before.scan, { timeout: 15000 });
  await page.getByRole('button', { name: 'Pause guided tour' }).click();
  const paused = await viewer();
  await page.waitForTimeout(800);
  assert.equal((await viewer()).yaw, paused.yaw, 'pause stops the tour');

  step('snapshot downloads a photo');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save this view as a photo' }).click()]);
  const file = await download.path();
  const head = (await fs.readFile(file)).subarray(0, 3);
  assert.deepEqual([...head], [0xff, 0xd8, 0xff], 'snapshot is a JPEG');
  assert.match(download.suggestedFilename(), /snapshot\.jpg$/);

  step('share shows link and embed code');
  await page.getByRole('button', { name: 'Share or embed this tour' }).click();
  const link = await page.getByLabel('Link', { exact: true }).inputValue();
  assert.equal(link, `${base}/#/view/${space.id}`);
  assert.equal(await page.getByLabel('Link for a VerifiCasa listing (Link Tur 3D)').inputValue(), `${base}/3D/${space.id}`);
  assert.match(await page.getByLabel('Embed on a website').inputValue(), new RegExp(`^<iframe src="${base}/3D/${space.id}"`));
  await page.locator('.share').getByRole('button', { name: 'Copy' }).first().click();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), link);
  await page.screenshot({ path: path.join(shots, 't1-share.png') });

  step('sound toggle is remembered');
  await page.getByRole('button', { name: 'Turn sound off' }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Turn sound on' }).waitFor();

  step('measure toggles off by tapping it again');
  await page.getByRole('button', { name: 'Measure' }).click();
  assert.equal(await page.evaluate(() => document.querySelector('.viewer-stage').viewer.tool), 'measure');
  await page.getByRole('button', { name: 'Measure' }).click();
  assert.equal(await page.evaluate(() => document.querySelector('.viewer-stage').viewer.tool), 'navigate');

  step('phone: listing sheet slides up');
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  phone.on('pageerror', (e) => errors.push(e.message));
  await phone.goto(`${base}/#/view/${space.id}`);
  await phone.waitForFunction(() => [...(document.querySelector('.viewer-stage')?.viewer?.textures.values() ?? [])].every((t) => t.ready));
  await phone.waitForTimeout(500);
  const closedTop = (await phone.locator('.listing').boundingBox()).y;
  await phone.locator('.sheet-handle').tap();
  assert.match(await phone.locator('.listing').getAttribute('class'), /\bopen\b/);
  // wait for the slide-up to finish (software rendering here is slow)
  await phone.waitForFunction((closed) => document.querySelector('.listing').getBoundingClientRect().top < closed - 300, closedTop, { timeout: 5000 });
  assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'no sideways scroll');
  const dock = await phone.locator('.viewer-dock').boundingBox();
  assert.ok(dock.x >= 0 && dock.x + dock.width <= 390, 'tour controls fit the screen');
  await phone.screenshot({ path: path.join(shots, 't2-phone-sheet.png') });

  step('VerifiCasa listing frame: /3D/<id> in Romanian');
  const listingPage = await browser.newPage({ viewport: { width: 900, height: 560 }, locale: 'ro-RO' });
  listingPage.on('pageerror', (e) => errors.push(e.message));
  await listingPage.setContent(`<iframe src="${base}/3D/${space.id.toUpperCase()}" width="860" height="520" style="border:0"></iframe>`);
  const frame = listingPage.frameLocator('iframe');
  await frame.locator('.viewer-stage canvas').waitFor();
  await frame.getByRole('tab', { name: 'Machetă 3D' }).waitFor();
  assert.equal(await frame.locator('aside.listing').count(), 0, 'the listing page shows the details, not the frame');
  assert.equal(await frame.locator('.embed-badge').getAttribute('href'), `${base}/#/view/${space.id}`);
  assert.equal(await frame.locator('html').getAttribute('lang'), 'ro');
  await frame.getByRole('tab', { name: 'Plan' }).click();
  await listingPage.waitForTimeout(1200);
  await listingPage.screenshot({ path: path.join(shots, 't3-verificasa-frame.png') });

  assert.deepEqual(errors, [], errors.join('\n'));
  console.log('TOUR OK');
} finally {
  await browser.close();
  server.close();
  await fs.rm(dataDir, { recursive: true, force: true });
}
