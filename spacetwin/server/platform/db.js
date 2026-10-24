// The VerifiCasa database: one SQLite file (Node's built-in node:sqlite), no
// separate database server to run. Every entity lives in one table as JSON;
// each entity is also kept in memory, so reads never touch the disk.
//
// Fine for tens of thousands of listings on one server. Past that, move the
// records table to Postgres behind the same Db methods.

import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export function newRecordId() {
  return randomBytes(12).toString('hex');
}

// Base44 schema files are JSON with comments.
export function readJsonc(file) {
  const text = fs.readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^(\s*)\/\/.*$/gm, '$1')
    .replace(/,(\s*[}\]])/g, '$1');
  return JSON.parse(text);
}

export function loadSchemas(dir) {
  const schemas = new Map();
  if (!fs.existsSync(dir)) return schemas;
  for (const f of fs.readdirSync(dir)) {
    if (!/\.jsonc?$/.test(f)) continue;
    const s = readJsonc(path.join(dir, f));
    schemas.set(s.name, s);
  }
  return schemas;
}

export class Db {
  constructor(file) {
    if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
    this.sql = new DatabaseSync(file);
    this.sql.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      CREATE TABLE IF NOT EXISTS records (
        entity TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL,
        PRIMARY KEY (entity, id));
      CREATE TABLE IF NOT EXISTS credentials (
        user_id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT,
        email_verified INTEGER NOT NULL DEFAULT 0, otp_hash TEXT, otp_expires INTEGER, otp_tries INTEGER NOT NULL DEFAULT 0,
        reset_hash TEXT, reset_expires INTEGER, google_sub TEXT UNIQUE, token_version INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    `);
    this.cache = new Map(); // entity → Map(id → record)
    this.stmt = {
      all: this.sql.prepare('SELECT data FROM records WHERE entity = ?'),
      put: this.sql.prepare('INSERT INTO records (entity, id, data) VALUES (?, ?, ?) ON CONFLICT(entity, id) DO UPDATE SET data = excluded.data'),
      del: this.sql.prepare('DELETE FROM records WHERE entity = ? AND id = ?'),
    };
  }

  table(entity) {
    let t = this.cache.get(entity);
    if (!t) {
      t = new Map();
      for (const row of this.stmt.all.all(entity)) {
        const rec = JSON.parse(row.data);
        t.set(rec.id, rec);
      }
      this.cache.set(entity, t);
    }
    return t;
  }

  all(entity) { return [...this.table(entity).values()]; }
  get(entity, id) { return this.table(entity).get(id) ?? null; }

  put(entity, rec) {
    this.stmt.put.run(entity, rec.id, JSON.stringify(rec));
    this.table(entity).set(rec.id, rec);
    return rec;
  }

  remove(entity, id) {
    this.stmt.del.run(entity, id);
    this.table(entity).delete(id);
  }

  transaction(fn) {
    this.sql.exec('BEGIN');
    try {
      const out = fn();
      this.sql.exec('COMMIT');
      return out;
    } catch (e) {
      this.sql.exec('ROLLBACK');
      this.cache.clear(); // memory may hold rolled-back writes
      throw e;
    }
  }

  setting(key, make) {
    const row = this.sql.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    if (row) return row.value;
    const value = make();
    this.sql.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(key, value);
    return value;
  }

  close() { this.sql.close(); }
}
