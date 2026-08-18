import type { IUsersListQuery, UsersListWireQuery } from '../model/users-list-query'
import { DEFAULT_USERS_LIST_QUERY, USERS_SEARCH_MIN_LENGTH } from '../config/users-list-query-defaults'

function isDefaultSort(query: IUsersListQuery): boolean {
  return (
    query.sortField === DEFAULT_USERS_LIST_QUERY.sortField &&
    query.sortDirection === DEFAULT_USERS_LIST_QUERY.sortDirection
  )
}

/**
 * Builds the exact `GET /api/users` query object from an already-canonical
 * {@link IUsersListQuery} (i.e. the output of `parseUsersListQuery`/
 * `canonicalizeUsersListQuery`). A search shorter than
 * {@link USERS_SEARCH_MIN_LENGTH} characters after trimming is deliberately
 * omitted here — it stays visible in the URL but is never requested
 * (specs/user-management/spec.md — "One-character search is not
 * requested"), while status and sort remain in the request unaffected.
 * `sort` is only sent when it differs from the server's own default
 * ordering, keeping the default-order request minimal; `status` is a
 * comma-separated token matching the server's `statusField`
 * (`server/src/modules/users/user.schema.ts`).
 */
export function buildUsersListWireQuery(query: IUsersListQuery): UsersListWireQuery {
  const trimmedSearch = query.search.trim()
  const isSearchEligible = trimmedSearch.length >= USERS_SEARCH_MIN_LENGTH

  return {
    page: query.page,
    pageSize: query.pageSize,
    ...(isSearchEligible ? { search: trimmedSearch } : {}),
    ...(query.statuses.length > 0 ? { status: query.statuses.join(',') } : {}),
    ...(isDefaultSort(query) ? {} : { sort: `${query.sortField}:${query.sortDirection}` }),
  }
}
