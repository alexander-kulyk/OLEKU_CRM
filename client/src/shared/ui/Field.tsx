import React from 'react';
import { AlertCircleSVG } from '../../../assets';
import { classNames } from '../lib';
import {
  FIELD_ERROR_CLASS_NAME,
  FIELD_HINT_CLASS_NAME,
  FIELD_LABEL_CLASS_NAME,
} from './control-styles';

export interface IFieldProps {
  readonly label: string;
  /** Ties the label to the control the caller renders as `children`. */
  readonly controlId: string;
  readonly hintId: string;
  readonly errorId: string;
  readonly hint?: string;
  readonly error?: string;
  /** Hides the label visually while keeping it for assistive technology. */
  readonly isLabelHidden?: boolean;
  readonly className?: string;
  readonly children: React.ReactNode;
}

/**
 * The label / control / message frame every field shares
 * (assets/ui_kit/fields.png). Owns nothing but layout and the two message
 * slots: guidance below a resting field, and a message with an alert glyph
 * once the field has one. An error replaces the hint rather than stacking
 * with it, so a field never shows two competing lines of text.
 *
 * The control itself is passed in as `children` — this frame works for a
 * text input, a native date/time input, or anything else a feature needs to
 * label consistently.
 */
export const Field: React.FC<IFieldProps> = ({
  label,
  controlId,
  hintId,
  errorId,
  hint,
  error,
  isLabelHidden = false,
  className,
  children,
}) => {
  const hasError = Boolean(error);

  return (
    <div className={classNames('flex flex-col gap-xs', className)}>
      <label
        htmlFor={controlId}
        className={classNames(FIELD_LABEL_CLASS_NAME, isLabelHidden && 'sr-only')}
      >
        {label}
      </label>

      {children}

      {!hasError && hint && (
        <p id={hintId} className={FIELD_HINT_CLASS_NAME}>
          {hint}
        </p>
      )}

      {hasError && (
        <p id={errorId} className={FIELD_ERROR_CLASS_NAME}>
          <AlertCircleSVG className='size-4 shrink-0' />
          {error}
        </p>
      )}
    </div>
  );
};
