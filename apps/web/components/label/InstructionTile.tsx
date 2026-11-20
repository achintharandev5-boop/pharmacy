'use client';

import React, { useEffect, useState } from 'react';
import { Check, Lock, X, type LucideIcon } from 'lucide-react';
import { CATEGORY_STYLE, instructionCategory, type Category } from './instructionCategories';

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2';

/** Locked controls are aria-disabled (still focusable and tappable) so their reason can be shown. */
const LOCKED = 'aria-disabled:cursor-not-allowed aria-disabled:active:scale-100 disabled:cursor-not-allowed';
/** Faded look of a locked tile that is not selected. A selected tile stays readable while locked. */
const FADED = 'opacity-45';

/** Tile icon: full size in a tall tile, smaller in a short one, hidden when the label needs the room. */
const TILE_ICON = 'shrink-0 size-7 2xl:size-[34px] [@container(max-height:5.5rem)]:size-5 [@container(max-height:4rem)]:hidden';

export const STAT_LOCK_HINT = 'Unavailable while the STAT dose is being entered. Finish or cancel STAT first.';
export const PANEL_LOCK_HINT = 'Finish or cancel the open panel on the right first.';
export const LOCK_FALLBACK = 'Unavailable right now.';

/** What a tap on a locked control explains: the control's name and the existing refusal text. */
export type LockNotice = { label: string; hint: string } | null;

/** The latest locked-control explanation; it clears itself after a few seconds. */
export function useLockNotice() {
  const [notice, setNotice] = useState<LockNotice>(null);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 8000);
    return () => clearTimeout(timer);
  }, [notice]);
  return [notice, setNotice] as const;
}

/** Live region for locked-control explanations; renders nothing visible until a locked tap. */
export function LockNoticeLine({ notice, onDismiss }: { notice: LockNotice; onDismiss: () => void }) {
  return (
    <div role="status" aria-live="polite" data-testid="lock-notice" className={notice ? 'shrink-0' : 'sr-only'}>
      {notice && (
        <div className="flex items-start gap-2 rounded-ui-lg border border-warning-border bg-warning-soft px-2.5 py-1.5 text-xs font-semibold text-warning">
          <Lock size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
          <span className="flex-1">
            <span className="font-bold">{notice.label}</span> is unavailable: {notice.hint}
          </span>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss explanation"
            className={`-my-1 -mr-1.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full hover:bg-surface-2 cursor-pointer ${FOCUS_RING}`}
          >
            <X size={13} strokeWidth={2.5} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}

/** Screen-reader descriptions for controls, referenced by aria-describedby (kept out of their names). */
export function ControlHints({ hints }: { hints: { id: string; text?: string | null }[] }) {
  return (
    <div className="sr-only">
      {hints.filter((h) => h.text).map((h) => (
        <span key={h.id} id={h.id}>{h.text}</span>
      ))}
    </div>
  );
}

/** A stable id for a control's description, from its key. */
export const hintId = (scope: string, key: string) => `${scope}-hint-${key.replace(/[^A-Za-z0-9]+/g, '-')}`;

/** Selected style for buttons inside action panels (e.g. ENT, Done): the schedule category's. */
export const SELECTED = {
  blue: 'bg-primary-soft border-2 border-primary text-primary-hover',
};

/**
 * Button states shared by every action tile (grid, ENT panel):
 *  default   neutral surface, 1 px border, tone-coloured icon
 *  hover     surface tint, tone border;  pressed  tone tint + scale 97 %
 *  focus     2 px primary ring with offset (keyboard only)
 *  selected  solid tone (main grid) or tone tint (action panels) + 2 px border + check badge (+ aria-pressed for toggles)
 *  locked    aria-disabled, faded unless selected; a rule lock also fades, with a dashed border and a lock glyph;
 *            a tap explains why (onLocked) and never runs the action
 *  requires-input  dashed warning outline;  invalid  solid danger outline
 */
export type Tile = {
  key: string;
  label: string;
  icon: LucideIcon;
  /** Colour tone (instructionCategories.ts); defaults to the tone of the tile's key. */
  category?: Category;
  /** Extra icon classes (e.g. the filled STAT bolt). */
  iconClass?: string;
  selected: boolean;
  /** Toggles expose aria-pressed; tiles that open a panel or act on labels do not. */
  toggle: boolean;
  disabled?: boolean;
  expanded?: boolean;
  controls?: string;
  onClick: () => void;
  detail?: string | null;
  labelClass?: string;
  /** Workflow state beyond selected: needs a next step, breaks a rule, or is locked. */
  state?: 'requires-input' | 'invalid' | 'locked';
  stateHint?: string;
};

export function GridTile({
  tile,
  showIcons = true,
  describedBy,
  onLocked,
  selectedStyle = 'tint',
}: {
  tile: Tile;
  showIcons?: boolean;
  /** Id of this tile's description (ControlHints), read with its name when it has a hint. */
  describedBy?: string;
  /** Called instead of the action when a locked tile is tapped or activated by keyboard. */
  onLocked?: (notice: NonNullable<LockNotice>) => void;
  /** 'tint' (tone tint, used by action panels) or 'solid' (solid tone, the main feature grid). */
  selectedStyle?: 'tint' | 'solid';
}) {
  const Icon = tile.icon;
  const style = CATEGORY_STYLE[tile.category ?? instructionCategory(tile.key)];
  const locked = Boolean(tile.disabled);
  const solid = selectedStyle === 'solid' && tile.selected;
  return (
    <button
      type="button"
      onClick={() => (locked ? onLocked?.({ label: tile.label, hint: tile.stateHint ?? LOCK_FALLBACK }) : tile.onClick())}
      aria-disabled={locked || undefined}
      aria-describedby={tile.stateHint && describedBy ? describedBy : undefined}
      aria-expanded={tile.expanded}
      aria-controls={tile.controls}
      aria-pressed={tile.toggle ? tile.selected : undefined}
      data-selected={tile.selected || undefined}
      data-state={tile.state}
      title={tile.stateHint}
      className={`relative w-full h-full min-h-12 ${showIcons ? '[container-type:size]' : ''} ${LOCKED} ${locked && !tile.selected ? FADED : ''} rounded-ui-lg flex flex-col items-center justify-center gap-1 2xl:gap-1.5 px-1 py-1 text-center ${solid ? '' : 'text-fg'} transition-colors duration-100 select-none touch-manipulation cursor-pointer active:scale-[0.97] ${FOCUS_RING} ${
        tile.state === 'locked' ? `${FADED} border-dashed ` : ''
      }${
        tile.state === 'requires-input' ? 'outline-2 outline-dashed outline-warning outline-offset-1 ' : ''
      }${
        tile.state === 'invalid' ? 'outline-2 outline-danger outline-offset-1 ' : ''
      }${
        solid
          ? `border-2 ${style.solid} shadow-sm`
          : tile.selected
            ? `border-2 ${style.selected} shadow-sm`
            : `border bg-page border-border shadow-card hover:bg-surface ${style.idle}`
      }`}
    >
      {/* Locked by a clinical rule (not merely by an open panel): a lock glyph, not fading alone. */}
      {tile.state === 'locked' && (
        <span aria-hidden="true" data-testid="lock-glyph" className="absolute top-1.5 left-1.5 text-subtle">
          <Lock size={14} strokeWidth={2.5} />
        </span>
      )}
      {showIcons && tile.selected && (
        <span aria-hidden="true" data-testid="selected-badge" className={`absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center ${solid ? style.onSolid : `text-[var(--color-on-tone-solid)] ${style.badge}`}`}>
          <Check size={13} strokeWidth={3.5} />
        </span>
      )}
      {showIcons && <Icon size={28} strokeWidth={2.25} aria-hidden="true" className={`${TILE_ICON} ${solid ? '' : style.icon} ${tile.iconClass ?? ''}`} />}
      <span className={`max-w-full font-bold text-sm xl:text-[15px] 2xl:text-base leading-tight break-words ${solid ? '' : tile.labelClass ?? ''}`}>
        {tile.label}
      </span>
      {tile.detail && (
        <span className={`px-2 py-0.5 rounded-full text-xs xl:text-sm font-black leading-tight max-w-full break-words tabular ${solid ? style.onSolid : `bg-page/80 ${style.text}`}`}>
          {tile.detail}
        </span>
      )}
    </button>
  );
}

/** Label actions in the grid: Add Label is solid green; Delete Label is an outlined coral (destructive) one. */
export function ActionTile({
  label,
  icon: Icon,
  colorClass,
  onClick,
  showIcons = true,
  disabled = false,
  lockedHint,
  describedBy,
  onLocked,
  variant = 'solid',
  inline = false,
  sizeClass = '',
  textClass = 'text-on-tone-solid',
}: {
  label: string;
  icon: LucideIcon;
  colorClass: string;
  onClick: () => void;
  showIcons?: boolean;
  disabled?: boolean;
  lockedHint?: string;
  describedBy?: string;
  onLocked?: (notice: NonNullable<LockNotice>) => void;
  variant?: 'solid' | 'outline';
  /** Icon beside the label in one row (the Label actions strip) instead of stacked. */
  inline?: boolean;
  /** Size classes, kept when the tile is locked. */
  sizeClass?: string;
  /** Text and icon colour on the solid fill. */
  textClass?: string;
}) {
  // A locked label action turns neutral grey with a dashed border instead of fading its colour.
  const text = disabled ? 'text-disabled' : variant === 'solid' ? textClass : '';
  const colors = disabled ? 'bg-surface border-border border-dashed shadow-none' : colorClass;
  const layout = inline
    ? 'h-14 sm:h-16 flex-row gap-2.5 px-4 text-base xl:text-lg'
    : `min-h-12 ${showIcons ? '[container-type:size]' : ''} flex-col gap-1 2xl:gap-1.5 px-1 py-1 text-center`;
  return (
    <button
      type="button"
      onClick={() => (disabled ? onLocked?.({ label, hint: lockedHint ?? LOCK_FALLBACK }) : onClick())}
      aria-disabled={disabled || undefined}
      aria-describedby={disabled && lockedHint && describedBy ? describedBy : undefined}
      title={disabled ? lockedHint : undefined}
      className={`${sizeClass} ${layout} ${LOCKED} rounded-ui-lg ${variant === 'solid' ? 'border shadow-sm' : 'border-2'} ${text} flex items-center justify-center transition-colors duration-100 select-none touch-manipulation cursor-pointer active:scale-[0.97] ${FOCUS_RING} ${colors}`}
    >
      {showIcons && <Icon size={inline ? 24 : 28} strokeWidth={2.25} aria-hidden="true" className={`${inline ? 'shrink-0' : TILE_ICON} ${text}`} />}
      <span className={`font-bold leading-tight ${inline ? '' : 'text-sm xl:text-[15px] 2xl:text-base'} ${text}`}>{label}</span>
    </button>
  );
}
