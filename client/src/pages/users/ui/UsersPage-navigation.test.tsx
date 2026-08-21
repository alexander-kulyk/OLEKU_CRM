import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { LIST_ITEM, queueUsersList, renderAppAt, resetUsersPageHttpMocks, usersListResponse } from './UsersPage-test-support'

/**
 * Route-level navigation coverage (task 7.4; specs/app-navigation/spec.md —
 * "Users is an operational destination"): activating the persistent nav's
 * Users entry from another route, inside the unchanged shell, without a
 * full page reload. Split from `UsersPage.test.tsx` (same support module)
 * to keep every file under the package's 250-line cap.
 */

beforeEach(() => {
  resetUsersPageHttpMocks()
})

describe('UsersPage — navigation activation', () => {
  it('opens the Users workspace inside the persistent shell from the nav, marks it active, and issues no full reload', async () => {
    const user = userEvent.setup()
    queueUsersList(
      usersListResponse({ items: [LIST_ITEM], pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 } }),
    )

    renderAppAt('/events')

    // The persistent shell (`app/layout/Layout`) renders once, before the
    // route changes — capturing this DOM node now and asserting its
    // identity is unchanged after navigating is what actually distinguishes
    // client-side routing from a full page reload in this test environment:
    // a real reload would tear down and recreate the whole document, not
    // just swap the routed `<Outlet/>` content.
    const navigationBeforeClick = document.querySelector('nav[aria-label="Primary"]')
    expect(navigationBeforeClick).not.toBeNull()

    await user.click(screen.getByRole('link', { name: 'Users' }))

    expect(await screen.findByRole('columnheader', { name: /First Name/i })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/users')
    expect(screen.getByRole('link', { name: 'Users' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Calendar' })).not.toHaveAttribute('aria-current')
    // Same shell DOM node, not a fresh one — proves no full reload occurred.
    expect(document.querySelector('nav[aria-label="Primary"]')).toBe(navigationBeforeClick)
  })

  it('preserves query parameters when Users is opened directly by URL, inside the same shell', async () => {
    queueUsersList(
      usersListResponse({ items: [LIST_ITEM], pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 } }),
    )

    renderAppAt('/users?status=active')

    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Active' })).toBeChecked())
    expect(screen.getByRole('link', { name: 'Users' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument()
  })
})
