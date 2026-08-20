import { act, renderHook, waitFor } from '@testing-library/react'
import { expect, vi } from 'vitest'
import { readUserDetail } from '../api/users-api'
import type { UserDetailDto } from './user-dto'
import type { UsersRuntimeContext } from './users-runtime-context'
import { useUserManagementController } from './use-user-management-controller'

/**
 * Shared fixtures/harness for `useUserManagementController`'s hook-level
 * test files (task 6.1-6.5), split across `use-user-management-controller.test.tsx`
 * (detail-before-edit), `-save.test.tsx`, `-archive.test.tsx`, and
 * `-dismissal.test.tsx` to keep every file under the package's 250-line
 * cap (mirrors `use-users-list-test-support.tsx`'s split). Does NOT call
 * `vi.mock` itself — `vi.mock` is hoisted per test FILE, so every
 * consuming file must declare its own `vi.mock('../api/users-api', ...)`
 * before importing this module; `readUserDetail` here resolves to that
 * same file's mocked instance once it does.
 */

export const DETAIL: UserDetailDto = {
  id: 'user-1',
  firstName: 'Anna',
  lastName: 'Smith',
  email: 'anna@example.com',
  phone: null,
  address: null,
  status: 'active',
  lastLoginAt: null,
  phoneExtension: null,
  archivedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-05T00:00:00.000Z',
  version: 7,
}

export function renderController(runtimeContext?: UsersRuntimeContext) {
  return renderHook(() => useUserManagementController({ runtimeContext }))
}

/** Opens the editor and resolves detail to a ready `'editing'` session. */
export async function openEditingSession(runtimeContext?: UsersRuntimeContext, detail: UserDetailDto = DETAIL) {
  vi.mocked(readUserDetail).mockResolvedValueOnce(detail)
  const view = renderController(runtimeContext)

  act(() => view.result.current.handlers.onEditUser(detail.id))
  await waitFor(() => expect(view.result.current.values.detailState?.status).toBe('ready'))

  return view
}
