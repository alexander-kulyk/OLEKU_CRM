import React, { useLayoutEffect, useRef } from 'react';
import { useModalStackEntry } from '../context/ModalStack';
import { classNames } from '../lib';
import { getFocusableElements } from './get-focusable-elements';

export interface IModalProps {
  readonly onRequestClose: () => void;
  readonly labelledBy?: string;
  /** Ties the dialog's body text to it — e.g. `ConfirmDialog`'s message. */
  readonly describedBy?: string;
  /** `alertdialog` for a confirmation that demands an explicit choice. */
  readonly role?: 'dialog' | 'alertdialog';
  /** Widens or narrows the panel; defaults to the kit's standard dialog width. */
  readonly className?: string;
  readonly children: React.ReactNode;
}

const BACKDROP_CLASS_NAME =
  'fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-lg backdrop-blur-[2px]';
const PANEL_CLASS_NAME = [
  'flex max-h-full w-full max-w-modal flex-col gap-xl overflow-y-auto',
  'rounded-lg bg-surface p-xl shadow-overlay',
  // Only a fallback focus target when the panel has no focusable
  // descendant — never part of the visible focus ring for a normal field.
  'focus:outline-none',
].join(' ');

/**
 * The overlay every dialog sits on (assets/ui_kit/overlays and feedback.png):
 * one elevation step above the page, a dimmed and lightly blurred backdrop,
 * and a 14px-radius surface panel.
 *
 * Closing is always the caller's decision — Escape and a backdrop click both
 * report up through `onRequestClose` rather than unmounting anything here, so
 * a form with unsaved changes can intercept them. Both are gated by
 * `useModalStackEntry` so only the topmost of several stacked dialogs ever
 * reacts (design.md D5) — a discard confirmation above this panel makes both
 * routes here no-ops until it closes.
 *
 * Also owns the rest of the WAI-ARIA APG Dialog contract generically: moves
 * focus to the first focusable descendant (or the panel itself) on open,
 * traps Tab/Shift+Tab within the panel while topmost, and restores focus to
 * whatever was focused immediately before this dialog opened once it
 * unmounts — the same mechanism whether that is a page-level trigger button
 * (a lone dialog closing) or a control inside a still-open parent dialog (a
 * stacked confirmation closing).
 */
export const Modal: React.FC<IModalProps> = ({
  onRequestClose,
  labelledBy,
  describedBy,
  role = 'dialog',
  className,
  children,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const { isTopmost } = useModalStackEntry();

  // Runs before paint so there is no visible flash of the dialog sitting
  // unfocused (react-anti-patterns: a legitimate DOM-synchronization effect,
  // not a derived-state one).
  useLayoutEffect(() => {
    const previouslyFocusedElement = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const [firstFocusable] = panel ? getFocusableElements(panel) : [];

    (firstFocusable ?? panel)?.focus();

    return () => {
      if (previouslyFocusedElement && document.contains(previouslyFocusedElement)) {
        previouslyFocusedElement.focus();
      }
    };
  }, []);

  const handlePanelKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (!isTopmost) {
      return;
    }

    if (event.key === 'Escape') {
      onRequestClose();
      return;
    }

    if (event.key !== 'Tab' || !panelRef.current) {
      return;
    }

    const focusable = getFocusableElements(panelRef.current);

    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const handleOverlayMouseDown = (event: React.MouseEvent<HTMLDivElement>): void => {
    if (!isTopmost) {
      return;
    }

    // Only a click that both starts and ends on the backdrop itself counts
    // as "outside" — a click that lands on the panel never bubbles here
    // with `currentTarget` equal to `target`.
    if (event.target === event.currentTarget) {
      onRequestClose();
    }
  };

  return (
    <div className={BACKDROP_CLASS_NAME} onMouseDown={handleOverlayMouseDown}>
      <div
        ref={panelRef}
        role={role}
        aria-modal='true'
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        tabIndex={-1}
        onKeyDown={handlePanelKeyDown}
        className={classNames(PANEL_CLASS_NAME, className)}
      >
        {children}
      </div>
    </div>
  );
};
