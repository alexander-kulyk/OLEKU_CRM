import type { FC } from 'react'
import { useUsersList } from '../model/use-users-list'
import { UsersFiltersBar } from './UsersFiltersBar'
import { UsersTable } from './UsersTable'
import { UsersPagination } from './UsersPagination'
import { UsersListLoading } from './UsersListLoading'
import { UsersListError } from './UsersListError'
import { UsersListEmptyState } from './UsersListEmptyState'
import { UsersListNoResults } from './UsersListNoResults'

/**
 * The server-driven Users list (openspec/changes/add-users-client-ui/
 * tasks.md Stage 4). Composes the URL-owning/request hook with the
 * filters bar, the one distinct collection-state view the current request
 * resolves to, and pagination. Not yet wired into `/users` — that
 * composition is Stage 7's `pages/users` boundary.
 *
 * The Edit action rendered by `UsersTable`/`UsersTableRow` is a labelled
 * stub: detail-before-edit dialog wiring is Stage 5.
 */
export const UsersList: FC = () => {
  const { query, controls, collection, isSearchTooShort, retry } = useUsersList()

  return (
    <div className='flex flex-col gap-lg'>
      <UsersFiltersBar query={query} controls={controls} isSearchTooShort={isSearchTooShort} />

      {collection.kind === 'loading' && <UsersListLoading />}
      {collection.kind === 'error' && <UsersListError error={collection.error} onRetry={retry} />}
      {collection.kind === 'true-empty' && <UsersListEmptyState />}
      {collection.kind === 'no-results' && <UsersListNoResults onClearFilters={controls.clearFilters} />}

      {collection.kind === 'loaded' && (
        <>
          <UsersTable
            items={collection.response.items}
            sortField={query.sortField}
            sortDirection={query.sortDirection}
            onSort={controls.setSort}
          />
          <UsersPagination
            pagination={collection.response.pagination}
            onPageChange={controls.setPage}
            onPageSizeChange={controls.setPageSize}
          />
        </>
      )}
    </div>
  )
}
