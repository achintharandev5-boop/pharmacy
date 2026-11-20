'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { UserPlus, Users } from 'lucide-react';
import { listPatients, type PersonData } from '@/app/actions/customers';
import { Button, Card, DataTable, EmptyState, PageBody, PageHeader, Pagination, QueryView, SearchInput, useToast, type Column } from '@/components/ui';
import { PatientDialog } from '@/components/patients/PatientDialog';
import { useApiQuery } from '@/lib/useApiQuery';
import { formatDate, text } from '@/lib/format';

const PATIENT_PAGE_SIZE = 25;
const SEARCH_DELAY_MS = 300;

const columns: Column<PersonData>[] = [
  { key: 'name', header: 'Patient', cell: (p) => p.name },
  { key: 'phone', header: 'Mobile', cell: (p) => <span className="tabular">{p.phone_number}</span> },
  { key: 'age', header: 'Age / gender', hideOnMobile: true, cell: (p) => [p.age, p.gender].filter(Boolean).join(' · ') || '—' },
  { key: 'address', header: 'Address', hideOnMobile: true, cell: (p) => <span className="line-clamp-1">{text(p.address)}</span> },
  { key: 'created', header: 'Registered', hideOnMobile: true, cell: (p) => formatDate(p.created_at) },
];

function PatientsInner() {
  const params = useSearchParams();
  const [search, setSearch] = useState(params.get('search') ?? '');
  const [term, setTerm] = useState(search.trim());
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const toast = useToast();

  // Search on the server after a short pause in typing, starting again from the first page.
  useEffect(() => {
    const next = search.trim();
    if (next === term) return;
    const timer = setTimeout(() => {
      setTerm(next);
      setPage(1);
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [search, term]);

  const patients = useApiQuery(() => listPatients({ q: term, page, pageSize: PATIENT_PAGE_SIZE }), [term, page]);

  return (
    <PageBody>
      <PageHeader
        title="Patients"
        description="The patient register used by the label workstation."
        actions={
          <Button variant="primary" icon={UserPlus} onClick={() => setAdding(true)}>
            Add patient
          </Button>
        }
      />
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <SearchInput value={search} onChange={setSearch} label="Search patients" placeholder="Name or mobile number" />
          {patients.status === 'success' && (
            <p className="text-sm text-subtle tabular" aria-live="polite">
              {term ? `${patients.data.total} matching ${patients.data.total === 1 ? 'patient' : 'patients'}` : `${patients.data.total} patients`}
              {patients.isFetching && ' · updating…'}
            </p>
          )}
        </div>
        <QueryView
          query={patients}
          errorTitle="Could not load patients"
          isEmpty={(d) => d.total === 0}
          empty={
            term ? (
              <EmptyState title="No patients match your search" description="Check the spelling or search by mobile number." />
            ) : (
              <EmptyState
                icon={Users}
                title="No patients registered yet"
                description="Add a patient here or from the label workstation."
                action={
                  <Button icon={UserPlus} onClick={() => setAdding(true)}>
                    Add patient
                  </Button>
                }
              />
            )
          }
        >
          {(data) => {
            const pageCount = Math.max(1, Math.ceil(data.total / data.pageSize));
            return data.items.length === 0 ? (
              <EmptyState
                title="This page is empty"
                description="The register changed since the list was loaded."
                action={<Button onClick={() => setPage(1)}>Go to the first page</Button>}
              />
            ) : (
              <>
                <DataTable
                  caption="Patients"
                  columns={columns}
                  rows={data.items}
                  pageSize={data.pageSize}
                  rowKey={(p) => p.id ?? p.phone_number}
                  rowHref={(p) => (p.id ? `/admin/patients/${p.id}` : null)}
                />
                {data.total > data.pageSize && (
                  <Pagination page={data.page} pageCount={pageCount} total={data.total} pageSize={data.pageSize} onChange={setPage} />
                )}
              </>
            );
          }}
        </QueryView>
      </Card>
      <PatientDialog
        open={adding}
        onClose={() => setAdding(false)}
        onSaved={(p) => {
          setAdding(false);
          toast.success(`${p.name} was added to the patient register.`);
          patients.retry();
        }}
      />
    </PageBody>
  );
}

export default function PatientsPage() {
  return (
    <Suspense>
      <PatientsInner />
    </Suspense>
  );
}
