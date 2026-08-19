import type { FC } from 'react'
import { SpinnerSVG } from '../../../../assets'
import { USERS_LIST_COPY } from '../config/users-list-copy'

/**
 * The initial/loading collection state (specs/user-management/spec.md —
 * "Collection states are distinct and recoverable"). `role='status'` +
 * `aria-live='polite'` exposes it as a live region rather than relying on
 * visible motion alone.
 */
export const UsersListLoading: FC = () => (
  <p role='status' aria-live='polite' className='flex items-center gap-sm py-xl text-label font-normal text-ink-muted'>
    <SpinnerSVG className='size-4 animate-spin' />
    {USERS_LIST_COPY.loading}
  </p>
)
