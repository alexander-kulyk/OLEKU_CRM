import { describe, expect, it } from 'vitest'
import { createUserFormSchema } from './user-form-schema'
import type { UserFormValues } from './user-form-schema'

const VALID_VALUES: UserFormValues = {
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

/** Ukraine — the deployment default region used in this project's local/dev config (`server/CLAUDE.md`). */
const UA_REGION = 'UA'

describe('createUserFormSchema', () => {
  it('accepts Unicode names, including apostrophes and hyphens', () => {
    const schema = createUserFormSchema(UA_REGION)

    const result = schema.safeParse({
      ...VALID_VALUES,
      firstName: "O'Connor",
      lastName: 'Марія-Анна',
    })

    expect(result.success).toBe(true)
  })

  it('rejects a name containing a control character', () => {
    const schema = createUserFormSchema(UA_REGION)

    const result = schema.safeParse({ ...VALID_VALUES, firstName: 'Anna' })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['firstName'])
  })

  it('rejects a name over 100 characters', () => {
    const schema = createUserFormSchema(UA_REGION)

    const result = schema.safeParse({ ...VALID_VALUES, firstName: 'A'.repeat(101) })

    expect(result.success).toBe(false)
  })

  it('rejects a blank first name', () => {
    const schema = createUserFormSchema(UA_REGION)

    const result = schema.safeParse({ ...VALID_VALUES, firstName: '   ' })

    expect(result.success).toBe(false)
  })

  it('accepts an email at exactly the 254-character limit', () => {
    const schema = createUserFormSchema(UA_REGION)
    const localPart = 'a'.repeat(242)
    const email = `${localPart}@example.com` // 242 + '@example.com' (12) = 254 characters

    expect(email).toHaveLength(254)

    const result = schema.safeParse({ ...VALID_VALUES, email })

    expect(result.success).toBe(true)
  })

  it('rejects an email over the 254-character limit', () => {
    const schema = createUserFormSchema(UA_REGION)
    const localPart = 'a'.repeat(243)
    const email = `${localPart}@example.com` // 243 + '@example.com' (12) = 255 characters

    expect(email).toHaveLength(255)

    const result = schema.safeParse({ ...VALID_VALUES, email })

    expect(result.success).toBe(false)
  })

  it('rejects a syntactically invalid email', () => {
    const schema = createUserFormSchema(UA_REGION)

    const result = schema.safeParse({ ...VALID_VALUES, email: 'not-an-email' })

    expect(result.success).toBe(false)
  })

  it('accepts a blank phone — phone is optional', () => {
    const schema = createUserFormSchema(UA_REGION)

    const result = schema.safeParse({ ...VALID_VALUES, phone: '' })

    expect(result.success).toBe(true)
  })

  it('accepts an international phone number regardless of the configured region', () => {
    const schema = createUserFormSchema(UA_REGION)

    const result = schema.safeParse({ ...VALID_VALUES, phone: '+1 415 555 2671' })

    expect(result.success).toBe(true)
  })

  it('accepts a national-format phone number that matches the configured default region', () => {
    const schema = createUserFormSchema(UA_REGION)

    const result = schema.safeParse({ ...VALID_VALUES, phone: '050 123 4567' })

    expect(result.success).toBe(true)
  })

  it('rejects an unparseable phone number', () => {
    const schema = createUserFormSchema(UA_REGION)

    const result = schema.safeParse({ ...VALID_VALUES, phone: 'not a phone number' })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['phone'])
  })

  it('blocks an ambiguous national-format phone number when no default region is configured', () => {
    const schema = createUserFormSchema(undefined)

    const result = schema.safeParse({ ...VALID_VALUES, phone: '050 123 4567' })

    expect(result.success).toBe(false)
  })

  it('still accepts a valid international phone number when no default region is configured', () => {
    const schema = createUserFormSchema(undefined)

    const result = schema.safeParse({ ...VALID_VALUES, phone: '+380501234567' })

    expect(result.success).toBe(true)
  })

  it('accepts a blank address property', () => {
    const schema = createUserFormSchema(UA_REGION)

    const result = schema.safeParse({ ...VALID_VALUES, addressCity: '' })

    expect(result.success).toBe(true)
  })

  it('rejects a whitespace-only address property on its own flat field key', () => {
    const schema = createUserFormSchema(UA_REGION)

    const result = schema.safeParse({ ...VALID_VALUES, addressCity: '   ' })

    expect(result.success).toBe(false)
    // The flat `addressCity` path is exactly what `create-zod-resolver.ts`
    // needs to associate this error with the `addressCity` field — a
    // nested `address.city` schema would report `['address', 'city']`
    // here instead, which the resolver would flatten to the WRONG key
    // (`'address.city'`) and the form would never surface it (design.md D4).
    expect(result.error?.issues[0]?.path).toEqual(['addressCity'])
  })

  it('rejects a whitespace-only phone extension', () => {
    const schema = createUserFormSchema(UA_REGION)

    const result = schema.safeParse({ ...VALID_VALUES, phoneExtension: '  ' })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['phoneExtension'])
  })

  it('accepts every supported status', () => {
    const schema = createUserFormSchema(UA_REGION)

    expect(schema.safeParse({ ...VALID_VALUES, status: 'active' }).success).toBe(true)
    expect(schema.safeParse({ ...VALID_VALUES, status: 'inactive' }).success).toBe(true)
    expect(schema.safeParse({ ...VALID_VALUES, status: 'blocked' }).success).toBe(true)
  })

  it('rejects an unsupported status value', () => {
    const schema = createUserFormSchema(UA_REGION)

    const result = schema.safeParse({ ...VALID_VALUES, status: 'archived' })

    expect(result.success).toBe(false)
  })
})
