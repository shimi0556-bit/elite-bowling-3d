import { defineConfig } from 'vitest/config';

const pages = process.env.GITHUB_PAGES === 'true';
const port = Number(process.env.PORT) || 5173;

export default defineConfig({
  base: pages ? '/elite-bowling-3d/' : '/',
  server: {
    host: '0.0.0.0',
    port,
    strictPort: false,
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: Number(process.env.PORT) || 4173,
    allowedHosts: true,
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 4000,
  },
  test: {
    environment: 'node',
    testTimeout: 40000,
    hookTimeout: 40000,
    fileParallelism: false,
  },
});
