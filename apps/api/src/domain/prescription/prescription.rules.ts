export function generatePrescriptionNumber(sequence: number): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const seqStr = String(sequence).padStart(6, '0');
  return `RX-${year}${month}${day}-${seqStr}`;
}

export function normalizeSriLankanPhone(phone?: string | null): string | null {
  if (!phone) return null;
  let clean = phone.replace(/\D/g, '');
  if (clean.startsWith('0')) {
    clean = '94' + clean.substring(1);
  } else if (!clean.startsWith('94') && clean.length === 9) {
    clean = '94' + clean;
  }
  return clean || null;
}
