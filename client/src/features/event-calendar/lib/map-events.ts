import type { EventInput } from '@fullcalendar/core'
import type { EventRecord } from '../../../shared/api'

/**
 * Maps domain events to FullCalendar's `EventInput` shape at the boundary
 * (design.md D6): `startAt`→`start`, `endAt`→`end`, `title`→`title`, and
 * everything else — the resolved attendee and host lists — carried in
 * `extendedProps` rather than reshaped. `startAt`/`endAt` are passed through
 * as the zone-explicit ISO strings the server sends; FullCalendar parses
 * them itself.
 */
export function mapEventRecordsToCalendarEvents(
  events: readonly EventRecord[],
): EventInput[] {
  return events.map((event) => ({
    id: event.id,
    title: event.title,
    start: event.startAt,
    end: event.endAt,
    extendedProps: {
      attendees: event.attendees,
      hosts: event.hosts,
    },
  }))
}
