import type { FC } from 'react'
import type { EditUserDetailState } from '../model/edit-user-detail-state'
import type { UserPatchPayload } from '../model/user-patch'
import { EditUserDialogLoading } from './EditUserDialogLoading'
import { EditUserForm } from './EditUserForm'

export interface EditUserDialogProps {
  readonly detailState: EditUserDetailState
  /** The deployment-wide default phone region (design.md D6) — never inferred from the browser. */
  readonly defaultPhoneRegion: string | undefined
  /** Whether the caller's `PATCH /api/users/:userId` request is in flight (Stage 6 owns issuing it). */
  readonly isSaving: boolean
  /** Called with a real, non-null patch for a dirty valid form. */
  readonly onSave: (userId: string, patch: UserPatchPayload) => void
  /**
   * Called on every dismissal attempt (Close, outside click, Escape) with
   * whether the form is normalized-dirty. The caller decides what a dirty
   * attempt means — Stage 5 never renders a discard confirmation itself.
   */
  readonly onRequestClose: (isDirty: boolean) => void
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
      key={detailState.detail.id}
      detail={detailState.detail}
      defaultPhoneRegion={defaultPhoneRegion}
      isSaving={isSaving}
      onSave={onSave}
      onRequestClose={onRequestClose}
      titleId={DIALOG_TITLE_ID}
    />
  )
}
