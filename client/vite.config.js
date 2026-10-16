import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// The dev server proxies API + screenshot requests to the Express backend,
// so the browser only ever talks to one origin (no CORS headaches, and the picker iframe is same-origin).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:5000',
      '/screenshots': 'http://localhost:5000'
    }
  }
});
