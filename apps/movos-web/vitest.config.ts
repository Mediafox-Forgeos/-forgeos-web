import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    // Production is always https — movos_session is set with the Secure
    // attribute, which browsers (and jsdom) silently refuse to store on a
    // plain http origin. Without this, any test touching that cookie would
    // fail for an environment reason having nothing to do with the code.
    environmentOptions: { jsdom: { url: 'https://movos.test/' } },
    setupFiles: ['./vitest-setup.ts'],
    globals: true,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
