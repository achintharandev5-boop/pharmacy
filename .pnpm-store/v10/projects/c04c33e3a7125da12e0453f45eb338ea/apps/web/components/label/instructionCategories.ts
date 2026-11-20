/**
 * One colour tone per instruction, shared by the action tile (idle icon, selected fill) and its
 * Selected Instructions chip, so a choice looks the same in both places. Colours are design tokens
 * (theme.css); a tone follows the action's meaning, never its position.
 *
 *  blue     5H / 6H / 8H, Dissolve and Drink, ENT and the dose rows (also the default)
 *  teal     Reasons, Weekly, Chewable, Keep in Mouth
 *  green    Daily, With Food (and Add Label / + elsewhere)
 *  purple   Days, Name of Days, EOD, Empty Stomach
 *  amber    Evening, EXP Date
 *  coral    STAT only (and Delete Label)
 *  neutral  Remove Address
 *
 * Unselected surfaces stay neutral: only the icon carries the tone. Selection is never shown by
 * colour alone: a 2 px border, a check badge and aria-pressed.
 */
export type Category = 'blue' | 'teal' | 'green' | 'purple' | 'amber' | 'coral' | 'neutral';

export const CATEGORY_STYLE: Record<Category, {
  /** Idle icon colour (≥ 3:1 on the page). */
  icon: string;
  /** Unselected tile hover and press: neutral surface, toned edge. */
  idle: string;
  /** Selected tile in the main grid: solid tone under white text (≥ 4.5:1 in both themes). */
  solid: string;
  /** Check badge and detail pill on the solid fill. */
  onSolid: string;
  /** Selected tile in action panels: tint and 2 px border. */
  selected: string;
  /** Text on the tint (≥ 4.5:1): the tile's quantity detail and the chip label. */
  text: string;
  /** Check badge fill on the tint. */
  badge: string;
  /** Selected Instructions chip. */
  chip: string;
}> = {
  blue: {
    icon: 'text-primary',
    idle: 'hover:border-primary-border active:bg-primary-soft',
    solid: 'bg-primary-solid border-primary-solid text-on-primary-solid hover:bg-primary-solid-hover active:bg-primary-solid-active',
    onSolid: 'bg-[var(--color-on-tone-solid)] text-primary-solid',
    selected: 'bg-primary-soft border-primary', text: 'text-primary-hover', badge: 'bg-primary-solid',
    chip: 'bg-primary-soft border-primary-border text-primary-hover',
  },
  teal: {
    icon: 'text-teal',
    idle: 'hover:border-teal-border active:bg-teal-soft',
    solid: 'bg-teal-solid border-teal-solid text-on-tone-solid hover:bg-teal-solid-hover active:bg-teal-solid-active',
    onSolid: 'bg-[var(--color-on-tone-solid)] text-teal-solid',
    selected: 'bg-teal-soft border-teal', text: 'text-teal-strong', badge: 'bg-teal-solid',
    chip: 'bg-teal-soft border-teal-border text-teal-strong',
  },
  green: {
    icon: 'text-green',
    idle: 'hover:border-green-border active:bg-green-soft',
    solid: 'bg-green-solid border-green-solid text-on-tone-solid hover:bg-green-solid-hover active:bg-green-solid-active',
    onSolid: 'bg-[var(--color-on-tone-solid)] text-green-solid',
    selected: 'bg-green-soft border-green', text: 'text-green-strong', badge: 'bg-green-solid',
    chip: 'bg-green-soft border-green-border text-green-strong',
  },
  purple: {
    icon: 'text-purple',
    idle: 'hover:border-purple-border active:bg-purple-soft',
    solid: 'bg-purple-solid border-purple-solid text-on-tone-solid hover:bg-purple-solid-hover active:bg-purple-solid-active',
    onSolid: 'bg-[var(--color-on-tone-solid)] text-purple-solid',
    selected: 'bg-purple-soft border-purple', text: 'text-purple-strong', badge: 'bg-purple-solid',
    chip: 'bg-purple-soft border-purple-border text-purple-strong',
  },
  amber: {
    icon: 'text-amber',
    idle: 'hover:border-amber-border active:bg-amber-soft',
    solid: 'bg-amber-solid border-amber-solid text-on-tone-solid hover:bg-amber-solid-hover active:bg-amber-solid-active',
    onSolid: 'bg-[var(--color-on-tone-solid)] text-amber-solid',
    selected: 'bg-amber-soft border-amber', text: 'text-amber-strong', badge: 'bg-amber-solid',
    chip: 'bg-amber-soft border-amber-border text-amber-strong',
  },
  coral: {
    icon: 'text-coral',
    idle: 'hover:border-coral-border active:bg-coral-soft',
    solid: 'bg-coral-solid border-coral-solid text-on-tone-solid hover:bg-coral-solid-hover active:bg-coral-solid-active',
    onSolid: 'bg-[var(--color-on-tone-solid)] text-coral-solid',
    selected: 'bg-coral-soft border-coral', text: 'text-coral-strong', badge: 'bg-coral-solid',
    chip: 'bg-coral-soft border-coral-border text-coral-strong',
  },
  neutral: {
    icon: 'text-muted',
    idle: 'hover:border-border-strong active:bg-surface-2',
    solid: 'bg-graphite border-graphite text-page hover:bg-muted active:bg-muted',
    onSolid: 'bg-page text-graphite',
    selected: 'bg-surface-2 border-muted', text: 'text-muted', badge: 'bg-muted',
    chip: 'bg-surface-2 border-border-strong text-muted',
  },
};

const TONES: Record<string, Category> = {
  '5H': 'blue', '6H': 'blue', '8H': 'blue', '4H': 'blue', CUSTOM: 'blue', 'DISSOLVE AND DRINK': 'blue',
  REASONS: 'teal', WEEKLY: 'teal', CHEWABLE: 'teal', 'KEEP IN MOUTH': 'teal',
  DAILY: 'green', 'WITH FOOD': 'green',
  DAYS: 'purple', days: 'purple', 'NAME OF DAYS': 'purple', 'weekday-range': 'purple', EOD: 'purple', 'EMPTY STOMACH': 'purple',
  EVENING: 'amber', 'ADD EXP DATE': 'amber', exp: 'amber',
  STAT: 'coral',
  'REMOVE ADDRESS': 'neutral',
};

/** Tone of an instruction code, tile key or chip key (reason_… chips share the Reasons tone). */
export function instructionCategory(code: string): Category {
  if (code.startsWith('reason_')) return 'teal';
  return TONES[code] ?? 'blue';
}
