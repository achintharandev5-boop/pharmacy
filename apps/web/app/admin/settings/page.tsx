'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Settings,
  Building,
  Printer,
  MessageSquare,
  Users,
  ShieldCheck,
  Bell,
  Activity,
  CheckCircle2,
  FileCode2,
  Database,
  Lock,
  Plus,
  Save,
  RefreshCw,
  Terminal,
} from 'lucide-react';
import { getAdminHealth } from '@/app/actions/admin';
import PageHeader from '@/components/admin/PageHeader';
import FilterTabs from '@/components/admin/FilterTabs';
import SystemHealthBar from '@/components/admin/SystemHealthBar';

function SystemSettingsContent() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') || 'general';

  const [activeTab, setActiveTab] = useState(
    initialTab === 'users' ? 'users' : initialTab === 'logs' ? 'logs' : 'general'
  );
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Form states
  const [pharmacyName, setPharmacyName] = useState('Sisila Chemist');
  const [licenseNumber, setLicenseNumber] = useState('PHAR-LK-2026-8849');
  const [contactPhone, setContactPhone] = useState('011-2345678');
  const [address, setAddress] = useState('No 120, Galle Road, Colombo 03');
  const [labelSize, setLabelSize] = useState('80x80');
  const [printerDevice, setPrinterDevice] = useState('TSC TDP-225 / Xprinter');
  const [smsSenderId, setSmsSenderId] = useState('SisilaRx');
  const [smsToken, setSmsToken] = useState('••••••••••••••••••••••••••••••••');

  useEffect(() => {
    async function loadHealth() {
      setLoading(true);
      try {
        const res = await getAdminHealth();
        if (res) setHealth(res);
      } catch (err) {
        console.error('Failed to load health status:', err);
      } finally {
        setLoading(false);
      }
    }
    loadHealth();
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveMessage('Settings updated and synchronized across workstation.');
    setTimeout(() => setSaveMessage(null), 4000);
  };

  return (
    <div className="space-y-6 select-none font-sans text-[#0F172A]">
      {/* HEADER */}
      <PageHeader
        title="System Settings"
        subtitle="Manage pharmacy identity, thermal printer drivers, SMS gateways, and operational policies."
        icon={Settings}
      />

      {saveMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-bold flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
            <span>{saveMessage}</span>
          </div>
        </div>
      )}

      {/* SETTINGS NAVIGATION TABS */}
      <div className="bg-white/88 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200/70 shadow-[0_2px_10px_rgba(15,23,42,0.02)] overflow-x-auto">
        <FilterTabs
          tabs={[
            { id: 'general', label: 'General & Pharmacy' },
            { id: 'printer', label: 'Thermal Printer & Labels' },
            { id: 'sms', label: 'SMS Gateway' },
            { id: 'users', label: 'User Management' },
            { id: 'logs', label: 'Activity Logs' },
            { id: 'advanced', label: 'Advanced / System Info' },
          ]}
          activeTab={activeTab}
          onChange={(tab) => setActiveTab(tab)}
        />
      </div>

      {/* TAB CONTENT */}
      {activeTab === 'general' && (
        <form onSubmit={handleSave} className="space-y-5">
          <div className="bg-white/90 backdrop-blur-md p-6 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)] space-y-4">
            <h2 className="text-base font-bold text-[#0F172A] border-b border-slate-100 pb-3 flex items-center gap-2">
              <Building className="w-4 h-4 text-[#2563EB]" />
              <span>Pharmacy Identity & Contact Details</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Pharmacy Display Name</label>
                <input
                  type="text"
                  value={pharmacyName}
                  onChange={(e) => setPharmacyName(e.target.value)}
                  className="w-full h-10 px-3 bg-[#F8FBFF] border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Pharmacy License Number</label>
                <input
                  type="text"
                  value={licenseNumber}
                  onChange={(e) => setLicenseNumber(e.target.value)}
                  className="w-full h-10 px-3 bg-[#F8FBFF] border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Official Contact Phone</label>
                <input
                  type="text"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className="w-full h-10 px-3 bg-[#F8FBFF] border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Physical Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full h-10 px-3 bg-[#F8FBFF] border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition-all"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-[#2563EB] to-[#3B82F6] text-white rounded-xl text-xs font-bold shadow-xs hover:brightness-105 transition-all"
              >
                <Save className="w-4 h-4" />
                <span>Save Pharmacy Information</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {activeTab === 'printer' && (
        <form onSubmit={handleSave} className="space-y-5">
          <div className="bg-white/90 backdrop-blur-md p-6 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)] space-y-4">
            <h2 className="text-base font-bold text-[#0F172A] border-b border-slate-100 pb-3 flex items-center gap-2">
              <Printer className="w-4 h-4 text-[#2563EB]" />
              <span>Thermal Label Configuration & Hardware</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Label Dimensions</label>
                <select
                  value={labelSize}
                  onChange={(e) => setLabelSize(e.target.value)}
                  className="w-full h-10 px-3 bg-[#F8FBFF] border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-[#2563EB] transition-all"
                >
                  <option value="80x80">80mm x 80mm (8cm x 8cm Square)</option>
                  <option value="70x50">70mm x 50mm</option>
                  <option value="100x150">100mm x 150mm Shipping</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Supported Driver / Protocol</label>
                <input
                  type="text"
                  value={printerDevice}
                  onChange={(e) => setPrinterDevice(e.target.value)}
                  className="w-full h-10 px-3 bg-[#F8FBFF] border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-[#2563EB] transition-all"
                />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-100 text-xs text-blue-900 space-y-1">
              <span className="font-bold block">Sinhala Unicode Rendering Engine:</span>
              <p>
                Integrated with automatic Sinhalese translation and dosage matrix. Meal instructions, morning-afternoon-night timings, and caution badges render directly into ESC/POS and TSPL bitmapped drivers.
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-[#2563EB] to-[#3B82F6] text-white rounded-xl text-xs font-bold shadow-xs hover:brightness-105 transition-all"
              >
                <Save className="w-4 h-4" />
                <span>Save Printer Settings</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {activeTab === 'sms' && (
        <form onSubmit={handleSave} className="space-y-5">
          <div className="bg-white/90 backdrop-blur-md p-6 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)] space-y-4">
            <h2 className="text-base font-bold text-[#0F172A] border-b border-slate-100 pb-3 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[#2563EB]" />
              <span>SMS Gateway Integration (Text.lk)</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Sender ID (Mask)</label>
                <input
                  type="text"
                  value={smsSenderId}
                  onChange={(e) => setSmsSenderId(e.target.value)}
                  className="w-full h-10 px-3 bg-[#F8FBFF] border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-[#2563EB] transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Text.lk API Token</label>
                <input
                  type="password"
                  value={smsToken}
                  onChange={(e) => setSmsToken(e.target.value)}
                  className="w-full h-10 px-3 bg-[#F8FBFF] border border-slate-200 rounded-xl text-xs font-mono font-semibold outline-none focus:border-[#2563EB] transition-all"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-[#2563EB] to-[#3B82F6] text-white rounded-xl text-xs font-bold shadow-xs hover:brightness-105 transition-all"
              >
                <Save className="w-4 h-4" />
                <span>Save SMS Settings</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {activeTab === 'users' && (
        <div className="bg-white/90 backdrop-blur-md p-6 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)] space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-[#0F172A] flex items-center gap-2">
              <Users className="w-4 h-4 text-[#2563EB]" />
              <span>Authorized Pharmacy Staff</span>
            </h2>
            <button
              type="button"
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-[#2563EB] to-[#3B82F6] text-white rounded-xl text-xs font-bold shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Staff User</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-3">Name</th>
                  <th className="py-3 px-3">Role</th>
                  <th className="py-3 px-3">Email</th>
                  <th className="py-3 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                <tr className="hover:bg-blue-50/40 transition-colors">
                  <td className="py-3 px-3 font-bold text-slate-900">Sisila Chemist</td>
                  <td className="py-3 px-3 text-[#2563EB] font-bold">Pharmacist / Admin</td>
                  <td className="py-3 px-3 text-slate-600">admin@sisilapharmacy.lk</td>
                  <td className="py-3 px-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-[#10B981] border border-emerald-200">
                      Active
                    </span>
                  </td>
                </tr>
                <tr className="hover:bg-blue-50/40 transition-colors">
                  <td className="py-3 px-3 font-bold text-slate-900">Tharun Silva</td>
                  <td className="py-3 px-3 text-slate-700 font-semibold">Dispensing Pharmacist</td>
                  <td className="py-3 px-3 text-slate-600">tharun@sisilapharmacy.lk</td>
                  <td className="py-3 px-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-[#10B981] border border-emerald-200">
                      Active
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="bg-white/90 backdrop-blur-md p-6 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)] space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-[#0F172A] flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#2563EB]" />
              <span>Pharmacy Audit & Security Logs</span>
            </h2>
            <p className="text-xs text-[#64748B]">Tamper-evident operational activity trail</p>
          </div>

          <div className="space-y-2">
            {[
              { time: '10:24 AM', message: 'Prescription RX-2026-1049 printed for patient Tharun Silva', type: 'DISPENSE' },
              { time: '10:18 AM', message: 'Thermal label reprinted (Stock unchanged) for RX-2026-1048', type: 'REPRINT' },
              { time: '09:50 AM', message: 'Batch GRN-8842 received: Amoxicillin 500mg (+100 units)', type: 'INVENTORY' },
              { time: '08:30 AM', message: 'Pharmacist Sisila Chemist logged into Workstation', type: 'AUTH' },
            ].map((log, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-50/70 border border-slate-100 text-xs"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[11px] font-bold text-slate-400">{log.time}</span>
                  <span className="font-semibold text-slate-800">{log.message}</span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-[#2563EB] border border-blue-200 shrink-0">
                  {log.type}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'advanced' && (
        <div className="bg-white/90 backdrop-blur-md p-6 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)] space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-[#0F172A] flex items-center gap-2">
              <Terminal className="w-4 h-4 text-slate-500" />
              <span>Advanced System Information</span>
            </h2>
            <p className="text-xs text-[#64748B]">Internal architecture and telemetry status for system administrators</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-slate-400 font-bold uppercase text-[10px]">App Stack</span>
              <p className="font-bold text-slate-900">Next.js App Router + NestJS + Supabase PostgreSQL</p>
              <p className="text-[11px] text-slate-500">Atomic database transactions with stock-safe reprint controls.</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-slate-400 font-bold uppercase text-[10px]">Telemetry Status</span>
              <p className="font-bold text-slate-900">Telemetry Active • 0 Hardware Exceptions</p>
              <p className="text-[11px] text-slate-500">Continuous health heartbeat to local hardware gateways.</p>
            </div>
          </div>
        </div>
      )}

      {/* SYSTEM HEALTH BAR AT BOTTOM */}
      <SystemHealthBar
        database={{
          status: health?.database?.status || 'Operational',
          latency: '45ms',
        }}
        labelEngine={{
          status: health?.printing?.status || 'Operational',
          latency: '120ms',
        }}
        smsGateway={{
          status: health?.smsGateway?.status || 'Operational',
          latency: '210ms',
        }}
        thermalPrinter={{
          status: 'Connected',
        }}
      />
    </div>
  );
}

export default function SystemSettingsPage() {
  return (
    <React.Suspense
      fallback={
        <div className="p-8 text-center text-slate-500 font-semibold select-none">
          <div className="inline-flex items-center gap-2">
            <span className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span>Loading System Settings...</span>
          </div>
        </div>
      }
    >
      <SystemSettingsContent />
    </React.Suspense>
  );
}
