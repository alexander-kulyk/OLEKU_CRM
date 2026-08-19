import type { UserStatus } from '../model/user-status'

/**
 * (status) -> presentation. A table rather than a switch/ternary chain, so a
 * row's muted treatment and its badge can never describe a different status
 * than the explicit text next to it (data-driven-rendering skill;
 * specs/user-management/spec.md — "Users table presents operational
 * records": "blocked SHALL remain distinguishable from inactive without
 * relying on color alone").
 */
export interface UserStatusPresentation {
  /** The exact text the Status cell SHALL contain — never inferred from color. */
  readonly label: string
  readonly badgeClassName: string
  /** Inactive and blocked rows use this; active rows use the standard row treatment. */
  readonly isRowMuted: boolean
}

export const USER_STATUS_PRESENTATION: Readonly<Record<UserStatus, UserStatusPresentation>> = {
  active: {
    label: 'Active',
    badgeClassName: 'bg-success-tint text-success',
    isRowMuted: false,
  },
  inactive: {
    label: 'Inactive',
    badgeClassName: 'bg-surface-sunken text-ink-secondary',
    isRowMuted: true,
  },
  blocked: {
    label: 'Blocked',
    badgeClassName: 'bg-danger-tint text-danger',
    isRowMuted: true,
  },
}
