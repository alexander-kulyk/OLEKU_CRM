import { z } from 'zod'
import type { DialogTarget } from '../../../shared/model'

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const TIME_PATTERN = /^\d{2}:\d{2}$/

function isValidCalendarDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) {
    return false
  }

  return !Number.isNaN(new Date(`${value}T00:00:00`).getTime())
}

/**
 * The Event dialog's detail-fields validation (specs/event-management/spec.md
 * — "Validation gates the primary action"): non-blank name (whitespace-only
 * rejected via `.trim().min(1)`), a valid date, valid start/end times, and
 * end strictly later than start. One schema is the single source for both
 * the field-level messages (via the resolver) and the primary action's
 * enabled/disabled state (re-run directly against the live form values).
 */
export const eventDialogFormSchema = z
  .object({
    name: z.string().trim().min(1, 'Event name is required.'),
    date: z
      .string()
      .min(1, 'Date is required.')
      .refine(isValidCalendarDate, 'Enter a valid date.'),
    startTime: z
      .string()
      .min(1, 'Start time is required.')
      .regex(TIME_PATTERN, 'Enter a valid start time.'),
    endTime: z
      .string()
      .min(1, 'End time is required.')
      .regex(TIME_PATTERN, 'Enter a valid end time.'),
  })
  .superRefine((values, context) => {
    const hasValidComponents =
      isValidCalendarDate(values.date) &&
      TIME_PATTERN.test(values.startTime) &&
      TIME_PATTERN.test(values.endTime)

    if (!hasValidComponents) {
      // Each field's own check above already reports its own message;
      // comparing start/end on top of an invalid value would be noise.
      return
    }

    const startsAt = new Date(`${values.date}T${values.startTime}`)
    const endsAt = new Date(`${values.date}T${values.endTime}`)

    if (endsAt.getTime() <= startsAt.getTime()) {
      context.addIssue({
        code: 'custom',
        path: ['endTime'],
        message: 'End time must be later than start time.',
      })
    }
  })

export type EventDialogFormValues = z.infer<typeof eventDialogFormSchema>

/** The two non-`closed` dialog targets the Event dialog form ever mounts for. */
export type OpenDialogTarget = Extract<DialogTarget, { type: 'create' } | { type: 'edit' }>
