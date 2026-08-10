/**
 * The closed contact/employee lifecycle (design.md D7): exactly two values,
 * defaulting to `active`. Declared as a `const` tuple plus a derived union
 * type rather than a TypeScript `enum` — Node's erasable-syntax-only
 * execution mode cannot run `enum` declarations (research.md F-017).
 *
 * Shared by both directory models so `contact.model.ts` and
 * `employee.model.ts` declare the identical closed set rather than two
 * copies that could drift.
 */
export const DIRECTORY_STATUSES = ['active', 'inactive'] as const

export type DirectoryStatus = (typeof DIRECTORY_STATUSES)[number]

export const DEFAULT_DIRECTORY_STATUS: DirectoryStatus = 'active'
