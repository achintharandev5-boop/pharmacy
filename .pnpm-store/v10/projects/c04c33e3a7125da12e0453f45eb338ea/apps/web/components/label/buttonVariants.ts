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
