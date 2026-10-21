// Runs the API server and the Vite dev server together.
import { spawn } from 'node:child_process';

const procs = [
  spawn('node', ['--watch', 'server/index.js'], { stdio: 'inherit', env: { ...process.env, PORT: '3000' } }),
  spawn('npx', ['vite', '--config', 'web/vite.config.js'], { stdio: 'inherit', env: { ...process.env, API_PORT: '3000' } }),
];
const stop = () => procs.forEach((p) => p.kill());
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
procs.forEach((p) => p.on('exit', (code) => { stop(); process.exitCode = code ?? 0; }));
