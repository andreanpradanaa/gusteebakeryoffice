import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Semua panggilan /api diteruskan ke backend Go (API key tetap di backend).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: process.env.BACKEND_URL ?? 'http://localhost:8080', changeOrigin: true },
    },
  },
});
