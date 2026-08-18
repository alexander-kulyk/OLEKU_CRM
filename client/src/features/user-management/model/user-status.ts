/**
 * The three operational statuses a non-archived user can have, in the
 * server's own canonical (status-ascending) order — `active`, `inactive`,
 * `blocked` (`server/src/modules/users/user-status.ts`,
 * `users-api/spec.md` — "Status ascending order"). Archived is not a
 * status value; it is a separate `archivedAt` timestamp
 * (users-api/spec.md — "The user list excludes archived records").
 *
 * This array is reused as the canonical serialization order for the
 * `status` query filter (design.md D2 — "statuses serialize in canonical
 * status order"), so a status combination always produces one
 * deterministic URL regardless of the order it was selected in.
 */
export const USER_STATUSES = ['active', 'inactive', 'blocked'] as const

export type UserStatus = (typeof USER_STATUSES)[number]
