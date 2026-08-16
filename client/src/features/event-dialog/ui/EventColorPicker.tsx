import type { FC } from 'react'
import type { UseFormRegister } from 'react-hook-form'
import { EVENT_COLOR_OPTIONS } from '../config/event-colors'
import type { EventDialogFormValues } from '../lib/event-dialog-schema'

interface EventColorPickerProps {
  readonly register: UseFormRegister<EventDialogFormValues>
  readonly errorMessage?: string
}

const SWATCH_CLASS_NAME = [
  'block h-8 w-8 cursor-pointer rounded-full',
  'ring-offset-2 ring-offset-surface transition-shadow',
  'peer-checked:ring-2 peer-checked:ring-text',
  'peer-focus-visible:ring-2 peer-focus-visible:ring-primary-500',
  'peer-disabled:cursor-not-allowed peer-disabled:opacity-60',
].join(' ')

/**
 * The Event dialog's color panel: one native radio per palette entry
 * (`config/event-colors.ts`), rendered as a swatch. Radios rather than
 * buttons so the group gets roving arrow-key navigation, a single tab stop,
 * and the checked state for free from the platform — and so plain
 * `register('color')` both drives the selection and marks the form dirty,
 * with no mirrored state to keep in sync.
 *
 * Each swatch's own color can only come from an inline `style`: the values
 * are data from the palette table, so Tailwind has no class to generate for
 * them at build time.
 */
export const EventColorPicker: FC<EventColorPickerProps> = ({ register, errorMessage }) => {
  return (
    <div className="flex flex-col gap-xs">
      <span className="text-sm font-medium text-text">Color</span>

      <div className="flex flex-wrap items-center gap-sm">
        {EVENT_COLOR_OPTIONS.map((option) => (
          <label key={option.value} className="inline-flex">
            <input
              type="radio"
              value={option.value}
              className="peer sr-only"
              {...register('color')}
            />
            <span className="sr-only">{option.label}</span>
            <span
              aria-hidden="true"
              style={{ backgroundColor: option.value }}
              className={SWATCH_CLASS_NAME}
            />
          </label>
        ))}
      </div>

      {errorMessage && <p className="text-sm text-danger">{errorMessage}</p>}
    </div>
  )
}
