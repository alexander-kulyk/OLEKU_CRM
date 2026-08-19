/**
 * `Intl.DateTimeFormat` pinned to `timeZone: 'UTC'` and a fixed `'en-US'`
 * locale — never the browser's locale/timezone — so Last Login always
 * renders the same instant the server recorded, the same way for every
 * operator (specs/user-management/spec.md — "Operator context and
 * deployment phone configuration are explicit inputs": "display Last Login
 * in UTC"; "Last Login uses UTC" scenario). Module-level: the format never
 * varies per call, so there is no reason to construct it more than once.
 */
const LAST_LOGIN_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  dateStyle: 'medium',
  timeStyle: 'short',
})

/**
 * Formats a nullable ISO 8601 Last Login instant for display
 * (specs/user-management/spec.md — "a missing Last Login SHALL render as
 * `Never`"). The trailing `UTC` label makes the timezone explicit rather
 * than leaving an operator to assume it is local time.
 */
export function formatLastLogin(lastLoginAt: string | null): string {
  if (lastLoginAt === null) {
    return 'Never'
  }

  return `${LAST_LOGIN_FORMATTER.format(new Date(lastLoginAt))} UTC`
}
