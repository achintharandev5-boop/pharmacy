/**
 * Interprets the expiry text a pharmacist puts on a label.
 *
 * The workstation accepts free text ("2028-01-31", "12/2026", "1/8/2028"). Only unambiguous
 * forms are interpreted; anything else is kept as the printed text and never converted into
 * a date, because "1/8/2028" could mean 1 August or 8 January.
 */
export interface LabelExpiry {
  /** Exactly what was printed. */
  text: string;
  /** Set only for an unambiguous full date (YYYY-MM-DD). */
  isoDate: string | null;
  /** Set for YYYY-MM-DD and MM/YYYY forms. */
  yearMonth: { year: number; month: number } | null;
}

export function parseLabelExpiry(raw: string | null | undefined): LabelExpiry | null {
  const text = (raw ?? '').trim();
  if (!text) return null;

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (iso) {
    const [year, month, day] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
    const d = new Date(Date.UTC(year, month - 1, day));
    if (d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day) {
      return { text, isoDate: text, yearMonth: { year, month } };
    }
    return { text, isoDate: null, yearMonth: null };
  }

  const monthYear = /^(\d{1,2})\s*[/-]\s*(\d{4})$/.exec(text);
  if (monthYear) {
    const [month, year] = [Number(monthYear[1]), Number(monthYear[2])];
    if (month >= 1 && month <= 12) return { text, isoDate: null, yearMonth: { year, month } };
  }

  return { text, isoDate: null, yearMonth: null };
}

/**
 * True when the expiry is known to be in the past on `today` (YYYY-MM-DD, pharmacy time).
 * A month-only expiry is treated as valid until the end of that month.
 * Returns false when the text cannot be interpreted; callers must not treat that as "valid".
 */
export function isKnownExpired(expiry: LabelExpiry, today: string): boolean {
  if (expiry.isoDate) return expiry.isoDate < today;
  if (expiry.yearMonth) {
    const [ty, tm] = today.split('-').map(Number);
    const { year, month } = expiry.yearMonth;
    return year < ty || (year === ty && month < tm);
  }
  return false;
}
