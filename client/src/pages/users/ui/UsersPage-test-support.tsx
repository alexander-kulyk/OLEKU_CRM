import { render } from '@testing-library/react'
import { vi } from 'vitest'
// `App` — not `AppRouter` alone — so the real `ModalStackProvider` wiring
// (app/App.tsx) is present too: these are the only tests in the codebase
// that render the actual composed application (task 7.4's "route-level
// tests"), so a stacked archive confirmation over the Edit User dialog
// behaves exactly like production rather than a MemoryRouter stand-in
// around one page (compare `UsersList-test-support.tsx`'s
// `renderUsersList`, which intentionally renders only the feature). This
// is the one test-only exception to `pages -> features -> shared` import
// direction in this package: a route-level test's whole job is to prove
// the real composition, so it necessarily reaches into `app`. It is not
// part of the shipped import graph, and the FSD import-direction gate this
// stage runs only checks `features/user-management`, not this file.
import { App } from '../../../app'

/**
 * Route-level test harness (task 7.4). Every feature API function
 * ultimately calls through the one shared Axios instance
 * (`shared/api/http-client`), so mocking it here — rather than a
 * `features/user-management` internal API module — lets every OTHER
 * import in this file stay inside the public API every layer is already
 * allowed to depend on. The mocked functions themselves are created with
 * `vi.hoisted` (loosely typed, not `AxiosInstance`'s real overloaded
 * signature) so their `mockImplementation` callbacks can return plain
 * `{ data }` objects instead of a full `AxiosResponse`.
 *
 * Covers both `/events` (a constant empty collection — irrelevant to Users
 * assertions, just enough to let `EventsPage`/`EventCalendar` mount without
 * a real request while `UsersPage-navigation.test.tsx` starts a test at
 * `/events`) and the four Users endpoints, whose individual responses each
 * test queues explicitly through the `queue*` helpers below.
 */

const { mockedGet, mockedPatch, mockedDelete } = vi.hoisted(() => ({
  mockedGet: vi.fn(),
  mockedPatch: vi.fn(),
  mockedDelete: vi.fn(),
}))

vi.mock('../../../shared/api/http-client', () => ({
  httpClient: { get: mockedGet, patch: mockedPatch, delete: mockedDelete },
}))

let usersListQueue: unknown[] = []
let userDetailQueue: unknown[] = []
let updateUserQueue: unknown[] = []
let archiveUserQueue: unknown[] = []

function dequeueOrThrow(queue: unknown[], label: string): unknown {
  if (queue.length === 0) {
    throw new Error(`UsersPage test support: no queued ${label} response — call the matching queue*() helper first.`)
  }

  return queue.shift()
}

/** Resets every queue and mock call history — call once per test's `beforeEach`. */
export function resetUsersPageHttpMocks(): void {
  usersListQueue = []
  userDetailQueue = []
  updateUserQueue = []
  archiveUserQueue = []
  mockedGet.mockReset()
  mockedPatch.mockReset()
  mockedDelete.mockReset()

  mockedGet.mockImplementation(async (url: string) => {
    if (url === '/events') {
      return { data: { events: [] } }
    }

    if (url === '/users') {
      return { data: dequeueOrThrow(usersListQueue, 'Users list') }
    }

    if (url.startsWith('/users/')) {
      return { data: dequeueOrThrow(userDetailQueue, 'user detail') }
    }

    throw new Error(`UsersPage test support: unhandled GET ${url}`)
  })

  mockedPatch.mockImplementation(async (url: string) => {
    if (url.startsWith('/users/')) {
      return { data: dequeueOrThrow(updateUserQueue, 'update user') }
    }

    throw new Error(`UsersPage test support: unhandled PATCH ${url}`)
  })

  mockedDelete.mockImplementation(async (url: string) => {
    if (url.startsWith('/users/')) {
      dequeueOrThrow(archiveUserQueue, 'archive user')
      return { data: undefined }
    }

    throw new Error(`UsersPage test support: unhandled DELETE ${url}`)
  })
}

export function queueUsersList(response: unknown): void {
  usersListQueue.push(response)
}

export function queueUserDetail(detail: unknown): void {
  userDetailQueue.push(detail)
}

export function queueUpdateUser(detail: unknown): void {
  updateUserQueue.push(detail)
}

export function queueArchiveUser(): void {
  archiveUserQueue.push(undefined)
}

export function getMockedHttpCalls() {
  return { get: mockedGet, patch: mockedPatch, delete: mockedDelete }
}

/** Sets the starting URL, then renders the real composed application. */
export function renderAppAt(path: string): ReturnType<typeof render> {
  window.history.pushState({}, '', path)
  return render(<App />)
}

/** A minimal, wire-shaped `GET /api/users` response — same shape as the real payload. */
export function usersListResponse(overrides?: Record<string, unknown>) {
  return {
    items: [],
    pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
    ...overrides,
  }
}

export const LIST_ITEM = {
  id: 'user-1',
  firstName: 'Anna',
  lastName: 'Smith',
  email: 'anna@example.com',
  phone: null,
  address: null,
  status: 'active',
  lastLoginAt: null,
}

export const DETAIL = {
  ...LIST_ITEM,
  phoneExtension: null,
  archivedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-05T00:00:00.000Z',
  version: 7,
}
