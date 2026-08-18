import { USER_STATUSES } from '../model/user-status'
import type { UserStatus } from '../model/user-status'
import {
  USER_PAGE_SIZES,
  USER_SORT_DIRECTIONS,
  USER_SORT_FIELDS,
} from '../model/users-list-query'
import type { IUsersListQuery, UserPageSize, UserSortDirection, UserSortField } from '../model/users-list-query'
import { DEFAULT_USERS_LIST_QUERY, USERS_QUERY_PARAM_KEYS } from '../config/users-list-query-defaults'
import { canonicalizeUsersListQuery } from './canonicalize-users-list-query'

function parsePage(raw: string | null): number {
  if (raw === null) return DEFAULT_USERS_LIST_QUERY.page

  const value = Number(raw)

  return Number.isInteger(value) && value >= 1 ? value : DEFAULT_USERS_LIST_QUERY.page
}

function parsePageSize(raw: string | null): UserPageSize {
  if (raw === null) return DEFAULT_USERS_LIST_QUERY.pageSize

  const value = Number(raw)

  return (USER_PAGE_SIZES as readonly number[]).includes(value)
    ? (value as UserPageSize)
    : DEFAULT_USERS_LIST_QUERY.pageSize
}

function parseStatuses(raw: string | null): readonly UserStatus[] {
  if (raw === null || raw.length === 0) return DEFAULT_USERS_LIST_QUERY.statuses

  const candidates = raw.split(',')
  const allSupported = candidates.every((candidate): candidate is UserStatus =>
    (USER_STATUSES as readonly string[]).includes(candidate),
  )

  // One unsupported status (e.g. `archived`, per users-api/spec.md "Unknown
  // status value") invalidates the whole filter rather than silently
  // dropping just that value — a partial accept would let an invalid URL
  // still request something the operator never asked for.
  return allSupported ? candidates : DEFAULT_USERS_LIST_QUERY.statuses
}

function parseSortField(raw: string | null): UserSortField {
  return raw !== null && (USER_SORT_FIELDS as readonly string[]).includes(raw)
    ? (raw as UserSortField)
    : DEFAULT_USERS_LIST_QUERY.sortField
}

function parseSortDirection(raw: string | null): UserSortDirection {
  return raw !== null && (USER_SORT_DIRECTIONS as readonly string[]).includes(raw)
    ? (raw as UserSortDirection)
    : DEFAULT_USERS_LIST_QUERY.sortDirection
}

/**
 * Reads the `/users` URL's search params into a fully valid, canonical
 * {@link IUsersListQuery}. Every missing or unsupported value (a negative
 * page, an unsupported page size, an unknown status, an unknown sort, or
 * absence altogether) falls back to its documented default in this one
 * pass — never a partial value and never a throw
 * (specs/user-management/spec.md — "Invalid URL is repaired").
 *
 * Because the result is already canonicalized, `serializeUsersListQuery`
 * of this function's output is the one idempotent canonical URL for any
 * input: repairing an already-canonical URL reproduces the same URL.
 */
export function parseUsersListQuery(searchParams: URLSearchParams): IUsersListQuery {
  const keys = USERS_QUERY_PARAM_KEYS

  const candidate: IUsersListQuery = {
    page: parsePage(searchParams.get(keys.page)),
    pageSize: parsePageSize(searchParams.get(keys.pageSize)),
    search: searchParams.get(keys.search) ?? DEFAULT_USERS_LIST_QUERY.search,
    statuses: parseStatuses(searchParams.get(keys.status)),
    sortField: parseSortField(searchParams.get(keys.sortField)),
    sortDirection: parseSortDirection(searchParams.get(keys.sortDirection)),
  }

  return canonicalizeUsersListQuery(candidate)
}
