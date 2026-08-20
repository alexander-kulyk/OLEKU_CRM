/**
 * The four stacked confirmations `UserManagement`'s controller can open on
 * top of an already-open Edit User dialog (design.md D5 — "Similar
 * confirmation presentation is driven by a typed config keyed by
 * confirmation kind rather than separate boolean flags or repeated JSX").
 * `archived-acknowledge` is not a yes/no choice — both its actions lead to
 * the same outcome (close and refetch) — but it is still driven by the same
 * `ConfirmDialog` shape so the whole set renders from one config-driven
 * site in `UserManagement.tsx` (data-driven-rendering skill).
 */
export type UserManagementConfirmationKind =
  | 'archive'
  | 'discard-close'
  | 'discard-reload'
  | 'archived-acknowledge'

interface UserManagementConfirmationPresentation {
  readonly title: string
  readonly message: string
  readonly confirmLabel: string
  readonly cancelLabel: string
  readonly isDangerous?: boolean
}

/**
 * (confirmation kind) -> presentation. The `archive` message deliberately
 * never calls archiving irreversible (specs/user-management/spec.md —
 * "Archive is confirmed and server-authoritative": "the message SHALL NOT
 * call archival irreversible"); it only explains that the user leaves the
 * Users list while historical information is preserved.
 */
export const USER_MANAGEMENT_CONFIRMATION_CONFIG: Readonly<
  Record<UserManagementConfirmationKind, UserManagementConfirmationPresentation>
> = {
  archive: {
    title: 'Archive this user?',
    message: 'The user will be removed from the Users list. Their historical information is preserved.',
    confirmLabel: 'Archive user',
    cancelLabel: 'Cancel',
    isDangerous: true,
  },
  'discard-close': {
    title: 'Discard changes?',
    message: 'Your unsaved changes will be lost.',
    confirmLabel: 'Discard changes',
    cancelLabel: 'Continue editing',
  },
  'discard-reload': {
    title: 'Discard changes?',
    message: 'Reloading the latest version will replace your unsaved changes.',
    confirmLabel: 'Discard changes',
    cancelLabel: 'Continue editing',
  },
  'archived-acknowledge': {
    title: 'This user was archived',
    message: 'Another operator archived this user while you were editing it. Your changes were not saved.',
    confirmLabel: 'OK',
    cancelLabel: 'Close',
  },
}
