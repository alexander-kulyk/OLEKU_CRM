import type { FC } from 'react'
import { USER_FORM_COPY } from '../config/user-form-copy'
import { formatCreatedAt } from '../lib/user-form/format-created-at'
import { formatLastLogin } from '../lib/format-last-login'
import type { UserDetailDto } from '../model/user-dto'

export interface UserReadOnlyFieldsProps {
  readonly detail: UserDetailDto
}

const ENTRY_CLASS_NAME = 'flex flex-col gap-xs'
const TERM_CLASS_NAME = 'text-label text-ink-muted'
const DESCRIPTION_CLASS_NAME = 'text-body text-ink'

/**
 * The read-only metadata the Edit User dialog exposes alongside the
 * editable fields (specs/user-management/spec.md — "Edit form exposes and
 * validates the supported fields": "read-only User ID, Last Login, and
 * Created At values"). A `<dl>` rather than disabled inputs — these values
 * are never part of the react-hook-form model or the merge patch at all,
 * so they can never be accidentally sent as edits. Last Login reuses the
 * list's own `formatLastLogin` (`lib/format-last-login.ts`) so the two
 * surfaces can never disagree about its UTC formatting or `Never` label.
 */
export const UserReadOnlyFields: FC<UserReadOnlyFieldsProps> = ({ detail }) => (
  <dl className='grid grid-cols-1 gap-md rounded-md bg-surface-muted p-md sm:grid-cols-3'>
    <div className={ENTRY_CLASS_NAME}>
      <dt className={TERM_CLASS_NAME}>{USER_FORM_COPY.userIdLabel}</dt>
      <dd className={DESCRIPTION_CLASS_NAME}>{detail.id}</dd>
    </div>

    <div className={ENTRY_CLASS_NAME}>
      <dt className={TERM_CLASS_NAME}>{USER_FORM_COPY.lastLoginLabel}</dt>
      <dd className={DESCRIPTION_CLASS_NAME}>{formatLastLogin(detail.lastLoginAt)}</dd>
    </div>

    <div className={ENTRY_CLASS_NAME}>
      <dt className={TERM_CLASS_NAME}>{USER_FORM_COPY.createdAtLabel}</dt>
      <dd className={DESCRIPTION_CLASS_NAME}>{formatCreatedAt(detail.createdAt)}</dd>
    </div>
  </dl>
)
