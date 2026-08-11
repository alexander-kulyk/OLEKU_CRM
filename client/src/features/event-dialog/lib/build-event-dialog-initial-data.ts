import type { EventRecord } from '../../../shared/api'
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
   * The Edit-mode source record, snapshotted once for read-only display in
   * the Attendees/Hosts placeholders (Stage 6 replaces these with real
   * selectors). `null` in Create mode. Never re-read after this snapshot —
   * see {@link buildEventDialogInitialData}'s doc comment.
   */
  readonly sourceEvent: EventRecord | null
}

const BLANK_FORM_VALUES: EventDialogFormValues = {
  name: '',
  date: '',
  startTime: '',
  endTime: '',
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
      },
      sourceEvent: null,
    }
  }

  const sourceEvent = events.find((event) => event.id === target.eventId) ?? null

  if (sourceEvent === null) {
    // Defensive only: Edit mode is always entered by clicking an event that
    // was, by definition, in `events` at that moment. Falls back to a blank
    // form rather than throwing.
    return { formValues: BLANK_FORM_VALUES, sourceEvent: null }
  }

  return {
    formValues: {
      name: sourceEvent.title,
      date: isoInstantToLocalDateInputValue(sourceEvent.startAt),
      startTime: isoInstantToLocalTimeInputValue(sourceEvent.startAt),
      endTime: isoInstantToLocalTimeInputValue(sourceEvent.endAt),
    },
    sourceEvent,
  }
}
