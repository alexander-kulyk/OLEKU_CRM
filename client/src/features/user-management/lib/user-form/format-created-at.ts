/**
 * `Intl.DateTimeFormat` pinned to `timeZone: 'UTC'` and a fixed `'en-US'`
 * locale — never the browser's locale/timezone (do-not guardrail: "permit
 * browser timezone/region inference") — matching
 * `lib/format-last-login.ts`'s formatter exactly, so every date the Edit
 * User dialog displays (read-only Created At here, and the reused Last
 * Login formatter) renders the same way.
 */
const CREATED_AT_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  dateStyle: 'medium',
  timeStyle: 'short',
})

/**
 * Formats the Edit User dialog's read-only Created At value (task 5.2
 * "date … display"). Unlike Last Login, a detail's `createdAt` is never
 * `null` — every user has one — so this has no missing-value branch.
 */
export function formatCreatedAt(createdAt: string): string {
  return `${CREATED_AT_FORMATTER.format(new Date(createdAt))} UTC`
}
