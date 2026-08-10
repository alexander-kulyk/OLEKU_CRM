import type { CalendarView } from '../../../shared/model'

/** The FullCalendar view names the three plugins we mount register. */
type FullCalendarViewName = 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay'

interface CalendarViewOption {
  readonly label: string
  readonly fullCalendarViewName: FullCalendarViewName
}

/**
 * The one place `CalendarView` is mapped to FullCalendar's own view names
 * and toolbar labels (design.md D6). A `Record` rather than a `switch`, so
 * the toolbar's segmented control and the `datesSet` feedback loop below
 * both read from the same table (data-driven-rendering skill) and adding a
 * fourth view is a compile error here until every consumer accounts for it.
 */
export const CALENDAR_VIEW_CONFIG: Record<CalendarView, CalendarViewOption> = {
  month: { label: 'Month', fullCalendarViewName: 'dayGridMonth' },
  week: { label: 'Week', fullCalendarViewName: 'timeGridWeek' },
  day: { label: 'Day', fullCalendarViewName: 'timeGridDay' },
}

/** Render order for the Month / Week / Day segmented control. */
export const CALENDAR_VIEW_ORDER: readonly CalendarView[] = ['month', 'week', 'day']

const FULL_CALENDAR_VIEW_NAME_TO_CALENDAR_VIEW: Readonly<Record<string, CalendarView>> =
  Object.fromEntries(
    CALENDAR_VIEW_ORDER.map((view) => [CALENDAR_VIEW_CONFIG[view].fullCalendarViewName, view]),
  )

/**
 * Reverse lookup used by the `datesSet` feedback loop to fold FullCalendar's
 * own `view.type` back into the store's `CalendarView` (design.md D6).
 * Falls back to `month` for any view type outside the three configured
 * above — the mounted calendar, restricted to those three plugins, never
 * actually reports one.
 */
export function getCalendarViewFromFullCalendarViewType(viewType: string): CalendarView {
  return FULL_CALENDAR_VIEW_NAME_TO_CALENDAR_VIEW[viewType] ?? 'month'
}
