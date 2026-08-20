import { screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readUserDetail, readUsersList, updateUser } from '../api/users-api'
import { DETAIL, listResponse, openEditDialog } from './UserManagement-test-support'

/**
 * Interaction coverage for the composed Users controller (task 6.6): the
 * `UsersTableRow` Edit action actually opening the dialog, a successful
 * save closing it and refetching the canonical list so a now-non-matching
 * row disappears. The full recovery matrix, archive, dirty-dismissal, and
 * missing-runtime-context coverage live in sibling `UserManagement-*
 * .test.tsx` files (same support module) to keep every file under the
 * package's 250-line cap. `UsersList`'s own collection-state/URL behavior
 * is Stage 4's coverage; this file only exercises what Stage 6 added on
 * top of it. Renders the real composed tree with a memory router and the
 * shared modal stack, not the actual `/users` route (Stage 7).
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

describe('UserManagement — edit wiring and success', () => {
  it("requests the detail read and opens the dialog from the list's Edit action", async () => {
    await openEditDialog()

    expect(mockedReadUserDetail).toHaveBeenCalledWith('user-1', expect.anything())
    expect(screen.getByLabelText('First name')).toHaveValue('Anna')
  })

  it('closes the dialog, refetches, and lets a now-non-matching row disappear', async () => {
    const user = await openEditDialog()
    mockedUpdateUser.mockResolvedValueOnce({ ...DETAIL, status: 'inactive', version: 8 })
    mockedReadUsersList.mockResolvedValueOnce(listResponse([]))

    await user.clear(screen.getByLabelText('Last name'))
    await user.type(screen.getByLabelText('Last name'), 'Kovalenko')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(mockedReadUsersList).toHaveBeenCalledTimes(2))
    expect(screen.queryByText('Anna')).not.toBeInTheDocument()
  })
})
