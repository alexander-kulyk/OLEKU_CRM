import { describe, expect, it } from 'vitest'
import type { NormalizedUserFormValues } from './normalize-user-form-values'
import { diffNormalizedUserFormValues, isUserFormNormalizedDirty } from './diff-user-form-fields'

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

describe('diffNormalizedUserFormValues / isUserFormNormalizedDirty', () => {
  it('reports no diff for two identical normalized snapshots (normalized equality)', () => {
    const current: NormalizedUserFormValues = { ...ORIGINAL }

    expect(diffNormalizedUserFormValues(current, ORIGINAL)).toBeNull()
    expect(isUserFormNormalizedDirty(current, ORIGINAL)).toBe(false)
  })

  it('reports a single changed field individually, omitting every unchanged field', () => {
    const current: NormalizedUserFormValues = { ...ORIGINAL, firstName: 'Hanna' }

    expect(diffNormalizedUserFormValues(current, ORIGINAL)).toEqual({ firstName: 'Hanna' })
    expect(isUserFormNormalizedDirty(current, ORIGINAL)).toBe(true)
  })

  it('reports a per-field clear of phone as null', () => {
    const current: NormalizedUserFormValues = { ...ORIGINAL, phone: null }

    expect(diffNormalizedUserFormValues(current, ORIGINAL)).toEqual({ phone: null })
  })

  it('reports a per-field clear of the phone extension as null', () => {
    const current: NormalizedUserFormValues = { ...ORIGINAL, phoneExtension: null }

    expect(diffNormalizedUserFormValues(current, ORIGINAL)).toEqual({ phoneExtension: null })
  })

  it('reports a status change', () => {
    const current: NormalizedUserFormValues = { ...ORIGINAL, status: 'blocked' }

    expect(diffNormalizedUserFormValues(current, ORIGINAL)).toEqual({ status: 'blocked' })
  })

  it('never includes an immutable/read-only member — only mutable field keys can ever appear', () => {
    const current: NormalizedUserFormValues = { ...ORIGINAL, firstName: 'Hanna', status: 'inactive' }

    const patch = diffNormalizedUserFormValues(current, ORIGINAL)

    expect(Object.keys(patch ?? {})).toEqual(
      expect.arrayContaining(['firstName', 'status']),
    )
    expect(patch).not.toHaveProperty('id')
    expect(patch).not.toHaveProperty('createdAt')
    expect(patch).not.toHaveProperty('updatedAt')
    expect(patch).not.toHaveProperty('archivedAt')
    expect(patch).not.toHaveProperty('version')
  })

  describe('address diffing', () => {
    it('omits the address member entirely when no address property changed', () => {
      const current: NormalizedUserFormValues = { ...ORIGINAL, firstName: 'Hanna' }

      const patch = diffNormalizedUserFormValues(current, ORIGINAL)

      expect(patch).not.toHaveProperty('address')
    })

    it('sends only the changed address property, preserving the other members (one address member is cleared)', () => {
      const current: NormalizedUserFormValues = { ...ORIGINAL, addressPostalCode: null }

      expect(diffNormalizedUserFormValues(current, ORIGINAL)).toEqual({
        address: { postalCode: null },
      })
    })

    it('sends only the changed address property when it takes a new non-null value', () => {
      const current: NormalizedUserFormValues = { ...ORIGINAL, addressCity: 'Lviv' }

      expect(diffNormalizedUserFormValues(current, ORIGINAL)).toEqual({
        address: { city: 'Lviv' },
      })
    })

    it('sends address: null when every previously-populated address property is cleared (full removal)', () => {
      const current: NormalizedUserFormValues = {
        ...ORIGINAL,
        addressCountry: null,
        addressCity: null,
        addressStreet: null,
        addressPostalCode: null,
      }

      expect(diffNormalizedUserFormValues(current, ORIGINAL)).toEqual({ address: null })
    })

    it('sends a partial address object when the address goes from absent to partially populated', () => {
      const originalWithNoAddress: NormalizedUserFormValues = {
        ...ORIGINAL,
        addressCountry: null,
        addressCity: null,
        addressStreet: null,
        addressPostalCode: null,
      }
      const current: NormalizedUserFormValues = { ...originalWithNoAddress, addressCity: 'Kyiv' }

      expect(diffNormalizedUserFormValues(current, originalWithNoAddress)).toEqual({
        address: { city: 'Kyiv' },
      })
    })

    it('is a no-op when the address was already fully empty and remains fully empty', () => {
      const originalWithNoAddress: NormalizedUserFormValues = {
        ...ORIGINAL,
        addressCountry: null,
        addressCity: null,
        addressStreet: null,
        addressPostalCode: null,
      }

      expect(diffNormalizedUserFormValues(originalWithNoAddress, originalWithNoAddress)).toBeNull()
    })
  })
})
