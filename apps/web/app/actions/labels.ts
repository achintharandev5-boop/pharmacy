'use server';
import { uiTestEnabled, UI_TEST_NOT_SAVED } from '@/lib/uiTestMode';

import { apiList, apiRequest } from '@/lib/api/server';
import type { ApiData, ApiResult } from '@/lib/api/types';

export async function createLabelRecord(data: ApiData) {
  if (uiTestEnabled()) return { error: UI_TEST_NOT_SAVED };
  const result = await apiRequest<ApiData>('labels', { method: 'POST', body: data });
  return result.ok ? { success: true, data: result.data } : { error: result.error };
}

export async function getRecentLabels(): Promise<ApiResult<ApiData[]>> {
  return apiList('labels');
}
