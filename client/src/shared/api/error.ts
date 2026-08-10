import axios from 'axios'
import type { AxiosError } from 'axios'

/**
 * The stable, machine-readable failure codes the server can return, per
 * `server/src/shared/http/error-envelope.ts`.
 */
export type ServerErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'INVALID_PARTICIPANT'
  | 'INTERNAL_ERROR'

/**
 * A marker used when a failure carries no recognisable server envelope at
 * all — a network failure, a timeout, a CORS rejection, or any response
 * shape other than `{ error: { code, message } }`.
 */
export const TRANSPORT_ERROR_CODE = 'TRANSPORT_ERROR'

export type ApiErrorCode = ServerErrorCode | typeof TRANSPORT_ERROR_CODE

/**
 * The client's single internal error shape. Every axios failure — however
 * it originated — is normalised into this shape by the response
 * interceptor in `http-client.ts`. It intentionally carries only the
 * `code`: the server's `message` is never read here, because user-facing
 * copy is produced at the call site, keyed by (operation, code).
 */
export interface ApiError {
  readonly code: ApiErrorCode
}

const SERVER_ERROR_CODES: readonly ServerErrorCode[] = [
  'VALIDATION_ERROR',
  'NOT_FOUND',
  'INVALID_PARTICIPANT',
  'INTERNAL_ERROR',
]

function isServerErrorCode(value: unknown): value is ServerErrorCode {
  return (
    typeof value === 'string' &&
    (SERVER_ERROR_CODES as readonly string[]).includes(value)
  )
}

function readServerErrorCode(error: AxiosError): unknown {
  const data = error.response?.data

  if (typeof data !== 'object' || data === null || !('error' in data)) {
    return undefined
  }

  const envelope = (data as { error?: unknown }).error

  if (typeof envelope !== 'object' || envelope === null) {
    return undefined
  }

  return (envelope as { code?: unknown }).code
}

/**
 * Normalises any axios rejection into an {@link ApiError}. Never throws:
 * anything that is not a recognisable `{ error: { code, message } }`
 * envelope collapses to {@link TRANSPORT_ERROR_CODE}.
 */
export function toApiError(error: unknown): ApiError {
  if (axios.isAxiosError(error)) {
    const code = readServerErrorCode(error)

    if (isServerErrorCode(code)) {
      return { code }
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
