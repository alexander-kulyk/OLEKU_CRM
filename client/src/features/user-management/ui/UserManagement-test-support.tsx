import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { vi } from 'vitest'
import { ModalStackProvider } from '../../../shared/context/ModalStack'
import { readUserDetail, readUsersList } from '../api/users-api'
import type { UserDetailDto, UserListItemDto, UsersListResponse } from '../model/user-dto'
import type { UsersRuntimeContext } from '../model/users-runtime-context'
import { UserManagement } from './UserManagement'

/**
 * Shared fixtures/harness for `UserManagement`'s interaction test files
 * (task 6.6), split across `UserManagement.test.tsx` (edit wiring and
 * success), `-save.test.tsx`, `-archive.test.tsx`, `-dismissal.test.tsx`,
 * and `-missing-context.test.tsx` to keep every file under the package's
 * 250-line cap (mirrors `UsersList-test-support.tsx`'s split). Does NOT
 * call `vi.mock` itself — every consuming file must declare its own
 * `vi.mock('../api/users-api', ...)` before importing this module, exactly
 * like `use-user-management-controller-test-support.tsx`.
 */

export const LIST_ITEM: UserListItemDto = {
  id: 'user-1',
  firstName: 'Anna',
  lastName: 'Smith',
  email: 'anna@example.com',
  phone: null,
  address: null,
  status: 'active',
  lastLoginAt: null,
}

export const DETAIL: UserDetailDto = {
  ...LIST_ITEM,
  phoneExtension: null,
  archivedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-05T00:00:00.000Z',
  version: 7,
}

export function listResponse(items: readonly UserListItemDto[] = [LIST_ITEM]): UsersListResponse {
  return { items, pagination: { page: 1, pageSize: 20, total: items.length, totalPages: items.length > 0 ? 1 : 0 } }
}

export function renderUserManagement(runtimeContext?: UsersRuntimeContext) {
  return render(
    <MemoryRouter initialEntries={['/users']}>
      <ModalStackProvider>
        <UserManagement runtimeContext={runtimeContext} />
      </ModalStackProvider>
    </MemoryRouter>,
  )
}

/** Renders, waits for the list, opens Edit, and waits for the ready dialog. */
export async function openEditDialog(runtimeContext?: UsersRuntimeContext) {
  const user = userEvent.setup()
  vi.mocked(readUsersList).mockResolvedValue(listResponse())
  vi.mocked(readUserDetail).mockResolvedValueOnce(DETAIL)
  renderUserManagement(runtimeContext)

  await screen.findByRole('columnheader', { name: /First Name/i })
  await user.click(screen.getByRole('button', { name: 'Edit Anna Smith' }))
  await screen.findByRole('dialog', { name: 'Edit Anna Smith' })

  return user
}
