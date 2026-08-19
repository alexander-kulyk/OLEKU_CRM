import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readUsersList } from '../api/users-api'
import { USERS_LIST_COPY } from '../config/users-list-copy'
import { completeUser, makeResponse, renderUsersList } from './UsersList-test-support'

/**
 * Routed, component-level coverage for the Users list (task 4.5): all six
 * collection states (loading/error/true-empty/no-results/one-character-
 * guidance/loaded). Table presentation, semantic sorting, and the status
 * filter live in `UsersList-table.test.tsx` (same support module, split to
 * keep both files under the package's 250-line cap). Renders the real
 * component tree directly with a memory router, not the actual `/users`
 * route/page (design.md D8; Stage 4 run prompt).
 */

vi.mock('../api/users-api', () => ({
  readUsersList: vi.fn(),
}))

const mockedReadUsersList = vi.mocked(readUsersList)

// `vi.mock`-factory-created `vi.fn()`s are not covered by
// `vitest.config.ts`'s `restoreMocks: true` (see `use-users-list.test.tsx`
// for why) — cleared explicitly so every test starts from zero calls.
beforeEach(() => {
  mockedReadUsersList.mockClear()
})

describe('UsersList — collection states', () => {
  it('shows a loading state before the first response settles', () => {
    mockedReadUsersList.mockReturnValue(new Promise(() => {}))

    renderUsersList()

    expect(screen.getByText(USERS_LIST_COPY.loading)).toBeInTheDocument()
  })

  it('shows an error state with Retry, and Retry repeats the request', async () => {
    const user = userEvent.setup()
    mockedReadUsersList.mockRejectedValueOnce({ code: 'INTERNAL_ERROR', status: 500 })
    mockedReadUsersList.mockResolvedValueOnce(
      makeResponse({ items: [completeUser], pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 } }),
    )

    renderUsersList()

    expect(await screen.findByRole('alert')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: USERS_LIST_COPY.retry }))

    expect(await screen.findByRole('columnheader', { name: /First Name/i })).toBeInTheDocument()
    expect(mockedReadUsersList).toHaveBeenCalledTimes(2)
  })

  it('shows the true-empty state for an unfiltered, unsearched empty collection', async () => {
    mockedReadUsersList.mockResolvedValueOnce(makeResponse())

    renderUsersList()

    expect(await screen.findByText(USERS_LIST_COPY.trueEmptyTitle)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: USERS_LIST_COPY.clearFilters })).not.toBeInTheDocument()
  })

  it('shows the no-results state with Clear filters when a status filter matches nothing, and Clear filters refetches unfiltered', async () => {
    const user = userEvent.setup()
    mockedReadUsersList.mockResolvedValueOnce(makeResponse())
    mockedReadUsersList.mockResolvedValueOnce(
      makeResponse({ items: [completeUser], pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 } }),
    )

    renderUsersList(['/users?status=active'])

    expect(await screen.findByText(USERS_LIST_COPY.noResultsTitle)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: USERS_LIST_COPY.clearFilters }))

    expect(await screen.findByRole('columnheader', { name: /First Name/i })).toBeInTheDocument()
    expect(mockedReadUsersList).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: '', statuses: [], page: 1 }),
      expect.anything(),
    )
  })

  it('shows the one-character search guidance without hiding the active collection', async () => {
    const user = userEvent.setup()
    mockedReadUsersList.mockResolvedValue(
      makeResponse({ items: [completeUser], pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 } }),
    )

    renderUsersList()
    await screen.findByRole('columnheader', { name: /First Name/i })

    await user.type(screen.getByLabelText(USERS_LIST_COPY.searchLabel), 'a')

    expect(await screen.findByText(USERS_LIST_COPY.searchMinLengthGuidance)).toBeInTheDocument()
    // The previously loaded row remains visible alongside the guidance.
    expect(screen.getByText('Anna')).toBeInTheDocument()
  })
})
