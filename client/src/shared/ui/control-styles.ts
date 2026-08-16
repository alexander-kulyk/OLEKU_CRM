/**
 * The field styling the kit defines (assets/ui_kit/fields.png): a 38px
 * surface control on a 10px radius, a terracotta border plus a soft halo on
 * focus, a danger border when invalid, and a sunken, muted fill when
 * disabled. Shared by every control primitive so a text input, a date input
 * and a time input are visually the same control.
 */

export const CONTROL_BASE_CLASS_NAME = [
  'relative w-full rounded-md border bg-surface px-md text-body text-ink',
  'shadow-rest transition-colors outline-none',
  'placeholder:text-ink-muted',
  'focus:ring-4',
  'disabled:cursor-not-allowed disabled:border-line disabled:bg-surface-muted',
  'disabled:text-ink-muted disabled:shadow-none',
].join(' ');

/** Rest and focus treatment for a valid control. */
export const CONTROL_VALID_CLASS_NAME =
  'border-line-strong focus:border-accent focus:ring-accent/15';

/** Rest and focus treatment once a field has a message against it. */
export const CONTROL_INVALID_CLASS_NAME =
  'border-danger focus:border-danger focus:ring-danger/15';

/** Matches the kit's 38px default control height. */
export const CONTROL_HEIGHT_CLASS_NAME = 'h-control-md';

/** Right padding that keeps the value clear of a trailing icon. */
export const CONTROL_WITH_TRAILING_ICON_CLASS_NAME = 'pr-2xl';

export const FIELD_LABEL_CLASS_NAME = 'text-label text-ink';
export const FIELD_HINT_CLASS_NAME = 'text-label font-normal text-ink-muted';
export const FIELD_ERROR_CLASS_NAME =
  'flex items-center gap-xs text-label font-normal text-danger';
