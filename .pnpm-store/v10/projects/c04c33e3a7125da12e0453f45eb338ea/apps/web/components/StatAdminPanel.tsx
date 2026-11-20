'use client';
import React from 'react';
import { useLabelStore } from '../store/labelStore';
import { analyseStat } from '../lib/instructionEngine';
import { formatDosage } from './StatPanel';
import { Zap, ArrowLeft, Check, X, Hand, User, Clock } from 'lucide-react';

/**
 * STAT sheet step 3: the STAT dose's own administration (TAKE/GIVE, BEFORE/AFTER), then
 * "Enter" [ඉන්පසු] to the follow-up. Shown only under the spec wording. Confirming never prints.
 */
const BUTTONS = [
  { key: 'TAKE', label: 'TAKE', icon: Hand },
  { key: 'GIVE', label: 'GIVE', icon: User },
  { key: 'BEFORE', label: 'BEFORE', icon: Clock },
  { key: 'AFTER', label: 'AFTER', icon: Clock },
] as const;

const CONTROL =
  'h-(--ws-ctl) rounded-ui-lg flex items-center justify-center gap-1.5 font-bold transition-colors cursor-pointer select-none touch-manipulation active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2';

export function StatAdminPanel() {
  const stat = useLabelStore((state) => state.stat);
  const toggleStatAdministration = useLabelStore((state) => state.toggleStatAdministration);
  const confirmStatAdministration = useLabelStore((state) => state.confirmStatAdministration);
  const backToStatQuantity = useLabelStore((state) => state.backToStatQuantity);
  const cancelStat = useLabelStore((state) => state.cancelStat);

  const admin = stat?.administration ?? [];
  const analysis = analyseStat(stat);
  const canEnter = admin.includes('TAKE') || admin.includes('GIVE');

  // Same shell as the quantity editor (CompactQuantityEditor): title row, content, footer at the bottom.
  return (
    <div className="w-full flex-1 min-h-0 flex flex-col gap-2 select-none">
      <div className="shrink-0 flex items-center gap-2.5 min-w-0">
        <div className="w-9 h-9 shrink-0 rounded-ui-lg bg-danger-soft border border-danger-border text-danger flex items-center justify-center">
          <Zap size={18} className="fill-current" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h3 className="text-base xl:text-lg font-bold text-fg leading-tight">
            STAT dose {stat ? formatDosage(stat.qty, stat.isFraction) : ''}: how is it given?
          </h3>
          <p className="text-xs text-muted font-medium leading-tight">
            Step 2 of 3 · then Enter (ඉන්පසු) and choose what follows
          </p>
        </div>
      </div>

      <div className="shrink-0 grid grid-cols-4 gap-2">
        {BUTTONS.map((b) => {
          const selected = admin.includes(b.key);
          const Icon = b.icon;
          return (
            <button
              key={b.key}
              type="button"
              onClick={() => toggleStatAdministration(b.key)}
              aria-pressed={selected}
              aria-label={`STAT ${b.label}`}
              className={`${CONTROL} min-w-0 text-sm border ${
                selected ? 'bg-primary-solid border-primary-solid text-on-primary-solid shadow-sm' : 'bg-page border-border-strong text-fg hover:bg-surface hover:border-primary'
              } ${!canEnter && (b.key === 'TAKE' || b.key === 'GIVE') ? 'outline-2 outline-dashed outline-warning outline-offset-2' : ''}`}
            >
              {selected ? <Check size={18} strokeWidth={3} aria-hidden="true" /> : <Icon size={18} aria-hidden="true" />}
              {b.label}
            </button>
          );
        })}
      </div>

      <div
        data-testid="stat-admin-result"
        data-status={analysis.status}
        role="status"
        className={`flex-1 min-h-(--ws-ctl) rounded-ui-lg border px-3 py-2 flex items-center justify-center text-center ${
          analysis.status === 'complete'
            ? 'bg-success-soft border-success-border text-success text-xl font-bold'
            : 'bg-warning-soft border-warning-border text-warning text-sm font-bold'
        }`}
      >
        {analysis.text ?? analysis.message}
      </div>

      <div className="shrink-0 grid grid-cols-[auto_auto_minmax(0,1fr)] gap-2 pt-2 border-t border-border">
        <button type="button" onClick={backToStatQuantity} className={`${CONTROL} px-4 text-sm bg-page border border-border-strong text-fg hover:bg-surface`}>
          <ArrowLeft size={16} aria-hidden="true" />
          <span>Quantity</span>
        </button>
        <button type="button" onClick={cancelStat} className={`${CONTROL} px-4 text-sm bg-page border border-border-strong text-fg hover:bg-surface`}>
          <X size={16} aria-hidden="true" />
          <span>Cancel</span>
        </button>
        <button
          type="button"
          onClick={confirmStatAdministration}
          disabled={!canEnter}
          className={`${CONTROL} text-base bg-primary-solid hover:bg-primary-solid-hover text-on-primary-solid shadow-sm disabled:bg-surface-2 disabled:text-disabled disabled:shadow-none disabled:cursor-not-allowed`}
        >
          <Check size={18} strokeWidth={2.5} aria-hidden="true" />
          <span>Enter (ඉන්පසු)</span>
        </button>
      </div>
    </div>
  );
}
