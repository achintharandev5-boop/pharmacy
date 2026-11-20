import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { unwrap } from '../common/db';
import type { AuthUser } from '../auth/roles';
import type { UpdateSettingsDto } from './dto/update-settings.dto';

/** Columns returned to the settings page. SMS settings are configured on the server, not here. */
const COLUMNS =
  'pharmacy_name, address, phone, printer_name, timezone, label_width_mm, label_height_mm, ' +
  'low_stock_alerts_enabled, expiry_alert_days, updated_at, updated_by';

/** The only columns an administrator can change from the settings form. */
export const EDITABLE_SETTINGS = [
  'pharmacy_name',
  'address',
  'phone',
  'printer_name',
] as const;
type EditableSetting = (typeof EDITABLE_SETTINGS)[number];

export type PharmacySettings = Record<EditableSetting, string | null> & {
  timezone: string;
  label_width_mm: number | null;
  label_height_mm: number | null;
  low_stock_alerts_enabled: boolean;
  expiry_alert_days: number;
  updated_at: string;
  updated_by: string | null;
};

/** Trims surrounding whitespace only; the wording itself (including Sinhala) is kept exactly. */
function normalize(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * The pharmacy's single settings row (`pharmacy_settings`, id = TRUE, created by the migration).
 *
 * Printed labels do NOT read these values yet: the label footer still comes from the
 * NEXT_PUBLIC_PHARMACY_* environment variables until decision Q-S1 is made.
 */
@Injectable()
export class SettingsService {
  private readonly logger = new Logger('Settings');

  constructor(private readonly supabase: SupabaseService) {}

  private get db() {
    return this.supabase.getClient();
  }

  async get(): Promise<PharmacySettings> {
    const row = unwrap<PharmacySettings>(
      await this.db
        .from('pharmacy_settings')
        .select(COLUMNS)
        .eq('id', true)
        .maybeSingle(),
      'load the pharmacy settings',
    );
    if (!row)
      throw new NotFoundException({
        code: 'SETTINGS_MISSING',
        message:
          'The pharmacy settings record does not exist. Apply the database migrations, which create it.',
      });
    return row;
  }

  /**
   * Writes only the fields that differ from the saved row. The update is conditional on the
   * row's `updated_at`, so a concurrent save by another administrator is reported, not overwritten.
   * The audit trigger on `pharmacy_settings` records which fields changed; `updated_by` records who.
   */
  async update(
    user: AuthUser,
    dto: UpdateSettingsDto,
  ): Promise<{ settings: PharmacySettings; changed: EditableSetting[] }> {
    const sent = EDITABLE_SETTINGS.filter((f) => dto[f] !== undefined);
    if (sent.length === 0)
      throw new BadRequestException({
        code: 'NO_SETTINGS',
        message: 'No editable setting was sent.',
      });

    const current = await this.get();
    const expected = dto.expected_updated_at;
    if (expected && expected !== current.updated_at) throw this.conflict();

    const patch: Partial<Record<EditableSetting, string | null>> = {};
    for (const field of sent) {
      const value = normalize(dto[field]);
      if (value !== current[field]) patch[field] = value;
    }
    const changed = Object.keys(patch) as EditableSetting[];
    if (changed.length === 0) return { settings: current, changed };

    const saved = unwrap<PharmacySettings>(
      await this.db
        .from('pharmacy_settings')
        .update({ ...patch, updated_by: user.id })
        .eq('id', true)
        .eq('updated_at', current.updated_at)
        .select(COLUMNS)
        .maybeSingle(),
      'save the pharmacy settings',
    );
    if (!saved) throw this.conflict();

    // Field names only: values stay in the settings table.
    this.logger.log(
      `pharmacy settings updated by ${user.id}: ${changed.join(', ')}`,
    );
    return { settings: saved, changed };
  }

  private conflict() {
    return new ConflictException({
      code: 'SETTINGS_CHANGED',
      message:
        'The settings were changed by someone else after you opened them. Reload to see the latest values, then make your change again.',
    });
  }
}
