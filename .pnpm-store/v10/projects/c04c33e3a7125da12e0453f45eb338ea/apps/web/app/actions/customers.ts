'use server';

import { apiList, apiObject, apiRequest, query } from '@/lib/api/server';
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
  allergy_status?: 'UNKNOWN' | 'NONE_KNOWN' | 'HAS_ALLERGIES';
  allergies?: string;
  created_at?: string;
}

/** One page of the patient register, as returned by `GET /customers`. */
export interface PatientPage {
  items: PersonData[];
  total: number;
  page: number;
  pageSize: number;
}

/** A patient already registered with the same mobile number. */
export interface PossibleDuplicate {
  id: string;
  name: string;
  phone_number: string;
  created_at?: string;
}

/** Fields an edit may send. Empty strings clear optional fields; name and mobile cannot be cleared. */
export type PatientUpdate = Partial<Omit<PersonData, 'id' | 'created_at'>>;

export async function listPatients(params: { q?: string; page?: number; pageSize?: number }): Promise<ApiResult<PatientPage>> {
  const result = await apiObject<PatientPage>(`customers${query({ q: params.q?.trim(), page: params.page, pageSize: params.pageSize })}`);
  if (result.ok && (!Array.isArray(result.data.items) || typeof result.data.total !== 'number')) {
    return { ok: false, error: 'The pharmacy server returned an unexpected response.' };
  }
  return result;
}

export async function searchCustomersByPhone(phone: string): Promise<ApiResult<CustomerData[]>> {
  return apiList<CustomerData>(`customers/search${query({ phone })}`);
}

export async function findDuplicatePatients(phone: string, excludeId?: string): Promise<ApiResult<PossibleDuplicate[]>> {
  return apiList<PossibleDuplicate>(`customers/duplicates${query({ phone, excludeId })}`);
}

export async function createNewPerson(person: PersonData): Promise<{ success: boolean; data?: PersonData; error?: string }> {
  const result = await apiRequest<PersonData>('customers', { method: 'POST', body: person });
  return result.ok ? { success: true, data: result.data } : { success: false, error: result.error };
}

export async function updatePatient(id: string, changes: PatientUpdate): Promise<{ success: boolean; data?: PersonData; error?: string }> {
  const result = await apiRequest<PersonData>(`customers/${encodeURIComponent(id)}`, { method: 'PATCH', body: changes });
  return result.ok ? { success: true, data: result.data } : { success: false, error: result.error };
}

export async function deletePersonRecord(id: string): Promise<{ success: boolean; error?: string }> {
  const result = await apiRequest(`customers/${encodeURIComponent(id)}`, { method: 'DELETE' });
  return result.ok ? { success: true } : { success: false, error: result.error };
}
