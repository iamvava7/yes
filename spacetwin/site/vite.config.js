import react from '@vitejs/plugin-react'
import path from 'node:path'
import { defineConfig } from 'vite'

// The website. In development, `npm run dev` here talks to the SpaceTwin
// server on port 3000 (start it with `npm start` in the folder above).
const api = `http://localhost:${process.env.API_PORT ?? 3000}`

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  server: {
    port: 5174,
    proxy: { '/api': api, '/files': api, '/3D': api, '/3d': api, '/tours': api, '/tour-assets': api },
  },
  build: { outDir: 'dist', emptyOutDir: true, chunkSizeWarningLimit: 1500 },
})
