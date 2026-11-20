/**
 * Pharmacy settings as returned by `GET /admin/settings` (the single `pharmacy_settings` row).
 *
 * Only the four EDITABLE fields can be changed from the settings page. The rest are shown read-only:
 * timezone drives the database's expiry checks, label size is fixed by the print layout, and the
 * inventory alert settings are not read by the application yet (pending decision).
 *
 * Printed labels do not use these values: the label footer still comes from the
 * NEXT_PUBLIC_PHARMACY_* environment variables (see lib/pharmacyBranding.ts) until decision Q-S1.
 */
export interface PharmacySettings {
  pharmacy_name: string | null;
  address: string | null;
  phone: string | null;
  printer_name: string | null;
  timezone: string;
  label_width_mm: number | null;
  label_height_mm: number | null;
  low_stock_alerts_enabled: boolean;
  expiry_alert_days: number;
  updated_at: string;
  updated_by: string | null;
}

export type EditableSetting = 'pharmacy_name' | 'address' | 'phone' | 'printer_name';
export type SettingsDraft = Record<EditableSetting, string>;
export type SettingsPatch = Partial<Record<EditableSetting, string>>;
export type SettingsErrors = Partial<Record<EditableSetting, string>>;

export const PROFILE_FIELDS: readonly EditableSetting[] = ['pharmacy_name', 'address', 'phone'];
export const PRINTER_FIELDS: readonly EditableSetting[] = ['printer_name'];

/** Same limits as apps/api/src/settings/dto/update-settings.dto.ts. */
export const SETTING_MAX_LENGTH: Record<EditableSetting, number> = {
  pharmacy_name: 120,
  address: 300,
  phone: 30,
  printer_name: 100,
};

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;
const PHONE = /^\+?\d[\d\s-]{5,18}\d$/;

export function draftFrom(settings: PharmacySettings): SettingsDraft {
  return {
    pharmacy_name: settings.pharmacy_name ?? '',
    address: settings.address ?? '',
    phone: settings.phone ?? '',
    printer_name: settings.printer_name ?? '',
  };
}

/** The fields among `fields` whose trimmed draft differs from the saved value. Empty clears. */
export function changedSettings(saved: PharmacySettings, draft: SettingsDraft, fields: readonly EditableSetting[]): SettingsPatch {
  const patch: SettingsPatch = {};
  for (const field of fields) {
    const next = draft[field].trim();
    if (next !== (saved[field] ?? '')) patch[field] = next;
  }
  return patch;
}

/** Checks the same rules as the API, so most mistakes are shown before anything is sent. */
export function validateSettings(draft: SettingsDraft, fields: readonly EditableSetting[]): SettingsErrors {
  const errors: SettingsErrors = {};
  for (const field of fields) {
    const value = draft[field];
    if (value.length > SETTING_MAX_LENGTH[field]) errors[field] = `Use at most ${SETTING_MAX_LENGTH[field]} characters.`;
    else if (CONTROL_CHARS.test(value)) errors[field] = 'Keep this on one line.';
    else if (field === 'phone' && value.trim() && !PHONE.test(value.trim()))
      errors[field] = 'Enter a phone number using digits, spaces or dashes (for example 011 234 5678).';
  }
  return errors;
}
