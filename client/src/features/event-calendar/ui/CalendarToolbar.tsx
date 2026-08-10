import type { FC } from 'react'
import type { CalendarView } from '../../../shared/model'
import { CALENDAR_VIEW_CONFIG, CALENDAR_VIEW_ORDER } from '../lib/calendar-view-config'

interface CalendarToolbarProps {
  readonly activeView: CalendarView
  readonly title: string
  readonly onPrev: () => void
  readonly onNext: () => void
  readonly onToday: () => void
  readonly onChangeView: (view: CalendarView) => void
}

const NAV_BUTTON_CLASS_NAME =
  'flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface text-lg text-text hover:bg-surface-muted'
const TODAY_BUTTON_CLASS_NAME =
  'rounded-md border border-border bg-surface px-md py-xs text-sm font-medium text-text hover:bg-surface-muted'
const SEGMENT_BASE_CLASS_NAME =
  'rounded-md px-md py-xs text-sm font-medium transition-colors'
const SEGMENT_ACTIVE_CLASS_NAME = 'bg-primary-600 text-white'
const SEGMENT_INACTIVE_CLASS_NAME = 'text-text-muted hover:bg-surface'

function getSegmentClassName(isActive: boolean): string {
  return `${SEGMENT_BASE_CLASS_NAME} ${isActive ? SEGMENT_ACTIVE_CLASS_NAME : SEGMENT_INACTIVE_CLASS_NAME}`
}

interface CalendarViewOptionButtonProps {
  readonly view: CalendarView
  readonly isActive: boolean
  readonly onSelect: (view: CalendarView) => void
}

/** One Month/Week/Day segment. Owns the `view`-currying so the map below
 * stays a single-element callback with no inline handler logic. */
const CalendarViewOptionButton: FC<CalendarViewOptionButtonProps> = ({
  view,
  isActive,
  onSelect,
}) => {
  const handleClick = (): void => {
    onSelect(view)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={getSegmentClassName(isActive)}
      aria-pressed={isActive}
    >
      {CALENDAR_VIEW_CONFIG[view].label}
    </button>
  )
}

/**
 * The custom toolbar mounted in place of FullCalendar's own
 * (`headerToolbar: false`, design.md D6): prev/next chevrons and Today on
 * the left, the period title centred, and a Month/Week/Day segmented
 * control on the right with the active view indicated
 * (specs/event-calendar/spec.md — "Three calendar views"). Every action is
 * a plain callback — `EventCalendar` owns the `getApi()` calls this drives.
 */
export const CalendarToolbar: FC<CalendarToolbarProps> = ({
  activeView,
  title,
  onPrev,
  onNext,
  onToday,
  onChangeView,
}) => {
  return (
    <div className="flex items-center justify-between gap-md">
      <div className="flex items-center gap-sm">
        <button
          type="button"
          onClick={onPrev}
          className={NAV_BUTTON_CLASS_NAME}
          aria-label="Previous period"
        >
          <span aria-hidden="true">‹</span>
        </button>
        <button
          type="button"
          onClick={onNext}
          className={NAV_BUTTON_CLASS_NAME}
          aria-label="Next period"
        >
          <span aria-hidden="true">›</span>
        </button>
        <button type="button" onClick={onToday} className={TODAY_BUTTON_CLASS_NAME}>
          Today
        </button>
      </div>

      <h2 className="text-lg font-semibold text-text">{title}</h2>

      <div
        role="group"
        aria-label="Calendar view"
        className="flex items-center gap-xs rounded-lg border border-border bg-surface-muted p-xs"
      >
        {CALENDAR_VIEW_ORDER.map((view) => (
          <CalendarViewOptionButton
            key={view}
            view={view}
            isActive={view === activeView}
            onSelect={onChangeView}
          />
        ))}
      </div>
    </div>
  )
}
