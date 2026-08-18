import type React from 'react';
import { useCallback, useMemo, useState } from 'react';
import { ModalStackContext } from './ModalStackContext';
import type { IModalStackContextValue } from './ModalStackContext';

export interface IModalStackProviderProps {
  readonly children: React.ReactNode;
}

/**
 * The single registry every `Modal` instance registers with while it is
 * open (design.md D5): a project-agnostic ordered stack of stable tokens,
 * one per currently mounted dialog, in the order they opened. The
 * last-registered token is topmost, and topmost is the only entry a `Modal`
 * lets own Escape, outside-click dismissal, and focus containment — so two
 * stacked dialogs (an Edit form and a confirmation above it) never both
 * react to the same key press.
 *
 * Mounted exactly once, at the application root (`app/App.tsx`), so every
 * dialog anywhere in the tree shares the same stack rather than each
 * inventing its own uncoordinated document listener.
 */
export const ModalStackProvider: React.FC<IModalStackProviderProps> = ({
  children,
}) => {
  const [stack, setStack] = useState<readonly string[]>([]);

  const registerModal = useCallback((token: string): void => {
    setStack((current) =>
      current.includes(token) ? current : [...current, token],
    );
  }, []);

  const unregisterModal = useCallback((token: string): void => {
    setStack((current) => current.filter((entry) => entry !== token));
  }, []);

  const isTopmostModal = useCallback(
    (token: string): boolean =>
      stack.length > 0 && stack[stack.length - 1] === token,
    [stack],
  );

  const value = useMemo<IModalStackContextValue>(
    () => ({ registerModal, unregisterModal, isTopmostModal }),
    [registerModal, unregisterModal, isTopmostModal],
  );

  return (
    <ModalStackContext.Provider value={value}>
      {children}
    </ModalStackContext.Provider>
  );
};
