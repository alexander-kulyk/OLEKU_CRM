import type { FC } from 'react'
import { PencilSVG } from '../../../../assets'
import { IconButton } from '../../../shared/ui'
import { classNames } from '../../../shared/lib'
import type { UserListItemDto } from '../model/user-dto'
import { USER_STATUS_PRESENTATION } from '../config/users-status-config'
import { formatUserAddress } from '../lib/format-user-address'
import { formatUserPhone } from '../lib/format-user-phone'
import { formatLastLogin } from '../lib/format-last-login'

export interface UsersTableRowProps {
  readonly user: UserListItemDto
}

const STATUS_BADGE_CLASS_NAME = 'inline-flex items-center rounded-full px-sm py-xs text-label'
const MUTED_ROW_CLASS_NAME = 'text-ink-secondary'
const CELL_CLASS_NAME = 'whitespace-nowrap px-md py-sm text-body'

/**
 * One Users table row (task 4.4). Inactive/blocked rows use a muted row
 * treatment while the Status cell still carries the explicit status text
 * (specs/user-management/spec.md — "Users table presents operational
 * records": "blocked SHALL remain distinguishable from inactive without
 * relying on color alone"). Edit is a real, record-specific-labelled
 * action, but intentionally does nothing yet — detail-before-edit dialog
 * wiring is Stage 5 (openspec/changes/add-users-client-ui/tasks.md Stage 5).
 */
export const UsersTableRow: FC<UsersTableRowProps> = ({ user }) => {
  const presentation = USER_STATUS_PRESENTATION[user.status]
  const editLabel = `Edit ${user.firstName} ${user.lastName}`

  const handleEditClick = (): void => {
    // Intentionally a no-op in Stage 4 — see the doc comment above.
  }

  return (
    <tr className={classNames('border-b border-line last:border-b-0', presentation.isRowMuted && MUTED_ROW_CLASS_NAME)}>
      <td className={CELL_CLASS_NAME}>{user.firstName}</td>
      <td className={CELL_CLASS_NAME}>{user.lastName}</td>
      <td className={CELL_CLASS_NAME}>{user.email}</td>
      <td className={CELL_CLASS_NAME}>{formatUserPhone(user.phone)}</td>
      <td className={CELL_CLASS_NAME}>{formatUserAddress(user.address)}</td>
      <td className={CELL_CLASS_NAME}>
        <span className={classNames(STATUS_BADGE_CLASS_NAME, presentation.badgeClassName)}>
          {presentation.label}
        </span>
      </td>
      <td className={CELL_CLASS_NAME}>{formatLastLogin(user.lastLoginAt)}</td>
      <td className={CELL_CLASS_NAME}>
        <IconButton
          label={editLabel}
          icon={<PencilSVG className='size-4' />}
          variant='ghost'
          size='sm'
          onClick={handleEditClick}
        />
      </td>
    </tr>
  )
}
