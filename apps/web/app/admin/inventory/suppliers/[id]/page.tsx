'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { Pencil } from 'lucide-react';
import { getSupplierById } from '@/app/actions/suppliers';
import { SupplierDialog } from '@/components/suppliers/SupplierDialog';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  DataTable,
  DetailItem,
  EmptyState,
  PageBody,
  PageHeader,
  QueryView,
  StatusBadge,
  useToast,
  type Column,
} from '@/components/ui';
import { useApiQuery } from '@/lib/useApiQuery';
import { formatDate, formatLkr, formatNumber, text } from '@/lib/format';
import type { ApiData } from '@/lib/api/types';

const receiptColumns: Column<ApiData>[] = [
  { key: 'grn', header: 'GRN', cell: (r) => <span className="font-mono">{r.receipt_number}</span> },
  { key: 'invoice', header: 'Invoice', cell: (r) => text(r.invoice_number) },
  { key: 'date', header: 'Received', cell: (r) => formatDate(r.received_date) },
  { key: 'cost', header: 'Total cost', align: 'right', cell: (r) => <span className="tabular">{formatLkr(r.total_cost)}</span> },
  { key: 'status', header: 'Status', hideOnMobile: true, cell: (r) => <StatusBadge status={r.status} /> },
];

const batchColumns: Column<ApiData>[] = [
  { key: 'product', header: 'Medicine', cell: (b) => b.products?.name ?? 'Unknown medicine' },
  { key: 'batch', header: 'Batch', cell: (b) => <span className="font-mono">{b.batch_number}</span> },
  { key: 'expiry', header: 'Expiry', cell: (b) => formatDate(b.expiry_date) },
  { key: 'left', header: 'Units left', align: 'right', cell: (b) => <span className="tabular">{formatNumber(b.quantity_available)}</span> },
];

export default function SupplierDetailPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const query = useApiQuery(() => getSupplierById(id), [id]);
  const [editing, setEditing] = useState(false);
  const supplier = query.data?.supplier;

  return (
    <PageBody>
      <PageHeader
        title={supplier?.name ?? 'Supplier'}
        breadcrumbs={[{ label: 'Suppliers', href: '/admin/inventory/suppliers' }, { label: supplier?.name ?? 'Supplier' }]}
        actions={
          supplier && (
            <Button icon={Pencil} onClick={() => setEditing(true)}>
              Edit
            </Button>
          )
        }
      />
      <QueryView query={query} errorTitle="Could not load this supplier">
        {(data) => {
          const s = data.supplier ?? {};
          const receipts: ApiData[] = Array.isArray(data.receipts) ? data.receipts : [];
          const batches: ApiData[] = Array.isArray(data.suppliedBatches) ? data.suppliedBatches : [];
          return (
            <div className="space-y-6">
              <Card>
                <CardHeader title="Details" actions={s.active === false ? <Badge>Inactive</Badge> : <Badge tone="success">Active</Badge>} />
                <CardBody>
                  <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    <DetailItem label="Contact">{text(s.contact_person)}</DetailItem>
                    <DetailItem label="Phone"><span className="tabular">{text(s.phone)}</span></DetailItem>
                    <DetailItem label="Email">{text(s.email)}</DetailItem>
                    <DetailItem label="Registration">{text(s.registration_number)}</DetailItem>
                    <div className="col-span-2">
                      <DetailItem label="Address">{text(s.address)}</DetailItem>
                    </div>
                    <div className="col-span-2">
                      <DetailItem label="Notes">{text(s.notes)}</DetailItem>
                    </div>
                  </dl>
                </CardBody>
              </Card>
              <Card>
                <CardHeader title="Goods received" />
                {receipts.length === 0 ? (
                  <EmptyState title="No deliveries recorded from this supplier" />
                ) : (
                  <DataTable caption="Goods received from this supplier" columns={receiptColumns} rows={receipts} rowKey={(r) => r.id} />
                )}
              </Card>
              <Card>
                <CardHeader title="Batches supplied" />
                {batches.length === 0 ? (
                  <EmptyState title="No batches from this supplier" />
                ) : (
                  <DataTable caption="Batches supplied" columns={batchColumns} rows={batches} rowKey={(b) => b.id} rowHref={(b) => (b.product_id ? `/admin/products/${b.product_id}` : null)} />
                )}
              </Card>
            </div>
          );
        }}
      </QueryView>
      {supplier && editing && (
        <SupplierDialog
          open={editing}
          supplier={supplier}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            toast.success('Supplier details saved.');
            query.retry();
          }}
        />
      )}
    </PageBody>
  );
}
