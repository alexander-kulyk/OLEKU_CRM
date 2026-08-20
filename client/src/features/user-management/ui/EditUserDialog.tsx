import type { FC } from 'react'
import type { EditUserDetailState } from '../model/edit-user-detail-state'
import type { UserPatchPayload } from '../model/user-patch'
import { EditUserDialogLoading } from './EditUserDialogLoading'
import { EditUserForm } from './EditUserForm'

/** An operation-level failure to show inside the still-open dialog (Stage 6's recovery matrix, design.md D7). */
export interface EditUserOperationError {
  readonly kind: 'form' | 'version-conflict'
  readonly message: string
}

/** A field-level server error to attach inline (e.g. a duplicate email). */
export interface EditUserFieldErrorProp {
  readonly field: string
  readonly message: string
}

export interface EditUserArchiveAction {
  readonly isDisabled: boolean
  readonly disabledReason: string | undefined
  readonly onRequest: () => void
}

export interface EditUserDialogProps {
  readonly detailState: EditUserDetailState
  /** The deployment-wide default phone region (design.md D6) — never inferred from the browser. */
  readonly defaultPhoneRegion: string | undefined
  /** Whether the caller's `PATCH`/`DELETE` request for this record is in flight (Stage 6 owns issuing it). */
  readonly isSaving: boolean
  /** Called with a real, non-null patch for a dirty valid form. */
  readonly onSave: (userId: string, patch: UserPatchPayload) => void
  /**
   * Called on every dismissal attempt (Close, outside click, Escape) with
   * whether the form is normalized-dirty. The caller decides what a dirty
   * attempt means — Stage 5 never renders a discard confirmation itself.
   */
  readonly onRequestClose: (isDirty: boolean) => void
  /**
   * `null`/omitted when there is no operation-level failure to show.
   * Optional so a caller with nothing to report (and Stage 5's own tests)
   * need not thread it through.
   */
  readonly operationError?: EditUserOperationError | null
  /** `null`/omitted when there is no field-level failure to attach. */
  readonly fieldError?: EditUserFieldErrorProp | null
  /** Reports the form's live dirty state so the caller can guard a version-conflict reload with a discard confirmation. */
  readonly onReloadLatestRequested?: (isDirty: boolean) => void
  /** Omitted defaults to a disabled, unexplained Archive action — never enabled without an explicit caller decision. */
  readonly archive?: EditUserArchiveAction
}

const NOOP_RELOAD_LATEST_REQUESTED = (): void => {}
const DEFAULT_ARCHIVE_ACTION: EditUserArchiveAction = {
  isDisabled: true,
  disabledReason: undefined,
  onRequest: (): void => {},
}

const DIALOG_TITLE_ID = 'edit-user-dialog-title'

/**
 * The Edit User dialog's entry point (task 5.3): renders either the
 * detail-before-edit loading placeholder or the bound `EditUserForm`,
 * depending on `detailState` (`model/edit-user-detail-state.ts`). Neither
 * issues the `GET /api/users/:userId` read nor decides when to mount at
 * all — a caller (Stage 6's controller) supplies `detailState` and this
 * component only ever renders what it is given
 * (openspec/changes/add-users-client-ui/tasks.md task 6.1).
 *
 * Renders no `Modal` of its own: each branch owns one (see
 * `EditUserDialogLoading`/`EditUserForm`'s doc comments) so `Modal`'s
 * `onRequestClose` always comes from that branch's own accurate source —
 * a form's live normalized-dirty state once one exists — never a parent
 * guessing which phase is currently live.
 */
export const EditUserDialog: FC<EditUserDialogProps> = ({
  detailState,
  defaultPhoneRegion,
  isSaving,
  onSave,
  onRequestClose,
  operationError = null,
  fieldError = null,
  onReloadLatestRequested = NOOP_RELOAD_LATEST_REQUESTED,
  archive = DEFAULT_ARCHIVE_ACTION,
}) => {
  const handleLoadingRequestClose = (): void => {
    // Nothing to compare against yet while detail is still loading — never dirty.
    onRequestClose(false)
  }

  if (detailState.status === 'loading') {
    return <EditUserDialogLoading titleId={DIALOG_TITLE_ID} onRequestClose={handleLoadingRequestClose} />
  }

  return (
    <EditUserForm
      // Includes `version`, not just `id`, so a version-conflict reload —
      // which fetches a NEW detail for the SAME user id — remounts this
      // form (and `useEditUserForm`'s "hydrate once" state) fresh instead
      // of silently keeping the stale pre-conflict session alive
      // (task 6.3 "Reload latest").
      key={`${detailState.detail.id}:${detailState.detail.version}`}
      detail={detailState.detail}
      defaultPhoneRegion={defaultPhoneRegion}
      isSaving={isSaving}
      onSave={onSave}
      onRequestClose={onRequestClose}
      operationError={operationError}
      fieldError={fieldError}
      onReloadLatestRequested={onReloadLatestRequested}
      archive={archive}
      titleId={DIALOG_TITLE_ID}
    />
  )
}
