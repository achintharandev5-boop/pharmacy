'use client';
import React from 'react';
import { dosageText } from '../lib/dosageQuantity';
import { useLabelStore } from '../store/labelStore';
import { Zap } from 'lucide-react';
import { CompactQuantityEditor } from './label/CompactQuantityEditor';

export function formatDosage(qty: number, isFraction: boolean) {
  return dosageText(qty, isFraction);
}

export function StatPanel() {
  const { stat, incrementDosage, decrementDosage, cancelStat, doneStat } = useLabelStore();

  const currentQty = stat?.qty || 0;
  const currentIsFrac = stat?.isFraction || false;
  const displayQty = formatDosage(currentQty, currentIsFrac);
  const hasQty = Number.isFinite(currentQty) && currentQty > 0;

  // X/Y goes through the existing STAT fraction entry (stat_fraction): the fraction is added to
  // the whole STAT quantity, or removed with 'clear'.
  const applyFraction = (fraction: string) => {
    const store = useLabelStore.getState();
    store.openNumberPad('stat_fraction');
    store.setQuickFraction(fraction);
  };

  return (
    <CompactQuantityEditor
      icon={Zap}
      iconClass="bg-coral-soft border-coral-border text-coral-strong"
      iconSvgClass="fill-current"
      title="STAT Dose"
      description="Initial one-time dose before the regular schedule"
      quantityLabel="STAT Quantity"
      display={displayQty || '0'}
      hasQuantity={hasQty}
      hint="Enter the STAT quantity to continue"
      ariaName="STAT"
      testId="stat-qty"
      fractionTarget="stat_fraction"
      onIncrement={() => incrementDosage('stat')}
      onDecrement={() => decrementDosage('stat')}
      onFraction={applyFraction}
      onCancel={cancelStat}
      onConfirm={doneStat}
    />
  );
}
