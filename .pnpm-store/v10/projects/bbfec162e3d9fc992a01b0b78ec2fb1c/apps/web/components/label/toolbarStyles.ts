// Shared classes for the label workstation's top toolbar, so every field and control matches.

export const TOOLBAR_FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-page';

const FIELD_BASE =
  'w-full h-full min-h-[60px] lg:min-h-0 border rounded-ui-lg pl-3 pr-1.5 flex items-center gap-2.5 focus-within:bg-page focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-colors cursor-text';

/** A labelled field inside the toolbar: subtle inset surface that lifts to white with a blue ring on focus. */
export const TOOLBAR_FIELD = `${FIELD_BASE} bg-surface border-border hover:border-border-strong`;

/** The medicine search: the field the operator uses most, so it stands out from the others. */
export const TOOLBAR_FIELD_PROMINENT = `${FIELD_BASE} bg-page border-primary-border shadow-card hover:border-primary`;

export const TOOLBAR_LABEL = 'text-[11px] font-semibold uppercase tracking-wide text-muted leading-none';

const INPUT_BASE =
  'w-full min-w-0 bg-transparent text-fg font-semibold outline-none placeholder:text-subtle placeholder:font-normal leading-tight mt-1';

export const TOOLBAR_INPUT = `${INPUT_BASE} text-[15px]`;

export const TOOLBAR_INPUT_PROMINENT = `${INPUT_BASE} text-base`;

const ICON_BUTTON_BASE = `w-11 h-11 shrink-0 rounded-ui flex items-center justify-center hover:text-primary hover:bg-primary-soft active:bg-primary-border transition-colors select-none touch-manipulation cursor-pointer ${TOOLBAR_FOCUS_RING}`;

/** 44 × 44 icon button used inside fields (clear). */
export const TOOLBAR_ICON_BUTTON = `${ICON_BUTTON_BASE} text-subtle`;

/** 44 × 44 icon button for a field's main action (patient keypad lookup, barcode scanner). */
export const TOOLBAR_ICON_BUTTON_ACCENT = `${ICON_BUTTON_BASE} text-primary`;
