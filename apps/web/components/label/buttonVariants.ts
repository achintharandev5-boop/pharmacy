// Quantity control variants shared by the dose rows, the action panels and the toolbar, so every
// + / − / X/Y looks and behaves the same. Colours are design tokens (theme.css).

/** +: solid green, the positive step. */
export const PLUS_TONE = 'bg-green-solid hover:bg-green-solid-hover active:bg-green-solid-active text-on-tone-solid';
/** −: neutral graphite on the page surface. */
export const MINUS_TONE = 'bg-page border-border-strong text-graphite hover:bg-surface active:bg-surface-2';
/** Shared disabled look of a stepper: grey, dashed edge, no press. */
export const STEP_DISABLED =
  'disabled:bg-surface-2 disabled:border-border disabled:border-dashed disabled:text-disabled disabled:shadow-none disabled:cursor-not-allowed disabled:active:scale-100';
/** The last-pressed step: a ring in the step's own colour (shape, not a new fill). */
export const PLUS_PRESSED = 'ring-2 ring-green ring-offset-1';
export const MINUS_PRESSED = 'ring-2 ring-graphite ring-offset-1';

/** X/Y fraction: a subtle purple edge when idle, purple tint once a fraction is set or being chosen. */
export const XY_IDLE = 'bg-page border-purple-border text-fg hover:border-purple hover:bg-purple-soft';
export const XY_SELECTED = 'bg-purple-soft border-purple text-purple-strong';

/*
 * Morning / Lunch / Night dose cards only (glass design). The STAT panel, the toolbar quantity and the
 * action panels keep the neutral MINUS_TONE above. Colours are tokens in theme.css.
 */
/** Dose −: solid red under a white icon (4.83:1), same size as +. */
export const DOSE_MINUS_TONE =
  'bg-[var(--dose-minus)] border-[var(--dose-minus)] text-white hover:bg-[var(--dose-minus-hover)] hover:border-[var(--dose-minus-hover)] active:bg-[var(--dose-minus-active)] active:border-[var(--dose-minus-active)]';
/** Disabled dose −: muted red with a dashed edge and a still-visible icon; never grey. */
export const DOSE_MINUS_DISABLED =
  'disabled:bg-[var(--dose-minus-muted-bg)] disabled:border-[var(--dose-minus-muted-border)] disabled:border-dashed disabled:text-[var(--dose-minus-muted-fg)] disabled:shadow-none disabled:cursor-not-allowed disabled:active:scale-100';
export const DOSE_MINUS_PRESSED = 'ring-2 ring-[var(--dose-minus-active)] ring-offset-1';
/** Dose X/Y idle: a glass surface with a purple outline (selected keeps XY_SELECTED). */
export const DOSE_XY_IDLE =
  'bg-[var(--glass-surface-strong)] border-[var(--glass-border-strong)] text-fg hover:border-purple hover:bg-purple-soft';
