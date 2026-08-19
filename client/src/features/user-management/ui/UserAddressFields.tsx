import type { FC } from 'react'
import type { FieldErrors, UseFormRegister } from 'react-hook-form'
import { Input } from '../../../shared/ui'
import { USER_FORM_COPY } from '../config/user-form-copy'
import type { UserFormValues } from '../lib/user-form/user-form-schema'

export interface UserAddressFieldsProps {
  readonly register: UseFormRegister<UserFormValues>
  readonly errors: FieldErrors<UserFormValues>
  readonly isDisabled: boolean
}

/**
 * The four flat address members — `addressCountry`/`addressCity`/
 * `addressStreet`/`addressPostalCode`, not a nested `address` object
 * (design.md D4), so each one's error stays independently associated via
 * `create-zod-resolver.ts`'s flat, dotted-path-joined `FieldErrors` keys.
 * All four are optional (specs/user-management/spec.md — "Address fields
 * SHALL be optional").
 */
export const UserAddressFields: FC<UserAddressFieldsProps> = ({ register, errors, isDisabled }) => (
  <fieldset disabled={isDisabled} className='flex flex-col gap-lg'>
    <legend className='text-label text-ink'>Address</legend>

    <div className='flex flex-wrap gap-md'>
      <Input
        id='edit-user-address-country'
        label={USER_FORM_COPY.addressCountryLabel}
        className='min-w-40 flex-1'
        error={errors.addressCountry?.message}
        {...register('addressCountry')}
      />

      <Input
        id='edit-user-address-city'
        label={USER_FORM_COPY.addressCityLabel}
        className='min-w-40 flex-1'
        error={errors.addressCity?.message}
        {...register('addressCity')}
      />
    </div>

    <div className='flex flex-wrap gap-md'>
      <Input
        id='edit-user-address-street'
        label={USER_FORM_COPY.addressStreetLabel}
        className='min-w-56 flex-1'
        error={errors.addressStreet?.message}
        {...register('addressStreet')}
      />

      <Input
        id='edit-user-address-postal-code'
        label={USER_FORM_COPY.addressPostalCodeLabel}
        className='min-w-32 flex-1'
        error={errors.addressPostalCode?.message}
        {...register('addressPostalCode')}
      />
    </div>
  </fieldset>
)
