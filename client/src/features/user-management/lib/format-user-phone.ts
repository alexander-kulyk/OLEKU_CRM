const MISSING_VALUE_PLACEHOLDER = '—'

/**
 * Formats a nullable stored phone for the Phone column
 * (specs/user-management/spec.md — "Missing phone or address values SHALL
 * render as `—`"). National/international display formatting belongs to the
 * edit form's phone parsing (Stage 5); the list simply shows the stored
 * value or the missing-value placeholder.
 */
export function formatUserPhone(phone: string | null): string {
  return phone ?? MISSING_VALUE_PLACEHOLDER
}
