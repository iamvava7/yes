// What the website's backend functions get when they import
// 'npm:@base44/sdk': the same calls they made on Base44, answered by this
// server. Functions run unchanged.

import { current } from './context.js';

// Workflows (schedules, entity triggers) run as the site itself, the way
// Base44 ran automations as the app owner.
export const SYSTEM_HEADER = 'x-verificasa-system';
export const SYSTEM_USER = Object.freeze({ id: 'system', email: 'system@verificasa.ro', full_name: 'VerifiCasa', role: 'SUPER_ADMIN' });

function entitiesFor(actor) {
  return new Proxy({}, {
    get(_t, name) {
      if (typeof name !== 'string' || name === 'then' || name.startsWith('_')) return undefined;
      return current().entities.handler(name, actor);
    },
  });
}

function integrationsFor(actor) {
  const core = {
    async SendEmail({ to, subject, body, from_name }) {
      await current().mailer.send({ to, subject, html: body, fromName: from_name });
      return { ok: true };
    },
    async UploadFile({ file }) {
      if (!file || typeof file.arrayBuffer !== 'function') throw new Error('UploadFile needs a file');
      return current().files.save(Buffer.from(await file.arrayBuffer()), { name: file.name, mime: file.type });
    },
    async InvokeLLM() {
      throw new Error('InvokeLLM is not available on this server');
    },
  };
  return new Proxy({}, { get: (_t, pkg) => (pkg === 'Core' ? core : undefined) });
}

export function createClientFromRequest(req) {
  const p = current();
  const auth = req?.headers?.get?.('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  const system = p.systemKey && req?.headers?.get?.(SYSTEM_HEADER) === p.systemKey;
  const user = system ? SYSTEM_USER : p.auth.userFromToken(token);
  const asUser = { user };
  const service = { service: true, user: null };
  const functions = (forward) => ({  // a nested call keeps the caller's identity
    async invoke(name, data) {
      return { data: await p.functions.call(name, data ?? {}, { token: forward, system }), status: 200 };
    },
  });
  return {
    auth: {
      async me() {
        if (!user) {
          const e = new Error('Authentication required');
          e.status = 401;
          throw e;
        }
        return user;
      },
      async isAuthenticated() { return Boolean(user); },
    },
    entities: entitiesFor(asUser),
    integrations: integrationsFor(asUser),
    functions: functions(token),
    asServiceRole: {
      entities: entitiesFor(service),
      integrations: integrationsFor(service),
      functions: functions(token),
    },
  };
}

export const createClient = () => createClientFromRequest(null);
