import { useEffect } from 'react';
import type { FC, MouseEvent, ReactNode } from 'react';

interface ModalProps {
  readonly onRequestClose: () => void;
  readonly labelledBy?: string;
  readonly children: ReactNode;
}

export const Modal: FC<ModalProps> = ({
  onRequestClose,
  labelledBy,
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

  const handleOverlayMouseDown = (event: MouseEvent<HTMLDivElement>): void => {
    // Only a click that both starts and ends on the backdrop itself counts
    // as "outside" — a click that lands on the panel never bubbles here
    // with `currentTarget` equal to `target`.
    if (event.target === event.currentTarget) {
      onRequestClose();
    }
  };

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center bg-text/50 p-md'
      onMouseDown={handleOverlayMouseDown}
    >
      <div
        role='dialog'
        aria-modal='true'
        aria-labelledby={labelledBy}
        className='flex max-h-full w-full max-w-modal flex-col gap-lg overflow-y-auto rounded-lg bg-surface p-lg shadow-lg'
      >
        {children}
      </div>
    </div>
  );
};
