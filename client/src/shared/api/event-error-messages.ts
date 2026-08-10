import type { ApiErrorCode } from './error'

/**
 * The event operations this stage's data layer covers. Participant-option
 * loading (Stage 6) is a separate concern and is not mapped here.
 */
export type EventOperation =
  | 'load-events'
  | 'create-event'
  | 'update-event'
  | 'delete-event'

interface OperationErrorCopy {
  /** Shown for any code with no more specific entry below. */
  readonly default: string
  readonly overrides?: Partial<Readonly<Record<ApiErrorCode, string>>>
}

const NOT_FOUND_EVENT_MESSAGE = 'This event could no longer be found.'

const INVALID_PARTICIPANT_MESSAGE =
  "One of the selected participants can't be assigned to this event."

/**
 * `(operation, code)` → user-facing copy (design.md D4). The server's
 * `message` field is never read anywhere in this module — only
 * `error.code`, via {@link getEventErrorMessage}'s `code` parameter.
 *
 * `NOT_FOUND` is deliberately overridden per write operation rather than
 * given one shared meaning: the same code also comes back for an
 * unmatched URL, so a generic "not found" message would be misleading.
 * Read here as "this event you were trying to change/remove is gone"
 * (F-005, F-006, R-009).
 */
const EVENT_OPERATION_ERROR_COPY: Readonly<
  Record<EventOperation, OperationErrorCopy>
> = {
  'load-events': {
    default: 'Events could not be loaded. Please try again.',
  },
  'create-event': {
    default: 'The event could not be created. Please try again.',
    overrides: {
      INVALID_PARTICIPANT: INVALID_PARTICIPANT_MESSAGE,
    },
  },
  'update-event': {
    default: 'The event could not be updated. Please try again.',
    overrides: {
      NOT_FOUND: NOT_FOUND_EVENT_MESSAGE,
      INVALID_PARTICIPANT: INVALID_PARTICIPANT_MESSAGE,
    },
  },
  'delete-event': {
    default: 'The event could not be deleted. Please try again.',
    overrides: {
      NOT_FOUND: NOT_FOUND_EVENT_MESSAGE,
    },
  },
}

/**
 * Maps a failed operation's server error code to plain-language,
 * user-facing copy. Never reads or forwards the server's `message` field —
 * only `error.code`. A code with no operation-specific override falls back
 * to that operation's default.
 */
export function getEventErrorMessage(
  operation: EventOperation,
  code: ApiErrorCode,
): string {
  const copy = EVENT_OPERATION_ERROR_COPY[operation]

  return copy.overrides?.[code] ?? copy.default
}
