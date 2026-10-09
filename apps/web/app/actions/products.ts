'use server';

import { apiList, apiObject, query } from '@/lib/api/server';
import type { ApiResult } from '@/lib/api/types';

export interface ProductSearchResult {
  id: string;
  name: string;
  stock_quantity?: number;
  expiry_date?: string | null;
  pack_size?: number;
  product_type?: string;
}

// Results come only from the API. On failure an error is returned; there is no local product list fallback.

export async function searchProducts(q: string): Promise<ApiResult<ProductSearchResult[]>> {
  if (!q.trim()) return { ok: true, data: [] };
  return apiList<ProductSearchResult>(`products/search${query({ q })}`);
}

/** A 404 result (status 404) means the barcode is not registered. */
export async function getProductByBarcode(barcode: string): Promise<ApiResult<ProductSearchResult>> {
  return apiObject<ProductSearchResult>(`products/barcode/${encodeURIComponent(barcode)}`);
}

export async function getProductById(id: string): Promise<ApiResult<ProductSearchResult>> {
  return apiObject<ProductSearchResult>(`products/${encodeURIComponent(id)}`);
}
