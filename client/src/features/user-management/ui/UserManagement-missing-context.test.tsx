import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { openEditDialog } from './UserManagement-test-support'

/**
 * Interaction coverage for `UserManagement` with no runtime-context
 * injected at all (task 6.5/6.6, design.md D6) — split from
 * `UserManagement.test.tsx` (same support module) to keep every file
 * under the package's 250-line cap.
 */

vi.mock('../api/users-api', () => ({
  readUsersList: vi.fn(),
  readUserDetail: vi.fn(),
  updateUser: vi.fn(),
  archiveUser: vi.fn(),
}))

describe('UserManagement — missing runtime context', () => {
  it('renders and edits successfully with no runtime context supplied at all', async () => {
    await openEditDialog(undefined)

    expect(screen.getByRole('dialog', { name: 'Edit Anna Smith' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Archive user' })).toBeDisabled()
  })
})
