import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readUsersList } from '../api/users-api'
import { USERS_LIST_COPY } from '../config/users-list-copy'
import { absentContactUser, completeUser, makeResponse, partialUser, renderUsersList } from './UsersList-test-support'

/**
 * Routed, component-level coverage for the Users list (task 4.5): the
 * native table's eight columns, missing-value formatting, muted-row/status-
 * text presentation, record-specific Edit labels, semantic sorting state
 * (`aria-sort`, keyboard operability), and the status filter. Collection
 * states live in `UsersList.test.tsx` (same support module, split to keep
 * both files under the package's 250-line cap).
 */

vi.mock('../api/users-api', () => ({
  readUsersList: vi.fn(),
}))

const mockedReadUsersList = vi.mocked(readUsersList)

// See `use-users-list.test.tsx` for why this explicit clear is required —
// `restoreMocks: true` does not cover a bare `vi.fn()` from a `vi.mock`
// factory.
beforeEach(() => {
  mockedReadUsersList.mockClear()
})

async function renderLoadedTable(): Promise<void> {
  mockedReadUsersList.mockResolvedValueOnce(
    makeResponse({
      items: [completeUser, partialUser, absentContactUser],
      pagination: { page: 1, pageSize: 20, total: 3, totalPages: 1 },
    }),
  )
  renderUsersList()
  await screen.findByRole('columnheader', { name: /First Name/i })
}

describe('UsersList — table presentation', () => {
  it('renders the eight required columns', async () => {
    await renderLoadedTable()

    for (const name of ['First Name', 'Last Name', 'Email', 'Phone', 'Address', 'Status', 'Last Login', 'Actions']) {
      expect(screen.getByRole('columnheader', { name: new RegExp(name, 'i') })).toBeInTheDocument()
    }
  })

  it('formats a complete record, including address order and UTC Last Login', async () => {
    await renderLoadedTable()

    const row = screen.getByRole('row', { name: /Anna/ })
    const cells = within(row).getAllByRole('cell')

    expect(cells[0]).toHaveTextContent('Anna')
    expect(cells[1]).toHaveTextContent('Smith')
    expect(cells[2]).toHaveTextContent('anna.smith@example.com')
    expect(cells[3]).toHaveTextContent('+380501234567')
    expect(cells[4]).toHaveTextContent('12 Main St, Kyiv, 01001, Ukraine')
    expect(cells[5]).toHaveTextContent('Active')
    expect(cells[6]).toHaveTextContent('UTC')
  })

  it('formats missing phone/address as — and a missing Last Login as Never, without empty separators', async () => {
    await renderLoadedTable()

    const row = screen.getByRole('row', { name: /Bohdan/ })
    const cells = within(row).getAllByRole('cell')

    expect(cells[3]).toHaveTextContent('—')
    // Only the present address components (city) render — no leading or
    // doubled separators from the omitted street/postal code/country.
    expect(cells[4]).toHaveTextContent('Lviv')
    expect(cells[4].textContent).not.toMatch(/,\s*,/)
    expect(cells[6]).toHaveTextContent('Never')
  })

  it('formats a wholly absent address the same way as a missing phone', async () => {
    await renderLoadedTable()

    const row = screen.getByRole('row', { name: /Carla/ })
    const cells = within(row).getAllByRole('cell')

    expect(cells[3]).toHaveTextContent('—')
    expect(cells[4]).toHaveTextContent('—')
  })

  it('gives inactive and blocked rows a muted row treatment while keeping active rows standard', async () => {
    await renderLoadedTable()

    const activeRow = screen.getByRole('row', { name: /Anna/ })
    const inactiveRow = screen.getByRole('row', { name: /Bohdan/ })
    const blockedRow = screen.getByRole('row', { name: /Carla/ })

    expect(activeRow).not.toHaveClass('text-ink-secondary')
    expect(inactiveRow).toHaveClass('text-ink-secondary')
    expect(blockedRow).toHaveClass('text-ink-secondary')
  })

  it('communicates every status in explicit text, distinguishing blocked from inactive', async () => {
    await renderLoadedTable()

    expect(within(screen.getByRole('row', { name: /Anna/ })).getByText('Active')).toBeInTheDocument()
    expect(within(screen.getByRole('row', { name: /Bohdan/ })).getByText('Inactive')).toBeInTheDocument()
    expect(within(screen.getByRole('row', { name: /Carla/ })).getByText('Blocked')).toBeInTheDocument()
  })

  it('gives the Edit action a record-specific accessible label', async () => {
    await renderLoadedTable()

    expect(screen.getByRole('button', { name: 'Edit Anna Smith' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit Bohdan Ivanenko' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit Carla Nolan' })).toBeInTheDocument()
  })

  it('wraps the table in a keyboard-focusable horizontally scrollable region', async () => {
    await renderLoadedTable()

    const region = screen.getByRole('region', { name: 'Users' })
    expect(region).toHaveAttribute('tabIndex', '0')
  })
})

describe('UsersList — semantic sorting state', () => {
  it('marks the default sort column ascending and other sortable columns none', async () => {
    mockedReadUsersList.mockResolvedValueOnce(
      makeResponse({ items: [completeUser], pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 } }),
    )
    renderUsersList()
    await screen.findByRole('columnheader', { name: /First Name/i })

    expect(screen.getByRole('columnheader', { name: /Last Name/i })).toHaveAttribute('aria-sort', 'ascending')
    expect(screen.getByRole('columnheader', { name: /First Name/i })).toHaveAttribute('aria-sort', 'none')
    // Non-sortable columns carry no aria-sort at all.
    expect(screen.getByRole('columnheader', { name: /Email/i })).not.toHaveAttribute('aria-sort')
  })

  it('is keyboard-operable and updates aria-sort once the resulting request resolves', async () => {
    const user = userEvent.setup()
    mockedReadUsersList.mockResolvedValueOnce(
      makeResponse({ items: [completeUser], pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 } }),
    )
    mockedReadUsersList.mockResolvedValueOnce(
      makeResponse({ items: [completeUser], pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 } }),
    )

    renderUsersList()
    await screen.findByRole('columnheader', { name: /First Name/i })

    const firstNameHeaderButton = screen.getByRole('button', { name: 'First Name' })
    // Keyboard-only activation, not a mouse click.
    firstNameHeaderButton.focus()
    await user.keyboard('{Enter}')

    await waitFor(() =>
      expect(screen.getByRole('columnheader', { name: /First Name/i })).toHaveAttribute(
        'aria-sort',
        'ascending',
      ),
    )
    expect(mockedReadUsersList).toHaveBeenLastCalledWith(
      expect.objectContaining({ sortField: 'firstName', sortDirection: 'asc' }),
      expect.anything(),
    )
  })
})

describe('UsersList — status filter', () => {
  it('toggling a status checkbox requests only that status', async () => {
    const user = userEvent.setup()
    mockedReadUsersList.mockResolvedValueOnce(makeResponse())
    mockedReadUsersList.mockResolvedValueOnce(makeResponse())

    renderUsersList()
    await screen.findByText(USERS_LIST_COPY.trueEmptyTitle)

    await user.click(screen.getByRole('checkbox', { name: 'Blocked' }))

    await waitFor(() =>
      expect(mockedReadUsersList).toHaveBeenLastCalledWith(
        expect.objectContaining({ statuses: ['blocked'] }),
        expect.anything(),
      ),
    )
  })
})
