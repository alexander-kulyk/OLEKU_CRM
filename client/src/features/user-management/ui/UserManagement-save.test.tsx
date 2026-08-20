import { screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readUserDetail, readUsersList, updateUser } from '../api/users-api'
import { DETAIL, listResponse, openEditDialog } from './UserManagement-test-support'

/**
 * Interaction coverage for `UserManagement`'s save recovery matrix
 * (task 6.2/6.3/6.6, DOM-observable) — split from `UserManagement.test.tsx`
 * (same support module) to keep every file under the package's 250-line
 * cap.
 */

vi.mock('../api/users-api', () => ({
  readUsersList: vi.fn(),
  readUserDetail: vi.fn(),
  updateUser: vi.fn(),
  archiveUser: vi.fn(),
}))

const mockedReadUsersList = vi.mocked(readUsersList)
const mockedReadUserDetail = vi.mocked(readUserDetail)
const mockedUpdateUser = vi.mocked(updateUser)

beforeEach(() => {
  mockedReadUsersList.mockClear()
  mockedReadUserDetail.mockClear()
  mockedUpdateUser.mockClear()
})

describe('UserManagement — save recovery matrix (DOM-observable)', () => {
  it('shows a duplicate-email error inline and preserves unsaved values', async () => {
    const user = await openEditDialog()
    mockedUpdateUser.mockRejectedValueOnce({ code: 'EMAIL_ALREADY_EXISTS', status: 409, field: 'email' })

    await user.clear(screen.getByLabelText('First name'))
    await user.type(screen.getByLabelText('First name'), 'Hanna')
    await user.clear(screen.getByLabelText('Email'))
    await user.type(screen.getByLabelText('Email'), 'dup@example.com')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('This email address is already in use.')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('This email address is already in use.')
    // The unsaved first-name edit is untouched by the failed save.
    expect(screen.getByLabelText('First name')).toHaveValue('Hanna')
    expect(screen.getByRole('dialog', { name: 'Edit Anna Smith' })).toBeInTheDocument()
  })

  it('preserves an unsaved value in the DOM for an operation-level failure (e.g. a server error)', async () => {
    const user = await openEditDialog()
    mockedUpdateUser.mockRejectedValueOnce({ code: 'INTERNAL_ERROR', status: 500 })

    await user.clear(screen.getByLabelText('First name'))
    await user.type(screen.getByLabelText('First name'), 'Hanna')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Changes could not be saved. Please try again.')
    // Not just "the dialog is still open" — the actual typed value survives.
    expect(screen.getByLabelText('First name')).toHaveValue('Hanna')
    expect(screen.getByRole('dialog', { name: 'Edit Anna Smith' })).toBeInTheDocument()
  })

  it('offers Reload latest for a version conflict and never retries automatically', async () => {
    const user = await openEditDialog()
    mockedUpdateUser.mockRejectedValueOnce({ code: 'USER_VERSION_CONFLICT', status: 409 })

    await user.clear(screen.getByLabelText('Last name'))
    await user.type(screen.getByLabelText('Last name'), 'Kovalenko')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByRole('button', { name: 'Reload latest' })).toBeInTheDocument()
    expect(mockedUpdateUser).toHaveBeenCalledTimes(1)
    // The unsaved edit is preserved, not overwritten, while the conflict is showing.
    expect(screen.getByLabelText('Last name')).toHaveValue('Kovalenko')

    mockedReadUserDetail.mockResolvedValueOnce({ ...DETAIL, lastName: 'Reloaded', version: 8 })
    await user.click(screen.getByRole('button', { name: 'Reload latest' }))

    expect(await screen.findByRole('alertdialog', { name: 'Discard changes?' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Discard changes' }))

    await waitFor(() => expect(screen.getByLabelText('Last name')).toHaveValue('Reloaded'))
    expect(mockedUpdateUser).toHaveBeenCalledTimes(1)
  })

  it('acknowledges USER_ARCHIVED, then closes the editor and refetches', async () => {
    const user = await openEditDialog()
    mockedUpdateUser.mockRejectedValueOnce({ code: 'USER_ARCHIVED', status: 409 })
    mockedReadUsersList.mockResolvedValueOnce(listResponse([]))

    await user.clear(screen.getByLabelText('Last name'))
    await user.type(screen.getByLabelText('Last name'), 'Kovalenko')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    const acknowledgeDialog = await screen.findByRole('alertdialog', { name: 'This user was archived' })
    expect(screen.getByRole('dialog', { name: 'Edit Anna Smith' })).toBeInTheDocument()

    await user.click(within(acknowledgeDialog).getByRole('button', { name: 'OK' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(mockedReadUsersList).toHaveBeenCalledTimes(2))
  })
})
