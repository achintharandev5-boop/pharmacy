'use server';

import { uiTestEnabled } from '@/lib/uiTestMode';
import { apiRequest } from '@/lib/api/server';

export type CheckStatus = 'ok' | 'error';

export interface SystemStatus {
  api: { status: CheckStatus; detail?: string };
  database: { status: CheckStatus; detail?: string };
  /** Whether an SMS token is configured on this server. The value itself is never returned. */
  smsConfigured: boolean;
  checkedAt: string;
}

/** Live checks only: every value here is measured, not assumed. */
export async function getSystemStatus(): Promise<SystemStatus> {
  const [api, db] = await Promise.all([
    apiRequest<{ status?: string }>('health'),
    apiRequest<{ status?: string; error?: string }>('health/db'),
  ]);

  const apiOk = api.ok && api.data?.status === 'ok';
  const dbOk = db.ok && db.data?.status !== 'error';

  return {
    api: apiOk ? { status: 'ok' } : { status: 'error', detail: api.ok ? 'Unexpected health response' : api.error },
    database: dbOk
      ? { status: 'ok' }
      : { status: 'error', detail: db.ok ? 'Database query failed' : db.error },
    smsConfigured: !uiTestEnabled() && Boolean(process.env.TEXT_LK_API_TOKEN),
    checkedAt: new Date().toISOString(),
  };
}
