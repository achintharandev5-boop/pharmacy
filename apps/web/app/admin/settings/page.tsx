'use client';

import React, { useEffect, useState } from 'react';
import { Settings, Printer, MessageSquare, Users, Activity, RefreshCw, CheckCircle2, XCircle, Info } from 'lucide-react';
import { getSystemStatus, type SystemStatus } from '@/app/actions/system';
import PageHeader from '@/components/admin/PageHeader';
import { LoadingState } from '@/components/admin/DataState';

function StatusRow({ label, ok, detail }: { label: string; ok: boolean; detail?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5 border-b border-slate-100 last:border-b-0 text-xs">
      <span className="font-semibold text-slate-700">{label}</span>
      <span className={`inline-flex items-center gap-1.5 font-bold text-right ${ok ? 'text-emerald-700' : 'text-rose-700'}`}>
        {ok ? <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> : <XCircle className="w-4 h-4" aria-hidden="true" />}
        <span>
          {ok ? 'OK' : 'Not available'}
          {!ok && detail && <span className="block font-medium text-slate-500">{detail}</span>}
        </span>
      </span>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <section className="bg-white/90 backdrop-blur-md p-6 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)] space-y-4">
      <h2 className="text-base font-bold text-[#0F172A] border-b border-slate-100 pb-3 flex items-center gap-2">
        <Icon className="w-4 h-4 text-[#2563EB]" />
        <span>{title}</span>
      </h2>
      {children}
    </section>
  );
}

function Unavailable({ children }: { children: React.ReactNode }) {
  return (
    <p className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 font-medium flex items-start gap-2">
      <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

export default function SystemSettingsPage() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [checking, setChecking] = useState(true);
  const [checkError, setCheckError] = useState(false);
  const [checkCount, setCheckCount] = useState(0);

  useEffect(() => {
    let active = true;
    getSystemStatus().then(
      (res) => {
        if (!active) return;
        setStatus(res);
        setCheckError(false);
        setChecking(false);
      },
      () => {
        if (!active) return;
        setCheckError(true);
        setChecking(false);
      },
    );
    return () => {
      active = false;
    };
  }, [checkCount]);

  const recheck = () => {
    setChecking(true);
    setCheckCount((n) => n + 1);
  };

  return (
    <div className="space-y-6 select-none font-sans text-[#0F172A]">
      <PageHeader title="Settings" subtitle="System status and current configuration." icon={Settings} />

      <Section title="System Status" icon={Activity}>
        {checking && !status ? (
          <LoadingState label="Checking services…" />
        ) : checkError ? (
          <StatusRow label="Web server" ok={false} detail="The status check itself could not run." />
        ) : status ? (
          <div>
            <StatusRow label="Pharmacy API" ok={status.api.status === 'ok'} detail={status.api.detail} />
            <StatusRow label="Database" ok={status.database.status === 'ok'} detail={status.database.detail} />
            <p className="text-[11px] text-slate-500 font-medium pt-2" suppressHydrationWarning>
              Checked at {new Date(status.checkedAt).toLocaleTimeString()}. Printer and SMS delivery are not monitored.
            </p>
          </div>
        ) : null}
        <button
          type="button"
          onClick={recheck}
          disabled={checking}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 rounded-lg text-xs font-bold transition-colors disabled:opacity-60"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} aria-hidden="true" />
          Check again
        </button>
      </Section>

      <Section title="Label Printing" icon={Printer}>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <dt className="font-bold text-slate-500 uppercase text-[10px] tracking-wider">Label size</dt>
            <dd className="font-bold text-slate-900 mt-0.5">70 mm × 50 mm</dd>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <dt className="font-bold text-slate-500 uppercase text-[10px] tracking-wider">Printing</dt>
            <dd className="font-bold text-slate-900 mt-0.5">Browser print dialog from the label workstation</dd>
          </div>
        </dl>
        <Unavailable>Label size and printer are fixed in the application and cannot be changed here.</Unavailable>
      </Section>

      <Section title="SMS" icon={MessageSquare}>
        {status ? (
          <StatusRow
            label="SMS gateway token (Text.lk)"
            ok={status.smsConfigured}
            detail="TEXT_LK_API_TOKEN is not set on the web server, so SMS cannot be sent."
          />
        ) : (
          <p className="text-xs text-slate-500 font-medium">Checking configuration…</p>
        )}
        <Unavailable>
          SMS credentials are managed through server environment variables, not from this page. Configured means a token is set;
          it does not confirm that messages are delivered.
        </Unavailable>
      </Section>

      <Section title="Users & Access" icon={Users}>
        <Unavailable>
          User management is not available. The system currently has no user roles or staff accounts API; all signed-in users have
          the same access.
        </Unavailable>
      </Section>

      <Section title="Pharmacy Details" icon={Settings}>
        <Unavailable>
          Pharmacy details cannot be saved yet: the API has no settings endpoint. Nothing on this page changes system behaviour.
        </Unavailable>
      </Section>
    </div>
  );
}
