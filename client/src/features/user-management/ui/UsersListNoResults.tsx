import type { FC } from 'react'
import { AlertCircleSVG } from '../../../../assets'
import { Button } from '../../../shared/ui'
import { USERS_LIST_COPY } from '../config/users-list-copy'

export interface UsersListNoResultsProps {
  readonly onClearFilters: () => void
}

/**
 * The no-results collection state: an active search or status filter that
 * matched nothing (specs/user-management/spec.md — "Query has no matches"
 * scenario). Clear filters removes search and statuses, resets page 1, and
 * preserves page size/sort.
 */
export const UsersListNoResults: FC<UsersListNoResultsProps> = ({ onClearFilters }) => (
  <div role='status' aria-live='polite' className='flex flex-col items-center gap-sm py-2xl text-center'>
    <AlertCircleSVG className='size-8 text-ink-muted' />
    <p className='text-label text-ink'>{USERS_LIST_COPY.noResultsTitle}</p>
    <p className='text-label font-normal text-ink-muted'>{USERS_LIST_COPY.noResultsBody}</p>
    <Button size='sm' onClick={onClearFilters}>
      {USERS_LIST_COPY.clearFilters}
    </Button>
  </div>
)
