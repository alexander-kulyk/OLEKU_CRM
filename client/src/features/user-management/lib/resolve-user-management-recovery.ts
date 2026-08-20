import type { ApiError } from '../../../shared/api'
import { getUsersErrorMessage } from '../config/users-error-messages'
import type { UsersOperation } from '../config/users-error-messages'

/**
 * How the controller should present one failed Users mutation/read
 * (design.md D7). Cancellation and 401 are deliberately NOT modelled here —
 * both need context this pure function does not have (a live "was this
 * superseded" check, and the injected `onUnauthorized` callback), so the
 * caller (`model/use-user-management-controller.ts`) filters them out
 * before calling this.
 */
export type UserManagementRecoveryKind =
  | 'field'
  | 'form'
  | 'version-conflict'
  | 'record-archived'
  | 'record-not-found'
  | 'archive-conflict'

export interface UserManagementRecoveryOutcome {
  readonly kind: UserManagementRecoveryKind
  readonly message: string
  /** Only present for `kind === 'field'`. */
  readonly field?: string
}

/**
 * The server field names `error.field` can hold that this feature's flat
 * `UserFormValues` (`lib/user-form/user-form-schema.ts`) also exposes as a
 * named input — `shared/http/validate.ts` only ever reports a top-level
 * `field`, so a nested address property never reaches here (design.md D4).
 */
const KNOWN_EDITABLE_SERVER_FIELDS: ReadonlySet<string> = new Set([
  'firstName',
  'lastName',
  'email',
  'phone',
  'phoneExtension',
  'status',
])

/**
 * The (operation, code) -> recovery matrix (design.md D7), as an exhaustive
 * per-operation function rather than a lookup table: several branches
 * depend on `error.field` being present AND recognised, which a flat
 * `Record<code, outcome>` cannot express. Never reads `error`'s HTTP status
 * text or the server's `message` — only the stable `code`/`field`
 * (design.md D3).
 */
export function resolveUserManagementRecovery(
  operation: UsersOperation,
  error: ApiError,
): UserManagementRecoveryOutcome {
  const message = getUsersErrorMessage(operation, error.code)

  if (operation === 'save-user') {
    const isDuplicateEmail = error.code === 'EMAIL_ALREADY_EXISTS' || error.code === 'EMAIL_TAKEN_BY_ARCHIVED_USER'

    if (isDuplicateEmail && error.field !== undefined) {
      return { kind: 'field', message, field: error.field }
    }

    if (error.code === 'VALIDATION_ERROR' || error.code === 'UNKNOWN_FIELD') {
      if (error.field !== undefined && KNOWN_EDITABLE_SERVER_FIELDS.has(error.field)) {
        return { kind: 'field', message, field: error.field }
      }
      return { kind: 'form', message }
    }

    if (error.code === 'USER_VERSION_CONFLICT') {
      return { kind: 'version-conflict', message }
    }

    if (error.code === 'USER_ARCHIVED') {
      return { kind: 'record-archived', message }
    }

    return { kind: 'form', message }
  }

  if (operation === 'read-user-detail') {
    return error.code === 'NOT_FOUND' ? { kind: 'record-not-found', message } : { kind: 'form', message }
  }

  // operation === 'archive-user'
  const isArchiveConflict =
    error.code === 'CANNOT_ARCHIVE_SELF' || error.code === 'CANNOT_ARCHIVE_LAST_ADMINISTRATIVE_USER'

  return isArchiveConflict ? { kind: 'archive-conflict', message } : { kind: 'form', message }
}
