import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { openEditDialog } from './UserManagement-test-support'

/**
 * Interaction coverage for `UserManagement`'s dirty-dismissal, Escape, and
 * stacked-dialog behavior (task 6.1/6.6) — split from
 * `UserManagement.test.tsx` (same support module) to keep every file under
 * the package's 250-line cap.
 */

vi.mock('../api/users-api', () => ({
  readUsersList: vi.fn(),
  readUserDetail: vi.fn(),
  updateUser: vi.fn(),
  archiveUser: vi.fn(),
}))

describe('UserManagement — dirty dismissal, Escape, and stacked dialogs', () => {
  it('opens a discard confirmation on Escape while dirty; only the topmost dialog responds', async () => {
    const user = await openEditDialog()

    await user.clear(screen.getByLabelText('First name'))
    await user.type(screen.getByLabelText('First name'), 'Hanna')
    await user.keyboard('{Escape}')

    const discardDialog = await screen.findByRole('alertdialog', { name: 'Discard changes?' })
    expect(screen.getByRole('dialog', { name: 'Edit Anna Smith' })).toBeInTheDocument()

    // Escape now only closes the topmost (discard) confirmation.
    await user.keyboard('{Escape}')
    expect(discardDialog).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Edit Anna Smith' })).toBeInTheDocument()
    expect(screen.getByLabelText('First name')).toHaveValue('Hanna')
  })

  it('Continue editing keeps the unsaved value; Discard changes closes and drops it', async () => {
    const user = await openEditDialog()

    await user.clear(screen.getByLabelText('First name'))
    await user.type(screen.getByLabelText('First name'), 'Hanna')
    await user.click(screen.getByRole('button', { name: 'Close' }))

    await user.click(await screen.findByRole('button', { name: 'Continue editing' }))
    expect(screen.getByLabelText('First name')).toHaveValue('Hanna')

    await user.click(screen.getByRole('button', { name: 'Close' }))
    await user.click(await screen.findByRole('button', { name: 'Discard changes' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes immediately for a clean dismissal (no confirmation)', async () => {
    const user = await openEditDialog()

    await user.click(screen.getByRole('button', { name: 'Close' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })
})
