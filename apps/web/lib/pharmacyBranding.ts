/**
 * Pharmacy details printed in the label footer. Configured per deployment (never hardcoded):
 *   NEXT_PUBLIC_PHARMACY_NAME, NEXT_PUBLIC_PHARMACY_ADDRESS, NEXT_PUBLIC_PHARMACY_PHONE
 * Each is printed exactly as configured; an unset value is omitted from the label (no placeholder).
 * NEXT_PUBLIC_* values are fixed when the web app is built or the dev server starts.
 */
export type PharmacyBranding = { name: string | null; address: string | null; phone: string | null };

const value = (text: string | undefined) => (text && text.trim() ? text.trim() : null);

export function pharmacyBranding(): PharmacyBranding {
  return {
    name: value(process.env.NEXT_PUBLIC_PHARMACY_NAME),
    address: value(process.env.NEXT_PUBLIC_PHARMACY_ADDRESS),
    phone: value(process.env.NEXT_PUBLIC_PHARMACY_PHONE),
  };
}
