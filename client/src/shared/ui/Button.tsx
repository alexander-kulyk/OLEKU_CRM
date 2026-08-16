import React from 'react';
import { SpinnerSVG } from '../../../assets';
import { classNames } from '../lib';
import {
  BUTTON_BASE_CLASS_NAME,
  BUTTON_SIZE_CLASS_NAME,
  BUTTON_SPINNER_CLASS_NAME,
  BUTTON_VARIANT_CLASS_NAME,
} from './button-styles';
import type { ButtonSize, ButtonVariant } from './button-styles';

export interface IButtonProps
  extends Omit<React.ComponentPropsWithRef<'button'>, 'children'> {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  /** Swaps the label for `loadingLabel` and a spinner, and blocks the action. */
  readonly isLoading?: boolean;
  readonly loadingLabel?: string;
  /**
   * Rendered before the label. Pass an already-sized icon
   * (`<PlusSVG className='size-4' />`) — the button lays it out but does not
   * resize it, so an icon can be tuned per call site.
   */
  readonly leadingIcon?: React.ReactNode;
  readonly children: React.ReactNode;
}

/**
 * The one labelled button in the product. Every action surface — dialogs,
 * the calendar toolbar, empty and error states — composes this rather than
 * repeating a Tailwind class string, so a change to the accent or the
 * control height lands everywhere at once.
 *
 * `type` defaults to `button`: a button inside a form only submits when its
 * call site says so explicitly.
 */
export const Button: React.FC<IButtonProps> = ({
  variant = 'secondary',
  size = 'md',
  isLoading = false,
  loadingLabel,
  leadingIcon,
  children,
  className,
  disabled = false,
  type = 'button',
  ...buttonProps
}) => {
  const label = isLoading && loadingLabel ? loadingLabel : children;

  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      className={classNames(
        BUTTON_BASE_CLASS_NAME,
        BUTTON_VARIANT_CLASS_NAME[variant],
        BUTTON_SIZE_CLASS_NAME[size],
        className,
      )}
      {...buttonProps}
    >
      {isLoading && <SpinnerSVG className={BUTTON_SPINNER_CLASS_NAME[size]} />}
      {!isLoading && leadingIcon}
      {label}
    </button>
  );
};
