import type React from 'react'
import type { EventContentArg } from '@fullcalendar/core'
import { resolveEventColorTokens } from '../../../shared/config'
import { CALENDAR_VIEW_CONFIG } from '../lib/calendar-view-config'
import { readCalendarEventPresentation } from '../lib/map-events'

interface ICalendarEventContentProps {
  readonly arg: EventContentArg
}

interface ICalendarEventStyle {
  readonly backgroundColor: string
  readonly borderColor: string
  readonly color: string
}

interface ICalendarEventBlockProps {
  readonly style: ICalendarEventStyle
  readonly title: string
  readonly timeText: string
  readonly hostNames: string
}

const BLOCK_CLASS_NAME = [
  'flex h-full w-full flex-col overflow-hidden rounded-sm border-l-[3px]',
  'px-sm py-xs text-label leading-snug',
].join(' ')

/**
 * A timed event in the week and day grids: a tinted body with a saturated
 * rail down the leading edge, the title, its time range, and — when the
 * event has any — its hosts (assets/ui_kit/Calendar/week.png).
 */
const CalendarEventBlock: React.FC<ICalendarEventBlockProps> = ({
  style,
  title,
  timeText,
  hostNames,
}) => (
  <div className={BLOCK_CLASS_NAME} style={style}>
    <span className='truncate font-semibold'>{title}</span>
    {timeText && <span className='truncate font-normal opacity-80'>{timeText}</span>}
    {hostNames && <span className='truncate font-normal opacity-70'>{hostNames}</span>}
  </div>
)

interface ICalendarEventPillProps {
  readonly style: ICalendarEventStyle
  readonly title: string
}

const PILL_CLASS_NAME =
  'flex w-full items-center gap-sm overflow-hidden rounded-sm px-sm py-[3px] text-label'

/**
 * The same event in the month grid, where there is only room for one line:
 * a dot in the saturated color and the title on the tint
 * (assets/ui_kit/Calendar/month.png).
 */
const CalendarEventPill: React.FC<ICalendarEventPillProps> = ({ style, title }) => (
  <div
    className={PILL_CLASS_NAME}
    style={{ backgroundColor: style.backgroundColor, color: style.color }}
  >
    <span
      aria-hidden='true'
      className='size-[6px] shrink-0 rounded-full'
      style={{ backgroundColor: style.borderColor }}
    />
    <span className='truncate'>{title}</span>
  </div>
)

/**
 * FullCalendar's `eventContent` renderer — the only thing that paints an
 * event. FullCalendar's own event chrome is stripped in `calendar-theme.css`
 * so these two shapes are what actually shows.
 *
 * Every color is an inline `style`: they are derived per event from a value
 * the API stores, so there is no class for Tailwind to generate at build
 * time.
 */
export const CalendarEventContent: React.FC<ICalendarEventContentProps> = ({ arg }) => {
  const { color, hostNames } = readCalendarEventPresentation(arg.event.extendedProps)
  const tokens = resolveEventColorTokens(color)

  const style: ICalendarEventStyle = {
    backgroundColor: tokens.tint,
    borderColor: tokens.base,
    color: tokens.ink,
  }

  const isMonthView = arg.view.type === CALENDAR_VIEW_CONFIG.month.fullCalendarViewName

  if (isMonthView) {
    return <CalendarEventPill style={style} title={arg.event.title} />
  }

  return (
    <CalendarEventBlock
      style={style}
      title={arg.event.title}
      timeText={arg.timeText}
      hostNames={hostNames}
    />
  )
}
