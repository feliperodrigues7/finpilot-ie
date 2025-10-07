import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: '/finpilot-ie/',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        success: resolve(__dirname, 'success.html'),
      },
    },
  },
});
