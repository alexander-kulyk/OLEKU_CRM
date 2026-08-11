import { useEffect } from 'react'
import type { FC, MouseEvent, ReactNode } from 'react'

interface ModalProps {
  /**
   * Called when the user presses Escape or clicks the backdrop outside the
   * panel. The caller decides what "close" means — close immediately, or
   * gate it behind a confirmation — this component only reports the
   * attempt (specs/event-management/spec.md — "Closing the dialog protects
   * unsaved work").
   */
  readonly onRequestClose: () => void
  readonly labelledBy?: string
  readonly children: ReactNode
}

/**
 * A generic modal overlay: a full-viewport backdrop centering a scrollable
 * panel. Project-agnostic — reused by any feature that needs a modal, not
 * just the Event dialog (design.md D1: `shared/ui` primitives).
 */
export const Modal: FC<ModalProps> = ({ onRequestClose, labelledBy, children }) => {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        onRequestClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onRequestClose])

  const handleOverlayMouseDown = (event: MouseEvent<HTMLDivElement>): void => {
    // Only a click that both starts and ends on the backdrop itself counts
    // as "outside" — a click that lands on the panel never bubbles here
    // with `currentTarget` equal to `target`.
    if (event.target === event.currentTarget) {
      onRequestClose()
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-text/50 p-md"
      onMouseDown={handleOverlayMouseDown}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className="flex max-h-full w-full max-w-lg flex-col gap-lg overflow-y-auto rounded-lg bg-surface p-lg shadow-lg"
      >
        {children}
      </div>
    </div>
  )
}
