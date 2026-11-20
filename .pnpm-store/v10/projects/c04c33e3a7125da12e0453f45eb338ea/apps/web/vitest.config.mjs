import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Mirror the "@/*" path alias from tsconfig.json.
    alias: { '@': fileURLToPath(new URL('./', import.meta.url)) },
  },
  test: {
    setupFiles: ['./vitest.setup.ts'],
    // Vitest 4 replaces environmentMatchGlobs with explicit test projects.
    projects: [
      { extends: true, test: { name: 'logic', include: ['**/*.test.ts'], environment: 'node' } },
      { extends: true, test: { name: 'components', include: ['**/*.test.tsx'], environment: 'jsdom' } },
    ],
  },
});
