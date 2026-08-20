import type { ApiErrorCode } from '../../../shared/api'

/**
 * Users operations this stage's data layer covers. Follows the same
 * `(operation, code)` mapping pattern as `shared/api/event-error-messages.ts`
 * / `directory-error-messages.ts`, but stays inside this feature rather than
 * `shared` — Users copy/recovery data is feature-local (design.md D1/D3:
 * "Users-specific `(operation, code/status) -> recovery` data stays in a
 * typed feature config"). Stage 6 adds the detail/save/archive operations
 * this table always reserved room for (`lib/resolve-user-management-recovery.ts`
 * reads these for every branch of the recovery matrix, design.md D7).
 */
export type UsersOperation = 'list-users' | 'read-user-detail' | 'save-user' | 'archive-user'

interface OperationErrorCopy {
  /** Shown for any code with no more specific entry below. */
  readonly default: string
  readonly overrides?: Partial<Readonly<Record<ApiErrorCode, string>>>
}

const USERS_OPERATION_ERROR_COPY: Readonly<Record<UsersOperation, OperationErrorCopy>> = {
  'list-users': {
    default: 'Users could not be loaded. Please try again.',
  },
  'read-user-detail': {
    default: 'This user could not be loaded. Please try again.',
    overrides: {
      NOT_FOUND: 'This user could not be found. The list has been refreshed.',
    },
  },
  'save-user': {
    default: 'Changes could not be saved. Please try again.',
    overrides: {
      EMAIL_ALREADY_EXISTS: 'This email address is already in use.',
      EMAIL_TAKEN_BY_ARCHIVED_USER: 'This email address is already in use by an archived user.',
      VALIDATION_ERROR: 'Some values could not be saved. Please check the form and try again.',
      USER_VERSION_CONFLICT:
        'This user was changed by someone else. Reload the latest version to continue — your unsaved changes will not be sent until you do.',
      USER_ARCHIVED: 'This user was archived elsewhere. Your changes were not saved.',
    },
  },
  'archive-user': {
    default: 'This user could not be archived. Please try again.',
    overrides: {
      CANNOT_ARCHIVE_SELF: 'You cannot archive your own account.',
      CANNOT_ARCHIVE_LAST_ADMINISTRATIVE_USER: 'This is the last administrative user and cannot be archived.',
    },
  },
}

/**
 * Maps a failed Users operation's server error code to plain-language,
 * user-facing copy. Never reads or forwards the server's `message` field —
 * only `error.code` (design.md D3).
 */
export function getUsersErrorMessage(operation: UsersOperation, code: ApiErrorCode): string {
  const copy = USERS_OPERATION_ERROR_COPY[operation]

  return copy.overrides?.[code] ?? copy.default
}
