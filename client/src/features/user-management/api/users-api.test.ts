import type { AxiosResponse } from 'axios'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { httpClient, CANCELLED_ERROR_CODE } from '../../../shared/api'
import type { ApiError } from '../../../shared/api'
import { archiveUser, readUserDetail, readUsersList, updateUser } from './users-api'
import { DEFAULT_USERS_LIST_QUERY } from '../config/users-list-query-defaults'
import type { UserDetailDto, UserListItemDto } from '../model/user-dto'
import type { UserPatchPayload } from '../model/user-patch'
import type { IUsersListQuery } from '../model/users-list-query'

/**
 * These tests mock `httpClient` at the boundary — no real request ever
 * leaves the process, and no deployed endpoint is contacted, per Stage 3's
 * "do not call a deployed endpoint in tests" guardrail.
 */

function jsonResponse<T>(data: T): AxiosResponse<T> {
  return { data, status: 200, statusText: 'OK', headers: {}, config: {} as never }
}

afterEach(() => {
  vi.restoreAllMocks()
})

const listItemFixture: UserListItemDto = {
  id: '507f1f77bcf86cd799439011',
  firstName: 'Anna',
  lastName: 'Smith',
  email: 'anna.smith@example.com',
  phone: null,
  address: null,
  status: 'active',
  lastLoginAt: null,
}

const detailFixture: UserDetailDto = {
  ...listItemFixture,
  phoneExtension: null,
  archivedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  version: 3,
}

describe('readUsersList', () => {
  it('requests GET /users with the exact wire query built from the canonical query', async () => {
    const getSpy = vi
      .spyOn(httpClient, 'get')
      .mockResolvedValue(jsonResponse({ items: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } }))

    const query: IUsersListQuery = {
      page: 2,
      pageSize: 50,
      search: 'anna',
      statuses: ['active', 'blocked'],
      sortField: 'firstName',
      sortDirection: 'desc',
    }

    await readUsersList(query)

    expect(getSpy).toHaveBeenCalledExactlyOnceWith('/users', {
      params: {
        page: 2,
        pageSize: 50,
        search: 'anna',
        status: 'active,blocked',
        sort: 'firstName:desc',
      },
      signal: undefined,
    })
  })

  it('passes an AbortSignal through unchanged for a superseded-read cancellation', async () => {
    const controller = new AbortController()
    const getSpy = vi
      .spyOn(httpClient, 'get')
      .mockResolvedValue(jsonResponse({ items: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } }))

    await readUsersList(DEFAULT_USERS_LIST_QUERY, controller.signal)

    expect(getSpy).toHaveBeenCalledExactlyOnceWith('/users', {
      params: { page: 1, pageSize: 20 },
      signal: controller.signal,
    })
  })

  it('never requires the caller to hold the full collection — resolves with only the server page', async () => {
    vi.spyOn(httpClient, 'get').mockResolvedValue(
      jsonResponse({ items: [listItemFixture], pagination: { page: 1, pageSize: 20, total: 153, totalPages: 8 } }),
    )

    const result = await readUsersList(DEFAULT_USERS_LIST_QUERY)

    expect(result.items).toEqual([listItemFixture])
    expect(result.pagination).toEqual({ page: 1, pageSize: 20, total: 153, totalPages: 8 })
  })

  it('returns list items carrying no version member (DTO/version separation)', async () => {
    vi.spyOn(httpClient, 'get').mockResolvedValue(
      jsonResponse({ items: [listItemFixture], pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 } }),
    )

    const result = await readUsersList(DEFAULT_USERS_LIST_QUERY)

    expect('version' in result.items[0]!).toBe(false)
  })

  it('propagates a rejection unchanged, including internal cancellation', async () => {
    const cancelled: ApiError = { code: CANCELLED_ERROR_CODE }
    vi.spyOn(httpClient, 'get').mockRejectedValue(cancelled)

    await expect(readUsersList(DEFAULT_USERS_LIST_QUERY)).rejects.toBe(cancelled)
  })

  it('propagates a transport/server failure unchanged rather than swallowing or rewrapping it', async () => {
    const failure: ApiError = { code: 'VALIDATION_ERROR', status: 400 }
    vi.spyOn(httpClient, 'get').mockRejectedValue(failure)

    await expect(readUsersList(DEFAULT_USERS_LIST_QUERY)).rejects.toBe(failure)
  })
})

describe('readUserDetail', () => {
  it('requests GET /users/:userId', async () => {
    const getSpy = vi.spyOn(httpClient, 'get').mockResolvedValue(jsonResponse(detailFixture))

    await readUserDetail('507f1f77bcf86cd799439011')

    expect(getSpy).toHaveBeenCalledExactlyOnceWith('/users/507f1f77bcf86cd799439011', {
      signal: undefined,
    })
  })

  it('passes an AbortSignal through unchanged', async () => {
    const controller = new AbortController()
    const getSpy = vi.spyOn(httpClient, 'get').mockResolvedValue(jsonResponse(detailFixture))

    await readUserDetail('507f1f77bcf86cd799439011', controller.signal)

    expect(getSpy).toHaveBeenCalledExactlyOnceWith('/users/507f1f77bcf86cd799439011', {
      signal: controller.signal,
    })
  })

  it('returns a detail response that carries version (DTO/version separation)', async () => {
    vi.spyOn(httpClient, 'get').mockResolvedValue(jsonResponse(detailFixture))

    const result = await readUserDetail('507f1f77bcf86cd799439011')

    expect(result.version).toBe(3)
  })

  it('propagates a not-found rejection unchanged', async () => {
    const notFound: ApiError = { code: 'NOT_FOUND', status: 404 }
    vi.spyOn(httpClient, 'get').mockRejectedValue(notFound)

    await expect(readUserDetail('507f1f77bcf86cd799439011')).rejects.toBe(notFound)
  })
})

describe('updateUser', () => {
  it('sends PATCH /users/:userId with the merge-patch content type and the exact patch body', async () => {
    const patchSpy = vi.spyOn(httpClient, 'patch').mockResolvedValue(jsonResponse(detailFixture))
    const patch: UserPatchPayload = { firstName: 'Anna', address: { postalCode: null }, version: 3 }

    await updateUser('507f1f77bcf86cd799439011', patch)

    expect(patchSpy).toHaveBeenCalledExactlyOnceWith('/users/507f1f77bcf86cd799439011', patch, {
      headers: { 'Content-Type': 'application/merge-patch+json' },
    })
  })

  it('resolves with the updated detail DTO', async () => {
    vi.spyOn(httpClient, 'patch').mockResolvedValue(jsonResponse(detailFixture))

    const result = await updateUser('507f1f77bcf86cd799439011', { version: 3 })

    expect(result).toEqual(detailFixture)
  })

  it('propagates a version-conflict rejection unchanged', async () => {
    const conflict: ApiError = { code: 'USER_VERSION_CONFLICT', status: 409 }
    vi.spyOn(httpClient, 'patch').mockRejectedValue(conflict)

    await expect(updateUser('507f1f77bcf86cd799439011', { version: 3 })).rejects.toBe(conflict)
  })

  it('propagates a duplicate-email rejection with its field intact', async () => {
    const duplicate: ApiError = { code: 'EMAIL_ALREADY_EXISTS', field: 'email', status: 409 }
    vi.spyOn(httpClient, 'patch').mockRejectedValue(duplicate)

    await expect(
      updateUser('507f1f77bcf86cd799439011', { email: 'taken@example.com', version: 3 }),
    ).rejects.toBe(duplicate)
  })
})

describe('archiveUser', () => {
  it('sends DELETE /users/:userId with no version and no body', async () => {
    const deleteSpy = vi.spyOn(httpClient, 'delete').mockResolvedValue(jsonResponse(undefined))

    await archiveUser('507f1f77bcf86cd799439011')

    expect(deleteSpy).toHaveBeenCalledExactlyOnceWith('/users/507f1f77bcf86cd799439011')
  })

  it('resolves with nothing on a 204 success', async () => {
    vi.spyOn(httpClient, 'delete').mockResolvedValue(jsonResponse(undefined))

    await expect(archiveUser('507f1f77bcf86cd799439011')).resolves.toBeUndefined()
  })

  it('propagates a self-archive conflict rejection unchanged', async () => {
    const conflict: ApiError = { code: 'CANNOT_ARCHIVE_SELF', status: 409 }
    vi.spyOn(httpClient, 'delete').mockRejectedValue(conflict)

    await expect(archiveUser('507f1f77bcf86cd799439011')).rejects.toBe(conflict)
  })
})
