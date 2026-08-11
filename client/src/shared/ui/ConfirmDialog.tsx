import type { FC } from 'react'

interface ConfirmDialogProps {
  readonly title: string
  readonly message: string
  readonly confirmLabel: string
  readonly cancelLabel: string
  readonly onConfirm: () => void
  readonly onCancel: () => void
  /** Shows a busy label on the confirm action and disables both buttons. */
  readonly isConfirming?: boolean
  /** Styles the confirm action as destructive (Delete vs. Discard changes). */
  readonly isDangerous?: boolean
}

const TITLE_ID = 'confirm-dialog-title'

/**
 * A small, purpose-built confirmation overlay — Cancel/Delete and Continue
 * editing/Discard changes both use this same shape with different copy
 * (specs/event-management/spec.md). Deliberately does not wire Escape or an
 * outside click to either button: the spec only offers the two named
 * actions, so a third implicit "close" outcome is not introduced.
 */
export const ConfirmDialog: FC<ConfirmDialogProps> = ({
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  isConfirming = false,
  isDangerous = false,
}) => {
  const confirmButtonClassName = isDangerous
    ? 'rounded-md bg-danger px-md py-sm text-sm font-medium text-white hover:bg-danger/90 disabled:cursor-not-allowed disabled:opacity-60'
    : 'rounded-md bg-primary-600 px-md py-sm text-sm font-medium text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60'

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-text/50 p-md">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={TITLE_ID}
        className="w-full max-w-dialog rounded-lg bg-surface p-lg shadow-lg"
      >
        <h3 id={TITLE_ID} className="text-lg font-semibold text-text">
          {title}
        </h3>
        <p className="mt-sm text-sm text-text-muted">{message}</p>
        <div className="mt-lg flex justify-end gap-sm">
          <button
            type="button"
            onClick={onCancel}
            disabled={isConfirming}
            className="rounded-md border border-border px-md py-sm text-sm font-medium text-text hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isConfirming}
            className={confirmButtonClassName}
          >
            {isConfirming ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
