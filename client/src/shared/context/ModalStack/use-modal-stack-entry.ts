import { useContext, useId, useLayoutEffect } from 'react';
import { ModalStackContext } from './ModalStackContext';

export interface IUseModalStackEntryResult {
  /**
   * Whether this call site is currently the topmost registered dialog — the
   * single flag `Modal` gates Escape, outside-click dismissal, and Tab/
   * Shift+Tab containment behind (design.md D5).
   */
  readonly isTopmost: boolean;
}

/**
 * Registers one open dialog with the shared modal stack (`ModalStackContext`)
 * for the lifetime of the calling component. A stable token is generated
 * once per mount via `useId`; registration runs in a layout effect so the
 * stack — and therefore `isTopmost` — is correct before the browser paints,
 * with no visible flash of an unowned dialog.
 */
export function useModalStackEntry(): IUseModalStackEntryResult {
  const token = useId();
  const { registerModal, unregisterModal, isTopmostModal } =
    useContext(ModalStackContext);

  useLayoutEffect(() => {
    registerModal(token);

    return () => {
      unregisterModal(token);
    };
  }, [token, registerModal, unregisterModal]);

  return { isTopmost: isTopmostModal(token) };
}
