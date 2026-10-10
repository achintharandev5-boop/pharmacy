'use client';

import React from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { getSystemStatus, type SystemStatus } from '@/app/actions/system';
import { getCurrentUser } from '@/app/actions/auth';
import { Alert, Badge, Button, Card, CardBody, CardHeader, DetailItem, PageBody, PageHeader, QueryView, SkeletonRows } from '@/components/ui';
import { useApiQuery } from '@/lib/useApiQuery';
import { formatDateTime } from '@/lib/format';
import type { ApiResult } from '@/lib/api/types';

const ROLE_LABEL: Record<string, string> = { admin: 'Administrator', pharmacist: 'Pharmacist', staff: 'Staff' };

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

export default function SettingsPage() {
  const status = useApiQuery<SystemStatus>(
    () => getSystemStatus().then((data): ApiResult<SystemStatus> => ({ ok: true, data })),
    [],
  );
  const me = useApiQuery(() => getCurrentUser(), []);

  return (
    <PageBody>
      <PageHeader title="Settings" description="System status and configuration." />

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
              <strong className="text-fg">Administrator</strong>: everything, including deleting patient records.
            </p>
            <p>
              <strong className="text-fg">Pharmacist</strong>: dispensing, plus receiving and adjusting stock, medicines and suppliers.
            </p>
            <p>
              <strong className="text-fg">Staff</strong>: label workstation, patients and viewing records.
            </p>
            <p className="text-xs text-subtle">
              Roles are enforced by the API. They are assigned by an administrator with the server script <code className="font-mono">scripts/set-user-role.js</code>.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Label printing" />
          <CardBody>
            <dl className="grid grid-cols-2 gap-4">
              <DetailItem label="Label size">70 × 50 mm</DetailItem>
              <DetailItem label="Printing">Browser print dialog, from the label workstation</DetailItem>
            </dl>
            <p className="mt-4 text-xs text-subtle">Label size and printer are fixed in the application and cannot be changed here.</p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Pharmacy details" />
          <CardBody className="text-sm text-muted">
            Pharmacy name, address and phone cannot be edited here yet. The database table for them is part of the pending migrations; an API
            endpoint and form will follow once those are applied.
          </CardBody>
        </Card>
      </div>
    </PageBody>
  );
}
