'use server';
import { cookies } from 'next/headers';
import { HARDCODED_PRODUCTS, ProductItem } from '../../constants/products';

async function fetchWithAuth(url: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get('sb-access-token')?.value;
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return res;
}

export async function searchProducts(q: string) {
  if (!q.trim()) return { data: [] };
  const cleanQ = q.trim().toLowerCase();

  // Search hardcoded products
  const hardcodedMatches = HARDCODED_PRODUCTS.filter((p) =>
    p.name.toLowerCase().includes(cleanQ)
  );

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  let apiMatches: any[] = [];
  try {
    const res = await fetchWithAuth(`${apiUrl}/products/search?q=${encodeURIComponent(q)}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        apiMatches = data;
      }
    }
  } catch (e) {
    console.error("Product search API failed, using hardcoded fallback", e);
  }

  // Merge unique by name or id
  const combined = [...hardcodedMatches];
  for (const item of apiMatches) {
    if (!combined.some((p) => p.name.toLowerCase() === item.name.toLowerCase())) {
      combined.push(item);
    }
  }

  return { data: combined };
}

export async function getProductByBarcode(barcode: string) {
  const hardcoded = HARDCODED_PRODUCTS.find((p) => p.barcode === barcode);
  if (hardcoded) {
    return { data: hardcoded };
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  try {
    const res = await fetchWithAuth(`${apiUrl}/products/barcode/${encodeURIComponent(barcode)}`);
    if (!res.ok) {
      if (res.status === 404) return { notFound: true };
      throw new Error(`API error: ${res.status}`);
    }
    const data = await res.json();
    return { data };
  } catch (e) {
    console.error("Barcode lookup failed", e);
    return { error: 'Failed to lookup barcode' };
  }
}

export async function getProductById(id: string) {
  const hardcoded = HARDCODED_PRODUCTS.find((p) => p.id === id);
  if (hardcoded) {
    return { data: hardcoded };
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  try {
    const res = await fetchWithAuth(`${apiUrl}/products/${encodeURIComponent(id)}`);
    if (!res.ok) {
      if (res.status === 404) return { notFound: true };
      throw new Error(`API error: ${res.status}`);
    }
    const data = await res.json();
    return { data };
  } catch (e) {
    console.error("Product lookup failed", e);
    return { error: 'Failed to lookup product' };
  }
}
