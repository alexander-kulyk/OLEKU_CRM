import { act, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readUserDetail, updateUser } from '../api/users-api'
import { DETAIL, openEditingSession } from './use-user-management-controller-test-support'

/**
 * Hook-level coverage for `useUserManagementController`'s dirty-dismissal
 * and guarded reload-latest behavior (task 6.1/6.3) — split from
 * `use-user-management-controller.test.tsx` (same support module) to keep
 * both files under the package's 250-line cap.
 */

vi.mock('../api/users-api', () => ({
  readUserDetail: vi.fn(),
  updateUser: vi.fn(),
  archiveUser: vi.fn(),
}))

const mockedReadUserDetail = vi.mocked(readUserDetail)
const mockedUpdateUser = vi.mocked(updateUser)

beforeEach(() => {
  mockedReadUserDetail.mockClear()
  mockedUpdateUser.mockClear()
})

describe('useUserManagementController — dismissal and reload-latest', () => {
  it('closes immediately for a clean dismissal', async () => {
    const view = await openEditingSession()

    act(() => view.result.current.handlers.onRequestClose(false))

    expect(view.result.current.values.detailState).toBeNull()
  })

  it('opens a discard confirmation for a dirty dismissal; Continue editing preserves the session', async () => {
    const view = await openEditingSession()

    act(() => view.result.current.handlers.onRequestClose(true))
    expect(view.result.current.values.confirmationKind).toBe('discard-close')

    act(() => view.result.current.handlers.onDiscardContinue())
    expect(view.result.current.values.confirmationKind).toBeNull()
    expect(view.result.current.values.detailState?.status).toBe('ready')
  })

  it('Discard changes closes the whole session', async () => {
    const view = await openEditingSession()

    act(() => view.result.current.handlers.onRequestClose(true))
    act(() => view.result.current.handlers.onDiscardConfirmed())

    expect(view.result.current.values.detailState).toBeNull()
  })

  it('reloads immediately when reload-latest is requested on a clean form', async () => {
    mockedUpdateUser.mockRejectedValueOnce({ code: 'USER_VERSION_CONFLICT', status: 409 })
    const view = await openEditingSession()

    await act(async () => {
      await view.result.current.handlers.onSave('user-1', { lastName: 'X', version: 7 })
    })

    mockedReadUserDetail.mockResolvedValueOnce({ ...DETAIL, version: 8 })
    act(() => view.result.current.handlers.onReloadLatestRequested(false))

    await waitFor(() => expect(mockedReadUserDetail).toHaveBeenCalledTimes(2))
    await waitFor(() =>
      expect(view.result.current.values.detailState).toEqual({ status: 'ready', detail: { ...DETAIL, version: 8 } }),
    )
  })

  it('guards a dirty reload-latest with a discard confirmation before reloading', async () => {
    mockedUpdateUser.mockRejectedValueOnce({ code: 'USER_VERSION_CONFLICT', status: 409 })
    const view = await openEditingSession()

    await act(async () => {
      await view.result.current.handlers.onSave('user-1', { lastName: 'X', version: 7 })
    })

    act(() => view.result.current.handlers.onReloadLatestRequested(true))
    expect(view.result.current.values.confirmationKind).toBe('discard-reload')
    expect(mockedReadUserDetail).toHaveBeenCalledTimes(1)

    mockedReadUserDetail.mockResolvedValueOnce({ ...DETAIL, version: 8 })
    act(() => view.result.current.handlers.onDiscardConfirmed())

    await waitFor(() => expect(mockedReadUserDetail).toHaveBeenCalledTimes(2))
  })
})
