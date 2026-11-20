'use client';

import { useEffect } from 'react';

export const UNSAVED_CHANGES_MESSAGE = 'You have unsaved changes. Leave this page and discard them?';

/**
 * While `dirty`, asks before the page is closed or reloaded (browser prompt) and before an
 * in-app link is followed (the App Router has no navigation-blocking API, so link clicks are
 * intercepted in the capture phase). Links opened in a new tab are not intercepted.
 */
export function useUnsavedChangesWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    const click = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!link || link.target === '_blank' || link.hasAttribute('download')) return;
      const href = link.getAttribute('href') ?? '';
      if (href.startsWith('#')) return;
      if (!window.confirm(UNSAVED_CHANGES_MESSAGE)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('click', click, true);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      document.removeEventListener('click', click, true);
    };
  }, [dirty]);
}
