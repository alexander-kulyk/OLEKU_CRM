import React, { useId } from 'react';
import { AlertCircleSVG, TrashSVG } from '../../../assets';
import { classNames } from '../lib';
import { Modal } from './Modal';
import { Button } from './Button';
import type { ButtonVariant } from './button-styles';

export interface IConfirmDialogProps {
  readonly title: string;
  readonly message: string;
  readonly confirmLabel: string;
  readonly cancelLabel: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
  /**
   * Called for every dismissal that isn't an explicit button choice —
   * Escape and an outside click — routed here by the composed `Modal`
   * rather than to `onConfirm`. Kept distinct from `onCancel` so the
   * calling feature, not this component, decides what dismissal means:
   * most callers pass the same handler as `onCancel`, but it need not be
   * (design.md D5).
   */
  readonly onDismiss: () => void;
  /** Shows a busy label on the confirm action and disables both buttons. */
  readonly isConfirming?: boolean;
  /** Styles the confirm action as destructive (Delete vs. Discard changes). */
  readonly isDangerous?: boolean;
}

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
 * Composes `Modal` as an `alertdialog` (design.md D5) rather than rendering
 * its own overlay, so it inherits the same initial-focus, Tab containment,
 * topmost-Escape/outside-click, and focus-restoration behavior as every
 * other dialog — including correctly restoring focus into a still-open
 * parent dialog when this confirmation is the one that closes. `titleId`/
 * `messageId` are generated per instance (`useId`) rather than fixed
 * strings, so two ConfirmDialogs never collide, stacked or not.
 */
export const ConfirmDialog: React.FC<IConfirmDialogProps> = ({
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  onDismiss,
  isConfirming = false,
  isDangerous = false,
}) => {
  const titleId = useId();
  const messageId = useId();
  const tone = CONFIRM_TONE_CONFIG[isDangerous ? 'danger' : 'accent'];

  // Mirrors the disabled Cancel/Confirm buttons below: while a confirmed
  // action is in flight, dismissal is inert altogether, not just its two
  // buttons — Escape and an outside click must not be able to close this
  // confirmation (and, through the calling feature's `onDismiss`, resume
  // interaction with whatever is underneath) while that action is still
  // running.
  const handleRequestClose = (): void => {
    if (isConfirming) {
      return;
    }

    onDismiss();
  };

  return (
    <Modal
      role='alertdialog'
      onRequestClose={handleRequestClose}
      labelledBy={titleId}
      describedBy={messageId}
      className='max-w-dialog gap-lg'
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
        <h3 id={titleId} className='text-dialog-title text-ink'>
          {title}
        </h3>
        <p id={messageId} className='text-body text-ink-secondary'>
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
    </Modal>
  );
};
