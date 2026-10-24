// End-to-end test of the VerifiCasa website on its own server: create an
// account with the emailed code, the admin panel, a listing going from
// posted to approved to public, the integrations panel, and the tour app
// alongside it. Run `npm run build` first.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { createApp } from '../server/app.js';
import { createPlatform } from '../server/platform/index.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const shots = path.join(root, 'test-e2e', 'screenshots');
await fs.mkdir(shots, { recursive: true });
const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'verificasa-site-'));
const mail = [];
const platform = createPlatform({
  dataDir, siteDir: path.join(root, 'site'), cacheDir: path.join(dataDir, 'fn'), scheduler: false, log() {},
  env: { ADMIN_EMAILS: 'admin@verificasa.test', INTEGRATIONS_MASTER_KEY: 'o-fraza-lunga-si-aleatorie-de-test' },
  mailer: { configured: false, async send(m) { mail.push(m); } },
});
const app = await createApp({
  dataDir, sampleDir: path.join(root, 'assets', 'sample'), proStitch: false, platform,
  siteDist: path.join(root, 'site', 'dist'), webDist: path.join(root, 'web', 'dist'),
});
const server = app.listen(0);
await new Promise((r) => server.once('listening', r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errors = [];
const step = (s) => console.log(`• ${s}`);
const api = async (method, url, token, body) => {
  const res = await fetch(base + url, {
    method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body && JSON.stringify(body),
  });
  return res.json();
};

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  page.on('pageerror', (e) => errors.push(e.message));
  // Fonts, map tiles and stock photos come from the internet, which tests don't have.
  page.on('response', (r) => { if (r.url().startsWith(base) && r.status() >= 500) errors.push(`${r.status()} ${r.url()}`); });

  step('the home page is the website, served by this server');
  await page.goto(base, { waitUntil: 'networkidle' });
  assert.match(await page.title(), /VerifiCasa/);
  await page.evaluate(() => localStorage.setItem('vc_cookie_consent', JSON.stringify({ necessary: true })));

  step('create an account: email, password, name, then the 6-digit code from the email');
  await page.goto(`${base}/register`, { waitUntil: 'networkidle' });
  await page.locator('input[type=email]').fill('admin@verificasa.test');
  await page.locator('input[type=password]').nth(0).fill('parola-admin-1');
  await page.locator('input[type=password]').nth(1).fill('parola-admin-1');
  await page.locator('form input[type=text]').first().fill('Admin VerifiCasa');
  await page.locator('input[type=checkbox]').first().check();
  await page.getByRole('button', { name: /Creează cont/ }).click();
  await page.waitForFunction(() => document.querySelector('input[autocomplete="one-time-code"], input[inputmode="numeric"]'));
  const code = mail.at(-1).subject.match(/\d{6}/)[0];
  await page.locator('input[autocomplete="one-time-code"], input[inputmode="numeric"]').first().fill(code);
  await page.getByRole('button', { name: /Confirm|Verific/i }).first().click();
  await page.waitForURL((u) => !/login|register/.test(u.pathname), { timeout: 15000 });
  const token = await page.evaluate(() => localStorage.getItem('base44_access_token'));
  const me = await api('GET', '/api/platform/me', token);
  assert.equal(me.full_name, 'Admin VerifiCasa');
  assert.equal(me.role, 'SUPER_ADMIN');

  step('someone posts a listing; it waits for approval');
  mail.length = 0;
  await api('POST', '/api/platform/auth/register', null, { email: 'ion@verificasa.test', password: 'parola-ion-1' });
  const ion = await api('POST', '/api/platform/auth/verify-otp', null, { email: 'ion@verificasa.test', otp_code: mail.at(-1).subject.match(/\d{6}/)[0] });
  const prop = await api('POST', '/api/platform/entities/Property', ion.access_token, {
    title: 'Apartament 2 camere lângă Parcul Central', city: 'Cluj-Napoca', county: 'Cluj', zone: 'Centru', price_monthly: 520,
    property_type: '2 Camere', rooms: 2, surface_sqm: 54, status: 'Activ', approval_status: 'APPROVED', country: 'RO',
  });
  assert.equal(prop.approval_status, 'PENDING');

  step('the admin panel shows it waiting; approving makes it public');
  await page.goto(`${base}/admin`, { waitUntil: 'networkidle' });
  await page.getByText('Apartament 2 camere lângă Parcul Central').first().waitFor({ timeout: 10000 });
  await page.screenshot({ path: path.join(shots, 'site-admin.png') });
  await api('PUT', `/api/platform/entities/Property/${prop.id}`, token, { approval_status: 'APPROVED' });
  await page.goto(`${base}/property/${prop.id}`, { waitUntil: 'networkidle' });
  await page.getByText('Apartament 2 camere lângă Parcul Central').first().waitFor({ timeout: 10000 });
  await page.screenshot({ path: path.join(shots, 'site-property.png') });

  step('integrations panel: a key is saved encrypted and shown only by its last 4 characters');
  await page.goto(`${base}/admin`, { waitUntil: 'networkidle' });
  await page.getByText('Integrări & chei API').first().click();
  const keyInput = page.getByLabel('Valoare pentru GOOGLE_MAPS_API_KEY');
  await keyInput.fill('AIzaTEST-cheie-de-proba-1234');
  await keyInput.locator('xpath=following-sibling::button[1]').click();
  await page.getByText('panou ••••1234').waitFor({ timeout: 10000 });
  const rows = platform.db.all('IntegrationSecret');
  assert.equal(rows.length, 1);
  assert.ok(!JSON.stringify(rows).includes('cheie-de-proba'), 'stored encrypted');
  assert.equal(platform.secrets.get('GOOGLE_MAPS_API_KEY'), 'AIzaTEST-cheie-de-proba-1234', 'functions can read it');
  await page.screenshot({ path: path.join(shots, 'site-integrations.png') });

  step('the tour app lives next to it, and lists the approved listing');
  await page.goto(`${base}/tours`, { waitUntil: 'networkidle' });
  const listings = await (await fetch(`${base}/api/verificasa/listings`)).json();
  assert.ok(JSON.stringify(listings).includes(prop.id));

  assert.deepEqual(errors, []);
  console.log('SITE OK');
} finally {
  await browser.close();
  server.close();
  platform.close();
  await fs.rm(dataDir, { recursive: true, force: true });
}
