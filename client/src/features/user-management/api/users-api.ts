import { httpClient } from '../../../shared/api'
import type { UserDetailDto, UsersListResponse } from '../model/user-dto'
import type { UserPatchPayload } from '../model/user-patch'
import type { IUsersListQuery } from '../model/users-list-query'
import { buildUsersListWireQuery } from '../lib/build-users-list-wire-query'

/**
 * `GET /api/users` for the canonical query `parseUsersListQuery`/
 * `canonicalizeUsersListQuery` already produced. Pagination, search,
 * filtering, and sorting are entirely server-side — this function never
 * assembles or filters a held collection
 * (specs/user-management/spec.md — "Users collection is server-driven").
 *
 * `signal` lets a caller abort a superseded read (design.md D2
 * latest-request-wins); rejection — including the cancellation itself,
 * already normalized to `CANCELLED_ERROR_CODE` by `httpClient`'s
 * interceptor — propagates unchanged to the caller.
 */
export async function readUsersList(
  query: IUsersListQuery,
  signal?: AbortSignal,
): Promise<UsersListResponse> {
  const response = await httpClient.get<UsersListResponse>('/users', {
    params: buildUsersListWireQuery(query),
    signal,
  })

  return response.data
}

/**
 * `GET /api/users/:userId`. Returns the record whether or not it is
 * archived, so a caller can distinguish "archived" from "not found"
 * (users-api/spec.md — "The detail endpoint returns archived users"). The
 * response carries `version` — the field list rows never supply — so an
 * edit session always starts from this call, never from a list row
 * (specs/user-management/spec.md — "Editing starts from current detail
 * data").
 */
export async function readUserDetail(
  userId: string,
  signal?: AbortSignal,
): Promise<UserDetailDto> {
  const response = await httpClient.get<UserDetailDto>(`/users/${userId}`, { signal })

  return response.data
}

/**
 * `PATCH /api/users/:userId` as a JSON Merge Patch
 * (users-api/spec.md — "Update accepts a merge patch on an explicit field
 * set"), sent with `application/merge-patch+json` — the server accepts it
 * equivalently to `application/json`, but the merge-patch content type
 * documents the semantics at the call site (design.md D3). `patch` must
 * already carry only changed mutable members plus `version`; this function
 * performs no diffing or normalization of its own (design.md D4).
 */
export async function updateUser(
  userId: string,
  patch: UserPatchPayload,
): Promise<UserDetailDto> {
  const response = await httpClient.patch<UserDetailDto>(`/users/${userId}`, patch, {
    headers: { 'Content-Type': 'application/merge-patch+json' },
  })

  return response.data
}

/**
 * `DELETE /api/users/:userId` — archives (soft-deletes) a user. Sends no
 * version: archiving intentionally takes precedence over an unsaved
 * concurrent edit (users-api/spec.md — "Archive is a soft delete that is
 * idempotent"). The server returns `204` with no body, so this function
 * resolves with nothing on success.
 */
export async function archiveUser(userId: string): Promise<void> {
  await httpClient.delete(`/users/${userId}`)
}
