import type { FC } from 'react'
import { Controller } from 'react-hook-form'
import type { Control } from 'react-hook-form'
import { SegmentedControl } from '../../../shared/ui'
import { USER_FORM_COPY } from '../config/user-form-copy'
import { USER_STATUS_FIELD_OPTIONS } from '../config/user-status-field-options'
import type { UserFormValues } from '../lib/user-form/user-form-schema'

export interface UserStatusFieldProps {
  readonly control: Control<UserFormValues>
  readonly isDisabled: boolean
}

/**
 * The Status field, matching the kit's segmented-control presentation
 * (assets/ui_kit/Users/editUserModal.png). `SegmentedControl` is a
 * controlled component (`value`/`onChange`), so it is wired through
 * react-hook-form's `Controller` rather than `register` — the same
 * boundary `event-dialog`'s participant assignment crosses with `setValue`,
 * chosen here as `Controller` because `SegmentedControl` already exposes
 * the exact controlled `value`/`onChange` shape `Controller` expects.
 *
 * `SegmentedControl` has no `disabled` prop of its own; its segments are
 * native `<button>`s, so a plain `<fieldset disabled>` wrapper — not a
 * pointer-events/opacity hack — is what actually removes them from the
 * tab order and blocks activation while `isDisabled` is true.
 */
export const UserStatusField: FC<UserStatusFieldProps> = ({ control, isDisabled }) => (
  <Controller
    control={control}
    name='status'
    render={({ field }) => (
      <fieldset disabled={isDisabled} className='flex flex-col gap-xs'>
        <legend className='text-label text-ink'>{USER_FORM_COPY.statusLabel}</legend>
        <SegmentedControl
          label={USER_FORM_COPY.statusLabel}
          options={USER_STATUS_FIELD_OPTIONS}
          value={field.value}
          onChange={field.onChange}
        />
      </fieldset>
    )}
  />
)
