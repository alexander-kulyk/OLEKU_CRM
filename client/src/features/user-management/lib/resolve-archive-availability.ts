import { USER_MANAGEMENT_COPY } from '../config/user-management-copy'

export interface ArchiveAvailability {
  readonly isDisabled: boolean
  readonly disabledReason: string | undefined
}

/**
 * Whether Archive is offered for the record currently open for editing
 * (specs/user-management/spec.md — "Operator context and deployment phone
 * configuration are explicit inputs"; design.md D6). Missing operator
 * identity disables Archive for every record — enabling it would risk
 * exposing self-archive with no client or server identity policy to block
 * it — and a matching identity disables it for that one record. Never reads
 * browser data as a substitute for the injected `currentOperatorId`.
 */
export function resolveArchiveAvailability(
  currentOperatorId: string | undefined,
  targetUserId: string,
): ArchiveAvailability {
  if (currentOperatorId === undefined) {
    return { isDisabled: true, disabledReason: USER_MANAGEMENT_COPY.archiveUnavailableNoOperator }
  }

  if (currentOperatorId === targetUserId) {
    return { isDisabled: true, disabledReason: USER_MANAGEMENT_COPY.archiveUnavailableSelf }
  }

  return { isDisabled: false, disabledReason: undefined }
}
