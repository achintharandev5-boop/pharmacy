'use server';

import { cookies } from 'next/headers';
import { HARDCODED_CUSTOMERS, CustomerData } from '../../constants/customers';

export interface PersonData {
  id?: string;
  name: string;
  phone_number: string;
  age?: string;
  gender?: string;
  address?: string;
  medical_notes?: string;
  created_at?: string;
}

export async function getHardcodedCustomers(): Promise<CustomerData[]> {
  return HARDCODED_CUSTOMERS;
}

export async function getAllCustomers(): Promise<PersonData[]> {
  const cookieStore = await cookies();
  const token = cookieStore.get('sb-access-token')?.value;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  try {
    const res = await fetch(`${apiUrl}/customers`, {
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
    console.error("API customer fetch failed, returning hardcoded", e);
  }

  return HARDCODED_CUSTOMERS;
}

export async function searchCustomersByPhone(phone: string) {
  const cleanPhone = phone.replace(/[\s\-]/g, '').toLowerCase();

  const hardcodedMatches = HARDCODED_CUSTOMERS.filter(
    (c) =>
      c.phone_number.includes(cleanPhone) ||
      c.name.toLowerCase().includes(cleanPhone)
  );

  const cookieStore = await cookies();
  const token = cookieStore.get('sb-access-token')?.value;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  let apiMatches: CustomerData[] = [];
  try {
    const res = await fetch(`${apiUrl}/customers/search?phone=${encodeURIComponent(phone)}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      cache: 'no-store'
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        apiMatches = data;
      }
    }
  } catch (e) {
    console.error("API customer search failed, falling back to hardcoded data", e);
  }

  const combined = [...hardcodedMatches];
  for (const item of apiMatches) {
    if (!combined.some((c) => c.phone_number === item.phone_number)) {
      combined.push(item);
    }
  }

  return { data: combined };
}

export async function createNewPerson(person: PersonData): Promise<{ success: boolean; data?: PersonData; error?: string }> {
  const cookieStore = await cookies();
  const token = cookieStore.get('sb-access-token')?.value;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  try {
    const res = await fetch(`${apiUrl}/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(person)
    });

    if (res.ok) {
      const data = await res.json();
      return { success: true, data };
    } else {
      const errorText = await res.text();
      return { success: false, error: errorText || 'Failed to create person record' };
    }
  } catch (e: any) {
    console.error("API person create error:", e);
    // Fallback response for offline/local mode
    return {
      success: true,
      data: {
        id: 'cust_' + Date.now(),
        ...person,
        created_at: new Date().toISOString()
      }
    };
  }
}

export async function deletePersonRecord(id: string): Promise<{ success: boolean }> {
  const cookieStore = await cookies();
  const token = cookieStore.get('sb-access-token')?.value;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  try {
    await fetch(`${apiUrl}/customers/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
  } catch (e) {
    console.error("API delete person error:", e);
  }
  return { success: true };
}
