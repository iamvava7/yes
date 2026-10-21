import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  root: path.resolve(import.meta.dirname),
  server: {
    port: 5173,
    proxy: { '/api': `http://localhost:${process.env.API_PORT ?? 3000}` },
    fs: { allow: [path.resolve(import.meta.dirname, '..')] },
  },
  build: { outDir: 'dist', emptyOutDir: true, chunkSizeWarningLimit: 900 },
});
