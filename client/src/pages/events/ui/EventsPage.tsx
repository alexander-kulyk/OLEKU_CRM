import type { FC } from 'react'

/**
 * The calendar page at `/events`. This stage only needs it to exist and
 * resolve at the route — the FullCalendar integration is Stage 4's job
 * (design.md D6).
 */
export const EventsPage: FC = () => {
  return (
    <div className="flex h-full flex-col gap-sm">
      <h1 className="text-2xl font-semibold text-text">Calendar</h1>
      <p className="text-text-muted">
        Events page — calendar coming in a later stage.
      </p>
    </div>
  )
}
