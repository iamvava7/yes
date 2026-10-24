// Mongo-style matching, sorting and row-level security for VerifiCasa records.
//
// Records are flat objects ({ id, created_date, created_by_id, title, ... }).
// The Base44 schemas address fields as "data.title" in their rules; both
// spellings work here.

export function getPath(rec, key) {
  const parts = key.replace(/^data\./, '').split('.');
  let v = rec;
  for (const p of parts) {
    if (v == null) return undefined;
    v = v[p];
  }
  return v;
}

const isOps = (v) => v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).some((k) => k.startsWith('$'));

function eq(a, b) {
  if (a instanceof Date) a = a.toISOString();
  if (b instanceof Date) b = b.toISOString();
  if (a === b) return true;
  if (a == null && b == null) return true;
  if (typeof a === 'object' && typeof b === 'object' && a && b) return JSON.stringify(a) === JSON.stringify(b);
  return false;
}

// Mongo semantics: a condition on an array field matches when any element does.
function valueMatches(actual, cond) {
  if (isOps(cond)) return Object.entries(cond).every(([op, arg]) => opMatches(actual, op, arg, cond));
  if (Array.isArray(actual) && !Array.isArray(cond)) return actual.some((x) => eq(x, cond));
  return eq(actual, cond);
}

function cmp(a, b) {
  if (a == null || b == null) return NaN;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
}

function opMatches(actual, op, arg, all) {
  const any = (pred) => (Array.isArray(actual) ? actual.some(pred) : pred(actual));
  switch (op) {
    case '$eq': return valueMatches(actual, arg);
    case '$ne': return !valueMatches(actual, arg);
    case '$in': return (arg || []).some((x) => valueMatches(actual, x));
    case '$nin': return !(arg || []).some((x) => valueMatches(actual, x));
    case '$gt': return any((x) => cmp(x, arg) > 0);
    case '$gte': return any((x) => cmp(x, arg) >= 0);
    case '$lt': return any((x) => cmp(x, arg) < 0);
    case '$lte': return any((x) => cmp(x, arg) <= 0);
    case '$exists': return (actual !== undefined && actual !== null) === Boolean(arg);
    case '$regex': {
      let re;
      if (String(arg).length > 200) return false; // queries come from browsers: keep patterns small
      try { re = new RegExp(arg, String(all.$options || '').replace(/[^imsu]/g, '')); } catch { return false; }
      return any((x) => typeof x === 'string' && re.test(x));
    }
    case '$options': return true;
    case '$all': return Array.isArray(actual) && (arg || []).every((x) => actual.some((y) => eq(x, y)));
    case '$size': return Array.isArray(actual) && actual.length === arg;
    case '$not': return !valueMatches(actual, arg);
    default: return false;
  }
}

export function matches(rec, query) {
  if (!query || typeof query !== 'object') return true;
  return Object.entries(query).every(([k, v]) => {
    if (k === '$or') return Array.isArray(v) && v.some((q) => matches(rec, q));
    if (k === '$and') return Array.isArray(v) && v.every((q) => matches(rec, q));
    if (k === '$nor') return Array.isArray(v) && !v.some((q) => matches(rec, q));
    return valueMatches(getPath(rec, k), v);
  });
}

// "-updated_date", "price_monthly", or several separated by commas.
export function sortRecords(list, sort) {
  if (!sort) return list;
  const keys = String(sort).split(',').map((s) => s.trim()).filter(Boolean)
    .map((s) => (s.startsWith('-') ? { k: s.slice(1), dir: -1 } : { k: s.replace(/^\+/, ''), dir: 1 }));
  return list.sort((a, b) => {
    for (const { k, dir } of keys) {
      const x = getPath(a, k), y = getPath(b, k);
      if (x == null && y == null) continue;
      if (x == null) return 1; // missing values last, whichever direction
      if (y == null) return -1;
      const c = cmp(x, y);
      if (c) return c * dir;
    }
    return 0;
  });
}

// ---- row-level security -------------------------------------------------
//
// A rule is null (anyone), {} (anyone), or a condition: field conditions on
// the record, "{{user.id}}"-style templates, `user_condition` on the signed-in
// user, and $or/$and. Without a user every user-dependent condition fails.

const TEMPLATE = /^\{\{\s*user\.([a-zA-Z0-9_]+)\s*\}\}$/;
const NO_USER = Symbol('no user');

function fill(v, user) {
  if (typeof v === 'string') {
    const m = v.match(TEMPLATE);
    if (!m) return v;
    return user ? user[m[1]] ?? NO_USER : NO_USER;
  }
  if (Array.isArray(v)) return v.map((x) => fill(x, user));
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fill(x, user)]));
  return v;
}

const hasNoUser = (v) => v === NO_USER || (Array.isArray(v) ? v.some(hasNoUser) : v && typeof v === 'object' ? Object.values(v).some(hasNoUser) : false);

export function ruleAllows(rule, user, rec) {
  if (rule === null || rule === undefined) return true;
  if (typeof rule !== 'object') return Boolean(rule);
  return Object.entries(rule).every(([k, v]) => {
    if (k === '$or') return Array.isArray(v) && v.some((r) => ruleAllows(r, user, rec));
    if (k === '$and') return Array.isArray(v) && v.every((r) => ruleAllows(r, user, rec));
    if (k === 'user_condition') {
      if (!user) return false;
      return Object.entries(v || {}).every(([uk, uv]) => valueMatches(getPath(user, uk), fill(uv, user)));
    }
    const want = fill(v, user);
    if (hasNoUser(want)) return false;
    return valueMatches(getPath(rec, k), want);
  });
}
