// What the backend functions get from 'base44:runtime'.
//
// secrets.get(name): the server's environment variable first, then a key an
// admin saved in Admin → Integrări & chei API (decrypted in memory).
// secrets.fromServer(name) answers only from the environment.

import { current } from './context.js';

const fromEnv = (name) => {
  try { return current().env[name] || undefined; } catch { return process.env[name] || undefined; }
};

export const secrets = {
  get(name) {
    const env = fromEnv(name);
    if (env) return env;
    try { return current().secrets.get(name) ?? undefined; } catch { return undefined; }
  },
  fromServer: fromEnv,
};
