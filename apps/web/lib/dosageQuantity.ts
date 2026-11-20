/** Recover a reduced rational from the legacy numeric dosage, avoiding decimal display drift. */
export function dosageRatio(qty: number): [number, number] {
  if (!Number.isFinite(qty) || qty <= 0) return [0, 1];
  let value = qty;
  let n0 = 0, n1 = 1, d0 = 1, d1 = 0;
  for (let i = 0; i < 40; i++) {
    const a = Math.floor(value);
    const n = a * n1 + n0, d = a * d1 + d0;
    if (!Number.isSafeInteger(n) || !Number.isSafeInteger(d)) break;
    n0 = n1; n1 = n; d0 = d1; d1 = d;
    if (Math.abs(n / d - qty) <= Number.EPSILON * Math.max(1, qty)) break;
    value = 1 / (value - a);
  }
  return [n1, d1];
}

/** Add/subtract one whole unit using integer numerator arithmetic, clamping at zero. */
export function stepDosage(qty: number, step: 1 | -1) {
  const [n, d] = dosageRatio(qty);
  const next = Math.max(0, n + step * d);
  return { qty: next / d, isFraction: next % d !== 0 };
}

export function fractionText(qty: number): string | null {
  const [n, d] = dosageRatio(qty);
  const remainder = n % d;
  if (!remainder) return null;
  if (d === 2 && remainder === 1) return '½';
  if (d === 4 && remainder === 1) return '¼';
  if (d === 4 && remainder === 3) return '¾';
  return `${remainder}/${d}`;
}

export function dosageText(qty: number, isFraction: boolean): string {
  if (!isFraction) return String(qty);
  const [n, d] = dosageRatio(qty);
  const whole = Math.floor(n / d);
  const fraction = fractionText(qty);
  return fraction ? (whole ? `${whole}${fraction.length === 1 ? '' : ' '}${fraction}` : fraction) : String(whole);
}
