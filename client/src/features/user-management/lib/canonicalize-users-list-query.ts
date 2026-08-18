import { USER_STATUSES } from '../model/user-status'
import type { UserStatus } from '../model/user-status'
import type { IUsersListQuery } from '../model/users-list-query'
import { DEFAULT_USERS_LIST_QUERY } from '../config/users-list-query-defaults'

/**
 * Deduplicates and reorders a status selection into the server's canonical
 * status-ascending order (design.md D2 — "statuses serialize in canonical
 * status order"), regardless of the order the caller selected them in or
 * how many times one appears.
 */
function canonicalStatuses(statuses: readonly UserStatus[]): readonly UserStatus[] {
  const selected = new Set(statuses)

  return USER_STATUSES.filter((status) => selected.has(status))
}

/** A page below 1, or one that is not a whole number, is not valid input. */
function canonicalPage(page: number): number {
  return Number.isInteger(page) && page >= 1 ? page : DEFAULT_USERS_LIST_QUERY.page
}

/**
 * Normalizes an {@link IUsersListQuery} into the one canonical shape
 * design.md D2 requires: deterministic status order/uniqueness and a valid
 * page number. Idempotent — canonicalizing an already-canonical query
 * returns an equal query, so this is safe to run on both a freshly parsed
 * URL and a query built programmatically by future UI code (e.g. toggling
 * one status filter at a time) before it is pushed to history.
 */
export function canonicalizeUsersListQuery(query: IUsersListQuery): IUsersListQuery {
  return {
    ...query,
    page: canonicalPage(query.page),
    statuses: canonicalStatuses(query.statuses),
  }
}
