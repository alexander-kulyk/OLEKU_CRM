import type React from 'react'
import type { DayHeaderContentArg } from '@fullcalendar/core'
import { classNames } from '../../../shared/lib'
import { CALENDAR_VIEW_CONFIG } from '../lib/calendar-view-config'

interface ICalendarDayHeaderContentProps {
  readonly arg: DayHeaderContentArg
}

const WEEKDAY_FORMATTER = new Intl.DateTimeFormat(undefined, { weekday: 'short' })

const WEEKDAY_CLASS_NAME = 'text-eyebrow uppercase text-ink-muted'
const DATE_CLASS_NAME = 'text-body font-semibold'

/**
 * The weekday cell above each column (assets/ui_kit/Calendar): an uppercase
 * eyebrow weekday, and — in the week and day grids, where a column means one
 * specific date — the date beside it, in the accent when it is today.
 *
 * The month grid omits the date: its cells already carry their own day
 * numbers, and today is marked there by the filled pill in
 * `calendar-theme.css` instead.
 */
export const CalendarDayHeaderContent: React.FC<ICalendarDayHeaderContentProps> = ({
  arg,
}) => {
  const weekday = WEEKDAY_FORMATTER.format(arg.date)
  const isMonthView = arg.view.type === CALENDAR_VIEW_CONFIG.month.fullCalendarViewName

  if (isMonthView) {
    return <span className={WEEKDAY_CLASS_NAME}>{weekday}</span>
  }

  return (
    <span className='flex items-baseline gap-sm'>
      <span className={WEEKDAY_CLASS_NAME}>{weekday}</span>
      <span className={classNames(DATE_CLASS_NAME, arg.isToday ? 'text-accent' : 'text-ink')}>
        {arg.date.getDate()}
      </span>
    </span>
  )
}
