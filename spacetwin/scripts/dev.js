// Runs the API server and the Vite dev server together.
// `--phone` (npm run phone) serves over HTTPS on the local network so an iPhone
// on the same Wi-Fi can use the camera and motion sensors.
// Everything is started through Node itself so this works on Windows too.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

const phone = process.argv.includes('--phone') || !!process.env.PHONE;
const env = { ...process.env, API_PORT: '3000', ...(phone ? { PHONE: '1' } : {}) };
const vite = path.join(path.dirname(createRequire(import.meta.url).resolve('vite/package.json')), 'bin', 'vite.js');

const procs = [
  spawn(process.execPath, ['--watch', 'server/index.js'], { stdio: 'inherit', env: { ...env, PORT: '3000' } }),
  spawn(process.execPath, [vite, '--config', 'web/vite.config.js'], { stdio: 'inherit', env }),
];
const stop = () => procs.forEach((p) => p.kill());
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
procs.forEach((p) => p.on('exit', (code) => { stop(); process.exitCode = code ?? 0; }));

if (phone) {
  const ips = Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
  setTimeout(() => {
    console.log('\nOn your iPhone (same Wi-Fi), open:');
    for (const ip of ips) console.log(`  https://${ip}:5173`);
    console.log('Safari warns about the certificate once: Show Details → visit this website.\n');
  }, 1500);
}
