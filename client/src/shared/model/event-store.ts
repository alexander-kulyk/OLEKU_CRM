import { create } from 'zustand'
import { getApiErrorCode } from '../api/error'
import { getEventErrorMessage } from '../api/event-error-messages'
import {
  createEvent as createEventRequest,
  deleteEvent as deleteEventRequest,
  readEventsForPeriod,
  updateEvent as updateEventRequest,
} from '../api/events'
import type {
  CreateEventInput,
  EventPeriod,
  EventRecord,
  UpdateEventInput,
} from '../api/event-types'

/** The three calendar views the Events page offers (design.md D2). */
export type CalendarView = 'month' | 'week' | 'day'

/** Status of the active period's event read. */
export type EventLoadStatus = 'idle' | 'loading' | 'success' | 'error'

/**
 * What an empty-slot selection prefills into a newly opened Create dialog.
 * `startTime` is present only for a week/day-view slot selection — month
 * view only ever prefills a date (event-calendar spec: "Selecting an empty
 * slot starts event creation").
 */
export interface EventCreatePrefill {
  readonly date: Date
  readonly startTime?: Date
}

/**
 * Which target, if any, the Event dialog is currently open for
 * (design.md D2). `closed` is the resting state.
 */
export type DialogTarget =
  | { readonly type: 'closed' }
  | { readonly type: 'create'; readonly prefill: EventCreatePrefill }
  | { readonly type: 'edit'; readonly eventId: string }

export interface EventStoreState {
  // Calendar UI state (design.md D2).
  readonly activeView: CalendarView
  readonly focusedDate: Date
  readonly dialogTarget: DialogTarget

  // Event data state (design.md D2). Only one period is ever held — no
  // keyed cache. Navigating replaces `activePeriod`/`events` rather than
  // accumulating them.
  readonly activePeriod: EventPeriod | null
  readonly events: readonly EventRecord[]
  readonly status: EventLoadStatus
  readonly error: string | null
}

export interface EventStoreActions {
  setActiveView: (view: CalendarView) => void
  setFocusedDate: (date: Date) => void
  openCreateDialog: (prefill: EventCreatePrefill) => void
  openEditDialog: (eventId: string) => void
  closeDialog: () => void

  /**
   * Reads events for `period` and, if it is still the active period when
   * the response arrives, applies the result (the stale-response guard —
   * design.md D2). This is the calendar's single read trigger; callers
   * pass `from`/`to` through unmodified (design.md D3).
   */
  readPeriod: (period: EventPeriod) => Promise<void>
  /** Re-reads whatever period is currently active. A no-op before first read. */
  refreshActivePeriod: () => Promise<void>

  /**
   * Creates an event, then re-reads the active period (design.md D2's
   * invalidation trigger — never a local splice). Rejects with an `Error`
   * whose `message` is already the mapped, user-facing copy.
   */
  createEvent: (input: CreateEventInput) => Promise<void>
  /** Updates an event, then re-reads the active period. See {@link createEvent}. */
  updateEvent: (id: string, input: UpdateEventInput) => Promise<void>
  /** Deletes an event, then re-reads the active period. See {@link createEvent}. */
  deleteEvent: (id: string) => Promise<void>
}

export type EventStore = EventStoreState & EventStoreActions

function isSamePeriod(issuedFor: EventPeriod, current: EventPeriod | null): boolean {
  return (
    current !== null &&
    issuedFor.from === current.from &&
    issuedFor.to === current.to
  )
}

/**
 * The one store that owns both calendar UI state and event data
 * (design.md D2). Lives in `shared/model` because both `event-calendar`
 * and `event-dialog` need it and neither owns the other (design.md D1).
 */
export const useEventStore = create<EventStore>()((set, get) => ({
  activeView: 'month',
  focusedDate: new Date(),
  dialogTarget: { type: 'closed' },

  activePeriod: null,
  events: [],
  status: 'idle',
  error: null,

  setActiveView: (view) => {
    set({ activeView: view })
  },

  setFocusedDate: (date) => {
    set({ focusedDate: date })
  },

  openCreateDialog: (prefill) => {
    set({ dialogTarget: { type: 'create', prefill } })
  },

  openEditDialog: (eventId) => {
    set({ dialogTarget: { type: 'edit', eventId } })
  },

  closeDialog: () => {
    set({ dialogTarget: { type: 'closed' } })
  },

  readPeriod: async (period) => {
    // Recorded as "the period this active-period slot now represents" —
    // the read below is issued for exactly this `period` value, captured
    // in the closure, and compared back against this field on arrival.
    set({ activePeriod: period, status: 'loading', error: null })

    try {
      const events = await readEventsForPeriod(period)

      if (!isSamePeriod(period, get().activePeriod)) {
        // A later navigation replaced the active period before this
        // response arrived — discard it rather than render stale events.
        return
      }

      set({ events, status: 'success', error: null })
    } catch (thrown) {
      if (!isSamePeriod(period, get().activePeriod)) {
        return
      }

      set({
        events: [],
        status: 'error',
        error: getEventErrorMessage('load-events', getApiErrorCode(thrown)),
      })
    }
  },

  refreshActivePeriod: async () => {
    const period = get().activePeriod

    if (period === null) {
      return
    }

    await get().readPeriod(period)
  },

  createEvent: async (input) => {
    try {
      await createEventRequest(input)
    } catch (thrown) {
      throw new Error(
        getEventErrorMessage('create-event', getApiErrorCode(thrown)),
      )
    }

    await get().refreshActivePeriod()
  },

  updateEvent: async (id, input) => {
    try {
      await updateEventRequest(id, input)
    } catch (thrown) {
      throw new Error(
        getEventErrorMessage('update-event', getApiErrorCode(thrown)),
      )
    }

    await get().refreshActivePeriod()
  },

  deleteEvent: async (id) => {
    try {
      await deleteEventRequest(id)
    } catch (thrown) {
      throw new Error(
        getEventErrorMessage('delete-event', getApiErrorCode(thrown)),
      )
    }

    await get().refreshActivePeriod()
  },
}))
