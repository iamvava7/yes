// The VerifiCasa website backend, mounted in the SpaceTwin server at
// /api/platform. It replaces Base44: data with row-level security, accounts,
// uploads, email, live updates, the backend functions and their schedules.

import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import multer from 'multer';
import { openSecret, MASTER_SECRET } from '../../site/base44/shared/integrations.js';
import { createAuth } from './auth.js';
import { setCurrent } from './context.js';
import { Db, loadSchemas, readJsonc } from './db.js';
import { createEntities, PlatformError } from './entities.js';
import { createFiles, MAX_UPLOAD } from './files.js';
import { SYSTEM_HEADER } from './fnSdk.js';
import { createFunctions } from './functions.js';
import { createMailer } from './mailer.js';
import { createScheduler } from './scheduler.js';

export function createPlatform({ dataDir, siteDir, cacheDir, env = process.env, mailer, dbFile, scheduler: runSchedules = true, log = console.log }) {
  const backend = path.join(siteDir, 'base44');
  const db = new Db(dbFile ?? path.join(dataDir, 'verificasa.db'));
  const schemas = loadSchemas(path.join(backend, 'entities'));
  const entities = createEntities({ db, schemas });
  mailer ??= createMailer({ dataDir, env, log });
  const auth = createAuth({ db, entities, mailer, env });
  const files = createFiles({ dataDir });
  const systemKey = randomBytes(24).toString('base64url');
  const functions = createFunctions({ dir: path.join(backend, 'functions'), cacheDir: cacheDir ?? path.join(dataDir, '.functions'), systemKey });

  // Keys saved from the admin panel, decrypted once into memory.
  const panelSecrets = new Map();
  async function loadSecrets() {
    panelSecrets.clear();
    const master = env[MASTER_SECRET];
    if (!master) return;
    for (const row of db.all('IntegrationSecret')) {
      try { panelSecrets.set(row.name, await openSecret(master, row)); } catch { /* wrong master key: skip */ }
    }
  }
  const secrets = { get: (name) => panelSecrets.get(name) };
  entities.bus.on('change', (e) => { if (e.entity === 'IntegrationSecret') loadSecrets(); });
  const ready = loadSecrets();

  const platform = { db, schemas, entities, auth, mailer, files, functions, secrets, env, ready, systemKey };
  setCurrent(platform);

  const workflows = loadWorkflows(path.join(backend, 'workflows'));
  const scheduler = createScheduler({ workflows, entities, functions, log });
  if (runSchedules) scheduler.start();
  platform.scheduler = scheduler;
  platform.router = createRouter(platform);
  platform.close = () => { scheduler.stop(); db.close(); };
  return platform;
}

function loadWorkflows(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => /\.jsonc?$/.test(f)).map((f) => readJsonc(path.join(dir, f)));
}

// ---- HTTP ---------------------------------------------------------------

function bearer(req) {
  const h = req.get('authorization') || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
}

// A few attempts per minute per address on the account endpoints.
function limiter(perMinute) {
  const hits = new Map();
  return (req, _res, next) => {
    const now = Date.now();
    const key = req.ip;
    const list = (hits.get(key) || []).filter((t) => now - t < 60_000);
    if (list.length >= perMinute) return next(new PlatformError(429, 'Prea multe încercări. Încearcă din nou peste un minut.'));
    list.push(now);
    hits.set(key, list);
    if (hits.size > 10_000) hits.clear();
    next();
  };
}

function safeReturn(url, origin) {
  try {
    const u = new URL(url || '/', origin);
    return u.origin === origin ? u.toString() : `${origin}/`;
  } catch {
    return `${origin}/`;
  }
}

function createRouter(p) {
  const r = express.Router();
  const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
  const json = express.json({ limit: '10mb' });
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD, files: 1 } });
  const authLimit = limiter(Number(p.env.AUTH_RATE_LIMIT || 20));

  r.use((req, _res, next) => {
    req.user = p.auth.userFromToken(bearer(req));
    req.actor = { user: req.user };
    next();
  });

  const origin = (req) => (p.env.APP_URL ? p.env.APP_URL.replace(/\/$/, '') : `${req.protocol}://${req.get('host')}`);

  r.get('/config', (req, res) => res.json({ providers: p.auth.providers(), appUrl: origin(req), mail: p.mailer.configured }));

  // ---- current user
  r.get('/me', (req, res) => {
    if (!req.user) throw new PlatformError(401, 'Authentication required');
    res.json(req.user);
  });
  r.put('/me', json, wrap(async (req, res) => {
    if (!req.user) throw new PlatformError(401, 'Authentication required');
    res.json(await p.entities.handler('User', req.actor).update(req.user.id, req.body));
  }));

  // ---- accounts
  r.post('/auth/register', authLimit, json, wrap(async (req, res) => res.json(await p.auth.register(req.body || {}))));
  r.post('/auth/verify-otp', authLimit, json, wrap(async (req, res) => res.json(await p.auth.verifyOtp(req.body || {}))));
  r.post('/auth/resend-otp', authLimit, json, wrap(async (req, res) => res.json(await p.auth.resendOtp(req.body?.email))));
  r.post('/auth/login', authLimit, json, wrap(async (req, res) => res.json(await p.auth.login(req.body || {}))));
  r.post('/auth/reset-password-request', authLimit, json, wrap(async (req, res) => res.json(await p.auth.resetRequest(req.body?.email))));
  r.post('/auth/reset-password', authLimit, json, wrap(async (req, res) => res.json(await p.auth.reset(req.body || {}))));
  r.post('/auth/change-password', authLimit, json, wrap(async (req, res) => res.json(await p.auth.changePassword(req.user, req.body || {}))));
  r.post('/auth/logout-everywhere', (req, res) => { p.auth.signOutEverywhere(req.user); res.json({ ok: true }); });

  r.get('/auth/google/login', (req, res) => {
    const from = safeReturn(req.query.from_url, origin(req));
    if (!p.auth.providers().google) return res.redirect(`${origin(req)}/login?error=google_not_configured`);
    const state = p.auth.signState({ from });
    res.redirect(p.auth.googleUrl(state, `${origin(req)}/api/platform/auth/google/callback`));
  });
  r.get('/auth/google/callback', wrap(async (req, res) => {
    const state = p.auth.readState(req.query.state);
    if (!state || !req.query.code) return res.redirect(`${origin(req)}/login?error=google_failed`);
    try {
      const s = await p.auth.googleCallback(String(req.query.code), `${origin(req)}/api/platform/auth/google/callback`);
      const back = new URL(state.from);
      back.searchParams.set('access_token', s.access_token);
      if (s.is_new_user) back.searchParams.set('is_new_user', 'true');
      res.redirect(back.toString());
    } catch {
      res.redirect(`${origin(req)}/login?error=google_failed`);
    }
  }));
  r.get('/auth/logout', (req, res) => res.redirect(safeReturn(req.query.from_url, origin(req))));

  // ---- uploads
  r.post('/upload', (req, _res, next) => next(req.user ? undefined : new PlatformError(401, 'Authentication required')), upload.single('file'), wrap(async (req, res) => {
    if (!req.file) throw new PlatformError(400, 'No file');
    res.json(await p.files.save(req.file.buffer, { name: req.file.originalname, mime: req.file.mimetype }));
  }));

  // ---- backend functions (raw body: the Stripe webhook checks its signature on the exact bytes)
  r.post('/functions/:name', express.raw({ type: () => true, limit: '20mb' }), wrap(async (req, res) => {
    const headers = {};
    for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers[k] = v;
    delete headers['content-length'];
    delete headers[SYSTEM_HEADER]; // only the server itself may act as the system
    const out = await p.functions.run(req.params.name, {
      body: req.body?.length ? req.body : '{}', headers, url: `${origin(req)}/api/platform/functions/${req.params.name}`,
    });
    res.status(out.status);
    out.headers.forEach((v, k) => { if (!['content-length', 'content-encoding', 'transfer-encoding'].includes(k)) res.setHeader(k, v); });
    res.send(Buffer.from(await out.arrayBuffer()));
  }));

  // ---- live updates (Server-Sent Events). EventSource can't send headers, so the token comes as ?token=.
  r.get('/realtime', (req, res) => {
    const names = String(req.query.entities || '').split(',').filter((n) => p.entities.known(n));
    const userId = p.auth.userFromToken(String(req.query.token || ''))?.id ?? null;
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.write('retry: 3000\n\n');
    const onChange = (e) => {
      if (!names.includes(e.entity)) return;
      const actor = { user: userId ? p.db.get('User', userId) : null };
      let type = e.type;
      let rec = p.entities.visible(e.entity, actor, e.data);
      if (!rec && e.previous && p.entities.visible(e.entity, actor, e.previous)) {
        type = 'delete'; // it just left this viewer's sight
        rec = { id: e.id };
      }
      if (!rec) return;
      res.write(`data: ${JSON.stringify({ entity: e.entity, type, id: e.id, data: rec, timestamp: e.timestamp })}\n\n`);
    };
    p.entities.bus.on('change', onChange);
    const ping = setInterval(() => res.write(': ping\n\n'), 25_000);
    req.on('close', () => { clearInterval(ping); p.entities.bus.off('change', onChange); });
  });

  // ---- entities
  const h = (req) => p.entities.handler(req.params.name, req.actor);
  const parseQ = (q) => {
    if (!q) return null;
    try { return JSON.parse(q); } catch { throw new PlatformError(400, 'Invalid query'); }
  };
  r.get('/entities/:name', wrap(async (req, res) => {
    const { q, sort, limit, skip, fields } = req.query;
    res.json(await h(req).filter(parseQ(q), sort, limit, skip, fields));
  }));
  r.get('/entities/:name/count', wrap(async (req, res) => res.json({ count: await h(req).count(parseQ(req.query.q)) })));
  r.get('/entities/:name/:id', wrap(async (req, res) => res.json(await h(req).get(req.params.id))));
  r.post('/entities/:name/bulk', json, wrap(async (req, res) => res.json(await h(req).bulkCreate(req.body))));
  r.put('/entities/:name/bulk', json, wrap(async (req, res) => res.json(await h(req).bulkUpdate(req.body))));
  r.patch('/entities/:name/update-many', json, wrap(async (req, res) => res.json(await h(req).updateMany(req.body?.query, req.body?.data))));
  r.post('/entities/:name', json, wrap(async (req, res) => res.json(await h(req).create(req.body))));
  r.put('/entities/:name/:id', json, wrap(async (req, res) => res.json(await h(req).update(req.params.id, req.body))));
  r.delete('/entities/:name/:id', wrap(async (req, res) => res.json(await h(req).delete(req.params.id))));
  r.delete('/entities/:name', json, wrap(async (req, res) => res.json(await h(req).deleteMany(req.body))));

  r.use((_req, _res, next) => next(new PlatformError(404, 'not found')));
  // eslint-disable-next-line no-unused-vars
  r.use((err, _req, res, _next) => {
    if (err instanceof PlatformError) return res.status(err.status).json({ error: err.message, message: err.message, extra_data: err.extra });
    if (err instanceof multer.MulterError) return res.status(400).json({ error: err.message, message: err.message });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'invalid JSON body' });
    console.error(err);
    res.status(500).json({ error: 'internal error', message: 'internal error' });
  });
  return r;
}
