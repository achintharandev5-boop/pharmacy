/**
 * Validates the environment at startup. The API refuses to start rather than run with
 * placeholder credentials or an unknown database.
 */
export interface AppEnv {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  PORT: number;
  FRONTEND_URL: string;
  PHARMACY_TIMEZONE: string;
  PRESCRIPTION_WRITE_MODE: PrescriptionWriteMode;
  PILOT_PHARMACY_ID?: string;
  PILOT_SUPABASE_URL?: string;
}

/**
 * How prescriptions are written.
 *   legacy        (default) application-level steps with compensating rollback; deducts the
 *                 product total only.
 *   transactional the `create_prescription` database function: one transaction, batch-level
 *                 FEFO deduction. Enable only after the pharmacist has approved the allocation
 *                 and deduction rules and migration 20261010000500 is applied.
 */
export const PRESCRIPTION_WRITE_MODES = ['legacy', 'transactional'] as const;
export type PrescriptionWriteMode = (typeof PRESCRIPTION_WRITE_MODES)[number];

const PLACEHOLDER_KEYS = new Set([
  '',
  'dummy_key',
  'changeme',
  'your-service-role-key',
]);

export function validateEnv(raw: Record<string, unknown>): AppEnv {
  const errors: string[] = [];
  const str = (name: string) =>
    typeof raw[name] === 'string' ? raw[name].trim() : '';

  const url = str('SUPABASE_URL');
  if (!url) {
    errors.push('SUPABASE_URL is required');
  } else {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:')
        errors.push('SUPABASE_URL must be an http(s) URL');
    } catch {
      errors.push('SUPABASE_URL is not a valid URL');
    }
  }

  const key = str('SUPABASE_SERVICE_ROLE_KEY');
  if (PLACEHOLDER_KEYS.has(key))
    errors.push('SUPABASE_SERVICE_ROLE_KEY is required');

  // Deployment binding is mandatory for production, optional for existing local tests.
  // This is containment for one isolated database, not tenant scoping of shared tables.
  const pharmacyId = str('PILOT_PHARMACY_ID');
  const expectedUrl = str('PILOT_SUPABASE_URL');
  const production = str('NODE_ENV') === 'production';
  if (production || pharmacyId || expectedUrl) {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        pharmacyId,
      )
    ) {
      errors.push('PILOT_PHARMACY_ID must be an explicitly assigned UUID');
    }
    try {
      const expected = new URL(expectedUrl);
      const actual = new URL(url);
      if (
        expected.protocol !== 'https:' ||
        expected.username ||
        expected.password ||
        expected.pathname !== '/' ||
        expected.search ||
        expected.hash ||
        actual.href !== expected.href
      ) {
        errors.push(
          'SUPABASE_URL must match the approved HTTPS PILOT_SUPABASE_URL',
        );
      }
    } catch {
      errors.push(
        'PILOT_SUPABASE_URL must identify the approved isolated project',
      );
    }
    const origins = str('FRONTEND_URL')
      .split(',')
      .map((origin) => origin.trim());
    if (
      !origins.every((origin) => {
        try {
          const parsed = new URL(origin);
          return parsed.protocol === 'https:' && parsed.origin === origin;
        } catch {
          return false;
        }
      })
    )
      errors.push(
        'FRONTEND_URL must contain explicit HTTPS origins for pilot deployments',
      );
  }

  const portRaw = str('PORT') || '3001';
  const port = Number(portRaw);
  if (!Number.isInteger(port) || port <= 0 || port > 65535)
    errors.push('PORT must be a valid port number');

  const timezone = str('PHARMACY_TIMEZONE') || 'Asia/Colombo';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
  } catch {
    errors.push(
      'PHARMACY_TIMEZONE must be a valid IANA time zone (for example Asia/Colombo)',
    );
  }

  const writeMode = str('PRESCRIPTION_WRITE_MODE') || 'legacy';
  if (!(PRESCRIPTION_WRITE_MODES as readonly string[]).includes(writeMode)) {
    errors.push(
      `PRESCRIPTION_WRITE_MODE must be one of: ${PRESCRIPTION_WRITE_MODES.join(', ')}`,
    );
  }

  if (errors.length > 0) {
    // Names only: values are never printed.
    throw new Error(`Invalid API configuration:\n  - ${errors.join('\n  - ')}`);
  }

  return {
    SUPABASE_URL: url,
    SUPABASE_SERVICE_ROLE_KEY: key,
    PORT: port,
    FRONTEND_URL: str('FRONTEND_URL') || 'http://localhost:3000',
    PHARMACY_TIMEZONE: timezone,
    PRESCRIPTION_WRITE_MODE: writeMode as PrescriptionWriteMode,
    ...(pharmacyId ? { PILOT_PHARMACY_ID: pharmacyId } : {}),
    ...(expectedUrl ? { PILOT_SUPABASE_URL: expectedUrl } : {}),
  };
}
