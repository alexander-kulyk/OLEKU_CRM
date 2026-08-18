import { describe, expect, it } from 'vitest'
import { serializeUsersListQuery, serializeUsersListQueryToString } from './serialize-users-list-query'
import { canonicalizeUsersListQuery } from './canonicalize-users-list-query'
import { parseUsersListQuery } from './parse-users-list-query'
import { DEFAULT_USERS_LIST_QUERY } from '../config/users-list-query-defaults'
import type { IUsersListQuery } from '../model/users-list-query'

describe('serializeUsersListQuery', () => {
  it('produces an empty canonical URL for the default query', () => {
    expect(serializeUsersListQueryToString(DEFAULT_USERS_LIST_QUERY)).toBe('')
  })

  it('omits every field that is at its default value', () => {
    const query: IUsersListQuery = { ...DEFAULT_USERS_LIST_QUERY, page: 1, pageSize: 20 }

    expect(serializeUsersListQuery(query).toString()).toBe('')
  })

  it('includes only the fields that differ from the default, in a stable key order', () => {
    // Statuses are already in canonical order here — serialize trusts an
    // already-canonical query (as parse/canonicalize always produce) and
    // does not re-sort; canonical ordering itself is covered separately
    // below.
    const query: IUsersListQuery = {
      page: 3,
      pageSize: 50,
      search: 'anna',
      statuses: ['active', 'blocked'],
      sortField: 'firstName',
      sortDirection: 'desc',
    }

    expect(serializeUsersListQueryToString(query)).toBe(
      'page=3&pageSize=50&search=anna&status=active%2Cblocked&sort=firstName&direction=desc',
    )
  })

  it('serializes identically regardless of the input status order (stable serialization)', () => {
    const a = canonicalizeUsersListQuery({
      ...DEFAULT_USERS_LIST_QUERY,
      statuses: ['blocked', 'active', 'inactive'],
    })
    const b = canonicalizeUsersListQuery({
      ...DEFAULT_USERS_LIST_QUERY,
      statuses: ['active', 'inactive', 'blocked'],
    })

    expect(serializeUsersListQueryToString(a)).toBe(serializeUsersListQueryToString(b))
  })

  it('writes only the non-default sort member when the other half is default', () => {
    const nonDefaultDirectionOnly: IUsersListQuery = {
      ...DEFAULT_USERS_LIST_QUERY,
      sortDirection: 'desc',
    }

    expect(serializeUsersListQueryToString(nonDefaultDirectionOnly)).toBe('direction=desc')
  })

  it('round-trips through parse for an arbitrary canonical query (Back/Forward-ready restoration)', () => {
    const original: IUsersListQuery = canonicalizeUsersListQuery({
      page: 4,
      pageSize: 100,
      search: 'smith',
      statuses: ['blocked', 'active'],
      sortField: 'lastLoginAt',
      sortDirection: 'desc',
    })

    const url = serializeUsersListQuery(original)
    const restored = parseUsersListQuery(url)

    expect(restored).toEqual(original)
    expect(serializeUsersListQueryToString(restored)).toBe(serializeUsersListQueryToString(original))
  })
})
