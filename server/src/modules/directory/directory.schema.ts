import { z } from 'zod'
import { DIRECTORY_STATUSES } from './status.ts'

/**
 * specs/directory-api/spec.md, "Name search is literal and bounded": a
 * search term longer than 100 characters is rejected with VALIDATION_ERROR.
 */
const MAX_SEARCH_LENGTH = 100

const searchQueryField = z.string().max(MAX_SEARCH_LENGTH).optional()

// specs/directory-api/spec.md, "Status is a closed lifecycle filter": only
// the two declared status values are accepted; defaulting to "active" when
// absent happens in directory.service.ts, not here — an absent value must
// stay `undefined` through validation so the service can distinguish
// "not supplied" from an explicit value.
const statusQueryField = z.enum(DIRECTORY_STATUSES).optional()

// Query params arrive from Express as strings. specs/directory-api/spec.md
// declares exactly the `true`/`false` vocabulary for `canHostEvents`, so
// anything else (e.g. "1", "yes") is rejected rather than coerced.
const canHostEventsQueryField = z
  .enum(['true', 'false'])
  .optional()
  .transform((value) => (value === undefined ? undefined : value === 'true'))

/**
 * `GET /api/contacts` accepts only `search` and `status` (design.md D2).
 * `z.strictObject` rejects any other key — including an undeclared
 * result-size parameter like `size`/`limit`, or the employee-only
 * `canHostEvents` — with VALIDATION_ERROR instead of silently ignoring it.
 */
export const contactListQuerySchema = z.strictObject({
  search: searchQueryField,
  status: statusQueryField,
})

/**
 * `GET /api/employees` accepts the same two fields plus `canHostEvents`
 * (design.md D2, D7).
 */
export const employeeListQuerySchema = z.strictObject({
  search: searchQueryField,
  status: statusQueryField,
  canHostEvents: canHostEventsQueryField,
})

export type ContactListQuery = z.infer<typeof contactListQuerySchema>
export type EmployeeListQuery = z.infer<typeof employeeListQuerySchema>
