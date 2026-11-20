import type { SelectedProduct } from '../store/labelStore';

export const PRODUCT_TYPES = {
  Pethi: 'පෙති',
  Karal: 'කරල්',
  Packet: 'පැකට්',
} as const;

export type ProductType = keyof typeof PRODUCT_TYPES;

/** Shared UI/printing derivation. The original catalogue value remains on the product record. */
export function resolveProductType(value: unknown): {
  type: ProductType | null;
  sinhala: string | null;
  message: string | null;
} {
  if (typeof value !== 'string' || !value.trim()) {
    return { type: null, sinhala: null, message: 'Product type is missing. Check the medicine catalogue record.' };
  }
  const type = (Object.keys(PRODUCT_TYPES) as ProductType[])
    .find((key) => key.toLowerCase() === value.trim().toLowerCase());
  return type
    ? { type, sinhala: PRODUCT_TYPES[type], message: null }
    : { type: null, sinhala: null, message: `Unsupported product type: ${value}. Check the medicine catalogue record.` };
}

/** One conversion for search, barcode lookup and catalogue reload when editing. */
export function toSelectedProduct(product: SelectedProduct): SelectedProduct {
  return {
    id: product.id,
    name: product.name,
    expiry_date: product.expiry_date ?? null,
    unit_of_measure: product.unit_of_measure,
    product_type: product.product_type ?? null,
  };
}
