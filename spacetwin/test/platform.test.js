import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createApp } from '../server/app.js';
import { createPlatform } from '../server/platform/index.js';
import { matches, ruleAllows, sortRecords } from '../server/platform/query.js';
import { cronMatches } from '../server/platform/scheduler.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let server, base, dataDir, platform;
const mail = [];

before(async () => {
  dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'verificasa-test-'));
  platform = createPlatform({
    dataDir, siteDir: path.join(root, 'site'), cacheDir: path.join(dataDir, 'fn'), scheduler: false, log() {},
    env: { ADMIN_EMAILS: 'owner@verificasa.test', StripeWebhookSecret: 'whsec_test', AUTH_RATE_LIMIT: '1000' },
    mailer: { configured: false, async send(m) { mail.push(m); } },
  });
  const app = await createApp({ dataDir, sampleDir: path.join(root, 'assets', 'sample'), platform, proStitch: false });
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server.close();
  platform.close();
  await fs.rm(dataDir, { recursive: true, force: true });
});

async function call(method, url, { body, token, headers = {} } = {}) {
  const h = { ...headers };
  if (token) h.authorization = `Bearer ${token}`;
  if (body !== undefined && !(body instanceof FormData)) h['content-type'] = 'application/json';
  const res = await fetch(base + url, { method, headers: h, body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let data = text;
  try { data = JSON.parse(text); } catch { /* not JSON */ }
  return { status: res.status, data };
}

const codeFor = (email) => [...mail].reverse().find((m) => m.to === email)?.subject.match(/(\d{6})/)?.[1];

async function signUp(email, name = 'Test User') {
  let r = await call('POST', '/api/platform/auth/register', { body: { email, password: 'parola-sigura' } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  r = await call('POST', '/api/platform/auth/verify-otp', { body: { email, otp_code: codeFor(email) } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  await call('PUT', '/api/platform/me', { body: { full_name: name }, token: r.data.access_token });
  return { token: r.data.access_token, user: r.data.user };
}

test('queries: Mongo-style operators, sorting, rules with {{user.id}}', () => {
  const rec = { id: 'a', city: 'Cluj', price: 500, tags: ['pet', 'parking'], approval_status: 'APPROVED' };
  assert.ok(matches(rec, { city: 'Cluj', price: { $gte: 400, $lt: 600 } }));
  assert.ok(matches(rec, { tags: 'pet' }));
  assert.ok(matches(rec, { $or: [{ city: 'Iași' }, { 'data.price': { $in: [500] } }] }));
  assert.ok(!matches(rec, { city: { $ne: 'Cluj' } }));
  assert.ok(matches(rec, { title: { $exists: false } }));
  assert.deepEqual(sortRecords([{ p: 2 }, { p: null }, { p: 9 }], '-p').map((x) => x.p), [9, 2, null]);

  const rule = { $or: [{ created_by_id: '{{user.id}}' }, { user_condition: { role: 'admin' } }] };
  assert.ok(ruleAllows(rule, { id: 'u1' }, { created_by_id: 'u1' }));
  assert.ok(!ruleAllows(rule, { id: 'u2' }, { created_by_id: 'u1' }));
  assert.ok(!ruleAllows(rule, null, { created_by_id: null }), 'no user never matches a user template');
  assert.ok(ruleAllows(rule, { id: 'x', role: 'admin' }, {}));
  assert.ok(ruleAllows(null, null, {}));
});

test('cron expressions', () => {
  assert.ok(cronMatches('0 3 * * *', new Date('2026-10-24T03:00:00Z')));
  assert.ok(!cronMatches('0 3 * * *', new Date('2026-10-24T04:00:00Z')));
  assert.ok(cronMatches('*/15 * * * 1-5', new Date('2026-10-23T10:30:00Z')));
  assert.ok(!cronMatches('*/15 * * * 1-5', new Date('2026-10-24T10:30:00Z')), 'Saturday');
});

test('accounts: sign up with an emailed code, log in, reset the password', async () => {
  const email = 'ana@verificasa.test';
  let r = await call('POST', '/api/platform/auth/register', { body: { email, password: 'short' } });
  assert.equal(r.status, 400);
  r = await call('POST', '/api/platform/auth/register', { body: { email, password: 'parola-sigura' } });
  assert.equal(r.status, 200);
  assert.match(codeFor(email), /^\d{6}$/);

  r = await call('POST', '/api/platform/auth/login', { body: { email, password: 'parola-sigura' } });
  assert.equal(r.status, 403, 'unconfirmed address cannot log in');
  assert.equal(r.data.extra_data.reason, 'email_not_verified');

  r = await call('POST', '/api/platform/auth/verify-otp', { body: { email, otp_code: '000000' === codeFor(email) ? '111111' : '000000' } });
  assert.equal(r.status, 400);
  r = await call('POST', '/api/platform/auth/verify-otp', { body: { email, otp_code: codeFor(email) } });
  assert.equal(r.status, 200);
  assert.equal(r.data.user.role, 'user');
  const token = r.data.access_token;

  r = await call('GET', '/api/platform/me', { token });
  assert.equal(r.data.email, email);
  r = await call('PUT', '/api/platform/me', { token, body: { full_name: 'Ana', role: 'SUPER_ADMIN' } });
  assert.equal(r.data.full_name, 'Ana');
  assert.equal(r.data.role, 'user', 'users cannot promote themselves');

  r = await call('POST', '/api/platform/auth/login', { body: { email, password: 'wrong-password' } });
  assert.equal(r.status, 401);
  r = await call('POST', '/api/platform/auth/register', { body: { email, password: 'alta-parola-1' } });
  assert.equal(r.status, 409, 'confirmed accounts cannot be re-registered');

  await call('POST', '/api/platform/auth/reset-password-request', { body: { email } });
  const link = mail.at(-1).text.match(/token=([\w-]+)/)[1];
  r = await call('POST', '/api/platform/auth/reset-password', { body: { reset_token: link, new_password: 'parola-noua-2' } });
  assert.equal(r.status, 200);
  r = await call('GET', '/api/platform/me', { token });
  assert.equal(r.status, 401, 'a new password signs out old sessions');
  r = await call('POST', '/api/platform/auth/login', { body: { email, password: 'parola-noua-2' } });
  assert.equal(r.status, 200);
  r = await call('POST', '/api/platform/auth/reset-password', { body: { reset_token: link, new_password: 'parola-noua-3' } });
  assert.equal(r.status, 400, 'reset links work once');
});

test('listings: owners write their own, guards stop self-approval, admins approve', async () => {
  const owner = await signUp('owner@verificasa.test', 'Owner');
  assert.equal(owner.user.role, 'SUPER_ADMIN', 'ADMIN_EMAILS become SUPER_ADMIN');
  const ion = await signUp('ion@verificasa.test', 'Ion');
  const maria = await signUp('maria@verificasa.test', 'Maria');

  let r = await call('POST', '/api/platform/entities/Property', {
    token: ion.token,
    body: { title: 'Garsonieră Cluj', city: 'Cluj-Napoca', price_monthly: 450, approval_status: 'APPROVED', featured: true, trust_score: 100, views_count: 999 },
  });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const prop = r.data;
  assert.equal(prop.created_by_id, ion.user.id);
  assert.equal(prop.approval_status, 'PENDING', 'owners cannot approve their own listing');
  assert.equal(prop.featured, false);
  assert.notEqual(prop.trust_score, 100);
  assert.equal(prop.views_count, 0);
  assert.equal(prop.currency, 'EUR', 'schema defaults applied');

  r = await call('PUT', `/api/platform/entities/Property/${prop.id}`, { token: maria.token, body: { title: 'hijack' } });
  assert.equal(r.status, 403);
  r = await call('DELETE', `/api/platform/entities/Property/${prop.id}`, { token: maria.token });
  assert.equal(r.status, 403);
  r = await call('POST', '/api/platform/entities/Property', { body: { title: 'anon' } });
  assert.equal(r.status, 403, 'anonymous visitors cannot post');

  r = await call('PUT', `/api/platform/entities/Property/${prop.id}`, { token: owner.token, body: { approval_status: 'APPROVED', status: 'Activ' } });
  assert.equal(r.data.approval_status, 'APPROVED');
  r = await call('PUT', `/api/platform/entities/Property/${prop.id}`, { token: ion.token, body: { title: 'Garsonieră renovată', approval_status: 'APPROVED' } });
  assert.equal(r.data.title, 'Garsonieră renovată');
  assert.equal(r.data.approval_status, 'APPROVED', 'unchanged, not raised');

  const q = encodeURIComponent(JSON.stringify({ approval_status: 'APPROVED', city: 'Cluj-Napoca' }));
  r = await call('GET', `/api/platform/entities/Property?q=${q}&sort=-created_date&limit=10`);
  assert.equal(r.data.length, 1, 'anyone can read approved listings');

  // the tour app reads the same listings from the same database
  r = await call('GET', '/api/verificasa/listings');
  assert.equal(r.data.listings?.length ?? r.data.length, 1);
});

test('private records: messages, notifications, users', async () => {
  const a = await signUp('a@verificasa.test', 'A');
  const b = await signUp('b@verificasa.test', 'B');
  const c = await signUp('c@verificasa.test', 'C');

  let r = await call('POST', '/api/platform/entities/Message', { token: a.token, body: { sender_id: a.user.id, recipient_id: b.user.id, content: 'Bună!' } });
  assert.equal(r.status, 200);
  const msg = r.data;
  r = await call('POST', '/api/platform/entities/Message', { token: c.token, body: { sender_id: a.user.id, recipient_id: b.user.id, content: 'fake' } });
  assert.equal(r.status, 200, 'created_by_id still matches the rule');
  r = await call('GET', '/api/platform/entities/Message', { token: c.token });
  assert.ok(r.data.every((m) => m.created_by_id === c.user.id), 'C sees only their own');
  r = await call('GET', `/api/platform/entities/Message/${msg.id}`, { token: c.token });
  assert.equal(r.status, 404);

  r = await call('PUT', `/api/platform/entities/Message/${msg.id}`, { token: b.token, body: { content: 'edited by B', read_at: '2026-10-24T10:00:00Z' } });
  assert.equal(r.data.content, 'Bună!', 'the recipient can only mark it read');
  assert.equal(r.data.read_at, '2026-10-24T10:00:00Z');

  r = await call('GET', `/api/platform/entities/User/${a.user.id}`);
  assert.equal(r.data.full_name, 'A');
  assert.equal(r.data.email, undefined, 'emails are private');
  r = await call('GET', `/api/platform/entities/User/${a.user.id}`, { token: a.token });
  assert.equal(r.data.email, 'a@verificasa.test');
  r = await call('PUT', `/api/platform/entities/User/${a.user.id}`, { token: b.token, body: { full_name: 'x' } });
  assert.equal(r.status, 403);

  r = await call('GET', '/api/platform/entities/AuditLog');
  assert.deepEqual(r.data, []);
});

test('comments: anyone signed in can like, only the author can edit', async () => {
  const a = await signUp('ca@verificasa.test', 'CA');
  const b = await signUp('cb@verificasa.test', 'CB');
  const { data: com } = await call('POST', '/api/platform/entities/Comment', { token: a.token, body: { property_id: 'p1', content: 'Frumos', user_id: a.user.id, likes: [] } });
  let r = await call('PUT', `/api/platform/entities/Comment/${com.id}`, { token: b.token, body: { likes: [b.user.id] } });
  assert.equal(r.status, 200);
  r = await call('PUT', `/api/platform/entities/Comment/${com.id}`, { token: b.token, body: { content: 'spam' } });
  assert.equal(r.status, 403);
});

test('uploads keep only media files', async () => {
  const a = await signUp('up@verificasa.test');
  const form = new FormData();
  form.append('file', new Blob([Buffer.from([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' }), 'poza.jpg');
  let r = await call('POST', '/api/platform/upload', { token: a.token, body: form });
  assert.match(r.data.file_url, /^\/files\/[0-9a-f]{24}\.jpg$/);
  const got = await fetch(base + r.data.file_url);
  assert.equal(got.status, 200);
  assert.equal(got.headers.get('x-content-type-options'), 'nosniff');

  const bad = new FormData();
  bad.append('file', new Blob(['<script>alert(1)</script>'], { type: 'text/html' }), 'x.html');
  r = await call('POST', '/api/platform/upload', { token: a.token, body: bad });
  assert.equal(r.status, 415);
  r = await call('POST', '/api/platform/upload', { body: form });
  assert.equal(r.status, 401, 'visitors cannot upload');
});

test('backend functions run unchanged, with the caller\'s identity', async () => {
  const a = await signUp('fn@verificasa.test', 'Fn');
  const { data: prop } = await call('POST', '/api/platform/entities/Property', { token: a.token, body: { title: 'Casă', city: 'Iași' } });

  let r = await call('POST', '/api/platform/functions/IncrementViews', { body: { property_id: prop.id } });
  assert.deepEqual(r.data, { ok: true, views_count: 1 });

  r = await call('POST', '/api/platform/functions/SyncPosterPlans', { token: a.token, body: {} });
  assert.match(r.data.error, /administratorii/, 'admin-only functions refuse users');
  r = await call('POST', '/api/platform/functions/SyncPosterPlans', { body: {}, headers: { 'x-verificasa-system': 'guess' } });
  assert.ok(r.data.error, 'the system identity cannot be claimed from outside');

  r = await call('POST', '/api/platform/functions/NoSuchFunction', { body: {} });
  assert.equal(r.status, 404);
});

test('the Stripe webhook checks the signature on the raw body', async () => {
  const payload = JSON.stringify({ id: 'evt_1', type: 'ping', data: { object: {} } });
  let r = await call('POST', '/api/platform/functions/StripeWebhook', { body: JSON.parse(payload), headers: { 'stripe-signature': 't=1,v1=bad' } });
  assert.ok(r.status >= 400 || r.data.error, 'bad signature refused');

  const t = Math.floor(Date.now() / 1000);
  const v1 = createHmac('sha256', 'whsec_test').update(`${t}.${payload}`).digest('hex');
  const res = await fetch(`${base}/api/platform/functions/StripeWebhook`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': `t=${t},v1=${v1}` }, body: payload,
  });
  const out = await res.json();
  assert.equal(res.status, 200, JSON.stringify(out));
  assert.ok(!out.error, JSON.stringify(out));
});

test('live updates reach only the people allowed to see them', async () => {
  const a = await signUp('rt-a@verificasa.test');
  const b = await signUp('rt-b@verificasa.test');
  const ctrl = new AbortController();
  const res = await fetch(`${base}/api/platform/realtime?entities=Notification&token=${encodeURIComponent(b.token)}`, { signal: ctrl.signal });
  const reader = res.body.getReader();
  const seen = [];
  const pump = (async () => {
    let buf = '';
    for (;;) {
      const { value, done } = await reader.read().catch(() => ({ done: true }));
      if (done) return;
      buf += Buffer.from(value).toString();
      for (const m of buf.matchAll(/^data: (.*)$/gm)) seen.push(JSON.parse(m[1]));
      buf = buf.slice(buf.lastIndexOf('\n') + 1);
    }
  })();
  const svc = platform.entities.handler('Notification', { service: true });
  await svc.create({ user_id: a.user.id, text: 'for A' });
  await svc.create({ user_id: b.user.id, text: 'for B' });
  await new Promise((r) => setTimeout(r, 200));
  ctrl.abort();
  await pump;
  assert.deepEqual(seen.map((e) => e.data.text), ['for B']);
});

test('the website and the tour app share one server', async () => {
  const siteDist = path.join(dataDir, 'site-dist'), webDist = path.join(dataDir, 'web-dist');
  await fs.mkdir(path.join(siteDist, 'assets'), { recursive: true });
  await fs.mkdir(path.join(webDist, 'tour-assets'), { recursive: true });
  await fs.writeFile(path.join(siteDist, 'index.html'), 'SITE');
  await fs.writeFile(path.join(webDist, 'index.html'), 'TOURS');
  await fs.writeFile(path.join(webDist, 'tour-assets', 'a.js'), 'x');
  const app = await createApp({ dataDir, sampleDir: path.join(root, 'assets', 'sample'), platform, siteDist, webDist, proStitch: false });
  const s2 = app.listen(0);
  await new Promise((r) => s2.once('listening', r));
  const at = (u) => fetch(`http://127.0.0.1:${s2.address().port}${u}`).then(async (r) => [r.status, await r.text()]);
  try {
    assert.deepEqual(await at('/'), [200, 'SITE']);
    assert.deepEqual(await at('/property/abc'), [200, 'SITE']);
    assert.deepEqual(await at('/tours'), [200, 'TOURS']);
    assert.deepEqual(await at('/3D/ab12cd34ef56'), [200, 'TOURS']);
    assert.deepEqual(await at('/tour-assets/a.js'), [200, 'x']);
    assert.equal((await at('/api/platform/config'))[0], 200);
    assert.equal((await at('/api/spaces'))[0], 200);
  } finally {
    s2.close();
  }
});
