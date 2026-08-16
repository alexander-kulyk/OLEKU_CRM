import React from 'react';
import { classNames } from '../lib';
import {
  CONTROL_BASE_CLASS_NAME,
  CONTROL_HEIGHT_CLASS_NAME,
  CONTROL_INVALID_CLASS_NAME,
  CONTROL_VALID_CLASS_NAME,
  CONTROL_WITH_TRAILING_ICON_CLASS_NAME,
} from './control-styles';
import { Field } from './Field';
import { useFieldAria } from './field-aria';

export interface IInputProps extends React.ComponentPropsWithRef<'input'> {
  readonly label: string;
  /** Guidance below a resting field; replaced by `error` when there is one. */
  readonly hint?: string;
  /** The field's message. Its presence is what puts the control in its invalid state. */
  readonly error?: string;
  readonly isLabelHidden?: boolean;
  /**
   * Decorative glyph pinned to the right edge (a clock, a calendar). Pass an
   * already-sized icon; it is never interactive, so it does not intercept
   * clicks meant for the control.
   */
  readonly trailingIcon?: React.ReactNode;
  /** Applied to the outer field, not the control — for grid/flex placement. */
  readonly className?: string;
}

/**
 * The product's text field: a `Field` frame around a native `<input>`.
 *
 * Every prop a native input takes passes straight through, `ref` included,
 * so `{...register('name')}` from react-hook-form works with no adapter —
 * the reason this is a thin wrapper rather than a controlled component with
 * its own value state.
 */
export const Input: React.FC<IInputProps> = ({
  label,
  hint,
  error,
  isLabelHidden = false,
  trailingIcon,
  className,
  id,
  ...inputProps
}) => {
  const { controlId, hintId, errorId, describedBy } = useFieldAria({ id, hint, error });
  const hasTrailingIcon = Boolean(trailingIcon);

  return (
    <Field
      label={label}
      controlId={controlId}
      hintId={hintId}
      errorId={errorId}
      hint={hint}
      error={error}
      isLabelHidden={isLabelHidden}
      className={className}
    >
      <div className='relative flex items-center'>
        <input
          id={controlId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={classNames(
            CONTROL_BASE_CLASS_NAME,
            CONTROL_HEIGHT_CLASS_NAME,
            error ? CONTROL_INVALID_CLASS_NAME : CONTROL_VALID_CLASS_NAME,
            hasTrailingIcon && CONTROL_WITH_TRAILING_ICON_CLASS_NAME,
          )}
          {...inputProps}
        />

        {hasTrailingIcon && (
          <span
            aria-hidden='true'
            className='pointer-events-none absolute right-md flex items-center text-ink-muted'
          >
            {trailingIcon}
          </span>
        )}
      </div>
    </Field>
  );
};
