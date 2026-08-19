import { z } from 'zod'
import { isSupportedCountry, parsePhoneNumberFromString } from 'libphonenumber-js'
import type { CountryCode } from 'libphonenumber-js'
import { USER_STATUSES } from '../../model/user-status'
import type { UserStatus } from '../../model/user-status'

/**
 * The flat Edit User form model (design.md D4): address members use flat
 * `addressCountry`/`addressCity`/`addressStreet`/`addressPostalCode` keys
 * rather than a nested `address` object, because the shared
 * `createZodResolver` (`shared/lib/create-zod-resolver.ts`) keys
 * `FieldErrors` by a Zod issue's dotted path joined as a single string —
 * a nested schema would produce an `errors['address.city']` entry that no
 * flat `errors.addressCity` lookup would ever find, silently losing that
 * field's accessible error (design.md D4 "Alternatives considered").
 *
 * Every member is a plain `string` (never `undefined`/`null`): a native
 * `<input>`'s value is always a string, so "not provided" is an empty
 * string, not an absent key. `status` is the one non-text member — a
 * closed `UserStatus` union the Status control always has a value for.
 */
export interface UserFormValues {
  readonly firstName: string
  readonly lastName: string
  readonly email: string
  readonly phone: string
  readonly phoneExtension: string
  readonly addressCountry: string
  readonly addressCity: string
  readonly addressStreet: string
  readonly addressPostalCode: string
  readonly status: UserStatus
}

const CONTROL_CHARACTER_PATTERN = /\p{Cc}/u

/**
 * Mirrors server `nameField` (`server/src/modules/users/user.schema.ts`):
 * trimmed, required, at most 100 characters, free of control characters —
 * Unicode apostrophes/hyphens are untouched by this check, so `O'Connor`/
 * `Jean-Luc` pass. Unicode-NFC normalization is deliberately NOT applied
 * here: it belongs to `normalizeUserFormValues` (design.md D4), the same
 * split the server keeps between `userPatchSchema` (validation) and
 * `user-normalization.ts` (`normalizeText`).
 */
function nameField(label: string): z.ZodString {
  return z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .max(100, `${label} must be at most 100 characters.`)
    .refine((value) => !CONTROL_CHARACTER_PATTERN.test(value), 'Control characters are not allowed.')
}

/**
 * An optional address property or the phone extension. The raw value is
 * never trimmed here (trimming is `normalizeUserFormValues`'s job) — this
 * only rejects the one case spec.md calls out explicitly: a non-empty
 * value that is only whitespace. A truly empty string is valid and means
 * "no value" (specs/user-management/spec.md — "Edit form exposes and
 * validates the supported fields": "Address fields SHALL be optional,
 * trimmed, Unicode-capable, and invalid when non-empty input contains
 * only whitespace").
 */
const optionalTextField = z
  .string()
  .refine((value) => value.length === 0 || value.trim().length > 0, 'This field cannot be only whitespace.')

/**
 * Narrows a possibly-unsupported runtime string into a real
 * `CountryCode` libphonenumber-js recognises, using the library's own
 * type guard rather than an unchecked cast. Mirrors
 * `server/src/shared/config/env.ts`'s `requiredCountryCode`, except the
 * client's default phone region is an optional injected runtime value
 * (`model/users-runtime-context.ts` `UsersRuntimeContext`), not a
 * required startup env var — an unsupported or absent value degrades to
 * `undefined` (region-unaware validation) instead of throwing.
 */
function toSupportedCountryCode(region: string | undefined): CountryCode | undefined {
  return region !== undefined && isSupportedCountry(region) ? region : undefined
}

/**
 * The phone field, built per form session against the injected
 * deployment-wide default region (design.md D6). A blank value is always
 * valid (phone is optional); a non-blank value must parse as a valid
 * phone number against `countryCode` via the same
 * `parsePhoneNumberFromString(value, region)?.isValid()` check the server
 * uses (`server/src/modules/users/user-normalization.ts`
 * `normalizePhone`). When `countryCode` is `undefined` (no default region
 * configured), `parsePhoneNumberFromString` still accepts a `+`-prefixed
 * international number and rejects an ambiguous national one — no
 * separate branch is needed to enforce "block ambiguous national input,
 * keep international input valid" (specs/user-management/spec.md
 * "Operator context and deployment phone configuration are explicit
 * inputs"; run prompt phone-region guidance): that is simply what the
 * library already does with no region hint.
 */
function createPhoneField(defaultPhoneRegion: string | undefined): z.ZodString {
  const countryCode = toSupportedCountryCode(defaultPhoneRegion)

  return z.string().refine((value) => {
    const trimmed = value.trim()

    if (trimmed.length === 0) {
      return true
    }

    return parsePhoneNumberFromString(trimmed, countryCode)?.isValid() === true
  }, 'Enter a valid phone number.')
}

/**
 * Builds the Edit User form's validation schema (task 5.1). A factory
 * rather than a module-level constant because phone validation depends on
 * the deployment-wide default phone region, which is only known once a
 * dialog session opens (design.md D6) — never inferred from the browser
 * (do-not guardrail: "permit browser timezone/region inference").
 */
export function createUserFormSchema(defaultPhoneRegion: string | undefined): z.ZodType<UserFormValues> {
  return z.object({
    firstName: nameField('First name'),
    lastName: nameField('Last name'),
    email: z
      .string()
      .trim()
      .min(1, 'Email is required.')
      .max(254, 'Email must be at most 254 characters.')
      .email('Enter a valid email address.'),
    phone: createPhoneField(defaultPhoneRegion),
    phoneExtension: optionalTextField,
    addressCountry: optionalTextField,
    addressCity: optionalTextField,
    addressStreet: optionalTextField,
    addressPostalCode: optionalTextField,
    status: z.enum(USER_STATUSES),
  })
}
