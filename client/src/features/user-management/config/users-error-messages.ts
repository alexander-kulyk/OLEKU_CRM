import type { ApiErrorCode } from '../../../shared/api'

/**
 * Users operations this stage's data layer covers. Follows the same
 * `(operation, code)` mapping pattern as `shared/api/event-error-messages.ts`
 * / `directory-error-messages.ts`, but stays inside this feature rather than
 * `shared` — Users copy/recovery data is feature-local (design.md D1/D3:
 * "Users-specific `(operation, code/status) -> recovery` data stays in a
 * typed feature config"). Later stages add detail/save/archive operations to
 * this same table; Stage 4 only needs the list read.
 */
export type UsersOperation = 'list-users'

interface OperationErrorCopy {
  /** Shown for any code with no more specific entry below. */
  readonly default: string
  readonly overrides?: Partial<Readonly<Record<ApiErrorCode, string>>>
}

const USERS_OPERATION_ERROR_COPY: Readonly<Record<UsersOperation, OperationErrorCopy>> = {
  'list-users': {
    default: 'Users could not be loaded. Please try again.',
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
