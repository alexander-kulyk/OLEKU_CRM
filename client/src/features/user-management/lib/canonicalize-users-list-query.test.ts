import { describe, expect, it } from 'vitest'
import { canonicalizeUsersListQuery } from './canonicalize-users-list-query'
import { DEFAULT_USERS_LIST_QUERY } from '../config/users-list-query-defaults'
import type { IUsersListQuery } from '../model/users-list-query'

describe('canonicalizeUsersListQuery', () => {
  it('reorders a status selection into canonical status-ascending order', () => {
    const query: IUsersListQuery = {
      ...DEFAULT_USERS_LIST_QUERY,
      statuses: ['blocked', 'active'],
    }

    expect(canonicalizeUsersListQuery(query).statuses).toEqual(['active', 'blocked'])
  })

  it('deduplicates repeated statuses', () => {
    const query: IUsersListQuery = {
      ...DEFAULT_USERS_LIST_QUERY,
      statuses: ['active', 'active', 'blocked', 'blocked'],
    }

    expect(canonicalizeUsersListQuery(query).statuses).toEqual(['active', 'blocked'])
  })

  it('is order-independent — any input order of the same set canonicalizes identically', () => {
    const first = canonicalizeUsersListQuery({
      ...DEFAULT_USERS_LIST_QUERY,
      statuses: ['blocked', 'inactive', 'active'],
    })
    const second = canonicalizeUsersListQuery({
      ...DEFAULT_USERS_LIST_QUERY,
      statuses: ['active', 'blocked', 'inactive'],
    })

    expect(first.statuses).toEqual(second.statuses)
  })

  it('replaces a non-integer or below-1 page with the default page', () => {
    expect(canonicalizeUsersListQuery({ ...DEFAULT_USERS_LIST_QUERY, page: 0 }).page).toBe(1)
    expect(canonicalizeUsersListQuery({ ...DEFAULT_USERS_LIST_QUERY, page: -1 }).page).toBe(1)
    expect(canonicalizeUsersListQuery({ ...DEFAULT_USERS_LIST_QUERY, page: 1.5 }).page).toBe(1)
  })

  it('leaves an already-valid page untouched', () => {
    expect(canonicalizeUsersListQuery({ ...DEFAULT_USERS_LIST_QUERY, page: 7 }).page).toBe(7)
  })

  it('is idempotent — canonicalizing an already-canonical query returns an equal query', () => {
    const query: IUsersListQuery = {
      page: 3,
      pageSize: 50,
      search: 'anna',
      statuses: ['active', 'blocked'],
      sortField: 'firstName',
      sortDirection: 'desc',
    }

    const once = canonicalizeUsersListQuery(query)
    const twice = canonicalizeUsersListQuery(once)

    expect(twice).toEqual(once)
  })

  it('never trims or otherwise mutates search — only statuses/page are canonicalized', () => {
    const query: IUsersListQuery = { ...DEFAULT_USERS_LIST_QUERY, search: '  ab  ' }

    expect(canonicalizeUsersListQuery(query).search).toBe('  ab  ')
  })
})
