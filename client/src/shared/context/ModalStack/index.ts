// Public API for the `shared/context/ModalStack` segment. `ModalStackProvider`
// is mounted once at the application root; `useModalStackEntry` is consumed
// by `shared/ui/Modal` only — nothing else needs to know a stack exists.
export { ModalStackProvider } from './ModalStackProvider';
export type { IModalStackProviderProps } from './ModalStackProvider';

export { useModalStackEntry } from './use-modal-stack-entry';
export type { IUseModalStackEntryResult } from './use-modal-stack-entry';
