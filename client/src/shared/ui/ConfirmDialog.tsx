import React from 'react';
import { AlertCircleSVG, TrashSVG } from '../../../assets';
import { classNames } from '../lib';
import { Button } from './Button';
import type { ButtonVariant } from './button-styles';

export interface IConfirmDialogProps {
  readonly title: string;
  readonly message: string;
  readonly confirmLabel: string;
  readonly cancelLabel: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
  /** Shows a busy label on the confirm action and disables both buttons. */
  readonly isConfirming?: boolean;
  /** Styles the confirm action as destructive (Delete vs. Discard changes). */
  readonly isDangerous?: boolean;
}

const TITLE_ID = 'confirm-dialog-title';
const MESSAGE_ID = 'confirm-dialog-message';

/** The two tones a confirmation can take. */
type ConfirmTone = 'danger' | 'accent';

interface IConfirmToneConfig {
  readonly icon: React.ReactNode;
  readonly iconChipClassName: string;
  readonly confirmVariant: ButtonVariant;
}

/**
 * (tone) -> presentation. A table rather than a pair of ternaries, so the
 * glyph, its chip and the confirm action can never end up describing
 * different intents.
 */
const CONFIRM_TONE_CONFIG: Readonly<Record<ConfirmTone, IConfirmToneConfig>> = {
  danger: {
    icon: <TrashSVG className='size-5' />,
    iconChipClassName: 'bg-danger-tint text-danger',
    confirmVariant: 'dangerSolid',
  },
  accent: {
    icon: <AlertCircleSVG className='size-5' />,
    iconChipClassName: 'bg-accent-tint text-accent',
    confirmVariant: 'primary',
  },
};

/**
 * The confirmation overlay (assets/ui_kit/overlays and feedback.png): an icon
 * chip in the tone of the action, the question as the title, the consequence
 * as body copy, and the two actions right-aligned with the confirm action
 * carrying the emphasis.
 *
 * Deliberately does NOT wire Escape to either button: the outcome of a
 * confirmation must be an explicit choice, and the dialog underneath owns
 * what a dismissal means.
 */
export const ConfirmDialog: React.FC<IConfirmDialogProps> = ({
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  isConfirming = false,
  isDangerous = false,
}) => {
  const tone = CONFIRM_TONE_CONFIG[isDangerous ? 'danger' : 'accent'];

  return (
    <div className='fixed inset-0 z-[60] flex items-center justify-center bg-ink/40 p-lg backdrop-blur-[2px]'>
      <div
        role='alertdialog'
        aria-modal='true'
        aria-labelledby={TITLE_ID}
        aria-describedby={MESSAGE_ID}
        className='flex w-full max-w-dialog flex-col gap-lg rounded-lg bg-surface p-xl shadow-overlay'
      >
        <span
          aria-hidden='true'
          className={classNames(
            'flex size-control-md items-center justify-center rounded-md',
            tone.iconChipClassName,
          )}
        >
          {tone.icon}
        </span>

        <div className='flex flex-col gap-sm'>
          <h3 id={TITLE_ID} className='text-dialog-title text-ink'>
            {title}
          </h3>
          <p id={MESSAGE_ID} className='text-body text-ink-secondary'>
            {message}
          </p>
        </div>

        <div className='flex justify-end gap-sm'>
          <Button variant='secondary' onClick={onCancel} disabled={isConfirming}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone.confirmVariant}
            onClick={onConfirm}
            isLoading={isConfirming}
            loadingLabel='Working…'
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};
