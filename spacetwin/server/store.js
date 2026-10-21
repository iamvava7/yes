// File-backed storage: one directory per space holding space.json and its panoramas.
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const ID_RE = /^[a-z0-9]{12}$/;

export function newId() {
  return randomUUID().replace(/-/g, '').slice(0, 12);
}

export function isId(id) {
  return typeof id === 'string' && ID_RE.test(id);
}

export class NotFoundError extends Error {}

export class Store {
  constructor(dataDir) {
    this.root = path.join(dataDir, 'spaces');
    this.locks = new Map();
  }

  async init() {
    await fs.mkdir(this.root, { recursive: true });
  }

  dir(id) {
    if (!isId(id)) throw new NotFoundError(`space ${id} not found`);
    return path.join(this.root, id);
  }

  panoPath(spaceId, file) {
    return path.join(this.dir(spaceId), 'panos', path.basename(file));
  }

  async list() {
    const entries = await fs.readdir(this.root, { withFileTypes: true });
    const spaces = [];
    for (const e of entries) {
      if (!e.isDirectory() || !isId(e.name)) continue;
      try {
        spaces.push(await this.get(e.name));
      } catch {
        // half-deleted or corrupt space; skip it
      }
    }
    return spaces.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async get(id) {
    try {
      return JSON.parse(await fs.readFile(path.join(this.dir(id), 'space.json'), 'utf8'));
    } catch (err) {
      if (err.code === 'ENOENT') throw new NotFoundError(`space ${id} not found`);
      throw err;
    }
  }

  async create(name) {
    const now = new Date().toISOString();
    const space = { id: newId(), name, createdAt: now, updatedAt: now, scans: [], rooms: [], tags: [] };
    await fs.mkdir(path.join(this.dir(space.id), 'panos'), { recursive: true });
    await this.write(space);
    return space;
  }

  /** Serialised read-modify-write so concurrent edits to one space never interleave. */
  update(id, mutate) {
    const prev = this.locks.get(id) ?? Promise.resolve();
    const next = prev.catch(() => {}).then(async () => {
      const space = await this.get(id);
      const result = await mutate(space);
      space.updatedAt = new Date().toISOString();
      await this.write(space);
      return result === undefined ? space : result;
    });
    this.locks.set(id, next);
    next.finally(() => {
      if (this.locks.get(id) === next) this.locks.delete(id);
    }).catch(() => {});
    return next;
  }

  async write(space) {
    const file = path.join(this.dir(space.id), 'space.json');
    const tmp = `${file}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(space, null, 2));
    await fs.rename(tmp, file);
  }

  async remove(id) {
    await this.get(id);
    await fs.rm(this.dir(id), { recursive: true, force: true });
  }
}
