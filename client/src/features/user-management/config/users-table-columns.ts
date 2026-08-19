import type { UserSortField } from '../model/users-list-query'

/**
 * The eight required columns, in display order
 * (specs/user-management/spec.md — "Users table presents operational
 * records": "The table SHALL contain First Name, Last Name, Email, Phone,
 * Address, Status, Last Login, and Actions columns"), plus the interactive
 * sort field each sortable header maps to
 * ("Supported interactive sorts SHALL be First Name, Last Name, Status, and
 * Last Login").
 *
 * A config table rather than eight near-identical `<th>` blocks — every
 * header cell (sortable or not) renders from the same shape
 * (data-driven-rendering skill).
 */
export interface UsersTableColumnConfig {
  readonly key: string
  readonly header: string
  /** Present only for the four interactively sortable columns. */
  readonly sortField?: UserSortField
}

export const USERS_TABLE_COLUMNS: readonly UsersTableColumnConfig[] = [
  { key: 'firstName', header: 'First Name', sortField: 'firstName' },
  { key: 'lastName', header: 'Last Name', sortField: 'lastName' },
  { key: 'email', header: 'Email' },
  { key: 'phone', header: 'Phone' },
  { key: 'address', header: 'Address' },
  { key: 'status', header: 'Status', sortField: 'status' },
  { key: 'lastLogin', header: 'Last Login', sortField: 'lastLoginAt' },
  { key: 'actions', header: 'Actions' },
]
