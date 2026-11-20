 'use client';
import { uiTestEnabled } from '@/lib/uiTestMode';
import { handleLogout } from '@/app/actions/auth';
import { useLabelStore } from '@/store/labelStore';
import { clearLocalReasons } from '@/lib/localReasons';
export function UiTestControls() {
  if (!uiTestEnabled()) return null;
  return <div data-ui-test-banner className="no-print flex flex-wrap items-center justify-center gap-3 border-b border-border bg-page px-3 py-1 text-xs text-subtle lg:h-[var(--ui-test-banner-h)] lg:flex-nowrap">
    <span>UI Testing Mode | No database connected | Unsaved changes are temporary</span>
    <button className="underline" onClick={() => {
      clearLocalReasons();
      useLabelStore.setState(useLabelStore.getInitialState(), true);
      window.history.replaceState(null, '', '/admin');
      window.location.reload();
    }}>Reset UI Test Session</button>
    <form action={handleLogout} onSubmit={clearLocalReasons}><button className="underline" type="submit">Log out of UI testing</button></form>
  </div>;
}
