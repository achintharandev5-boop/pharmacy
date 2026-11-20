'use server';

import { apiList, query } from '@/lib/api/server';
import type { ApiResult } from '@/lib/api/types';
import type { PosProduct } from '@/lib/pos/cart';

// Point of sale. Catalogue only: checkout is not implemented until the financial decisions
// are approved (PHARMACY_POS_IMPLEMENTATION_PLAN.md §4).

export async function searchPosCatalog(q: string): Promise<ApiResult<PosProduct[]>> {
  if (!q.trim()) return { ok: true, data: [] };
  return apiList<PosProduct>(`pos/catalog${query({ q: q.trim() })}`);
}

/** An empty list means the barcode is not registered (or the medicine is inactive). */
export async function lookupPosBarcode(barcode: string): Promise<ApiResult<PosProduct[]>> {
  return apiList<PosProduct>(`pos/catalog${query({ barcode: barcode.trim() })}`);
}

/** Current price and sellable stock for the medicines already in a cart (at most 50). */
export async function recheckPosCart(ids: string[]): Promise<ApiResult<PosProduct[]>> {
  if (ids.length === 0) return { ok: true, data: [] };
  return apiList<PosProduct>(`pos/catalog${query({ ids: ids.slice(0, 50).join(',') })}`);
}

/** A patient as the POS may see them: no address, history or clinical details. */
export interface PosCustomerMatch {
  id: string;
  name: string;
  phoneLast4: string;
  registeredOn: string | null;
}

export async function lookupPosCustomers(phone: string): Promise<ApiResult<PosCustomerMatch[]>> {
  return apiList<PosCustomerMatch>(`pos/customers${query({ phone: phone.trim() })}`);
}
