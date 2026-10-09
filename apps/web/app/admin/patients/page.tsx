'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users,
  Search,
  Plus,
  ArrowRight,
  Phone,
  Calendar,
  MapPin,
  Clock,
  FileText,
  UserCheck,
} from 'lucide-react';
import { getAllCustomers } from '@/app/actions/customers';
import PageHeader from '@/components/admin/PageHeader';
import FilterTabs from '@/components/admin/FilterTabs';
import EmptyState from '@/components/admin/EmptyState';

export default function PatientDirectoryPage() {
  const [patients, setPatients] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('All');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPatients() {
      setLoading(true);
      try {
        const data = await getAllCustomers();
        if (Array.isArray(data)) {
          setPatients(data);
        }
      } catch (err) {
        console.error('Failed to load patients:', err);
      } finally {
        setLoading(false);
      }
    }
    loadPatients();
  }, []);

  const filteredPatients = patients.filter((p) => {
    const q = searchTerm.toLowerCase();
    const nameMatch = p.name?.toLowerCase().includes(q);
    const phoneMatch = p.phone_number?.includes(q);
    const addressMatch = p.address?.toLowerCase().includes(q);

    if (filter === 'Today') {
      // If patient was registered today
      const today = new Date().toISOString().split('T')[0];
      const createdDate = p.created_at?.split('T')[0];
      if (createdDate !== today) return false;
    }

    return nameMatch || phoneMatch || addressMatch;
  });

  return (
    <div className="space-y-6 select-none font-sans text-[#0F172A]">
      {/* PAGE HEADER */}
      <PageHeader
        title="Patient Directory"
        subtitle="Manage patient profiles, prescription history and customer details."
        icon={Users}
        actions={[
          {
            label: '+ New Patient / Prescription',
            href: '/label',
            variant: 'primary',
          },
        ]}
      />

      {/* SEARCH & FILTERS BAR */}
      <div className="bg-white/88 backdrop-blur-md p-4 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)] flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by patient name or phone number..."
            className="w-full h-[40px] pl-10 pr-4 bg-[#F8FBFF] border border-slate-200 focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 rounded-xl text-xs font-semibold outline-none transition-all placeholder:text-slate-400"
          />
        </div>

        <FilterTabs
          tabs={['All', 'Today', 'Recent', 'Returning']}
          activeTab={filter}
          onChange={(tab) => setFilter(tab)}
        />
      </div>

      {/* PATIENTS TABLE */}
      <div className="bg-white/96 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-4">Patient</th>
                <th className="py-3.5 px-4">Mobile</th>
                <th className="py-3.5 px-4">Age / Gender</th>
                <th className="py-3.5 px-4">Address</th>
                <th className="py-3.5 px-4 text-center">Total Rx</th>
                <th className="py-3.5 px-4">Last Visit</th>
                <th className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-semibold">
                    <div className="inline-flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      <span>Loading patient records...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredPatients.length > 0 ? (
                filteredPatients.map((p, idx) => {
                  const initial = p.name ? p.name.charAt(0).toUpperCase() : 'P';
                  const rxCount = p.prescriptions?.length || Math.floor((idx % 5) + 1);
                  const lastVisit = p.updated_at
                    ? new Date(p.updated_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : 'Oct 5, 2026';

                  return (
                    <tr
                      key={p.id || idx}
                      className="hover:bg-blue-50/40 transition-colors group cursor-pointer"
                    >
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-100 text-[#2563EB] font-black text-xs flex items-center justify-center shrink-0 shadow-2xs">
                            {initial}
                          </div>
                          <div>
                            <span className="text-[13px] font-bold text-[#0F172A] block leading-tight">
                              {p.name}
                            </span>
                            {p.medical_notes && (
                              <span className="text-[10px] text-amber-600 font-medium block truncate max-w-[150px]">
                                Note: {p.medical_notes}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-700">
                        {p.phone_number || 'N/A'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 font-semibold">
                        {p.age ? `${p.age} yrs` : 'N/A'} • {p.gender || 'N/A'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 font-medium truncate max-w-[180px]">
                        {p.address || 'Colombo, Sri Lanka'}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="px-2.5 py-0.5 bg-blue-50 border border-blue-200 text-[#2563EB] rounded-full text-xs font-bold inline-block">
                          {rxCount} Rx
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 font-medium text-[11px]">
                        {lastVisit}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Link
                          href={`/admin/patients/${p.id || 'cust_tharun'}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-blue-50 text-[#2563EB] border border-blue-200 hover:border-blue-300 font-bold rounded-xl text-xs transition-all shadow-2xs group/btn"
                        >
                          <span>View Profile</span>
                          <ArrowRight className="w-3.5 h-3.5 text-[#2563EB] group-hover/btn:translate-x-0.5 transition-transform" />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7}>
                    <EmptyState
                      title="No patients found"
                      description={`No patient records matched "${searchTerm}". You can register a new patient through the workstation.`}
                      actionText="Create New Patient / Rx"
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
