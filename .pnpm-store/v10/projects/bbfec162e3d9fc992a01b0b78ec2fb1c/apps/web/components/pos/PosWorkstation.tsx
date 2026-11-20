'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Info, LogOut, Search, ShoppingCart, Trash2, UserRound, X } from 'lucide-react';
import { ThemeSwitcher } from '@/components/ui/ThemeSwitcher';
import { Alert, Button, Card, ConfirmDialog, IconButton, Input } from '@/components/ui';
import { lookupPosBarcode, recheckPosCart, searchPosCatalog } from '@/app/actions/pos';
import { getCurrentUser, handleLogout, type CurrentUser } from '@/app/actions/auth';
import { NETWORK_ERROR_MESSAGE } from '@/lib/api/types';
import { useApiQuery } from '@/lib/useApiQuery';
import { ROLE_LABEL, isStaffRole } from '@/lib/roles';
import {
  addProduct,
  CART_STORAGE_KEY,
  CHECKOUT_PENDING_DECISIONS,
  CHECKOUT_PENDING_MESSAGE,
  EMPTY_CART,
  formatCents,
  looksLikeBarcode,
  parseStoredCart,
  reconcileCart,
  removeLine,
  serializeCart,
  setQuantity,
  summarize,
  type Cart,
  type CartChange,
  type PosProduct,
} from '@/lib/pos/cart';
import { createScanGate } from '@/lib/pos/scanner';
import { PosCatalogResults, type CatalogState } from './PosCatalogResults';
import { PosCart } from './PosCart';
import { PosCustomerDialog, maskedPhone, type PosCustomer } from './PosCustomerDialog';

const SEARCH_DELAY_MS = 250;

type Notice = { tone: 'warning' | 'danger' | 'success' | 'info'; text: string };

function readStoredCart(): Cart | null {
  try {
    return parseStoredCart(window.sessionStorage.getItem(CART_STORAGE_KEY));
  } catch {
    return null;
  }
}

function storeCart(cart: Cart) {
  try {
    if (cart.lines.length === 0) window.sessionStorage.removeItem(CART_STORAGE_KEY);
    else window.sessionStorage.setItem(CART_STORAGE_KEY, serializeCart(cart));
  } catch {
    // Storage unavailable (private mode, quota): the cart simply is not kept across pages.
  }
}

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/**
 * Point-of-sale workstation (Milestones 1 and 1.5): catalogue search, barcode scanning, cart and
 * customer. It never records a sale, takes payment or changes stock; checkout is pending the
 * accountant's decisions.
 *
 * Shortcuts: F2 search · F4 customer · F9 clear cart · Esc clears the search box. Typing while no
 * field has focus goes to the search box, so a keyboard-wedge scanner always lands there.
 *
 * The cart (medicines and quantities only, never the customer) is kept in this browser tab's
 * session storage so it survives moving between pages, and is rechecked against current price and
 * stock when it is restored.
 */
export function PosWorkstation() {
  const [term, setTerm] = useState('');
  const [catalog, setCatalog] = useState<CatalogState>({ status: 'idle' });
  const [cart, setCart] = useState<Cart>(EMPTY_CART);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [customer, setCustomer] = useState<PosCustomer | null>(null);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const me = useApiQuery<CurrentUser>(() => getCurrentUser(), []);
  const role = me.status === 'success' ? me.data.role : null;

  const searchRef = useRef<HTMLInputElement>(null);
  const cartRef = useRef<HTMLElement>(null);
  // The cart as of the last change, so a scan that resolves late adds to the current cart.
  const cartState = useRef<Cart>(EMPTY_CART);
  // Only the latest request may update the results; an older, slower response is not shown.
  const requestId = useRef(0);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scanGate = useRef(createScanGate());
  const restored = useRef(false);

  const commit = useCallback((next: Cart) => {
    cartState.current = next;
    setCart(next);
    storeCart(next);
  }, []);

  const apply = useCallback(
    (change: CartChange, added?: PosProduct) => {
      commit(change.cart);
      if (change.notice) setNotice({ tone: 'warning', text: change.notice });
      else if (added) {
        const qty = change.cart.lines.find((l) => l.product.id === added.id)?.quantity ?? 0;
        setNotice({ tone: 'success', text: `Added ${added.name}${qty > 1 ? ` (now ${qty} in cart)` : ''}.` });
      } else setNotice(null);
    },
    [commit],
  );

  const add = useCallback((product: PosProduct) => apply(addProduct(cartState.current, product), product), [apply]);

  // Restore the cart kept for this tab. It is shown once price and stock have been rechecked, so
  // stale prices are never displayed; if the recheck fails it is shown as stored, with a warning.
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const stored = readStoredCart();
    if (!stored || stored.lines.length === 0) return;
    void (async () => {
      let res: Awaited<ReturnType<typeof recheckPosCart>>;
      try {
        res = await recheckPosCart(stored.lines.map((l) => l.product.id));
      } catch {
        res = { ok: false, error: NETWORK_ERROR_MESSAGE };
      }
      // Anything added while the recheck was running is kept alongside the restored lines.
      const merged = cartState.current.lines.reduce<Cart>(
        (acc, line) => (acc.lines.some((l) => l.product.id === line.product.id) ? acc : { lines: [...acc.lines, line] }),
        stored,
      );
      if (!res.ok) {
        commit(merged);
        setNotice({ tone: 'warning', text: `Cart restored, but price and stock could not be rechecked: ${res.error}` });
        return;
      }
      const result = reconcileCart(merged, [
        ...res.data,
        ...cartState.current.lines.map((l) => l.product).filter((p) => !res.data.some((f) => f.id === p.id)),
      ]);
      commit(result.cart);
      setNotice(
        result.notices.length > 0
          ? { tone: 'warning', text: `Cart restored and rechecked. ${result.notices.join(' ')}` }
          : { tone: 'info', text: 'Cart restored. Prices and stock rechecked.' },
      );
    })();
  }, [commit]);

  // Leaving the page with items in the cart asks first (a reload keeps the cart; closing the tab does not).
  useEffect(() => {
    if (cart.lines.length === 0) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [cart.lines.length]);

  const runSearch = useCallback(async (value: string) => {
    // An explicit search replaces the queued type-ahead request.
    if (searchTimer.current !== null) clearTimeout(searchTimer.current);
    searchTimer.current = null;
    const q = value.trim();
    const id = ++requestId.current;
    if (!q) {
      setCatalog({ status: 'idle' });
      return;
    }
    setCatalog({ status: 'loading' });
    let res: Awaited<ReturnType<typeof searchPosCatalog>>;
    try {
      res = await searchPosCatalog(q);
    } catch {
      res = { ok: false, error: NETWORK_ERROR_MESSAGE };
    }
    if (id !== requestId.current) return;
    setCatalog(res.ok ? { status: 'success', term: q, data: res.data } : { status: 'error', message: res.error });
  }, []);

  /**
   * Looks up a scanned code. The box is cleared at once so the next scan can start; every scan's
   * result is applied to the cart even if a later scan has already replaced the results list. A
   * medicine that is out of stock or has no price is shown but never added.
   */
  const scan = useCallback(
    async (code: string) => {
      setTerm('');
      const id = ++requestId.current;
      setCatalog({ status: 'loading' });
      let res: Awaited<ReturnType<typeof lookupPosBarcode>>;
      try {
        res = await lookupPosBarcode(code);
      } catch {
        res = { ok: false, error: NETWORK_ERROR_MESSAGE };
      }
      const latest = id === requestId.current;
      if (!res.ok) {
        if (latest) setCatalog({ status: 'error', message: res.error });
        setNotice({ tone: 'danger', text: `Barcode ${code} could not be looked up: ${res.error}` });
        return;
      }
      if (latest) setCatalog({ status: 'success', term: code, data: res.data });
      if (res.data.length === 1) add(res.data[0]);
      else if (res.data.length === 0) setNotice({ tone: 'danger', text: `Barcode ${code} is not registered to an active medicine. Nothing was added.` });
    },
    [add],
  );

  // Type-ahead for names. Barcodes wait for Enter so a scan is looked up once, exactly.
  useEffect(() => {
    const q = term.trim();
    if (q.length < 2 || looksLikeBarcode(q)) return;
    searchTimer.current = setTimeout(() => { searchTimer.current = null; void runSearch(q); }, SEARCH_DELAY_MS);
    return () => { if (searchTimer.current !== null) clearTimeout(searchTimer.current); searchTimer.current = null; };
  }, [term, runSearch]);

  const onSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Read the field itself: two Enter events from one scan can arrive before React re-renders.
      const q = e.currentTarget.value.trim();
      if (!q) return;
      if (looksLikeBarcode(q)) {
        if (scanGate.current.accept(q, Date.now(), e.repeat)) void scan(q);
      } else if (catalog.status === 'success' && catalog.term === q && catalog.data.length === 1) add(catalog.data[0]);
      else void runSearch(q);
    } else if (e.key === 'Escape') {
      setTerm('');
      requestId.current++;
      setCatalog({ status: 'idle' });
    }
  };

  const focusSearch = () => {
    searchRef.current?.focus();
    searchRef.current?.select();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (customerOpen || confirmClear) return;
      if (e.key === 'F2') {
        e.preventDefault();
        focusSearch();
      } else if (e.key === 'F4') {
        e.preventDefault();
        setCustomerOpen(true);
      } else if (e.key === 'F9') {
        e.preventDefault();
        if (cartState.current.lines.length > 0) setConfirmClear(true);
      } else if (
        e.key.length === 1 &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        !isEditable(e.target) &&
        !(e.target instanceof HTMLButtonElement && e.key === ' ')
      ) {
        // A scanner (or a person) typing with no field focused: send the keystrokes to the search box.
        e.preventDefault();
        setTerm((t) => t + e.key);
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [customerOpen, confirmClear]);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const summary = summarize(cart);
  const staff = isStaffRole(role);

  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <header className="sticky top-0 z-30 border-b border-border bg-page">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 sm:px-4">
          {staff ? (
            <Link
              href="/admin"
              aria-label="Back to dashboard"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-ui text-muted hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <ArrowLeft size={20} aria-hidden="true" />
            </Link>
          ) : (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-ui bg-primary font-serif font-bold italic text-[var(--color-on-solid)]" aria-hidden="true">
              ℞
            </span>
          )}
          <h1 className="text-lg font-semibold text-fg">Point of sale</h1>
          <span className="hidden text-xs text-subtle xl:inline">F2 search · F4 customer · F9 clear cart</span>
          <div className="ml-auto flex items-center gap-2">
            <ThemeSwitcher iconOnly />
            <span className="hidden max-w-[220px] truncate text-right text-xs text-subtle md:block">
              {me.status === 'success' ? (
                <>
                  <span className="block truncate text-sm font-medium text-fg">{me.data.email ?? 'Signed in'}</span>
                  {role ? ROLE_LABEL[role] : 'No role assigned'}
                </>
              ) : me.status === 'error' ? (
                'Account unavailable'
              ) : null}
            </span>
            <form action={handleLogout} onSubmit={() => storeCart(EMPTY_CART)}>
              <Button type="submit" variant="ghost" size="lg" icon={LogOut} aria-label="Sign out" className="px-3">
                <span className="hidden sm:inline">Sign out</span>
              </Button>
            </form>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-border px-3 py-2 sm:px-4">
          <Button
            size="lg"
            icon={UserRound}
            onClick={() => setCustomerOpen(true)}
            aria-label={customer ? `Customer: ${customer.name}. Change customer (F4)` : 'Choose customer (F4)'}
            className="min-w-0 max-w-full justify-start"
          >
            <span className="truncate">{customer ? `${customer.name} · ${maskedPhone(customer.phoneLast4)}` : 'Walk-in customer'}</span>
          </Button>
          {customer && <IconButton icon={X} label="Remove customer" size="lg" onClick={() => setCustomer(null)} />}
        </div>
      </header>

      <main className="grid flex-1 gap-3 p-3 pb-24 sm:gap-4 sm:p-4 sm:pb-24 lg:grid-cols-[minmax(0,1fr)_minmax(360px,420px)] lg:pb-4 xl:grid-cols-[minmax(0,1fr)_minmax(400px,480px)]">
        <Card className="flex min-h-[320px] min-w-0 flex-col overflow-hidden lg:max-h-[calc(100dvh-9rem)]">
          <div className="border-b border-border p-3">
            <label htmlFor="pos-search" className="sr-only">
              Search medicines or scan a barcode
            </label>
            <div className="relative">
              <Search size={20} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
              <Input
                id="pos-search"
                ref={searchRef}
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                onKeyDown={onSearchKey}
                placeholder="Name, generic name or barcode"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="search"
                className="h-14 pl-11 pr-12 text-base"
              />
              {term && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => {
                    setTerm('');
                    requestId.current++;
                    setCatalog({ status: 'idle' });
                    searchRef.current?.focus();
                  }}
                  className="absolute right-1.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-ui text-subtle hover:bg-surface-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <X size={18} aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <PosCatalogResults state={catalog} onAdd={add} onRetry={() => void runSearch(term)} />
          </div>
        </Card>

        <section
          ref={cartRef}
          id="pos-cart"
          tabIndex={-1}
          aria-labelledby="pos-cart-heading"
          className="flex min-w-0 scroll-mt-28 flex-col overflow-hidden rounded-ui-lg border border-border bg-page shadow-card focus:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:max-h-[calc(100dvh-9rem)]"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2">
            <h2 id="pos-cart-heading" className="font-semibold text-fg">
              Cart{' '}
              <span className="text-sm font-normal text-subtle">
                ({summary.lineCount} {summary.lineCount === 1 ? 'item' : 'items'}, {summary.unitCount} {summary.unitCount === 1 ? 'unit' : 'units'})
              </span>
            </h2>
            <Button variant="ghost" size="lg" icon={Trash2} disabled={cart.lines.length === 0} onClick={() => setConfirmClear(true)} className="px-3">
              Clear
            </Button>
          </div>

          <div role="status" aria-live="polite" className="px-4 empty:hidden">
            {notice && (
              <Alert tone={notice.tone} className="mt-3" onDismiss={() => setNotice(null)}>
                {notice.text}
              </Alert>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <PosCart
              cart={cart}
              onQuantity={(id, qty) => apply(setQuantity(cartState.current, id, qty))}
              onRemove={(id) => apply(removeLine(cartState.current, id))}
              onInvalidQuantity={(text) => setNotice({ tone: 'warning', text })}
            />
          </div>

          <div className="space-y-3 border-t border-border p-4">
            <dl className="flex items-baseline justify-between gap-3">
              <dt className="text-sm text-muted">Subtotal at recorded prices</dt>
              <dd className="text-2xl font-bold tabular-nums text-fg" data-testid="pos-subtotal">
                {formatCents(summary.subtotalCents)}
              </dd>
            </dl>
            {summary.unpricedLines > 0 && (
              <Alert tone="danger">{summary.unpricedLines} item(s) have no recorded price and cannot be sold until a retail price is recorded.</Alert>
            )}
            {summary.prescriptionLines > 0 && (
              <Alert tone="warning">{summary.prescriptionLines} prescription-only item(s): the sale needs a linked prescription or a pharmacist.</Alert>
            )}
            <section aria-labelledby="pos-checkout-heading" className="rounded-ui border border-border bg-surface p-3">
              <h3 id="pos-checkout-heading" className="flex items-center gap-2 text-sm font-semibold text-fg">
                <Info size={16} aria-hidden="true" className="text-info" />
                {CHECKOUT_PENDING_MESSAGE}
              </h3>
              <p className="mt-1 text-xs text-muted">
                No sale is recorded, no payment is taken and no stock is deducted. Still to be decided:
              </p>
              <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
                {CHECKOUT_PENDING_DECISIONS.map((d) => (
                  <li key={d} className="list-inside list-disc">
                    {d}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </section>
      </main>

      {/* Small screens: the cart is below the results, so keep its total and a jump link in reach. */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-page p-3 shadow-pop lg:hidden">
        <Button
          variant="primary"
          size="lg"
          fullWidth
          icon={ShoppingCart}
          onClick={() => {
            cartRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            cartRef.current?.focus({ preventScroll: true });
          }}
          aria-label={`View cart: ${summary.lineCount} items, subtotal ${formatCents(summary.subtotalCents)}`}
        >
          <span className="flex w-full items-center justify-between gap-2">
            <span>View cart ({summary.lineCount})</span>
            <span className="tabular-nums">{formatCents(summary.subtotalCents)}</span>
          </span>
        </Button>
      </div>

      <PosCustomerDialog open={customerOpen} onClose={() => setCustomerOpen(false)} onSelect={setCustomer} />
      <ConfirmDialog
        open={confirmClear}
        title="Clear the cart?"
        description="Every item will be removed. Nothing has been sold or deducted from stock."
        confirmLabel="Clear cart"
        tone="danger"
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          apply({ cart: EMPTY_CART });
          setConfirmClear(false);
          searchRef.current?.focus();
        }}
      />
    </div>
  );
}
