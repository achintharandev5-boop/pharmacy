'use server';

import { cookies } from 'next/headers';

async function fetchSupplierApi(endpoint: string, options: { method?: string; body?: any } = {}) {
  const cookieStore = await cookies();
  const token = cookieStore.get('sb-access-token')?.value;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  try {
    const res = await fetch(`${apiUrl}/${endpoint}`, {
      method: options.method || 'GET',
      headers: {
        'Authorization': `Bearer ${token || ''}`,
        'Content-Type': 'application/json',
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: 'no-store',
    });

    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.error(`Supplier API fetch failed for ${endpoint}:`, e);
  }
  return null;
}

export async function getSuppliers(query?: string) {
  const params = new URLSearchParams();
  if (query) params.append('query', query);
  const data = await fetchSupplierApi(`suppliers?${params.toString()}`);
  return data || [];
}

export async function getSupplierById(id: string) {
  const data = await fetchSupplierApi(`suppliers/${id}`);
  return data || null;
}

export async function createSupplier(payload: any) {
  const data = await fetchSupplierApi('suppliers', {
    method: 'POST',
    body: payload,
  });
  return data || { id: `sup_${Date.now()}`, ...payload };
}

export async function updateSupplier(id: string, payload: any) {
  const data = await fetchSupplierApi(`suppliers/${id}`, {
    method: 'PATCH',
    body: payload,
  });
  return data || { id, ...payload };
}
