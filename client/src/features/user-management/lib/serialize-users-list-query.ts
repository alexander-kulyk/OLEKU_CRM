import type { IUsersListQuery } from '../model/users-list-query'
import { DEFAULT_USERS_LIST_QUERY, USERS_QUERY_PARAM_KEYS } from '../config/users-list-query-defaults'

/**
 * Builds the canonical `/users` URL search params for a query — the
 * inverse of {@link parseUsersListQuery}. A field at its default value is
 * omitted, so the shortest canonical URL always wins and every semantically
 * equal query serializes identically
 * (specs/user-management/spec.md — "List query state is canonical in the
 * URL"). Keys are always written in the same order, and statuses are
 * joined in the canonical order {@link canonicalizeUsersListQuery} already
 * guarantees, so serialization is stable regardless of how a caller built
 * the query.
 */
export function serializeUsersListQuery(query: IUsersListQuery): URLSearchParams {
  const keys = USERS_QUERY_PARAM_KEYS
  const params = new URLSearchParams()

  if (query.page !== DEFAULT_USERS_LIST_QUERY.page) {
    params.set(keys.page, String(query.page))
  }
  if (query.pageSize !== DEFAULT_USERS_LIST_QUERY.pageSize) {
    params.set(keys.pageSize, String(query.pageSize))
  }
  if (query.search !== DEFAULT_USERS_LIST_QUERY.search) {
    params.set(keys.search, query.search)
  }
  if (query.statuses.length > 0) {
    params.set(keys.status, query.statuses.join(','))
  }
  if (query.sortField !== DEFAULT_USERS_LIST_QUERY.sortField) {
    params.set(keys.sortField, query.sortField)
  }
  if (query.sortDirection !== DEFAULT_USERS_LIST_QUERY.sortDirection) {
    params.set(keys.sortDirection, query.sortDirection)
  }

  return params
}

/** {@link serializeUsersListQuery} as a canonical string, for URL/history comparisons. */
export function serializeUsersListQueryToString(query: IUsersListQuery): string {
  return serializeUsersListQuery(query).toString()
}
