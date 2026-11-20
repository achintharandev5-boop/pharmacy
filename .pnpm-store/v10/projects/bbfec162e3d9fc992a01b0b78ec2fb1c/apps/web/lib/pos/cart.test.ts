import { describe, expect, it } from 'vitest';
import {
  addProduct,
  CHECKOUT_PENDING_DECISIONS,
  CHECKOUT_PENDING_MESSAGE,
  parseStoredCart,
  reconcileCart,
  serializeCart,
  EMPTY_CART,
  formatCents,
  lineTotalCents,
  looksLikeBarcode,
  MAX_LINE_QUANTITY,
  priceToCents,
  removeLine,
  setQuantity,
  summarize,
  type PosProduct,
} from './cart';

function product(overrides: Partial<PosProduct> = {}): PosProduct {
  return {
    id: 'p1',
    name: 'Panadol 500mg',
    genericName: 'Paracetamol',
    brandName: null,
    strength: '500mg',
    dosageForm: 'Tablet',
    barcode: '4791000',
    rxRequired: false,
    price: 12.5,
    recordedStock: 50,
    sellableQuantity: 35,
    nearestExpiry: '2099-01-31',
    ...overrides,
  };
}

describe('priceToCents', () => {
  it('converts recorded prices exactly', () => {
    expect(priceToCents(12.5)).toBe(1250);
    expect(priceToCents(0.1)).toBe(10);
    expect(priceToCents(1234.99)).toBe(123499);
    expect(priceToCents(0)).toBe(0);
  });

  it('treats missing, negative and over-precise prices as unusable instead of rounding them', () => {
    expect(priceToCents(null)).toBeNull();
    expect(priceToCents(undefined)).toBeNull();
    expect(priceToCents(-1)).toBeNull();
    expect(priceToCents(Number.NaN)).toBeNull();
    expect(priceToCents(1.005)).toBeNull();
  });
});

describe('cart operations', () => {
  it('adds a product and merges a repeat into the same line', () => {
    let { cart } = addProduct(EMPTY_CART, product());
    ({ cart } = addProduct(cart, product(), 2));
    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0].quantity).toBe(3);
  });

  it('keeps multiple products as separate lines in the order added', () => {
    let { cart } = addProduct(EMPTY_CART, product());
    ({ cart } = addProduct(cart, product({ id: 'p2', name: 'Amoxil' })));
    expect(cart.lines.map((l) => l.product.id)).toEqual(['p1', 'p2']);
  });

  it('refuses a product with no sellable stock', () => {
    const change = addProduct(EMPTY_CART, product({ sellableQuantity: 0 }));
    expect(change.cart.lines).toHaveLength(0);
    expect(change.notice).toMatch(/no sellable stock/);
  });

  it('refuses a product without a usable recorded price, and never invents one', () => {
    for (const price of [null, -1, 1.005]) {
      const change = addProduct(EMPTY_CART, product({ price }));
      expect(change.cart.lines).toHaveLength(0);
      expect(change.notice).toMatch(/no recorded selling price/);
    }
    expect(addProduct(EMPTY_CART, product({ price: 0 })).cart.lines).toHaveLength(1);
  });

  it('adds a prescription-only product (the sale rule applies at checkout) and counts it', () => {
    expect(addProduct(EMPTY_CART, product({ rxRequired: true })).cart.lines).toHaveLength(1);
  });

  it('caps quantity at the sellable stock and says so', () => {
    const change = addProduct(EMPTY_CART, product({ sellableQuantity: 2 }), 5);
    expect(change.cart.lines[0].quantity).toBe(2);
    expect(change.notice).toMatch(/Only 2 unit/);
  });

  it('edits quantity to whole units within stock', () => {
    const { cart } = addProduct(EMPTY_CART, product());
    expect(setQuantity(cart, 'p1', 7).cart.lines[0].quantity).toBe(7);
    const capped = setQuantity(cart, 'p1', 100);
    expect(capped.cart.lines[0].quantity).toBe(35);
    expect(capped.notice).toBeDefined();
    const fractional = setQuantity(cart, 'p1', 1.5);
    expect(fractional.cart).toBe(cart);
    expect(fractional.notice).toMatch(/whole number/);
  });

  it('removes a line when its quantity is set to zero', () => {
    const { cart } = addProduct(EMPTY_CART, product());
    expect(setQuantity(cart, 'p1', 0).cart.lines).toHaveLength(0);
  });

  it('never accepts more than the maximum line quantity', () => {
    const { cart } = addProduct(EMPTY_CART, product({ sellableQuantity: 50_000 }), 20_000);
    expect(cart.lines[0].quantity).toBe(MAX_LINE_QUANTITY);
  });

  it('removes one line and leaves the others', () => {
    let { cart } = addProduct(EMPTY_CART, product());
    ({ cart } = addProduct(cart, product({ id: 'p2' })));
    expect(removeLine(cart, 'p1').cart.lines.map((l) => l.product.id)).toEqual(['p2']);
  });

  it('does not mutate the previous cart', () => {
    const first = addProduct(EMPTY_CART, product()).cart;
    addProduct(first, product(), 3);
    expect(first.lines[0].quantity).toBe(1);
    expect(EMPTY_CART.lines).toHaveLength(0);
  });
});

describe('summarize', () => {
  it('totals priced lines exactly in cents', () => {
    let { cart } = addProduct(EMPTY_CART, product({ price: 0.1 }), 3);
    ({ cart } = addProduct(cart, product({ id: 'p2', price: 0.2 }), 1));
    const s = summarize(cart);
    expect(s.subtotalCents).toBe(50);
    expect(s).toMatchObject({ lineCount: 2, unitCount: 4, allPriced: true, unpricedLines: 0 });
  });

  it('flags unpriced lines (a price that disappeared on recheck) and leaves them out of the subtotal', () => {
    const cart = {
      lines: [
        { product: product(), quantity: 2 },
        { product: product({ id: 'p2', price: null }), quantity: 1 },
      ],
    };
    const s = summarize(cart);
    expect(s.subtotalCents).toBe(2500);
    expect(s.unpricedLines).toBe(1);
    expect(s.allPriced).toBe(false);
    expect(lineTotalCents(cart.lines[1])).toBeNull();
  });

  it('counts prescription-only lines', () => {
    const { cart } = addProduct(EMPTY_CART, product({ rxRequired: true }));
    expect(summarize(cart).prescriptionLines).toBe(1);
  });

  it('summarizes an empty cart as zero', () => {
    expect(summarize(EMPTY_CART)).toMatchObject({ lineCount: 0, unitCount: 0, subtotalCents: 0, allPriced: true });
  });
});

describe('helpers', () => {
  it('recognises scanner input as a barcode and names as text', () => {
    expect(looksLikeBarcode('4791000123456')).toBe(true);
    expect(looksLikeBarcode('479-100-0123')).toBe(true);
    expect(looksLikeBarcode('panadol')).toBe(false);
    expect(looksLikeBarcode('123')).toBe(false);
  });

  it('formats cents as LKR with two decimals', () => {
    expect(formatCents(123450)).toBe('LKR 1,234.50');
    expect(formatCents(0)).toBe('LKR 0.00');
  });
});

describe('reconcileCart (restored cart rechecked against current data)', () => {
  const cart = {
    lines: [
      { product: product(), quantity: 5 },
      { product: product({ id: 'p2', name: 'Gone' }), quantity: 1 },
      { product: product({ id: 'p3', name: 'Sold out' }), quantity: 1 },
      { product: product({ id: 'p4', name: 'Unpriced now' }), quantity: 1 },
    ],
  };

  it('uses fresh price and stock, reduces, removes and flags with a notice for each change', () => {
    const fresh = [
      product({ sellableQuantity: 3, price: 13 }),
      product({ id: 'p3', name: 'Sold out', sellableQuantity: 0 }),
      product({ id: 'p4', name: 'Unpriced now', price: null }),
    ];
    const result = reconcileCart(cart, fresh);
    expect(result.cart.lines.map((l) => [l.product.id, l.quantity, l.product.price])).toEqual([
      ['p1', 3, 13],
      ['p4', 1, null],
    ]);
    expect(result.notices.join(' ')).toMatch(/reduced to 3/);
    expect(result.notices.join(' ')).toMatch(/price changed/);
    expect(result.notices.join(' ')).toMatch(/Gone is no longer available/);
    expect(result.notices.join(' ')).toMatch(/Sold out has no sellable stock/);
    expect(result.notices.join(' ')).toMatch(/Unpriced now no longer has a recorded price/);
  });

  it('reports nothing when the data is unchanged', () => {
    const one = { lines: [{ product: product(), quantity: 2 }] };
    expect(reconcileCart(one, [product()]).notices).toEqual([]);
  });
});

describe('stored cart', () => {
  it('round-trips medicines and quantities only', () => {
    const cart = addProduct(EMPTY_CART, product(), 2).cart;
    const raw = serializeCart(cart);
    expect(parseStoredCart(raw)).toEqual(cart);
    expect(raw).not.toMatch(/customer|phone|patient/i);
  });

  it('discards anything malformed instead of partly trusting it', () => {
    for (const raw of [
      null,
      '',
      'not json',
      '{}',
      JSON.stringify({ v: 2, lines: [] }),
      JSON.stringify({ v: 1, lines: [{ product: { id: 'x' }, quantity: 1 }] }),
      JSON.stringify({ v: 1, lines: [{ product: product(), quantity: 0 }] }),
      JSON.stringify({ v: 1, lines: [{ product: product(), quantity: 1.5 }] }),
      JSON.stringify({ v: 1, lines: [{ product: product(), quantity: 1 }, { product: product(), quantity: 1 }] }),
    ]) {
      expect(parseStoredCart(raw)).toBeNull();
    }
  });
});

describe('checkout placeholder text', () => {
  it('states the pending approval and lists the open decisions', () => {
    expect(CHECKOUT_PENDING_MESSAGE).toBe('Checkout is pending accountant approval.');
    expect(CHECKOUT_PENDING_DECISIONS).toEqual([
      'Selling price source',
      'Currency and rounding',
      'Tax',
      'Discounts',
      'Invoice numbering',
      'Payment methods',
      'Cashier shift rules',
    ]);
  });
});
