/**
 * Add Expiry Date (Document 5 pp. 41–43 and 54–55).
 *
 * The printed expiry is the date recorded for the dispensing batch at GRN entry. It is never
 * typed on the label page, never taken from the medicine record and never guessed. When the
 * medicine has more than one dispensable batch the pharmacist chooses the batch being
 * dispensed; no batch is picked on their behalf.
 *
 * The date is a calendar date (YYYY-MM-DD) and is printed exactly as stored, so no time zone
 * can move it by a day. Document 5 does not define another format.
 */

/** The batch whose expiry is printed on a label. */
export type ExpiryBatch = {
  /** product_batches.id. Null only for a temporary UI-testing value. */
  id: string | null;
  productId: string | null;
  batchNumber: string | null;
  /** YYYY-MM-DD exactly as recorded at GRN entry. */
  expiryDate: string;
  /** 'ui-test': typed by a tester in database-free UI testing mode; never a GRN record. */
  source: 'inventory' | 'ui-test';
};

/** A dispensable batch as returned by GET /inventory/dispensing-batches. */
export type DispensingBatch = {
  id: string;
  batchNumber: string;
  expiryDate: string;
  quantityAvailable: number;
};

export const EXPIRY_CODE = 'ADD EXP DATE';

/** True for a real calendar date written YYYY-MM-DD. */
export function isCalendarDate(text: unknown): text is string {
  if (typeof text !== 'string') return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

/** Today's calendar date on this workstation, YYYY-MM-DD. */
export function localDate(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

type ExpiryLabel = {
  additionalInstructions: string[];
  expiryDate?: string | null;
  expiryBatch?: ExpiryBatch | null;
  product?: { id?: string | null } | null;
};

export function expirySelected(label: Pick<ExpiryLabel, 'additionalInstructions'>): boolean {
  return label.additionalInstructions.includes(EXPIRY_CODE);
}

/**
 * Why this label's expiry cannot be printed, or null. Shared by DONE, the review page, Save and
 * Print. The API checks the batch again against the database when the prescription is saved.
 */
export function expiryPrintError(label: ExpiryLabel, opts: { uiTest?: boolean; now?: Date } = {}): string | null {
  const selected = expirySelected(label);
  const batch = label.expiryBatch ?? null;
  const printed = label.expiryDate ?? null;

  if (!selected) {
    return printed || batch
      ? 'The expiry date does not match the Add Expiry Date selection. Remove the expiry date and select Add Expiry Date again.'
      : null;
  }
  if (!batch || !printed) {
    return 'Add Expiry Date is selected but no batch expiry date has been retrieved. Choose the batch, or remove Add Expiry Date.';
  }
  if (batch.source === 'ui-test') {
    if (!opts.uiTest) return 'The expiry date is a temporary UI-testing value, not a GRN batch. Remove Add Expiry Date and select it again.';
  } else if (batch.source !== 'inventory' || !batch.id || !batch.productId || batch.productId !== label.product?.id) {
    return 'The expiry date belongs to a different medicine or batch. Remove Add Expiry Date and select it again.';
  }
  if (!isCalendarDate(batch.expiryDate)) {
    return `The batch expiry date (${String(batch.expiryDate)}) is not a valid date. Check the GRN record.`;
  }
  if (printed !== batch.expiryDate) {
    return 'The expiry date shown does not match the selected batch. Remove Add Expiry Date and select it again.';
  }
  if (batch.expiryDate < localDate(opts.now)) {
    return `The batch expiry date ${batch.expiryDate} has passed. Choose another batch.`;
  }
  return null;
}
