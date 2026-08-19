import type { FC } from 'react'
import { AlertCircleSVG } from '../../../../assets'
import { Button } from '../../../shared/ui'
import { getApiErrorCode } from '../../../shared/api'
import type { ApiError } from '../../../shared/api'
import { getUsersErrorMessage } from '../config/users-error-messages'
import { USERS_LIST_COPY } from '../config/users-list-copy'

export interface UsersListErrorProps {
  readonly error: ApiError
  readonly onRetry: () => void
}

/**
 * The load-failure collection state. Retry repeats the current canonical
 * query without changing the URL or controls
 * (specs/user-management/spec.md — "A failed request SHALL offer Retry
 * without changing the canonical URL or controls"). `role='alert'` makes
 * the failure assertively announced, unlike the polite loading/empty
 * states.
 */
export const UsersListError: FC<UsersListErrorProps> = ({ error, onRetry }) => (
  <div className='flex flex-col items-start gap-sm py-xl'>
    <p role='alert' className='flex items-center gap-xs text-label font-normal text-danger'>
      <AlertCircleSVG className='size-4 shrink-0' />
      {getUsersErrorMessage('list-users', getApiErrorCode(error))}
    </p>
    <Button size='sm' onClick={onRetry}>
      {USERS_LIST_COPY.retry}
    </Button>
  </div>
)
