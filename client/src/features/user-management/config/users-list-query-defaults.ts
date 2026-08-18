import type { IUsersListQuery } from '../model/users-list-query'

/**
 * The one canonical "no query at all" state — page 1, the server's own
 * default page size, no search, no status filter, and the server's own
 * default ordering (specs/user-management/spec.md — "Initial collection
 * request"). Every default individual field below is read from this
 * object rather than re-declared, so `lib/` functions cannot drift from
 * one another on what "default" means.
 */
export const DEFAULT_USERS_LIST_QUERY: IUsersListQuery = {
  page: 1,
  pageSize: 20,
  search: '',
  statuses: [],
  sortField: 'lastName',
  sortDirection: 'asc',
}

/**
 * Minimum trimmed length for a search term to be eligible for a request.
 * Exactly one character is retained in the URL but never sent
 * (specs/user-management/spec.md — "Search is debounced and
 * latest-request-wins").
 */
export const USERS_SEARCH_MIN_LENGTH = 2

/** Debounce interval an eligible search waits out before it is requested. */
export const USERS_SEARCH_DEBOUNCE_MS = 300

/**
 * The `/users` URL search-param keys, centralized so
 * `parseUsersListQuery` and `serializeUsersListQuery` can never disagree
 * on a key name.
 */
export const USERS_QUERY_PARAM_KEYS = {
  page: 'page',
  pageSize: 'pageSize',
  search: 'search',
  status: 'status',
  sortField: 'sort',
  sortDirection: 'direction',
} as const
