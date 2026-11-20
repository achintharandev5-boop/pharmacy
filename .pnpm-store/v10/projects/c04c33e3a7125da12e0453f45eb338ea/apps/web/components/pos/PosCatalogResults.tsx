'use client';

import React from 'react';
import { PackageSearch, ScanBarcode } from 'lucide-react';
import { Badge, EmptyState, ErrorState, SkeletonRows, cn } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { formatCents, priceToCents, type PosProduct } from '@/lib/pos/cart';

export type CatalogState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; term: string; data: PosProduct[] };

interface Props {
  state: CatalogState;
  onAdd: (product: PosProduct) => void;
  onRetry: () => void;
}

/** Why a medicine cannot be added to the cart, or null when it can. */
export function unavailableReason(p: PosProduct): string | null {
  if (p.sellableQuantity <= 0) return 'Out of stock';
  if (priceToCents(p.price) === null) return 'No price recorded';
  return null;
}

/**
 * Search results. Price, stock and expiry are shown exactly as the API returned them. A medicine
 * that cannot be added stays tappable (aria-disabled) so tapping it explains why.
 */
export function PosCatalogResults({ state, onAdd, onRetry }: Props) {
  if (state.status === 'idle') {
    return (
      <EmptyState
        icon={ScanBarcode}
        title="Search or scan to add medicines"
        description="Type a brand or generic name, or scan a barcode."
      />
    );
  }
  if (state.status === 'loading') return <SkeletonRows rows={5} label="Searching medicines" />;
  if (state.status === 'error') return <ErrorState title="Search failed" message={state.message} onRetry={onRetry} />;
  if (state.data.length === 0) {
    return (
      <EmptyState
        icon={PackageSearch}
        title="No medicines found"
        description={`Nothing in the catalogue matches “${state.term}”. Inactive medicines are not listed.`}
      />
    );
  }

  return (
    <ul className="divide-y divide-border" aria-label="Search results">
      {state.data.map((p) => {
        const cents = priceToCents(p.price);
        const reason = unavailableReason(p);
        const form = [p.strength, p.dosageForm].filter(Boolean).join(' · ');
        return (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => onAdd(p)}
              aria-label={reason ? `${p.name}, ${reason.toLowerCase()}` : `Add ${p.name}`}
              aria-disabled={reason ? true : undefined}
              className={cn(
                'flex w-full min-h-16 flex-wrap items-start gap-x-4 gap-y-2 px-4 py-3 text-left transition-colors',
                'hover:bg-surface focus-visible:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary',
                reason && 'bg-surface/60',
              )}
            >
              <div className="min-w-0 flex-1 basis-56">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="break-words font-semibold text-fg">{p.name}</span>
                  {p.rxRequired && <Badge tone="warning">Prescription only</Badge>}
                </div>
                {(p.genericName || p.brandName || form) && (
                  <p className="mt-0.5 break-words text-sm text-muted">
                    {p.genericName && <span>{p.genericName}</span>}
                    {p.brandName && p.brandName !== p.name && (
                      <span>
                        {p.genericName ? ' · ' : ''}Brand: {p.brandName}
                      </span>
                    )}
                    {form && <span>{p.genericName || p.brandName ? ' · ' : ''}{form}</span>}
                  </p>
                )}
                <p className="mt-1 text-xs text-subtle">
                  {p.barcode ? <span className="font-mono">{p.barcode}</span> : 'No barcode'}
                  {p.nearestExpiry && <> · Earliest sellable expiry {formatDate(p.nearestExpiry)}</>}
                </p>
                {p.batches && p.batches.length > 0 && (
                  <p className="mt-1 text-xs text-subtle">
                    Batches:{' '}
                    {p.batches.map((b) => `${b.batchNumber} (${b.quantityAvailable}, exp ${formatDate(b.expiryDate)})`).join(', ')}
                  </p>
                )}
              </div>
              <div className="ml-auto shrink-0 text-right">
                <p className={cn('font-semibold tabular-nums', cents === null ? 'text-danger' : 'text-fg')}>
                  {cents === null ? 'No price recorded' : formatCents(cents)}
                </p>
                <p className="mt-1">
                  {p.sellableQuantity <= 0 ? (
                    <Badge tone="danger">Out of stock</Badge>
                  ) : (
                    <Badge tone="success">{p.sellableQuantity} sellable</Badge>
                  )}
                </p>
                {p.recordedStock !== p.sellableQuantity && (
                  <p className="mt-1 text-xs text-subtle">{p.recordedStock} on record</p>
                )}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
