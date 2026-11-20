import type { LabelData } from '../store/labelStore';

/** Returns the first label whose dispense quantity was not explicitly entered. */
export function firstLabelMissingQuantity(labels: readonly Pick<LabelData, 'productQuantity'>[]): number {
  return labels.findIndex(({ productQuantity }) =>
    typeof productQuantity !== 'number' || !Number.isFinite(productQuantity) || productQuantity <= 0,
  );
}
