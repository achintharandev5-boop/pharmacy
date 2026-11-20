/**
 * Checks the expiry text typed on the workstation before it goes on a label.
 *
 * Mirrors the API's rule (apps/api/src/domain/prescription/expiry.rules.ts), which refuses a
 * label whose expiry has passed. Only unambiguous forms are checked: YYYY-MM-DD and MM/YYYY.
 * Anything else (for example "1/8/2028", which could be 1 August or 8 January) is accepted
 * and printed exactly as typed, as before; it is never converted into a date.
 */
export type ExpiryCheck =
  | { ok: true; checked: boolean }
  | { ok: false; message: string };

function localToday(now: Date): { y: number; m: number; d: number } {
  return { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() };
}

export function checkLabelExpiry(raw: string, now: Date = new Date()): ExpiryCheck {
  const text = raw.trim();
  if (!text) return { ok: false, message: 'Enter the expiry date from the pack, or press Clear.' };

  const today = localToday(now);

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (iso) {
    const [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
    const date = new Date(Date.UTC(y, m - 1, d));
    if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
      return { ok: false, message: `${text} is not a real date.` };
    }
    const passed = y < today.y || (y === today.y && (m < today.m || (m === today.m && d < today.d)));
    if (passed) return { ok: false, message: `${text} has already passed. Check the pack.` };
    return { ok: true, checked: true };
  }

  const monthYear = /^(\d{1,2})\s*[/-]\s*(\d{4})$/.exec(text);
  if (monthYear) {
    const [m, y] = [Number(monthYear[1]), Number(monthYear[2])];
    if (m < 1 || m > 12) return { ok: false, message: `${text}: the month must be 1 to 12.` };
    // A month-only expiry is valid until the end of that month.
    if (y < today.y || (y === today.y && m < today.m)) {
      return { ok: false, message: `${text} has already passed. Check the pack.` };
    }
    return { ok: true, checked: true };
  }

  return { ok: true, checked: false };
}
