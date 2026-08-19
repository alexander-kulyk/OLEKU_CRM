import type { FC } from 'react'
import { UsersSVG } from '../../../../assets'
import { USERS_LIST_COPY } from '../config/users-list-copy'

/**
 * The true-empty collection state: an unsearched, unfiltered page 1 with
 * zero total records — never presented as a search/filter failure
 * (specs/user-management/spec.md — "User collection is empty" scenario).
 */
export const UsersListEmptyState: FC = () => (
  <div role='status' aria-live='polite' className='flex flex-col items-center gap-sm py-2xl text-center'>
    <UsersSVG className='size-8 text-ink-muted' />
    <p className='text-label text-ink'>{USERS_LIST_COPY.trueEmptyTitle}</p>
    <p className='text-label font-normal text-ink-muted'>{USERS_LIST_COPY.trueEmptyBody}</p>
  </div>
)
