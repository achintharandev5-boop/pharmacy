/** Shared flag; production can never accept a local session. */
export function uiTestEnabled() {
  return process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_UI_TEST_MODE === 'true';
}
export const UI_TEST_COOKIE = 'pharmacy-ui-test';
export const UI_TEST_SESSION = 'local-ui-only-v1';
export const UI_TEST_UNAVAILABLE = 'UI testing mode: No data loaded. Database connection is disabled.';
export const UI_TEST_NOT_SAVED = 'UI testing mode: Operation was not saved or submitted. Database connection is disabled.';
