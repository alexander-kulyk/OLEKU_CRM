import { ContactModel, type ContactAttributes } from './contact.model.ts'
import { EmployeeModel, type EmployeeAttributes } from './employee.model.ts'
import { DEFAULT_DIRECTORY_STATUS } from './status.ts'
import type { ContactListQuery, EmployeeListQuery } from './directory.schema.ts'

// specs/directory-api/spec.md, "Directory results are deterministic and
// capped": both directory endpoints return at most 50 people, sorted by
// lastName, then firstName, then id — the same field order as the compound
// index declared in contact.model.ts / employee.model.ts (design.md D7, D8),
// so this ordering is served by an index rather than an in-memory sort.
const DIRECTORY_RESULT_LIMIT = 50
const DIRECTORY_SORT = { lastName: 1, firstName: 1, _id: 1 } as const

// The standard "escape regex metacharacters" pattern (design.md D7: "Search
// escapes pattern metacharacters before a case-insensitive match"). Kept as
// a small local helper rather than the newer `RegExp.escape` static, which
// this package's `lib: ["ES2023"]` compiler target does not type (that
// static landed in the ES2025 lib).
const REGEXP_SPECIAL_CHARACTERS = /[.*+?^${}()|[\]\\]/g

function escapeForLiteralMatch(text: string): string {
  return text.replace(REGEXP_SPECIAL_CHARACTERS, '\\$&')
}

function nameSearchClause(search: string) {
  const escaped = escapeForLiteralMatch(search)

  return [
    { firstName: { $regex: escaped, $options: 'i' } },
    { lastName: { $regex: escaped, $options: 'i' } },
  ]
}

export interface ContactSummary {
  id: string
  firstName: string
  lastName: string
  fullName: string
  email: string
  status: ContactAttributes['status']
}

export interface EmployeeSummary extends ContactSummary {
  position: string
  department: string
  canHostEvents: boolean
}

function toFullName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim()
}

type LeanContact = Pick<ContactAttributes, 'firstName' | 'lastName' | 'email' | 'status'> & {
  _id: unknown
}

type LeanEmployee = Pick<
  EmployeeAttributes,
  'firstName' | 'lastName' | 'email' | 'status' | 'position' | 'department' | 'canHostEvents'
> & { _id: unknown }

// specs/directory-api/spec.md requires exactly the declared public fields
// and "SHALL NOT expose persistence metadata" — this mapper is the one
// place that decides the response shape, so a stray extra field on the
// stored document (or a persistence field like `_id`/`__v`) can never leak
// through un-named.
function toContactSummary(contact: LeanContact): ContactSummary {
  return {
    id: String(contact._id),
    firstName: contact.firstName,
    lastName: contact.lastName,
    fullName: toFullName(contact.firstName, contact.lastName),
    email: contact.email,
    status: contact.status,
  }
}

function toEmployeeSummary(employee: LeanEmployee): EmployeeSummary {
  return {
    ...toContactSummary(employee),
    position: employee.position,
    department: employee.department,
    canHostEvents: employee.canHostEvents,
  }
}

/**
 * specs/directory-api/spec.md, "Contacts are read from the contact
 * directory": at most 50 active-by-default contacts, filtered and ordered
 * per the rules above, projected to only the declared public fields.
 */
export async function listContacts(query: ContactListQuery): Promise<ContactSummary[]> {
  const filter = {
    status: query.status ?? DEFAULT_DIRECTORY_STATUS,
    ...(query.search !== undefined ? { $or: nameSearchClause(query.search) } : {}),
  }

  const contacts = await ContactModel.find(filter)
    .select('firstName lastName email status')
    .sort(DIRECTORY_SORT)
    .limit(DIRECTORY_RESULT_LIMIT)
    .lean()

  return contacts.map(toContactSummary)
}

/**
 * specs/directory-api/spec.md, "Employees are read from the employee
 * directory" and "Employee reads support host eligibility": the same
 * status/search/order/cap rules as contacts, plus the optional
 * `canHostEvents` filter.
 */
export async function listEmployees(query: EmployeeListQuery): Promise<EmployeeSummary[]> {
  const filter = {
    status: query.status ?? DEFAULT_DIRECTORY_STATUS,
    ...(query.search !== undefined ? { $or: nameSearchClause(query.search) } : {}),
    ...(query.canHostEvents !== undefined ? { canHostEvents: query.canHostEvents } : {}),
  }

  const employees = await EmployeeModel.find(filter)
    .select('firstName lastName email status position department canHostEvents')
    .sort(DIRECTORY_SORT)
    .limit(DIRECTORY_RESULT_LIMIT)
    .lean()

  return employees.map(toEmployeeSummary)
}
