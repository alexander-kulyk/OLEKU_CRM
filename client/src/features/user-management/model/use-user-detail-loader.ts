import { useEffect } from 'react'
import type { Dispatch } from 'react'
import { isApiError, isCancelledError, TRANSPORT_ERROR_CODE } from '../../../shared/api'
import type { ApiError } from '../../../shared/api'
import { readUserDetail } from '../api/users-api'
import { USER_MANAGEMENT_COPY } from '../config/user-management-copy'
import { resolveUserManagementRecovery } from '../lib/resolve-user-management-recovery'
import type { UserManagementAction, UserManagementPhase } from './user-management-state'
import type { UsersRuntimeContext } from './users-runtime-context'

export interface UseUserDetailLoaderParams {
  readonly phase: UserManagementPhase
  readonly dispatch: Dispatch<UserManagementAction>
  readonly runtimeContext: UsersRuntimeContext | undefined
}

/**
 * The detail-before-edit / version-conflict "Reload latest" read
 * (specs/user-management/spec.md — "Editing starts from current detail
 * data"; task 6.3 "Reload latest"): issues `GET /api/users/:userId`
 * whenever `useUserManagementController`'s reducer enters
 * `'detail-loading'`, keyed by `requestId` — not `userId` alone — so
 * reloading the SAME user id after a version conflict still issues a fresh
 * request. Split out of `use-user-management-controller.ts` to keep both
 * files under the package's 250-line cap.
 */
export function useUserDetailLoader({ phase, dispatch, runtimeContext }: UseUserDetailLoaderParams): void {
  const requestId = phase.type === 'detail-loading' ? phase.requestId : null

  useEffect(() => {
    if (phase.type !== 'detail-loading') {
      return
    }

    const controller = new AbortController()

    readUserDetail(phase.userId, controller.signal)
      .then((detail) => {
        if (detail.archivedAt !== null) {
          // Not an error code — a successful read reporting an archived
          // record (specs/user-management/spec.md — "Selected row was
          // archived elsewhere").
          dispatch({
            type: 'detail-unavailable',
            message: USER_MANAGEMENT_COPY.recordArchivedElsewhere,
            shouldRefetch: true,
          })
          return
        }
        dispatch({ type: 'detail-loaded', detail })
      })
      .catch((thrown: unknown) => {
        if (isCancelledError(thrown)) {
          dispatch({ type: 'detail-load-cancelled' })
          return
        }

        const error: ApiError = isApiError(thrown) ? thrown : { code: TRANSPORT_ERROR_CODE }

        if (error.status === 401) {
          runtimeContext?.onUnauthorized?.()
        }

        const outcome = resolveUserManagementRecovery('read-user-detail', error)
        dispatch({
          type: 'detail-unavailable',
          message: outcome.message,
          shouldRefetch: outcome.kind === 'record-not-found',
        })
      })

    return () => {
      controller.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId])
}
