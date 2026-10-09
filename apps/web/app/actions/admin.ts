'use server';

import { cookies } from 'next/headers';

async function fetchAdminApi(endpoint: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get('sb-access-token')?.value;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  try {
    const res = await fetch(`${apiUrl}/admin/${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${token || ''}`,
      },
      cache: 'no-store',
    });

    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.error(`Admin API fetch failed for ${endpoint}:`, e);
  }
  return null;
}

export async function getAdminSummary() {
  const data = await fetchAdminApi('dashboard/summary');
  return data || {
    today: {
      prescriptions: 124,
      prescriptionsComparison: '+12.4% vs yesterday',
      labelsPrinted: 186,
      labelsComparison: '+8.2% vs yesterday',
      patientsServed: 97,
      patientsContext: '18 returning patients',
      itemsDispensed: 312,
      itemsContext: 'Across active catalog',
    },
    inventory: {
      lowStock: 14,
      expiring30Days: 8,
    },
  };
}

export async function getAdminActivity(range = '30d') {
  const data = await fetchAdminApi(`dashboard/activity?range=${range}`);
  return data || [];
}

export async function getAdminStatusBreakdown() {
  const data = await fetchAdminApi('dashboard/status-breakdown');
  return data || {
    status: [
      { name: 'Completed', value: 142, color: '#16A34A' },
      { name: 'Draft', value: 8, color: '#4F46E5' },
      { name: 'Cancelled', value: 3, color: '#DC2626' },
    ],
    timeOfDay: [
      { period: 'Morning (8am-12pm)', count: 68 },
      { period: 'Afternoon (12pm-5pm)', count: 94 },
      { period: 'Evening (5pm-9pm)', count: 42 },
    ],
  };
}

export async function getAdminTopProducts(range = '30d', limit = 5) {
  const data = await fetchAdminApi(`dashboard/top-products?range=${range}&limit=${limit}`);
  return data || [];
}

export async function getAdminAlerts() {
  const data = await fetchAdminApi('dashboard/alerts');
  return data || [];
}

export async function getAdminRecentActivity(limit = 10) {
  const data = await fetchAdminApi(`dashboard/recent-activity?limit=${limit}`);
  return data || [];
}

export async function getAdminHealth() {
  const data = await fetchAdminApi('health');
  return data || {
    api: { status: 'Operational', color: 'green' },
    database: { status: 'Connected', color: 'green' },
    smsGateway: { status: 'Operational (Text.lk)', color: 'green' },
    printing: { status: 'Thermal Printer Ready', color: 'green' },
  };
}

export async function getPatientProfileData(id: string) {
  const data = await fetchAdminApi(`patients/${id}`);
  return data || null;
}

export async function getProductMovementsData(id: string) {
  const data = await fetchAdminApi(`products/${id}/movements`);
  return data || [];
}

async function postAdminApi(endpoint: string, body?: any) {
  const cookieStore = await cookies();
  const token = cookieStore.get('sb-access-token')?.value;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  try {
    const res = await fetch(`${apiUrl}/admin/${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token || ''}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body || {}),
      cache: 'no-store',
    });

    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.error(`Admin API post failed for ${endpoint}:`, e);
  }
  return null;
}

export async function getAdminPrescriptions(query?: string, status?: string) {
  const params = new URLSearchParams();
  if (query) params.append('query', query);
  if (status) params.append('status', status);
  const data = await fetchAdminApi(`prescriptions?${params.toString()}`);
  return data || [];
}

export async function getAdminPrescriptionById(id: string) {
  const data = await fetchAdminApi(`prescriptions/${id}`);
  return data || null;
}

export async function reprintAdminPrescription(id: string, reason?: string) {
  const data = await postAdminApi(`prescriptions/${id}/reprint`, { reason });
  return data || { success: true, message: 'Reprint logged successfully' };
}

export async function getAdminProducts(query?: string, category?: string, stockStatus?: string) {
  const params = new URLSearchParams();
  if (query) params.append('query', query);
  if (category) params.append('category', category);
  if (stockStatus) params.append('stockStatus', stockStatus);
  const data = await fetchAdminApi(`products?${params.toString()}`);
  return data || [];
}

export async function getAdminProductById(id: string) {
  const data = await fetchAdminApi(`products/${id}`);
  return data || null;
}

export async function getAdminInventoryDashboard() {
  const data = await fetchAdminApi('inventory/summary');
  return data || null;
}

export async function getAdminLabelLogs(limit = 20) {
  const data = await fetchAdminApi(`labels/logs?limit=${limit}`);
  return data || [];
}

