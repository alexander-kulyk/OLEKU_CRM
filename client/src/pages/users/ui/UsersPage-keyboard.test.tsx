import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  DETAIL,
  LIST_ITEM,
  queueUpdateUser,
  queueUserDetail,
  queueUsersList,
  renderAppAt,
  resetUsersPageHttpMocks,
  usersListResponse,
} from './UsersPage-test-support'

/**
 * The keyboard-only list/edit round trip (task 7.4), rendered through the
 * real `/users` route. Every interaction below moves focus with `.focus()`
 * and activates with `user.keyboard()` only — never `user.click()`, and
 * never plain `user.type()`, which clicks the target first by default
 * (`@testing-library/user-event`'s `type()` calls `this.click(element)`
 * unless `skipClick` is passed). Split from `UsersPage.test.tsx` (same
 * support module) to keep every file under the package's 250-line cap.
 *
 * The real, currently unwired `/users` route supplies no runtime context
 * (task 7.1 — the operator/settings provider does not exist yet, design.md
 * D6), so Archive is always disabled here, exactly like a real operator
 * would see today. This is intentional, not a gap: it reflects actual
 * production behavior. `UserManagement-archive.test.tsx` (feature-level)
 * already covers the enabled path with an injected `currentOperatorId`;
 * `UsersPage.test.tsx`'s "runtime-context seam" test proves `UsersPage`
 * itself forwards a supplied context to the feature.
 */

beforeEach(() => {
  resetUsersPageHttpMocks()
})

describe('UsersPage — keyboard-only list/edit flow', () => {
  it('opens Edit, saves a change by keyboard, reopens, and reaches a correctly-disabled, explained Archive action', async () => {
    const user = userEvent.setup()

    queueUsersList(
      usersListResponse({ items: [LIST_ITEM], pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 } }),
    )
    renderAppAt('/users')

    // 1. List: reach and activate the record-specific Edit action by keyboard.
    const editButton = await screen.findByRole('button', { name: 'Edit Anna Smith' })
    editButton.focus()
    queueUserDetail(DETAIL)
    await user.keyboard('{Enter}')

    const editDialog = await screen.findByRole('dialog', { name: 'Edit Anna Smith' })
    const lastNameInput = within(editDialog).getByLabelText('Last name')

    // 2. Edit: change a field by keyboard only. `.clear()` focuses,
    // selects, and deletes without a pointer click, and `user.keyboard()`
    // always types into whatever is already focused rather than clicking a
    // target.
    await user.clear(lastNameInput)
    await user.keyboard('Kovalenko')
    expect(lastNameInput).toHaveValue('Kovalenko')

    const saveButton = within(editDialog).getByRole('button', { name: 'Save changes' })
    saveButton.focus()
    queueUpdateUser({ ...DETAIL, lastName: 'Kovalenko', version: 8 })
    queueUsersList(
      usersListResponse({
        items: [{ ...LIST_ITEM, lastName: 'Kovalenko' }],
        pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      }),
    )
    await user.keyboard('{Enter}')

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    const reopenEditButton = await screen.findByRole('button', { name: 'Edit Anna Kovalenko' })

    // 3. Reopen Edit by keyboard, then reach Archive.
    reopenEditButton.focus()
    queueUserDetail({ ...DETAIL, lastName: 'Kovalenko', version: 8 })
    await user.keyboard('{Enter}')

    const reopenedDialog = await screen.findByRole('dialog', { name: 'Edit Anna Kovalenko' })
    const archiveButton = within(reopenedDialog).getByRole('button', { name: 'Archive user' })

    // A disabled control cannot itself receive focus (correct native
    // behavior — it is intentionally excluded from the Tab order), but its
    // explanation is still reachable and rendered right beside it, so a
    // keyboard/screen-reader operator is never left without a reason.
    expect(archiveButton).toBeDisabled()
    expect(
      within(reopenedDialog).getByText('Archive is unavailable because the current operator could not be verified.'),
    ).toBeInTheDocument()
  })
})
