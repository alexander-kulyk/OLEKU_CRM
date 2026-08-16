import React from 'react';
import { classNames } from '../lib';
import {
  BUTTON_BASE_CLASS_NAME,
  BUTTON_VARIANT_CLASS_NAME,
  ICON_BUTTON_SIZE_CLASS_NAME,
} from './button-styles';
import type { ButtonSize, ButtonVariant } from './button-styles';

export interface IIconButtonProps
  extends Omit<React.ComponentPropsWithRef<'button'>, 'children'> {
  /** Required — the control has no visible label to name it. */
  readonly label: string;
  readonly icon: React.ReactNode;
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
}

/**
 * A square, label-less action (the calendar's prev/next chevrons, a dialog's
 * close control). Shares `Button`'s variant and height tables, so the two sit
 * side by side without any hand-tuning.
 *
 * `label` is mandatory and becomes the accessible name — an icon-only control
 * with no name is unusable with a screen reader.
 */
export const IconButton: React.FC<IIconButtonProps> = ({
  label,
  icon,
  variant = 'secondary',
  size = 'md',
  className,
  type = 'button',
  ...buttonProps
}) => (
  <button
    type={type}
    aria-label={label}
    className={classNames(
      BUTTON_BASE_CLASS_NAME,
      BUTTON_VARIANT_CLASS_NAME[variant],
      ICON_BUTTON_SIZE_CLASS_NAME[size],
      className,
    )}
    {...buttonProps}
  >
    {icon}
  </button>
);
