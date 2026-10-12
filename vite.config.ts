import { defineConfig } from 'vite';
export default defineConfig({
  base: './',
  server: { port: 5173, strictPort: false },
  build: { rollupOptions: { output: { manualChunks: (id: string) => id.includes('node_modules/three') ? 'three' : undefined } } },
});
