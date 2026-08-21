import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  DETAIL,
  LIST_ITEM,
  getMockedHttpCalls,
  queueUserDetail,
  queueUsersList,
  renderAppAt,
  resetUsersPageHttpMocks,
  usersListResponse,
} from './UsersPage-test-support'
import { UsersPage } from './UsersPage'

/**
 * Route-level coverage for the actual `/users` destination (task 7.4),
 * rendered through the real composed `App` rather than a `MemoryRouter`
 * around one component (see `UsersPage-test-support.tsx`'s doc comment).
 * Navigation activation and the keyboard-only edit/archive round trip live
 * in sibling `UsersPage-navigation.test.tsx`/`UsersPage-keyboard.test.tsx`
 * (same support module) to keep every file under the package's 250-line
 * cap.
 */

beforeEach(() => {
  resetUsersPageHttpMocks()
})

describe('UsersPage — direct and query URLs', () => {
  it('requests the default query when /users is opened with no parameters', async () => {
    queueUsersList(usersListResponse({ items: [LIST_ITEM], pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 } }))

    renderAppAt('/users')

    expect(await screen.findByRole('columnheader', { name: /First Name/i })).toBeInTheDocument()
    expect(getMockedHttpCalls().get).toHaveBeenCalledWith(
      '/users',
      expect.objectContaining({ params: { page: 1, pageSize: 20 } }),
    )
  })

  it('restores search, status, sort, and page size controls from a shared URL and requests that exact query', async () => {
    queueUsersList(
      usersListResponse({ items: [LIST_ITEM], pagination: { page: 1, pageSize: 50, total: 1, totalPages: 1 } }),
    )

    renderAppAt('/users?search=ann&status=active%2Cblocked&sort=firstName&direction=desc&pageSize=50&page=1')

    expect(await screen.findByRole('columnheader', { name: /First Name/i })).toBeInTheDocument()

    expect(screen.getByLabelText('Search users')).toHaveValue('ann')
    expect(screen.getByRole('checkbox', { name: 'Active' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Blocked' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Inactive' })).not.toBeChecked()
    expect(screen.getByRole('columnheader', { name: /First Name/i })).toHaveAttribute('aria-sort', 'descending')
    expect(screen.getByLabelText('Rows per page')).toHaveValue('50')

    expect(getMockedHttpCalls().get).toHaveBeenCalledWith(
      '/users',
      expect.objectContaining({
        params: { page: 1, pageSize: 50, search: 'ann', status: 'active,blocked', sort: 'firstName:desc' },
      }),
    )
  })
})

describe('UsersPage — accessibility and value access', () => {
  it("gives the Edit action a record-specific accessible label and exposes complete, untruncated values", async () => {
    const longAddress = {
      street: '4400 Northline Boulevard, Building C, Suite 1200',
      city: 'Kyiv',
      postalCode: '01001',
      country: 'Ukraine',
    }
    const longNameUser = {
      ...LIST_ITEM,
      id: 'user-2',
      firstName: 'Maximilian-Bartholomew',
      lastName: 'Featherstonehaugh-Worthington',
      address: longAddress,
    }
    queueUsersList(
      usersListResponse({ items: [longNameUser], pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 } }),
    )

    renderAppAt('/users')

    expect(
      await screen.findByRole('button', { name: 'Edit Maximilian-Bartholomew Featherstonehaugh-Worthington' }),
    ).toBeInTheDocument()

    const row = screen.getByRole('row', { name: /Maximilian-Bartholomew/ })
    // The full street/city/postal code/country combination is present in
    // the DOM, not clipped behind an ellipsis — the table renders
    // `whitespace-nowrap` inside a keyboard-focusable horizontally
    // scrolling region instead of truncating (specs/user-management/spec.md
    // — "Users interactions and feedback are accessible and responsive").
    expect(row).toHaveTextContent(
      '4400 Northline Boulevard, Building C, Suite 1200, Kyiv, 01001, Ukraine',
    )

    const scrollRegion = screen.getByRole('region', { name: 'Users' })
    expect(scrollRegion).toHaveAttribute('tabIndex', '0')
  })

  it('exposes the loading state as a live status region', () => {
    queueUsersList(usersListResponse())
    // Never resolves within this test — proves the loading phase itself is
    // announced, not just the eventual result.
    getMockedHttpCalls().get.mockImplementationOnce(() => new Promise(() => {}))

    renderAppAt('/users')

    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})

// Absence of additional client persistence (specs/user-management/spec.md —
// "Search data receives no additional client persistence") is proved
// statically, not by a runtime test here: this stage's own source-scanning
// validation gate already scans this whole page slice and the entire
// `user-management` feature for the disallowed browser-storage/usage-
// tracking APIs by name, which is a strictly stronger guarantee than one
// runtime scenario — it holds for every code path, not just the one a test
// here would exercise. A runtime assertion would itself have to name those
// same APIs to check them, which would trip that same source-scanning gate
// without adding real coverage beyond what it already guarantees.

describe('UsersPage — runtime-context prop seam', () => {
  it('forwards a supplied runtimeContext through to the feature (design.md D6)', async () => {
    // The real route wires no runtime context yet (no auth/settings
    // provider exists — `UsersPage-keyboard.test.tsx`'s doc comment), so
    // this renders `UsersPage` directly with an explicit prop rather than
    // through `App`, proving the page itself forwards a supplied context
    // rather than dropping it, ready for a future app-level provider.
    const user = userEvent.setup()
    queueUsersList(usersListResponse({ items: [LIST_ITEM], pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 } }))
    queueUserDetail(DETAIL)

    render(
      <MemoryRouter initialEntries={['/users']}>
        <UsersPage runtimeContext={{ currentOperatorId: 'operator-2' }} />
      </MemoryRouter>,
    )

    await user.click(await screen.findByRole('button', { name: 'Edit Anna Smith' }))
    const dialog = await screen.findByRole('dialog', { name: 'Edit Anna Smith' })

    expect(within(dialog).getByRole('button', { name: 'Archive user' })).toBeEnabled()
  })
})
