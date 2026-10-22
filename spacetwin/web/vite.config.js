import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import path from 'node:path';

// PHONE=1 serves over HTTPS on your local network: iPhones only allow camera
// and motion sensors on secure pages. The certificate is self-signed, so
// Safari shows a warning once; choose "Show Details" → "visit this website".
const phone = !!process.env.PHONE;

export default defineConfig({
  root: path.resolve(import.meta.dirname),
  plugins: phone ? [basicSsl()] : [],
  server: {
    port: 5173,
    host: phone ? true : 'localhost',
    proxy: { '/api': `http://localhost:${process.env.API_PORT ?? 3000}` },
    fs: { allow: [path.resolve(import.meta.dirname, '..')] },
  },
  build: { outDir: 'dist', emptyOutDir: true, chunkSizeWarningLimit: 900 },
});
