import type React from 'react'
import type { FieldErrors, UseFormRegister } from 'react-hook-form'
import { DatePicker, Input, TimePicker } from '../../../shared/ui'
import type { EventDialogFormValues } from '../lib/event-dialog-schema'
import { EventColorPicker } from './EventColorPicker'

interface IEventDetailsFieldsProps {
  readonly register: UseFormRegister<EventDialogFormValues>
  readonly errors: FieldErrors<EventDialogFormValues>
  readonly isDisabled: boolean
}

const NAME_HINT = 'Shown to attendees in the portal.'

/**
 * The event details section (specs/event-management/spec.md — "Event
 * detail fields"): name, date, start time, end time, all required, plus the
 * event's color.
 *
 * Every control is a `shared/ui` primitive, so the label, hint, invalid
 * treatment and 38px control height come from the design system rather than
 * from class strings repeated per field. The date and time controls are
 * still native inputs underneath (design.md D5/D7 — no date-picker
 * library); `DatePicker`/`TimePicker` only supply the shell around them, and
 * `register` passes straight through to the input, `ref` included.
 */
export const EventDetailsFields: React.FC<IEventDetailsFieldsProps> = ({
  register,
  errors,
  isDisabled,
}) => {
  return (
    <fieldset disabled={isDisabled} className='flex min-w-0 flex-col gap-lg'>
      <legend className='sr-only'>Event details</legend>

      <Input
        id='event-dialog-name'
        label='Event name'
        hint={NAME_HINT}
        placeholder='Mathematics lesson'
        required
        error={errors.name?.message}
        {...register('name')}
      />

      <DatePicker
        id='event-dialog-date'
        label='Date'
        required
        error={errors.date?.message}
        {...register('date')}
      />

      <div className='flex flex-wrap gap-md'>
        <TimePicker
          id='event-dialog-start-time'
          label='Start time'
          required
          className='min-w-[10rem] flex-1'
          error={errors.startTime?.message}
          {...register('startTime')}
        />

        <TimePicker
          id='event-dialog-end-time'
          label='End time'
          required
          className='min-w-[10rem] flex-1'
          error={errors.endTime?.message}
          {...register('endTime')}
        />
      </div>

      <EventColorPicker register={register} errorMessage={errors.color?.message} />
    </fieldset>
  )
}
