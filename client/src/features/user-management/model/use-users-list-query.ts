import { useCallback, useEffect } from 'react'
import { useSearchParams } from 'react-router'
import type { UserStatus } from './user-status'
import type { IUsersListQuery, UserPageSize, UserSortField } from './users-list-query'
import { parseUsersListQuery } from '../lib/parse-users-list-query'
import { serializeUsersListQuery, serializeUsersListQueryToString } from '../lib/serialize-users-list-query'

export interface UsersListControls {
  readonly setSearch: (search: string) => void
  readonly toggleStatus: (status: UserStatus) => void
  readonly setSort: (sortField: UserSortField) => void
  readonly setPage: (page: number) => void
  readonly setPageSize: (pageSize: UserPageSize) => void
  /** Removes search and statuses, resets page to 1, keeps page size/sort. */
  readonly clearFilters: () => void
}

export interface UseUsersListQueryResult {
  /** The canonical query for this render — never mirrored into component state. */
  readonly query: IUsersListQuery
  readonly controls: UsersListControls
  /**
   * Applies a system-driven correction (URL repair, out-of-range page
   * repair) without adding a history entry — distinct from `controls`,
   * which are the operator's explicit actions.
   */
  readonly replaceQuery: (next: IUsersListQuery) => void
}

/**
 * Owns the `/users` URL as the single source of the list query (design.md
 * D2). Every field is read fresh from `useSearchParams` on every render —
 * there is no `useState` shadow of any query field
 * (specs/user-management/spec.md — "List query state is canonical in the
 * URL").
 *
 * Explicit operator actions (`toggleStatus`, `setSort`, `setPage`,
 * `setPageSize`, `clearFilters`) push a new history entry; typed search
 * (`setSearch`) and the invalid-URL repair effect below both replace the
 * current entry (specs/user-management/spec.md — "Explicit page, page-size,
 * status, and sort actions SHALL create normal history entries; typed
 * search updates SHALL replace the current entry").
 */
export function useUsersListQuery(): UseUsersListQueryResult {
  const [searchParams, setSearchParams] = useSearchParams()
  const query = parseUsersListQuery(searchParams)

  const replaceQuery = useCallback(
    (next: IUsersListQuery) => {
      setSearchParams(serializeUsersListQuery(next), { replace: true })
    },
    [setSearchParams],
  )

  const pushQuery = useCallback(
    (next: IUsersListQuery) => {
      setSearchParams(serializeUsersListQuery(next), { replace: false })
    },
    [setSearchParams],
  )

  // One idempotent URL correction (specs/user-management/spec.md — "Invalid
  // URL is repaired"): `query` is already canonical (parseUsersListQuery
  // canonicalizes internally), so this only fires when the raw URL itself
  // disagrees with that canonical form — e.g. a negative page, an unknown
  // status, or a non-canonical status order — and is a no-op afterward.
  useEffect(() => {
    const canonical = serializeUsersListQueryToString(query)

    if (searchParams.toString() !== canonical) {
      replaceQuery(query)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const setSearch = useCallback(
    (search: string) => {
      replaceQuery({ ...query, search })
    },
    [query, replaceQuery],
  )

  const toggleStatus = useCallback(
    (status: UserStatus) => {
      const nextStatuses = query.statuses.includes(status)
        ? query.statuses.filter((candidate) => candidate !== status)
        : [...query.statuses, status]

      pushQuery({ ...query, statuses: nextStatuses })
    },
    [query, pushQuery],
  )

  const setSort = useCallback(
    (sortField: UserSortField) => {
      const nextDirection =
        query.sortField === sortField && query.sortDirection === 'asc' ? 'desc' : 'asc'

      pushQuery({ ...query, sortField, sortDirection: nextDirection })
    },
    [query, pushQuery],
  )

  const setPage = useCallback(
    (page: number) => {
      pushQuery({ ...query, page })
    },
    [query, pushQuery],
  )

  const setPageSize = useCallback(
    (pageSize: UserPageSize) => {
      pushQuery({ ...query, pageSize })
    },
    [query, pushQuery],
  )

  const clearFilters = useCallback(() => {
    pushQuery({ ...query, search: '', statuses: [], page: 1 })
  }, [query, pushQuery])

  return {
    query,
    controls: { setSearch, toggleStatus, setSort, setPage, setPageSize, clearFilters },
    replaceQuery,
  }
}
