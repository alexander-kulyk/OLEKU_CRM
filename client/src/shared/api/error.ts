import axios from 'axios'
import type { AxiosError } from 'axios'

/**
 * The stable, machine-readable failure codes the server can return, per
 * `server/src/shared/http/error-envelope.ts` for the existing event/
 * directory endpoints, and `openspec/changes/add-users-server-api/specs/
 * users-api/spec.md` plus `specs/api-foundation/spec.md` for the Users
 * domain (`add-users-client-ui` design.md D3). Users codes are added
 * additively — no existing code is removed or renamed — and this list also
 * carries `CANNOT_ARCHIVE_SELF`/`CANNOT_ARCHIVE_LAST_ADMINISTRATIVE_USER`
 * ahead of server enforcement so the client's recovery matrix (design.md
 * D7) can recognise them the moment the server starts returning them.
 */
export type ServerErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'INVALID_PARTICIPANT'
  | 'INTERNAL_ERROR'
  // Users domain (add-users-server-api / add-users-client-ui):
  | 'EMAIL_ALREADY_EXISTS'
  | 'EMAIL_TAKEN_BY_ARCHIVED_USER'
  | 'USER_VERSION_CONFLICT'
  | 'USER_ARCHIVED'
  | 'NO_CHANGES_SUBMITTED'
  | 'UNKNOWN_FIELD'
  | 'CANNOT_ARCHIVE_SELF'
  | 'CANNOT_ARCHIVE_LAST_ADMINISTRATIVE_USER'

/**
 * A marker used when a failure carries no recognisable server envelope at
 * all — a network failure, a timeout, a CORS rejection, or any response
 * shape other than `{ error: { code, message } }`.
 */
export const TRANSPORT_ERROR_CODE = 'TRANSPORT_ERROR'

/**
 * A distinct internal marker for a request the client itself aborted —
 * for example, a list read superseded by a newer canonical query
 * (design.md D2). {@link toApiError} recognises axios/`AbortSignal`
 * cancellation specifically so it never collapses into
 * {@link TRANSPORT_ERROR_CODE}: an intentionally cancelled request is not a
 * failure to present to the operator.
 */
export const CANCELLED_ERROR_CODE = 'REQUEST_CANCELLED'

export type ApiErrorCode =
  | ServerErrorCode
  | typeof TRANSPORT_ERROR_CODE
  | typeof CANCELLED_ERROR_CODE

/**
 * The client's single internal error shape. Every axios failure — however
 * it originated — is normalised into this shape by the response
 * interceptor in `http-client.ts`. The server's `message` is still never
 * read here: user-facing copy is produced at the call site, keyed by
 * `(operation, code)` and, additively, by HTTP `status` (design.md D3/D7).
 */
export interface ApiError {
  readonly code: ApiErrorCode
  /**
   * The single request field the failure is attributable to, when the
   * server's envelope names one (e.g. `email` on a duplicate-email
   * conflict). Absent when the failure has no single responsible field.
   */
  readonly field?: string
  /**
   * The response's HTTP status, when the failure carried an HTTP response
   * at all. Lets a caller drive generic recovery (401/403/429/5xx) for
   * statuses no specific `code` currently represents.
   */
  readonly status?: number
}

const SERVER_ERROR_CODES: readonly ServerErrorCode[] = [
  'VALIDATION_ERROR',
  'NOT_FOUND',
  'INVALID_PARTICIPANT',
  'INTERNAL_ERROR',
  'EMAIL_ALREADY_EXISTS',
  'EMAIL_TAKEN_BY_ARCHIVED_USER',
  'USER_VERSION_CONFLICT',
  'USER_ARCHIVED',
  'NO_CHANGES_SUBMITTED',
  'UNKNOWN_FIELD',
  'CANNOT_ARCHIVE_SELF',
  'CANNOT_ARCHIVE_LAST_ADMINISTRATIVE_USER',
]

function isServerErrorCode(value: unknown): value is ServerErrorCode {
  return (
    typeof value === 'string' &&
    (SERVER_ERROR_CODES as readonly string[]).includes(value)
  )
}

interface ServerErrorEnvelope {
  readonly code?: unknown
  readonly field?: unknown
}

/**
 * Reads the `error` member off the shared envelope shape
 * (`{ error: { code, message, field? } }`), or `undefined` when the
 * response body does not match it at all.
 */
function readServerErrorEnvelope(
  error: AxiosError,
): ServerErrorEnvelope | undefined {
  const data = error.response?.data

  if (typeof data !== 'object' || data === null || !('error' in data)) {
    return undefined
  }

  const envelope = (data as { error?: unknown }).error

  if (typeof envelope !== 'object' || envelope === null) {
    return undefined
  }

  return envelope as ServerErrorEnvelope
}

/**
 * Normalises any axios rejection into an {@link ApiError}. Never throws.
 *
 * - An intentionally aborted request (`AbortController`/`AbortSignal`,
 *   research.md EVID-013) becomes {@link CANCELLED_ERROR_CODE} with no
 *   other metadata attached.
 * - A recognised `{ error: { code, message, field? } }` envelope keeps its
 *   `code`, its optional `field`, and the response's HTTP `status`.
 * - Anything else — including a JSON body with an unrecognised `code`, or
 *   a transport-level failure with no response at all — collapses to
 *   {@link TRANSPORT_ERROR_CODE}, still carrying `status` when an HTTP
 *   response was received.
 */
export function toApiError(error: unknown): ApiError {
  if (axios.isCancel(error)) {
    return { code: CANCELLED_ERROR_CODE }
  }

  if (axios.isAxiosError(error)) {
    const status = error.response?.status
    const envelope = readServerErrorEnvelope(error)
    const code = envelope?.code
    const field = typeof envelope?.field === 'string' ? envelope.field : undefined

    if (isServerErrorCode(code)) {
      return {
        code,
        ...(field !== undefined ? { field } : {}),
        ...(status !== undefined ? { status } : {}),
      }
    }

    return {
      code: TRANSPORT_ERROR_CODE,
      ...(status !== undefined ? { status } : {}),
    }
  }

  return { code: TRANSPORT_ERROR_CODE }
}

export function isApiError(value: unknown): value is ApiError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    typeof (value as { code: unknown }).code === 'string'
  )
}

/**
 * Reads the {@link ApiErrorCode} off a value caught downstream of
 * `httpClient` — whose interceptor has already normalised every rejection
 * to an {@link ApiError} via {@link toApiError}. Callers that only have the
 * caught value (never the original axios error) use this instead of
 * re-running {@link toApiError}, which would misclassify an already
 * normalised {@link ApiError} as {@link TRANSPORT_ERROR_CODE}. Anything
 * unrecognised still falls back to {@link TRANSPORT_ERROR_CODE}.
 */
export function getApiErrorCode(error: unknown): ApiErrorCode {
  return isApiError(error) ? error.code : TRANSPORT_ERROR_CODE
}

/**
 * True when a value caught downstream of `httpClient` represents a request
 * the client itself cancelled (design.md D2 "latest-request-wins"), rather
 * than a failure to present to the operator. A stale-request completion
 * guard checks this before treating a rejection as a visible error.
 */
export function isCancelledError(error: unknown): boolean {
  return isApiError(error) && error.code === CANCELLED_ERROR_CODE
}
