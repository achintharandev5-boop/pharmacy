'use server';
import { apiObject, apiRequest } from '@/lib/api/server';
import type { EditableSetting, PharmacySettings, SettingsPatch } from '@/lib/pharmacySettings';

export async function getPharmacySettings() {
  return apiObject<PharmacySettings>('admin/settings');
}

/** Sends only the changed fields, with the `updated_at` the editor loaded (stale saves are refused). */
export async function updatePharmacySettings(patch: SettingsPatch, expectedUpdatedAt: string) {
  return apiRequest<{ settings: PharmacySettings; changed: EditableSetting[] }>('admin/settings', {
    method: 'PATCH',
    body: { ...patch, expected_updated_at: expectedUpdatedAt },
  });
}
