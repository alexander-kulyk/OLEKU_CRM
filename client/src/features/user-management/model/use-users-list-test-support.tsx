import type { ReactNode } from 'react'
import { renderHook } from '@testing-library/react'
import { MemoryRouter, useLocation, useNavigationType } from 'react-router'
import type { UserListItemDto, UsersListResponse } from './user-dto'
import { useUsersList } from './use-users-list'

/**
 * Shared fixtures/harness for `useUsersList`'s hook-level test files (task
 * 4.1/4.5), split across `use-users-list.test.tsx` (initial request,
 * debounce, filter/search distinctions) and `use-users-list-recovery.test.tsx`
 * (request races, Retry, URL repair, pagination repair, server-only dataset
 * handling) to keep each file under the package's 250-line cap.
 */

export function makeResponse(overrides?: Partial<UsersListResponse>): UsersListResponse {
  return {
    items: [],
    pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
    ...overrides,
  }
}

export const sampleItem: UserListItemDto = {
  id: '507f1f77bcf86cd799439011',
  firstName: 'Anna',
  lastName: 'Smith',
  email: 'anna.smith@example.com',
  phone: null,
  address: null,
  status: 'active',
  lastLoginAt: null,
}

export interface Deferred<T> {
  readonly promise: Promise<T>
  readonly resolve: (value: T) => void
  readonly reject: (reason: unknown) => void
}

export function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/** Exposes `location`/`navigationType` alongside the hook so tests can assert push-vs-replace history semantics. */
function useTestHarness() {
  const usersList = useUsersList()
  const location = useLocation()
  const navigationType = useNavigationType()

  return { ...usersList, location, navigationType }
}

export function renderUsersList(initialEntries: readonly string[] = ['/users']) {
  function wrapper({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={[...initialEntries]}>{children}</MemoryRouter>
  }

  return renderHook(() => useTestHarness(), { wrapper })
}
