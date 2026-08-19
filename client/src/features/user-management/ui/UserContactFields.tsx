import type { FC } from 'react'
import type { FieldErrors, UseFormRegister } from 'react-hook-form'
import { Input } from '../../../shared/ui'
import { USER_FORM_COPY } from '../config/user-form-copy'
import type { UserFormValues } from '../lib/user-form/user-form-schema'

export interface UserContactFieldsProps {
  readonly register: UseFormRegister<UserFormValues>
  readonly errors: FieldErrors<UserFormValues>
  readonly isDisabled: boolean
  /** Drives the phone field's hint — never used to infer a region (design.md D6). */
  readonly defaultPhoneRegion: string | undefined
}

/**
 * Email (required) plus the optional Phone/Phone extension pair
 * (specs/user-management/spec.md — "Edit form exposes and validates the
 * supported fields"). The phone hint reflects whether a deployment-wide
 * default phone region was supplied, without ever substituting a
 * browser-derived region when it was not (design.md D6; run prompt phone-
 * region guidance).
 */
export const UserContactFields: FC<UserContactFieldsProps> = ({
  register,
  errors,
  isDisabled,
  defaultPhoneRegion,
}) => {
  const phoneHint =
    defaultPhoneRegion === undefined ? USER_FORM_COPY.phoneHintWithoutRegion : USER_FORM_COPY.phoneHintWithRegion

  return (
    <div className='flex flex-col gap-lg'>
      <Input
        id='edit-user-email'
        type='email'
        label={USER_FORM_COPY.emailLabel}
        required
        disabled={isDisabled}
        error={errors.email?.message}
        {...register('email')}
      />

      <div className='flex flex-wrap gap-md'>
        <Input
          id='edit-user-phone'
          type='tel'
          label={USER_FORM_COPY.phoneLabel}
          hint={phoneHint}
          disabled={isDisabled}
          className='min-w-56 flex-1'
          error={errors.phone?.message}
          {...register('phone')}
        />

        <Input
          id='edit-user-phone-extension'
          label={USER_FORM_COPY.phoneExtensionLabel}
          disabled={isDisabled}
          className='min-w-32 flex-1'
          error={errors.phoneExtension?.message}
          {...register('phoneExtension')}
        />
      </div>
    </div>
  )
}
