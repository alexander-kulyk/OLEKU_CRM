import { useCallback, useReducer } from 'react'
import { isApiError, isCancelledError, TRANSPORT_ERROR_CODE } from '../../../shared/api'
import type { ApiError } from '../../../shared/api'
import { archiveUser, updateUser } from '../api/users-api'
import type { UserManagementConfirmationKind } from '../config/user-management-confirmations'
import { resolveArchiveAvailability } from '../lib/resolve-archive-availability'
import { resolveUserManagementRecovery } from '../lib/resolve-user-management-recovery'
import type { UserManagementRecoveryOutcome } from '../lib/resolve-user-management-recovery'
import type { EditUserDetailState } from './edit-user-detail-state'
import { userManagementReducer } from './user-management-reducer'
import { INITIAL_USER_MANAGEMENT_STATE } from './user-management-state'
import type { UserManagementFormError } from './user-management-state'
import type { UserPatchPayload } from './user-patch'
import { useUserDetailLoader } from './use-user-detail-loader'
import type { UsersRuntimeContext } from './users-runtime-context'

export interface UseUserManagementControllerParams {
  /** design.md D6 — optional; every affected value below degrades to an explicit unavailable state when omitted. */
  readonly runtimeContext: UsersRuntimeContext | undefined
}

export interface UseUserManagementControllerResult {
  readonly values: {
    /** A transient banner shown outside the dialog (e.g. "record not found/archived elsewhere"). */
    readonly notice: string | null
    /** Bumped after a successful mutation — pass straight through to `UsersList`'s `refetchSignal`. */
    readonly refetchSignal: number
    /** `null` when no Edit User dialog should be rendered at all. */
    readonly detailState: EditUserDetailState | null
    readonly defaultPhoneRegion: string | undefined
    /** True while THIS record's save or archive request is in flight — disables the whole dialog, not just one button. */
    readonly isSaving: boolean
    readonly operationError: { readonly kind: 'form' | 'version-conflict'; readonly message: string } | null
    readonly fieldError: { readonly field: string; readonly message: string } | null
    readonly archiveIsDisabled: boolean
    readonly archiveDisabledReason: string | undefined
    readonly confirmationKind: UserManagementConfirmationKind | null
    readonly isArchiving: boolean
  }
  readonly handlers: {
    readonly onEditUser: (userId: string) => void
    readonly onDismissNotice: () => void
    readonly onSave: (userId: string, patch: UserPatchPayload) => void
    readonly onRequestClose: (isDirty: boolean) => void
    readonly onReloadLatestRequested: (isDirty: boolean) => void
    readonly onArchiveRequested: () => void
    readonly onArchiveConfirmed: () => void
    readonly onArchiveCancelled: () => void
    readonly onDiscardConfirmed: () => void
    readonly onDiscardContinue: () => void
    readonly onAcknowledge: () => void
  }
}

/** Normalizes anything caught downstream of `httpClient` into an `ApiError`, matching `use-users-list.ts`'s own guard. */
function toKnownApiError(thrown: unknown): ApiError {
  return isApiError(thrown) ? thrown : { code: TRANSPORT_ERROR_CODE }
}

/** Maps a resolved recovery outcome onto the reducer's narrower `UserManagementFormError` shape for `'save-failed'`. */
function toFormError(outcome: UserManagementRecoveryOutcome): UserManagementFormError {
  if (outcome.kind === 'field') {
    return { kind: 'field', field: outcome.field ?? '', message: outcome.message }
  }
  if (outcome.kind === 'version-conflict') {
    return { kind: 'version-conflict', message: outcome.message }
  }
  return { kind: 'form', message: outcome.message }
}

/**
 * The Users edit/archive/conflict controller (task 6.1): owns
 * `userManagementReducer`, issues every GET/PATCH/DELETE the reducer's
 * phases require, and resolves each failure through the typed recovery
 * matrix (`lib/resolve-user-management-recovery.ts`, design.md D7) before
 * dispatching its outcome. `UserManagement` (the composition component)
 * renders from this hook's `values`/`handlers` only — it owns no session
 * state of its own, mirroring `event-dialog`'s
 * `useEventDialogController`/`EventDialogForm` split.
 *
 * A 401 is delegated to `runtimeContext.onUnauthorized` (when supplied)
 * without ever resetting an in-progress save/archive's phase — the
 * reducer's `'save-unauthorized'`/`'archive-unauthorized'` actions only
 * clear the busy flag, never the open dialog or its unsaved values
 * (specs/user-management/spec.md — "Session expires with unsaved work").
 */
export function useUserManagementController({
  runtimeContext,
}: UseUserManagementControllerParams): UseUserManagementControllerResult {
  const [state, dispatch] = useReducer(userManagementReducer, INITIAL_USER_MANAGEMENT_STATE)
  const { phase } = state

  useUserDetailLoader({ phase, dispatch, runtimeContext })

  const onEditUser = useCallback((userId: string) => {
    dispatch({ type: 'edit-requested', userId })
  }, [])

  const onDismissNotice = useCallback(() => {
    dispatch({ type: 'notice-dismissed' })
  }, [])

  const onRequestClose = useCallback((isDirty: boolean) => {
    dispatch({ type: 'close-requested', isDirty })
  }, [])

  const onReloadLatestRequested = useCallback((isDirty: boolean) => {
    dispatch({ type: 'reload-latest-requested', isDirty })
  }, [])

  const onDiscardConfirmed = useCallback(() => {
    dispatch({ type: 'discard-confirm-discard' })
  }, [])

  const onDiscardContinue = useCallback(() => {
    dispatch({ type: 'discard-confirm-continue' })
  }, [])

  const onAcknowledge = useCallback(() => {
    dispatch({ type: 'archived-acknowledge-confirmed' })
  }, [])

  const onArchiveRequested = useCallback(() => {
    dispatch({ type: 'archive-requested' })
  }, [])

  const onArchiveCancelled = useCallback(() => {
    dispatch({ type: 'archive-cancelled' })
  }, [])

  const onSave = useCallback(
    async (userId: string, patch: UserPatchPayload) => {
      dispatch({ type: 'save-started' })

      try {
        await updateUser(userId, patch)
        dispatch({ type: 'save-succeeded' })
      } catch (thrown) {
        if (isCancelledError(thrown)) {
          dispatch({ type: 'save-cancelled' })
          return
        }

        const error = toKnownApiError(thrown)

        if (error.status === 401) {
          const hasRecovery = Boolean(runtimeContext?.onUnauthorized)
          runtimeContext?.onUnauthorized?.()
          dispatch({ type: 'save-unauthorized', hasRecovery })
          return
        }

        const outcome = resolveUserManagementRecovery('save-user', error)

        if (outcome.kind === 'record-archived') {
          dispatch({ type: 'save-archived-elsewhere' })
          return
        }

        dispatch({ type: 'save-failed', outcome: toFormError(outcome) })
      }
    },
    [runtimeContext],
  )

  const onArchiveConfirmed = useCallback(async () => {
    if (phase.type !== 'editing') {
      return
    }

    const userId = phase.detail.id
    dispatch({ type: 'archive-started' })

    try {
      await archiveUser(userId)
      dispatch({ type: 'archive-succeeded' })
    } catch (thrown) {
      if (isCancelledError(thrown)) {
        dispatch({ type: 'archive-cancelled-silent' })
        return
      }

      const error = toKnownApiError(thrown)

      if (error.status === 401) {
        const hasRecovery = Boolean(runtimeContext?.onUnauthorized)
        runtimeContext?.onUnauthorized?.()
        dispatch({ type: 'archive-unauthorized', hasRecovery })
        return
      }

      const outcome = resolveUserManagementRecovery('archive-user', error)
      dispatch({ type: 'archive-failed', message: outcome.message })
    }
  }, [phase, runtimeContext])

  const detailState: EditUserDetailState | null =
    phase.type === 'detail-loading'
      ? { status: 'loading' }
      : phase.type === 'editing'
        ? { status: 'ready', detail: phase.detail }
        : null

  const isEditing = phase.type === 'editing'
  const archiveAvailability = isEditing
    ? resolveArchiveAvailability(runtimeContext?.currentOperatorId, phase.detail.id)
    : { isDisabled: true, disabledReason: undefined }

  return {
    values: {
      notice: state.notice,
      refetchSignal: state.refetchToken,
      detailState,
      defaultPhoneRegion: runtimeContext?.defaultPhoneRegion,
      isSaving: isEditing && (phase.isSaving || phase.isArchiving),
      operationError:
        isEditing && phase.formError && phase.formError.kind !== 'field'
          ? { kind: phase.formError.kind, message: phase.formError.message }
          : null,
      fieldError:
        isEditing && phase.formError?.kind === 'field'
          ? { field: phase.formError.field, message: phase.formError.message }
          : null,
      archiveIsDisabled: archiveAvailability.isDisabled || (isEditing && (phase.isSaving || phase.isArchiving)),
      archiveDisabledReason: archiveAvailability.disabledReason,
      confirmationKind: isEditing ? phase.confirmation : null,
      isArchiving: isEditing && phase.isArchiving,
    },
    handlers: {
      onEditUser,
      onDismissNotice,
      onSave,
      onRequestClose,
      onReloadLatestRequested,
      onArchiveRequested,
      onArchiveConfirmed,
      onArchiveCancelled,
      onDiscardConfirmed,
      onDiscardContinue,
      onAcknowledge,
    },
  }
}
