import type { UserManagementConfirmationKind } from '../config/user-management-confirmations'
import type { UserDetailDto } from './user-dto'

/**
 * A failure to show inside the still-open Edit User dialog (design.md D7).
 * `'field'` is rendered inline on the named input (Stage 5's `errors`
 * mechanism, via `useEditUserForm`'s injected `fieldError`); `'form'`/
 * `'version-conflict'` render as one operation-level banner, the latter
 * additionally offering the guarded "Reload latest" action.
 */
export type UserManagementFormError =
  | { readonly kind: 'field'; readonly field: string; readonly message: string }
  | { readonly kind: 'form'; readonly message: string }
  | { readonly kind: 'version-conflict'; readonly message: string }

/**
 * The controller's explicit session phases (design.md D5 — "The feature
 * controller uses a reducer with explicit phases for closed, detail
 * loading, editing, save pending, archive confirmation/pending, discard
 * confirmation, and archived acknowledgement"). Save/archive-pending and the
 * four stacked confirmations are not separate phases here — they are
 * orthogonal fields on `'editing'` (`isSaving`/`isArchiving`/`confirmation`)
 * so a confirmation never has to remember or re-derive which detail it is
 * stacked on top of.
 */
export type UserManagementPhase =
  | { readonly type: 'closed' }
  | { readonly type: 'detail-loading'; readonly userId: string; readonly requestId: number }
  | {
      readonly type: 'editing'
      readonly detail: UserDetailDto
      readonly isSaving: boolean
      readonly isArchiving: boolean
      readonly formError: UserManagementFormError | null
      readonly confirmation: UserManagementConfirmationKind | null
    }

export interface UserManagementState {
  readonly phase: UserManagementPhase
  /** A transient notice shown outside the dialog (e.g. "record not found"), independent of `phase`. */
  readonly notice: string | null
  /** Bumped whenever the list must refetch its canonical query — `UsersList`'s own refetch signal (task 6.1). */
  readonly refetchToken: number
  /** Monotonic source for `detail-loading`'s `requestId`, so re-entering that phase for the SAME user id is still a distinct, effect-triggering request. */
  readonly requestSeq: number
}

export const INITIAL_USER_MANAGEMENT_STATE: UserManagementState = {
  phase: { type: 'closed' },
  notice: null,
  refetchToken: 0,
  requestSeq: 0,
}

export type UserManagementAction =
  | { readonly type: 'edit-requested'; readonly userId: string }
  | { readonly type: 'detail-loaded'; readonly detail: UserDetailDto }
  | { readonly type: 'detail-unavailable'; readonly message: string; readonly shouldRefetch: boolean }
  | { readonly type: 'detail-load-cancelled' }
  | { readonly type: 'close-requested'; readonly isDirty: boolean }
  | { readonly type: 'discard-confirm-continue' }
  | { readonly type: 'discard-confirm-discard' }
  | { readonly type: 'save-started' }
  | { readonly type: 'save-cancelled' }
  | { readonly type: 'save-succeeded' }
  | { readonly type: 'save-failed'; readonly outcome: UserManagementFormError }
  | { readonly type: 'save-archived-elsewhere' }
  | { readonly type: 'save-unauthorized'; readonly hasRecovery: boolean }
  | { readonly type: 'reload-latest-requested'; readonly isDirty: boolean }
  | { readonly type: 'archive-requested' }
  | { readonly type: 'archive-cancelled' }
  | { readonly type: 'archive-started' }
  | { readonly type: 'archive-cancelled-silent' }
  | { readonly type: 'archive-succeeded' }
  | { readonly type: 'archive-failed'; readonly message: string }
  | { readonly type: 'archive-unauthorized'; readonly hasRecovery: boolean }
  | { readonly type: 'archived-acknowledge-confirmed' }
  | { readonly type: 'notice-dismissed' }
