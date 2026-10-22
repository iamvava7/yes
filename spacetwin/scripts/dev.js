// Runs the API server and the Vite dev server together.
import { spawn } from 'node:child_process';
import os from 'node:os';

const procs = [
  spawn('node', ['--watch', 'server/index.js'], { stdio: 'inherit', env: { ...process.env, PORT: '3000' } }),
  spawn('npx', ['vite', '--config', 'web/vite.config.js'], { stdio: 'inherit', env: { ...process.env, API_PORT: '3000' } }),
];
const stop = () => procs.forEach((p) => p.kill());
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
procs.forEach((p) => p.on('exit', (code) => { stop(); process.exitCode = code ?? 0; }));

if (process.env.PHONE) {
  const ips = Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
  setTimeout(() => {
    console.log('\nOn your iPhone (same Wi-Fi), open:');
    for (const ip of ips) console.log(`  https://${ip}:5173`);
    console.log('Safari warns about the certificate once: Show Details → visit this website.\n');
  }, 1500);
}
