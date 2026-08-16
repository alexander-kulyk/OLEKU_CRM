import type { EventInput } from '@fullcalendar/core'
import type { EventRecord } from '../../../shared/api'
import { DEFAULT_EVENT_COLOR } from '../../../shared/config'

/**
 * The extra fields `CalendarEventContent` needs to paint a block, read back
 * out of FullCalendar's untyped `extendedProps` bag.
 */
export interface CalendarEventPresentation {
  /** The stored six-digit hex; resolved into fill/rail/text at render time. */
  readonly color: string
  /** The event's hosts, already joined for display. Empty when there are none. */
  readonly hostNames: string
}

/**
 * Maps domain events to FullCalendar's `EventInput` shape at the boundary
 * (design.md D6): `startAt`→`start`, `endAt`→`end`, `title`→`title`, and
 * everything else — the resolved attendee and host lists — carried in
 * `extendedProps` rather than reshaped. `startAt`/`endAt` are passed through
 * as the zone-explicit ISO strings the server sends; FullCalendar parses
 * them itself.
 *
 * `backgroundColor`/`borderColor` are deliberately NOT set. The kit renders
 * an event as a pale tint with a saturated rail and dark text
 * (assets/ui_kit/Calendar/week.png), which is three colors derived from one
 * stored value — more than FullCalendar's two slots can express. The stored
 * color rides along in `extendedProps` instead, and `CalendarEventContent`
 * paints the block itself.
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
      color: event.color,
      hostNames: event.hosts.map((host) => host.fullName).join(', '),
      attendees: event.attendees,
      hosts: event.hosts,
    },
  }))
}

/**
 * Narrows FullCalendar's `extendedProps` dictionary back to the fields
 * {@link mapEventRecordsToCalendarEvents} put there. Written as a check
 * rather than a cast because the bag is typed as an open dictionary — an
 * event that somehow arrives without a color still renders, in the palette
 * default, instead of producing an invalid CSS value.
 */
export function readCalendarEventPresentation(
  extendedProps: Record<string, unknown>,
): CalendarEventPresentation {
  const { color, hostNames } = extendedProps

  return {
    color: typeof color === 'string' ? color : DEFAULT_EVENT_COLOR,
    hostNames: typeof hostNames === 'string' ? hostNames : '',
  }
}
