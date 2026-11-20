/**
 * Audit log viewer: types and display helpers, mirroring apps/api/src/audit.
 *
 * The audit log records WHICH fields changed, never their values. Nothing here invents a value,
 * a user or a result that the record does not hold.
 */

export type AuditAction = 'INSERT' | 'UPDATE' | 'DELETE';

export interface AuditEvent {
  id: string;
  occurred_at: string;
  action: AuditAction | string;
  entity_type: string;
  /** Null for a table the API does not know. */
  module: string | null;
  entity_id: string | null;
  /** Column names only. Null for inserts and deletes. */
  changed_fields: string[] | null;
  /** Entries the API withheld because they did not look like column names. */
  withheld_fields: number;
  /** Null when the database recorded the change without a user. */
  actor: { id: string; name: string | null } | null;
}

export interface AuditPage {
  items: AuditEvent[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AuditFilters {
  from: string;
  to: string;
  action: '' | AuditAction;
  entity: string;
  /** '' any user, 'none' recorded without a user, or a user id. */
  actor: string;
  record: string;
}

export const EMPTY_FILTERS: AuditFilters = { from: '', to: '', action: '', entity: '', actor: '', record: '' };

export const AUDIT_PAGE_SIZE = 25;
/** The API's deepest page; older events are reached by narrowing the dates. */
export const MAX_AUDIT_PAGE = 200;

export const ACTION_LABEL: Record<AuditAction, string> = {
  INSERT: 'Created',
  UPDATE: 'Updated',
  DELETE: 'Deleted',
};

export const ACTION_TONE: Record<AuditAction, 'success' | 'info' | 'danger'> = {
  INSERT: 'success',
  UPDATE: 'info',
  DELETE: 'danger',
};

/** Audited tables, in the order the module filter lists them (same set as the API accepts). */
export const AUDIT_MODULES: { value: string; label: string }[] = [
  { value: 'customers', label: 'Patients' },
  { value: 'products', label: 'Medicines' },
  { value: 'product_batches', label: 'Inventory batches' },
  { value: 'patient_returns', label: 'Patient returns' },
  { value: 'suppliers', label: 'Suppliers' },
  { value: 'pharmacy_settings', label: 'Pharmacy settings' },
  { value: 'reasons', label: 'Edit reasons' },
  { value: 'user_profiles', label: 'User profiles' },
];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RECORD_REFERENCE = /^[A-Za-z0-9_-]{1,64}$/;

export function actionLabel(action: string): string {
  return ACTION_LABEL[action as AuditAction] ?? action;
}

export function moduleLabel(event: Pick<AuditEvent, 'module' | 'entity_type'>): string {
  return event.module ?? event.entity_type;
}

/** The single settings row has the id `true`; show that as a name rather than a code. */
export function recordLabel(event: Pick<AuditEvent, 'entity_type' | 'entity_id'>): string | null {
  if (!event.entity_id) return null;
  if (event.entity_type === 'pharmacy_settings') return 'Pharmacy settings record';
  return event.entity_id;
}

/** Short form of a UUID for table cells; the full id is in the details panel. */
export function shortId(id: string): string {
  return UUID.test(id) ? id.slice(0, 8) : id;
}

/** A page in the app that shows the affected record, where one exists. */
export function recordHref(event: Pick<AuditEvent, 'entity_type' | 'entity_id'>): string | null {
  if (event.entity_type === 'pharmacy_settings' && event.entity_id) return '/admin/settings';
  if (!event.entity_id || !UUID.test(event.entity_id)) return null;
  if (event.entity_type === 'customers') return `/admin/patients/${event.entity_id}`;
  if (event.entity_type === 'products') return `/admin/products/${event.entity_id}`;
  return null;
}

export function actorLabel(actor: AuditEvent['actor']): string {
  if (!actor) return 'Not recorded';
  return actor.name ?? `User ${shortId(actor.id)}`;
}

/** Client-side checks mirroring the API, so a bad filter is explained before any request. */
export function validateFilters(f: AuditFilters): Partial<Record<keyof AuditFilters, string>> {
  const errors: Partial<Record<keyof AuditFilters, string>> = {};
  if (f.from && f.to && f.from > f.to) errors.to = 'The end date must be on or after the start date.';
  const record = f.record.trim();
  if (record && !RECORD_REFERENCE.test(record)) errors.record = 'Enter a record id: letters, digits, - and _ only.';
  if (f.actor && f.actor !== 'none' && !UUID.test(f.actor)) errors.actor = 'Not a valid user id.';
  return errors;
}

export function activeFilterCount(f: AuditFilters): number {
  return (Object.keys(EMPTY_FILTERS) as (keyof AuditFilters)[]).filter((k) => f[k].trim() !== '').length;
}

/** Reads filters from the page URL, ignoring anything the API would refuse. */
export function filtersFromParams(params: { get(name: string): string | null }): AuditFilters {
  const pick = (name: keyof AuditFilters) => params.get(name)?.trim() ?? '';
  const date = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '');
  const action = pick('action');
  const entity = pick('entity');
  const actor = pick('actor');
  const record = pick('record');
  return {
    from: date(pick('from')),
    to: date(pick('to')),
    action: action in ACTION_LABEL ? (action as AuditAction) : '',
    entity: AUDIT_MODULES.some((m) => m.value === entity) ? entity : '',
    actor: actor === 'none' || UUID.test(actor) ? actor : '',
    record: RECORD_REFERENCE.test(record) ? record : '',
  };
}
