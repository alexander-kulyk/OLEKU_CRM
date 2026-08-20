import type { FC } from 'react'
import { AlertCircleSVG, CloseSVG } from '../../../../assets'
import { IconButton } from '../../../shared/ui'
import { USER_MANAGEMENT_COPY } from '../config/user-management-copy'

export interface UserManagementNoticeProps {
  readonly message: string
  readonly onDismiss: () => void
}

/**
 * The transient banner for an outcome that closes/never-opens the Edit
 * User dialog and still needs to inform the operator — a detail read that
 * came back not-found or archived elsewhere
 * (specs/user-management/spec.md — "Editing starts from current detail
 * data": "the operator is notified"). Lives outside any dialog (rendered
 * above `UsersList` by `UserManagement`), so it stays visible after the
 * dialog it refers to has already closed. `role='status'`/`aria-live` —
 * not `role='alert'` — because this is an informational outcome the
 * operator already caused by activating Edit, not an unprompted failure.
 */
export const UserManagementNotice: FC<UserManagementNoticeProps> = ({ message, onDismiss }) => (
  <div
    role='status'
    aria-live='polite'
    className='flex items-center justify-between gap-md rounded-md border border-line bg-surface-muted p-md text-body text-ink'
  >
    <span className='flex items-center gap-sm'>
      <AlertCircleSVG className='size-4 shrink-0 text-ink-secondary' />
      {message}
    </span>
    <IconButton
      label={USER_MANAGEMENT_COPY.dismissNotice}
      icon={<CloseSVG className='size-4' />}
      variant='ghost'
      size='sm'
      onClick={onDismiss}
    />
  </div>
)
