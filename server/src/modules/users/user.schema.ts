import { z } from 'zod'
import { parsePhoneNumberFromString } from 'libphonenumber-js'
import { env } from '../../shared/config/env.ts'
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

const OBJECT_ID_PATTERN = /^[0-9a-f]{24}$/i

export const userIdParamsSchema = z.strictObject({
  userId: z
    .string()
    .regex(OBJECT_ID_PATTERN, 'userId must be a valid identifier.'),
})

const nameField = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .refine((value) => !/\p{Cc}/u.test(value), 'Control characters are not allowed.')
const addressPropertyField = z.string().trim().min(1).nullable().optional()
const addressPatchField = z
  .strictObject({
    country: addressPropertyField,
    city: addressPropertyField,
    street: addressPropertyField,
    postalCode: addressPropertyField,
  })
  .nullable()

export const userPatchSchema = z
  .strictObject({
    firstName: nameField.optional(),
    lastName: nameField.optional(),
    email: z.string().trim().max(254).email().optional(),
    phone: z
      .string()
      .trim()
      .min(1)
      .refine(
        (value) =>
          parsePhoneNumberFromString(value, env.defaultPhoneRegion)?.isValid() ===
          true,
        'Phone must be a valid phone number.',
      )
      .nullable()
      .optional(),
    phoneExtension: z.string().trim().min(1).nullable().optional(),
    address: addressPatchField.optional(),
    status: z.enum(USER_STATUSES).optional(),
    version: z.number().int().min(0),
  })
  .superRefine((patch, context) => {
    const mutableFields = Object.keys(patch).filter((key) => key !== 'version')

    if (mutableFields.length === 0) {
      context.addIssue({
        code: 'custom',
        message: 'At least one mutable user field must be supplied.',
        params: { errorCode: 'NO_CHANGES_SUBMITTED' },
      })
    }
  })

export type UserListQuery = z.infer<typeof userListQuerySchema>
export type UserIdParams = z.infer<typeof userIdParamsSchema>
export type UserPatch = z.infer<typeof userPatchSchema>
