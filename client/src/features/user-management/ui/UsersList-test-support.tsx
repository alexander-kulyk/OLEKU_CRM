import type { ReactNode } from 'react'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import type { UserListItemDto, UsersListResponse } from '../model/user-dto'
import { UsersList } from './UsersList'

/**
 * Shared fixtures/harness for `UsersList`'s component-level test files
 * (task 4.5), split across `UsersList.test.tsx` (collection states) and
 * `UsersList-table.test.tsx` (table presentation, semantic sorting, status
 * filter) to keep both files under the package's 250-line cap. Renders the
 * real component tree with a memory router, not the actual `/users`
 * route/page (design.md D8; Stage 4 run prompt).
 */

export function makeResponse(overrides?: Partial<UsersListResponse>): UsersListResponse {
  return {
    items: [],
    pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
    ...overrides,
  }
}

export function renderUsersList(initialEntries: readonly string[] = ['/users']) {
  function wrapper({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={[...initialEntries]}>{children}</MemoryRouter>
  }

  return render(<UsersList />, { wrapper })
}

export const completeUser: UserListItemDto = {
  id: '507f1f77bcf86cd799439011',
  firstName: 'Anna',
  lastName: 'Smith',
  email: 'anna.smith@example.com',
  phone: '+380501234567',
  address: { street: '12 Main St', city: 'Kyiv', postalCode: '01001', country: 'Ukraine' },
  status: 'active',
  lastLoginAt: '2026-01-15T10:30:00.000Z',
}

export const partialUser: UserListItemDto = {
  id: '507f1f77bcf86cd799439012',
  firstName: 'Bohdan',
  lastName: 'Ivanenko',
  email: 'bohdan@example.com',
  phone: null,
  address: { street: null, city: 'Lviv', postalCode: null, country: null },
  status: 'inactive',
  lastLoginAt: null,
}

export const absentContactUser: UserListItemDto = {
  id: '507f1f77bcf86cd799439013',
  firstName: 'Carla',
  lastName: 'Nolan',
  email: 'carla@example.com',
  phone: null,
  address: null,
  status: 'blocked',
  lastLoginAt: null,
}
