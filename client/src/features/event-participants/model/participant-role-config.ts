import { readContacts, readHostEligibleEmployees } from '../../../shared/api'
import type { DirectoryOperation, EventParticipant } from '../../../shared/api'

/** The two roles a person can be assigned to on an event. */
export type ParticipantRole = 'attendee' | 'host'

export interface ParticipantRoleConfig {
  readonly title: string
  readonly loadOperation: DirectoryOperation
  /** Shown when the section has no people to offer and the user hasn't searched. */
  readonly emptyStateMessage: string
  /** Shown when a search returns no people. */
  readonly noMatchesMessage: string
  readonly fetchOptions: (search: string | undefined) => Promise<readonly EventParticipant[]>
}

/**
 * (role) -> config table (data-driven-rendering skill): the attendee and
 * host sections share one control and one hook (task 6.2); only the
 * directory call, the label, and the empty-state copy differ per role.
 */
const PARTICIPANT_ROLE_CONFIG: Readonly<Record<ParticipantRole, ParticipantRoleConfig>> = {
  attendee: {
    title: 'Attendees',
    loadOperation: 'load-attendees',
    emptyStateMessage: 'No contacts are available to assign yet.',
    noMatchesMessage: 'No matching contacts were found.',
    fetchOptions: (search) => readContacts({ search }),
  },
  host: {
    title: 'Hosts',
    loadOperation: 'load-hosts',
    emptyStateMessage: 'No employees are available to host yet.',
    noMatchesMessage: 'No matching employees were found.',
    // `readHostEligibleEmployees` always sends the literal `canHostEvents:
    // 'true'` itself — never conditional — so an ineligible employee is
    // never offered (specs/event-participants/spec.md — "Host options are
    // restricted"; R-007).
    fetchOptions: (search) => readHostEligibleEmployees({ search }),
  },
}

export function getParticipantRoleConfig(role: ParticipantRole): ParticipantRoleConfig {
  return PARTICIPANT_ROLE_CONFIG[role]
}
