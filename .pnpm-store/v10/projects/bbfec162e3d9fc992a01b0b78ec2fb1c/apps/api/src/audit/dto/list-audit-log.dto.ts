import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  Matches,
  Max,
  Min,
  ValidateBy,
  type ValidationOptions,
} from 'class-validator';

/** Operations the audit triggers record (CHECK constraint on `audit_log.action`). */
export const AUDIT_ACTIONS = ['INSERT', 'UPDATE', 'DELETE'] as const;

/**
 * Tables with an audit trigger in the migrations, and the module each belongs to. An entity type
 * found in the log but missing here is still returned, labelled with its table name.
 */
export const AUDITED_ENTITIES = {
  customers: 'Patients',
  products: 'Medicines',
  suppliers: 'Suppliers',
  product_batches: 'Inventory batches',
  patient_returns: 'Patient returns',
  pharmacy_settings: 'Pharmacy settings',
  user_profiles: 'User profiles',
  reasons: 'Edit reasons',
} as const;
export type AuditedEntity = keyof typeof AUDITED_ENTITIES;

export const DEFAULT_AUDIT_PAGE_SIZE = 25;
export const MAX_AUDIT_PAGE_SIZE = 100;
/** Deepest page reachable; older events are reached by narrowing the date range instead. */
export const MAX_AUDIT_PAGE = 200;

/** A user id (UUID), or `none` for changes recorded without a user. */
const ACTOR =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|none)$/i;
/** Record references are row ids (UUIDs) or `true` for the single settings row. */
export const RECORD_REFERENCE = /^[A-Za-z0-9_-]{1,64}$/;

/** A real calendar date written as YYYY-MM-DD (rejects 2026-02-30). */
function IsCalendarDate(options?: ValidationOptions) {
  return ValidateBy(
    {
      name: 'isCalendarDate',
      validator: {
        validate: (value: unknown) => {
          if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
            return false;
          const [y, m, d] = value.split('-').map(Number);
          const date = new Date(Date.UTC(y, m - 1, d));
          return (
            date.getUTCFullYear() === y &&
            date.getUTCMonth() === m - 1 &&
            date.getUTCDate() === d
          );
        },
        defaultMessage: (args) =>
          `${args?.property} must be a date written as YYYY-MM-DD.`,
      },
    },
    options,
  );
}

/** One page of the audit log, newest first. Every filter is optional. */
export class ListAuditLogQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_AUDIT_PAGE)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_AUDIT_PAGE_SIZE)
  pageSize?: number;

  /** First local day included (pharmacy time zone). */
  @IsOptional()
  @IsCalendarDate()
  from?: string;

  /** Last local day included (pharmacy time zone). */
  @IsOptional()
  @IsCalendarDate()
  to?: string;

  @IsOptional()
  @IsIn(AUDIT_ACTIONS)
  action?: (typeof AUDIT_ACTIONS)[number];

  @IsOptional()
  @IsIn(Object.keys(AUDITED_ENTITIES))
  entity?: AuditedEntity;

  /** A user id, or `none` for changes recorded without a user. */
  @IsOptional()
  @Matches(ACTOR, {
    message: 'actor must be a user id or "none".',
  })
  actor?: string;

  /** Exact record reference (the affected row's id). */
  @IsOptional()
  @Matches(RECORD_REFERENCE, {
    message: 'record must be a record reference (letters, digits, - and _).',
  })
  record?: string;
}

/** The event id is the table's BIGSERIAL key (kept within JavaScript's exact integer range). */
export const AUDIT_EVENT_ID = /^[1-9]\d{0,14}$/;
