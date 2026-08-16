import type { EventInput } from '@fullcalendar/core'
import type { EventRecord } from '../../../shared/api'

/**
 * Maps domain events to FullCalendar's `EventInput` shape at the boundary
 * (design.md D6): `startAt`→`start`, `endAt`→`end`, `title`→`title`, and
 * everything else — the resolved attendee and host lists — carried in
 * `extendedProps` rather than reshaped. `startAt`/`endAt` are passed through
 * as the zone-explicit ISO strings the server sends; FullCalendar parses
 * them itself.
 *
 * `color` drives both the block's fill and its border so a stored color
 * renders as one solid block rather than a tinted default; FullCalendar's
 * own white event text stays legible against every palette value
 * (`event-dialog/config/event-colors.ts`).
 */
export function mapEventRecordsToCalendarEvents(
  events: readonly EventRecord[],
): EventInput[] {
  return events.map((event) => ({
    id: event.id,
    title: event.title,
    start: event.startAt,
    end: event.endAt,
    backgroundColor: event.color,
    borderColor: event.color,
    extendedProps: {
      attendees: event.attendees,
      hosts: event.hosts,
    },
  }))
}
