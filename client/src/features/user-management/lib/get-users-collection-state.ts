import type { ApiError } from '../../../shared/api'
import type { UsersListResponse } from '../model/user-dto'
import type { UsersListWireQuery } from '../model/users-list-query'
import type { UsersListRequestState } from '../model/users-list-request-reducer'

/**
 * The list's distinct, mutually exclusive presentation states
 * (specs/user-management/spec.md — "Collection states are distinct and
 * recoverable"). A discriminated union rather than several booleans, so
 * `UsersList` renders exactly one branch and can never show two states (e.g.
 * an error and a stale table) at once.
 */
export type UsersCollectionState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error'; readonly error: ApiError }
  | { readonly kind: 'true-empty' }
  | { readonly kind: 'no-results' }
  | { readonly kind: 'loaded'; readonly response: UsersListResponse }

/**
 * Resolves the request lifecycle plus the query actually sent to the server
 * into exactly one {@link UsersCollectionState}.
 *
 * `wireQuery` — not the raw URL query — decides "true empty" versus
 * "no-results": a one-character search is visible in the URL but never sent
 * (specs/user-management/spec.md — "Search is debounced and
 * latest-request-wins"), so a zero-result response for that request is the
 * unfiltered collection being empty, not a search producing no matches
 * ("User collection is empty" vs. "Query has no matches" scenarios).
 */
export function getUsersCollectionState(
  requestState: UsersListRequestState,
  wireQuery: UsersListWireQuery,
): UsersCollectionState {
  if (requestState.status === 'loading') {
    return { kind: 'loading' }
  }

  if (requestState.status === 'error') {
    // A request-state guard (usersListRequestReducer) — every 'error' status
    // is set alongside `error`, so this is unreachable in practice; the
    // fallback keeps this function total without an unsafe assertion.
    return requestState.error ? { kind: 'error', error: requestState.error } : { kind: 'loading' }
  }

  if (requestState.response === null) {
    return { kind: 'loading' }
  }

  if (requestState.response.items.length > 0) {
    return { kind: 'loaded', response: requestState.response }
  }

  const isFiltered = wireQuery.search !== undefined || wireQuery.status !== undefined

  return isFiltered ? { kind: 'no-results' } : { kind: 'true-empty' }
}
