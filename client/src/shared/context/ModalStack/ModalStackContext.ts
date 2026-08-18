import { createContext } from 'react';

export interface IModalStackContextValue {
  readonly registerModal: (token: string) => void;
  readonly unregisterModal: (token: string) => void;
  readonly isTopmostModal: (token: string) => boolean;
}

/**
 * The value a `Modal` sees when it renders without `ModalStackProvider`
 * mounted above it — an isolated unit test, most often. Registration is a
 * no-op and every token reports itself topmost, which is the correct
 * behavior for exactly one dialog. Real multi-dialog stacking requires the
 * provider mounted once at the application root (design.md D5) so every
 * dialog shares one stack.
 */
const DEFAULT_CONTEXT_VALUE: IModalStackContextValue = {
  registerModal: () => {},
  unregisterModal: () => {},
  isTopmostModal: () => true,
};

export const ModalStackContext =
  createContext<IModalStackContextValue>(DEFAULT_CONTEXT_VALUE);
