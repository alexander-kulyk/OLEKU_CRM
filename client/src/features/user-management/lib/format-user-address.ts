import type { UserAddress } from '../model/user-dto'

const MISSING_VALUE_PLACEHOLDER = '—'

/**
 * Formats a nullable {@link UserAddress} for the Address column
 * (specs/user-management/spec.md — "Users table presents operational
 * records": "formats address components in street-city-postal code-country
 * order without empty separators", "Missing phone or address values SHALL
 * render as `—`, missing address components SHALL not produce empty
 * separators"). A wholly absent address, or one whose every component is
 * absent, renders as the same placeholder a missing phone uses; a partial
 * address joins only its present components — never an empty string between
 * two commas.
 */
export function formatUserAddress(address: UserAddress | null): string {
  if (address === null) {
    return MISSING_VALUE_PLACEHOLDER
  }

  const parts = [address.street, address.city, address.postalCode, address.country].filter(
    (part): part is string => part !== null && part.trim() !== '',
  )

  return parts.length > 0 ? parts.join(', ') : MISSING_VALUE_PLACEHOLDER
}
