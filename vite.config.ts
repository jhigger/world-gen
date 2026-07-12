import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
    open: true
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          // Bundle Three.js into its own vendor chunk to leverage browser caching
          three: ['three']
        }
      }
    }
  }
});
