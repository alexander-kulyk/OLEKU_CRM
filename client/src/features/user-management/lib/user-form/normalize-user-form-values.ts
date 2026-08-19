import { isSupportedCountry, parsePhoneNumberFromString } from 'libphonenumber-js'
import type { CountryCode } from 'libphonenumber-js'
import type { UserStatus } from '../../model/user-status'
import type { UserFormValues } from './user-form-schema'

/**
 * The normalized counterpart of {@link UserFormValues} (task 5.2, design.md
 * D4): every text member is trimmed and Unicode-NFC normalized, and every
 * nullable member (`phone`, `phoneExtension`, and each flat address
 * property) canonicalizes a blank value to `null` rather than `''` — the
 * single normalization boundary both normalized-dirty comparison and the
 * merge-patch builder read from, so a form value and its patch
 * representation can never disagree about what "no value" means (do-not
 * guardrail: "send empty strings to clear nullable values").
 */
export interface NormalizedUserFormValues {
  readonly firstName: string
  readonly lastName: string
  readonly email: string
  readonly phone: string | null
  readonly phoneExtension: string | null
  readonly addressCountry: string | null
  readonly addressCity: string | null
  readonly addressStreet: string | null
  readonly addressPostalCode: string | null
  readonly status: UserStatus
}

function normalizeRequiredText(value: string): string {
  return value.trim().normalize('NFC')
}

function normalizeNullableText(value: string): string | null {
  const normalized = value.trim().normalize('NFC')

  return normalized.length === 0 ? null : normalized
}

function toSupportedCountryCode(region: string | undefined): CountryCode | undefined {
  return region !== undefined && isSupportedCountry(region) ? region : undefined
}

/**
 * Normalizes a raw phone input to the server's own stored form, E.164
 * (`server/src/modules/users/user-normalization.ts` `normalizePhone`:
 * `parsed.number`), using the same `libphonenumber-js` dependency and
 * deployment-wide default region rather than a handwritten phone regex
 * (do-not guardrail: "handwrite phone regex parsing"). Called only on
 * values `createUserFormSchema`'s phone field already accepted, so parsing
 * is expected to succeed; the trimmed raw value is a defensive fallback
 * for the one case it does not (a blank value never reaches the parser at
 * all — that returns `null`, matching the nullable field).
 */
function normalizePhoneValue(value: string, defaultPhoneRegion: string | undefined): string | null {
  const trimmed = value.trim()

  if (trimmed.length === 0) {
    return null
  }

  const countryCode = toSupportedCountryCode(defaultPhoneRegion)
  const parsed = parsePhoneNumberFromString(trimmed, countryCode)

  return parsed?.isValid() === true ? parsed.number : trimmed
}

/**
 * Normalizes a form snapshot for comparison and patch construction (task
 * 5.2). Applied identically to the form's live values and to its starting
 * defaults, so "normalized-dirty" (design.md D4) means exactly "these two
 * normalized snapshots differ" — a whitespace-only edit or a
 * differently-formatted-but-identical phone number normalizes back to the
 * same value on both sides and therefore reports no change.
 */
export function normalizeUserFormValues(
  values: UserFormValues,
  defaultPhoneRegion: string | undefined,
): NormalizedUserFormValues {
  return {
    firstName: normalizeRequiredText(values.firstName),
    lastName: normalizeRequiredText(values.lastName),
    email: normalizeRequiredText(values.email),
    phone: normalizePhoneValue(values.phone, defaultPhoneRegion),
    phoneExtension: normalizeNullableText(values.phoneExtension),
    addressCountry: normalizeNullableText(values.addressCountry),
    addressCity: normalizeNullableText(values.addressCity),
    addressStreet: normalizeNullableText(values.addressStreet),
    addressPostalCode: normalizeNullableText(values.addressPostalCode),
    status: values.status,
  }
}
