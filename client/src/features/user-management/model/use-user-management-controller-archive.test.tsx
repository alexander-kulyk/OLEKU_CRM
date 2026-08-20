import { act } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { archiveUser } from '../api/users-api'
import { openEditingSession } from './use-user-management-controller-test-support'

/**
 * Hook-level coverage for `useUserManagementController`'s archive workflow
 * (task 6.4/6.5) — split from `use-user-management-controller.test.tsx`
 * (same support module) to keep both files under the package's 250-line
 * cap.
 */

vi.mock('../api/users-api', () => ({
  readUserDetail: vi.fn(),
  updateUser: vi.fn(),
  archiveUser: vi.fn(),
}))

const mockedArchiveUser = vi.mocked(archiveUser)

beforeEach(() => {
  mockedArchiveUser.mockClear()
})

describe('useUserManagementController — archive', () => {
  it('disables Archive with an explanation when operator identity is missing', async () => {
    const view = await openEditingSession()

    expect(view.result.current.values.archiveIsDisabled).toBe(true)
    expect(view.result.current.values.archiveDisabledReason).toEqual(expect.any(String))
  })

  it('disables Archive when the operator matches the edited record', async () => {
    const view = await openEditingSession({ currentOperatorId: 'user-1' })

    expect(view.result.current.values.archiveIsDisabled).toBe(true)
    expect(view.result.current.values.archiveDisabledReason).toEqual(expect.any(String))
  })

  it('enables Archive for a different, verified operator', async () => {
    const view = await openEditingSession({ currentOperatorId: 'operator-2' })

    expect(view.result.current.values.archiveIsDisabled).toBe(false)
    expect(view.result.current.values.archiveDisabledReason).toBeUndefined()
  })

  it('opens a confirmation, then closes both and refetches on success', async () => {
    mockedArchiveUser.mockResolvedValueOnce(undefined)
    const view = await openEditingSession({ currentOperatorId: 'operator-2' })

    act(() => view.result.current.handlers.onArchiveRequested())
    expect(view.result.current.values.confirmationKind).toBe('archive')

    await act(async () => {
      await view.result.current.handlers.onArchiveConfirmed()
    })

    expect(view.result.current.values.detailState).toBeNull()
    expect(view.result.current.values.refetchSignal).toBe(1)
  })

  it.each([
    ['self', 'CANNOT_ARCHIVE_SELF'],
    ['last administrator', 'CANNOT_ARCHIVE_LAST_ADMINISTRATIVE_USER'],
  ])('closes the confirmation and preserves the form for a %s conflict', async (_label, code) => {
    mockedArchiveUser.mockRejectedValueOnce({ code, status: 409 })
    const view = await openEditingSession({ currentOperatorId: 'operator-2' })

    act(() => view.result.current.handlers.onArchiveRequested())
    await act(async () => {
      await view.result.current.handlers.onArchiveConfirmed()
    })

    expect(view.result.current.values.confirmationKind).toBeNull()
    expect(view.result.current.values.detailState?.status).toBe('ready')
    expect(view.result.current.values.operationError).toEqual({ kind: 'form', message: expect.any(String) })
  })

  it('delegates a 401 during archive without closing the edit dialog', async () => {
    const onUnauthorized = vi.fn()
    mockedArchiveUser.mockRejectedValueOnce({ code: 'TRANSPORT_ERROR', status: 401 })
    const view = await openEditingSession({ currentOperatorId: 'operator-2', onUnauthorized })

    act(() => view.result.current.handlers.onArchiveRequested())
    await act(async () => {
      await view.result.current.handlers.onArchiveConfirmed()
    })

    expect(onUnauthorized).toHaveBeenCalledTimes(1)
    expect(view.result.current.values.confirmationKind).toBeNull()
    expect(view.result.current.values.detailState?.status).toBe('ready')
  })
})
