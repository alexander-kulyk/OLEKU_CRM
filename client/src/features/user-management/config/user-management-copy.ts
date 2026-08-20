/**
 * Static copy the controller (`model/use-user-management-controller.ts`)
 * decides to show, as opposed to `user-form-copy.ts` (labels the dialog's
 * own markup always renders) and `users-error-messages.ts` (per-code
 * failure text). Kept separate because these strings are selected by
 * runtime-context/recovery decisions, not by which component is rendering
 * (design.md D1 — "copy stays in feature configuration").
 */
export const USER_MANAGEMENT_COPY = {
  /**
   * specs/user-management/spec.md — "Operator context and deployment phone
   * configuration are explicit inputs": missing operator identity disables
   * Archive for every record, because enabling it could expose self-archive
   * with no client or server identity policy to prevent it.
   */
  archiveUnavailableNoOperator: 'Archive is unavailable because the current operator could not be verified.',
  archiveUnavailableSelf: 'You cannot archive your own account.',
  /**
   * specs/user-management/spec.md — "Operator context and deployment phone
   * configuration are explicit inputs": "without one, the form stays intact
   * and shows an authentication-recovery-unavailable operation error."
   */
  authRecoveryUnavailable:
    'Your session may have expired, but automatic sign-in recovery is not available in this environment. Your changes have been kept — sign in again in another tab, then retry.',
  /** Shown for a detail read that succeeds but reports the record as archived. */
  recordArchivedElsewhere: 'This user has been archived elsewhere. The list has been refreshed.',
  dismissNotice: 'Dismiss',
} as const
