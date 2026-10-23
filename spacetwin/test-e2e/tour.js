// End-to-end test of the shared tour page (Figma "Web · 3D Tour viewer"):
// loading card, hotspots, details panel, floor-plan map, view modes, measuring,
// save/share, the phone card and the VerifiCasa listing frame.
// Run `npm run build` first.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { createApp } from '../server/app.js';
import { createVerificasaClient } from '../server/verificasa.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const shots = path.join(root, 'test-e2e', 'screenshots');
await fs.mkdir(shots, { recursive: true });
const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spacetwin-tour-'));
const app = await createApp({ dataDir, sampleDir: path.join(root, 'assets', 'sample'), webDist: path.join(root, 'web', 'dist'), verificasa: createVerificasaClient({ config: { api: 'off', appId: '', site: 'https://verificasa.ro' } }) });
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
    const v = document.querySelector('.tv-stage').viewer;
    return { scan: v.currentScanId, mode: v.mode, yaw: v.yaw, transitioning: v.transitioning };
  });

  const stageViewer = (fn) => page.evaluate(fn);
  const ready = (p) => p.waitForSelector('.tv-loading', { state: 'detached', timeout: 30000 });

  step('loading card, then the tour');
  await page.goto(`${base}/#/view/${space.id}`);
  await ready(page);
  assert.equal((await viewer()).scan, space.scans[0].id);
  assert.equal(await page.locator('.tv-rooms .tv-room').count(), 2);
  assert.equal(await page.locator('.tv-rooms [aria-current="true"] span').textContent(), 'Living room');
  assert.ok(await page.locator('.tv-hint').isVisible(), 'drag hint on first view');

  step('a hotspot walks to the next room');
  const hotspot = page.locator('.hotspot[data-scan-id="' + space.scans[1].id + '"]');
  await hotspot.locator('.hotspot-ring').waitFor();
  assert.equal(await hotspot.locator('.hotspot-label span').textContent(), 'Bedroom');
  await hotspot.locator('.hotspot-ring').click(); // faded (behind the wall) but still a way through
  await page.waitForFunction((id) => document.querySelector('.tv-stage').viewer.currentScanId === id && !document.querySelector('.tv-stage').viewer.transitioning, space.scans[1].id);
  assert.equal(await page.locator('.tv-rooms [aria-current="true"] span').textContent(), 'Bedroom');

  step('details panel: title, facts, capturer, floor-plan map');
  await page.getByRole('button', { name: 'Show details' }).click();
  await page.waitForFunction(() => document.querySelector('.tv').dataset.open === 'true');
  assert.equal(await page.locator('.tv-title h1').textContent(), 'Unit 4B, sample building');
  assert.match(await page.locator('.tv-sub').textContent(), /1 bed · 34\.0 m²/);
  assert.match(await page.locator('.tv-captor').textContent(), /Captured by.*VerifiCasa demo/);
  assert.equal(await page.locator('.tv-map-count').textContent(), 'Room 2 of 2');
  await page.locator('.tv-map text', { hasText: 'Living room' }).click();
  await page.waitForFunction((id) => document.querySelector('.tv-stage').viewer.currentScanId === id && !document.querySelector('.tv-stage').viewer.transitioning, space.scans[0].id);
  await page.screenshot({ path: path.join(shots, 't1-details.png') });

  step('view modes and measuring');
  await page.locator('.tv-modes [data-mode="dollhouse"]').click();
  await page.waitForFunction(() => document.querySelector('.tv-stage').viewer.mode === 'dollhouse');
  assert.equal(await page.locator('.tv-modes [data-mode="dollhouse"]').getAttribute('aria-pressed'), 'true');
  await page.locator('.tv-modes [data-mode="floorplan"]').click();
  await page.waitForFunction(() => document.querySelector('.tv-stage').viewer.mode === 'floorplan');
  await page.locator('.tv-modes [data-mode="inside"]').click();
  await page.waitForFunction(() => document.querySelector('.tv-stage').viewer.mode === 'inside' && !document.querySelector('.tv-stage').viewer.transitioning);
  await page.getByRole('button', { name: 'Measure' }).click();
  assert.equal(await stageViewer(() => document.querySelector('.tv-stage').viewer.tool), 'measure');
  assert.match(await page.locator('.tv-hint').textContent(), /Tap two points/);
  await page.getByRole('button', { name: 'Measure' }).click();
  assert.equal(await stageViewer(() => document.querySelector('.tv-stage').viewer.tool), 'navigate');

  step('save, copy link, close');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  assert.equal(await page.locator('.tv-action[aria-pressed="true"]').count(), 1);
  await page.getByRole('button', { name: 'Copy link' }).click();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), `${base}/3D/${space.id}`);
  await page.reload();
  await ready(page);
  await page.getByRole('button', { name: 'Show details' }).click();
  assert.equal(await page.getByRole('button', { name: 'Saved' }).getAttribute('aria-pressed'), 'true', 'saved is remembered');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.querySelector('.tv').dataset.open === 'false');

  step('Maria answers about this property and walks the tour');
  await page.getByRole('button', { name: 'Ask Maria, the VerifiCasa assistant' }).click();
  const maria = page.getByRole('dialog', { name: 'Maria, the VerifiCasa assistant' });
  await maria.waitFor();
  await maria.getByRole('button', { name: 'About the price' }).click();
  await page.waitForFunction(() => document.querySelectorAll('.maria-msg.bot').length >= 2);
  assert.match(await page.locator('.maria-msg.bot').nth(1).textContent(), /285,000 EUR/);
  await page.getByLabel('Your question for Maria').fill('Write me a poem about the sea');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelectorAll('.maria-msg.bot').length >= 3);
  assert.match(await page.locator('.maria-msg.bot').nth(2).textContent(), /only help with this property/);
  await page.getByLabel('Your question for Maria').fill('Take me to the bedroom');
  await page.keyboard.press('Enter');
  await page.waitForFunction((id) => document.querySelector('.tv-stage').viewer.currentScanId === id, space.scans[1].id, { timeout: 10000 });
  await page.screenshot({ path: path.join(shots, 't4-maria.png') });
  await maria.getByRole('button', { name: 'Close' }).click();

  step('phone: details card');
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  phone.on('pageerror', (e) => errors.push(e.message));
  await phone.goto(`${base}/#/view/${space.id}`);
  await ready(phone);
  assert.equal(await phone.locator('.tv-rooms').isVisible(), false, 'no thumbnail strip on phones');
  await phone.locator('.tv-toggle').tap();
  // the card slides up (slowly under software rendering while the intro plays)
  await phone.waitForFunction(() => document.querySelector('.tv-panel').getBoundingClientRect().bottom <= innerHeight, null, { timeout: 10000 });
  const card = await phone.locator('.tv-panel').boundingBox();
  assert.ok(card.x >= 0 && card.x + card.width <= 390 && card.y + card.height <= 844, `card fits the screen: ${JSON.stringify(card)}`);
  assert.equal(await phone.locator('.tv-room-chip').count(), 2);
  assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'no sideways scroll');
  await phone.screenshot({ path: path.join(shots, 't2-phone-card.png') });

  step('VerifiCasa listing frame: /3D/<id> in Romanian');
  const listingPage = await browser.newPage({ viewport: { width: 900, height: 560 }, locale: 'ro-RO' });
  listingPage.on('pageerror', (e) => errors.push(e.message));
  await listingPage.setContent(`<iframe src="${base}/3D/${space.id.toUpperCase()}" width="860" height="520" style="border:0"></iframe>`);
  const frame = listingPage.frameLocator('iframe');
  await frame.locator('.tv-stage canvas').waitFor();
  await frame.locator('.tv-loading').waitFor({ state: 'detached', timeout: 30000 });
  assert.equal(await frame.locator('.tv-listing').count(), 0, 'no link back to the listing it sits in');
  await frame.locator('.tv-toggle').click();
  await frame.locator('.tv-modes [data-mode="dollhouse"]', { hasText: 'Machetă 3D' }).waitFor();
  assert.equal(await frame.locator('html').getAttribute('lang'), 'ro');
  await frame.locator('.tv-modes [data-mode="floorplan"]', { hasText: 'Plan' }).click();
  await listingPage.waitForTimeout(1200);
  await listingPage.screenshot({ path: path.join(shots, 't3-verificasa-frame.png') });

  assert.deepEqual(errors, [], errors.join('\n'));
  console.log('TOUR OK');
} finally {
  await browser.close();
  server.close();
  await fs.rm(dataDir, { recursive: true, force: true });
}
