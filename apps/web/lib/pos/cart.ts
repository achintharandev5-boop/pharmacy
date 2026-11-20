/**
 * Point-of-sale cart (Milestone 1). Pure functions, no I/O.
 *
 * Money is held in integer cents so sums are exact. Only prices recorded in the database are
 * used. An item without a usable recorded price, or without sellable stock, is never added; a
 * line whose price disappears on a recheck stays flagged as unpriced and is never given a
 * default price. No discount, tax or rounding rule is applied: those wait for the
 * accountant's decisions (PHARMACY_POS_IMPLEMENTATION_PLAN.md §4, D-02 to D-04). The server
 * will recalculate everything at checkout; these totals are a display aid.
 */

/** A medicine as returned by GET /pos/catalog. */
export interface PosProduct {
  id: string;
  name: string;
  genericName: string | null;
  brandName: string | null;
  strength: string | null;
  dosageForm: string | null;
  barcode: string | null;
  rxRequired: boolean;
  price: number | null;
  recordedStock: number;
  sellableQuantity: number;
  nearestExpiry: string | null;
  batches?: { id: string; batchNumber: string; expiryDate: string; quantityAvailable: number }[];
}

export interface CartLine {
  product: PosProduct;
  quantity: number;
}

export interface Cart {
  lines: CartLine[];
}

export interface CartChange {
  cart: Cart;
  /** Explains why the request was limited or refused; absent when it applied in full. */
  notice?: string;
}

export interface CartSummary {
  lineCount: number;
  unitCount: number;
  /** Sum of priced lines only. */
  subtotalCents: number;
  unpricedLines: number;
  prescriptionLines: number;
  /** True when every line has a usable recorded price. */
  allPriced: boolean;
}

export const EMPTY_CART: Cart = { lines: [] };

/** Largest quantity accepted on one line, to catch a mistyped or scanned-twice number. */
export const MAX_LINE_QUANTITY = 9999;

/**
 * Converts a recorded price to cents. A price that is negative, not finite or has more than two
 * decimal places is treated as unusable rather than rounded, because no rounding rule is approved.
 */
export function priceToCents(price: number | null | undefined): number | null {
  if (price === null || price === undefined || !Number.isFinite(price) || price < 0) return null;
  const cents = Math.round(price * 100);
  return Math.abs(cents - price * 100) < 1e-6 ? cents : null;
}

export function lineTotalCents(line: CartLine): number | null {
  const unit = priceToCents(line.product.price);
  return unit === null ? null : unit * line.quantity;
}

function limitFor(product: PosProduct): number {
  return Math.min(MAX_LINE_QUANTITY, Math.max(0, Math.floor(product.sellableQuantity)));
}

function priceNotice(product: PosProduct): string {
  return `${product.name} has no recorded selling price and cannot be added. Record a retail price first.`;
}

function stockNotice(product: PosProduct, limit: number): string {
  return limit === 0
    ? `${product.name} has no sellable stock.`
    : `Only ${limit} unit(s) of ${product.name} can be sold.`;
}

/** Adds a product, or increases its quantity when it is already in the cart. */
export function addProduct(cart: Cart, product: PosProduct, quantity = 1): CartChange {
  const limit = limitFor(product);
  const existing = cart.lines.find((l) => l.product.id === product.id);
  const wanted = (existing?.quantity ?? 0) + quantity;

  if (limit === 0) return { cart, notice: stockNotice(product, 0) };
  if (priceToCents(product.price) === null) return { cart, notice: priceNotice(product) };
  const next = Math.min(wanted, limit);
  const notice = next < wanted ? stockNotice(product, limit) : undefined;

  if (existing) {
    if (next === existing.quantity) return { cart, notice };
    return {
      cart: { lines: cart.lines.map((l) => (l.product.id === product.id ? { product, quantity: next } : l)) },
      notice,
    };
  }
  return { cart: { lines: [...cart.lines, { product, quantity: next }] }, notice };
}

/** Sets a line's quantity. Whole units only; 0 or less removes the line. */
export function setQuantity(cart: Cart, productId: string, quantity: number): CartChange {
  const line = cart.lines.find((l) => l.product.id === productId);
  if (!line) return { cart };
  if (!Number.isFinite(quantity)) return { cart, notice: 'Enter a whole number of units.' };
  const whole = Math.floor(quantity);
  if (whole !== quantity) return { cart, notice: 'Enter a whole number of units.' };
  if (whole <= 0) return removeLine(cart, productId);

  const limit = limitFor(line.product);
  const next = Math.min(whole, limit);
  const notice = next < whole ? stockNotice(line.product, limit) : undefined;
  if (next === 0) return { cart, notice };
  return {
    cart: { lines: cart.lines.map((l) => (l.product.id === productId ? { ...l, quantity: next } : l)) },
    notice,
  };
}

export function removeLine(cart: Cart, productId: string): CartChange {
  return { cart: { lines: cart.lines.filter((l) => l.product.id !== productId) } };
}

export function summarize(cart: Cart): CartSummary {
  let subtotalCents = 0;
  let unpricedLines = 0;
  let unitCount = 0;
  let prescriptionLines = 0;
  for (const line of cart.lines) {
    unitCount += line.quantity;
    if (line.product.rxRequired) prescriptionLines++;
    const total = lineTotalCents(line);
    if (total === null) unpricedLines++;
    else subtotalCents += total;
  }
  return {
    lineCount: cart.lines.length,
    unitCount,
    subtotalCents,
    unpricedLines,
    prescriptionLines,
    allPriced: unpricedLines === 0,
  };
}

/** A scanner sends digits (sometimes with dashes) followed by Enter. */
export function looksLikeBarcode(input: string): boolean {
  return /^[0-9][0-9-]{5,63}$/.test(input.trim());
}

export function formatCents(cents: number): string {
  return `LKR ${(cents / 100).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Applies fresh catalogue data to a cart (after a reload or a return to the page). Prices and
 * stock come from the fresh rows; a quantity above the new sellable stock is reduced; a medicine
 * that is no longer listed (inactive or removed) or no longer sellable is taken out. A line whose
 * price is now missing stays, flagged as unpriced, so the cashier sees it.
 */
export function reconcileCart(cart: Cart, fresh: PosProduct[]): { cart: Cart; notices: string[] } {
  const byId = new Map(fresh.map((p) => [p.id, p]));
  const notices: string[] = [];
  const lines: CartLine[] = [];
  for (const line of cart.lines) {
    const product = byId.get(line.product.id);
    if (!product) {
      notices.push(`${line.product.name} is no longer available and was removed.`);
      continue;
    }
    const limit = limitFor(product);
    if (limit === 0) {
      notices.push(`${product.name} has no sellable stock now and was removed.`);
      continue;
    }
    if (line.quantity > limit) notices.push(`${product.name} reduced to ${limit}: only ${limit} unit(s) can be sold now.`);
    if (priceToCents(product.price) === null) notices.push(`${product.name} no longer has a recorded price.`);
    else if (priceToCents(line.product.price) !== priceToCents(product.price)) {
      notices.push(`${product.name}: recorded price changed.`);
    }
    lines.push({ product, quantity: Math.min(line.quantity, limit) });
  }
  return { cart: { lines }, notices };
}

/** Browser-session key for the cart. Holds medicines and quantities only, never the customer. */
export const CART_STORAGE_KEY = 'pos.cart.v1';

export function serializeCart(cart: Cart): string {
  return JSON.stringify({ v: 1, lines: cart.lines.map((l) => ({ product: l.product, quantity: l.quantity })) });
}

function isProduct(value: unknown): value is PosProduct {
  if (!value || typeof value !== 'object') return false;
  const p = value as Record<string, unknown>;
  return (
    typeof p.id === 'string' &&
    typeof p.name === 'string' &&
    (p.price === null || typeof p.price === 'number') &&
    typeof p.sellableQuantity === 'number' &&
    typeof p.rxRequired === 'boolean'
  );
}

/** Reads a stored cart. Anything malformed is discarded rather than partly trusted. */
export function parseStoredCart(raw: string | null): Cart | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as { v?: unknown; lines?: unknown };
    if (data.v !== 1 || !Array.isArray(data.lines)) return null;
    const lines: CartLine[] = [];
    for (const item of data.lines as { product?: unknown; quantity?: unknown }[]) {
      if (!isProduct(item.product)) return null;
      const quantity = item.quantity;
      if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_LINE_QUANTITY) return null;
      if (lines.some((l) => l.product.id === (item.product as PosProduct).id)) return null;
      lines.push({ product: item.product, quantity });
    }
    return { lines };
  } catch {
    return null;
  }
}

/** Why checkout is unavailable, and what the accountant still has to decide. */
export const CHECKOUT_PENDING_MESSAGE = 'Checkout is pending accountant approval.';
export const CHECKOUT_PENDING_DECISIONS: readonly string[] = [
  'Selling price source',
  'Currency and rounding',
  'Tax',
  'Discounts',
  'Invoice numbering',
  'Payment methods',
  'Cashier shift rules',
];
