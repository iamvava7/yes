// Brings data exported from Base44 into this server's database.
//
//   node scripts/import-base44.js <folder> [--media] [--dry-run]
//
// <folder> holds one file per entity, named after it: Property.csv,
// User.csv, Comment.json, ... (Base44 → Data → <entity> → Export). Records
// keep their ids and dates, so links between them still work.
//
// Users are imported without passwords: each one signs in by choosing
// "Am uitat parola" once (their email is already confirmed).
//
// --media downloads every photo/video still hosted by Base44 into
// data/files and points the records at the copies.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Db, loadSchemas } from '../server/platform/db.js';
import { createFiles } from '../server/platform/files.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith('--'));
const media = args.includes('--media');
const dry = args.includes('--dry-run');
if (!dir) {
  console.error('usage: node scripts/import-base44.js <folder> [--media] [--dry-run]');
  process.exit(1);
}

// RFC 4180 CSV: quoted fields, doubled quotes, newlines inside quotes.
export function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; } else if (c === '"') quoted = false; else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.some((x) => x !== ''));
  return (body || []).map((r) => Object.fromEntries(head.map((h, i) => [h.replace(/^﻿/, '').trim(), r[i] ?? ''])));
}

function coerce(value, prop) {
  if (value === '' || value === undefined) return undefined;
  if (typeof value !== 'string') return value;
  const type = prop?.type;
  if (type === 'number' || type === 'integer') return Number.isFinite(Number(value)) ? Number(value) : undefined;
  if (type === 'boolean') return value === 'true' || value === '1' || value === 'TRUE';
  if (type === 'array' || type === 'object' || /^[[{]/.test(value)) {
    try { return JSON.parse(value); } catch { return type === 'array' ? value.split(',').map((s) => s.trim()).filter(Boolean) : value; }
  }
  return value;
}

function readEntity(file) {
  const text = fs.readFileSync(file, 'utf8');
  if (file.endsWith('.json')) {
    const data = JSON.parse(text);
    return Array.isArray(data) ? data : data.items ?? data.records ?? [];
  }
  return parseCsv(text);
}

const BASE44_MEDIA = /https:\/\/(?:media\.base44\.com|[a-z0-9.-]*base44\.app)\/[^\s"'<>)]+/g;

async function rehost(value, files, seen) {
  if (typeof value === 'string') {
    let out = value;
    for (const url of value.match(BASE44_MEDIA) || []) {
      if (!seen.has(url)) {
        try {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const name = decodeURIComponent(new URL(url).pathname.split('/').pop() || 'file');
          const saved = await files.save(Buffer.from(await res.arrayBuffer()), { name, mime: res.headers.get('content-type') || '' });
          seen.set(url, saved.file_url);
        } catch (e) {
          console.warn(`  could not copy ${url}: ${e.message}`);
          seen.set(url, url);
        }
      }
      out = out.split(url).join(seen.get(url));
    }
    return out;
  }
  if (Array.isArray(value)) return Promise.all(value.map((v) => rehost(v, files, seen)));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = await rehost(v, files, seen);
    return out;
  }
  return value;
}

const dataDir = process.env.DATA_DIR ?? path.join(root, 'data');
const schemas = loadSchemas(path.join(root, 'site', 'base44', 'entities'));
const db = new Db(path.join(dataDir, 'verificasa.db'));
const files = createFiles({ dataDir });
const seen = new Map();
const BUILT_IN = ['id', 'created_date', 'updated_date', 'created_by', 'created_by_id', 'email', 'full_name', 'role'];

let total = 0;
for (const f of fs.readdirSync(dir).sort()) {
  const m = f.match(/^([A-Za-z][A-Za-z0-9_]*)(?:[ _-].*)?\.(csv|json)$/);
  if (!m) continue;
  const name = m[1];
  if (name !== 'User' && !schemas.has(name)) {
    console.warn(`skip ${f}: no entity called ${name}`);
    continue;
  }
  const props = schemas.get(name)?.properties ?? {};
  const rows = readEntity(path.join(dir, f));
  let n = 0;
  for (const raw of rows) {
    const rec = {};
    for (const [k, v] of Object.entries(raw)) {
      if (v === '' || v === null || v === undefined) continue;
      rec[k] = BUILT_IN.includes(k) && typeof v === 'string' ? v : coerce(v, props[k]);
    }
    if (!rec.id) continue;
    if (name === 'User' && rec.email) rec.email = String(rec.email).trim().toLowerCase();
    rec.created_date ??= new Date().toISOString();
    rec.updated_date ??= rec.created_date;
    const final = media ? await rehost(rec, files, seen) : rec;
    if (!dry) {
      db.put(name, final);
      if (name === 'User' && final.email) {
        db.sql.prepare('INSERT OR IGNORE INTO credentials (user_id, email, password_hash, email_verified) VALUES (?, ?, NULL, 1)')
          .run(final.id, final.email);
      }
    }
    n++;
  }
  total += n;
  console.log(`${name}: ${n} record${n === 1 ? '' : 's'}${dry ? ' (dry run)' : ''}`);
}
db.close();
console.log(`Done: ${total} records${media ? `, ${[...seen.values()].filter((v) => v.startsWith('/files/')).length} files copied` : ''}.`);
if (!media && !dry) console.log('Tip: run again with --media to copy photos off Base44 before that storage disappears.');
