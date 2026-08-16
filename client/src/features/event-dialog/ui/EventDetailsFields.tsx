import type { FC } from 'react'
import type { FieldErrors, UseFormRegister } from 'react-hook-form'
import type { EventDialogFormValues } from '../lib/event-dialog-schema'
import { EventColorPicker } from './EventColorPicker'

interface EventDetailsFieldsProps {
  readonly register: UseFormRegister<EventDialogFormValues>
  readonly errors: FieldErrors<EventDialogFormValues>
  readonly isDisabled: boolean
}

const LABEL_CLASS_NAME = 'text-sm font-medium text-text'
const INPUT_CLASS_NAME =
  'rounded-md border border-border bg-surface px-md py-sm text-sm text-text disabled:cursor-not-allowed disabled:opacity-60'
const ERROR_CLASS_NAME = 'text-sm text-danger'

/**
 * The event details section (specs/event-management/spec.md — "Event
 * detail fields"): name, date, start time, end time, all required, plus the
 * event's color. Native `<input type="date">` / `<input type="time">` per
 * design.md D5/D7 — no date-picker library. Each field's message renders
 * next to it, driven by `errors` from the form's zod resolver.
 */
export const EventDetailsFields: FC<EventDetailsFieldsProps> = ({
  register,
  errors,
  isDisabled,
}) => {
  return (
    <fieldset disabled={isDisabled} className="flex flex-col gap-md">
      <legend className="text-sm font-semibold text-text">Event details</legend>

      <div className="flex flex-col gap-xs">
        <label htmlFor="event-dialog-name" className={LABEL_CLASS_NAME}>
          Event name
        </label>
        <input
          id="event-dialog-name"
          type="text"
          required
          aria-required="true"
          aria-invalid={errors.name ? true : undefined}
          className={INPUT_CLASS_NAME}
          {...register('name')}
        />
        {errors.name && <p className={ERROR_CLASS_NAME}>{errors.name.message}</p>}
      </div>

      <div className="flex flex-col gap-xs">
        <label htmlFor="event-dialog-date" className={LABEL_CLASS_NAME}>
          Date
        </label>
        <input
          id="event-dialog-date"
          type="date"
          required
          aria-required="true"
          aria-invalid={errors.date ? true : undefined}
          className={INPUT_CLASS_NAME}
          {...register('date')}
        />
        {errors.date && <p className={ERROR_CLASS_NAME}>{errors.date.message}</p>}
      </div>

      <div className="flex gap-md">
        <div className="flex flex-1 flex-col gap-xs">
          <label htmlFor="event-dialog-start-time" className={LABEL_CLASS_NAME}>
            Start time
          </label>
          <input
            id="event-dialog-start-time"
            type="time"
            required
            aria-required="true"
            aria-invalid={errors.startTime ? true : undefined}
            className={INPUT_CLASS_NAME}
            {...register('startTime')}
          />
          {errors.startTime && <p className={ERROR_CLASS_NAME}>{errors.startTime.message}</p>}
        </div>

        <div className="flex flex-1 flex-col gap-xs">
          <label htmlFor="event-dialog-end-time" className={LABEL_CLASS_NAME}>
            End time
          </label>
          <input
            id="event-dialog-end-time"
            type="time"
            required
            aria-required="true"
            aria-invalid={errors.endTime ? true : undefined}
            className={INPUT_CLASS_NAME}
            {...register('endTime')}
          />
          {errors.endTime && <p className={ERROR_CLASS_NAME}>{errors.endTime.message}</p>}
        </div>
      </div>

      <EventColorPicker register={register} errorMessage={errors.color?.message} />
    </fieldset>
  )
}
