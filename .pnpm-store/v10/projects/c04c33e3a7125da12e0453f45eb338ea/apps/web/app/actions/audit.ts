'use server';
import { apiObject, query } from '@/lib/api/server';
import type { ApiResult } from '@/lib/api/types';
import type { AuditEvent, AuditFilters, AuditPage } from '@/lib/auditLog';

const UNEXPECTED = 'The pharmacy server returned an unexpected response.';

/** One page of the audit log, newest first. Administrators only (enforced by the API). */
export async function listAuditEvents(filters: AuditFilters, page: number, pageSize: number): Promise<ApiResult<AuditPage>> {
  const result = await apiObject<AuditPage>(
    `admin/audit-log${query({
      from: filters.from,
      to: filters.to,
      action: filters.action,
      entity: filters.entity,
      actor: filters.actor,
      record: filters.record.trim(),
      page,
      pageSize,
    })}`,
  );
  if (result.ok && (!Array.isArray(result.data.items) || typeof result.data.total !== 'number')) {
    return { ok: false, error: UNEXPECTED };
  }
  return result;
}

export async function getAuditEvent(id: string): Promise<ApiResult<AuditEvent>> {
  const result = await apiObject<AuditEvent>(`admin/audit-log/${encodeURIComponent(id)}`);
  if (result.ok && typeof result.data.id !== 'string') return { ok: false, error: UNEXPECTED };
  return result;
}
