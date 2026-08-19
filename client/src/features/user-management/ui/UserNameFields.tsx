import type { FC } from 'react'
import type { FieldErrors, UseFormRegister } from 'react-hook-form'
import { Input } from '../../../shared/ui'
import { USER_FORM_COPY } from '../config/user-form-copy'
import type { UserFormValues } from '../lib/user-form/user-form-schema'

export interface UserNameFieldsProps {
  readonly register: UseFormRegister<UserFormValues>
  readonly errors: FieldErrors<UserFormValues>
  readonly isDisabled: boolean
}

/**
 * First/last name — required, Unicode-capable text (`createUserFormSchema`
 * `nameField`; specs/user-management/spec.md — "Edit form exposes and
 * validates the supported fields").
 */
export const UserNameFields: FC<UserNameFieldsProps> = ({ register, errors, isDisabled }) => (
  <div className='flex flex-wrap gap-md'>
    <Input
      id='edit-user-first-name'
      label={USER_FORM_COPY.firstNameLabel}
      required
      disabled={isDisabled}
      className='min-w-48 flex-1'
      error={errors.firstName?.message}
      {...register('firstName')}
    />

    <Input
      id='edit-user-last-name'
      label={USER_FORM_COPY.lastNameLabel}
      required
      disabled={isDisabled}
      className='min-w-48 flex-1'
      error={errors.lastName?.message}
      {...register('lastName')}
    />
  </div>
)
