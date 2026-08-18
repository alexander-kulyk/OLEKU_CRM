import type { UserStatus } from './user-status'

/**
 * The four address properties the server accepts and returns, matching
 * `users-api/spec.md` — "Address updates merge property by property".
 * Every property is independently nullable; there is no partial/required
 * distinction beyond that.
 */
export interface UserAddress {
  readonly country: string | null
  readonly city: string | null
  readonly street: string | null
  readonly postalCode: string | null
}

/**
 * The exact `GET /api/users` item shape. Deliberately has NO `version`
 * member — `users-api/spec.md` "Responses expose only whitelisted fields"
 * states a list item SHALL NOT carry the version, and
 * specs/user-management/spec.md "Editing starts from current detail data"
 * requires that list data never substitute for a detail read. Any code
 * that needs a version for a PATCH must come from {@link UserDetailDto}.
 */
export interface UserListItemDto {
  readonly id: string
  readonly firstName: string
  readonly lastName: string
  readonly email: string
  readonly phone: string | null
  readonly address: UserAddress | null
  readonly status: UserStatus
  /** ISO 8601 UTC instant, or `null` when the user has never logged in. */
  readonly lastLoginAt: string | null
}

/**
 * The exact `GET /api/users/:userId` shape — every {@link UserListItemDto}
 * field plus the metadata a list row never carries: the phone extension
 * (kept separate from `phone`, never merged into it), archive/audit
 * timestamps, and the optimistic-concurrency `version` a PATCH must echo
 * back (users-api/spec.md — "Responses expose only whitelisted fields",
 * "Updates are guarded by an explicit version").
 */
export interface UserDetailDto extends UserListItemDto {
  readonly phoneExtension: string | null
  /** ISO 8601 UTC instant, or `null` when the user is not archived. */
  readonly archivedAt: string | null
  readonly createdAt: string
  readonly updatedAt: string
  readonly version: number
}

/** `GET /api/users` pagination block — always the true server-side count. */
export interface UsersPagination {
  readonly page: number
  readonly pageSize: number
  /** Count of records matching the active search/filters, not the page size. */
  readonly total: number
  readonly totalPages: number
}

/** The complete `GET /api/users` response body. */
export interface UsersListResponse {
  readonly items: readonly UserListItemDto[]
  readonly pagination: UsersPagination
}
