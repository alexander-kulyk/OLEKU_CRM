import { z } from 'zod'
import { USER_STATUSES } from './user-status.ts'

const pageField = z.coerce.number().int().min(1).default(1)
const pageSizeField = z.coerce
  .number()
  .pipe(z.union([z.literal(20), z.literal(50), z.literal(100)]))
  .default(20)
const searchField = z.string().trim().min(1).max(100)
const statusField = z
  .string()
  .transform((value) => value.split(','))
  .pipe(z.array(z.enum(USER_STATUSES)).min(1))

export const USER_SORTS = [
  'firstName:asc',
  'firstName:desc',
  'lastName:asc',
  'lastName:desc',
  'status:asc',
  'status:desc',
  'lastLoginAt:asc',
  'lastLoginAt:desc',
] as const

export const userListQuerySchema = z.strictObject({
  page: pageField,
  pageSize: pageSizeField,
  search: searchField.optional(),
  status: statusField.optional(),
  sort: z.enum(USER_SORTS).optional(),
})

export type UserListQuery = z.infer<typeof userListQuerySchema>
