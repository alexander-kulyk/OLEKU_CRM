import { act, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CANCELLED_ERROR_CODE } from '../../../shared/api'
import type { ApiError } from '../../../shared/api'
import { readUsersList } from '../api/users-api'
import type { UsersListResponse } from './user-dto'
import { createDeferred, makeResponse, renderUsersList, sampleItem } from './use-users-list-test-support'

/**
 * Hook-level coverage for `useUsersList` (task 4.1/4.5): latest-request-
 * wins, canceled-request silence, Retry, URL repair/history, pagination
 * repair, and server-only dataset handling. Split from
 * `use-users-list.test.tsx` (initial request/debounce/filter distinctions,
 * same support module) to keep both files under the package's 250-line
 * cap. `readUsersList` is mocked at the feature's API boundary — no real
 * request ever leaves the process (design.md D8).
 */

vi.mock('../api/users-api', () => ({
  readUsersList: vi.fn(),
}))

const mockedReadUsersList = vi.mocked(readUsersList)

// See `use-users-list.test.tsx` for why this explicit clear is required —
// `restoreMocks: true` does not cover a bare `vi.fn()` from a `vi.mock`
// factory.
beforeEach(() => {
  mockedReadUsersList.mockClear()
})

describe('useUsersList — request races', () => {
  it('does not let an older response overwrite a newer canonical query result', async () => {
    const first = createDeferred<UsersListResponse>()
    const second = createDeferred<UsersListResponse>()
    mockedReadUsersList.mockReturnValueOnce(first.promise)
    mockedReadUsersList.mockReturnValueOnce(second.promise)

    const { result } = renderUsersList()
    act(() => result.current.controls.toggleStatus('active'))

    await act(async () => {
      second.resolve(
        makeResponse({ items: [sampleItem], pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 } }),
      )
      await Promise.resolve()
    })
    expect(result.current.collection).toEqual({
      kind: 'loaded',
      response: expect.objectContaining({
        items: [sampleItem],
        pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      }),
    })

    await act(async () => {
      first.resolve(makeResponse({ items: [], pagination: { page: 1, pageSize: 20, total: 999, totalPages: 50 } }))
      await Promise.resolve()
    })

    // The older (first) response never replaces the newer (second) one.
    expect(result.current.collection).toEqual({
      kind: 'loaded',
      response: expect.objectContaining({
        items: [sampleItem],
        pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      }),
    })
  })

  it('treats a superseded request rejecting with the cancellation code as silent, not an error', async () => {
    const first = createDeferred<UsersListResponse>()
    mockedReadUsersList.mockReturnValueOnce(first.promise)
    mockedReadUsersList.mockResolvedValueOnce(makeResponse())

    const { result } = renderUsersList()
    act(() => result.current.controls.toggleStatus('blocked'))

    const cancelled: ApiError = { code: CANCELLED_ERROR_CODE }
    await act(async () => {
      first.reject(cancelled)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(result.current.collection.kind).not.toBe('error')
  })
})

describe('useUsersList — Retry', () => {
  it('repeats the current canonical query on failure without changing the URL', async () => {
    const failure: ApiError = { code: 'INTERNAL_ERROR', status: 500 }
    mockedReadUsersList.mockRejectedValueOnce(failure)
    mockedReadUsersList.mockResolvedValueOnce(
      makeResponse({ items: [sampleItem], pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 } }),
    )

    const { result } = renderUsersList()
    await waitFor(() => expect(result.current.collection.kind).toBe('error'))
    const searchBeforeRetry = result.current.location.search

    act(() => result.current.retry())

    await waitFor(() => expect(result.current.collection.kind).toBe('loaded'))
    expect(mockedReadUsersList).toHaveBeenCalledTimes(2)
    expect(result.current.location.search).toBe(searchBeforeRetry)

    const [firstCallQuery] = mockedReadUsersList.mock.calls[0]!
    const [secondCallQuery] = mockedReadUsersList.mock.calls[1]!
    expect(secondCallQuery).toEqual(firstCallQuery)
  })
})

describe('useUsersList — URL repair', () => {
  it('canonicalizes an invalid page with a replace navigation and requests the repaired page', async () => {
    mockedReadUsersList.mockResolvedValue(makeResponse())

    const { result } = renderUsersList(['/users?page=-1'])

    await waitFor(() => expect(result.current.query.page).toBe(1))
    await waitFor(() => expect(result.current.navigationType).toBe('REPLACE'))
    expect(mockedReadUsersList).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1 }),
      expect.anything(),
    )
  })
})

describe('useUsersList — pagination repair', () => {
  it('replaces an out-of-range page once the server reports a lower totalPages, then requests it', async () => {
    mockedReadUsersList.mockResolvedValueOnce(
      makeResponse({ pagination: { page: 99, pageSize: 20, total: 153, totalPages: 8 } }),
    )
    mockedReadUsersList.mockResolvedValueOnce(
      makeResponse({
        items: [],
        pagination: { page: 8, pageSize: 20, total: 153, totalPages: 8 },
      }),
    )

    const { result } = renderUsersList(['/users?page=99'])

    await waitFor(() => expect(result.current.query.page).toBe(8))
    expect(result.current.navigationType).toBe('REPLACE')
    await waitFor(() => expect(mockedReadUsersList).toHaveBeenCalledTimes(2))
    expect(mockedReadUsersList).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 8 }),
      expect.anything(),
    )
  })
})

describe('useUsersList — server-only dataset handling', () => {
  it('replaces the visible page wholesale rather than accumulating items across requests', async () => {
    mockedReadUsersList.mockResolvedValueOnce(
      makeResponse({ items: [], pagination: { page: 1, pageSize: 20, total: 21, totalPages: 2 } }),
    )
    mockedReadUsersList.mockResolvedValueOnce(
      makeResponse({ items: [], pagination: { page: 2, pageSize: 20, total: 21, totalPages: 2 } }),
    )

    const { result } = renderUsersList()
    await waitFor(() => expect(result.current.collection.kind).toBe('true-empty'))

    act(() => result.current.controls.setPage(2))

    await waitFor(() => {
      if (result.current.collection.kind !== 'true-empty') {
        throw new Error('not settled yet')
      }
    })
    await waitFor(() => expect(mockedReadUsersList).toHaveBeenCalledTimes(2))
    expect(mockedReadUsersList).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2 }),
      expect.anything(),
    )
  })
})
