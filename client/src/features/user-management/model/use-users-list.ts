import { useCallback, useEffect, useReducer, useState } from 'react'
import { isApiError, isCancelledError, TRANSPORT_ERROR_CODE } from '../../../shared/api'
import type { ApiError } from '../../../shared/api'
import { readUsersList } from '../api/users-api'
import { buildUsersListWireQuery } from '../lib/build-users-list-wire-query'
import { getUsersCollectionState } from '../lib/get-users-collection-state'
import type { UsersCollectionState } from '../lib/get-users-collection-state'
import { repairUsersListPageForTotalPages } from '../lib/repair-users-list-page'
import {
  INITIAL_USERS_LIST_REQUEST_STATE,
  usersListRequestReducer,
} from './users-list-request-reducer'
import { useUsersListQuery } from './use-users-list-query'
import type { UsersListControls } from './use-users-list-query'
import type { IUsersListQuery } from './users-list-query'

const USERS_SEARCH_DEBOUNCE_MS = 300

/** Everything that changes together per canonical non-search query field. */
function nonSearchKeyOf(query: IUsersListQuery): string {
  return `${query.page}|${query.pageSize}|${query.statuses.join(',')}|${query.sortField}|${query.sortDirection}`
}

export interface UseUsersListResult {
  readonly query: IUsersListQuery
  readonly controls: UsersListControls
  readonly collection: UsersCollectionState
  /** Whether the live (not-yet-debounced) search is exactly one character. */
  readonly isSearchTooShort: boolean
  /** Repeats the current canonical query without changing the URL. */
  readonly retry: () => void
}

/**
 * The feature-local list controller (design.md D2, task 4.1): derives the
 * canonical query from the URL, debounces an eligible search by ~300ms,
 * cancels superseded reads, guards every completion by its canonical
 * request key, and repairs an out-of-range page after a response — all
 * without mirroring the query into component state.
 *
 * Debounce applies only to a **search-only** edit. Any change that also
 * touches a non-search field (an explicit page/page-size/status/sort
 * action, or Clear filters resetting search alongside statuses/page) takes
 * effect immediately — only typing should feel delayed
 * (specs/user-management/spec.md — "Search is debounced and
 * latest-request-wins"; task 4.5 "filter/search distinctions").
 */
export function useUsersList(): UseUsersListResult {
  const { query, controls, replaceQuery } = useUsersListQuery()

  const [debouncedSearch, setDebouncedSearch] = useState(query.search)
  const nonSearchKey = nonSearchKeyOf(query)
  const [syncedNonSearchKey, setSyncedNonSearchKey] = useState(nonSearchKey)

  // Render-phase state adjustment ("Adjusting state when a prop changes",
  // React docs) rather than an effect. A non-search control change — an
  // explicit page/page-size/status/sort action, or Clear filters resetting
  // search alongside statuses/page in the SAME navigation — must resync
  // `debouncedSearch` inside this same render/commit. Doing that resync in
  // an effect instead would let one extra render commit first with the NEW
  // non-search fields paired with the OLD, not-yet-resynced search value —
  // a transient `requestQuery` that is neither the previous nor the next
  // canonical request — and the fetch effect below would wastefully issue
  // that spurious request before the correct one (task 4.5 "filter/search
  // distinctions").
  if (nonSearchKey !== syncedNonSearchKey) {
    setSyncedNonSearchKey(nonSearchKey)
    setDebouncedSearch(query.search)
  }

  useEffect(() => {
    // A non-search change already resynced `debouncedSearch` to
    // `query.search` above, in the same render — nothing left to debounce.
    if (query.search === debouncedSearch) {
      return
    }

    const timer = setTimeout(() => {
      setDebouncedSearch(query.search)
    }, USERS_SEARCH_DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
    }
  }, [query.search, debouncedSearch])

  const requestQuery: IUsersListQuery = { ...query, search: debouncedSearch }
  const wireQuery = buildUsersListWireQuery(requestQuery)
  const requestKey = JSON.stringify(wireQuery)

  const [requestState, dispatch] = useReducer(usersListRequestReducer, INITIAL_USERS_LIST_REQUEST_STATE)
  const [retryToken, setRetryToken] = useState(0)

  useEffect(() => {
    // `controller` is captured directly by the cleanup closure below — React
    // runs that cleanup (aborting this exact request) before the next
    // effect run starts, whether that run is a new canonical query or a
    // Retry, so a superseded read is always aborted before its replacement
    // begins (specs/user-management/spec.md — "The page SHALL cancel
    // superseded list requests when possible").
    const controller = new AbortController()

    dispatch({ type: 'request-started', key: requestKey })

    readUsersList(requestQuery, controller.signal)
      .then((response) => {
        dispatch({ type: 'request-succeeded', key: requestKey, response })
      })
      .catch((thrown: unknown) => {
        if (isCancelledError(thrown)) {
          // The client's own cancellation, not a failure to present
          // (specs/user-management/spec.md — "Expected internal
          // cancellation SHALL not be presented as a transport failure").
          return
        }

        // `thrown` is already normalized by `httpClient`'s interceptor —
        // read it as an `ApiError` directly rather than re-running
        // `toApiError`, which would misclassify an already-normalized
        // error as a transport failure (shared/api/error.ts
        // `getApiErrorCode` doc comment).
        const error: ApiError = isApiError(thrown) ? thrown : { code: TRANSPORT_ERROR_CODE }
        dispatch({ type: 'request-failed', key: requestKey, error })
      })

    return () => {
      controller.abort()
    }
    // `requestKey` fully determines the outgoing request (readUsersList
    // rebuilds the same wire params from `requestQuery` internally), so it
    // is the correct effect dependency — see module docs above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey, retryToken])

  // Out-of-range page repair (specs/user-management/spec.md — "Out-of-range
  // pages are repaired"): only fires once per response, and only when the
  // repaired query actually differs from the current URL, so it cannot
  // loop (repairUsersListPageForTotalPages returns the SAME reference when
  // no repair is needed).
  useEffect(() => {
    if (requestState.status !== 'success' || requestState.response === null) {
      return
    }

    const repaired = repairUsersListPageForTotalPages(query, requestState.response.pagination.totalPages)

    if (repaired !== query) {
      replaceQuery(repaired)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestState.status, requestState.response, query.page])

  const retry = useCallback(() => {
    setRetryToken((token) => token + 1)
  }, [])

  const collection = getUsersCollectionState(requestState, wireQuery)
  const isSearchTooShort = query.search.trim().length === 1

  return { query, controls, collection, isSearchTooShort, retry }
}
