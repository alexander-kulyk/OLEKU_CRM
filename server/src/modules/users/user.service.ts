import { parsePhoneNumberFromString } from 'libphonenumber-js'
import type { QueryFilter, SortOrder } from 'mongoose'
import { env } from '../../shared/config/env.ts'
import { HttpError } from '../../shared/http/error-envelope.ts'
import {
  UserModel,
  type UserAddress,
  type UserAttributes,
} from './user.model.ts'
import { foldUserText } from './user-normalization.ts'
import { normalizeUserPatch, type UserNormalizationSource } from './user-normalization.ts'
import type { UserListQuery, UserPatch } from './user.schema.ts'

const REGEXP_SPECIAL_CHARACTERS = /[.*+?^${}()|[\]\\]/g

type UserSort = Record<string, SortOrder>

export interface UserListItemDto {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string | null
  address: UserAddress | null
  status: UserAttributes['status']
  lastLoginAt: string | null
}

export interface UserListResult {
  items: UserListItemDto[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

export interface UserDto extends UserListItemDto {
  phoneExtension: string | null
  archivedAt: string | null
  createdAt: string
  updatedAt: string
  version: number
}

type LeanListUser = Pick<
  UserAttributes,
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'phone'
  | 'address'
  | 'status'
  | 'lastLoginAt'
> & { _id: unknown }

type LeanDetailUser = Pick<
  UserAttributes,
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'phone'
  | 'phoneExtension'
  | 'address'
  | 'status'
  | 'lastLoginAt'
  | 'archivedAt'
  | 'createdAt'
  | 'updatedAt'
  | 'version'
> & { _id: unknown }

function escapeForLiteralMatch(text: string): string {
  return text.replace(REGEXP_SPECIAL_CHARACTERS, '\\$&')
}

function phoneSearchDigits(search: string): string | null {
  const parsed = parsePhoneNumberFromString(search, env.defaultPhoneRegion)

  if (parsed?.isValid()) return parsed.number.replace(/\D/g, '')

  const digits = search.replace(/\D/g, '')
  return digits.length > 0 ? digits : null
}

function searchFilter(search: string): QueryFilter<UserAttributes> {
  const folded = escapeForLiteralMatch(foldUserText(search))
  const phoneDigits = phoneSearchDigits(search)
  const clauses: QueryFilter<UserAttributes>[] = [
    { firstNameFolded: { $regex: `^${folded}` } },
    { lastNameFolded: { $regex: `^${folded}` } },
    { fullNameFolded: { $regex: `^${folded}` } },
    { fullNameReversedFolded: { $regex: `^${folded}` } },
    { emailNormalized: { $regex: `^${folded}` } },
  ]

  if (phoneDigits !== null) {
    clauses.push({ phoneDigits: { $regex: `^${phoneDigits}` } })
  }

  return { $or: clauses }
}

function sortFor(query: UserListQuery): {
  sort: UserSort
  usesNameCollation: boolean
} {
  if (query.sort === undefined) {
    return {
      sort: { lastName: 1, firstName: 1, _id: 1 },
      usesNameCollation: true,
    }
  }

  const [field, directionName] = query.sort.split(':')
  const direction = directionName === 'asc' ? 1 : -1

  if (field === 'firstName') {
    return {
      sort: { firstName: direction, lastName: direction, _id: 1 },
      usesNameCollation: true,
    }
  }
  if (field === 'lastName') {
    return {
      sort: { lastName: direction, firstName: direction, _id: 1 },
      usesNameCollation: true,
    }
  }
  if (field === 'status') {
    return { sort: { statusRank: direction, _id: 1 }, usesNameCollation: false }
  }

  return {
    sort: { lastLoginRank: 1, lastLoginAt: direction, _id: 1 },
    usesNameCollation: false,
  }
}

function toUserListItem(user: LeanListUser): UserListItemDto {
  return {
    id: String(user._id),
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    address: user.address,
    status: user.status,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
  }
}

function toUserDto(user: LeanDetailUser): UserDto {
  return {
    ...toUserListItem(user),
    phoneExtension: user.phoneExtension,
    archivedAt: user.archivedAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    version: user.version,
  }
}

export async function listUsers(
  query: UserListQuery,
): Promise<UserListResult> {
  const filter: QueryFilter<UserAttributes> = {
    archivedAt: null,
    ...(query.status !== undefined ? { status: { $in: query.status } } : {}),
    ...(query.search !== undefined ? searchFilter(query.search) : {}),
  }
  const { sort, usesNameCollation } = sortFor(query)
  const usersQuery = UserModel.find(filter)
    .select('firstName lastName email phone address status lastLoginAt')
    .sort(sort)
    .skip((query.page - 1) * query.pageSize)
    .limit(query.pageSize)
    .lean<LeanListUser[]>()

  if (usesNameCollation) {
    usersQuery.collation({ locale: 'uk', strength: 2 })
  }

  const [users, total] = await Promise.all([
    usersQuery.exec(),
    UserModel.countDocuments(filter).exec(),
  ])

  return {
    items: users.map(toUserListItem),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    },
  }
}

export async function getUser(userId: string): Promise<UserDto> {
  const user = await UserModel.findOne({ _id: userId })
    .select(
      'firstName lastName email phone phoneExtension address status lastLoginAt archivedAt createdAt updatedAt version',
    )
    .lean<LeanDetailUser | null>()
    .exec()

  if (user === null) {
    throw new HttpError('NOT_FOUND', 'User not found.')
  }

  return toUserDto(user)
}

interface DuplicateKeyError {
  code: number
  keyPattern?: Record<string, number>
}

function isEmailDuplicateKey(error: unknown): error is DuplicateKeyError {
  if (typeof error !== 'object' || error === null) return false

  const candidate = error as DuplicateKeyError
  return (
    candidate.code === 11000 && candidate.keyPattern?.emailNormalized === 1
  )
}

async function translateEmailDuplicate(
  error: unknown,
  emailNormalized: string,
): Promise<never> {
  if (!isEmailDuplicateKey(error)) throw error

  const owner = await UserModel.findOne({ emailNormalized })
    .select('archivedAt')
    .lean<Pick<UserAttributes, 'archivedAt'> | null>()
    .exec()
  const code =
    owner?.archivedAt == null
      ? 'EMAIL_ALREADY_EXISTS'
      : 'EMAIL_TAKEN_BY_ARCHIVED_USER'

  throw new HttpError(code, 'That email address is already in use.', 'email')
}

export async function updateUser(
  userId: string,
  patch: UserPatch,
): Promise<UserDto> {
  const current = await UserModel.findOne({ _id: userId })
    .select(
      'firstName lastName email phone phoneExtension address status lastLoginAt',
    )
    .lean<UserNormalizationSource | null>()
    .exec()

  if (current === null) {
    throw new HttpError('NOT_FOUND', 'User not found.')
  }

  const { version, ...mutablePatch } = patch
  const normalized = normalizeUserPatch(mutablePatch, current)

  let updated: LeanDetailUser | null
  try {
    updated = await UserModel.findOneAndUpdate(
      { _id: userId, archivedAt: null, version },
      { $set: normalized, $inc: { version: 1 } },
      { new: true },
    )
      .select(
        'firstName lastName email phone phoneExtension address status lastLoginAt archivedAt createdAt updatedAt version',
      )
      .lean<LeanDetailUser | null>()
      .exec()
  } catch (error) {
    return translateEmailDuplicate(error, normalized.emailNormalized)
  }

  if (updated !== null) return toUserDto(updated)

  const stored = await UserModel.findOne({ _id: userId })
    .select('archivedAt')
    .lean<Pick<UserAttributes, 'archivedAt'> | null>()
    .exec()

  if (stored === null) throw new HttpError('NOT_FOUND', 'User not found.')
  if (stored.archivedAt !== null) {
    throw new HttpError('USER_ARCHIVED', 'Archived users cannot be updated.')
  }

  throw new HttpError(
    'USER_VERSION_CONFLICT',
    'The user was changed by another request.',
  )
}
