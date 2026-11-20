'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { PackagePlus, Pencil, SlidersHorizontal } from 'lucide-react';
import { getAdminProductById } from '@/app/actions/admin';
import { ProductDialog } from '@/components/products/ProductDialog';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  DataTable,
  DetailItem,
  EmptyState,
  LinkButton,
  PageBody,
  PageHeader,
  QueryView,
  StatTile,
  StatusBadge,
  useToast,
  type Column,
} from '@/components/ui';
import { useApiQuery } from '@/lib/useApiQuery';
import { daysUntil, formatDate, formatDateTime, formatLkr, formatNumber, text, toNumberOrNull } from '@/lib/format';
import type { ApiData } from '@/lib/api/types';

function ExpiryCell({ date }: { date: string | null }) {
  const d = daysUntil(date);
  if (d === null) return <span className="text-subtle">Not recorded</span>;
  return (
    <span className="flex flex-col">
      <span>{formatDate(date)}</span>
      {d < 0 ? (
        <span className="text-xs font-medium text-danger">Expired</span>
      ) : d <= 30 ? (
        <span className="text-xs font-medium text-warning">{d} day(s) left</span>
      ) : null}
    </span>
  );
}

const batchColumns: Column<ApiData>[] = [
  { key: 'batch', header: 'Batch', cell: (b) => <span className="font-mono">{b.batch_number}</span> },
  { key: 'expiry', header: 'Expiry', cell: (b) => <ExpiryCell date={b.expiry_date} /> },
  { key: 'available', header: 'Available', align: 'right', cell: (b) => <span className="tabular">{formatNumber(b.quantity_available)}</span> },
  { key: 'received', header: 'Received', align: 'right', hideOnMobile: true, cell: (b) => <span className="tabular">{formatNumber(b.quantity_received)}</span> },
  { key: 'supplier', header: 'Supplier', hideOnMobile: true, cell: (b) => text(b.suppliers?.name) },
  { key: 'status', header: 'Status', cell: (b) => <StatusBadge status={b.status} /> },
];

const movementColumns: Column<ApiData>[] = [
  { key: 'date', header: 'Date', cell: (m) => formatDateTime(m.created_at) },
  { key: 'type', header: 'Type', cell: (m) => <StatusBadge status={m.movement_type} /> },
  {
    key: 'qty',
    header: 'Change',
    align: 'right',
    cell: (m) => {
      const q = toNumberOrNull(m.quantity);
      return <span className={`tabular font-medium ${q !== null && q < 0 ? 'text-danger' : 'text-success'}`}>{q === null ? '—' : q > 0 ? `+${q}` : q}</span>;
    },
  },
  { key: 'after', header: 'Stock after', align: 'right', hideOnMobile: true, cell: (m) => <span className="tabular">{formatNumber(m.stock_after)}</span> },
  {
    key: 'ref',
    header: 'Reference',
    hideOnMobile: true,
    cell: (m) => m.prescriptions?.prescription_number ?? m.product_batches?.batch_number ?? m.reason ?? '—',
  },
];

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const query = useApiQuery(() => getAdminProductById(id), [id]);
  const [editing, setEditing] = useState(false);
  const product = query.data?.product;

  return (
    <PageBody>
      <PageHeader
        title={product?.name ?? 'Medicine'}
        description={product ? [product.generic_name, product.strength, product.dosage_form].filter(Boolean).join(' · ') || undefined : undefined}
        breadcrumbs={[{ label: 'Medicines', href: '/admin/products' }, { label: product?.name ?? 'Medicine' }]}
        actions={
          product && (
            <>
              <LinkButton href="/admin/inventory/receiving" icon={PackagePlus}>
                Receive stock
              </LinkButton>
              <LinkButton href={`/admin/inventory/adjustments?product=${product.id}`} icon={SlidersHorizontal}>
                Adjust
              </LinkButton>
              <Button variant="primary" icon={Pencil} onClick={() => setEditing(true)}>
                Edit
              </Button>
            </>
          )
        }
      />
      <QueryView query={query} errorTitle="Could not load this medicine">
        {(data) => {
          const p = data.product ?? {};
          const batches: ApiData[] = Array.isArray(data.batches) ? data.batches : [];
          const movements: ApiData[] = Array.isArray(data.movements) ? data.movements : [];
          const batchTotal = batches.reduce((n, b) => n + (toNumberOrNull(b.quantity_available) ?? 0), 0);
          const stock = toNumberOrNull(p.stock_quantity);
          return (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatTile label="In stock" value={stock} hint={p.is_active === false ? 'Inactive: cannot be dispensed' : <StatusBadge status={p.stock_level} />} />
                <StatTile label="Reorder level" value={toNumberOrNull(p.reorder_level)} hint={p.reorder_level == null ? 'Not set: low stock is not detected' : `Minimum ${formatNumber(p.minimum_stock)}`} />
                <StatTile label="In batch records" value={batchTotal} hint={stock !== null && stock !== batchTotal ? `${formatNumber(stock - batchTotal)} unit(s) recorded without a batch` : 'Matches stock total'} />
                <StatTile label="Retail price" value={p.retail_price == null ? null : formatLkr(p.retail_price)} hint="Per unit, for valuation" />
              </div>

              <Card>
                <CardHeader title="Catalogue details" actions={p.is_active === false ? <Badge>Inactive</Badge> : <Badge tone="success">Active</Badge>} />
                <CardBody>
                  <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    <DetailItem label="Barcode"><span className="font-mono">{text(p.barcode)}</span></DetailItem>
                    <DetailItem label="Brand">{text(p.brand_name)}</DetailItem>
                    <DetailItem label="Category">{text(p.category)}</DetailItem>
                    <DetailItem label="Manufacturer">{text(p.manufacturer)}</DetailItem>
                    <DetailItem label="Pack size">{p.pack_size ? `${p.pack_size} ${p.unit_of_measure ?? ''}`.trim() : '—'}</DetailItem>
                    <DetailItem label="Prescription">{p.rx_required === false ? 'Not required' : 'Required'}</DetailItem>
                    <DetailItem label="Maximum stock">{formatNumber(p.maximum_stock)}</DetailItem>
                    <DetailItem label="Last updated">{formatDateTime(p.updated_at)}</DetailItem>
                  </dl>
                </CardBody>
              </Card>

              <Card>
                <CardHeader title="Batches" description="Earliest expiry first" />
                {batches.length === 0 ? (
                  <EmptyState title="No batch records" description="Batches are created when stock is received with a batch number and expiry date." />
                ) : (
                  <DataTable caption="Batches of this medicine" columns={batchColumns} rows={batches} rowKey={(b) => b.id} />
                )}
              </Card>

              <Card>
                <CardHeader title="Stock movements" description="Every recorded change to this medicine’s stock" />
                {movements.length === 0 ? (
                  <EmptyState title="No stock movements yet" />
                ) : (
                  <DataTable caption="Stock movements" columns={movementColumns} rows={movements} rowKey={(m) => m.id} />
                )}
              </Card>
            </div>
          );
        }}
      </QueryView>
      {product && editing && (
        <ProductDialog
          open={editing}
          product={product}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            toast.success('Medicine details saved.');
            query.retry();
          }}
        />
      )}
    </PageBody>
  );
}
