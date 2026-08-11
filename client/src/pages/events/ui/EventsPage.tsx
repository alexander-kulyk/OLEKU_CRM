import type { FC } from 'react'
import { EventCalendar } from '../../../features/event-calendar'
import { EventDialog } from '../../../features/event-dialog'

/**
 * The calendar page at `/events` (specs/event-calendar/spec.md,
 * specs/event-management/spec.md). Stays a thin composition root — the
 * FullCalendar surface and its toolbar live in `event-calendar`; the
 * Create/Edit modal lives in `event-dialog` and reads its own target
 * straight from the shared store (design.md D1), so it is rendered here as
 * a plain sibling, not driven by page-level props.
 */
export const EventsPage: FC = () => {
  return (
    <div className="flex h-full flex-col gap-md">
      <h1 className="text-2xl font-semibold text-text">Calendar</h1>
      <EventCalendar />
      <EventDialog />
    </div>
  )
}
