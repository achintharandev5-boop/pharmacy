'use server';

import { apiList, apiObject, apiRequest, query } from '@/lib/api/server';
import type { ApiData, ApiResult } from '@/lib/api/types';

// All functions return ApiResult. Failures are reported as errors, never replaced with sample data.

export async function getAdminSummary(): Promise<ApiResult<ApiData>> {
  return apiObject('admin/dashboard/summary');
}

export async function getAdminActivity(range = '30d'): Promise<ApiResult<ApiData[]>> {
  return apiList(`admin/dashboard/activity${query({ range })}`);
}

export async function getAdminStatusBreakdown(): Promise<ApiResult<ApiData>> {
  return apiObject('admin/dashboard/status-breakdown');
}

export async function getAdminTopProducts(range = '30d', limit = 5): Promise<ApiResult<ApiData[]>> {
  return apiList(`admin/dashboard/top-products${query({ range, limit })}`);
}

export async function getAdminAlerts(): Promise<ApiResult<ApiData[]>> {
  return apiList('admin/dashboard/alerts');
}

export async function getAdminRecentActivity(limit = 10): Promise<ApiResult<ApiData[]>> {
  return apiList(`admin/dashboard/recent-activity${query({ limit })}`);
}

export async function getAdminHealth(): Promise<ApiResult<ApiData>> {
  return apiObject('admin/health');
}

export async function getPatientProfileData(id: string): Promise<ApiResult<ApiData>> {
  return apiObject(`admin/patients/${encodeURIComponent(id)}`);
}

export async function getProductMovementsData(id: string): Promise<ApiResult<ApiData[]>> {
  return apiList(`admin/products/${encodeURIComponent(id)}/movements`);
}

export async function getAdminPrescriptions(searchQuery?: string, status?: string): Promise<ApiResult<ApiData[]>> {
  return apiList(`admin/prescriptions${query({ query: searchQuery, status })}`);
}

export async function getAdminPrescriptionById(id: string): Promise<ApiResult<ApiData>> {
  return apiObject(`admin/prescriptions/${encodeURIComponent(id)}`);
}

export async function reprintAdminPrescription(id: string, reason?: string): Promise<ApiResult<ApiData>> {
  return apiRequest(`admin/prescriptions/${encodeURIComponent(id)}/reprint`, {
    method: 'POST',
    body: { reason },
  });
}

export async function getAdminProducts(
  searchQuery?: string,
  category?: string,
  stockStatus?: string,
): Promise<ApiResult<ApiData[]>> {
  return apiList(`admin/products${query({ query: searchQuery, category, stockStatus })}`);
}

export async function getAdminProductById(id: string): Promise<ApiResult<ApiData>> {
  return apiObject(`admin/products/${encodeURIComponent(id)}`);
}

export async function getAdminInventoryDashboard(): Promise<ApiResult<ApiData>> {
  return apiObject('admin/inventory/summary');
}

export async function getAdminLabelLogs(limit = 20): Promise<ApiResult<ApiData[]>> {
  return apiList(`admin/labels/logs${query({ limit })}`);
}
