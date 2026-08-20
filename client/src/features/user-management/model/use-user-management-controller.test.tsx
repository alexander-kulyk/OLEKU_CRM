import { act, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readUserDetail } from '../api/users-api'
import { openEditingSession, renderController } from './use-user-management-controller-test-support'

/**
 * Hook-level coverage for `useUserManagementController` (task 6.1-6.5):
 * the detail-before-edit read, including notice/refetch/401 behavior. The
 * save recovery matrix, archive, and dismissal/reload-latest groups live
 * in sibling `-save`/`-archive`/`-dismissal.test.tsx` files (same support
 * module) to keep every file under the package's 250-line cap. DOM-
 * observable behavior — unsaved form VALUES surviving a failure, focus,
 * and stacked dialogs — is covered by `ui/UserManagement*.test.tsx`
 * instead; this file only asserts the controller's own state
 * (`values`/`handlers`), which owns none of that itself.
 * `readUserDetail`/`updateUser`/`archiveUser` are mocked at the feature's
 * API boundary — no real request ever leaves the process.
 */

vi.mock('../api/users-api', () => ({
  readUserDetail: vi.fn(),
  updateUser: vi.fn(),
  archiveUser: vi.fn(),
}))

const mockedReadUserDetail = vi.mocked(readUserDetail)

// `vi.mock`-factory-created `vi.fn()`s are not covered by
// `vitest.config.ts`'s `restoreMocks: true` (see `use-users-list.test.tsx`
// for why) — cleared explicitly so every test starts from zero calls.
beforeEach(() => {
  mockedReadUserDetail.mockClear()
})

describe('useUserManagementController — detail-before-edit', () => {
  it('opens with the detail response once the read resolves', async () => {
    const view = await openEditingSession()

    expect(view.result.current.values.detailState).toEqual({
      status: 'ready',
      detail: expect.objectContaining({ id: 'user-1' }),
    })
    expect(mockedReadUserDetail).toHaveBeenCalledWith('user-1', expect.anything())
  })

  it('does not open, notifies, and refetches when the record is archived elsewhere', async () => {
    mockedReadUserDetail.mockResolvedValueOnce({
      id: 'user-1',
      firstName: 'Anna',
      lastName: 'Smith',
      email: 'anna@example.com',
      phone: null,
      address: null,
      status: 'active',
      lastLoginAt: null,
      phoneExtension: null,
      archivedAt: '2026-01-10T00:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-05T00:00:00.000Z',
      version: 7,
    })
    const view = renderController()

    act(() => view.result.current.handlers.onEditUser('user-1'))
    await waitFor(() => expect(view.result.current.values.notice).not.toBeNull())

    expect(view.result.current.values.detailState).toBeNull()
    expect(view.result.current.values.refetchSignal).toBe(1)
  })

  it('does not open, notifies, and refetches on a 404', async () => {
    mockedReadUserDetail.mockRejectedValueOnce({ code: 'NOT_FOUND', status: 404 })
    const view = renderController()

    act(() => view.result.current.handlers.onEditUser('user-1'))
    await waitFor(() => expect(view.result.current.values.notice).not.toBeNull())

    expect(view.result.current.values.refetchSignal).toBe(1)
  })

  it('notifies without refetching for a generic detail-read failure', async () => {
    mockedReadUserDetail.mockRejectedValueOnce({ code: 'INTERNAL_ERROR', status: 500 })
    const view = renderController()

    act(() => view.result.current.handlers.onEditUser('user-1'))
    await waitFor(() => expect(view.result.current.values.notice).not.toBeNull())

    expect(view.result.current.values.refetchSignal).toBe(0)
  })

  it('delegates a 401 to the injected recovery callback', async () => {
    const onUnauthorized = vi.fn()
    mockedReadUserDetail.mockRejectedValueOnce({ code: 'TRANSPORT_ERROR', status: 401 })
    const view = renderController({ onUnauthorized })

    act(() => view.result.current.handlers.onEditUser('user-1'))

    await waitFor(() => expect(onUnauthorized).toHaveBeenCalledTimes(1))
  })

  it('dismisses the notice on demand', async () => {
    mockedReadUserDetail.mockRejectedValueOnce({ code: 'NOT_FOUND', status: 404 })
    const view = renderController()

    act(() => view.result.current.handlers.onEditUser('user-1'))
    await waitFor(() => expect(view.result.current.values.notice).not.toBeNull())

    act(() => view.result.current.handlers.onDismissNotice())
    expect(view.result.current.values.notice).toBeNull()
  })
})
