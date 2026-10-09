'use server';

import { cookies } from 'next/headers';
import { apiList, apiObject } from '@/lib/api/server';
import type { ApiData, ApiResult } from '@/lib/api/types';

export async function createPrescriptionRecord(data: any, idempotencyKey?: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get('sb-access-token')?.value;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token || ''}`,
  };

  if (idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey;
  }

  try {
    const res = await fetch(`${apiUrl}/prescriptions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });

    const result = await res.json();

    if (!res.ok) {
      if (res.status === 409 && result.code === 'INSUFFICIENT_STOCK') {
        return {
          error: result.message || `Insufficient stock for ${result.productName}.`,
          code: 'INSUFFICIENT_STOCK',
          details: result,
        };
      }
      if (res.status === 400 && result.code === 'PRODUCT_EXPIRED') {
        return {
          error: result.message || 'Product has expired and cannot be dispensed.',
          code: 'PRODUCT_EXPIRED',
          details: result,
        };
      }
      return { error: result.message || `Failed to save prescription (Status: ${res.status})` };
    }

    return { success: true, data: result };
  } catch (e: any) {
    console.error('Failed to create prescription record:', e);
    return { error: e.message || 'Failed to communicate with pharmacy server.' };
  }
}

export async function getPrescriptionHistory(): Promise<ApiResult<ApiData[]>> {
  return apiList('prescriptions');
}

export async function getPrescriptionById(id: string): Promise<ApiResult<ApiData>> {
  return apiObject(`prescriptions/${encodeURIComponent(id)}`);
}

export async function logPrescriptionPrint(id: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get('sb-access-token')?.value;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  try {
    await fetch(`${apiUrl}/prescriptions/${id}/print`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token || ''}` },
    });
  } catch (e) {
    console.error('Failed to log print event:', e);
  }
}

export async function logPrescriptionSms(id: string, recipient: string, message: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get('sb-access-token')?.value;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  try {
    await fetch(`${apiUrl}/prescriptions/${id}/sms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token || ''}`,
      },
      body: JSON.stringify({ recipient, message }),
    });
  } catch (e) {
    console.error('Failed to log SMS event:', e);
  }
}
