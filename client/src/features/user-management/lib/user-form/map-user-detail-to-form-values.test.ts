import { describe, expect, it } from 'vitest'
import type { UserDetailDto } from '../../model/user-dto'
import { mapUserDetailToFormValues } from './map-user-detail-to-form-values'

const BASE_DETAIL: UserDetailDto = {
  id: 'user-1',
  firstName: 'Anna',
  lastName: 'Smith',
  email: 'anna@example.com',
  phone: null,
  address: null,
  status: 'active',
  lastLoginAt: null,
  phoneExtension: null,
  archivedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  version: 3,
}

describe('mapUserDetailToFormValues', () => {
  it('maps a fully-populated detail straight through', () => {
    const detail: UserDetailDto = {
      ...BASE_DETAIL,
      phone: '+380501234567',
      phoneExtension: '204',
      address: { country: 'UA', city: 'Kyiv', street: 'Sichovykh Striltsiv St', postalCode: '01001' },
      status: 'blocked',
    }

    expect(mapUserDetailToFormValues(detail)).toEqual({
      firstName: 'Anna',
      lastName: 'Smith',
      email: 'anna@example.com',
      phone: '+380501234567',
      phoneExtension: '204',
      addressCountry: 'UA',
      addressCity: 'Kyiv',
      addressStreet: 'Sichovykh Striltsiv St',
      addressPostalCode: '01001',
      status: 'blocked',
    })
  })

  it('maps a null phone, extension, and address to empty strings', () => {
    expect(mapUserDetailToFormValues(BASE_DETAIL)).toEqual({
      firstName: 'Anna',
      lastName: 'Smith',
      email: 'anna@example.com',
      phone: '',
      phoneExtension: '',
      addressCountry: '',
      addressCity: '',
      addressStreet: '',
      addressPostalCode: '',
      status: 'active',
    })
  })

  it('maps a partially-populated address, leaving absent members as empty strings', () => {
    const detail: UserDetailDto = {
      ...BASE_DETAIL,
      address: { country: null, city: 'Kyiv', street: null, postalCode: null },
    }

    const formValues = mapUserDetailToFormValues(detail)

    expect(formValues.addressCity).toBe('Kyiv')
    expect(formValues.addressCountry).toBe('')
    expect(formValues.addressStreet).toBe('')
    expect(formValues.addressPostalCode).toBe('')
  })
})
