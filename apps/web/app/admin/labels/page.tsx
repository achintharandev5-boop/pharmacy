'use client';

import React, { useState } from 'react';
import { History } from 'lucide-react';
import { getAdminLabelLogs } from '@/app/actions/admin';
import { Card, DataTable, EmptyState, PageBody, PageHeader, QueryView, SegmentedControl, StatusBadge, type Column } from '@/components/ui';
import { useApiQuery } from '@/lib/useApiQuery';
import { formatDateTime } from '@/lib/format';
import type { ApiData } from '@/lib/api/types';

const LIMIT = 200;

function labelCount(ev: ApiData): number | null {
  const c = ev.prescriptions?.prescription_items?.[0]?.count;
  return typeof c === 'number' ? c : null;
}

const columns: Column<ApiData>[] = [
  { key: 'time', header: 'Printed', cell: (e) => formatDateTime(e.created_at) },
  { key: 'type', header: 'Type', cell: (e) => <StatusBadge status={e.event_type} /> },
  { key: 'rx', header: 'Prescription', cell: (e) => <span className="font-mono">{e.prescriptions?.prescription_number ?? '(deleted)'}</span> },
  { key: 'patient', header: 'Patient', hideOnMobile: true, cell: (e) => e.prescriptions?.customer_name_text ?? '—' },
  { key: 'labels', header: 'Labels', align: 'right', cell: (e) => <span className="tabular">{labelCount(e) ?? '—'}</span> },
  { key: 'reason', header: 'Reprint reason', hideOnMobile: true, cell: (e) => e.metadata?.reason ?? '—' },
];

export default function LabelHistoryPage() {
  const [type, setType] = useState('ALL');
  const logs = useApiQuery(() => getAdminLabelLogs(LIMIT), []);

  return (
    <PageBody>
      <PageHeader title="Label history" description={`The ${LIMIT} most recent label prints and reprints.`} />
      <Card>
        <div className="flex items-center justify-between gap-3 border-b border-border p-4">
          <SegmentedControl
            label="Event type"
            value={type}
            onChange={setType}
            options={[
              { id: 'ALL', label: 'All' },
              { id: 'PRINTED', label: 'Printed' },
              { id: 'REPRINTED', label: 'Reprinted' },
            ]}
          />
        </div>
        <QueryView
          query={logs}
          errorTitle="Could not load label history"
          isEmpty={(d) => d.length === 0}
          empty={<EmptyState icon={History} title="No labels printed yet" description="Prints are recorded when labels are printed from the workstation." />}
        >
          {(rows) => {
            const shown = rows.filter((e: ApiData) => type === 'ALL' || e.event_type === type);
            return shown.length === 0 ? (
              <EmptyState title="No events of this type" />
            ) : (
              <DataTable
                caption="Label print history"
                columns={columns}
                rows={shown}
                rowKey={(e) => e.id}
                rowHref={(e) => (e.prescription_id ? `/admin/prescriptions/${e.prescription_id}` : null)}
              />
            );
          }}
        </QueryView>
      </Card>
    </PageBody>
  );
}
