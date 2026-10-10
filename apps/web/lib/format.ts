import { MISSING } from '@/components/ui/States';

/** Formatting for display. Every function returns "—" for missing or invalid input, never a default value. */

function toDate(value: unknown): Date | null {
  if (typeof value !== 'string' && !(value instanceof Date)) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(value: unknown): string {
  // A plain YYYY-MM-DD (expiry, received date) is a calendar date: show it without time-zone shifting.
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
  }
  const d = toDate(value);
  return d ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : MISSING;
}

export function formatDateTime(value: unknown): string {
  const d = toDate(value);
  return d
    ? d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : MISSING;
}

export function formatTime(value: unknown): string {
  const d = toDate(value);
  return d ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : MISSING;
}

export function isNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/** Numbers may arrive as strings from Postgres numeric columns. */
export function toNumberOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export function formatNumber(v: unknown): string {
  const n = toNumberOrNull(v);
  return n === null ? MISSING : n.toLocaleString();
}

export function formatLkr(v: unknown): string {
  const n = toNumberOrNull(v);
  return n === null ? MISSING : `LKR ${n.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Days from today (local) to a YYYY-MM-DD date; negative when past. */
export function daysUntil(ymd: unknown): number | null {
  if (typeof ymd !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(ymd)) return null;
  const [y, m, d] = ymd.slice(0, 10).split('-').map(Number);
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((Date.UTC(y, m - 1, d) - today) / 86_400_000);
}

export function text(v: unknown): string {
  return typeof v === 'string' && v.trim() ? v : MISSING;
}
