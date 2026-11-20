import { describe, expect, it } from 'vitest';
import { firstLabelMissingQuantity } from './labelQuantity';

describe('firstLabelMissingQuantity', () => {
  it('returns the first label without an explicitly entered positive quantity', () => {
    expect(firstLabelMissingQuantity([{ productQuantity: 2 }, { productQuantity: null }, { productQuantity: 3 }])).toBe(1);
  });

  it('accepts explicitly entered quantities and returns -1 when all are set', () => {
    expect(firstLabelMissingQuantity([{ productQuantity: 1 }, { productQuantity: 2.5 }])).toBe(-1);
    expect(firstLabelMissingQuantity([])).toBe(-1);
  });
});
