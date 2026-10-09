'use server';

import { apiList, apiObject, apiRequest } from '@/lib/api/server';
import type { ApiData, ApiResult } from '@/lib/api/types';

export interface SavedPrescription {
  id: string;
  prescriptionNumber: string;
  status: string;
  itemCount: number;
  createdAt: string;
}

/**
 * Saves a prescription. Success means the API confirmed every write; any failure (including
 * INSUFFICIENT_STOCK and PRODUCT_EXPIRED, reported in `code`) means nothing was saved.
 */
export async function createPrescriptionRecord(data: ApiData, idempotencyKey: string): Promise<ApiResult<SavedPrescription>> {
  const result = await apiRequest<SavedPrescription>('prescriptions', {
    method: 'POST',
    body: data,
    headers: { 'Idempotency-Key': idempotencyKey },
  });
  if (!result.ok) return result;
  if (!result.data?.id || !result.data?.prescriptionNumber) {
    console.error('[api] POST /prescriptions returned no prescription id');
    return { ok: false, error: 'The server did not confirm that the prescription was saved. Check the prescription list before trying again.' };
  }
  return result;
}

export async function getPrescriptionHistory(): Promise<ApiResult<ApiData[]>> {
  return apiList('prescriptions');
}

export async function getPrescriptionById(id: string): Promise<ApiResult<ApiData>> {
  return apiObject(`prescriptions/${encodeURIComponent(id)}`);
}

/** Records that the labels were printed. */
export async function logPrescriptionPrint(id: string): Promise<ApiResult<ApiData>> {
  return apiRequest(`prescriptions/${encodeURIComponent(id)}/print`, { method: 'POST' });
}

/** Records the outcome of an SMS attempt against a saved prescription. */
export async function logPrescriptionSms(
  id: string,
  outcome: { recipient: string; status: 'SENT' | 'FAILED'; messageLength: number; providerReference?: string; failureReason?: string },
): Promise<ApiResult<ApiData>> {
  return apiRequest(`prescriptions/${encodeURIComponent(id)}/sms`, { method: 'POST', body: outcome });
}
