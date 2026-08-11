import type { EventParticipant, EventRecord } from '../../../shared/api'
import {
  isoInstantToLocalDateInputValue,
  isoInstantToLocalTimeInputValue,
  toLocalDateInputValue,
  toLocalTimeInputValue,
} from '../../../shared/lib'
import type { EventDialogFormValues, OpenDialogTarget } from './event-dialog-schema'

export interface EventDialogInitialData {
  readonly formValues: EventDialogFormValues
  /**
   * The Edit-mode source record, snapshotted once. `null` in Create mode.
   * Never re-read after this snapshot — see
   * {@link buildEventDialogInitialData}'s doc comment.
   */
  readonly sourceEvent: EventRecord | null
  /**
   * The event's starting attendees/hosts, snapshotted once alongside
   * `formValues` (design.md D2's "hydrate once" rule) — the seed for
   * `event-participants`' assigned-list state in
   * `use-event-dialog-controller.ts`. `[]` in Create mode;
   * `sourceEvent.attendees`/`sourceEvent.hosts` in Edit mode. These carry
   * full `EventParticipant` objects (for rendering names as chips); the id
   * arrays that go on the wire are `formValues.attendeeIds`/`hostIds`,
   * derived from the same source below.
   */
  readonly initialAttendees: readonly EventParticipant[]
  readonly initialHosts: readonly EventParticipant[]
}

const BLANK_FORM_VALUES: EventDialogFormValues = {
  name: '',
  date: '',
  startTime: '',
  endTime: '',
  attendeeIds: [],
  hostIds: [],
}

function toParticipantIds(people: readonly EventParticipant[]): string[] {
  return people.map((person) => person.id)
}

/**
 * Computes the Event dialog form's starting values exactly ONCE, the moment
 * the dialog opens for `target` (design.md D2). Callers must invoke this a
 * single time per dialog target — e.g. inside a lazy `useState` initializer
 * on a component keyed by the target, so React never calls it again for the
 * same open dialog — and never fall back to a live `events.find(...)` on
 * later renders. That is what keeps an Edit dialog's values intact if the
 * underlying event later vanishes from a period refresh
 * (specs/event-management/spec.md — "An open event that disappears is
 * handled"; research R-005).
 *
 * Create mode reads the calendar's prefill (a `Date` from the clicked
 * cell/slot). Edit mode copies the matching event out of the currently
 * loaded `events` list — the only source Edit mode has, since there is no
 * `GET /api/events/:id` (research F-001).
 */
export function buildEventDialogInitialData(
  target: OpenDialogTarget,
  events: readonly EventRecord[],
): EventDialogInitialData {
  if (target.type === 'create') {
    return {
      formValues: {
        name: '',
        date: toLocalDateInputValue(target.prefill.date),
        startTime: target.prefill.startTime
          ? toLocalTimeInputValue(target.prefill.startTime)
          : '',
        endTime: '',
        attendeeIds: [],
        hostIds: [],
      },
      sourceEvent: null,
      initialAttendees: [],
      initialHosts: [],
    }
  }

  const sourceEvent = events.find((event) => event.id === target.eventId) ?? null

  if (sourceEvent === null) {
    // Defensive only: Edit mode is always entered by clicking an event that
    // was, by definition, in `events` at that moment. Falls back to a blank
    // form rather than throwing.
    return {
      formValues: BLANK_FORM_VALUES,
      sourceEvent: null,
      initialAttendees: [],
      initialHosts: [],
    }
  }

  return {
    formValues: {
      name: sourceEvent.title,
      date: isoInstantToLocalDateInputValue(sourceEvent.startAt),
      startTime: isoInstantToLocalTimeInputValue(sourceEvent.startAt),
      endTime: isoInstantToLocalTimeInputValue(sourceEvent.endAt),
      attendeeIds: toParticipantIds(sourceEvent.attendees),
      hostIds: toParticipantIds(sourceEvent.hosts),
    },
    sourceEvent,
    initialAttendees: sourceEvent.attendees,
    initialHosts: sourceEvent.hosts,
  }
}
