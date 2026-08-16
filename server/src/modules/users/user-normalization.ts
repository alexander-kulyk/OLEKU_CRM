import { parsePhoneNumberFromString } from 'libphonenumber-js'
import { env } from '../../shared/config/env.ts'
import { HttpError } from '../../shared/http/error-envelope.ts'
import type { UserAddress } from './user.model.ts'
import { USER_STATUS_RANK, type UserStatus } from './user-status.ts'

export interface UserNormalizationSource {
  firstName: string
  lastName: string
  email: string
  phone: string | null
  phoneExtension: string | null
  address: UserAddress | null
  status: UserStatus
  lastLoginAt: Date | null
}

export interface UserAddressPatch {
  country?: string | null
  city?: string | null
  street?: string | null
  postalCode?: string | null
}

export interface UserNormalizationPatch {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string | null
  phoneExtension?: string | null
  address?: UserAddressPatch | null
  status?: UserStatus
}

export interface NormalizedUserSet extends UserNormalizationSource {
  emailNormalized: string
  firstNameFolded: string
  lastNameFolded: string
  fullNameFolded: string
  fullNameReversedFolded: string
  phoneDigits: string
  statusRank: number
  lastLoginRank: number
}

function normalizeText(value: string): string {
  return value.trim().normalize('NFC')
}

function foldText(value: string): string {
  return normalizeText(value)
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLocaleLowerCase('uk-UA')
    .normalize('NFC')
}

function mergeAddress(
  current: UserAddress | null,
  patch: UserAddressPatch | null | undefined,
): UserAddress | null {
  if (patch === null) return null

  const merged: UserAddress = {}
  const candidate = { ...(current ?? {}), ...(patch ?? {}) }

  for (const key of ['country', 'city', 'street', 'postalCode'] as const) {
    const value = candidate[key]

    if (value === undefined) continue
    if (value === null) delete merged[key]
    else merged[key] = normalizeText(value)
  }

  return Object.keys(merged).length === 0 ? null : merged
}

function normalizePhone(phone: string | null): {
  phone: string | null
  phoneDigits: string
} {
  if (phone === null) return { phone: null, phoneDigits: '' }

  const parsed = parsePhoneNumberFromString(phone, env.defaultPhoneRegion)

  if (!parsed?.isValid()) {
    throw new HttpError(
      'VALIDATION_ERROR',
      'Phone must be a valid phone number.',
      'phone',
    )
  }

  return {
    phone: parsed.number,
    phoneDigits: parsed.number.replace(/\D/g, ''),
  }
}

export function normalizeUserPatch(
  patch: UserNormalizationPatch,
  current: UserNormalizationSource,
): NormalizedUserSet {
  const firstName = normalizeText(patch.firstName ?? current.firstName)
  const lastName = normalizeText(patch.lastName ?? current.lastName)
  const email = normalizeText(patch.email ?? current.email)
  const firstNameFolded = foldText(firstName)
  const lastNameFolded = foldText(lastName)
  const { phone, phoneDigits } = normalizePhone(
    patch.phone === undefined ? current.phone : patch.phone,
  )
  const phoneExtensionSource =
    patch.phoneExtension === undefined
      ? current.phoneExtension
      : patch.phoneExtension
  const phoneExtension =
    phoneExtensionSource === null
      ? null
      : normalizeText(phoneExtensionSource)
  const status = patch.status ?? current.status
  const lastLoginAt = current.lastLoginAt

  return {
    firstName,
    lastName,
    email,
    emailNormalized: email.toLowerCase(),
    phone,
    phoneExtension,
    address: mergeAddress(current.address, patch.address),
    status,
    lastLoginAt,
    firstNameFolded,
    lastNameFolded,
    fullNameFolded: `${firstNameFolded} ${lastNameFolded}`,
    fullNameReversedFolded: `${lastNameFolded} ${firstNameFolded}`,
    phoneDigits,
    statusRank: USER_STATUS_RANK[status],
    lastLoginRank: lastLoginAt === null ? 1 : 0,
  }
}
