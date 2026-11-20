'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AlertTriangle, FileText, Pencil, Trash2 } from 'lucide-react';
import { getPatientProfileData } from '@/app/actions/admin';
import { deletePersonRecord, type PersonData } from '@/app/actions/customers';
import { PatientDialog } from '@/components/patients/PatientDialog';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
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
import { formatDate, formatDateTime, text } from '@/lib/format';
import type { ApiData } from '@/lib/api/types';

const rxColumns: Column<ApiData>[] = [
  { key: 'number', header: 'Prescription', cell: (r) => <span className="font-mono">{r.prescription_number}</span> },
  { key: 'date', header: 'Date', cell: (r) => formatDateTime(r.created_at) },
  {
    key: 'items',
    header: 'Medicines',
    hideOnMobile: true,
    cell: (r) => (
      <span className="line-clamp-2">
        {(Array.isArray(r.prescription_items) ? r.prescription_items : []).map((i: ApiData) => i.product_name_snapshot).join(', ') || '—'}
      </span>
    ),
  },
  { key: 'status', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
];

/** Allergy status exactly as recorded. A missing value is "not recorded", never "none". */
function AllergyStatus({ patient }: { patient: ApiData }) {
  if (patient.allergy_status === 'HAS_ALLERGIES') {
    return (
      <div className="flex items-start gap-2">
        <Badge tone="danger">
          <AlertTriangle size={12} aria-hidden="true" /> Allergies
        </Badge>
        <span className="text-sm text-fg">{text(patient.allergies)}</span>
      </div>
    );
  }
  if (patient.allergy_status === 'NONE_KNOWN') return <Badge tone="success">No known allergies (recorded)</Badge>;
  return <Badge tone="warning">Not recorded — ask the patient</Badge>;
}

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const profile = useApiQuery(() => getPatientProfileData(id), [id]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const name = profile.data?.patient?.name as string | undefined;
  const patient = (profile.data?.patient ?? null) as PersonData | null;

  const remove = async () => {
    setDeleting(true);
    setDeleteError(null);
    const res = await deletePersonRecord(id);
    setDeleting(false);
    setConfirmDelete(false);
    if (!res.success) {
      setDeleteError(res.error ?? 'The patient record was not deleted.');
      return;
    }
    toast.success('Patient record deleted. Their prescriptions keep the recorded name.');
    router.push('/admin/patients');
  };

  return (
    <PageBody>
      <PageHeader
        title={name ?? 'Patient'}
        breadcrumbs={[{ label: 'Patients', href: '/admin/patients' }, { label: name ?? 'Patient' }]}
        actions={
          profile.status === 'success' && (
            <>
              <Button icon={Pencil} onClick={() => setEditing(true)}>
                Edit details
              </Button>
              <Button variant="danger-soft" icon={Trash2} onClick={() => setConfirmDelete(true)}>
                Delete record
              </Button>
            </>
          )
        }
      />
      {deleteError && (
        <Alert title="Patient not deleted" onDismiss={() => setDeleteError(null)}>
          {deleteError}
        </Alert>
      )}
      <QueryView query={profile} errorTitle="Could not load this patient">
        {(data) => {
          const p = data.patient ?? {};
          const stats = data.stats ?? {};
          const prescriptions: ApiData[] = Array.isArray(data.prescriptions) ? data.prescriptions : [];
          return (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="space-y-6">
                <Card>
                  <CardHeader title="Details" />
                  <CardBody>
                    <dl className="grid grid-cols-2 gap-4">
                      <DetailItem label="Mobile">
                        <span className="tabular">{text(p.phone_number)}</span>
                      </DetailItem>
                      <DetailItem label="Age">{text(p.age)}</DetailItem>
                      <DetailItem label="Gender">{text(p.gender)}</DetailItem>
                      <DetailItem label="Registered">{formatDate(p.created_at)}</DetailItem>
                      <div className="col-span-2">
                        <DetailItem label="Address">{text(p.address)}</DetailItem>
                      </div>
                    </dl>
                  </CardBody>
                </Card>
                <Card>
                  <CardHeader title="Clinical notes" />
                  <CardBody className="space-y-4">
                    <div>
                      <p className="mb-1.5 text-xs font-medium text-subtle">Allergy status</p>
                      <AllergyStatus patient={p} />
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-medium text-subtle">Medical notes</p>
                      <p className="whitespace-pre-wrap text-sm text-fg">{p.medical_notes || 'None recorded.'}</p>
                    </div>
                  </CardBody>
                </Card>
                <Card>
                  <CardHeader title="History" />
                  <CardBody>
                    <dl className="grid grid-cols-2 gap-4">
                      <DetailItem label="Prescriptions">
                        <span className="tabular">{stats.totalPrescriptions ?? '—'}</span>
                      </DetailItem>
                      <DetailItem label="Last visit">{stats.lastVisit ? formatDate(stats.lastVisit) : 'No visits yet'}</DetailItem>
                      <div className="col-span-2">
                        <DetailItem label="Most dispensed">
                          {Array.isArray(stats.frequentlyDispensed) && stats.frequentlyDispensed.length > 0 ? stats.frequentlyDispensed.join(', ') : '—'}
                        </DetailItem>
                      </div>
                    </dl>
                  </CardBody>
                </Card>
              </div>
              <Card className="lg:col-span-2 self-start">
                <CardHeader title="Prescriptions" description="Prescriptions linked to this patient record" />
                {prescriptions.length === 0 ? (
                  <EmptyState icon={FileText} title="No prescriptions linked to this patient" description="Walk-in prescriptions are not linked to a patient record." />
                ) : (
                  <DataTable caption="Prescriptions for this patient" columns={rxColumns} rows={prescriptions} rowKey={(r) => r.id} rowHref={(r) => `/admin/prescriptions/${r.id}`} />
                )}
              </Card>
            </div>
          );
        }}
      </QueryView>
      <PatientDialog
        open={editing}
        patient={patient}
        onClose={() => setEditing(false)}
        onSaved={(p) => {
          setEditing(false);
          toast.success(`${p.name}’s details were updated.`);
          profile.retry();
        }}
      />
      <ConfirmDialog
        open={confirmDelete}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={remove}
        busy={deleting}
        tone="danger"
        title="Delete this patient record?"
        description="Only administrators can delete patient records. This cannot be undone."
        confirmLabel="Delete record"
      >
        <p className="text-sm text-muted">
          Prescriptions already dispensed are kept and keep the patient’s name as it was recorded, but are no longer linked to a patient record.
        </p>
      </ConfirmDialog>
    </PageBody>
  );
}
