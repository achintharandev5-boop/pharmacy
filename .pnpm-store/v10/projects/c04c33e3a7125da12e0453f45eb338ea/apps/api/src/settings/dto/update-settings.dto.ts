import {
  IsString,
  Matches,
  MaxLength,
  ValidateBy,
  ValidateIf,
  type ValidationOptions,
} from 'class-validator';

/** One line of text: no line breaks, tabs or other control characters. */
const SINGLE_LINE = /^\P{Cc}*$/u;
/** Empty (clears the value) or a phone number of 7 to 20 digits, spaces, dashes and a leading +. */
const PHONE = /^\s*(\+?\d[\d\s-]{5,18}\d)?\s*$/;

const sent = (_: object, v: unknown) => v !== undefined && v !== null;

/**
 * Refuses any value for a setting this form must not change, instead of silently dropping it.
 * Timezone drives the database's expiry checks (`pharmacy_today()`), label size is fixed by the
 * print layout, and the inventory and SMS settings are not read by the application yet.
 */
function ReadOnlySetting(options?: ValidationOptions) {
  return ValidateBy(
    {
      name: 'readOnlySetting',
      validator: {
        validate: (value: unknown) => value === undefined,
        defaultMessage: (args) =>
          `${args?.property} cannot be changed from the settings form.`,
      },
    },
    options,
  );
}

/**
 * Edit of the single `pharmacy_settings` row. Only the fields sent are considered, and only those
 * whose value differs from the saved one are written. An empty string or null clears a value.
 */
export class UpdateSettingsDto {
  @ValidateIf(sent)
  @IsString()
  @MaxLength(120)
  @Matches(SINGLE_LINE, { message: 'pharmacy_name must be on one line' })
  pharmacy_name?: string | null;

  @ValidateIf(sent)
  @IsString()
  @MaxLength(300)
  @Matches(SINGLE_LINE, { message: 'address must be on one line' })
  address?: string | null;

  @ValidateIf(sent)
  @IsString()
  @MaxLength(30)
  @Matches(PHONE, { message: 'phone must be a phone number' })
  phone?: string | null;

  @ValidateIf(sent)
  @IsString()
  @MaxLength(100)
  @Matches(SINGLE_LINE, { message: 'printer_name must be on one line' })
  printer_name?: string | null;

  /** The `updated_at` the editor loaded. A save is refused if someone else saved since. */
  @ValidateIf(sent)
  @IsString()
  @MaxLength(64)
  expected_updated_at?: string | null;

  @ReadOnlySetting() timezone?: unknown;
  @ReadOnlySetting() label_width_mm?: unknown;
  @ReadOnlySetting() label_height_mm?: unknown;
  @ReadOnlySetting() low_stock_alerts_enabled?: unknown;
  @ReadOnlySetting() expiry_alert_days?: unknown;
  @ReadOnlySetting() sms_enabled?: unknown;
  @ReadOnlySetting() sms_sender_id?: unknown;
  @ReadOnlySetting() updated_by?: unknown;
  @ReadOnlySetting() updated_at?: unknown;
  @ReadOnlySetting() id?: unknown;
}
