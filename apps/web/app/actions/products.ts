'use server';

import { apiList, apiObject, apiRequest, query } from '@/lib/api/server';
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

/** Catalogue fields accepted by POST/PATCH /products. Stock and expiry are never set here. */
export interface ProductInput {
  name?: string;
  barcode?: string;
  generic_name?: string;
  brand_name?: string;
  strength?: string;
  dosage_form?: string;
  category?: string;
  manufacturer?: string;
  unit_of_measure?: string;
  pack_size?: number;
  retail_price?: number;
  reorder_level?: number;
  minimum_stock?: number;
  maximum_stock?: number;
  rx_required?: boolean;
  is_active?: boolean;
}

export async function createProduct(input: ProductInput): Promise<ApiResult<ProductSearchResult>> {
  return apiRequest<ProductSearchResult>('products', { method: 'POST', body: input });
}

export async function updateProduct(id: string, input: ProductInput): Promise<ApiResult<ProductSearchResult>> {
  return apiRequest<ProductSearchResult>(`products/${encodeURIComponent(id)}`, { method: 'PATCH', body: input });
}
