import type { ApiError } from '../../../shared/api'
import type { UsersListResponse } from './user-dto'

export type UsersListRequestStatus = 'loading' | 'success' | 'error'

/**
 * Request-lifecycle state for one Users list, per design.md D2: "A
 * feature-local list reducer holds only the active request key/controller,
 * current server page, loading phase, and visible error." `activeKey` is the
 * canonical request this state currently belongs to — the guard every
 * completion is checked against (specs/user-management/spec.md — "Search is
 * debounced and latest-request-wins": "independently prevent any older
 * completion from replacing data, loading state, or errors belonging to the
 * latest canonical query").
 *
 * `response` is deliberately retained across a `loading`/`error` status
 * rather than cleared, so a Retry (or the next canonical query) does not
 * force every consumer through a `null` frame before the fresh page arrives.
 */
export interface UsersListRequestState {
  readonly status: UsersListRequestStatus
  readonly activeKey: string | null
  readonly response: UsersListResponse | null
  readonly error: ApiError | null
}

export type UsersListRequestAction =
  | { readonly type: 'request-started'; readonly key: string }
  | { readonly type: 'request-succeeded'; readonly key: string; readonly response: UsersListResponse }
  | { readonly type: 'request-failed'; readonly key: string; readonly error: ApiError }

export const INITIAL_USERS_LIST_REQUEST_STATE: UsersListRequestState = {
  status: 'loading',
  activeKey: null,
  response: null,
  error: null,
}

/**
 * Pure reducer for the list's request lifecycle. `request-started` always
 * takes effect — it is what makes a key "the active one" — but
 * `request-succeeded`/`request-failed` are no-ops unless `action.key` still
 * matches `state.activeKey`, so a superseded request's completion (canceled
 * or not) can never overwrite data, loading state, or an error that belongs
 * to a newer canonical query (specs/user-management/spec.md — "Older
 * response finishes last").
 */
export function usersListRequestReducer(
  state: UsersListRequestState,
  action: UsersListRequestAction,
): UsersListRequestState {
  switch (action.type) {
    case 'request-started':
      return { status: 'loading', activeKey: action.key, response: state.response, error: null }

    case 'request-succeeded':
      if (action.key !== state.activeKey) {
        return state
      }
      return { status: 'success', activeKey: state.activeKey, response: action.response, error: null }

    case 'request-failed':
      if (action.key !== state.activeKey) {
        return state
      }
      return { status: 'error', activeKey: state.activeKey, response: state.response, error: action.error }

    default:
      return state
  }
}
