/**
 * The stable, machine-readable failure codes any API response can return.
 * See `specs/api-foundation/spec.md` for the exact status each code maps to.
 */
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'INVALID_PARTICIPANT'
  | 'EMAIL_ALREADY_EXISTS'
  | 'EMAIL_TAKEN_BY_ARCHIVED_USER'
  | 'USER_VERSION_CONFLICT'
  | 'USER_ARCHIVED'
  | 'NO_CHANGES_SUBMITTED'
  | 'UNKNOWN_FIELD'
  | 'INTERNAL_ERROR'

/** The exact — and only — shape a failing API response body may have. */
export interface ErrorEnvelope {
  error: {
    code: ErrorCode
    message: string
    field?: string
  }
}

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  INVALID_PARTICIPANT: 400,
  EMAIL_ALREADY_EXISTS: 409,
  EMAIL_TAKEN_BY_ARCHIVED_USER: 409,
  USER_VERSION_CONFLICT: 409,
  USER_ARCHIVED: 409,
  NO_CHANGES_SUBMITTED: 400,
  UNKNOWN_FIELD: 400,
  INTERNAL_ERROR: 500,
}

/**
 * A typed failure carrying a stable status/code pair and a message that is
 * always safe to return to the caller. Throw this — never a bare `Error` —
 * from validation helpers, controllers, and services; the shared error
 * middleware (`error-middleware.ts`) maps it directly to the shared
 * envelope and nothing else. Never construct one with a message built from
 * a stack, a raw exception, driver text, or the request itself: the
 * message is returned to the client verbatim.
 */
export class HttpError extends Error {
  readonly status: number
  readonly code: ErrorCode
  readonly field?: string

  constructor(code: ErrorCode, message: string, field?: string) {
    super(message)
    this.name = 'HttpError'
    this.code = code
    this.status = STATUS_BY_CODE[code]
    this.field = field
  }

  toEnvelope(): ErrorEnvelope {
    const error: ErrorEnvelope['error'] = {
      code: this.code,
      message: this.message,
    }

    if (this.field !== undefined) {
      error.field = this.field
    }

    return { error }
  }
}
