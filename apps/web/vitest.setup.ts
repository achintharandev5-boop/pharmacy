import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';

// Testing Library only auto-cleans when Vitest globals are enabled; they are not here,
// so unmount rendered trees after each component test explicitly.
afterEach(async () => {
  if (typeof document === 'undefined') return;
  const { cleanup } = await import('@testing-library/react');
  cleanup();
});
