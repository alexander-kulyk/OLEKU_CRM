import type { FC } from 'react'
import { useUsersList } from '../model/use-users-list'
import { UsersFiltersBar } from './UsersFiltersBar'
import { UsersTable } from './UsersTable'
import { UsersPagination } from './UsersPagination'
import { UsersListLoading } from './UsersListLoading'
import { UsersListError } from './UsersListError'
import { UsersListEmptyState } from './UsersListEmptyState'
import { UsersListNoResults } from './UsersListNoResults'

export interface UsersListProps {
  /**
   * Opens the detail-before-edit flow for a row (task 6.1). Optional and
   * defaulting to a no-op so this component stays usable standalone
   * (Stage 4's own routed tests render `<UsersList />` with no props).
   */
  readonly onEditUser?: (userId: string) => void
  /**
   * Requests a fresh read of the current canonical query from outside this
   * component — bumped by `UserManagement`'s controller after a successful
   * update/archive (task 6.1/6.4; `useUsersList`'s own doc comment).
   */
  readonly refetchSignal?: number
}

const NOOP_EDIT_USER = (): void => {}

/**
 * The server-driven Users list (openspec/changes/add-users-client-ui/
 * tasks.md Stage 4). Composes the URL-owning/request hook with the
 * filters bar, the one distinct collection-state view the current request
 * resolves to, and pagination. Not yet wired into `/users` — that
 * composition is Stage 7's `pages/users` boundary.
 */
export const UsersList: FC<UsersListProps> = ({ onEditUser = NOOP_EDIT_USER, refetchSignal = 0 }) => {
  const { query, controls, collection, isSearchTooShort, retry } = useUsersList(refetchSignal)

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
            onEditUser={onEditUser}
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
