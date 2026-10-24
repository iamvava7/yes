// The website's connection to its own server (/api/platform), with the same
// calls the pages used with the Base44 SDK: base44.entities.X.list/filter/
// get/create/update/delete/subscribe, base44.auth.*, base44.functions.invoke,
// base44.integrations.Core.UploadFile. The name stays `base44` so the pages
// didn't need rewriting.

import { appParams } from '@/lib/app-params';

const API = '/api/platform';
const TOKEN_KEYS = ['base44_access_token', 'token'];

function readToken() {
  if (appParams.token) return appParams.token;
  try { return localStorage.getItem(TOKEN_KEYS[0]) || localStorage.getItem(TOKEN_KEYS[1]); } catch { return null; }
}

let token = readToken();
if (appParams.token) saveToken(appParams.token);

function saveToken(t) {
  try {
    if (t) TOKEN_KEYS.forEach((k) => localStorage.setItem(k, t));
    else TOKEN_KEYS.forEach((k) => localStorage.removeItem(k));
  } catch { /* private mode */ }
}

class ApiError extends Error {
  constructor(status, data) {
    super(data?.message || data?.error || `HTTP ${status}`);
    this.status = status;
    this.data = data;
    this.response = { status, data };
  }
}

async function request(method, path, { body, query, raw = false } = {}) {
  const url = new URL(API + path, window.location.origin);
  for (const [k, v] of Object.entries(query || {})) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, typeof v === 'object' ? JSON.stringify(v) : v);
  }
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload = body;
  if (body !== undefined && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(url, { method, headers, body: payload });
  const text = await res.text();
  let data = text;
  try { data = text ? JSON.parse(text) : null; } catch { /* not JSON */ }
  if (res.status === 401 && token) {
    token = null; // a rejected token must not boot the next page
    saveToken(null);
  }
  if (!res.ok) throw new ApiError(res.status, data);
  return raw ? { data, status: res.status, headers: res.headers } : data;
}

// ---- live updates: one EventSource for every subscribed entity
const listeners = new Map(); // entity → Set(callback)
let source = null;
let reopen = null;

function openStream() {
  clearTimeout(reopen);
  reopen = setTimeout(() => {
    source?.close();
    source = null;
    const names = [...listeners.keys()].filter((n) => listeners.get(n).size);
    if (!names.length || typeof EventSource === 'undefined') return;
    const url = new URL(`${API}/realtime`, window.location.origin);
    url.searchParams.set('entities', names.join(','));
    if (token) url.searchParams.set('token', token);
    source = new EventSource(url);
    source.onmessage = (msg) => {
      let e;
      try { e = JSON.parse(msg.data); } catch { return; }
      for (const cb of listeners.get(e.entity) || []) {
        try { cb({ type: e.type, id: e.id, data: e.data, timestamp: e.timestamp }); } catch (err) { console.error('[VerifiCasa] subscription callback error:', err); }
      }
    };
  }, 50); // many components subscribe on the same render: open once
}

function entity(name) {
  const base = `/entities/${encodeURIComponent(name)}`;
  const read = (query, sort, limit, skip, fields) => {
    const opts = sort && typeof sort === 'object' ? sort : { sort, limit, skip, fields };
    return request('GET', base, {
      query: { q: query && Object.keys(query).length ? query : undefined, sort: opts.sort, limit: opts.limit, skip: opts.skip, fields: Array.isArray(opts.fields) ? opts.fields.join(',') : opts.fields },
    });
  };
  return {
    list: (sort, limit, skip, fields) => read(null, sort, limit, skip, fields),
    filter: (query, sort, limit, skip, fields) => read(query, sort, limit, skip, fields),
    get: (id) => request('GET', `${base}/${encodeURIComponent(id)}`),
    create: (data) => request('POST', base, { body: data }),
    update: (id, data) => request('PUT', `${base}/${encodeURIComponent(id)}`, { body: data }),
    delete: (id) => request('DELETE', `${base}/${encodeURIComponent(id)}`),
    deleteMany: (query) => request('DELETE', base, { body: query || {} }),
    bulkCreate: (list) => request('POST', `${base}/bulk`, { body: list }),
    bulkUpdate: (list) => request('PUT', `${base}/bulk`, { body: list }),
    updateMany: (query, data) => request('PATCH', `${base}/update-many`, { body: { query, data } }),
    count: async (query) => (await request('GET', `${base}/count`, { query: { q: query } })).count,
    subscribe(callback) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(callback);
      openStream();
      return () => {
        listeners.get(name)?.delete(callback);
        openStream();
      };
    },
  };
}

const entityCache = new Map();
const entities = new Proxy({}, {
  get(_t, name) {
    if (typeof name !== 'string' || name === 'then' || name.startsWith('_')) return undefined;
    if (!entityCache.has(name)) entityCache.set(name, entity(name));
    return entityCache.get(name);
  },
});

const here = () => window.location.href;

const auth = {
  hasToken: () => Boolean(token),
  me: () => request('GET', '/me'),
  updateMe: (data) => request('PUT', '/me', { body: data }),
  async isAuthenticated() {
    try { await auth.me(); return true; } catch { return false; }
  },
  setToken(t, persist = true) {
    if (!t) return;
    token = t;
    if (persist) saveToken(t);
    if (listeners.size) openStream(); // reconnect live updates as this user
  },
  async loginViaEmailPassword(email, password) {
    const out = await request('POST', '/auth/login', { body: { email, password } });
    if (out?.access_token) auth.setToken(out.access_token);
    return out;
  },
  register: (payload) => request('POST', '/auth/register', { body: payload }),
  verifyOtp: ({ email, otpCode }) => request('POST', '/auth/verify-otp', { body: { email, otp_code: otpCode } }),
  resendOtp: (email) => request('POST', '/auth/resend-otp', { body: { email } }),
  resetPasswordRequest: (email) => request('POST', '/auth/reset-password-request', { body: { email } }),
  resetPassword: ({ resetToken, newPassword }) => request('POST', '/auth/reset-password', { body: { reset_token: resetToken, new_password: newPassword } }),
  async changePassword({ currentPassword, newPassword }) {
    const out = await request('POST', '/auth/change-password', { body: { current_password: currentPassword, new_password: newPassword } });
    if (out?.access_token) auth.setToken(out.access_token);
    return out;
  },
  redirectToLogin(nextUrl) {
    const next = new URL(nextUrl || here(), window.location.origin).toString();
    window.location.href = `/login?from_url=${encodeURIComponent(next)}`;
  },
  loginWithProvider(provider, fromUrl = '/') {
    const from = new URL(fromUrl, window.location.origin).toString();
    window.location.href = `${API}/auth/${encodeURIComponent(provider)}/login?from_url=${encodeURIComponent(from)}`;
  },
  logout(redirectUrl) {
    token = null;
    saveToken(null);
    window.location.href = new URL(redirectUrl || here(), window.location.origin).toString();
  },
};

async function invoke(name, data = {}) {
  if (typeof data === 'string') throw new Error(`Function ${name} must receive an object with named parameters`);
  return request('POST', `/functions/${encodeURIComponent(name)}`, { body: data, raw: true });
}

const Core = {
  async UploadFile({ file }) {
    const form = new FormData();
    form.append('file', file, file.name || 'upload');
    return request('POST', '/upload', { body: form });
  },
  async SendEmail() {
    throw new Error('Emails are sent by the server');
  },
};

export const base44 = {
  entities,
  auth,
  functions: { invoke },
  integrations: new Proxy({}, { get: (_t, pkg) => (pkg === 'Core' ? Core : undefined) }),
  config: () => request('GET', '/config'),
};
