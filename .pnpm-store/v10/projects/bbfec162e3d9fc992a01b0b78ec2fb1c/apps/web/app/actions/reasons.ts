'use server';
import { apiList, apiRequest } from '@/lib/api/server';
import type { CatalogueReason } from '@/lib/reasonCatalogue';
export async function getReasons(admin = false) { return apiList<CatalogueReason>(admin ? 'admin/reasons' : 'reasons'); }
export async function createReason(text: string) { return apiRequest<CatalogueReason>('admin/reasons', { method: 'POST', body: { text } }); }
export async function editReason(id: string, text: string) { return apiRequest<CatalogueReason>(`admin/reasons/${encodeURIComponent(id)}`, { method: 'PATCH', body: { text } }); }
export async function deactivateReason(id: string) { return apiRequest<CatalogueReason>(`admin/reasons/${encodeURIComponent(id)}`, { method: 'DELETE' }); }

