import { parsePhoneNumberFromString } from 'libphonenumber-js'
import type { QueryFilter, SortOrder } from 'mongoose'
import { env } from '../../shared/config/env.ts'
import {
  UserModel,
  type UserAddress,
  type UserAttributes,
} from './user.model.ts'
import { foldUserText } from './user-normalization.ts'
import type { UserListQuery } from './user.schema.ts'

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
