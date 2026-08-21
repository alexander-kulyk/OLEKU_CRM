import type { FC } from 'react'
import { ChevronUpSVG } from '../../../../assets'
import { classNames } from '../../../shared/lib'
import type { UserListItemDto } from '../model/user-dto'
import type { UserSortDirection, UserSortField } from '../model/users-list-query'
import { USERS_TABLE_COLUMNS } from '../config/users-table-columns'
import type { UsersTableColumnConfig } from '../config/users-table-columns'
import { UsersTableRow } from './UsersTableRow'

export interface UsersTableProps {
  readonly items: readonly UserListItemDto[]
  readonly sortField: UserSortField
  readonly sortDirection: UserSortDirection
  readonly onSort: (field: UserSortField) => void
  /** Opens the detail-before-edit flow for a row (task 6.1). */
  readonly onEditUser: (userId: string) => void
}

const HEADER_CELL_CLASS_NAME =
  'whitespace-nowrap px-md py-md text-left text-eyebrow text-ink-secondary uppercase'
const SORT_BUTTON_CLASS_NAME =
  'inline-flex items-center gap-xs text-eyebrow text-ink-secondary uppercase hover:text-ink'

interface UsersTableHeaderCellProps {
  readonly column: UsersTableColumnConfig
  readonly sortField: UserSortField
  readonly sortDirection: UserSortDirection
  readonly onSort: (field: UserSortField) => void
}

/**
 * One `<th>`, rendered from {@link UsersTableColumnConfig} rather than eight
 * near-identical header blocks (data-driven-rendering skill). A sortable
 * column exposes its current direction to assistive technology through
 * `aria-sort` on the header cell itself, per the WAI-ARIA table pattern
 * (specs/user-management/spec.md — "Sortable table headers SHALL be
 * keyboard operable and expose their current direction to assistive
 * technology").
 */
const UsersTableHeaderCell: FC<UsersTableHeaderCellProps> = ({ column, sortField, sortDirection, onSort }) => {
  if (!column.sortField) {
    return (
      <th scope='col' className={HEADER_CELL_CLASS_NAME}>
        {column.header}
      </th>
    )
  }

  const isActive = column.sortField === sortField
  const ariaSort = isActive ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'

  const handleClick = (): void => {
    onSort(column.sortField as UserSortField)
  }

  return (
    <th scope='col' aria-sort={ariaSort} className={HEADER_CELL_CLASS_NAME}>
      <button type='button' onClick={handleClick} className={SORT_BUTTON_CLASS_NAME}>
        {column.header}
        {isActive && (
          <ChevronUpSVG className={classNames('size-3', sortDirection === 'desc' && 'rotate-180')} />
        )}
      </button>
    </th>
  )
}

/**
 * The loaded-result presentation (task 4.4): a native, semantic `<table>`
 * wrapped in a keyboard-focusable horizontally scrolling region so every
 * column and the Actions cell stay reachable at narrow widths without
 * overlap (specs/user-management/spec.md — "Users interactions and
 * feedback are accessible and responsive"). Cells never wrap or truncate —
 * `min-w` on the table forces horizontal scroll instead of clipping a long
 * value, so the complete value is always present, not hidden behind an
 * ellipsis.
 */
export const UsersTable: FC<UsersTableProps> = ({ items, sortField, sortDirection, onSort, onEditUser }) => (
  <div role='region' aria-label='Users' tabIndex={0} className='overflow-x-auto rounded-md border border-line'>
    <table className='w-full min-w-[960px] border-collapse'>
      <thead className='bg-surface-muted'>
        <tr>
          {USERS_TABLE_COLUMNS.map((column) => (
            <UsersTableHeaderCell
              key={column.key}
              column={column}
              sortField={sortField}
              sortDirection={sortDirection}
              onSort={onSort}
            />
          ))}
        </tr>
      </thead>
      <tbody>
        {items.map((user) => (
          <UsersTableRow key={user.id} user={user} onEdit={onEditUser} />
        ))}
      </tbody>
    </table>
  </div>
)
