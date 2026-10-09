'use server';

import { apiList, apiRequest, query } from '@/lib/api/server';
import type { ApiResult } from '@/lib/api/types';
import type { CustomerData } from '../../constants/customers';

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

export async function getAllCustomers(): Promise<ApiResult<PersonData[]>> {
  return apiList<PersonData>('customers');
}

export async function searchCustomersByPhone(phone: string): Promise<ApiResult<CustomerData[]>> {
  return apiList<CustomerData>(`customers/search${query({ phone })}`);
}

export async function createNewPerson(person: PersonData): Promise<{ success: boolean; data?: PersonData; error?: string }> {
  const result = await apiRequest<PersonData>('customers', { method: 'POST', body: person });
  return result.ok ? { success: true, data: result.data } : { success: false, error: result.error };
}

export async function deletePersonRecord(id: string): Promise<{ success: boolean; error?: string }> {
  const result = await apiRequest(`customers/${encodeURIComponent(id)}`, { method: 'DELETE' });
  return result.ok ? { success: true } : { success: false, error: result.error };
}
