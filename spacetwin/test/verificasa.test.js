// VerifiCasa link: listings come from the website's Base44 backend (mocked
// here with a local server answering like Base44's entities API), a tour can
// be started from a listing, and phone captures are reported as "on site"
// without exposing where exactly they were taken.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { createApp } from '../server/app.js';
import { createVerificasaClient, distanceMeters } from '../server/verificasa.js';

const APP = 'testapp123';
const PROPERTIES = [
  {
    id: 'p1', title: 'Apartament 2 camere Aviației', price_monthly: 145000, currency: 'EUR', transaction_type: 'SALE',
    city: 'București', zone: 'Aviației', landmark: 'Str. Nicolae Caramfil', property_type: '2 Camere', rooms: 2, surface_sqm: 64,
    images: ['https://example.com/a.jpg'], phone: '+40 712 345 678', posted_by_name: 'Andrei Mocanu', poster_plan: 'pro',
    seller_role: 'Proprietar', latitude: 44.4800, longitude: 26.0950, views_count: 1284, status: 'Activ', approval_status: 'APPROVED',
  },
  { id: 'p2', title: 'Garsonieră Cluj', price_monthly: 450, currency: 'EUR', transaction_type: 'RENT', city: 'Cluj-Napoca', status: 'Activ', approval_status: 'APPROVED' },
];

let base44, base, server, dataDir;
const seen = [];

before(async () => {
  base44 = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    seen.push(url.pathname + url.search);
    const prefix = `/api/apps/${APP}/entities/Property`;
    res.setHeader('content-type', 'application/json');
    if (url.pathname === prefix) {
      const q = JSON.parse(url.searchParams.get('q') ?? '{}');
      return res.end(JSON.stringify(PROPERTIES.filter((p) => Object.entries(q).every(([k, v]) => p[k] === v))));
    }
    const one = PROPERTIES.find((p) => url.pathname === `${prefix}/${p.id}`);
    if (one) return res.end(JSON.stringify(one));
    res.statusCode = 404;
    res.end('{"message":"not found"}');
  });
  base44.listen(0);
  await new Promise((r) => base44.once('listening', r));
  const verificasa = createVerificasaClient({ config: { api: `http://127.0.0.1:${base44.address().port}`, appId: APP, site: 'https://verificasa.ro' } });
  dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spacetwin-vc-'));
  const app = await createApp({ dataDir, verificasa, proStitch: false });
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});

after(async () => {
  server.close();
  base44.close();
  await fs.rm(dataDir, { recursive: true, force: true });
});

const json = async (res) => ({ status: res.status, body: await res.json() });
const post = (url, body) => fetch(`${base}${url}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

test('active, approved listings are listed, newest first, with the fields the app uses', async () => {
  const { status, body } = await json(await fetch(`${base}/verificasa/listings`));
  assert.equal(status, 200);
  assert.equal(body.listings.length, 2);
  const [a] = body.listings;
  assert.equal(a.url, 'https://verificasa.ro/property/p1');
  assert.equal(a.address, 'Str. Nicolae Caramfil, Aviației, București');
  assert.deepEqual([a.price, a.currency, a.transaction, a.rooms, a.surface, a.posterPlan, a.views], [145000, 'EUR', 'SALE', 2, 64, 'pro', 1284]);
  const q = new URLSearchParams(seen.at(-1).split('?')[1]);
  assert.deepEqual(JSON.parse(q.get('q')), { approval_status: 'APPROVED', status: 'Activ' });
  assert.equal(q.get('sort'), '-created_date');

  const cluj = await json(await fetch(`${base}/verificasa/listings?search=cluj`));
  assert.deepEqual(cluj.body.listings.map((l) => l.id), ['p2']);
});

test('a tour started from a listing is prefilled, and reopening it does not duplicate it', async () => {
  const first = await json(await post('/spaces/from-listing', { propertyId: 'p1' }));
  assert.equal(first.status, 201);
  assert.equal(first.body.name, 'Apartament 2 camere Aviației');
  assert.equal(first.body.listing.price, 145000);
  assert.equal(first.body.listing.status, 'For sale');
  assert.equal(first.body.listing.contactPhone, '+40 712 345 678');
  assert.equal(first.body.verificasa.url, 'https://verificasa.ro/property/p1');
  assert.equal(first.body.verificasa.posterPlan, 'pro');

  const again = await json(await post('/spaces/from-listing', { propertyId: 'p1' }));
  assert.equal(again.status, 200);
  assert.equal(again.body.id, first.body.id);

  const missing = await json(await post('/spaces/from-listing', { propertyId: 'nope' }));
  assert.equal(missing.status, 404);
  const bad = await json(await post('/spaces/from-listing', { propertyId: '../x' }));
  assert.equal(bad.status, 400);
});

test('phone captures count as "on site": date and distance from the listing, never the coordinates', async () => {
  const { body: space } = await json(await post('/spaces/from-listing', { propertyId: 'p1' }));
  const pano = await fs.readFile(new URL('../assets/sample/scan-1.jpg', import.meta.url));
  const form = new FormData();
  form.append('panorama', new Blob([pano], { type: 'image/jpeg' }), 'living.jpg');
  // ~55 m north of the listing's pin
  form.append('capture', JSON.stringify({ method: 'guided', at: '2026-09-12T10:00:00Z', latitude: 44.4805, longitude: 26.0950, accuracy: 12 }));
  const { status, body } = await json(await fetch(`${base}/spaces/${space.id}/scans`, { method: 'POST', body: form }));
  assert.equal(status, 201, JSON.stringify(body));
  assert.equal(body.onSite.capturedAt, '2026-09-12T10:00:00.000Z');
  assert.equal(body.onSite.distance, 56);
  assert.equal(body.onSite.spots, 1);
  const scan = body.scans.at(-1);
  assert.deepEqual(scan.capture, { at: '2026-09-12T10:00:00.000Z', method: 'guided' });
  const raw = JSON.stringify(await (await fetch(`${base}/spaces/${space.id}`)).json());
  assert.doesNotMatch(raw, /44\.4805|latitude/, 'coordinates stay on the server');

  const badForm = new FormData();
  badForm.append('panorama', new Blob([pano], { type: 'image/jpeg' }), 'x.jpg');
  badForm.append('capture', JSON.stringify({ latitude: 200, longitude: 0 }));
  assert.equal((await fetch(`${base}/spaces/${space.id}/scans`, { method: 'POST', body: badForm })).status, 400);
});

test('an unreachable VerifiCasa is reported, not hidden', async () => {
  const offline = createVerificasaClient({ config: { api: 'http://127.0.0.1:9', appId: APP, site: 'https://verificasa.ro' } });
  await assert.rejects(offline.listings(), /cannot reach VerifiCasa/);
});

test('distanceMeters', () => {
  assert.equal(Math.round(distanceMeters({ latitude: 44.48, longitude: 26.095 }, { latitude: 44.48, longitude: 26.095 })), 0);
  assert.equal(Math.round(distanceMeters({ latitude: 0, longitude: 0 }, { latitude: 1, longitude: 0 }) / 1000), 111);
});
