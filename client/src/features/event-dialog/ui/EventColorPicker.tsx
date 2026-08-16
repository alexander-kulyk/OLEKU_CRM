import type React from 'react'
import type { UseFormRegister } from 'react-hook-form'
import { AlertCircleSVG } from '../../../../assets'
import { EVENT_COLOR_OPTIONS } from '../../../shared/config'
import type { EventDialogFormValues } from '../lib/event-dialog-schema'

interface IEventColorPickerProps {
  readonly register: UseFormRegister<EventDialogFormValues>
  readonly errorMessage?: string
}

const SWATCH_CLASS_NAME = [
  'block size-7 cursor-pointer rounded-sm transition-shadow',
  'ring-offset-2 ring-offset-surface',
  'peer-checked:ring-2 peer-checked:ring-ink',
  'peer-focus-visible:ring-2 peer-focus-visible:ring-accent',
  'peer-disabled:cursor-not-allowed peer-disabled:opacity-60',
].join(' ')

/**
 * The Event dialog's color panel: one native radio per palette entry
 * (`shared/config/event-colors.ts`), rendered as a swatch. Radios rather than
 * buttons so the group gets roving arrow-key navigation, a single tab stop,
 * and the checked state for free from the platform — and so plain
 * `register('color')` both drives the selection and marks the form dirty,
 * with no mirrored state to keep in sync.
 *
 * Each swatch's own color can only come from an inline `style`: the values
 * are data from the palette table, so Tailwind has no class to generate for
 * them at build time.
 */
export const EventColorPicker: React.FC<IEventColorPickerProps> = ({
  register,
  errorMessage,
}) => {
  return (
    <div className='flex flex-col gap-sm'>
      <span className='text-label text-ink'>Color</span>

      <div className='flex flex-wrap items-center gap-md'>
        {EVENT_COLOR_OPTIONS.map((option) => (
          <label key={option.value} className='inline-flex'>
            <input
              type='radio'
              value={option.value}
              className='peer sr-only'
              {...register('color')}
            />
            <span className='sr-only'>{option.label}</span>
            <span
              aria-hidden='true'
              style={{ backgroundColor: option.value }}
              className={SWATCH_CLASS_NAME}
            />
          </label>
        ))}
      </div>

      {errorMessage && (
        <p className='flex items-center gap-xs text-label font-normal text-danger'>
          <AlertCircleSVG className='size-4 shrink-0' />
          {errorMessage}
        </p>
      )}
    </div>
  )
}
