import type { FC } from 'react'
import { ConfirmDialog } from '../../../shared/ui'
import { USER_MANAGEMENT_CONFIRMATION_CONFIG } from '../config/user-management-confirmations'
import type { UserManagementConfirmationKind } from '../config/user-management-confirmations'
import { useUserManagementController } from '../model/use-user-management-controller'
import type { UsersRuntimeContext } from '../model/users-runtime-context'
import { EditUserDialog } from './EditUserDialog'
import { UserManagementNotice } from './UserManagementNotice'
import { UsersList } from './UsersList'

export interface UserManagementProps {
  /** The optional runtime-context injection seam (design.md D6) — see `UsersRuntimeContext`'s own doc comment. */
  readonly runtimeContext?: UsersRuntimeContext
}

interface ConfirmationActions {
  readonly onConfirm: () => void
  readonly onCancel: () => void
}

/**
 * (confirmation kind) -> the two handlers that close it (data-driven-
 * rendering skill; design.md D5). `'discard-close'`/`'discard-reload'`
 * share one pair of reducer actions — the reducer itself already knows
 * which detail-loading target a discarded reload re-fetches — and
 * `'archived-acknowledge'` funnels both its buttons into the same
 * acknowledgement, since there is nothing left to choose between.
 */
function buildConfirmationActions(
  handlers: ReturnType<typeof useUserManagementController>['handlers'],
): Readonly<Record<UserManagementConfirmationKind, ConfirmationActions>> {
  return {
    archive: { onConfirm: handlers.onArchiveConfirmed, onCancel: handlers.onArchiveCancelled },
    'discard-close': { onConfirm: handlers.onDiscardConfirmed, onCancel: handlers.onDiscardContinue },
    'discard-reload': { onConfirm: handlers.onDiscardConfirmed, onCancel: handlers.onDiscardContinue },
    'archived-acknowledge': { onConfirm: handlers.onAcknowledge, onCancel: handlers.onAcknowledge },
  }
}

/**
 * The Users feature's controller-composed entry point (task 6.1): wires
 * `useUserManagementController` to the Stage 4 list (Edit action + mutation
 * refetch), the Stage 5 Edit User dialog (conflict/archive/runtime-context
 * props Stage 5 left as a pure seam), and one config-driven stacked
 * confirmation. Ready for Stage 7 to compose into `pages/users` behind this
 * feature's public API — it owns no routing of its own.
 */
export const UserManagement: FC<UserManagementProps> = ({ runtimeContext }) => {
  const { values, handlers } = useUserManagementController({ runtimeContext })
  const confirmationActions = buildConfirmationActions(handlers)

  return (
    <div className='flex flex-col gap-lg'>
      {values.notice && <UserManagementNotice message={values.notice} onDismiss={handlers.onDismissNotice} />}

      <UsersList onEditUser={handlers.onEditUser} refetchSignal={values.refetchSignal} />

      {values.detailState && (
        <EditUserDialog
          detailState={values.detailState}
          defaultPhoneRegion={values.defaultPhoneRegion}
          isSaving={values.isSaving}
          onSave={handlers.onSave}
          onRequestClose={handlers.onRequestClose}
          operationError={values.operationError}
          fieldError={values.fieldError}
          onReloadLatestRequested={handlers.onReloadLatestRequested}
          archive={{
            isDisabled: values.archiveIsDisabled,
            disabledReason: values.archiveDisabledReason,
            onRequest: handlers.onArchiveRequested,
          }}
        />
      )}

      {values.confirmationKind && (
        <ConfirmDialog
          {...USER_MANAGEMENT_CONFIRMATION_CONFIG[values.confirmationKind]}
          isConfirming={values.confirmationKind === 'archive' && values.isArchiving}
          onConfirm={confirmationActions[values.confirmationKind].onConfirm}
          onCancel={confirmationActions[values.confirmationKind].onCancel}
          onDismiss={confirmationActions[values.confirmationKind].onCancel}
        />
      )}
    </div>
  )
}
