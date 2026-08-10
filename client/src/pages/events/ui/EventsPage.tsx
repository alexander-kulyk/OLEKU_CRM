import type { FC } from 'react'
import { EventCalendar } from '../../../features/event-calendar'

/**
 * The calendar page at `/events` (specs/event-calendar/spec.md). Stays a
 * thin composition root — the FullCalendar surface, its custom toolbar, and
 * the period-read wiring all live in the `event-calendar` feature
 * (design.md D1).
 */
export const EventsPage: FC = () => {
  return (
    <div className="flex h-full flex-col gap-md">
      <h1 className="text-2xl font-semibold text-text">Calendar</h1>
      <EventCalendar />
    </div>
  )
}
