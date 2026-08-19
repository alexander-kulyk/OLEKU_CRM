import { describe, expect, it } from 'vitest'
import type { NormalizedUserFormValues } from './normalize-user-form-values'
import { buildUserPatch } from './build-user-patch'

const ORIGINAL: NormalizedUserFormValues = {
  firstName: 'Anna',
  lastName: 'Smith',
  email: 'anna@example.com',
  phone: '+380501234567',
  phoneExtension: '204',
  addressCountry: 'UA',
  addressCity: 'Kyiv',
  addressStreet: 'Sichovykh Striltsiv St',
  addressPostalCode: '01001',
  status: 'active',
}

describe('buildUserPatch', () => {
  it('returns null for a clean form — never a version-only patch (clean Save)', () => {
    const current: NormalizedUserFormValues = { ...ORIGINAL }

    expect(buildUserPatch(current, ORIGINAL, 7)).toBeNull()
  })

  it('includes the supplied version alongside the changed fields for a dirty form (version inclusion)', () => {
    const current: NormalizedUserFormValues = { ...ORIGINAL, lastName: 'Kovalenko' }

    expect(buildUserPatch(current, ORIGINAL, 7)).toEqual({ lastName: 'Kovalenko', version: 7 })
  })

  it('reflects the exact version passed in, not a hardcoded or incremented one', () => {
    const current: NormalizedUserFormValues = { ...ORIGINAL, status: 'inactive' }

    expect(buildUserPatch(current, ORIGINAL, 42)).toEqual({ status: 'inactive', version: 42 })
  })

  it('never attaches a version to a null (clean) patch', () => {
    const current: NormalizedUserFormValues = { ...ORIGINAL }

    const patch = buildUserPatch(current, ORIGINAL, 7)

    expect(patch).toBeNull()
  })
})
