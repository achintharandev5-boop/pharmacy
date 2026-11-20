import React from 'react';
import { act, configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PosProduct } from '@/lib/pos/cart';
import { CART_STORAGE_KEY, CHECKOUT_PENDING_MESSAGE } from '@/lib/pos/cart';

const api = vi.hoisted(() => ({
  searchPosCatalog: vi.fn(),
  lookupPosBarcode: vi.fn(),
  recheckPosCart: vi.fn(),
  lookupPosCustomers: vi.fn(),
  getCurrentUser: vi.fn(),
  handleLogout: vi.fn(),
}));
vi.mock('@/app/actions/pos', () => ({
  searchPosCatalog: api.searchPosCatalog,
  lookupPosBarcode: api.lookupPosBarcode,
  recheckPosCart: api.recheckPosCart,
  lookupPosCustomers: api.lookupPosCustomers,
}));
vi.mock('@/app/actions/auth', () => ({ getCurrentUser: api.getCurrentUser, handleLogout: api.handleLogout }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { PosWorkstation } from './PosWorkstation';

// The full web suite runs on a loaded machine; allow async UI updates more than the 1 s default.
configure({ asyncUtilTimeout: 5000 });

function product(overrides: Partial<PosProduct> = {}): PosProduct {
  return {
    id: 'p1',
    name: 'Panadol 500mg',
    genericName: 'Paracetamol',
    brandName: 'Panadol',
    strength: '500mg',
    dosageForm: 'Tablet',
    barcode: '4791000123',
    rxRequired: false,
    price: 12.5,
    recordedStock: 50,
    sellableQuantity: 35,
    nearestExpiry: '2099-01-31',
    ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

const searchBox = () => screen.getByRole('textbox', { name: /search medicines or scan/i });
const cartList = () => screen.getByRole('list', { name: 'Cart' });
const subtotal = () => screen.getByTestId('pos-subtotal');

function type(value: string) {
  fireEvent.change(searchBox(), { target: { value } });
}
function enter() {
  fireEvent.keyDown(searchBox(), { key: 'Enter' });
}
function scanCode(code: string) {
  type(code);
  enter();
}

async function renderWithItem(p: PosProduct = product()) {
  api.lookupPosBarcode.mockResolvedValueOnce({ ok: true, data: [p] });
  const view = render(<PosWorkstation />);
  scanCode(p.barcode ?? '4791000123');
  await within(document.body).findByRole('button', { name: `Remove ${p.name}` });
  return view;
}

describe('POS workstation', () => {
  beforeEach(() => {
    for (const fn of Object.values(api)) fn.mockReset();
    api.getCurrentUser.mockResolvedValue({ ok: true, data: { id: 'u1', email: 'cashier@example.test', role: 'cashier' } });
    window.sessionStorage.clear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('layout and checkout placeholder', () => {
    it('starts with the search box focused, an empty cart and checkout pending approval', () => {
      render(<PosWorkstation />);
      expect(searchBox()).toHaveFocus();
      expect(screen.getByText('Cart is empty')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: CHECKOUT_PENDING_MESSAGE })).toBeInTheDocument();
      for (const decision of ['Selling price source', 'Tax', 'Invoice numbering', 'Payment methods', 'Cashier shift rules']) {
        expect(screen.getByText(decision)).toBeInTheDocument();
      }
      expect(subtotal()).toHaveTextContent('LKR 0.00');
    });

    it('offers no payment, invoice or completed-sale control', () => {
      render(<PosWorkstation />);
      expect(screen.queryByRole('button', { name: /pay|checkout|invoice|complete|charge/i })).not.toBeInTheDocument();
    });

    it('shows a cashier no link back to the staff dashboard, but staff get one', async () => {
      const { unmount } = render(<PosWorkstation />);
      expect(await screen.findByText('Cashier')).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Back to dashboard' })).not.toBeInTheDocument();
      unmount();
      api.getCurrentUser.mockResolvedValue({ ok: true, data: { id: 'u2', email: 's@example.test', role: 'staff' } });
      render(<PosWorkstation />);
      expect(await screen.findByRole('link', { name: 'Back to dashboard' })).toHaveAttribute('href', '/admin');
    });

    it('keeps the cart total in reach on small screens', () => {
      render(<PosWorkstation />);
      expect(screen.getByRole('button', { name: /View cart: 0 items, subtotal LKR 0.00/ })).toBeInTheDocument();
    });
  });

  describe('barcode scanning', () => {
    it('adds a scanned product, clears the box and confirms', async () => {
      api.lookupPosBarcode.mockResolvedValue({ ok: true, data: [product()] });
      render(<PosWorkstation />);
      scanCode('4791000123');
      expect(searchBox()).toHaveValue('');
      expect(await screen.findByText('Added Panadol 500mg.')).toBeInTheDocument();
      expect(within(cartList()).getByText('Panadol 500mg')).toBeInTheDocument();
      expect(api.searchPosCatalog).not.toHaveBeenCalled();
      expect(subtotal()).toHaveTextContent('LKR 12.50');
    });

    it('processes one scan once when the scanner sends two Enter events', async () => {
      api.lookupPosBarcode.mockResolvedValue({ ok: true, data: [product()] });
      vi.spyOn(Date, 'now').mockReturnValue(5000);
      render(<PosWorkstation />);
      type('4791000123');
      enter();
      enter();
      await screen.findByText('Added Panadol 500mg.');
      expect(api.lookupPosBarcode).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('textbox', { name: 'Quantity of Panadol 500mg' })).toHaveValue('1');
    });

    it('ignores an auto-repeated Enter key', () => {
      render(<PosWorkstation />);
      type('4791000123');
      fireEvent.keyDown(searchBox(), { key: 'Enter', repeat: true });
      expect(api.lookupPosBarcode).not.toHaveBeenCalled();
    });

    it('counts deliberate repeat scans of the same pack', async () => {
      api.lookupPosBarcode.mockResolvedValue({ ok: true, data: [product()] });
      const now = vi.spyOn(Date, 'now');
      render(<PosWorkstation />);
      now.mockReturnValue(1000);
      scanCode('4791000123');
      await screen.findByText('Added Panadol 500mg.');
      now.mockReturnValue(2500);
      scanCode('4791000123');
      expect(await screen.findByText('Added Panadol 500mg (now 2 in cart).')).toBeInTheDocument();
      expect(api.lookupPosBarcode).toHaveBeenCalledTimes(2);
    });

    it('keeps every item when rapid scans resolve out of order', async () => {
      const first = deferred<unknown>();
      const second = deferred<unknown>();
      const third = deferred<unknown>();
      api.lookupPosBarcode
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise)
        .mockReturnValueOnce(third.promise);
      render(<PosWorkstation />);
      scanCode('4791000123');
      scanCode('4792000456');
      scanCode('4793000789');
      await act(async () => second.resolve({ ok: true, data: [product({ id: 'p2', name: 'Amoxil 250', price: 40 })] }));
      await act(async () => third.resolve({ ok: true, data: [product({ id: 'p3', name: 'Cetirizine', price: 7.5 })] }));
      await act(async () => first.resolve({ ok: true, data: [product()] }));
      for (const name of ['Panadol 500mg', 'Amoxil 250', 'Cetirizine']) {
        expect(within(cartList()).getByText(name)).toBeInTheDocument();
      }
      expect(subtotal()).toHaveTextContent('LKR 60.00');
    });

    it('reports an unknown barcode and adds nothing', async () => {
      api.lookupPosBarcode.mockResolvedValue({ ok: true, data: [] });
      render(<PosWorkstation />);
      scanCode('000000999');
      expect(await screen.findByText(/Barcode 000000999 is not registered.*Nothing was added/)).toBeInTheDocument();
      expect(screen.getByText('Cart is empty')).toBeInTheDocument();
    });

    it.each([
      ['out of stock', { sellableQuantity: 0 }, /has no sellable stock/],
      ['without a price', { price: null }, /has no recorded selling price and cannot be added/],
    ])('shows but never adds a scanned product %s', async (_label, overrides, message) => {
      api.lookupPosBarcode.mockResolvedValue({ ok: true, data: [product(overrides)] });
      render(<PosWorkstation />);
      scanCode('4791000123');
      expect(await screen.findByText(message)).toBeInTheDocument();
      expect(screen.getByText('Cart is empty')).toBeInTheDocument();
    });

    it('reports a lookup failure without adding anything', async () => {
      api.lookupPosBarcode.mockResolvedValue({ ok: false, error: 'The database did not respond.' });
      render(<PosWorkstation />);
      scanCode('4791000123');
      expect(await screen.findByText(/Barcode 4791000123 could not be looked up/)).toBeInTheDocument();
      expect(screen.getByText('Cart is empty')).toBeInTheDocument();
    });

    it('sends typing to the search box when no field has focus, so a scan always lands there', () => {
      render(<PosWorkstation />);
      searchBox().blur();
      for (const key of '479') fireEvent.keyDown(document.body, { key });
      expect(searchBox()).toHaveValue('479');
      expect(searchBox()).toHaveFocus();
    });
  });

  describe('name search', () => {
    it('shows only the latest search when responses arrive out of order', async () => {
      const slow = deferred<unknown>();
      const fast = deferred<unknown>();
      api.searchPosCatalog.mockReturnValueOnce(slow.promise).mockReturnValueOnce(fast.promise);
      render(<PosWorkstation />);
      type('pan');
      enter();
      type('amox');
      enter();
      await act(async () => fast.resolve({ ok: true, data: [product({ id: 'p2', name: 'Amoxil 250' })] }));
      await act(async () => slow.resolve({ ok: true, data: [product()] }));
      expect(screen.getByRole('button', { name: 'Add Amoxil 250' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Add Panadol 500mg' })).not.toBeInTheDocument();
    });

    it('shows name, generic, brand, barcode, price and sellable stock, and adds when tapped', async () => {
      api.searchPosCatalog.mockResolvedValue({ ok: true, data: [product({ brandName: 'GSK Panadol' })] });
      render(<PosWorkstation />);
      type('pana');
      enter();
      const row = await screen.findByRole('button', { name: 'Add Panadol 500mg' });
      expect(row).toHaveTextContent('Paracetamol');
      expect(row).toHaveTextContent('Brand: GSK Panadol');
      expect(row).toHaveTextContent('4791000123');
      expect(row).toHaveTextContent('LKR 12.50');
      expect(row).toHaveTextContent('35 sellable');
      fireEvent.click(row);
      expect(within(cartList()).getByText('Panadol 500mg')).toBeInTheDocument();
    });

    it('marks out-of-stock, unpriced and prescription-only medicines and explains instead of adding', async () => {
      api.searchPosCatalog.mockResolvedValue({
        ok: true,
        data: [
          product({ id: 'a', name: 'Sold Out', sellableQuantity: 0 }),
          product({ id: 'b', name: 'No Price', price: null }),
          product({ id: 'c', name: 'Rx Item', rxRequired: true }),
        ],
      });
      render(<PosWorkstation />);
      type('x1');
      enter();
      const soldOut = await screen.findByRole('button', { name: 'Sold Out, out of stock' });
      expect(soldOut).toHaveAttribute('aria-disabled', 'true');
      fireEvent.click(soldOut);
      expect(screen.getByText(/Sold Out has no sellable stock/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'No Price, no price recorded' }));
      expect(screen.getByText(/No Price has no recorded selling price/)).toBeInTheDocument();
      expect(screen.getByText('Cart is empty')).toBeInTheDocument();
      const rx = screen.getByRole('button', { name: 'Add Rx Item' });
      expect(rx).toHaveTextContent('Prescription only');
    });

    it('submits a name search once when Enter precedes the type-ahead delay', async () => {
      api.searchPosCatalog.mockResolvedValue({ ok: true, data: [product()] });
      render(<PosWorkstation />);
      type('pana');
      enter();
      expect(await screen.findByRole('button', { name: 'Add Panadol 500mg' })).toBeInTheDocument();
      await act(async () => { await new Promise(resolve => setTimeout(resolve, 350)); });
      expect(api.searchPosCatalog).toHaveBeenCalledTimes(1);
    });

    it('shows a search failure as an error with Retry, never as an empty list', async () => {
      api.searchPosCatalog.mockResolvedValueOnce({ ok: false, error: 'The database did not respond.' });
      render(<PosWorkstation />);
      type('pana');
      enter();
      expect(await screen.findByText('The database did not respond.')).toBeInTheDocument();
      expect(screen.queryByText('No medicines found')).not.toBeInTheDocument();
      api.searchPosCatalog.mockResolvedValueOnce({ ok: true, data: [product()] });
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
      expect(await screen.findByRole('button', { name: 'Add Panadol 500mg' })).toBeInTheDocument();
    });

    it('shows a loading state, then the empty state when nothing matches', async () => {
      const pending = deferred<unknown>();
      api.searchPosCatalog.mockReturnValue(pending.promise);
      render(<PosWorkstation />);
      type('zzz');
      enter();
      expect(screen.getByText('Searching medicines…')).toBeInTheDocument();
      await act(async () => pending.resolve({ ok: true, data: [] }));
      expect(screen.getByText('No medicines found')).toBeInTheDocument();
    });

    it('clears the search with Escape or the clear button', async () => {
      api.searchPosCatalog.mockResolvedValue({ ok: true, data: [product()] });
      render(<PosWorkstation />);
      type('pana');
      enter();
      await screen.findByRole('button', { name: 'Add Panadol 500mg' });
      fireEvent.keyDown(searchBox(), { key: 'Escape' });
      expect(searchBox()).toHaveValue('');
      expect(screen.getByText('Search or scan to add medicines')).toBeInTheDocument();
      type('pana');
      fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
      expect(searchBox()).toHaveValue('');
    });
  });

  describe('cart', () => {
    it('increases and decreases quantity; decrease stops at 1 and only Remove takes a line out', async () => {
      await renderWithItem(product({ sellableQuantity: 3 }));
      const qty = () => screen.getByRole('textbox', { name: 'Quantity of Panadol 500mg' });
      expect(screen.getByRole('button', { name: 'Decrease Panadol 500mg' })).toBeDisabled();
      fireEvent.click(screen.getByRole('button', { name: 'Increase Panadol 500mg' }));
      fireEvent.click(screen.getByRole('button', { name: 'Increase Panadol 500mg' }));
      expect(qty()).toHaveValue('3');
      expect(screen.getByRole('button', { name: 'Increase Panadol 500mg' })).toBeDisabled();
      expect(screen.getByText('All sellable stock in cart')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Decrease Panadol 500mg' }));
      expect(qty()).toHaveValue('2');
      expect(subtotal()).toHaveTextContent('LKR 25.00');
      fireEvent.click(screen.getByRole('button', { name: 'Remove Panadol 500mg' }));
      expect(screen.getByText('Cart is empty')).toBeInTheDocument();
    });

    it('applies a typed quantity on Enter and caps it at sellable stock', async () => {
      await renderWithItem(product({ sellableQuantity: 8 }));
      const qty = () => screen.getByRole('textbox', { name: 'Quantity of Panadol 500mg' });
      fireEvent.change(qty(), { target: { value: '6' } });
      fireEvent.keyDown(qty(), { key: 'Enter' });
      expect(qty()).toHaveValue('6');
      fireEvent.change(qty(), { target: { value: '20' } });
      fireEvent.blur(qty());
      expect(qty()).toHaveValue('8');
      expect(screen.getByText(/Only 8 unit/)).toBeInTheDocument();
    });

    it('never removes a line because of a typed 0 or an empty field', async () => {
      await renderWithItem();
      const qty = () => screen.getByRole('textbox', { name: 'Quantity of Panadol 500mg' });
      fireEvent.change(qty(), { target: { value: '0' } });
      fireEvent.keyDown(qty(), { key: 'Enter' });
      expect(qty()).toHaveValue('1');
      expect(screen.getByText(/To take it out, use Remove/)).toBeInTheDocument();
      fireEvent.change(qty(), { target: { value: '' } });
      fireEvent.blur(qty());
      expect(qty()).toHaveValue('1');
    });

    it('clears with F9 only after confirmation, and Cancel keeps the cart', async () => {
      await renderWithItem();
      fireEvent.keyDown(window, { key: 'F9' });
      let dialog = await screen.findByRole('dialog', { name: 'Clear the cart?' });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
      expect(within(cartList()).getByText('Panadol 500mg')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
      dialog = await screen.findByRole('dialog', { name: 'Clear the cart?' });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Clear cart' }));
      expect(screen.getByText('Cart is empty')).toBeInTheDocument();
      expect(window.sessionStorage.getItem(CART_STORAGE_KEY)).toBeNull();
    });

    it('keeps the cart for this tab without the customer, and rechecks it on return', async () => {
      api.lookupPosCustomers.mockResolvedValue({
        ok: true,
        data: [{ id: 'c1', name: 'Test Patient', phoneLast4: '4567', registeredOn: '2026-01-05' }],
      });
      const view = await renderWithItem(product({ sellableQuantity: 10 }));
      fireEvent.click(screen.getByRole('button', { name: 'Increase Panadol 500mg' }));
      fireEvent.keyDown(window, { key: 'F4' });
      const dialog = await screen.findByRole('dialog', { name: 'Customer' });
      fireEvent.change(within(dialog).getByRole('textbox', { name: 'Phone number' }), { target: { value: '0771234567' } });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Search' }));
      fireEvent.click(await within(dialog).findByRole('button', { name: /Test Patient/ }));

      const stored = window.sessionStorage.getItem(CART_STORAGE_KEY) ?? '';
      expect(stored).toContain('Panadol 500mg');
      expect(stored).not.toContain('Test Patient');
      expect(stored).not.toContain('4567');

      api.recheckPosCart.mockResolvedValue({ ok: true, data: [product({ sellableQuantity: 1 })] });
      view.unmount();
      render(<PosWorkstation />);
      expect(await screen.findByText(/Cart restored and rechecked.*reduced to 1/)).toBeInTheDocument();
      expect(api.recheckPosCart).toHaveBeenCalledWith(['p1']);
      expect(screen.getByRole('textbox', { name: 'Quantity of Panadol 500mg' })).toHaveValue('1');
      expect(screen.getByRole('button', { name: 'Choose customer (F4)' })).toHaveTextContent('Walk-in customer');
    });

    it('keeps a restored cart but says so when the recheck fails', async () => {
      window.sessionStorage.setItem(
        CART_STORAGE_KEY,
        JSON.stringify({ v: 1, lines: [{ product: product(), quantity: 2 }] }),
      );
      api.recheckPosCart.mockResolvedValue({ ok: false, error: 'Could not reach the pharmacy server.' });
      render(<PosWorkstation />);
      expect(await screen.findByText(/price and stock could not be rechecked/)).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: 'Quantity of Panadol 500mg' })).toHaveValue('2');
    });

    it('asks before the page is closed or reloaded with items in the cart', async () => {
      await renderWithItem();
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
    });
  });

  describe('customer', () => {
    it('requires 7 digits before looking anyone up', async () => {
      render(<PosWorkstation />);
      fireEvent.keyDown(window, { key: 'F4' });
      const dialog = await screen.findByRole('dialog', { name: 'Customer' });
      fireEvent.change(within(dialog).getByRole('textbox', { name: 'Phone number' }), { target: { value: '077 12' } });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Search' }));
      expect(within(dialog).getByText('Enter at least 7 digits of the phone number.')).toBeInTheDocument();
      expect(api.lookupPosCustomers).not.toHaveBeenCalled();
    });

    it('shows a masked number, warns about duplicate names, and returns to walk-in', async () => {
      api.lookupPosCustomers.mockResolvedValue({
        ok: true,
        data: [
          { id: 'c1', name: 'Test Patient', phoneLast4: '4567', registeredOn: '2026-01-05' },
          { id: 'c2', name: 'Test Patient', phoneLast4: '4567', registeredOn: '2026-03-01' },
        ],
      });
      render(<PosWorkstation />);
      fireEvent.click(screen.getByRole('button', { name: 'Choose customer (F4)' }));
      const dialog = await screen.findByRole('dialog', { name: 'Customer' });
      fireEvent.change(within(dialog).getByRole('textbox', { name: 'Phone number' }), { target: { value: '0771234567' } });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Search' }));
      expect(await within(dialog).findByText(/More than one patient has the same name/)).toBeInTheDocument();
      expect(within(dialog).queryByText('0771234567')).not.toBeInTheDocument();
      const options = within(dialog).getAllByRole('button', { name: /Test Patient/ });
      expect(options[1]).toHaveTextContent('••• 4567');
      expect(options[1]).toHaveTextContent('registered 01 Mar 2026');
      fireEvent.click(options[1]);
      expect(screen.getByRole('button', { name: /Customer: Test Patient/ })).toHaveTextContent('Test Patient · ••• 4567');
      fireEvent.click(screen.getByRole('button', { name: 'Remove customer' }));
      expect(screen.getByRole('button', { name: 'Choose customer (F4)' })).toHaveTextContent('Walk-in customer');
    });

    it('shows no match and lookup errors clearly', async () => {
      api.lookupPosCustomers
        .mockResolvedValueOnce({ ok: true, data: [] })
        .mockResolvedValueOnce({ ok: false, error: 'You do not have permission to perform this action.' });
      render(<PosWorkstation />);
      fireEvent.keyDown(window, { key: 'F4' });
      const dialog = await screen.findByRole('dialog', { name: 'Customer' });
      fireEvent.change(within(dialog).getByRole('textbox', { name: 'Phone number' }), { target: { value: '0700000000' } });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Search' }));
      expect(await within(dialog).findByText('No registered patient with this number')).toBeInTheDocument();
      fireEvent.click(within(dialog).getByRole('button', { name: 'Search' }));
      expect(await within(dialog).findByText('You do not have permission to perform this action.')).toBeInTheDocument();
    });
  });

  describe('keyboard', () => {
    it('focuses the search box with F2', () => {
      render(<PosWorkstation />);
      screen.getByRole('button', { name: 'Choose customer (F4)' }).focus();
      fireEvent.keyDown(window, { key: 'F2' });
      expect(searchBox()).toHaveFocus();
    });

    it('does not run shortcuts while a dialog is open', async () => {
      await renderWithItem();
      fireEvent.keyDown(window, { key: 'F4' });
      await screen.findByRole('dialog', { name: 'Customer' });
      fireEvent.keyDown(window, { key: 'F9' });
      expect(screen.queryByRole('dialog', { name: 'Clear the cart?' })).not.toBeInTheDocument();
    });
  });

  it('clears the kept cart when signing out', async () => {
    await renderWithItem();
    expect(window.sessionStorage.getItem(CART_STORAGE_KEY)).not.toBeNull();
    const form = screen.getByRole('button', { name: 'Sign out' }).closest('form') as HTMLFormElement;
    fireEvent.submit(form);
    await waitFor(() => expect(window.sessionStorage.getItem(CART_STORAGE_KEY)).toBeNull());
  });
});
