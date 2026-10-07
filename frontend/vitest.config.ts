import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**', 'src/store/**', 'src/game/**'],
      exclude: ['src/**/*.test.*', 'src/lib/types.ts'],
      // Ambang 80% berlaku untuk file yang sudah punya test; naikkan cakupan bertahap.
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80, perFile: false },
    },
  },
});
