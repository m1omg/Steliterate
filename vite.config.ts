import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  oxc: {
    jsx: { runtime: 'automatic', importSource: 'preact' },
  },
  build: {
    target: 'es2022',
    assetsDir: 'assets',
    chunkSizeWarningLimit: 1500,
  },
});
