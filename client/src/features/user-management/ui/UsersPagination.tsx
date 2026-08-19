import type { ChangeEvent, FC } from 'react'
import { ChevronLeftSVG, ChevronRightSVG } from '../../../../assets'
import { IconButton } from '../../../shared/ui'
import { USER_PAGE_SIZES } from '../model/users-list-query'
import type { UserPageSize } from '../model/users-list-query'
import type { UsersPagination as UsersPaginationData } from '../model/user-dto'
import { USERS_LIST_COPY } from '../config/users-list-copy'

export interface UsersPaginationProps {
  readonly pagination: UsersPaginationData
  readonly onPageChange: (page: number) => void
  readonly onPageSizeChange: (pageSize: UserPageSize) => void
}

const PAGE_SIZE_SELECT_CLASS_NAME =
  'h-control-sm rounded-md border border-line-strong bg-surface px-sm text-label text-ink shadow-rest'

/**
 * The page-size selector and Prev/Next controls (task 4.2). Both are
 * explicit operator actions and therefore push a new history entry through
 * `controls.setPage`/`setPageSize` (specs/user-management/spec.md — "List
 * query state is canonical in the URL": "Explicit page, page-size, ...
 * actions SHALL create normal history entries").
 */
export const UsersPagination: FC<UsersPaginationProps> = ({ pagination, onPageChange, onPageSizeChange }) => {
  const highestPage = Math.max(1, pagination.totalPages)

  const handlePageSizeChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    onPageSizeChange(Number(event.target.value) as UserPageSize)
  }

  const handlePreviousClick = (): void => {
    onPageChange(pagination.page - 1)
  }

  const handleNextClick = (): void => {
    onPageChange(pagination.page + 1)
  }

  return (
    <div className='flex flex-wrap items-center justify-between gap-lg py-md'>
      <label className='flex items-center gap-sm text-label text-ink-secondary'>
        {USERS_LIST_COPY.pageSizeLabel}
        <select
          value={pagination.pageSize}
          onChange={handlePageSizeChange}
          className={PAGE_SIZE_SELECT_CLASS_NAME}
        >
          {USER_PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </label>

      <div className='flex items-center gap-sm'>
        <IconButton
          label={USERS_LIST_COPY.previousPage}
          icon={<ChevronLeftSVG className='size-4' />}
          variant='ghost'
          size='sm'
          disabled={pagination.page <= 1}
          onClick={handlePreviousClick}
        />
        <span className='text-label text-ink-secondary'>
          Page {pagination.page} of {highestPage}
        </span>
        <IconButton
          label={USERS_LIST_COPY.nextPage}
          icon={<ChevronRightSVG className='size-4' />}
          variant='ghost'
          size='sm'
          disabled={pagination.page >= highestPage}
          onClick={handleNextClick}
        />
      </div>
    </div>
  )
}
