import { cookies } from 'next/headers';
import { NETWORK_ERROR_MESSAGE, type ApiResult } from './types';

// Server-only helper used by server actions. Do not import from client components.

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
}

/** Path without its query string, so search terms (names, phone numbers) never reach the logs. */
function logPath(path: string) {
  return path.split('?')[0];
}

async function readBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function errorMessage(status: number, body: unknown): string {
  if (status === 401) return 'Your session has expired. Please sign in again.';

  const message =
    body && typeof body === 'object' && 'message' in body ? (body as { message: unknown }).message : null;
  // 403 messages from the API explain what is missing (for example, no role assigned).
  if (typeof message === 'string' && message.trim()) return message;
  if (status === 403) return 'You do not have permission to perform this action.';
  if (Array.isArray(message) && message.length > 0) return message.join(' ');

  if (status === 404) return 'The requested record was not found.';
  if (status >= 500) return `The pharmacy server reported an error (status ${status}). Please try again.`;
  return `The request could not be completed (status ${status}).`;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<ApiResult<T>> {
  const method = options.method ?? 'GET';
  const token = (await cookies()).get('sb-access-token')?.value;

  const headers: Record<string, string> = { ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(`${API_URL}/${path.replace(/^\//, '')}`, {
      method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      cache: 'no-store',
    });
  } catch {
    console.error(`[api] ${method} ${logPath(path)} failed: server unreachable`);
    return { ok: false, error: NETWORK_ERROR_MESSAGE };
  }

  let body: unknown;
  try {
    body = await readBody(res);
  } catch {
    console.error(`[api] ${method} ${logPath(path)} failed: response could not be read`);
    return { ok: false, status: res.status, error: NETWORK_ERROR_MESSAGE };
  }

  if (!res.ok) {
    console.error(`[api] ${method} ${logPath(path)} -> ${res.status}`);
    const code =
      body && typeof body === 'object' && 'code' in body && typeof (body as { code: unknown }).code === 'string'
        ? (body as { code: string }).code
        : undefined;
    return { ok: false, status: res.status, code, error: errorMessage(res.status, body) };
  }

  // Some API handlers report failure inside a 200 response, either with `success: false` or
  // with a "(simulated)" message. Neither is a confirmed result, so neither may be shown as success.
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    const { success, message } = body as { success?: unknown; message?: unknown };
    if (success === false) {
      console.error(`[api] ${method} ${logPath(path)} -> 200 with success:false`);
      return { ok: false, status: res.status, error: errorMessage(500, body) };
    }
    if (typeof message === 'string' && /\(simulated/i.test(message)) {
      console.error(`[api] ${method} ${logPath(path)} -> simulated response rejected`);
      return {
        ok: false,
        status: res.status,
        error: 'The server could not confirm this operation, so no change was recorded. Please try again or contact support.',
      };
    }
  }

  return { ok: true, data: body as T };
}

/** GET a list endpoint and reject anything that is not an array, rather than treating it as empty. */
export async function apiList<T>(path: string): Promise<ApiResult<T[]>> {
  const result = await apiRequest<unknown>(path);
  if (!result.ok) return result;
  if (!Array.isArray(result.data)) {
    console.error(`[api] GET ${logPath(path)} returned an unexpected response shape`);
    return { ok: false, error: 'The pharmacy server returned an unexpected response.' };
  }
  return { ok: true, data: result.data as T[] };
}

/** GET a single object and treat an empty body as an error. */
export async function apiObject<T>(path: string): Promise<ApiResult<T>> {
  const result = await apiRequest<T | null>(path);
  if (!result.ok) return result;
  if (result.data === null || typeof result.data !== 'object') {
    console.error(`[api] GET ${logPath(path)} returned an unexpected response shape`);
    return { ok: false, error: 'The pharmacy server returned an unexpected response.' };
  }
  return { ok: true, data: result.data };
}

export function query(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.append(key, String(value));
  }
  const s = search.toString();
  return s ? `?${s}` : '';
}
