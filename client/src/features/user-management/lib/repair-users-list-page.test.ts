import { describe, expect, it } from 'vitest'
import { repairUsersListPageForTotalPages } from './repair-users-list-page'
import { DEFAULT_USERS_LIST_QUERY } from '../config/users-list-query-defaults'
import type { IUsersListQuery } from '../model/users-list-query'

describe('repairUsersListPageForTotalPages', () => {
  it('repairs page to totalPages when the requested page exceeds the result range', () => {
    const query: IUsersListQuery = { ...DEFAULT_USERS_LIST_QUERY, page: 99 }

    expect(repairUsersListPageForTotalPages(query, 8).page).toBe(8)
  })

  it('repairs to page 1 when totalPages is zero', () => {
    const query: IUsersListQuery = { ...DEFAULT_USERS_LIST_QUERY, page: 3 }

    expect(repairUsersListPageForTotalPages(query, 0).page).toBe(1)
  })

  it('leaves an in-range page untouched and returns the same reference', () => {
    const query: IUsersListQuery = { ...DEFAULT_USERS_LIST_QUERY, page: 5 }

    expect(repairUsersListPageForTotalPages(query, 8)).toBe(query)
  })

  it('leaves page 1 untouched when totalPages is already 1', () => {
    const query: IUsersListQuery = { ...DEFAULT_USERS_LIST_QUERY, page: 1 }

    expect(repairUsersListPageForTotalPages(query, 1)).toBe(query)
  })

  it('preserves every other field while repairing only page', () => {
    const query: IUsersListQuery = {
      page: 99,
      pageSize: 50,
      search: 'anna',
      statuses: ['active'],
      sortField: 'firstName',
      sortDirection: 'desc',
    }

    expect(repairUsersListPageForTotalPages(query, 8)).toEqual({ ...query, page: 8 })
  })

  it('is idempotent — repairing an already-repaired query with the same totalPages is a no-op', () => {
    const query: IUsersListQuery = { ...DEFAULT_USERS_LIST_QUERY, page: 99 }

    const repairedOnce = repairUsersListPageForTotalPages(query, 8)
    const repairedTwice = repairUsersListPageForTotalPages(repairedOnce, 8)

    expect(repairedTwice).toBe(repairedOnce)
  })

  it('re-repairs deterministically when totalPages itself shrinks further (mutation refetch)', () => {
    const query: IUsersListQuery = { ...DEFAULT_USERS_LIST_QUERY, page: 8 }

    const afterFirstRefetch = repairUsersListPageForTotalPages(query, 8)
    const afterMutationRefetch = repairUsersListPageForTotalPages(afterFirstRefetch, 5)

    expect(afterMutationRefetch.page).toBe(5)
  })
})
