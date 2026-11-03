import { defineConfig } from 'vite';

// strictPort: fail clearly instead of silently moving to another port, because
// browser saves are scoped to the exact origin (host + port).
export default defineConfig({
  base: './',
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
  build: { target: 'es2022', outDir: 'dist', assetsInlineLimit: 0, sourcemap: false },
  worker: { format: 'es' },
});
