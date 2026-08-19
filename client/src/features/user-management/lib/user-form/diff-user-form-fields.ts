import type { UserAddressPatch, UserPatchPayload } from '../../model/user-patch'
import type { NormalizedUserFormValues } from './normalize-user-form-values'

/** The mutable {@link UserPatchPayload} members, minus `version` — see {@link diffNormalizedUserFormValues}. */
export type UserFormFieldsPatch = Omit<UserPatchPayload, 'version'>

/**
 * `UserAddressPatch`/`UserFormFieldsPatch` are declared `readonly` for
 * every consumer that only ever reads a finished patch (`model/user-patch.ts`
 * doc comment). Building one field-by-field needs a writable local view of
 * the same shape; this is that view, used only inside this module.
 */
type MutableAddressPatch = { -readonly [Key in keyof UserAddressPatch]: UserAddressPatch[Key] }
type MutableFieldsPatch = { -readonly [Key in keyof UserFormFieldsPatch]: UserFormFieldsPatch[Key] }

/**
 * Address diff rules (specs/user-management/spec.md — "Save sends a
 * normalized versioned merge patch"): a changed property appears
 * individually (cleared -> `null`, otherwise its new value), an unchanged
 * property is omitted from the address patch object entirely, and
 * clearing every previously-populated property collapses to `address:
 * null` instead of an object of four `null`s. `undefined` means "no
 * address member at all" — every property is unchanged.
 */
function diffAddress(
  current: NormalizedUserFormValues,
  original: NormalizedUserFormValues,
): UserAddressPatch | null | undefined {
  const hasCountryChanged = current.addressCountry !== original.addressCountry
  const hasCityChanged = current.addressCity !== original.addressCity
  const hasStreetChanged = current.addressStreet !== original.addressStreet
  const hasPostalCodeChanged = current.addressPostalCode !== original.addressPostalCode

  if (!hasCountryChanged && !hasCityChanged && !hasStreetChanged && !hasPostalCodeChanged) {
    return undefined
  }

  const isCurrentAddressEmpty =
    current.addressCountry === null &&
    current.addressCity === null &&
    current.addressStreet === null &&
    current.addressPostalCode === null
  const wasOriginalAddressPopulated =
    original.addressCountry !== null ||
    original.addressCity !== null ||
    original.addressStreet !== null ||
    original.addressPostalCode !== null

  if (isCurrentAddressEmpty && wasOriginalAddressPopulated) {
    return null
  }

  const addressPatch: MutableAddressPatch = {}

  if (hasCountryChanged) {
    addressPatch.country = current.addressCountry
  }
  if (hasCityChanged) {
    addressPatch.city = current.addressCity
  }
  if (hasStreetChanged) {
    addressPatch.street = current.addressStreet
  }
  if (hasPostalCodeChanged) {
    addressPatch.postalCode = current.addressPostalCode
  }

  return addressPatch
}

/**
 * The single normalized-dirty and merge-patch-content source (task 5.2):
 * compares two normalized form snapshots field by field and returns only
 * the mutable members that differ, or `null` when nothing does. `null`
 * here is exactly "normalized-clean" — `isUserFormNormalizedDirty` and
 * `buildUserPatch` both read this one comparison rather than keeping two
 * diverging notions of "changed" (do-not guardrail: "use raw react-hook-form
 * `isDirty` as the domain dirty decision"). Never includes `id`,
 * `createdAt`, `updatedAt`, or `archivedAt` — those members do not exist
 * on either normalized snapshot, so an immutable/read-only field can never
 * appear in the result.
 */
export function diffNormalizedUserFormValues(
  current: NormalizedUserFormValues,
  original: NormalizedUserFormValues,
): UserFormFieldsPatch | null {
  const patch: MutableFieldsPatch = {}

  if (current.firstName !== original.firstName) {
    patch.firstName = current.firstName
  }
  if (current.lastName !== original.lastName) {
    patch.lastName = current.lastName
  }
  if (current.email !== original.email) {
    patch.email = current.email
  }
  if (current.phone !== original.phone) {
    patch.phone = current.phone
  }
  if (current.phoneExtension !== original.phoneExtension) {
    patch.phoneExtension = current.phoneExtension
  }
  if (current.status !== original.status) {
    patch.status = current.status
  }

  const addressPatch = diffAddress(current, original)

  if (addressPatch !== undefined) {
    patch.address = addressPatch
  }

  return Object.keys(patch).length === 0 ? null : patch
}

/**
 * Whether a form is normalized-dirty: exactly "does the same diff this
 * feature would patch with contain any mutable member" (design.md D4).
 */
export function isUserFormNormalizedDirty(
  current: NormalizedUserFormValues,
  original: NormalizedUserFormValues,
): boolean {
  return diffNormalizedUserFormValues(current, original) !== null
}
