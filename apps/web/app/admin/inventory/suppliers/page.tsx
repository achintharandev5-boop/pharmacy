'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Truck } from 'lucide-react';
import { getSuppliers } from '@/app/actions/suppliers';
import { SupplierDialog } from '@/components/suppliers/SupplierDialog';
import { Badge, Button, Card, DataTable, EmptyState, PageBody, PageHeader, QueryView, SearchInput, useToast, type Column } from '@/components/ui';
import { useApiQuery } from '@/lib/useApiQuery';
import { text } from '@/lib/format';
import type { ApiData } from '@/lib/api/types';

const columns: Column<ApiData>[] = [
  { key: 'name', header: 'Supplier', cell: (s) => s.name },
  { key: 'contact', header: 'Contact', hideOnMobile: true, cell: (s) => text(s.contact_person) },
  { key: 'phone', header: 'Phone', cell: (s) => <span className="tabular">{text(s.phone)}</span> },
  { key: 'email', header: 'Email', hideOnMobile: true, cell: (s) => text(s.email) },
  { key: 'status', header: 'Status', cell: (s) => (s.active === false ? <Badge>Inactive</Badge> : <Badge tone="success">Active</Badge>) },
];

export default function SuppliersPage() {
  const router = useRouter();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const suppliers = useApiQuery(() => getSuppliers(), []);
  const q = search.trim().toLowerCase();

  return (
    <PageBody>
      <PageHeader
        title="Suppliers"
        description="Suppliers that stock is received from."
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setAdding(true)}>
            Add supplier
          </Button>
        }
      />
      <Card className="overflow-hidden">
        <div className="border-b border-border p-4">
          <SearchInput value={search} onChange={setSearch} label="Search suppliers" placeholder="Name, contact or phone" />
        </div>
        <QueryView
          query={suppliers}
          errorTitle="Could not load suppliers"
          isEmpty={(d) => d.length === 0}
          empty={
            <EmptyState
              icon={Truck}
              title="No suppliers yet"
              description="Add a supplier before recording a delivery."
              action={<Button icon={Plus} onClick={() => setAdding(true)}>Add supplier</Button>}
            />
          }
        >
          {(rows) => {
            const shown = rows.filter(
              (s: ApiData) => !q || s.name?.toLowerCase().includes(q) || s.contact_person?.toLowerCase().includes(q) || s.phone?.includes(q),
            );
            return shown.length === 0 ? (
              <EmptyState title="No suppliers match your search" />
            ) : (
              <DataTable caption="Suppliers" columns={columns} rows={shown} rowKey={(s) => s.id} rowHref={(s) => `/admin/inventory/suppliers/${s.id}`} />
            );
          }}
        </QueryView>
      </Card>
      {adding && (
      <SupplierDialog
        open={adding}
        onClose={() => setAdding(false)}
        onSaved={(s) => {
          setAdding(false);
          toast.success(`Supplier “${s.name}” saved.`);
          router.push(`/admin/inventory/suppliers/${s.id}`);
        }}
      />
      )}
    </PageBody>
  );
}
