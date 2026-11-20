'use client';

import React, { useState } from 'react';
import { Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import { Badge, EmptyState, IconButton } from '@/components/ui';
import { formatCents, lineTotalCents, priceToCents, type Cart } from '@/lib/pos/cart';

interface Props {
  cart: Cart;
  onQuantity: (productId: string, quantity: number) => void;
  onRemove: (productId: string) => void;
  onInvalidQuantity: (message: string) => void;
}

/**
 * Typed quantity. The number is applied on Enter or when the field loses focus, so an
 * intermediate value while typing (for example "0" on the way to "05") never removes the line.
 * Lines are removed only with the Remove button.
 */
function QuantityInput({
  name,
  quantity,
  onCommit,
  onInvalid,
}: {
  name: string;
  quantity: number;
  onCommit: (value: number) => void;
  onInvalid: (message: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    if (draft === null) return;
    const value = Number(draft);
    setDraft(null);
    if (draft.trim() === '' || !Number.isInteger(value) || value < 1) {
      onInvalid(`Enter a whole number of 1 or more for ${name}. To take it out, use Remove.`);
      return;
    }
    if (value !== quantity) onCommit(value);
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      aria-label={`Quantity of ${name}`}
      value={draft ?? String(quantity)}
      onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ''))}
      onFocus={(e) => e.target.select()}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit();
        } else if (e.key === 'Escape') {
          setDraft(null);
        }
      }}
      className="h-12 w-20 rounded-ui border border-border-strong bg-page text-center text-base font-semibold tabular-nums focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-soft"
    />
  );
}

export function PosCart({ cart, onQuantity, onRemove, onInvalidQuantity }: Props) {
  if (cart.lines.length === 0) {
    return <EmptyState icon={ShoppingCart} title="Cart is empty" description="Medicines you add appear here." />;
  }

  return (
    <ul className="divide-y divide-border" aria-label="Cart">
      {cart.lines.map(({ product, quantity }) => {
        const unit = priceToCents(product.price);
        const total = lineTotalCents({ product, quantity });
        const atLimit = quantity >= product.sellableQuantity;
        return (
          <li key={product.id} className="px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="break-words font-semibold text-fg">{product.name}</p>
                <p className="text-xs text-subtle">
                  {unit === null ? 'No price recorded' : `${formatCents(unit)} each`} · {product.sellableQuantity} sellable
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {product.rxRequired && <Badge tone="warning">Needs a linked prescription or a pharmacist</Badge>}
                  {unit === null && <Badge tone="danger">No recorded price: cannot be sold</Badge>}
                  {atLimit && <Badge tone="info">All sellable stock in cart</Badge>}
                </div>
              </div>
              <p className="shrink-0 font-semibold tabular-nums text-fg">{total === null ? '—' : formatCents(total)}</p>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <IconButton
                icon={Minus}
                label={`Decrease ${product.name}`}
                variant="secondary"
                size="lg"
                onClick={() => onQuantity(product.id, quantity - 1)}
                disabled={quantity <= 1}
              />
              <QuantityInput
                key={`${product.id}:${quantity}`}
                name={product.name}
                quantity={quantity}
                onCommit={(value) => onQuantity(product.id, value)}
                onInvalid={onInvalidQuantity}
              />
              <IconButton
                icon={Plus}
                label={`Increase ${product.name}`}
                variant="secondary"
                size="lg"
                onClick={() => onQuantity(product.id, quantity + 1)}
                disabled={atLimit}
              />
              <IconButton
                icon={Trash2}
                label={`Remove ${product.name}`}
                variant="danger-soft"
                size="lg"
                className="ml-auto"
                onClick={() => onRemove(product.id)}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
