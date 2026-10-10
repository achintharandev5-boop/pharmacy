'use client';

import React, { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { FilePlus2, FileText } from 'lucide-react';
import { getAdminPrescriptions } from '@/app/actions/admin';
import {
  Card,
  DataTable,
  EmptyState,
  LinkButton,
  PageBody,
  PageHeader,
  QueryView,
  SearchInput,
  SegmentedControl,
  StatusBadge,
  type Column,
} from '@/components/ui';
import { useApiQuery } from '@/lib/useApiQuery';
import { formatDateTime } from '@/lib/format';
import type { ApiData } from '@/lib/api/types';

const STATUSES = [
  { id: 'ALL', label: 'All' },
  { id: 'COMPLETED', label: 'Completed' },
  { id: 'DRAFT', label: 'Draft' },
  { id: 'CANCELLED', label: 'Cancelled' },
];

const columns: Column<ApiData>[] = [
  { key: 'number', header: 'Prescription', cell: (r) => <span className="font-mono">{r.prescription_number}</span> },
  {
    key: 'patient',
    header: 'Patient',
    cell: (r) => (
      <div>
        <p>{r.customer_name_text || '—'}</p>
        {r.customer_phone && <p className="text-xs text-subtle tabular">{r.customer_phone}</p>}
      </div>
    ),
  },
  {
    key: 'items',
    header: 'Labels',
    align: 'right',
    cell: (r) => <span className="tabular">{Array.isArray(r.prescription_items) ? r.prescription_items.length : '—'}</span>,
  },
  { key: 'printed', header: 'Printed', hideOnMobile: true, cell: (r) => (r.printed_at ? formatDateTime(r.printed_at) : 'Not printed') },
  { key: 'created', header: 'Saved', hideOnMobile: true, cell: (r) => formatDateTime(r.created_at) },
  { key: 'status', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
];

function PrescriptionsInner() {
  const params = useSearchParams();
  const [search, setSearch] = useState(params.get('search') ?? '');
  const [status, setStatus] = useState('ALL');
  // Status filters on the server; the search box filters the loaded list without a request per keystroke.
  const list = useApiQuery(() => getAdminPrescriptions(undefined, status), [status]);

  const q = search.trim().toLowerCase();
  const matches = (r: ApiData) =>
    !q ||
    r.prescription_number?.toLowerCase().includes(q) ||
    r.customer_name_text?.toLowerCase().includes(q) ||
    (r.customer_phone ?? '').includes(q.replace(/[\s-]/g, ''));

  return (
    <PageBody>
      <PageHeader
        title="Prescriptions"
        description="Every prescription saved from the label workstation, most recent first (up to 500)."
        actions={
          <LinkButton href="/label" variant="primary" icon={FilePlus2}>
            New prescription label
          </LinkButton>
        }
      />
      <Card>
        <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
          <SearchInput value={search} onChange={setSearch} label="Search prescriptions" placeholder="RX number, patient or phone" />
          <SegmentedControl label="Status" options={STATUSES} value={status} onChange={setStatus} />
        </div>
        <QueryView
          query={list}
          errorTitle="Could not load prescriptions"
          isEmpty={(d) => d.length === 0}
          empty={<EmptyState icon={FileText} title={status === 'ALL' ? 'No prescriptions yet' : 'No prescriptions with this status'} />}
        >
          {(rows) => {
            const shown = rows.filter(matches);
            return shown.length === 0 ? (
              <EmptyState title="No prescriptions match your search" />
            ) : (
              <DataTable caption="Prescriptions" columns={columns} rows={shown} rowKey={(r) => r.id} rowHref={(r) => `/admin/prescriptions/${r.id}`} />
            );
          }}
        </QueryView>
      </Card>
    </PageBody>
  );
}

export default function PrescriptionsPage() {
  return (
    <Suspense>
      <PrescriptionsInner />
    </Suspense>
  );
}
