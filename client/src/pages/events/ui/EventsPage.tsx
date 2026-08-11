import type { FC } from 'react';
import { EventCalendar } from '../../../features/event-calendar';
import { EventDialog } from '../../../features/event-dialog';

export const EventsPage: FC = () => {
  return (
    <div className='flex h-full flex-col gap-md'>
      <h1 className='text-2xl font-semibold text-text'>Calendar</h1>
      <EventCalendar />
      <EventDialog />
    </div>
  );
};
