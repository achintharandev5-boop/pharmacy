import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Mirror the "@/*" path alias from tsconfig.json.
    alias: { '@': fileURLToPath(new URL('./', import.meta.url)) },
  },
  test: {
    // Logic tests run in Node; React component tests (*.test.tsx) need a DOM.
    // jsdom is pinned to 26.x because newer releases require Node >= 22.22.
    projects: [
      { extends: true, test: { name: 'node', environment: 'node', include: ['**/*.test.ts'] } },
      { extends: true, test: { name: 'dom', environment: 'jsdom', include: ['**/*.test.tsx'] } },
    ],
    setupFiles: ['./vitest.setup.ts'],
  },
});
