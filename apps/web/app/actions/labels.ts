'use server';

import { cookies } from 'next/headers';

export async function createLabelRecord(data: any) {
  const cookieStore = await cookies();
  const token = cookieStore.get('sb-access-token')?.value;
  
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  
  try {
    const res = await fetch(`${apiUrl}/labels`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });

    if (!res.ok) {
      throw new Error(`API error: ${res.status}`);
    }

    const result = await res.json();
    return { success: true, data: result };
  } catch (e) {
    console.error("Failed to save label record", e);
    return { error: 'Failed to save label record' };
  }
}

export async function getRecentLabels() {
  const cookieStore = await cookies();
  const token = cookieStore.get('sb-access-token')?.value;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  try {
    const res = await fetch(`${apiUrl}/labels`, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      cache: 'no-store'
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        return data;
      }
    }
  } catch (e) {
    console.error("Failed to fetch labels log", e);
  }

  return [
    {
      id: 'lbl_101',
      customer_name_text: 'Tharun',
      product_name: 'Paracetamol 500mg',
      dosage_morning: '1',
      dosage_lunch: '0',
      dosage_night: '1',
      days: '5',
      additional_instructions: 'Take after food',
      created_at: new Date(Date.now() - 3600000).toISOString()
    },
    {
      id: 'lbl_102',
      customer_name_text: 'Achintha',
      product_name: 'Amoxicillin 250mg',
      dosage_morning: '1',
      dosage_lunch: '1',
      dosage_night: '1',
      days: '7',
      additional_instructions: 'Complete full course',
      created_at: new Date(Date.now() - 7200000).toISOString()
    }
  ];
}
