/**
 * Result of a call to the pharmacy API.
 *
 * Every server action that talks to the API returns this shape so the UI can
 * tell a genuine empty response apart from a failed request. Never substitute
 * invented data for an error.
 */
export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number; code?: string };

/**
 * Shape of an API response body. The API has no shared response types yet, so this is
 * deliberately loose; replace it with real DTO types as they are introduced.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ApiData = any;

export const NETWORK_ERROR_MESSAGE =
  'Could not reach the pharmacy server. Check your connection and that the server is running, then try again.';
