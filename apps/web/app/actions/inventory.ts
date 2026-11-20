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

export async function getInventoryLowStock(limit?: number): Promise<ApiResult<ApiData[]>> {
  return apiList(`inventory/low-stock${query({ limit })}`);
}

export async function getDashboardExpiryBatches(limit = 6): Promise<ApiResult<ApiData[]>> {
  return apiList(`inventory/dashboard/expiry${query({ limit })}`);
}

export async function getDashboardMovementActivity(range = '30d'): Promise<ApiResult<ApiData[]>> {
  return apiList(`inventory/dashboard/movement-activity${query({ range })}`);
}

export async function getInventoryAnalytics(range = '30d'): Promise<ApiResult<ApiData>> {
  return apiObject(`inventory/analytics${query({ range })}`);
}

/** Marks a batch as not dispensable (its units stay on record). Pharmacist or administrator. */
export async function quarantineBatch(batchId: string, reason: string): Promise<ApiResult<ApiData>> {
  return apiRequest(`inventory/batches/${encodeURIComponent(batchId)}/quarantine`, { method: 'POST', body: { reason } });
}

/** Lifts a quarantine. Refused for expired or undated batches. Pharmacist or administrator. */
export async function releaseBatch(batchId: string, reason: string): Promise<ApiResult<ApiData>> {
  return apiRequest(`inventory/batches/${encodeURIComponent(batchId)}/release`, { method: 'POST', body: { reason } });
}

export async function getPatientReturns(status?: string): Promise<ApiResult<ApiData[]>> {
  return apiList(`inventory/patient-returns${query({ status })}`);
}

/** Records medicine brought back by a patient. It is held for review and never added to stock. */
export async function recordPatientReturn(payload: ApiData): Promise<ApiResult<ApiData>> {
  return apiRequest('inventory/patient-returns', { method: 'POST', body: payload });
}

export async function disposePatientReturn(id: string, reason: string): Promise<ApiResult<ApiData>> {
  return apiRequest(`inventory/patient-returns/${encodeURIComponent(id)}/dispose`, { method: 'POST', body: { reason } });
}

/** Label workstation: dispensable batches of one medicine with their GRN expiry dates. */
export async function getDispensingBatches(productId: string): Promise<ApiResult<ApiData>> {
  return apiObject(`inventory/dispensing-batches${query({ productId })}`);
}
