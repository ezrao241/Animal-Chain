import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
const here = import.meta.dirname, repo = path.resolve(here, '..');
export default defineConfig({
  root: here, base: './', publicDir: path.resolve(repo, 'public'), plugins: [react()],
  resolve: {alias: {'@': repo}},
  css: {postcss: repo},
  build: {outDir: path.resolve(repo, 'dist-play'), emptyOutDir: true, target: 'es2022', chunkSizeWarningLimit: 8000},
});
