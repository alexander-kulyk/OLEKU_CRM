import { describe, expect, it } from 'vitest'
import type { UserFormValues } from './user-form-schema'
import { normalizeUserFormValues } from './normalize-user-form-values'

const BASE_VALUES: UserFormValues = {
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
}

const UA_REGION = 'UA'

// The precomposed NFC codepoint for "e with acute accent" (U+00E9), and the
// same visual character built from the decomposed NFD sequence "e" +
// combining acute accent (U+0065 U+0301) — a different string until
// normalized. Built from explicit escapes rather than typed literally,
// since a source file's own "e-acute" is saved pre-composed and would
// make an NFC-normalization assertion vacuously true.
const PRECOMPOSED_E_ACUTE = 'é'
const DECOMPOSED_E_ACUTE = 'é'

describe('normalizeUserFormValues', () => {
  it('trims surrounding whitespace on required text fields', () => {
    const normalized = normalizeUserFormValues(
      { ...BASE_VALUES, firstName: '  Anna  ', email: '  anna@example.com  ' },
      UA_REGION,
    )

    expect(normalized.firstName).toBe('Anna')
    expect(normalized.email).toBe('anna@example.com')
  })

  it('normalizes a name to Unicode NFC form', () => {
    const decomposedName = `Jos${DECOMPOSED_E_ACUTE}`
    const precomposedName = `Jos${PRECOMPOSED_E_ACUTE}`

    expect(decomposedName).not.toBe(precomposedName)
    expect(decomposedName.normalize('NFC')).toBe(precomposedName)

    const normalized = normalizeUserFormValues({ ...BASE_VALUES, firstName: decomposedName }, UA_REGION)

    expect(normalized.firstName).toBe(precomposedName)
  })

  it('canonicalizes a blank nullable field to null', () => {
    const normalized = normalizeUserFormValues(
      { ...BASE_VALUES, phone: '', phoneExtension: '   ', addressCity: '' },
      UA_REGION,
    )

    expect(normalized.phone).toBeNull()
    expect(normalized.phoneExtension).toBeNull()
    expect(normalized.addressCity).toBeNull()
  })

  it('trims and NFC-normalizes a populated nullable text field', () => {
    const normalized = normalizeUserFormValues({ ...BASE_VALUES, addressCity: '  Kyiv  ' }, UA_REGION)

    expect(normalized.addressCity).toBe('Kyiv')
  })

  it('normalizes a national-format phone number to E.164 against the default region', () => {
    const normalized = normalizeUserFormValues({ ...BASE_VALUES, phone: '050 123 4567' }, UA_REGION)

    expect(normalized.phone).toBe('+380501234567')
  })

  it('normalizes a differently-formatted international phone number to the same E.164 value', () => {
    const spaced = normalizeUserFormValues({ ...BASE_VALUES, phone: '+380 50 123 4567' }, UA_REGION)
    const compact = normalizeUserFormValues({ ...BASE_VALUES, phone: '+380501234567' }, UA_REGION)

    expect(spaced.phone).toBe(compact.phone)
  })

  it('normalizes a valid international phone number even without a default region', () => {
    const normalized = normalizeUserFormValues({ ...BASE_VALUES, phone: '+380501234567' }, undefined)

    expect(normalized.phone).toBe('+380501234567')
  })
})
