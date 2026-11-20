'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Eye, Filter, ScrollText, ShieldAlert, X } from 'lucide-react';
import { getCurrentUser } from '@/app/actions/auth';
import { getAuditEvent, listAuditEvents } from '@/app/actions/audit';
import {
  Alert,
  Badge,
  Button,
  Card,
  DataTable,
  DetailItem,
  Dialog,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  PageBody,
  PageHeader,
  Pagination,
  QueryView,
  Select,
  SkeletonRows,
  type Column,
} from '@/components/ui';
import { useApiQuery } from '@/lib/useApiQuery';
import { formatDateTime } from '@/lib/format';
import {
  ACTION_LABEL,
  ACTION_TONE,
  AUDIT_MODULES,
  AUDIT_PAGE_SIZE,
  EMPTY_FILTERS,
  MAX_AUDIT_PAGE,
  actionLabel,
  activeFilterCount,
  actorLabel,
  filtersFromParams,
  moduleLabel,
  recordHref,
  recordLabel,
  shortId,
  validateFilters,
  type AuditAction,
  type AuditEvent,
  type AuditFilters,
} from '@/lib/auditLog';

function ActionBadge({ action }: { action: string }) {
  return <Badge tone={ACTION_TONE[action as AuditAction] ?? 'neutral'}>{actionLabel(action)}</Badge>;
}

function FieldList({ event }: { event: AuditEvent }) {
  if (!event.changed_fields || event.changed_fields.length === 0) return <span className="text-subtle">—</span>;
  return <span className="font-mono text-xs line-clamp-2">{event.changed_fields.join(', ')}</span>;
}

/** Filter form. Changes are applied together with "Apply filters" (or Enter). */
function Filters({ applied, onApply }: { applied: AuditFilters; onApply: (f: AuditFilters) => void }) {
  const [draft, setDraft] = useState(applied);
  const [submitted, setSubmitted] = useState(false);
  // Keep the form in step when filters are set from elsewhere (details panel, Clear).
  const [lastApplied, setLastApplied] = useState(applied);
  if (lastApplied !== applied) {
    setLastApplied(applied);
    setDraft(applied);
    setSubmitted(false);
  }
  const errors = submitted ? validateFilters(draft) : {};
  const set = <K extends keyof AuditFilters>(key: K, value: AuditFilters[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const specificActor = draft.actor !== '' && draft.actor !== 'none';

  return (
    <form
      aria-label="Audit log filters"
      // The checks below explain each problem in words; the browser's own pop-ups would pre-empt them.
      noValidate
      className="grid grid-cols-1 gap-3 border-b border-border p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
      onSubmit={(e) => {
        e.preventDefault();
        setSubmitted(true);
        if (Object.keys(validateFilters(draft)).length === 0) onApply({ ...draft, record: draft.record.trim() });
      }}
    >
      <FormField label="From" error={errors.from}>
        {(p) => <Input {...p} type="date" value={draft.from} max={draft.to || undefined} onChange={(e) => set('from', e.target.value)} />}
      </FormField>
      <FormField label="To" error={errors.to}>
        {(p) => <Input {...p} type="date" value={draft.to} min={draft.from || undefined} onChange={(e) => set('to', e.target.value)} />}
      </FormField>
      <FormField label="Action">
        {(p) => (
          <Select {...p} value={draft.action} onChange={(e) => set('action', e.target.value as AuditFilters['action'])}>
            <option value="">All actions</option>
            {(Object.keys(ACTION_LABEL) as AuditAction[]).map((a) => (
              <option key={a} value={a}>
                {ACTION_LABEL[a]}
              </option>
            ))}
          </Select>
        )}
      </FormField>
      <FormField label="Module">
        {(p) => (
          <Select {...p} value={draft.entity} onChange={(e) => set('entity', e.target.value)}>
            <option value="">All modules</option>
            {AUDIT_MODULES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
        )}
      </FormField>
      <FormField label="User" error={errors.actor}>
        {(p) => (
          <Select {...p} value={specificActor ? 'specific' : draft.actor} onChange={(e) => e.target.value !== 'specific' && set('actor', e.target.value)}>
            <option value="">All users</option>
            <option value="none">Not recorded</option>
            {specificActor && <option value="specific">{`User ${shortId(draft.actor)}`}</option>}
          </Select>
        )}
      </FormField>
      <FormField label="Record reference" error={errors.record} hint="Exact record id">
        {(p) => <Input {...p} type="search" value={draft.record} maxLength={64} placeholder="e.g. a patient id" onChange={(e) => set('record', e.target.value)} />}
      </FormField>
      <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-3 xl:col-span-6">
        <Button type="submit" variant="primary" icon={Filter}>
          Apply filters
        </Button>
        <Button type="button" icon={X} disabled={activeFilterCount(applied) === 0 && activeFilterCount(draft) === 0} onClick={() => onApply(EMPTY_FILTERS)}>
          Clear
        </Button>
      </div>
    </form>
  );
}

/** Read-only details of one event, loaded from the API. Shows only what the record holds. */
function EventDetails({
  id,
  onClose,
  onFilter,
}: {
  id: string;
  onClose: () => void;
  onFilter: (patch: Partial<AuditFilters>) => void;
}) {
  const event = useApiQuery(() => getAuditEvent(id), [id]);
  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={`Audit event #${id}`}
      description="Read-only. Audit events cannot be edited or deleted."
      footer={
        <Button onClick={onClose} data-autofocus>
          Close
        </Button>
      }
    >
      <QueryView query={event} errorTitle="Could not load this audit event" loading={<SkeletonRows rows={4} label="Loading audit event" />}>
        {(e) => {
          const href = recordHref(e);
          const record = recordLabel(e);
          return (
            <div className="space-y-4">
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <DetailItem label="Action performed">
                  <ActionBadge action={e.action} /> <span className="ml-1 font-mono text-xs text-subtle">{e.action}</span>
                </DetailItem>
                <DetailItem label="Date and time">
                  {formatDateTime(e.occurred_at)}
                  <span className="block font-mono text-xs text-subtle">{e.occurred_at}</span>
                </DetailItem>
                <DetailItem label="User">
                  {e.actor ? (
                    <>
                      {actorLabel(e.actor)}
                      <span className="block font-mono text-xs text-subtle break-all">{e.actor.id}</span>
                    </>
                  ) : (
                    <>
                      Not recorded
                      <span className="block text-xs text-subtle">The database saved this change without a user. See the audit coverage notes.</span>
                    </>
                  )}
                </DetailItem>
                <DetailItem label="Module">
                  {moduleLabel(e)}
                  <span className="block font-mono text-xs text-subtle">{e.entity_type}</span>
                </DetailItem>
                <DetailItem label="Record reference">
                  {record ? (
                    <>
                      {href ? (
                        <Link href={href} className="text-primary hover:underline underline-offset-2">
                          {record}
                        </Link>
                      ) : (
                        record
                      )}
                      {record !== e.entity_id && <span className="block font-mono text-xs text-subtle">{e.entity_id}</span>}
                    </>
                  ) : (
                    'Not recorded'
                  )}
                </DetailItem>
                <DetailItem label="Result">Saved (the log only records changes the database committed)</DetailItem>
              </dl>

              <div>
                <h3 className="text-xs font-medium text-subtle">Changed fields</h3>
                {e.action === 'UPDATE' && e.changed_fields && e.changed_fields.length > 0 ? (
                  <ul className="mt-1 flex flex-wrap gap-1.5" aria-label="Changed fields">
                    {e.changed_fields.map((f) => (
                      <li key={f} className="rounded-ui-sm border border-border bg-surface px-2 py-0.5 font-mono text-xs text-fg">
                        {f}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-sm text-fg">
                    {e.action === 'INSERT'
                      ? 'The record was created. The log does not list the fields of a new record.'
                      : e.action === 'DELETE'
                        ? 'The record was deleted. The log does not keep its contents.'
                        : 'No field names were recorded.'}
                  </p>
                )}
                {e.withheld_fields > 0 && (
                  <p className="mt-2 text-xs text-warning">
                    {e.withheld_fields} {e.withheld_fields === 1 ? 'entry was' : 'entries were'} withheld because {e.withheld_fields === 1 ? 'it does' : 'they do'} not look like a field name.
                  </p>
                )}
              </div>

              <Alert tone="info" title="Previous and new values are not recorded">
                The audit log keeps which fields changed, not their values, so patient details stay only in the patient record.
              </Alert>

              <div className="flex flex-wrap gap-2">
                {e.entity_id && (
                  <Button size="md" onClick={() => onFilter({ entity: e.entity_type, record: e.entity_id ?? '' })}>
                    All changes to this record
                  </Button>
                )}
                <Button size="md" onClick={() => onFilter({ actor: e.actor ? e.actor.id : 'none' })}>
                  {e.actor ? 'All changes by this user' : 'All changes without a user'}
                </Button>
              </div>
            </div>
          );
        }}
      </QueryView>
    </Dialog>
  );
}

function AuditLogView() {
  const params = useSearchParams();
  const [filters, setFilters] = useState<AuditFilters>(() => filtersFromParams(params));
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);

  const events = useApiQuery(() => listAuditEvents(filters, page, AUDIT_PAGE_SIZE), [filters, page]);
  const apply = (next: AuditFilters) => {
    setFilters(next);
    setPage(1);
  };
  const filtered = activeFilterCount(filters) > 0;

  const columns: Column<AuditEvent>[] = [
    { key: 'when', header: 'Date and time', cell: (e) => <span className="tabular whitespace-nowrap">{formatDateTime(e.occurred_at)}</span> },
    { key: 'action', header: 'Action', cell: (e) => <ActionBadge action={e.action} /> },
    { key: 'module', header: 'Module', cell: (e) => moduleLabel(e) },
    {
      key: 'user',
      header: 'User',
      hideOnMobile: true,
      cell: (e) => <span className={e.actor ? undefined : 'text-subtle'}>{actorLabel(e.actor)}</span>,
    },
    {
      key: 'record',
      header: 'Record',
      hideOnMobile: true,
      cell: (e) => {
        const label = recordLabel(e);
        return label ? (
          <span className="font-mono text-xs" title={e.entity_id ?? undefined}>
            {e.entity_type === 'pharmacy_settings' ? label : shortId(label)}
          </span>
        ) : (
          <span className="text-subtle">—</span>
        );
      },
    },
    { key: 'fields', header: 'Changed fields', hideOnMobile: true, className: 'max-w-xs', cell: (e) => <FieldList event={e} /> },
    {
      key: 'details',
      header: <span className="sr-only">Details</span>,
      align: 'right',
      cell: (e) => (
        <Button size="md" variant="ghost" icon={Eye} onClick={() => setOpenId(e.id)} aria-label={`Details of audit event ${e.id}`}>
          <span className="hidden sm:inline">Details</span>
        </Button>
      ),
    },
  ];

  return (
    <>
      <Card>
        <Filters applied={filters} onApply={apply} />
        {events.status === 'success' && (
          <p className="border-b border-border px-4 py-2 text-sm text-subtle tabular" aria-live="polite">
            {events.data.total === 1 ? '1 event' : `${events.data.total.toLocaleString()} events`}
            {filtered && ' match the filters'}
            {events.isFetching && ' · updating…'}
          </p>
        )}
        <QueryView
          query={events}
          errorTitle="Could not load the audit log"
          loading={<SkeletonRows rows={6} label="Loading audit log" />}
          isEmpty={(d) => d.total === 0}
          empty={
            filtered ? (
              <EmptyState
                title="No audit events match these filters"
                description="Widen the date range or clear a filter."
                action={<Button onClick={() => apply(EMPTY_FILTERS)}>Clear filters</Button>}
              />
            ) : (
              <EmptyState icon={ScrollText} title="No audit events recorded yet" description="Changes to audited records will appear here." />
            )
          }
        >
          {(data) => {
            const pageCount = Math.min(MAX_AUDIT_PAGE, Math.max(1, Math.ceil(data.total / data.pageSize)));
            return data.items.length === 0 ? (
              <EmptyState
                title="This page is empty"
                description="The log changed since the list was loaded."
                action={<Button onClick={() => setPage(1)}>Go to the first page</Button>}
              />
            ) : (
              <>
                <DataTable caption="Audit events, newest first" columns={columns} rows={data.items} pageSize={data.pageSize} rowKey={(e) => e.id} />
                {data.total > data.pageSize && (
                  <Pagination page={data.page} pageCount={pageCount} total={data.total} pageSize={data.pageSize} onChange={setPage} />
                )}
                {data.total > MAX_AUDIT_PAGE * data.pageSize && (
                  <p className="border-t border-border px-4 py-2 text-xs text-subtle">
                    Only the newest {(MAX_AUDIT_PAGE * data.pageSize).toLocaleString()} matching events can be paged through. Narrow the dates to see older ones.
                  </p>
                )}
              </>
            );
          }}
        </QueryView>
      </Card>
      {openId && (
        <EventDetails
          id={openId}
          onClose={() => setOpenId(null)}
          onFilter={(patch) => {
            setOpenId(null);
            apply({ ...EMPTY_FILTERS, ...patch });
          }}
        />
      )}
    </>
  );
}

function AuditLogInner() {
  const me = useApiQuery(() => getCurrentUser(), []);
  return (
    <PageBody>
      <PageHeader
        title="Audit log"
        description="Changes recorded by the database, newest first. Each entry is a change that was saved; refused or failed attempts are not recorded."
      />
      {me.status === 'loading' && (
        <Card>
          <SkeletonRows rows={4} label="Checking your access" />
        </Card>
      )}
      {me.status === 'error' && (
        <Card>
          <ErrorState title="Could not confirm your access" message={me.error} onRetry={me.retry} retrying={me.isFetching} />
        </Card>
      )}
      {me.status === 'success' &&
        (me.data.role === 'admin' ? (
          <AuditLogView />
        ) : (
          <Card>
            <EmptyState icon={ShieldAlert} title="Administrators only" description="The audit log is available to administrators. Ask an administrator if you need a change history." />
          </Card>
        ))}
    </PageBody>
  );
}

export default function AuditLogPage() {
  return (
    <Suspense>
      <AuditLogInner />
    </Suspense>
  );
}
