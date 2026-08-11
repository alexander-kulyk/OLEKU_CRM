import type { FC } from 'react'
import type { EventLoadStatus } from '../../../shared/model'

interface CalendarStatusOverlayProps {
  readonly status: EventLoadStatus
  readonly error: string | null
  readonly onRetry: () => void
}

const DEFAULT_ERROR_MESSAGE = 'Events could not be loaded. Please try again.'

/**
 * The loading indication and failure state for the period read
 * (specs/event-calendar/spec.md — "Loading and failure states for the
 * period read"). Layered on top of the mounted FullCalendar instance
 * rather than replacing it, so a failed load is never presented as a bare
 * empty grid — the calendar underneath and this message are both visible.
 */
export const CalendarStatusOverlay: FC<CalendarStatusOverlayProps> = ({
  status,
  error,
  onRetry,
}) => {
  if (status === 'loading') {
    return (
      <div
        role="status"
        className="pointer-events-none absolute right-md top-md z-10 rounded-full border border-border bg-surface px-md py-xs text-sm font-medium text-text-muted shadow"
      >
        Loading events…
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div
        role="alert"
        className="absolute inset-0 z-10 flex items-center justify-center bg-surface/90"
      >
        <div className="flex max-w-dialog flex-col items-center gap-sm rounded-lg border border-border bg-surface p-lg text-center shadow-lg">
          <p className="text-text">{error ?? DEFAULT_ERROR_MESSAGE}</p>
          <button
            type="button"
            onClick={onRetry}
            className="rounded-md bg-primary-600 px-md py-sm text-sm font-medium text-white hover:bg-primary-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return null
}
