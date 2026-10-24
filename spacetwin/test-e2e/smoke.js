// End-to-end smoke test: real server + built frontend in headless Chromium.
// Run `npm run build` first. Screenshots land in test-e2e/screenshots/.
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
const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spacetwin-e2e-'));
const app = await createApp({ dataDir, sampleDir: path.join(root, 'assets', 'sample'), webDist: path.join(root, 'web', 'dist'), verificasa: createVerificasaClient({ config: { api: 'off', appId: '', site: 'https://verificasa.ro' } }) });
const server = app.listen(0);
await new Promise((r) => server.once('listening', r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(e.message));
const step = (name) => console.log(`• ${name}`);
const settle = (ms = 600) => page.waitForTimeout(ms);

// Project a world point to page coordinates using the live viewer camera.
const screenOf = (p) => page.evaluate(([x, y, z]) => {
  const v = document.querySelector('.viewer-stage').viewer;
  const s = v.toScreen(v.camera.position.clone().set(x, y, z));
  return s && { x: s.x, y: s.y };
}, p);
const look = (yawDeg, pitchDeg) => page.evaluate(([y, p]) => {
  const v = document.querySelector('.viewer-stage').viewer;
  v.yaw = (y * Math.PI) / 180;
  v.pitch = (p * Math.PI) / 180;
  v.placeInsideCamera();
}, [yawDeg, pitchDeg]);
const clickWorld = async (p) => {
  const s = await screenOf(p);
  assert.ok(s, `point ${p} is not on screen`);
  await page.mouse.click(s.x, s.y);
  await settle(120);
};
const waitTextures = () => page.waitForFunction(() => {
  const v = document.querySelector('.viewer-stage, .tv-stage')?.viewer;
  return v && v.space && [...v.textures.values()].length === v.space.scans.length && [...v.textures.values()].every((t) => t.ready);
});

try {
  step('home page, empty state');
  await page.goto(base);
  await page.getByRole('heading', { name: 'No properties yet' }).waitFor();
  await page.screenshot({ path: path.join(shots, '01-home-empty.png') });

  step('open the sample apartment');
  await page.getByRole('button', { name: 'Open sample' }).first().click();
  await page.waitForURL(/#\/view\//);
  await page.goto(page.url().replace('#/view/', '#/space/'));
  await waitTextures();
  await settle(800);
  await page.screenshot({ path: path.join(shots, '02-editor-inside.png') });
  assert.match(await page.locator('.header-stats').textContent(), /2 scans · 2 rooms · 34\.0 m²/);

  step('measure 2 m between floor-tile corners');
  await page.getByRole('button', { name: 'Measure' }).click();
  await look(0, -35);
  await clickWorld([1, 0, 1]);
  await clickWorld([3, 0, 1]);
  const label = await page.locator('.measure-label').first().textContent();
  assert.equal(label, '2.00 m');
  await page.screenshot({ path: path.join(shots, '03-measure.png') });

  step('walk to the bedroom scan');
  await page.getByRole('button', { name: 'Navigate' }).click();
  await page.locator('.scan-thumb').nth(1).click();
  const sample = await (await fetch(`${base}/api/spaces/${page.url().split('/').pop()}`)).json();
  // the walk is animated, and waits for the room's photo if it is still loading
  await page.waitForFunction((id) => document.querySelector('.viewer-stage').viewer.currentScanId === id, sample.scans[1].id, { timeout: 10_000 });
  await settle(300);
  await page.screenshot({ path: path.join(shots, '04-bedroom.png') });

  step('dollhouse and floor plan');
  await page.getByRole('tab', { name: 'Dollhouse' }).click();
  await settle(1500);
  await page.screenshot({ path: path.join(shots, '05-dollhouse.png') });
  await page.getByRole('tab', { name: 'Floor plan' }).click();
  await settle(700);
  await page.screenshot({ path: path.join(shots, '06-floorplan.png') });

  step('click a room in the dollhouse to dive in');
  await page.getByRole('tab', { name: 'Dollhouse' }).click();
  await settle(400);
  const center = await screenOf([2.5, 0, 2]);
  await page.mouse.click(center.x, center.y);
  await settle(1500);
  assert.equal(await page.evaluate(() => document.querySelector('.viewer-stage').viewer.mode), 'inside');

  step('trace a room from a single panorama in a fresh space');
  const fresh = await (await fetch(`${base}/api/spaces`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"name":"Trace test"}' })).json();
  const form = new FormData();
  form.append('panorama', new Blob([await fs.readFile(path.join(root, 'assets', 'sample', 'scan-1.jpg'))], { type: 'image/jpeg' }), 'Lounge.jpg');
  let sp = await (await fetch(`${base}/api/spaces/${fresh.id}/scans`, { method: 'POST', body: form })).json();
  await fetch(`${base}/api/spaces/${fresh.id}/scans/${sp.scans[0].id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ position: { x: 2, z: 2.2 } }) });
  await page.goto(`${base}/#/space/${fresh.id}`);
  await waitTextures();
  await settle(500);
  await page.getByRole('button', { name: 'Trace room' }).click();
  // Real living-room corners; turn to face each one before clicking it.
  const corners = [[0, 0, 0, 45], [5, 0, 0, -45], [5, 0, 4, -135], [0, 0, 4, 135]];
  for (const [x, y, z, yaw] of corners) {
    await look(yaw, -30);
    await clickWorld([x, y, z]);
  }
  await page.screenshot({ path: path.join(shots, '07-trace-floor.png') });
  await page.getByRole('button', { name: 'Close outline' }).click();
  await look(45, 25);
  await clickWorld([0, 2.7, 0]);
  await page.waitForFunction(() => document.querySelector('.header-stats').textContent.includes('1 rooms'));
  sp = await (await fetch(`${base}/api/spaces/${fresh.id}`)).json();
  const room = sp.rooms[0];
  console.log(`  traced area ${room.points && sp.stats.totalArea.toFixed(3)} m² (truth 20), height ${room.height} m (truth 2.7)`);
  assert.ok(Math.abs(sp.stats.totalArea - 20) < 0.25, `area ${sp.stats.totalArea}`);
  assert.ok(Math.abs(room.height - 2.7) < 0.05, `height ${room.height}`);
  assert.equal(room.name, 'Lounge');
  await settle(500);
  await page.screenshot({ path: path.join(shots, '08-traced-room.png') });

  step('add a tag');
  await page.getByRole('button', { name: 'Add tag' }).click();
  await look(0, 0);
  await clickWorld([2.5, 1.5, 0]);
  await page.getByLabel('Tag label').fill('Window');
  await page.getByRole('button', { name: 'Save tag' }).click();
  await page.locator('.tag-pin').waitFor();
  await page.screenshot({ path: path.join(shots, '09-tag.png') });

  step('shareable tour page');
  await page.goto(`${base}/#/view/${fresh.id}`);
  await waitTextures();
  await settle(700);
  // a property without description or contact must not show stray "null" text
  await page.locator('.tv-toggle').click();
  await page.waitForTimeout(500);
  assert.doesNotMatch(await page.locator('.tv-panel').innerText(), /\bnull\b|\bundefined\b/);
  await page.screenshot({ path: path.join(shots, '10-showcase.png') });

  step('floor plan SVG export');
  const svg = await (await fetch(`${base}/api/spaces/${sample.id}/export/floorplan.svg`)).text();
  await fs.writeFile(path.join(shots, 'sample-floorplan.svg'), svg);

  step('phone layout');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/#/space/${sample.id}`);
  await waitTextures();
  await settle(600);
  await page.screenshot({ path: path.join(shots, '11-mobile-editor.png') });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  assert.equal(overflow, false, 'page scrolls horizontally on a phone');

  const real = errors.filter((e) => !/favicon/.test(e));
  assert.deepEqual(real, [], `console errors:\n${real.join('\n')}`);
  console.log('E2E OK');
} finally {
  await browser.close();
  server.close();
  await fs.rm(dataDir, { recursive: true, force: true });
}
