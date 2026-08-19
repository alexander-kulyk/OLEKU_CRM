import type { ChangeEvent, FC } from 'react'
import { Input } from '../../../shared/ui'
import { classNames } from '../../../shared/lib'
import { USER_STATUSES } from '../model/user-status'
import type { UserStatus } from '../model/user-status'
import type { UsersListControls } from '../model/use-users-list-query'
import type { IUsersListQuery } from '../model/users-list-query'
import { USER_STATUS_PRESENTATION } from '../config/users-status-config'
import { USERS_LIST_COPY } from '../config/users-list-copy'

export interface UsersFiltersBarProps {
  readonly query: IUsersListQuery
  readonly controls: UsersListControls
  readonly isSearchTooShort: boolean
}

const STATUS_CHECKBOX_LABEL_CLASS_NAME = 'flex items-center gap-xs text-label text-ink'

interface UsersStatusCheckboxProps {
  readonly status: UserStatus
  readonly isChecked: boolean
  readonly onToggle: (status: UserStatus) => void
}

/** One status filter checkbox — owns the `status`-currying (SegmentedControl's pattern). */
const UsersStatusCheckbox: FC<UsersStatusCheckboxProps> = ({ status, isChecked, onToggle }) => {
  const handleChange = (): void => {
    onToggle(status)
  }

  return (
    <label className={STATUS_CHECKBOX_LABEL_CLASS_NAME}>
      <input
        type='checkbox'
        checked={isChecked}
        onChange={handleChange}
        className='size-4 shrink-0 accent-accent'
      />
      {USER_STATUS_PRESENTATION[status].label}
    </label>
  )
}

/**
 * The search field and status filters — the URL-driven controls that narrow
 * the collection (task 4.2). Every value comes straight from the canonical
 * `query`; there is no local mirror, so this component only ever reflects
 * the URL and reports intent up through `controls`
 * (specs/user-management/spec.md — "List query state is canonical in the
 * URL").
 */
export const UsersFiltersBar: FC<UsersFiltersBarProps> = ({ query, controls, isSearchTooShort }) => {
  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>): void => {
    controls.setSearch(event.target.value)
  }

  return (
    <div className={classNames('flex flex-wrap items-end gap-lg')}>
      <Input
        type='search'
        label={USERS_LIST_COPY.searchLabel}
        placeholder={USERS_LIST_COPY.searchPlaceholder}
        value={query.search}
        onChange={handleSearchChange}
        hint={isSearchTooShort ? USERS_LIST_COPY.searchMinLengthGuidance : undefined}
        className='min-w-64'
      />

      <fieldset className='flex flex-col gap-xs'>
        <legend className='text-label text-ink'>{USERS_LIST_COPY.statusFilterLabel}</legend>
        <div className='flex flex-wrap items-center gap-md'>
          {USER_STATUSES.map((status) => (
            <UsersStatusCheckbox
              key={status}
              status={status}
              isChecked={query.statuses.includes(status)}
              onToggle={controls.toggleStatus}
            />
          ))}
        </div>
      </fieldset>
    </div>
  )
}
