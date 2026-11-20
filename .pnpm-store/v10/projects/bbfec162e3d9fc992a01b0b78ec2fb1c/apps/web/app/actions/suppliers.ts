'use server';

import { apiList, apiObject, apiRequest, query } from '@/lib/api/server';
import type { ApiData, ApiResult } from '@/lib/api/types';

export async function getSuppliers(searchQuery?: string): Promise<ApiResult<ApiData[]>> {
  return apiList(`suppliers${query({ query: searchQuery })}`);
}

export async function getSupplierById(id: string): Promise<ApiResult<ApiData>> {
  return apiObject(`suppliers/${encodeURIComponent(id)}`);
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function createSupplier(payload: ApiData): Promise<ApiResult<ApiData>> {
  const result = await apiRequest<ApiData>('suppliers', { method: 'POST', body: payload });
  if (!result.ok) return result;

  // The API now fails on any database error. Keep a defensive check that a stored record
  // (with a database id) came back, so an unexpected response is never shown as saved.
  const saved = result.data;
  const looksStored = saved && typeof saved === 'object' && typeof saved.id === 'string' && UUID_PATTERN.test(saved.id);
  if (!looksStored) {
    console.error('[api] POST /suppliers returned an unconfirmed record');
    return {
      ok: false,
      error: 'The server did not confirm that the supplier was saved. No supplier was added.',
    };
  }
  return result;
}

export async function updateSupplier(id: string, payload: ApiData): Promise<ApiResult<ApiData>> {
  return apiRequest(`suppliers/${encodeURIComponent(id)}`, { method: 'PATCH', body: payload });
}
