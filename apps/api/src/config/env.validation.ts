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
}

const PLACEHOLDER_KEYS = new Set(['', 'dummy_key', 'changeme', 'your-service-role-key']);

export function validateEnv(raw: Record<string, unknown>): AppEnv {
  const errors: string[] = [];
  const str = (name: string) => (typeof raw[name] === 'string' ? (raw[name] as string).trim() : '');

  const url = str('SUPABASE_URL');
  if (!url) {
    errors.push('SUPABASE_URL is required');
  } else {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') errors.push('SUPABASE_URL must be an http(s) URL');
    } catch {
      errors.push('SUPABASE_URL is not a valid URL');
    }
  }

  const key = str('SUPABASE_SERVICE_ROLE_KEY');
  if (PLACEHOLDER_KEYS.has(key)) errors.push('SUPABASE_SERVICE_ROLE_KEY is required');

  const portRaw = str('PORT') || '3001';
  const port = Number(portRaw);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) errors.push('PORT must be a valid port number');

  const timezone = str('PHARMACY_TIMEZONE') || 'Asia/Colombo';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
  } catch {
    errors.push('PHARMACY_TIMEZONE must be a valid IANA time zone (for example Asia/Colombo)');
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
  };
}
