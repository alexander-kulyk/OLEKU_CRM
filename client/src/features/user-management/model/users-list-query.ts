import type { UserStatus } from './user-status'

/**
 * The only page sizes `GET /api/users` accepts, 20 first because it is
 * both the array's and the server's default
 * (`server/src/modules/users/user.schema.ts` `pageSizeField`;
 * specs/user-management/spec.md — "Users collection is server-driven").
 */
export const USER_PAGE_SIZES = [20, 50, 100] as const

export type UserPageSize = (typeof USER_PAGE_SIZES)[number]

/**
 * The four fields Users list sorting is interactive for
 * (specs/user-management/spec.md — "Supported interactive sorts SHALL be
 * First Name, Last Name, Status, and Last Login"). `lastLoginAt` matches
 * the server's own field name (`user.schema.ts` `USER_SORTS`), not the
 * column's "Last Login" display label.
 */
export const USER_SORT_FIELDS = ['firstName', 'lastName', 'status', 'lastLoginAt'] as const

export type UserSortField = (typeof USER_SORT_FIELDS)[number]

export const USER_SORT_DIRECTIONS = ['asc', 'desc'] as const

export type UserSortDirection = (typeof USER_SORT_DIRECTIONS)[number]

/**
 * The canonical, URL-owned Users list query (design.md D2 — "Treat the URL
 * as query state"). There is no mirrored copy of this shape in component
 * state; `parseUsersListQuery`/`canonicalizeUsersListQuery`/
 * `serializeUsersListQuery` (`lib/`) are the only supported way to read or
 * produce one, so every consumer agrees on defaults and ordering.
 *
 * `search` is kept exactly as typed (not trimmed) so the visible URL never
 * silently rewrites what the operator is typing; only
 * `buildUsersListWireQuery` decides whether a trimmed value is eligible to
 * be sent (specs/user-management/spec.md — "Search is debounced and
 * latest-request-wins").
 */
export interface IUsersListQuery {
  readonly page: number
  readonly pageSize: UserPageSize
  readonly search: string
  readonly statuses: readonly UserStatus[]
  readonly sortField: UserSortField
  readonly sortDirection: UserSortDirection
}

/**
 * The exact `GET /api/users` query params sent over the wire — the result
 * of `buildUsersListWireQuery`. `status` is the comma-separated string the
 * server's `statusField` expects; `sort` is the combined `field:direction`
 * token from the server's own `USER_SORTS` enum
 * (`server/src/modules/users/user.schema.ts`). `search`/`status`/`sort`
 * are omitted rather than sent empty or at their default, matching how the
 * rest of this client's API functions build `params`
 * (`shared/api/directory.ts`).
 */
export interface UsersListWireQuery {
  readonly page: number
  readonly pageSize: UserPageSize
  readonly search?: string
  readonly status?: string
  readonly sort?: string
}
