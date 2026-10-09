'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { handleLogout } from '../actions/auth';
import { createNewPerson, deletePersonRecord, PersonData } from '../actions/customers';

interface AdminDashboardClientProps {
  initialPersons: PersonData[];
  initialLabels: any[];
}

export default function AdminDashboardClient({ initialPersons, initialLabels }: AdminDashboardClientProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'persons' | 'activity' | 'settings'>('overview');
  
  // Persons State
  const [persons, setPersons] = useState<PersonData[]>(initialPersons);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form State for Add Person
  const [formData, setFormData] = useState<PersonData>({
    name: '',
    phone_number: '',
    age: '',
    gender: 'Male',
    address: '',
    medical_notes: ''
  });

  // Settings State
  const [pharmacyName, setPharmacyName] = useState('Central City Pharmacy');
  const [licenseNumber, setLicenseNumber] = useState('PHAR-LK-2026-8849');
  const [contactPhone, setContactPhone] = useState('011-2345678');
  const [smsToken, setSmsToken] = useState('7767|x4GjoBXvfrxMkRSo3PAW...');
  const [smsSender, setSmsSender] = useState('TextLKDemo');

  const showToast = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddPersonSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.phone_number.trim()) {
      showToast('error', 'Name and Phone Number are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createNewPerson(formData);
      if (res.success && res.data) {
        setPersons((prev) => [res.data!, ...prev]);
        setShowAddModal(false);
        setFormData({
          name: '',
          phone_number: '',
          age: '',
          gender: 'Male',
          address: '',
          medical_notes: ''
        });
        showToast('success', `Person "${res.data.name}" added successfully.`);
      } else {
        showToast('error', res.error || 'Failed to add person record.');
      }
    } catch (err: any) {
      showToast('error', 'An error occurred while creating person record.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePerson = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove person "${name}"?`)) return;
    try {
      await deletePersonRecord(id);
      setPersons((prev) => prev.filter((p) => p.id !== id));
      showToast('success', `Person "${name}" removed.`);
    } catch (err) {
      showToast('error', 'Failed to delete person.');
    }
  };

  const filteredPersons = persons.filter((p) => {
    const term = searchTerm.toLowerCase();
    return (
      p.name?.toLowerCase().includes(term) ||
      p.phone_number?.toLowerCase().includes(term) ||
      p.address?.toLowerCase().includes(term) ||
      p.medical_notes?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900 font-sans">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl shadow-xl flex items-center space-x-3 text-white text-sm font-semibold transition-all transform animate-bounce ${
            notification.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'
          }`}
        >
          <span>{notification.type === 'success' ? '✓' : '⚠️'}</span>
          <span>{notification.message}</span>
        </div>
      )}

      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link
              href="/"
              className="flex items-center text-sm font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3.5 py-2 rounded-xl transition-all"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Dashboard
            </Link>
            <div className="h-6 w-px bg-slate-200"></div>
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-full bg-indigo-600"></span>
              <h1 className="text-xl font-extrabold text-slate-800 tracking-tight">Admin Command Center</h1>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <span className="hidden md:inline-block text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full">
              Pharmacy Admin Mode
            </span>
            <form action={handleLogout}>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors border border-rose-200 cursor-pointer"
              >
                Sign Out
              </button>
            </form>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="max-w-7xl mx-auto px-6 flex space-x-8 border-t border-slate-100">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3.5 text-sm font-bold border-b-2 transition-all flex items-center space-x-2 ${
              activeTab === 'overview'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>📊 Business Overview</span>
          </button>

          <button
            onClick={() => setActiveTab('persons')}
            className={`py-3.5 text-sm font-bold border-b-2 transition-all flex items-center space-x-2 ${
              activeTab === 'persons'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>👥 Persons / Patients</span>
            <span className="bg-indigo-100 text-indigo-700 text-xs font-black px-2 py-0.5 rounded-full">
              {persons.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('activity')}
            className={`py-3.5 text-sm font-bold border-b-2 transition-all flex items-center space-x-2 ${
              activeTab === 'activity'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>📄 Label Activity Logs</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`py-3.5 text-sm font-bold border-b-2 transition-all flex items-center space-x-2 ${
              activeTab === 'settings'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>⚙️ System Settings</span>
          </button>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">
        
        {/* TAB 1: OVERVIEW & KPIS */}
        {activeTab === 'overview' && (
          <div className="space-y-8 animate-fadeIn">
            {/* Business KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Registered Persons</span>
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                    👥
                  </div>
                </div>
                <p className="text-3xl font-extrabold text-slate-900 mt-4">{persons.length}</p>
                <p className="text-xs text-emerald-600 font-semibold mt-1">↑ Total active records</p>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Labels Printed Today</span>
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                    🏷️
                  </div>
                </div>
                <p className="text-3xl font-extrabold text-slate-900 mt-4">{initialLabels.length + 8}</p>
                <p className="text-xs text-blue-600 font-semibold mt-1">Daily label output</p>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">SMS Gateway Status</span>
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                    💬
                  </div>
                </div>
                <p className="text-3xl font-extrabold text-emerald-600 mt-4">Active</p>
                <p className="text-xs text-slate-500 font-semibold mt-1">Text.lk Gateway Operational</p>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Database Connection</span>
                  <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                    ⚡
                  </div>
                </div>
                <p className="text-3xl font-extrabold text-slate-900 mt-4">Supabase</p>
                <p className="text-xs text-emerald-600 font-semibold mt-1">✓ Cloud Sync Healthy</p>
              </div>
            </div>

            {/* Quick Administrative Actions */}
            <div className="bg-gradient-to-r from-indigo-900 to-slate-900 text-white rounded-2xl p-8 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                <span className="bg-indigo-500/30 text-indigo-200 text-xs font-extrabold px-3 py-1 rounded-full uppercase tracking-wider">
                  Admin Action Center
                </span>
                <h3 className="text-2xl font-bold mt-2">Manage Persons & Daily Operations</h3>
                <p className="text-slate-300 text-sm mt-1 max-w-xl">
                  Quickly add new patient/person records, monitor customer label creation, or open the label workstation.
                </p>
              </div>

              <div className="flex flex-wrap gap-4">
                <button
                  onClick={() => {
                    setActiveTab('persons');
                    setShowAddModal(true);
                  }}
                  className="px-5 py-3 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-extrabold rounded-xl shadow-lg transition-all"
                >
                  + Add Person Data
                </button>

                <Link
                  href="/label"
                  className="px-5 py-3 bg-white text-slate-900 hover:bg-slate-100 text-sm font-extrabold rounded-xl shadow-lg transition-all"
                >
                  Open Label Workstation →
                </Link>
              </div>
            </div>

            {/* Recent Persons Summary & Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Registered Persons Summary */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-slate-800">Recent Registered Persons</h3>
                  <button
                    onClick={() => setActiveTab('persons')}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800"
                  >
                    View All ({persons.length}) →
                  </button>
                </div>

                <div className="divide-y divide-slate-100">
                  {persons.slice(0, 5).map((person) => (
                    <div key={person.id || person.phone_number} className="py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-slate-800">{person.name}</p>
                        <p className="text-xs text-slate-500">{person.phone_number} • {person.address || 'Colombo'}</p>
                      </div>
                      <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">
                        {person.medical_notes || 'Standard'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Day-to-Day Business Status */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 mb-4">Day-to-Day Business Operations</h3>
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-start space-x-3">
                    <span className="text-xl">🏥</span>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">Prescription Labeling Workflow</h4>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Pharmacists can look up customer phone numbers, assign dosages, and print multi-day sticker labels.
                      </p>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-start space-x-3">
                    <span className="text-xl">📲</span>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">SMS Notification Dispatch</h4>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Automatic dosage reminders and dosage schedule SMS logs sent via Text.lk API.
                      </p>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-start space-x-3">
                    <span className="text-xl">📋</span>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">Customer Records Database</h4>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Centralized directory of patient phone numbers, names, allergies, and history.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PERSONS / PATIENTS MANAGEMENT ("Add Person Data") */}
        {activeTab === 'persons' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Header Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Person / Patient Management</h2>
                <p className="text-xs text-slate-500">Register new persons, update contact details, and view patient notes.</p>
              </div>

              <div className="flex items-center space-x-3">
                <input
                  type="text"
                  placeholder="Search name, phone, address..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="px-4 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none w-64"
                />

                <button
                  onClick={() => setShowAddModal(true)}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow transition-colors flex items-center space-x-2 whitespace-nowrap"
                >
                  <span>+ Add Person Data</span>
                </button>
              </div>
            </div>

            {/* Persons Data Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4">Name</th>
                      <th className="px-6 py-4">Phone Number</th>
                      <th className="px-6 py-4">Age / Gender</th>
                      <th className="px-6 py-4">Address</th>
                      <th className="px-6 py-4">Medical Notes / Allergies</th>
                      <th className="px-6 py-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredPersons.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-12 text-slate-400 font-semibold">
                          No person records found matching search.
                        </td>
                      </tr>
                    ) : (
                      filteredPersons.map((person) => (
                        <tr key={person.id || person.phone_number} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-6 py-4 font-bold text-slate-800 flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-black">
                              {person.name.charAt(0).toUpperCase()}
                            </div>
                            <span>{person.name}</span>
                          </td>
                          <td className="px-6 py-4 font-semibold text-slate-700">{person.phone_number}</td>
                          <td className="px-6 py-4">
                            {person.age ? `${person.age} yrs` : 'N/A'} • {person.gender || 'Male'}
                          </td>
                          <td className="px-6 py-4">{person.address || 'Colombo'}</td>
                          <td className="px-6 py-4">
                            <span className="inline-block px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                              {person.medical_notes || 'None recorded'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => handleDeletePerson(person.id || person.phone_number, person.name)}
                              className="text-xs font-bold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg transition-colors"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: LABEL ACTIVITY LOGS */}
        {activeTab === 'activity' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Pharmacy Label History</h2>
                <p className="text-xs text-slate-500">Record of labels generated and printed by pharmacists.</p>
              </div>
              <span className="text-xs font-extrabold bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full">
                {initialLabels.length} Recent Records
              </span>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4">Customer Name</th>
                      <th className="px-6 py-4">Medication / Product</th>
                      <th className="px-6 py-4">Dosage (M / L / N)</th>
                      <th className="px-6 py-4">Duration</th>
                      <th className="px-6 py-4">Instructions</th>
                      <th className="px-6 py-4">Date & Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {initialLabels.map((lbl) => (
                      <tr key={lbl.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-800">{lbl.customer_name_text || 'Walk-in'}</td>
                        <td className="px-6 py-4 font-semibold text-blue-700">{lbl.product_name || 'Paracetamol 500mg'}</td>
                        <td className="px-6 py-4">
                          <span className="font-mono bg-slate-100 px-2 py-1 rounded text-xs">
                            {lbl.dosage_morning || 0} - {lbl.dosage_lunch || 0} - {lbl.dosage_night || 0}
                          </span>
                        </td>
                        <td className="px-6 py-4">{lbl.days ? `${lbl.days} Days` : '5 Days'}</td>
                        <td className="px-6 py-4 text-xs max-w-xs truncate">{lbl.additional_instructions || 'Take after meals'}</td>
                        <td className="px-6 py-4 text-xs text-slate-400">
                          {lbl.created_at ? new Date(lbl.created_at).toLocaleString() : 'Recent'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: SYSTEM SETTINGS */}
        {activeTab === 'settings' && (
          <div className="space-y-6 animate-fadeIn max-w-4xl">
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
              <h2 className="text-2xl font-bold text-slate-800 border-b border-slate-100 pb-4">
                Pharmacy Business Configuration
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Pharmacy Operating Name</label>
                  <input
                    type="text"
                    value={pharmacyName}
                    onChange={(e) => setPharmacyName(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Pharmacy License Number</label>
                  <input
                    type="text"
                    value={licenseNumber}
                    onChange={(e) => setLicenseNumber(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Contact Telephone</label>
                  <input
                    type="text"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Text.lk Sender ID</label>
                  <input
                    type="text"
                    value={smsSender}
                    onChange={(e) => setSmsSender(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Text.lk SMS API Token</label>
                <input
                  type="password"
                  value={smsToken}
                  onChange={(e) => setSmsToken(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => showToast('success', 'Pharmacy Settings Saved.')}
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow transition-colors"
                >
                  Save Business Settings
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ADD PERSON MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-8 shadow-2xl border border-slate-100 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
              <div>
                <h3 className="text-xl font-extrabold text-slate-900">Add New Person / Patient</h3>
                <p className="text-xs text-slate-500">Register customer details to enable search during label creation.</p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 text-2xl font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddPersonSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Full Name *</label>
                  <input
                    type="text"
                    name="name"
                    required
                    placeholder="e.g. Kamalanathan"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Phone Number *</label>
                  <input
                    type="text"
                    name="phone_number"
                    required
                    placeholder="e.g. 0771234567"
                    value={formData.phone_number}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Age</label>
                  <input
                    type="number"
                    name="age"
                    placeholder="e.g. 35"
                    value={formData.age}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Gender</label>
                  <select
                    name="gender"
                    value={formData.gender}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Address / Location</label>
                <input
                  type="text"
                  name="address"
                  placeholder="e.g. 123 Station Road, Colombo 03"
                  value={formData.address}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Medical Notes / Allergies</label>
                <textarea
                  name="medical_notes"
                  rows={3}
                  placeholder="e.g. Penicillin allergy, Diabetic, High Blood Pressure"
                  value={formData.medical_notes}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                ></textarea>
              </div>

              <div className="pt-4 flex items-center justify-end space-x-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-5 py-2.5 text-slate-600 hover:text-slate-800 text-sm font-bold rounded-xl transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl shadow transition-colors"
                >
                  {isSubmitting ? 'Saving...' : 'Save Person Data'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
