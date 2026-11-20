'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useLabelStore } from '../../store/labelStore';
import { Calendar, X, RotateCw } from 'lucide-react';
import { getDispensingBatches } from '../../app/actions/inventory';
import { uiTestEnabled } from '../../lib/uiTestMode';
import { isCalendarDate, localDate, type DispensingBatch } from '../../lib/batchExpiry';

/**
 * Add Expiry Date (Document 5 pp. 41–43): retrieves the expiry recorded at GRN entry for the
 * batch being dispensed. With one dispensable batch its date is applied at once; with several
 * the pharmacist chooses the batch. No date is typed here except a clearly marked temporary
 * value in database-free UI testing mode.
 */
export function ExpDateModal() {
  const expDateModalVisible = useLabelStore((state) => state.expDateModalVisible);
  // Mounted afresh on each open, so batches are always read again from the database.
  return expDateModalVisible ? <ExpDateDialog /> : null;
}

type Lookup =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; batches: DispensingBatch[]; excluded: number };

function ExpDateDialog() {
  const closeExpDateModal = useLabelStore((state) => state.closeExpDateModal);
  const setExpiryBatch = useLabelStore((state) => state.setExpiryBatch);
  const product = useLabelStore((state) => state.product);
  const productId = product?.id ?? null;
  const uiTest = uiTestEnabled();
  const [lookup, setLookup] = useState<Lookup>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeExpDateModal();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeExpDateModal]);

  const apply = useCallback((batch: DispensingBatch) => {
    if (setExpiryBatch({ id: batch.id, productId, batchNumber: batch.batchNumber, expiryDate: batch.expiryDate, source: 'inventory' })) {
      closeExpDateModal();
    }
  }, [closeExpDateModal, productId, setExpiryBatch]);

  useEffect(() => {
    if (uiTest || !productId) return;
    let cancelled = false;
    getDispensingBatches(productId)
      .then((res) => {
        if (cancelled) return;
        if (!res.ok) { setLookup({ status: 'error', message: res.error }); return; }
        if (res.data?.productId !== productId || !Array.isArray(res.data?.batches)) {
          setLookup({ status: 'error', message: 'The server returned batches for a different medicine. Try again.' });
          return;
        }
        // Only batches with a real recorded date are offered; anything else is never printed.
        const batches = (res.data.batches as DispensingBatch[]).filter((b) => b?.id && isCalendarDate(b.expiryDate));
        const excluded = Number(res.data.excludedBatchCount ?? 0) + res.data.batches.length - batches.length;
        if (batches.length === 1) { apply(batches[0]); return; }
        setLookup({ status: 'ready', batches, excluded });
      })
      .catch(() => { if (!cancelled) setLookup({ status: 'error', message: 'Could not reach the pharmacy server. Try again.' }); });
    return () => { cancelled = true; };
  }, [apply, attempt, productId, uiTest]);

  return (
    // Shown in the right-hand action workspace (ActionWorkspace), not as an overlay.
    <div className="w-full flex-1 min-h-0 flex flex-col select-none">
      <div
        role="dialog"
        aria-labelledby="exp-date-title"
        className="w-full flex-1 min-h-0 flex flex-col p-2 relative"
      >
        <button
          type="button"
          aria-label="Close"
          onClick={closeExpDateModal}
          className="absolute top-4 right-4 w-8 h-8 rounded-full text-subtle hover:text-fg hover:bg-surface-2 flex items-center justify-center transition-colors cursor-pointer"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-ui-lg bg-primary-soft border border-primary-border text-primary flex items-center justify-center shadow-sm shrink-0">
            <Calendar size={24} />
          </div>
          <div>
            <h2 id="exp-date-title" className="text-xl font-bold text-fg leading-tight">
              Add Expiry Date
            </h2>
            <p className="text-xs text-subtle font-medium leading-tight mt-0.5">
              {product?.name ? `Batch expiry recorded at GRN for ${product.name}` : 'Batch expiry recorded at GRN'}
            </p>
          </div>
        </div>

        <div className="mb-5 min-h-[72px]">
          {uiTest ? (
            <UiTestExpiry productId={productId} />
          ) : !productId ? (
            <p role="alert" className="text-sm font-bold text-danger">
              Select a medicine from the catalogue first. Expiry dates come from its GRN batches; a medicine typed by name has none.
            </p>
          ) : lookup.status === 'loading' ? (
            <p role="status" className="text-sm font-semibold text-muted">Loading batches…</p>
          ) : lookup.status === 'error' ? (
            <div role="alert" className="flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-danger">No expiry date added: {lookup.message}</p>
              <button
                type="button"
                onClick={() => { setLookup({ status: 'loading' }); setAttempt((n) => n + 1); }}
                className="h-12 px-3.5 shrink-0 bg-surface-2 hover:bg-border text-muted font-bold text-xs rounded-ui-lg flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCw size={14} /> Retry
              </button>
            </div>
          ) : lookup.batches.length === 0 ? (
            <p role="alert" className="text-sm font-bold text-danger">
              No dispensable batch with a recorded expiry date
              {lookup.excluded > 0 ? ` (${lookup.excluded} batch${lookup.excluded === 1 ? ' is' : 'es are'} expired, quarantined or undated)` : ''}.
              Receive the stock through GRN, or continue without Add Expiry Date.
            </p>
          ) : (
            <div>
              <p className="text-xs font-bold text-muted uppercase tracking-wide mb-2">
                These batches have different expiry dates. Choose the batch you are dispensing from.
              </p>
              <ul className="flex flex-col gap-2" aria-label="Dispensable batches">
                {lookup.batches.map((b) => (
                  <li key={b.id}>
                    <button
                      type="button"
                      onClick={() => apply(b)}
                      className="w-full min-h-14 py-2 px-4 bg-page border border-border hover:bg-primary-soft hover:border-primary-border rounded-ui-lg flex items-center justify-between font-bold text-sm text-fg cursor-pointer touch-manipulation active:scale-[0.99]"
                    >
                      <span>Batch {b.batchNumber}</span>
                      <span className="text-primary">EXP {b.expiryDate}</span>
                      <span className="text-xs text-subtle">{b.quantityAvailable} available</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-border">
          <button
            type="button"
            onClick={closeExpDateModal}
            className="w-full h-14 bg-surface-2 hover:bg-border text-muted font-bold text-sm rounded-ui-lg transition-all select-none touch-manipulation cursor-pointer flex items-center justify-center active:scale-95"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Database-free UI testing only: inventory is not loaded, so the tester may type a temporary
 * date to see the label with an expiry. It is marked as a test value everywhere and can never be
 * saved (saving is disabled in this mode, and the save checks refuse it outside it).
 */
function UiTestExpiry({ productId }: { productId: string | null }) {
  const setExpiryBatch = useLabelStore((state) => state.setExpiryBatch);
  const closeExpDateModal = useLabelStore((state) => state.closeExpDateModal);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const use = () => {
    const text = value.trim();
    if (!isCalendarDate(text)) { setError('Enter a real date as YYYY-MM-DD.'); return; }
    if (text < localDate()) { setError(`${text} has already passed.`); return; }
    if (setExpiryBatch({ id: null, productId, batchNumber: null, expiryDate: text, source: 'ui-test' })) closeExpDateModal();
  };
  return (
    <div>
      <p role="status" className="text-sm font-bold text-warning mb-3">
        UI testing mode: inventory batches are not loaded. No GRN expiry is available.
      </p>
      <label htmlFor="exp-test-input" className="text-xs font-bold text-muted block mb-1.5 uppercase tracking-wide">
        Temporary local test expiry (not a GRN batch, never saved)
      </label>
      <div className="flex gap-2">
        <input
          id="exp-test-input"
          type="text"
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(null); }}
          onKeyDown={(e) => { if (e.key === 'Enter') use(); }}
          placeholder="YYYY-MM-DD"
          aria-invalid={Boolean(error)}
          className={`flex-1 h-14 bg-surface border rounded-ui-lg px-4 text-base font-bold text-fg outline-none focus:border-2 focus:border-primary ${error ? 'border-2 border-danger' : 'border-border'}`}
        />
        <button type="button" onClick={use} className="h-14 px-5 bg-primary text-[var(--color-on-solid)] font-bold text-sm rounded-ui-lg cursor-pointer">
          Use test date
        </button>
      </div>
      {error && <p role="alert" className="text-sm font-bold text-danger mt-1.5">{error}</p>}
    </div>
  );
}
