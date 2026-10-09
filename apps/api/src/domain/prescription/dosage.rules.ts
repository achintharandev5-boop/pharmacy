export interface DosageValues {
  morning: number;
  lunch: number;
  night: number;
}

export function validateDosage(dosage: DosageValues): { valid: boolean; message?: string } {
  if (dosage.morning < 0 || dosage.lunch < 0 || dosage.night < 0) {
    return { valid: false, message: 'Dosage quantities cannot be negative' };
  }
  return { valid: true };
}

export function formatDosageReadable(qty: number): string | null {
  if (qty <= 0) return null;
  const whole = Math.floor(qty);
  const frac = qty - whole;
  
  let fracStr = '';
  if (Math.abs(frac - 0.5) < 0.01) fracStr = '½';
  else if (Math.abs(frac - 0.25) < 0.01) fracStr = '¼';
  else if (Math.abs(frac - 0.75) < 0.01) fracStr = '¾';
  else if (frac > 0) fracStr = ` ${frac.toFixed(2).replace('0.', '.')}`;

  if (whole === 0) return fracStr.trim() || null;
  return `${whole}${fracStr}`;
}
