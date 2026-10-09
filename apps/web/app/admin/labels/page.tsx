'use client';

import React from 'react';
import { Printer, Clock } from 'lucide-react';
import { getAdminLabelLogs } from '@/app/actions/admin';
import PageHeader from '@/components/admin/PageHeader';
import StatusBadge from '@/components/admin/StatusBadge';
import EmptyState from '@/components/admin/EmptyState';
import { ErrorState, LoadingState, MISSING } from '@/components/admin/DataState';
import { useApiQuery } from '@/lib/useApiQuery';
import { REPRINT_UNAVAILABLE_REASON } from '@/lib/reprint';

const LOG_LIMIT = 30;

export default function LabelHistoryPage() {
  const logsQuery = useApiQuery(() => getAdminLabelLogs(LOG_LIMIT), []);
  const logs = logsQuery.data ?? [];

  // Counts describe only the events loaded below, not a full day's activity.
  const printedCount = logs.filter((l) => l.action_type === 'PRINTED').length;
  const reprintedCount = logs.filter((l) => l.action_type === 'REPRINTED').length;
  const failedCount = logs.filter((l) => l.action_type === 'FAILED').length;
  const showCounts = logsQuery.status === 'success';

  const summary = [
    { label: 'Printed', value: printedCount, tone: 'text-[#0F172A]' },
    { label: 'Reprinted', value: reprintedCount, tone: 'text-amber-600' },
    { label: 'Failed', value: failedCount, tone: 'text-slate-900' },
  ];

  return (
    <div className="space-y-6 select-none font-sans text-[#0F172A]">
      {/* HEADER */}
      <PageHeader
        title="Label History"
        subtitle="Label print and reprint events recorded by the system."
        icon={Printer}
        actions={[
          {
            label: 'Open Label Workstation',
            href: '/label',
            variant: 'primary',
          },
        ]}
      />

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {summary.map((card) => (
          <div
            key={card.label}
            className="bg-white/90 backdrop-blur-md p-4 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.02)]"
          >
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">{card.label}</span>
            <span className={`text-2xl font-extrabold mt-1 block ${card.tone}`}>{showCounts ? card.value : MISSING}</span>
            <span className="text-[11px] font-semibold text-slate-500 mt-1 block">In the latest {LOG_LIMIT} events</span>
          </div>
        ))}
      </div>

      {/* PRINT HISTORY TABLE */}
      <div className="bg-white/96 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)] overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#2563EB]" />
            <h2 className="text-sm font-bold text-[#0F172A]">Print History</h2>
          </div>
          <span className="text-xs font-semibold text-[#64748B]">Latest {LOG_LIMIT} print events</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">RX Number</th>
                <th className="py-3.5 px-4">Patient</th>
                <th className="py-3.5 px-4">Product</th>
                <th className="py-3.5 px-4 text-center">Print Count</th>
                <th className="py-3.5 px-4">Reason</th>
                <th className="py-3.5 px-4">Time</th>
                <th className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {logsQuery.status === 'loading' ? (
                <tr>
                  <td colSpan={8}>
                    <LoadingState label="Loading print history…" />
                  </td>
                </tr>
              ) : logsQuery.status === 'error' ? (
                <tr>
                  <td colSpan={8}>
                    <ErrorState title="Could not load print history" message={logsQuery.error} onRetry={logsQuery.retry} />
                  </td>
                </tr>
              ) : logs.length > 0 ? (
                logs.map((log, i) => {
                  const rxNum = log.prescription?.prescription_number || log.prescription_number;
                  const patientName = log.prescription?.customer_name_text || log.customer_name;
                  const product = log.product_name || log.prescription?.prescription_items?.[0]?.product_name;
                  const count = log.prescription?.print_count ?? log.print_count;

                  return (
                    <tr key={log.id || i} className="hover:bg-blue-50/40 transition-colors">
                      <td className="py-3.5 px-4">{log.action_type ? <StatusBadge status={log.action_type} /> : MISSING}</td>
                      <td className="py-3.5 px-4 font-mono font-bold text-[#2563EB]">{rxNum || MISSING}</td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">{patientName || MISSING}</td>
                      <td className="py-3.5 px-4 text-slate-700 max-w-[200px] truncate" title={product}>
                        {product || MISSING}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-center text-slate-800">{count ?? MISSING}</td>
                      <td className="py-3.5 px-4 text-slate-500 max-w-[180px] truncate" title={log.reason}>
                        {log.reason || MISSING}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-500 text-[11px]">
                        {log.created_at ? new Date(log.created_at).toLocaleString() : MISSING}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          disabled
                          title={REPRINT_UNAVAILABLE_REASON}
                          aria-label={`Reprint (${REPRINT_UNAVAILABLE_REASON})`}
                          className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-400 border border-slate-200 font-bold rounded-xl text-xs cursor-not-allowed"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Reprint</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8}>
                    <EmptyState
                      title="No print records found"
                      description="No label print events have been recorded yet. Labels printed from the workstation will appear here."
                      actionText="Open Label Workstation"
                      actionHref="/label"
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
