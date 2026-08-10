import { useCallback, useMemo, useRef, useState } from 'react'
import type { FC } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import type { DatesSetArg, DateSelectArg, EventClickArg } from '@fullcalendar/core'
import type { DateClickArg } from '@fullcalendar/interaction'
import { useEventStore } from '../../../shared/model'
import type { CalendarView } from '../../../shared/model'
import {
  CALENDAR_VIEW_CONFIG,
  getCalendarViewFromFullCalendarViewType,
} from '../lib/calendar-view-config'
import { mapEventRecordsToCalendarEvents } from '../lib/map-events'
import { CalendarToolbar } from './CalendarToolbar'
import { CalendarStatusOverlay } from './CalendarStatusOverlay'

/**
 * The calendar surface (specs/event-calendar/spec.md; design.md D6).
 * FullCalendar is mounted uncontrolled — `headerToolbar: false`, and the
 * custom `CalendarToolbar` below drives it imperatively through
 * `calendarRef.current.getApi()`. `datesSet` is the single trigger that
 * reads events for the actually-rendered period and folds the resulting
 * view/focused date back into the store; the calendar's own date/view
 * cursor is never mirrored into a controlled prop pushed back down (that
 * would risk a render loop, since every programmatic change re-fires
 * `datesSet`).
 */
export const EventCalendar: FC = () => {
  const calendarRef = useRef<FullCalendar>(null)
  const [periodTitle, setPeriodTitle] = useState('')

  const activeView = useEventStore((state) => state.activeView)
  const events = useEventStore((state) => state.events)
  const status = useEventStore((state) => state.status)
  const error = useEventStore((state) => state.error)
  const setActiveView = useEventStore((state) => state.setActiveView)
  const setFocusedDate = useEventStore((state) => state.setFocusedDate)
  const openCreateDialog = useEventStore((state) => state.openCreateDialog)
  const openEditDialog = useEventStore((state) => state.openEditDialog)
  const readPeriod = useEventStore((state) => state.readPeriod)
  const refreshActivePeriod = useEventStore((state) => state.refreshActivePeriod)

  const calendarEvents = useMemo(
    () => mapEventRecordsToCalendarEvents(events),
    [events],
  )

  const handlePrev = useCallback(() => {
    calendarRef.current?.getApi().prev()
  }, [])

  const handleNext = useCallback(() => {
    calendarRef.current?.getApi().next()
  }, [])

  const handleToday = useCallback(() => {
    calendarRef.current?.getApi().today()
  }, [])

  const handleChangeView = useCallback((view: CalendarView) => {
    const api = calendarRef.current?.getApi()

    if (!api) {
      return
    }

    // Pass the calendar's own current date through so the new view opens
    // on the period containing it, not today's (specs/event-calendar/spec.md
    // — "Focused date survives a view change").
    api.changeView(CALENDAR_VIEW_CONFIG[view].fullCalendarViewName, api.getDate())
  }, [])

  const handleDatesSet = useCallback(
    (arg: DatesSetArg) => {
      // The feedback loop (design.md D6): fold FullCalendar's own
      // post-change state back into the store, after the fact.
      setPeriodTitle(arg.view.title)
      setActiveView(getCalendarViewFromFullCalendarViewType(arg.view.type))
      setFocusedDate(arg.view.calendar.getDate())

      // The single read trigger (design.md D3): startStr/endStr pass
      // through unmodified as from/to — nothing else is derived or added.
      void readPeriod({ from: arg.startStr, to: arg.endStr })
    },
    [readPeriod, setActiveView, setFocusedDate],
  )

  const handleDateClick = useCallback(
    (arg: DateClickArg) => {
      openCreateDialog(
        arg.allDay ? { date: arg.date } : { date: arg.date, startTime: arg.date },
      )
    },
    [openCreateDialog],
  )

  const handleDateSelect = useCallback(
    (arg: DateSelectArg) => {
      openCreateDialog(
        arg.allDay ? { date: arg.start } : { date: arg.start, startTime: arg.start },
      )
      // Clear the drag/click highlight now that the dialog has the
      // selection — the calendar doesn't keep its own selected-range state.
      arg.view.calendar.unselect()
    },
    [openCreateDialog],
  )

  const handleEventClick = useCallback(
    (arg: EventClickArg) => {
      openEditDialog(arg.event.id)
    },
    [openEditDialog],
  )

  return (
    <div className="flex flex-col gap-md">
      <CalendarToolbar
        activeView={activeView}
        title={periodTitle}
        onPrev={handlePrev}
        onNext={handleNext}
        onToday={handleToday}
        onChangeView={handleChangeView}
      />

      <div className="relative rounded-lg border border-border bg-surface p-md">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView={CALENDAR_VIEW_CONFIG.month.fullCalendarViewName}
          headerToolbar={false}
          selectable
          events={calendarEvents}
          datesSet={handleDatesSet}
          dateClick={handleDateClick}
          select={handleDateSelect}
          eventClick={handleEventClick}
        />

        <CalendarStatusOverlay status={status} error={error} onRetry={refreshActivePeriod} />
      </div>
    </div>
  )
}
