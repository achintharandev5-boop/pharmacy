import '@testing-library/jest-dom/vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
import { afterEach, expect } from 'vitest';

// Testing Library only auto-cleans when Vitest globals are enabled; they are not here,
// so unmount rendered trees after each component test explicitly.
afterEach(async () => {
  if (typeof document === 'undefined') return;
  const { cleanup } = await import('@testing-library/react');
  cleanup();
});

// Locked workstation actions use aria-disabled instead of the native attribute, so they stay
// focusable and tappable to explain why they are locked; their click handlers refuse the action.
// jest-dom only reads the native attribute, so without this an aria-disabled control would pass
// toBeEnabled() and fail toBeDisabled(). Both matchers now treat aria-disabled="true" as disabled.
const ariaDisabled = (element: unknown) => element instanceof Element && element.getAttribute('aria-disabled') === 'true';
expect.extend({
  toBeDisabled(element: Element) {
    if (ariaDisabled(element)) return { pass: true, message: () => 'expected element not to be disabled, but it has aria-disabled="true"' };
    return matchers.toBeDisabled.call(this as never, element);
  },
  toBeEnabled(element: Element) {
    if (ariaDisabled(element)) return { pass: false, message: () => 'expected element to be enabled, but it has aria-disabled="true"' };
    return matchers.toBeEnabled.call(this as never, element);
  },
});
