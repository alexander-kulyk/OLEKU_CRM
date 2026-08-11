import { httpClient } from './http-client'
import type { EventParticipant } from './event-types'

/** Shape of `GET /api/contacts` — the only list response the server sends. */
interface ContactListResponse {
  readonly contacts: readonly EventParticipant[]
}

/** Shape of `GET /api/employees`. */
interface EmployeeListResponse {
  readonly employees: readonly EventParticipant[]
}

/**
 * The only parameter a caller ever supplies to a directory read. `status`
 * is deliberately never sent by anything in this module — the server
 * defaults to active-only when it is absent, which is exactly what both
 * selectors want (specs/event-participants/spec.md — "Only eligible people
 * are offered"), so sending it would only risk a stray value.
 */
export interface DirectorySearchQuery {
  readonly search?: string
}

/**
 * Reads active contacts for the attendee selector. `search`, when
 * present, is resolved by the directory service — this function never
 * filters a held list (specs/event-participants/spec.md — "Search is
 * resolved by the directory service"; R-008).
 *
 * The query is a one-key object literal built from a named field — never a
 * spread of a caller-supplied object — so nothing downstream can append a
 * third parameter and turn the request into a `VALIDATION_ERROR` (R-001),
 * the same discipline `readEventsForPeriod` applies to event reads
 * (`shared/api/events.ts`).
 */
export async function readContacts(
  query: DirectorySearchQuery,
): Promise<readonly EventParticipant[]> {
  const response = await httpClient.get<ContactListResponse>('/contacts', {
    params: { search: query.search },
  })

  return response.data.contacts
}

/**
 * Reads active employees permitted to host events, for the host selector.
 * `canHostEvents` is ALWAYS the literal string `'true'` — never assembled
 * conditionally — so an employee the server would reject can never be
 * offered as selectable (specs/event-participants/spec.md — "Only
 * eligible people are offered"; R-007). The server transforms the string
 * on receipt; the wire value must be the string, not a boolean, because
 * every query parameter arrives as a string.
 */
export async function readHostEligibleEmployees(
  query: DirectorySearchQuery,
): Promise<readonly EventParticipant[]> {
  const response = await httpClient.get<EmployeeListResponse>('/employees', {
    params: { search: query.search, canHostEvents: 'true' },
  })

  return response.data.employees
}
