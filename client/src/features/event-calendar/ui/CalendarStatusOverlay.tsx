import type React from 'react'
import { AlertCircleSVG, SpinnerSVG } from '../../../../assets'
import type { EventLoadStatus } from '../../../shared/model'
import { Button } from '../../../shared/ui'

interface ICalendarStatusOverlayProps {
  readonly status: EventLoadStatus
  readonly error: string | null
  readonly onRetry: () => void
}

const DEFAULT_ERROR_MESSAGE = 'Events could not be loaded. Please try again.'

const LOADING_CLASS_NAME = [
  'pointer-events-none absolute right-lg top-lg z-10 flex items-center gap-sm',
  'rounded-full border border-line bg-surface px-md py-xs',
  'text-label font-normal text-ink-secondary shadow-overlay',
].join(' ')

/**
 * The loading indication and failure state for the period read
 * (specs/event-calendar/spec.md — "Loading and failure states for the
 * period read"). Layered on top of the mounted FullCalendar instance
 * rather than replacing it, so a failed load is never presented as a bare
 * empty grid — the calendar underneath and this message are both visible.
 *
 * The failure card follows the kit's error banner
 * (assets/ui_kit/overlays and feedback.png): the danger tint, an alert glyph,
 * what went wrong, and the action that retries it.
 */
export const CalendarStatusOverlay: React.FC<ICalendarStatusOverlayProps> = ({
  status,
  error,
  onRetry,
}) => {
  if (status === 'loading') {
    return (
      <div role='status' className={LOADING_CLASS_NAME}>
        <SpinnerSVG className='size-4 animate-spin' />
        Loading events…
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div
        role='alert'
        className='absolute inset-0 z-10 flex items-center justify-center bg-surface/80 p-lg backdrop-blur-[1px]'
      >
        <div className='flex w-full max-w-dialog items-start gap-md rounded-lg border border-danger/25 bg-danger-tint p-lg shadow-overlay'>
          <AlertCircleSVG className='mt-px size-5 shrink-0 text-danger' />

          <div className='flex min-w-0 flex-1 flex-col gap-sm'>
            <p className='text-label text-danger'>We couldn’t load these events</p>
            <p className='text-body text-ink-secondary'>{error ?? DEFAULT_ERROR_MESSAGE}</p>
          </div>

          <Button size='sm' onClick={onRetry}>
            Retry
          </Button>
        </div>
      </div>
    )
  }

  return null
}
