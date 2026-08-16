export const USER_STATUSES = ['active', 'inactive', 'blocked'] as const

export type UserStatus = (typeof USER_STATUSES)[number]

export const USER_STATUS_RANK: Readonly<Record<UserStatus, number>> = {
  active: 0,
  inactive: 1,
  blocked: 2,
}
