/**
 * Calendar-day helpers in the pharmacy's local time zone.
 *
 * "Today" on the dashboard means the pharmacy's day (Asia/Colombo by default), not the UTC
 * day, which starts at 05:30 local time in Sri Lanka.
 */

function partsIn(timeZone: string, instant: number) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { y: get('year'), m: get('month'), d: get('day'), h: get('hour'), min: get('minute'), s: get('second') };
}

function offsetMs(timeZone: string, instant: number): number {
  const p = partsIn(timeZone, instant);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s) - Math.floor(instant / 1000) * 1000;
}

/** YYYY-MM-DD of the given instant in the time zone. */
export function zonedDate(timeZone: string, instant: Date = new Date()): string {
  const p = partsIn(timeZone, instant.getTime());
  return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
}

/** Adds whole days to a YYYY-MM-DD string. */
export function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** The UTC instant at which the given local calendar day starts. */
export function startOfZonedDay(timeZone: string, ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d);
  let result = guess - offsetMs(timeZone, guess);
  // Re-check once in case the offset differs at the corrected instant (DST transitions).
  result = guess - offsetMs(timeZone, result);
  return new Date(result);
}
