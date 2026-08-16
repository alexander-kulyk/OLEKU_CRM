import { useMemo } from 'react'
import type React from 'react'
import { ChevronLeftSVG, ChevronRightSVG, PlusSVG } from '../../../../assets'
import type { CalendarView } from '../../../shared/model'
import { Button, IconButton, SegmentedControl } from '../../../shared/ui'
import type { ISegmentedControlOption } from '../../../shared/ui'
import { CALENDAR_VIEW_CONFIG, CALENDAR_VIEW_ORDER } from '../lib/calendar-view-config'

interface ICalendarToolbarProps {
  readonly activeView: CalendarView
  readonly title: string
  /** Events loaded for the period on screen — the header's subtitle. */
  readonly eventCount: number
  readonly onPrev: () => void
  readonly onNext: () => void
  readonly onToday: () => void
  readonly onChangeView: (view: CalendarView) => void
  readonly onCreate: () => void
}

const VIEW_OPTIONS: readonly ISegmentedControlOption<CalendarView>[] =
  CALENDAR_VIEW_ORDER.map((view) => ({
    value: view,
    label: CALENDAR_VIEW_CONFIG[view].label,
  }))

function getEventCountLabel(eventCount: number): string {
  return eventCount === 1 ? '1 event scheduled' : `${eventCount} events scheduled`
}

/**
 * The header mounted in place of FullCalendar's own (`headerToolbar: false`,
 * design.md D6), following assets/ui_kit/Calendar: the period title and its
 * event count on the left with the one primary action opposite it, then
 * period navigation and the Month/Week/Day switch on the row below.
 *
 * Every action is a plain callback — `EventCalendar` owns the `getApi()`
 * calls this drives.
 */
export const CalendarToolbar: React.FC<ICalendarToolbarProps> = ({
  activeView,
  title,
  eventCount,
  onPrev,
  onNext,
  onToday,
  onChangeView,
  onCreate,
}) => {
  const eventCountLabel = useMemo(() => getEventCountLabel(eventCount), [eventCount])

  return (
    <header className='flex flex-col gap-lg border-b border-line px-xl py-lg'>
      <div className='flex items-start justify-between gap-lg'>
        <div className='flex min-w-0 flex-col gap-xs'>
          <h1 className='truncate text-page-title text-ink'>{title}</h1>
          <p className='text-label font-normal text-ink-muted'>{eventCountLabel}</p>
        </div>

        <Button
          variant='primary'
          onClick={onCreate}
          leadingIcon={<PlusSVG className='size-4' />}
        >
          New event
        </Button>
      </div>

      <div className='flex flex-wrap items-center justify-between gap-md'>
        <div className='flex items-center gap-sm'>
          <div className='flex items-center'>
            <IconButton
              size='sm'
              label='Previous period'
              icon={<ChevronLeftSVG className='size-4' />}
              onClick={onPrev}
              className='rounded-r-none'
            />
            <IconButton
              size='sm'
              label='Next period'
              icon={<ChevronRightSVG className='size-4' />}
              onClick={onNext}
              className='-ml-px rounded-l-none'
            />
          </div>

          <Button size='sm' onClick={onToday}>
            Today
          </Button>
        </div>

        <SegmentedControl
          label='Calendar view'
          options={VIEW_OPTIONS}
          value={activeView}
          onChange={onChangeView}
        />
      </div>
    </header>
  )
}
