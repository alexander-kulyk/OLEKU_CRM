import type { ApiErrorCode } from './error'

/**
 * The participant-directory load operations this stage covers. Follows the
 * same `(operation, code)` mapping pattern as `event-error-messages.ts`
 * (design.md D4) — the server's `message` is never read, and each
 * operation carries its own default for any code with no more specific
 * entry.
 */
export type DirectoryOperation = 'load-attendees' | 'load-hosts'

interface OperationErrorCopy {
  /** Shown for any code with no more specific entry below. */
  readonly default: string
  readonly overrides?: Partial<Readonly<Record<ApiErrorCode, string>>>
}

const DIRECTORY_OPERATION_ERROR_COPY: Readonly<Record<DirectoryOperation, OperationErrorCopy>> = {
  'load-attendees': {
    default: 'Attendees could not be loaded. Please try again.',
  },
  'load-hosts': {
    default: 'Hosts could not be loaded. Please try again.',
  },
}

/**
 * Maps a failed directory load's server error code to plain-language,
 * user-facing copy (specs/event-participants/spec.md — "Failure to load
 * participant options is reported and recoverable"). Never reads or
 * forwards the server's `message` field — only `error.code`.
 */
export function getDirectoryErrorMessage(
  operation: DirectoryOperation,
  code: ApiErrorCode,
): string {
  const copy = DIRECTORY_OPERATION_ERROR_COPY[operation]

  return copy.overrides?.[code] ?? copy.default
}
