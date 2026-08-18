import type { UserStatus } from './user-status'

/**
 * One address merge-patch member: a supplied string updates that
 * property, `null` clears it, and an omitted property leaves it unchanged
 * (users-api/spec.md — "Address updates merge property by property"). This
 * type intentionally mirrors the server's `addressPatchField` shape rather
 * than the read-side {@link UserAddress}, which has no "omitted" state.
 */
export interface UserAddressPatch {
  readonly country?: string | null
  readonly city?: string | null
  readonly street?: string | null
  readonly postalCode?: string | null
}

/**
 * The `PATCH /api/users/:userId` request body. Every mutable member is
 * optional — an omitted member means "unchanged" under JSON Merge Patch
 * semantics — except `version`, which every update SHALL carry
 * (users-api/spec.md — "Updates are guarded by an explicit version").
 *
 * `address` has three distinct states a caller must choose deliberately:
 * omitted (leave the whole address untouched), an object of one or more
 * {@link UserAddressPatch} members (merge those properties), or `null`
 * (remove the whole address). Immutable/read-only members — `id`,
 * `createdAt`, `updatedAt`, `archivedAt` — have no place in this type at
 * all, so a caller cannot accidentally send one
 * (users-api/spec.md — "Update accepts a merge patch on an explicit field
 * set").
 */
export interface UserPatchPayload {
  readonly firstName?: string
  readonly lastName?: string
  readonly email?: string
  readonly phone?: string | null
  readonly phoneExtension?: string | null
  readonly address?: UserAddressPatch | null
  readonly status?: UserStatus
  readonly version: number
}
