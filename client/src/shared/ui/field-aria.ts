import { useId } from 'react';

export interface IUseFieldAriaParams {
  /** An explicit id, when the call site needs to target the control itself. */
  readonly id?: string;
  readonly hint?: string;
  readonly error?: string;
}

export interface IUseFieldAriaResult {
  readonly controlId: string;
  readonly hintId: string;
  readonly errorId: string;
  /**
   * The `aria-describedby` value for the control: the error message when
   * there is one, the hint otherwise, and `undefined` when neither is
   * rendered. An error replaces the hint rather than stacking with it, so
   * assistive technology announces the problem instead of the guidance.
   */
  readonly describedBy: string | undefined;
}

/**
 * Generates the ids that tie a labelled control to its hint and error text.
 * Shared by every field primitive so the wiring is written once and cannot
 * be forgotten on a new control.
 */
export function useFieldAria({
  id,
  hint,
  error,
}: IUseFieldAriaParams): IUseFieldAriaResult {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const hintId = `${controlId}-hint`;
  const errorId = `${controlId}-error`;

  let describedBy: string | undefined;

  if (error) {
    describedBy = errorId;
  } else if (hint) {
    describedBy = hintId;
  }

  return { controlId, hintId, errorId, describedBy };
}
