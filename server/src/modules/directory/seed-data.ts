import type { ContactAttributes } from './contact.model.ts'
import type { EmployeeAttributes } from './employee.model.ts'

/**
 * A fixed, hand-authored directory dataset for local development and
 * scratch environments. `seedDirectory()` in `seed.ts` upserts each entry
 * by `email`, so editing a value here changes what a re-run converges to
 * rather than adding a duplicate record.
 *
 * Deliberately includes one inactive contact, one active-but-ineligible
 * employee, and one inactive employee, so every status/eligibility
 * dimension in specs/directory-api/spec.md has a concrete example to read
 * or filter against (design.md D11; tasks.md 3.4). This dataset is never
 * applied to `events` or `users` — `seed.ts` imports only the two
 * directory models.
 */
export const CONTACT_SEEDS: readonly ContactAttributes[] = [
  {
    firstName: 'Ava',
    lastName: 'Thompson',
    email: 'ava.thompson@example.test',
    status: 'active',
  },
  {
    firstName: 'Marcus',
    lastName: 'Bell',
    email: 'marcus.bell@example.test',
    status: 'active',
  },
  {
    firstName: 'Priya',
    lastName: 'Shah',
    email: 'priya.shah@example.test',
    status: 'inactive',
  },
]

export const EMPLOYEE_SEEDS: readonly EmployeeAttributes[] = [
  {
    firstName: 'Dana',
    lastName: 'Ortiz',
    email: 'dana.ortiz@example.test',
    status: 'active',
    position: 'Instructor',
    department: 'Academics',
    canHostEvents: true,
  },
  {
    firstName: 'Femi',
    lastName: 'Adeyemi',
    email: 'femi.adeyemi@example.test',
    status: 'active',
    position: 'Front Desk Coordinator',
    department: 'Operations',
    canHostEvents: false,
  },
  {
    firstName: 'Grace',
    lastName: 'Lindqvist',
    email: 'grace.lindqvist@example.test',
    status: 'inactive',
    position: 'Instructor',
    department: 'Academics',
    canHostEvents: true,
  },
]
