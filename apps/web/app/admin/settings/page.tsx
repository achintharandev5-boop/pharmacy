'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { getSystemStatus, type SystemStatus } from '@/app/actions/system';
import { getCurrentUser } from '@/app/actions/auth';
import { getPharmacySettings, updatePharmacySettings } from '@/app/actions/settings';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  DetailItem,
  ErrorState,
  FormField,
  Input,
  PageBody,
  PageHeader,
  QueryView,
  SkeletonRows,
  useToast,
} from '@/components/ui';
import { useApiQuery } from '@/lib/useApiQuery';
import { formatDateTime } from '@/lib/format';
import { pharmacyBranding } from '@/lib/pharmacyBranding';
import { useUnsavedChangesWarning } from '@/lib/useUnsavedChangesWarning';
import {
  changedSettings,
  draftFrom,
  PRINTER_FIELDS,
  PROFILE_FIELDS,
  SETTING_MAX_LENGTH,
  validateSettings,
  type EditableSetting,
  type PharmacySettings,
  type SettingsDraft,
  type SettingsErrors,
} from '@/lib/pharmacySettings';
import { NETWORK_ERROR_MESSAGE, type ApiResult } from '@/lib/api/types';

const ROLE_LABEL: Record<string, string> = { admin: 'Administrator', pharmacist: 'Pharmacist', staff: 'Staff', cashier: 'Cashier' };

const SECTIONS = [
  { id: 'profile', label: 'Pharmacy profile' },
  { id: 'label', label: 'Label' },
  { id: 'printer', label: 'Printer' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'system', label: 'System and account' },
];

const FIELD_LABEL: Record<EditableSetting, string> = {
  pharmacy_name: 'Pharmacy name',
  address: 'Address',
  phone: 'Contact number',
  printer_name: 'Label printer name',
};

function Check({ label, ok, detail }: { label: string; ok: boolean; detail?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-3">
      <div>
        <p className="text-sm font-medium text-fg">{label}</p>
        {detail && <p className="text-xs text-subtle">{detail}</p>}
      </div>
      {ok ? (
        <Badge tone="success">
          <CheckCircle2 size={12} aria-hidden="true" /> Working
        </Badge>
      ) : (
        <Badge tone="danger">
          <XCircle size={12} aria-hidden="true" /> Not working
        </Badge>
      )}
    </div>
  );
}

function Pending() {
  return <Badge tone="warning">Pending decision</Badge>;
}

type Load = { status: 'loading' } | { status: 'error'; error: string } | { status: 'ready'; settings: PharmacySettings };

interface SectionFormProps {
  fields: readonly EditableSetting[];
  saved: PharmacySettings;
  draft: SettingsDraft;
  canEdit: boolean;
  successMessage: string;
  hints: Partial<Record<EditableSetting, string>>;
  onDraft: (field: EditableSetting, value: string) => void;
  onSaved: (settings: PharmacySettings, fields: readonly EditableSetting[]) => void;
  onReload: () => void;
}

/** One section's fields with its own Save: only that section's changed fields are sent. */
function SectionForm({ fields, saved, draft, canEdit, successMessage, hints, onDraft, onSaved, onReload }: SectionFormProps) {
  const toast = useToast();
  const [errors, setErrors] = useState<SettingsErrors>({});
  const [failure, setFailure] = useState<{ message: string; stale: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const patch = changedSettings(saved, draft, fields);
  const dirty = Object.keys(patch).length > 0;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit || saving) return;
    setFailure(null);
    const found = validateSettings(draft, fields);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    if (!dirty) {
      toast.info('There are no changes to save.');
      return;
    }
    setSaving(true);
    let result: ApiResult<{ settings: PharmacySettings; changed: EditableSetting[] }>;
    try {
      result = await updatePharmacySettings(patch, saved.updated_at);
    } catch {
      result = { ok: false, error: NETWORK_ERROR_MESSAGE };
    }
    setSaving(false);
    if (!result.ok) {
      setFailure({ message: result.error, stale: result.code === 'SETTINGS_CHANGED' });
      return;
    }
    onSaved(result.data.settings, fields);
    if (result.data.changed.length > 0) toast.success(successMessage);
    else toast.info('There were no changes to save.');
  }

  function discard() {
    for (const field of fields) onDraft(field, saved[field] ?? '');
    setErrors({});
    setFailure(null);
  }

  return (
    <form onSubmit={save} noValidate className="space-y-4">
      {fields.map((field) => (
        <FormField key={field} label={FIELD_LABEL[field]} hint={hints[field]} error={errors[field]}>
          {(props) => (
            <Input
              {...props}
              name={field}
              value={draft[field]}
              maxLength={SETTING_MAX_LENGTH[field]}
              readOnly={!canEdit}
              inputMode={field === 'phone' ? 'tel' : undefined}
              autoComplete="off"
              onChange={(e) => {
                onDraft(field, e.target.value);
                if (errors[field]) setErrors((all) => ({ ...all, [field]: undefined }));
              }}
            />
          )}
        </FormField>
      ))}
      {failure && (
        <Alert title="Not saved" onDismiss={() => setFailure(null)}>
          <p>{failure.message}</p>
          {failure.stale && (
            <Button size="sm" className="mt-2" onClick={onReload}>
              Reload settings
            </Button>
          )}
        </Alert>
      )}
      {canEdit && (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="primary" loading={saving} disabled={!dirty}>
            Save changes
          </Button>
          <Button onClick={discard} disabled={!dirty || saving}>
            Discard changes
          </Button>
          <p className="text-xs text-subtle" aria-live="polite">
            {dirty ? 'Unsaved changes' : 'All changes saved'}
          </p>
        </div>
      )}
    </form>
  );
}

export default function SettingsPage() {
  const status = useApiQuery<SystemStatus>(
    () => getSystemStatus().then((data): ApiResult<SystemStatus> => ({ ok: true, data })),
    [],
  );
  const me = useApiQuery(() => getCurrentUser(), []);
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [draft, setDraft] = useState<SettingsDraft | null>(null);

  const fetchSettings = useCallback(() => {
    getPharmacySettings().then(
      (result) => {
        if (result.ok) {
          setLoad({ status: 'ready', settings: result.data });
          setDraft(draftFrom(result.data));
        } else setLoad({ status: 'error', error: result.error });
      },
      () => setLoad({ status: 'error', error: NETWORK_ERROR_MESSAGE }),
    );
  }, []);
  useEffect(fetchSettings, [fetchSettings]);
  const reload = () => {
    setLoad({ status: 'loading' });
    fetchSettings();
  };

  const saved = load.status === 'ready' ? load.settings : null;
  const dirty = !!saved && !!draft && Object.keys(changedSettings(saved, draft, [...PROFILE_FIELDS, ...PRINTER_FIELDS])).length > 0;
  useUnsavedChangesWarning(dirty);

  const canEdit = me.status === 'success' && me.data.role === 'admin';
  const branding = pharmacyBranding();

  const onDraft = (field: EditableSetting, value: string) => setDraft((d) => (d ? { ...d, [field]: value } : d));
  // Keep unsaved edits in other sections; take the saved values for the section just saved.
  const onSaved = (settings: PharmacySettings, fields: readonly EditableSetting[]) => {
    setLoad({ status: 'ready', settings });
    setDraft((d) => {
      const next = { ...(d ?? draftFrom(settings)) };
      for (const field of fields) next[field] = settings[field] ?? '';
      return next;
    });
  };

  const settingsBody = (render: (settings: PharmacySettings, draft: SettingsDraft) => React.ReactNode) =>
    load.status === 'loading' || (load.status === 'ready' && !draft) ? (
      <SkeletonRows rows={3} label="Loading settings" />
    ) : load.status === 'error' ? (
      <ErrorState compact title="Could not load the pharmacy settings" message={load.error} onRetry={reload} />
    ) : (
      render(load.settings, draft!)
    );

  const formProps = (settings: PharmacySettings, d: SettingsDraft) => ({ saved: settings, draft: d, canEdit, onDraft, onSaved, onReload: reload });

  return (
    <PageBody>
      <PageHeader title="Settings" description="Pharmacy profile, label, printer and inventory settings, and system status." />

      <nav aria-label="Settings sections" className="-mx-4 overflow-x-auto sm:mx-0">
        <ul className="flex min-w-max gap-2 px-4 sm:flex-wrap sm:px-0">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="inline-flex h-10 items-center rounded-ui border border-border bg-page px-3 text-sm font-medium text-muted hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {me.status === 'success' && !canEdit && (
        <Alert tone="info">Only an administrator can change these settings. You can view them.</Alert>
      )}

      <Card id="profile" className="scroll-mt-20">
        <CardHeader
          title="Pharmacy profile"
          description={saved ? `Last saved ${formatDateTime(saved.updated_at)}` : 'Name, address and contact number'}
        />
        <CardBody className="space-y-4">
          {settingsBody((settings, d) => (
            <SectionForm
              {...formProps(settings, d)}
              fields={PROFILE_FIELDS}
              successMessage="Pharmacy profile saved."
              hints={{ address: 'One line.', phone: 'For example 011 234 5678.' }}
            />
          ))}
          <Alert tone="info" title="Printed labels do not use these details yet">
            Labels still print the pharmacy details configured on the server. Printing the details saved here on labels is waiting for an owner and
            pharmacist decision (Q-S1).
          </Alert>
          <p className="text-xs text-subtle">
            Email address and registration details are not stored yet: adding them needs an approved database change.
          </p>
        </CardBody>
      </Card>

      <Card id="label" className="scroll-mt-20">
        <CardHeader title="Label" description="What the printed label uses. These are fixed and cannot be changed here." actions={<Pending />} />
        <CardBody className="space-y-4">
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <DetailItem label="Label size">70 × 50 mm (fixed by the print layout)</DetailItem>
            <DetailItem label="Pharmacy details on labels">From server configuration</DetailItem>
            <DetailItem label="Name printed">{branding.name ?? 'Not configured (omitted from labels)'}</DetailItem>
            <DetailItem label="Address printed">{branding.address ?? 'Not configured (omitted from labels)'}</DetailItem>
            <DetailItem label="Phone printed">{branding.phone ?? 'Not configured (omitted from labels)'}</DetailItem>
          </dl>
          <p className="text-xs text-subtle">
            Sinhala wording, dosage calculations, label size, Print only, Print &amp; Save and reprinted labels are not affected by any setting on
            this page.
          </p>
        </CardBody>
      </Card>

      <Card id="printer" className="scroll-mt-20">
        <CardHeader title="Printer" description="What the application stores, and what is chosen in the browser's print dialog." />
        <CardBody className="space-y-5">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-fg">Stored by the application</h3>
            {settingsBody((settings, d) => (
              <SectionForm
                {...formProps(settings, d)}
                fields={PRINTER_FIELDS}
                successMessage="Printer name saved."
                hints={{ printer_name: 'A reference for staff: the printer to choose in the print dialog. The application cannot select it.' }}
              />
            ))}
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-fg">Chosen in the browser&apos;s print dialog</h3>
            <p className="text-sm text-muted">
              Browsers do not let a web application choose or configure a printer. Set these on each computer, in the print dialog opened by Print
              from the label workstation:
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
              <li>Printer: the label printer named above</li>
              <li>Paper size: 70 × 50 mm (the label requests this size)</li>
              <li>Margins: None</li>
              <li>Scale: 100% (actual size), no fit-to-page</li>
              <li>Headers and footers: off</li>
            </ul>
          </div>
        </CardBody>
      </Card>

      <Card id="inventory" className="scroll-mt-20">
        <CardHeader title="Inventory" description="Stored values. The application does not apply them yet." actions={<Pending />} />
        <CardBody className="space-y-4">
          {settingsBody((settings) => (
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <DetailItem label="Expiry alert window (stored)">{settings.expiry_alert_days} days</DetailItem>
              <DetailItem label="Expiry alert window (in use)">30 days, fixed</DetailItem>
              <DetailItem label="Low-stock alerts (stored)">{settings.low_stock_alerts_enabled ? 'On' : 'Off'}</DetailItem>
              <DetailItem label="Pharmacy timezone">{settings.timezone} (used for expiry dates; not editable)</DetailItem>
            </dl>
          ))}
          <p className="text-xs text-subtle">
            Stock deduction, batch allocation, expiry checks, dispensing mode and adjustment permissions are not configurable. Whether dashboards
            should use the stored alert values is waiting for a decision.
          </p>
        </CardBody>
      </Card>

      <div id="system" className="scroll-mt-20 space-y-6">
        <Card>
          <CardHeader
            title="System status"
            description={status.data ? `Checked ${formatDateTime(status.data.checkedAt)}` : 'Live checks, run when this page opens'}
            actions={
              <Button size="sm" onClick={status.retry} loading={status.isFetching}>
                Check again
              </Button>
            }
          />
          {status.status === 'loading' ? (
            <SkeletonRows rows={3} label="Checking services" />
          ) : status.status === 'error' ? (
            <Check label="Status check" ok={false} detail={status.error} />
          ) : (
            <div className="divide-y divide-border">
              <Check label="Pharmacy API" ok={status.data.api.status === 'ok'} detail={status.data.api.detail} />
              <Check label="Database" ok={status.data.database.status === 'ok'} detail={status.data.database.detail} />
              <Check
                label="SMS gateway configured"
                ok={status.data.smsConfigured}
                detail={status.data.smsConfigured ? 'A Text.lk token is set on this server. Delivery is not tested here.' : 'Set TEXT_LK_API_TOKEN and TEXT_LK_SENDER_ID on the web server.'}
              />
            </div>
          )}
        </Card>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="Your account" />
            <CardBody>
              <QueryView query={me} errorTitle="Could not load your account">
                {(u) => (
                  <div className="space-y-4">
                    <dl className="grid grid-cols-2 gap-4">
                      <DetailItem label="Email">{u.email ?? '—'}</DetailItem>
                      <DetailItem label="Role">{u.role ? ROLE_LABEL[u.role] : 'No role assigned'}</DetailItem>
                    </dl>
                    {!u.role && (
                      <Alert tone="warning" title="No role assigned">
                        You can use the label workstation and view records, but cannot receive or adjust stock, manage suppliers or medicines. Ask an
                        administrator to assign a role.
                      </Alert>
                    )}
                  </div>
                )}
              </QueryView>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Roles and access" />
            <CardBody className="space-y-3 text-sm text-muted">
              <p>
                <strong className="text-fg">Administrator</strong>: everything, including deleting patient records and changing pharmacy settings.
              </p>
              <p>
                <strong className="text-fg">Pharmacist</strong>: dispensing, plus receiving and adjusting stock, medicines and suppliers.
              </p>
              <p>
                <strong className="text-fg">Staff</strong>: label workstation, patients and viewing records.
              </p>
              <p>
                <strong className="text-fg">Cashier</strong>: point of sale only.
              </p>
              <p className="text-xs text-subtle">
                Roles are enforced by the API. They are assigned by an administrator with the server script <code className="font-mono">scripts/set-user-role.js</code>.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
    </PageBody>
  );
}
