import React, { useEffect } from 'react';
import { classNames } from '../lib';

export interface IModalProps {
  readonly onRequestClose: () => void;
  readonly labelledBy?: string;
  /** Widens or narrows the panel; defaults to the kit's standard dialog width. */
  readonly className?: string;
  readonly children: React.ReactNode;
}

const BACKDROP_CLASS_NAME =
  'fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-lg backdrop-blur-[2px]';
const PANEL_CLASS_NAME = [
  'flex max-h-full w-full max-w-modal flex-col gap-xl overflow-y-auto',
  'rounded-lg bg-surface p-xl shadow-overlay',
].join(' ');

/**
 * The overlay every dialog sits on (assets/ui_kit/overlays and feedback.png):
 * one elevation step above the page, a dimmed and lightly blurred backdrop,
 * and a 14px-radius surface panel.
 *
 * Closing is always the caller's decision — Escape and a backdrop click both
 * report up through `onRequestClose` rather than unmounting anything here, so
 * a form with unsaved changes can intercept them.
 */
export const Modal: React.FC<IModalProps> = ({
  onRequestClose,
  labelledBy,
  className,
  children,
}) => {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        onRequestClose();
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onRequestClose]);

  const handleOverlayMouseDown = (event: React.MouseEvent<HTMLDivElement>): void => {
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
        role='dialog'
        aria-modal='true'
        aria-labelledby={labelledBy}
        className={classNames(PANEL_CLASS_NAME, className)}
      >
        {children}
      </div>
    </div>
  );
};
