'use client';

import React from 'react';
import { Activity, Database, FileCode2, MessageSquare, Printer } from 'lucide-react';

interface HealthStatus {
  status: string;
  latency?: string;
  connected?: boolean;
}

interface SystemHealthBarProps {
  database?: HealthStatus;
  labelEngine?: HealthStatus;
  smsGateway?: HealthStatus;
  thermalPrinter?: HealthStatus;
}

export default function SystemHealthBar({
  database = { status: 'Operational', latency: '45ms' },
  labelEngine = { status: 'Operational', latency: '120ms' },
  smsGateway = { status: 'Operational', latency: '210ms' },
  thermalPrinter = { status: 'Connected' },
}: SystemHealthBarProps) {
  const items = [
    {
      title: 'Database',
      icon: Database,
      status: database.status || 'Operational',
      latency: database.latency,
    },
    {
      title: 'Label Engine',
      icon: FileCode2,
      status: labelEngine.status || 'Operational',
      latency: labelEngine.latency,
    },
    {
      title: 'SMS Gateway',
      icon: MessageSquare,
      status: smsGateway.status || 'Operational',
      latency: smsGateway.latency,
    },
    {
      title: 'Thermal Printer',
      icon: Printer,
      status: thermalPrinter.status || 'Connected',
      latency: thermalPrinter.latency,
    },
  ];

  return (
    <div className="bg-white/88 backdrop-blur-md p-4 sm:p-5 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)] flex flex-col md:flex-row md:items-center justify-between gap-4 select-none">
      {/* Title */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#2563EB] flex items-center justify-center border border-blue-100">
          <Activity className="w-4 h-4" strokeWidth={2.2} />
        </div>
        <span className="text-sm font-bold text-[#0F172A] tracking-tight">System Health</span>
      </div>

      {/* Grid of 4 Health Statuses */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 flex-1 max-w-4xl">
        {items.map((item, i) => {
          const Icon = item.icon;
          const isOk = !item.status.toLowerCase().includes('fail') && !item.status.toLowerCase().includes('error');

          return (
            <div
              key={i}
              className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50/70 border border-slate-100"
            >
              <div className="w-7 h-7 rounded-lg bg-white border border-slate-200/70 text-slate-600 flex items-center justify-center shrink-0">
                <Icon className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[11px] font-medium text-slate-500 truncate leading-tight">
                    {item.title}
                  </span>
                  {item.latency && (
                    <span className="text-[10px] font-mono text-slate-400 shrink-0">
                      {item.latency}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      isOk ? 'bg-[#10B981]' : 'bg-[#EF4444]'
                    }`}
                  />
                  <span className="text-xs font-bold text-[#0F172A] truncate">
                    {item.status}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
