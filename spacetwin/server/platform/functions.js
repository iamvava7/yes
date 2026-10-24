// Runs the website's backend functions (site/base44/functions/<Name>/entry.ts)
// inside this server. Each one is bundled once with esbuild; its imports of
// 'npm:@base44/sdk' and 'base44:runtime' point at fnSdk.js / fnRuntime.js,
// so the code that ran on Base44 runs here unchanged.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PlatformError } from './entities.js';
import { SYSTEM_HEADER } from './fnSdk.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const SDK = path.join(here, 'fnSdk.js');
const RUNTIME = path.join(here, 'fnRuntime.js');
const NAME_RE = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;

// Two functions use Deno.serve(handler) instead of a default export.
let served = null;
globalThis.Deno ??= {
  serve(a, b) { served = typeof a === 'function' ? a : b; return { finished: Promise.resolve() }; },
  env: { get: (k) => process.env[k], toObject: () => ({ ...process.env }) },
};

const resolvePlugin = {
  name: 'base44-shims',
  setup(build) {
    build.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: pathToFileURL(SDK).href, external: true }));
    build.onResolve({ filter: /^base44:runtime$/ }, () => ({ path: pathToFileURL(RUNTIME).href, external: true }));
    // Other npm:pkg@1.2.3 imports: the package installed in node_modules.
    build.onResolve({ filter: /^npm:/ }, (args) => ({ path: args.path.slice(4).replace(/(?<=.)@[^/]+$/, ''), external: true }));
  },
};

export function createFunctions({ dir, cacheDir, systemKey, timeoutMs = 60_000 }) {
  const loaded = new Map(); // name → Promise<handler>
  let esbuild = null;
  let queue = Promise.resolve(); // one module evaluates at a time, so Deno.serve is caught by the right one

  const names = () => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((n) => fs.existsSync(path.join(dir, n, 'entry.ts'))) : []);

  async function load(name) {
    if (!NAME_RE.test(name) || !fs.existsSync(path.join(dir, name, 'entry.ts'))) {
      throw new PlatformError(404, `Function ${name} not found`);
    }
    if (!loaded.has(name)) {
      const task = queue.then(async () => {
        esbuild ??= await import('esbuild');
        const out = path.join(cacheDir, `${name}.mjs`);
        fs.mkdirSync(cacheDir, { recursive: true });
        await esbuild.build({
          entryPoints: [path.join(dir, name, 'entry.ts')], outfile: out, bundle: true, format: 'esm',
          platform: 'node', target: 'node22', plugins: [resolvePlugin], logLevel: 'silent',
        });
        served = null;
        const mod = await import(`${pathToFileURL(out).href}?t=${fs.statSync(out).mtimeMs}`);
        const fn = typeof mod.default === 'function' ? mod.default : served;
        served = null;
        if (typeof fn !== 'function') throw new Error(`Function ${name} exports no handler`);
        return fn;
      });
      queue = task.catch(() => {});
      loaded.set(name, task);
      task.catch(() => loaded.delete(name));
    }
    return loaded.get(name);
  }

  // Runs one function with a real Request, the way Base44 called it.
  async function run(name, { body = '{}', headers = {}, url = `http://localhost/functions/${name}` } = {}) {
    const fn = await load(name);
    const req = new Request(url, { method: 'POST', headers, body });
    let timer;
    const res = await Promise.race([
      fn(req),
      new Promise((_, rej) => { timer = setTimeout(() => rej(new PlatformError(504, `${name} took too long`)), timeoutMs); }),
    ]).finally(() => clearTimeout(timer));
    return res instanceof Response ? res : Response.json(res ?? null);
  }

  // A JSON call from other server code (another function, a workflow).
  async function call(name, data = {}, { token, system = false } = {}) {
    const headers = { 'content-type': 'application/json' };
    if (token) headers.authorization = `Bearer ${token}`;
    if (system) headers[SYSTEM_HEADER] = systemKey;
    const res = await run(name, { body: JSON.stringify(data), headers });
    const text = await res.text();
    try { return JSON.parse(text); } catch { return text; }
  }

  return { names, load, run, call };
}
