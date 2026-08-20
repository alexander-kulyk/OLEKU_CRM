import { USER_MANAGEMENT_COPY } from '../config/user-management-copy'
import type { UserManagementAction, UserManagementState } from './user-management-state'

/**
 * Pure state machine for one Users edit/archive session (task 6.1). Every
 * transition is guarded by the phase it applies to, so a stale/duplicate
 * dispatch (e.g. a superseded detail read's completion, or a second click
 * past a synchronous guard) is a no-op rather than corrupting a newer
 * session — the same "guard every completion" discipline
 * `users-list-request-reducer.ts` already applies to the list's own
 * request lifecycle.
 */
export function userManagementReducer(
  state: UserManagementState,
  action: UserManagementAction,
): UserManagementState {
  switch (action.type) {
    case 'edit-requested': {
      if (state.phase.type !== 'closed') {
        return state
      }
      const requestId = state.requestSeq + 1
      return {
        ...state,
        phase: { type: 'detail-loading', userId: action.userId, requestId },
        notice: null,
        requestSeq: requestId,
      }
    }

    case 'detail-loaded': {
      if (state.phase.type !== 'detail-loading') {
        return state
      }
      return {
        ...state,
        phase: {
          type: 'editing',
          detail: action.detail,
          isSaving: false,
          isArchiving: false,
          formError: null,
          confirmation: null,
        },
      }
    }

    case 'detail-unavailable': {
      if (state.phase.type !== 'detail-loading') {
        return state
      }
      return {
        ...state,
        phase: { type: 'closed' },
        notice: action.message,
        refetchToken: action.shouldRefetch ? state.refetchToken + 1 : state.refetchToken,
      }
    }

    case 'detail-load-cancelled':
      // The client's own cancellation (a superseded reload) — never a
      // visible failure (specs/user-management/spec.md — "Expected internal
      // cancellation SHALL not be presented as a transport failure").
      return state

    case 'close-requested': {
      if (state.phase.type !== 'editing') {
        return state
      }
      return action.isDirty
        ? { ...state, phase: { ...state.phase, confirmation: 'discard-close' } }
        : { ...state, phase: { type: 'closed' } }
    }

    case 'discard-confirm-continue': {
      if (state.phase.type !== 'editing') {
        return state
      }
      return { ...state, phase: { ...state.phase, confirmation: null } }
    }

    case 'discard-confirm-discard': {
      if (state.phase.type !== 'editing' || state.phase.confirmation === null) {
        return state
      }
      if (state.phase.confirmation === 'discard-reload') {
        const requestId = state.requestSeq + 1
        return {
          ...state,
          phase: { type: 'detail-loading', userId: state.phase.detail.id, requestId },
          requestSeq: requestId,
        }
      }
      // confirmation === 'discard-close'
      return { ...state, phase: { type: 'closed' } }
    }

    case 'save-started': {
      if (state.phase.type !== 'editing') {
        return state
      }
      return { ...state, phase: { ...state.phase, isSaving: true, formError: null } }
    }

    case 'save-cancelled': {
      if (state.phase.type !== 'editing') {
        return state
      }
      return { ...state, phase: { ...state.phase, isSaving: false } }
    }

    case 'save-succeeded':
      // specs/user-management/spec.md — "Save outcomes preserve server
      // truth and unsaved work": close and refetch the canonical query
      // rather than mutating a paginated row locally.
      return { ...state, phase: { type: 'closed' }, notice: null, refetchToken: state.refetchToken + 1 }

    case 'save-failed': {
      if (state.phase.type !== 'editing') {
        return state
      }
      return { ...state, phase: { ...state.phase, isSaving: false, formError: action.outcome } }
    }

    case 'save-archived-elsewhere': {
      if (state.phase.type !== 'editing') {
        return state
      }
      // USER_ARCHIVED: preserve the form until acknowledged, then close +
      // refetch (below, on 'archived-acknowledge-confirmed') — not yet.
      return { ...state, phase: { ...state.phase, isSaving: false, formError: null, confirmation: 'archived-acknowledge' } }
    }

    case 'save-unauthorized': {
      if (state.phase.type !== 'editing') {
        return state
      }
      return {
        ...state,
        phase: {
          ...state.phase,
          isSaving: false,
          formError: action.hasRecovery
            ? null
            : { kind: 'form', message: USER_MANAGEMENT_COPY.authRecoveryUnavailable },
        },
      }
    }

    case 'reload-latest-requested': {
      if (state.phase.type !== 'editing') {
        return state
      }
      if (action.isDirty) {
        return { ...state, phase: { ...state.phase, confirmation: 'discard-reload' } }
      }
      const requestId = state.requestSeq + 1
      return {
        ...state,
        phase: { type: 'detail-loading', userId: state.phase.detail.id, requestId },
        requestSeq: requestId,
      }
    }

    case 'archive-requested': {
      if (state.phase.type !== 'editing') {
        return state
      }
      return { ...state, phase: { ...state.phase, confirmation: 'archive' } }
    }

    case 'archive-cancelled': {
      if (state.phase.type !== 'editing') {
        return state
      }
      return { ...state, phase: { ...state.phase, confirmation: null } }
    }

    case 'archive-started': {
      if (state.phase.type !== 'editing') {
        return state
      }
      return { ...state, phase: { ...state.phase, isArchiving: true } }
    }

    case 'archive-cancelled-silent': {
      if (state.phase.type !== 'editing') {
        return state
      }
      return { ...state, phase: { ...state.phase, isArchiving: false } }
    }

    case 'archive-succeeded':
      return { ...state, phase: { type: 'closed' }, notice: null, refetchToken: state.refetchToken + 1 }

    case 'archive-failed': {
      if (state.phase.type !== 'editing') {
        return state
      }
      return {
        ...state,
        phase: {
          ...state.phase,
          isArchiving: false,
          confirmation: null,
          formError: { kind: 'form', message: action.message },
        },
      }
    }

    case 'archive-unauthorized': {
      if (state.phase.type !== 'editing') {
        return state
      }
      return {
        ...state,
        phase: {
          ...state.phase,
          isArchiving: false,
          confirmation: null,
          formError: action.hasRecovery
            ? null
            : { kind: 'form', message: USER_MANAGEMENT_COPY.authRecoveryUnavailable },
        },
      }
    }

    case 'archived-acknowledge-confirmed':
      return { ...state, phase: { type: 'closed' }, notice: null, refetchToken: state.refetchToken + 1 }

    case 'notice-dismissed':
      return { ...state, notice: null }

    default:
      return state
  }
}
