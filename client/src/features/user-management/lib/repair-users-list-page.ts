import type { IUsersListQuery } from '../model/users-list-query'

/**
 * Repairs `page` against a server-reported `totalPages`
 * (specs/user-management/spec.md — "Out-of-range pages are repaired"). A
 * `totalPages` of zero repairs to page 1; any syntactically valid page
 * above `totalPages` repairs to `totalPages`; a page already within range
 * is untouched.
 *
 * Returns the SAME `query` reference when no repair is needed, so a caller
 * can use referential equality to decide whether a replace navigation is
 * required at all. Repairing an already-repaired query again with the same
 * `totalPages` is a no-op for the same reason, so this cannot enter a
 * navigation/request loop (specs/user-management/spec.md — "The same
 * repair SHALL run after update or archive refetches, and SHALL be
 * idempotent").
 */
export function repairUsersListPageForTotalPages(
  query: IUsersListQuery,
  totalPages: number,
): IUsersListQuery {
  const highestValidPage = Math.max(1, totalPages)

  if (query.page <= highestValidPage) return query

  return { ...query, page: highestValidPage }
}
