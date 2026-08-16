import type React from 'react';
import { EventCalendar } from '../../../features/event-calendar';
import { EventDialog } from '../../../features/event-dialog';

/**
 * The calendar screen. The period title and event count live in the
 * calendar's own header (assets/ui_kit/Calendar), so this page contributes
 * no heading of its own — it gives the calendar the full height of the shell
 * and mounts the dialog the calendar opens.
 */
export const EventsPage: React.FC = () => {
  return (
    <div className='h-full'>
      <EventCalendar />
      <EventDialog />
    </div>
  );
};
