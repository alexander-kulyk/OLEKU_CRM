/**
 * The shared style tables behind `Button` and `IconButton`
 * (assets/ui_kit/buttons.png). Kept in one module so a text action and the
 * icon action beside it can never drift apart: both read the same variant
 * table and the same 32 · 38 · 44 control heights.
 */

/**
 * The action styles the kit defines. Only one `primary` per surface —
 * everything else on that surface is `secondary`, `ghost` or one of the two
 * danger treatments.
 */
export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'neutral'
  | 'danger'
  | 'dangerSolid';

/** Maps onto the kit's 32 · 38 · 44 control heights. */
export type ButtonSize = 'sm' | 'md' | 'lg';

export const BUTTON_BASE_CLASS_NAME = [
  'inline-flex items-center justify-center gap-sm whitespace-nowrap rounded-md',
  'border border-transparent text-label transition-colors',
  'disabled:cursor-not-allowed disabled:border-transparent disabled:bg-surface-sunken',
  'disabled:text-ink-muted disabled:shadow-none',
].join(' ');

/** (variant) -> classes. A table rather than a switch, so a new action style
 * is one entry here and nothing else in the codebase changes. */
export const BUTTON_VARIANT_CLASS_NAME: Readonly<Record<ButtonVariant, string>> = {
  primary: 'bg-accent text-white shadow-rest hover:bg-accent-hover active:bg-accent-active',
  secondary:
    'border-line-strong bg-surface text-ink shadow-rest hover:bg-surface-muted active:bg-surface-sunken',
  ghost: 'text-ink-secondary hover:bg-surface-muted hover:text-ink',
  neutral: 'bg-ink text-white hover:bg-ink-secondary',
  danger: 'border-danger/35 text-danger hover:border-danger/60 hover:bg-danger-tint',
  dangerSolid: 'bg-danger text-white shadow-rest hover:bg-danger-hover',
};

/** (size) -> classes for a labelled button. */
export const BUTTON_SIZE_CLASS_NAME: Readonly<Record<ButtonSize, string>> = {
  sm: 'h-control-sm px-md',
  md: 'h-control-md px-lg',
  lg: 'h-control-lg px-xl text-body',
};

/** (size) -> classes for a square, label-less button. */
export const ICON_BUTTON_SIZE_CLASS_NAME: Readonly<Record<ButtonSize, string>> = {
  sm: 'size-control-sm',
  md: 'size-control-md',
  lg: 'size-control-lg',
};

export const BUTTON_SPINNER_CLASS_NAME: Readonly<Record<ButtonSize, string>> = {
  sm: 'size-4 shrink-0 animate-spin',
  md: 'size-4 shrink-0 animate-spin',
  lg: 'size-5 shrink-0 animate-spin',
};
