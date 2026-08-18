import { describe, expect, it } from 'vitest'
import { buildUsersListWireQuery } from './build-users-list-wire-query'
import { canonicalizeUsersListQuery } from './canonicalize-users-list-query'
import { DEFAULT_USERS_LIST_QUERY } from '../config/users-list-query-defaults'
import type { IUsersListQuery } from '../model/users-list-query'

describe('buildUsersListWireQuery', () => {
  it('requests page 1 at page size 20 with no search/status/sort for the default query', () => {
    expect(buildUsersListWireQuery(DEFAULT_USERS_LIST_QUERY)).toEqual({ page: 1, pageSize: 20 })
  })

  it('does not send a one-character search, per "One-character search is not requested"', () => {
    const query: IUsersListQuery = { ...DEFAULT_USERS_LIST_QUERY, search: 'a' }

    expect(buildUsersListWireQuery(query)).toEqual({ page: 1, pageSize: 20 })
  })

  it('sends a trimmed two-character-or-longer search', () => {
    const query: IUsersListQuery = { ...DEFAULT_USERS_LIST_QUERY, search: '  ab  ' }

    expect(buildUsersListWireQuery(query)).toEqual({ page: 1, pageSize: 20, search: 'ab' })
  })

  it('keeps status and sort applied even though a one-character search is excluded', () => {
    const query: IUsersListQuery = canonicalizeUsersListQuery({
      ...DEFAULT_USERS_LIST_QUERY,
      search: 'a',
      statuses: ['blocked', 'active'],
      sortField: 'firstName',
      sortDirection: 'desc',
    })

    expect(buildUsersListWireQuery(query)).toEqual({
      page: 1,
      pageSize: 20,
      status: 'active,blocked',
      sort: 'firstName:desc',
    })
  })

  it('joins multiple statuses as one comma-separated token', () => {
    const query: IUsersListQuery = canonicalizeUsersListQuery({
      ...DEFAULT_USERS_LIST_QUERY,
      statuses: ['blocked', 'inactive', 'active'],
    })

    expect(buildUsersListWireQuery(query).status).toBe('active,inactive,blocked')
  })

  it('omits sort when it equals the server default (lastName:asc)', () => {
    expect(buildUsersListWireQuery(DEFAULT_USERS_LIST_QUERY).sort).toBeUndefined()
  })

  it.each([
    ['firstName', 'asc'],
    ['firstName', 'desc'],
    ['lastName', 'desc'],
    ['status', 'asc'],
    ['status', 'desc'],
    ['lastLoginAt', 'asc'],
    ['lastLoginAt', 'desc'],
  ] as const)('sends non-default sort %s:%s as one field:direction token', (sortField, sortDirection) => {
    const query: IUsersListQuery = { ...DEFAULT_USERS_LIST_QUERY, sortField, sortDirection }

    expect(buildUsersListWireQuery(query).sort).toBe(`${sortField}:${sortDirection}`)
  })

  it('carries page and pageSize through unchanged', () => {
    const query: IUsersListQuery = { ...DEFAULT_USERS_LIST_QUERY, page: 4, pageSize: 100 }

    expect(buildUsersListWireQuery(query)).toMatchObject({ page: 4, pageSize: 100 })
  })
})
