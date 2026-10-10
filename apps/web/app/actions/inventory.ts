'use server';

import { apiList, apiObject, apiRequest, query } from '@/lib/api/server';
import type { ApiData, ApiResult } from '@/lib/api/types';

// All functions return ApiResult. Failures are reported as errors, never replaced with sample data.

export async function getInventorySummary(): Promise<ApiResult<ApiData>> {
  return apiObject('inventory/summary');
}

export async function getInventoryAlerts(): Promise<ApiResult<ApiData[]>> {
  return apiList('inventory/alerts');
}

export async function getInventoryBatches(searchQuery?: string, status?: string): Promise<ApiResult<ApiData[]>> {
  return apiList(`inventory/batches${query({ query: searchQuery, status })}`);
}

export async function getInventoryMovements(searchQuery?: string, type?: string): Promise<ApiResult<ApiData[]>> {
  return apiList(`inventory/movements${query({ query: searchQuery, type })}`);
}

/** `idempotencyKey` must stay the same when the same receipt is retried, so stock is never received twice. */
export async function receiveStock(payload: ApiData, idempotencyKey?: string): Promise<ApiResult<ApiData>> {
  return apiRequest('inventory/receipts', {
    method: 'POST',
    body: payload,
    headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
  });
}

export async function adjustStock(payload: ApiData, idempotencyKey?: string): Promise<ApiResult<ApiData>> {
  return apiRequest('inventory/adjustments', {
    method: 'POST',
    body: payload,
    headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
  });
}

export async function getInventoryExpiryMatrix(): Promise<ApiResult<ApiData>> {
  return apiObject('inventory/expiry');
}

export async function getInventoryLowStock(): Promise<ApiResult<ApiData[]>> {
  return apiList('inventory/low-stock');
}

export async function getInventoryAnalytics(range = '30d'): Promise<ApiResult<ApiData>> {
  return apiObject(`inventory/analytics${query({ range })}`);
}
