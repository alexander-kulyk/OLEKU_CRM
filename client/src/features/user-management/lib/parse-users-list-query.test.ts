import { describe, expect, it } from 'vitest'
import { parseUsersListQuery } from './parse-users-list-query'
import { serializeUsersListQueryToString } from './serialize-users-list-query'
import { DEFAULT_USERS_LIST_QUERY } from '../config/users-list-query-defaults'
import { USER_PAGE_SIZES, USER_SORT_DIRECTIONS, USER_SORT_FIELDS } from '../model/users-list-query'
import { USER_STATUSES } from '../model/user-status'
import type { IUsersListQuery } from '../model/users-list-query'

function paramsFrom(query: string): URLSearchParams {
  return new URLSearchParams(query)
}

describe('parseUsersListQuery', () => {
  it('returns the default query for an empty URL (initial collection request)', () => {
    expect(parseUsersListQuery(paramsFrom(''))).toEqual<IUsersListQuery>(DEFAULT_USERS_LIST_QUERY)
  })

  describe('invalid URL is repaired', () => {
    it('replaces a negative or zero page with the default page', () => {
      expect(parseUsersListQuery(paramsFrom('page=0')).page).toBe(1)
      expect(parseUsersListQuery(paramsFrom('page=-1')).page).toBe(1)
    })

    it('replaces a non-numeric page with the default page', () => {
      expect(parseUsersListQuery(paramsFrom('page=abc')).page).toBe(1)
    })

    it('replaces an unsupported page size with the default page size', () => {
      expect(parseUsersListQuery(paramsFrom('pageSize=37')).pageSize).toBe(20)
      expect(parseUsersListQuery(paramsFrom('pageSize=5000')).pageSize).toBe(20)
    })

    it('replaces an unknown status with no status filter', () => {
      expect(parseUsersListQuery(paramsFrom('status=archived')).statuses).toEqual([])
      expect(parseUsersListQuery(paramsFrom('status=active,deleted')).statuses).toEqual([])
    })

    it('replaces an unknown sort field with the default sort field', () => {
      expect(parseUsersListQuery(paramsFrom('sort=nickname')).sortField).toBe('lastName')
    })

    it('replaces an unknown sort direction with the default sort direction', () => {
      expect(parseUsersListQuery(paramsFrom('direction=sideways')).sortDirection).toBe('asc')
    })

    it('repairs several invalid values in one pass without throwing', () => {
      const result = parseUsersListQuery(
        paramsFrom('page=-5&pageSize=999&status=deleted&sort=nope&direction=nope'),
      )

      expect(result).toEqual<IUsersListQuery>(DEFAULT_USERS_LIST_QUERY)
    })

    it('is idempotent — reparsing the repaired canonical URL produces the same query and URL', () => {
      const repaired = parseUsersListQuery(paramsFrom('page=-5&pageSize=999'))
      const canonicalUrl = serializeUsersListQueryToString(repaired)
      const reparsed = parseUsersListQuery(paramsFrom(canonicalUrl))

      expect(reparsed).toEqual(repaired)
      expect(serializeUsersListQueryToString(reparsed)).toBe(canonicalUrl)
    })
  })

  describe('shared URL restores a query', () => {
    it('restores page, page size, search, multiple statuses, and sort from a valid URL', () => {
      const result = parseUsersListQuery(
        paramsFrom('page=3&pageSize=50&search=anna&status=blocked,active&sort=firstName&direction=desc'),
      )

      expect(result).toEqual<IUsersListQuery>({
        page: 3,
        pageSize: 50,
        search: 'anna',
        statuses: ['active', 'blocked'],
        sortField: 'firstName',
        sortDirection: 'desc',
      })
    })

    it('keeps a one-character search visible in the parsed query', () => {
      expect(parseUsersListQuery(paramsFrom('search=a')).search).toBe('a')
    })
  })

  describe('supported query combinations', () => {
    it.each(USER_PAGE_SIZES)('accepts supported page size %s', (pageSize) => {
      expect(parseUsersListQuery(paramsFrom(`pageSize=${pageSize}`)).pageSize).toBe(pageSize)
    })

    it.each(USER_STATUSES)('accepts single supported status %s', (status) => {
      expect(parseUsersListQuery(paramsFrom(`status=${status}`)).statuses).toEqual([status])
    })

    it.each(USER_SORT_FIELDS)('accepts supported sort field %s', (field) => {
      expect(parseUsersListQuery(paramsFrom(`sort=${field}`)).sortField).toBe(field)
    })

    it.each(USER_SORT_DIRECTIONS)('accepts supported sort direction %s', (direction) => {
      expect(parseUsersListQuery(paramsFrom(`direction=${direction}`)).sortDirection).toBe(direction)
    })
  })
})
