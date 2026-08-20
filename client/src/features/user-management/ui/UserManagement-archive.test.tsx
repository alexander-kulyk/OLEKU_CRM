import { screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { archiveUser, readUsersList } from '../api/users-api'
import { listResponse, openEditDialog } from './UserManagement-test-support'

/**
 * Interaction coverage for `UserManagement`'s archive workflow
 * (task 6.4/6.5/6.6) — split from `UserManagement.test.tsx` (same support
 * module) to keep every file under the package's 250-line cap.
 */

vi.mock('../api/users-api', () => ({
  readUsersList: vi.fn(),
  readUserDetail: vi.fn(),
  updateUser: vi.fn(),
  archiveUser: vi.fn(),
}))

const mockedReadUsersList = vi.mocked(readUsersList)
const mockedArchiveUser = vi.mocked(archiveUser)

beforeEach(() => {
  mockedReadUsersList.mockClear()
  mockedArchiveUser.mockClear()
})

describe('UserManagement — archive', () => {
  it('disables Archive with an explanation for the operator editing their own record', async () => {
    await openEditDialog({ currentOperatorId: 'user-1' })

    const archiveButton = screen.getByRole('button', { name: 'Archive user' })
    expect(archiveButton).toBeDisabled()
    expect(screen.getByText('You cannot archive your own account.')).toBeInTheDocument()
  })

  it('disables Archive with an explanation when no operator identity is configured', async () => {
    await openEditDialog(undefined)

    expect(screen.getByRole('button', { name: 'Archive user' })).toBeDisabled()
    expect(
      screen.getByText('Archive is unavailable because the current operator could not be verified.'),
    ).toBeInTheDocument()
  })

  it('confirms, archives, and closes both dialogs, then refetches', async () => {
    const user = await openEditDialog({ currentOperatorId: 'operator-2' })
    mockedArchiveUser.mockResolvedValueOnce(undefined)
    mockedReadUsersList.mockResolvedValueOnce(listResponse([]))

    await user.click(screen.getByRole('button', { name: 'Archive user' }))
    const confirmDialog = await screen.findByRole('alertdialog', { name: 'Archive this user?' })
    expect(confirmDialog).toHaveTextContent(/removed from the Users list/i)
    expect(confirmDialog).not.toHaveTextContent(/irreversible|cannot be undone|permanently/i)

    await user.click(within(confirmDialog).getByRole('button', { name: 'Archive user' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    await waitFor(() => expect(mockedReadUsersList).toHaveBeenCalledTimes(2))
  })

  it('closes the confirmation and preserves the edit form for a last-administrator conflict', async () => {
    const user = await openEditDialog({ currentOperatorId: 'operator-2' })
    mockedArchiveUser.mockRejectedValueOnce({ code: 'CANNOT_ARCHIVE_LAST_ADMINISTRATIVE_USER', status: 409 })

    await user.click(screen.getByRole('button', { name: 'Archive user' }))
    const confirmDialog = await screen.findByRole('alertdialog', { name: 'Archive this user?' })
    await user.click(within(confirmDialog).getByRole('button', { name: 'Archive user' }))

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(screen.getByRole('dialog', { name: 'Edit Anna Smith' })).toBeInTheDocument()
    expect(
      await screen.findByText('This is the last administrative user and cannot be archived.'),
    ).toBeInTheDocument()
  })
})
