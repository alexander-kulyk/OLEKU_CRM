import { act, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readUsersList } from '../api/users-api'
import { makeResponse, renderUsersList } from './use-users-list-test-support'

/**
 * Hook-level coverage for `useUsersList` (task 4.1/4.5): the initial
 * request, search debounce, and the explicit-control-vs-typed-search
 * distinction. Request races/cancellation/Retry/URL repair/pagination
 * repair/server-only dataset handling live in
 * `use-users-list-recovery.test.tsx` (same support module, split to keep
 * both files under the package's 250-line cap). `readUsersList` is mocked
 * at the feature's API boundary — no real request ever leaves the process
 * (design.md D8).
 */

vi.mock('../api/users-api', () => ({
  readUsersList: vi.fn(),
}))

const mockedReadUsersList = vi.mocked(readUsersList)

afterEach(() => {
  vi.useRealTimers()
})

// `vi.mock`-factory-created `vi.fn()`s are NOT covered by
// `vitest.config.ts`'s `restoreMocks: true` — that option only calls
// `mockRestore()` on spies created via `vi.spyOn` (which carry a real
// "restore the original implementation" callback); a bare `vi.fn()` has
// no such callback and is silently skipped by `vi.restoreAllMocks()`
// (`@vitest/spy`'s `restoreAllMocks` iterates only spies registered with
// a `restore` callback). This mock's call history is therefore cleared
// explicitly here so each test starts from zero recorded calls.
beforeEach(() => {
  mockedReadUsersList.mockClear()
})

describe('useUsersList — initial request', () => {
  it('requests page 1, page size 20, no search/status, and default sort with no query params', async () => {
    mockedReadUsersList.mockResolvedValue(makeResponse())

    renderUsersList()

    await waitFor(() => expect(mockedReadUsersList).toHaveBeenCalledTimes(1))
    expect(mockedReadUsersList).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        pageSize: 20,
        search: '',
        statuses: [],
        sortField: 'lastName',
        sortDirection: 'asc',
      }),
      expect.anything(),
    )
  })
})

describe('useUsersList — search debounce', () => {
  it('requests only the final settled value after ~300ms of no further edits', async () => {
    vi.useFakeTimers()
    mockedReadUsersList.mockResolvedValue(makeResponse())

    const { result } = renderUsersList()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(mockedReadUsersList).toHaveBeenCalledTimes(1)

    act(() => result.current.controls.setSearch('a'))
    act(() => result.current.controls.setSearch('an'))
    act(() => result.current.controls.setSearch('ann'))
    act(() => result.current.controls.setSearch('anna'))

    // Typing alone never fires a new request before the debounce settles.
    expect(mockedReadUsersList).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(299)
    })
    expect(mockedReadUsersList).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(mockedReadUsersList).toHaveBeenCalledTimes(2)
    expect(mockedReadUsersList).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: 'anna' }),
      expect.anything(),
    )
  })

  it('never requests a one-character search, keeping the active non-search controls', async () => {
    vi.useFakeTimers()
    mockedReadUsersList.mockResolvedValue(makeResponse())

    const { result } = renderUsersList(['/users?status=active'])
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(mockedReadUsersList).toHaveBeenCalledTimes(1)
    expect(mockedReadUsersList).toHaveBeenLastCalledWith(
      expect.objectContaining({ statuses: ['active'] }),
      expect.anything(),
    )

    act(() => result.current.controls.setSearch('a'))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })

    expect(result.current.isSearchTooShort).toBe(true)
    // A one-character search never changes the outgoing wire query (it
    // stays omitted either way), so no additional request is issued at
    // all — the active status filter from before remains the only
    // request made (specs/user-management/spec.md — "One-character search
    // is not requested").
    expect(mockedReadUsersList).toHaveBeenCalledTimes(1)
  })
})

describe('useUsersList — filter/search distinctions', () => {
  it('applies an explicit status change immediately, without waiting for the search debounce', async () => {
    vi.useFakeTimers()
    mockedReadUsersList.mockResolvedValue(makeResponse())

    const { result } = renderUsersList()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(mockedReadUsersList).toHaveBeenCalledTimes(1)

    act(() => result.current.controls.toggleStatus('active'))
    // No time advanced at all — an explicit control change is immediate.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(mockedReadUsersList).toHaveBeenCalledTimes(2)
    expect(mockedReadUsersList).toHaveBeenLastCalledWith(
      expect.objectContaining({ statuses: ['active'] }),
      expect.anything(),
    )
  })

  it('Clear filters resets search/statuses/page immediately, resetting the pending debounce too', async () => {
    vi.useFakeTimers()
    mockedReadUsersList.mockResolvedValue(makeResponse())

    const { result } = renderUsersList(['/users?search=anna&status=active'])
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(mockedReadUsersList).toHaveBeenCalledTimes(1)

    act(() => result.current.controls.clearFilters())
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(mockedReadUsersList).toHaveBeenCalledTimes(2)
    expect(mockedReadUsersList).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: '', statuses: [], page: 1 }),
      expect.anything(),
    )
    expect(result.current.navigationType).toBe('PUSH')
  })
})
