'use server';

import { cookies } from 'next/headers';
import { apiList } from '@/lib/api/server';
import type { ApiData, ApiResult } from '@/lib/api/types';

export async function createLabelRecord(data: any) {
  const cookieStore = await cookies();
  const token = cookieStore.get('sb-access-token')?.value;
  
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  
  try {
    const res = await fetch(`${apiUrl}/labels`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });

    if (!res.ok) {
      throw new Error(`API error: ${res.status}`);
    }

    const result = await res.json();
    return { success: true, data: result };
  } catch (e) {
    console.error("Failed to save label record", e);
    return { error: 'Failed to save label record' };
  }
}

export async function getRecentLabels(): Promise<ApiResult<ApiData[]>> {
  return apiList('labels');
}
