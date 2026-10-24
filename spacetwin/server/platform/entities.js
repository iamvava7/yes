// Entity access with the same rules and calls the website used on Base44:
// list / filter / get / create / update / delete / bulk… , checked against
// each schema's row-level security ("rls"). The service role (backend
// functions acting on their own) skips the checks, as on Base44.

import { EventEmitter } from 'node:events';
import { newRecordId } from './db.js';
import { FIELD_GUARDS, OPEN_UPDATES } from './guards.js';
import { matches, ruleAllows, sortRecords } from './query.js';

export const ADMIN_ROLES = ['admin', 'ADMIN', 'SUPER_ADMIN'];
const OWNER_ROLES = ['admin', 'SUPER_ADMIN']; // may hand out any role
const PROTECTED = ['id', 'created_date', 'updated_date', 'created_by', 'created_by_id'];
const USER_ADMIN_ONLY = ['role', 'is_verified', 'email'];
const MAX_ROWS = 5000;

export class PlatformError extends Error {
  constructor(status, message, extra) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

export const isAdmin = (user) => Boolean(user && ADMIN_ROLES.includes(user.role));

const ownerOrAdmin = { $or: [{ created_by_id: '{{user.id}}' }, ...ADMIN_ROLES.map((role) => ({ user_condition: { role } }))] };

// What other people may see of a user.
export function publicUser(u) {
  if (!u) return u;
  const { email, email_notify_messages, email_notify_reviews, last_name_change_date, ...rest } = u;
  if (rest.phone_public === false) delete rest.phone;
  if (rest.whatsapp_visible === false) delete rest.whatsapp_phone;
  return rest;
}

function strip(data) {
  const out = { ...(data || {}) };
  for (const k of PROTECTED) delete out[k];
  return out;
}

function project(rec, fields) {
  if (!fields) return rec;
  const keep = new Set(String(fields).split(',').map((s) => s.trim()).concat('id'));
  return Object.fromEntries(Object.entries(rec).filter(([k]) => keep.has(k)));
}

function defaults(schema) {
  const out = {};
  for (const [k, p] of Object.entries(schema?.properties ?? {})) {
    if (p && 'default' in p) out[k] = structuredClone(p.default);
  }
  return out;
}

export function createEntities({ db, schemas }) {
  const bus = new EventEmitter();
  bus.setMaxListeners(0);

  const known = (name) => name === 'User' || schemas.has(name);
  const rule = (name, op) => {
    const rls = schemas.get(name)?.rls;
    if (rls && op in rls) return rls[op];
    return op === 'read' ? null : ownerOrAdmin;
  };

  function emit(entity, type, rec, previous = null) {
    bus.emit('change', { entity, type, id: rec.id, data: rec, previous, timestamp: new Date().toISOString() });
  }

  // How a record looks to this actor, or null when they may not see it.
  function visible(name, actor, rec) {
    if (!rec) return null;
    if (actor.service) return rec;
    const user = actor.user;
    if (name === 'User') {
      if (user && (user.id === rec.id || isAdmin(user))) return rec;
      if (rec.profile_visibility === 'authenticated_only' && !user) return null;
      return publicUser(rec);
    }
    return ruleAllows(rule(name, 'read'), user, rec) ? rec : null;
  }

  function canWrite(name, op, actor, rec) {
    if (actor.service) return true;
    const user = actor.user;
    if (name === 'User') {
      if (!user) return false;
      if (op === 'create') return isAdmin(user);
      return user.id === rec.id || isAdmin(user);
    }
    return ruleAllows(rule(name, op), user, rec);
  }

  function handler(name, actor) {
    if (!known(name)) throw new PlatformError(404, `Entity ${name} not found`);
    const schema = schemas.get(name);
    const guard = !actor.service && !isAdmin(actor.user) ? FIELD_GUARDS[name] : null;
    const guarded = (data, prev) => (guard ? guard(data, { prev, user: actor.user, db }) : data);

    const read = (query, sort, limit, skip, fields) => {
      let rows = db.all(name).map((r) => visible(name, actor, r)).filter(Boolean);
      if (query && Object.keys(query).length) rows = rows.filter((r) => matches(r, query));
      sortRecords(rows, sort || '-created_date');
      const from = Math.max(0, Number(skip) || 0);
      const n = Math.min(MAX_ROWS, Number(limit) > 0 ? Number(limit) : MAX_ROWS);
      return rows.slice(from, from + n).map((r) => project(r, fields));
    };

    const get = (id) => {
      const rec = visible(name, actor, db.get(name, String(id)));
      if (!rec) throw new PlatformError(404, `${name} ${id} not found`);
      return rec;
    };

    const create = (data) => {
      const now = new Date().toISOString();
      const rec = {
        ...defaults(schema), ...guarded(strip(data), null),
        id: newRecordId(), created_date: now, updated_date: now,
        created_by: actor.user?.email ?? null, created_by_id: actor.user?.id ?? null,
      };
      if (!canWrite(name, 'create', actor, rec)) throw new PlatformError(403, `Not allowed to create ${name}`);
      db.put(name, rec);
      emit(name, 'create', rec);
      return rec;
    };

    const update = (id, data) => {
      const prev = db.get(name, String(id));
      if (!prev || !visible(name, actor, prev)) throw new PlatformError(404, `${name} ${id} not found`);
      let patch = strip(data);
      const open = OPEN_UPDATES[name];
      const openOnly = open && actor.user && Object.keys(patch).length && Object.keys(patch).every((k) => open.includes(k));
      if (!openOnly && !canWrite(name, 'update', actor, prev)) throw new PlatformError(403, `Not allowed to update ${name}`);
      patch = guarded(patch, prev);
      if (name === 'User' && !actor.service) {
        const user = actor.user;
        if (!isAdmin(user)) for (const k of USER_ADMIN_ONLY) delete patch[k];
        delete patch.email; // the login address changes only through the account flow
        if ('role' in patch && !OWNER_ROLES.includes(user.role) && ['admin', 'SUPER_ADMIN'].includes(patch.role)) {
          throw new PlatformError(403, 'Only the owner can grant that role');
        }
      }
      const rec = { ...prev, ...patch, updated_date: new Date().toISOString() };
      db.put(name, rec);
      emit(name, 'update', rec, prev);
      return rec;
    };

    const remove = (id) => {
      const prev = db.get(name, String(id));
      if (!prev || !visible(name, actor, prev)) throw new PlatformError(404, `${name} ${id} not found`);
      if (!canWrite(name, 'delete', actor, prev)) throw new PlatformError(403, `Not allowed to delete ${name}`);
      db.remove(name, prev.id);
      if (name === 'User') bus.emit('user-deleted', prev);
      emit(name, 'delete', prev);
      return { success: true, id: prev.id };
    };

    return {
      list: async (sort, limit, skip, fields) => (sort && typeof sort === 'object'
        ? read(null, sort.sort, sort.limit, sort.skip, sort.fields)
        : read(null, sort, limit, skip, fields)),
      filter: async (query, sort, limit, skip, fields) => (sort && typeof sort === 'object'
        ? read(query, sort.sort, sort.limit, sort.skip, sort.fields)
        : read(query, sort, limit, skip, fields)),
      get: async (id) => get(id),
      create: async (data) => create(data),
      update: async (id, data) => update(id, data),
      delete: async (id) => remove(id),
      bulkCreate: async (list) => db.transaction(() => (list || []).map(create)),
      bulkUpdate: async (list) => db.transaction(() => (list || []).map(({ id, ...data }) => update(id, data))),
      deleteMany: async (query) => {
        const ids = read(query || {}).map((r) => r.id);
        db.transaction(() => ids.forEach(remove));
        return { success: true, deleted: ids.length };
      },
      updateMany: async (query, data) => {
        const patch = data?.$set ?? data;
        const ids = read(query || {}).map((r) => r.id);
        db.transaction(() => ids.forEach((id) => update(id, patch)));
        return { success: true, updated: ids.length };
      },
      count: async (query) => read(query || {}).length,
    };
  }

  return { bus, known, visible, handler, schemas };
}
