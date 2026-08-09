/**
 * The stable, machine-readable failure codes any API response can return.
 * See `specs/api-foundation/spec.md` for the exact status each code maps to.
 */
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'INVALID_PARTICIPANT'
  | 'INTERNAL_ERROR'

/** The exact — and only — shape a failing API response body may have. */
export interface ErrorEnvelope {
  error: {
    code: ErrorCode
    message: string
  }
}

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  INVALID_PARTICIPANT: 400,
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

  constructor(code: ErrorCode, message: string) {
    super(message)
    this.name = 'HttpError'
    this.code = code
    this.status = STATUS_BY_CODE[code]
  }

  toEnvelope(): ErrorEnvelope {
    return { error: { code: this.code, message: this.message } }
  }
}
