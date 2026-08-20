import { act } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { updateUser } from '../api/users-api'
import { DETAIL, openEditingSession } from './use-user-management-controller-test-support'

/**
 * Hook-level coverage for `useUserManagementController`'s save recovery
 * matrix (task 6.2/6.3, design.md D7) — split from
 * `use-user-management-controller.test.tsx` (same support module) to keep
 * both files under the package's 250-line cap.
 */

vi.mock('../api/users-api', () => ({
  readUserDetail: vi.fn(),
  updateUser: vi.fn(),
  archiveUser: vi.fn(),
}))

const mockedUpdateUser = vi.mocked(updateUser)

beforeEach(() => {
  mockedUpdateUser.mockClear()
})

describe('useUserManagementController — save recovery matrix', () => {
  it('closes and refetches on a successful save', async () => {
    mockedUpdateUser.mockResolvedValueOnce(DETAIL)
    const view = await openEditingSession()

    await act(async () => {
      await view.result.current.handlers.onSave('user-1', { lastName: 'Kovalenko', version: 7 })
    })

    expect(view.result.current.values.detailState).toBeNull()
    expect(view.result.current.values.refetchSignal).toBe(1)
  })

  it('attaches a duplicate-email failure to the email field and keeps the dialog open', async () => {
    mockedUpdateUser.mockRejectedValueOnce({ code: 'EMAIL_ALREADY_EXISTS', status: 409, field: 'email' })
    const view = await openEditingSession()

    await act(async () => {
      await view.result.current.handlers.onSave('user-1', { email: 'dup@example.com', version: 7 })
    })

    expect(view.result.current.values.fieldError).toEqual({ field: 'email', message: expect.any(String) })
    expect(view.result.current.values.detailState?.status).toBe('ready')
  })

  it('attaches an archived-owner duplicate email the same way', async () => {
    mockedUpdateUser.mockRejectedValueOnce({ code: 'EMAIL_TAKEN_BY_ARCHIVED_USER', status: 409, field: 'email' })
    const view = await openEditingSession()

    await act(async () => {
      await view.result.current.handlers.onSave('user-1', { email: 'dup@example.com', version: 7 })
    })

    expect(view.result.current.values.fieldError?.field).toBe('email')
  })

  it('places a validation failure on its named field when the server supplies one', async () => {
    mockedUpdateUser.mockRejectedValueOnce({ code: 'VALIDATION_ERROR', status: 400, field: 'firstName' })
    const view = await openEditingSession()

    await act(async () => {
      await view.result.current.handlers.onSave('user-1', { firstName: 'A', version: 7 })
    })

    expect(view.result.current.values.fieldError).toEqual({ field: 'firstName', message: expect.any(String) })
  })

  it('shows an operation-level error for a fieldless validation failure', async () => {
    mockedUpdateUser.mockRejectedValueOnce({ code: 'VALIDATION_ERROR', status: 400 })
    const view = await openEditingSession()

    await act(async () => {
      await view.result.current.handlers.onSave('user-1', { firstName: 'A', version: 7 })
    })

    expect(view.result.current.values.operationError).toEqual({ kind: 'form', message: expect.any(String) })
    expect(view.result.current.values.fieldError).toBeNull()
  })

  it('offers a guarded reload for a version conflict without retrying automatically', async () => {
    mockedUpdateUser.mockRejectedValueOnce({ code: 'USER_VERSION_CONFLICT', status: 409 })
    const view = await openEditingSession()

    await act(async () => {
      await view.result.current.handlers.onSave('user-1', { lastName: 'X', version: 7 })
    })

    expect(view.result.current.values.operationError?.kind).toBe('version-conflict')
    expect(view.result.current.values.detailState?.status).toBe('ready')
    expect(mockedUpdateUser).toHaveBeenCalledTimes(1)
  })

  it('acknowledges USER_ARCHIVED, preserving the form until dismissed, then closes and refetches', async () => {
    mockedUpdateUser.mockRejectedValueOnce({ code: 'USER_ARCHIVED', status: 409 })
    const view = await openEditingSession()

    await act(async () => {
      await view.result.current.handlers.onSave('user-1', { lastName: 'X', version: 7 })
    })

    expect(view.result.current.values.confirmationKind).toBe('archived-acknowledge')
    expect(view.result.current.values.detailState?.status).toBe('ready')

    act(() => view.result.current.handlers.onAcknowledge())

    expect(view.result.current.values.detailState).toBeNull()
    expect(view.result.current.values.refetchSignal).toBe(1)
  })

  it('delegates a 401 without resetting the dirty form', async () => {
    const onUnauthorized = vi.fn()
    mockedUpdateUser.mockRejectedValueOnce({ code: 'TRANSPORT_ERROR', status: 401 })
    const view = await openEditingSession({ onUnauthorized })

    await act(async () => {
      await view.result.current.handlers.onSave('user-1', { lastName: 'X', version: 7 })
    })

    expect(onUnauthorized).toHaveBeenCalledTimes(1)
    expect(view.result.current.values.operationError).toBeNull()
    expect(view.result.current.values.detailState?.status).toBe('ready')
  })

  it('shows an auth-recovery-unavailable message when no callback is supplied, form intact', async () => {
    mockedUpdateUser.mockRejectedValueOnce({ code: 'TRANSPORT_ERROR', status: 401 })
    const view = await openEditingSession()

    await act(async () => {
      await view.result.current.handlers.onSave('user-1', { lastName: 'X', version: 7 })
    })

    expect(view.result.current.values.operationError?.kind).toBe('form')
    expect(view.result.current.values.detailState?.status).toBe('ready')
  })

  it.each([
    ['forbidden', { code: 'TRANSPORT_ERROR', status: 403 }],
    ['rate-limited', { code: 'TRANSPORT_ERROR', status: 429 }],
    ['a server error', { code: 'INTERNAL_ERROR', status: 500 }],
    ['a transport failure', { code: 'TRANSPORT_ERROR' }],
  ])('shows an operation-level recovery message for %s, form preserved', async (_label, error) => {
    mockedUpdateUser.mockRejectedValueOnce(error)
    const view = await openEditingSession()

    await act(async () => {
      await view.result.current.handlers.onSave('user-1', { lastName: 'X', version: 7 })
    })

    expect(view.result.current.values.operationError?.kind).toBe('form')
    expect(view.result.current.values.detailState?.status).toBe('ready')
  })

  it('shows no visible error and releases the busy flag for a cancelled save', async () => {
    mockedUpdateUser.mockRejectedValueOnce({ code: 'REQUEST_CANCELLED' })
    const view = await openEditingSession()

    await act(async () => {
      await view.result.current.handlers.onSave('user-1', { lastName: 'X', version: 7 })
    })

    expect(view.result.current.values.operationError).toBeNull()
    expect(view.result.current.values.fieldError).toBeNull()
    expect(view.result.current.values.isSaving).toBe(false)
    expect(view.result.current.values.detailState?.status).toBe('ready')
  })
})
