import type { UserPatchPayload } from '../../model/user-patch'
import { diffNormalizedUserFormValues } from './diff-user-form-fields'
import type { NormalizedUserFormValues } from './normalize-user-form-values'

/**
 * The merge-patch builder (task 5.2): a dirty valid form's `PATCH
 * /api/users/:userId` body, or `null` for a normalized-clean form — never a
 * version-only request (specs/user-management/spec.md — "Save sends a
 * normalized versioned merge patch": "For a normalized-clean form, Save
 * SHALL send no PATCH"; server `userPatchSchema` `NO_CHANGES_SUBMITTED`).
 * `version` is attached only once the diff has already proven there is at
 * least one real mutable change, so a clean form can never accidentally
 * produce a version-only payload.
 */
export function buildUserPatch(
  current: NormalizedUserFormValues,
  original: NormalizedUserFormValues,
  version: number,
): UserPatchPayload | null {
  const fieldsPatch = diffNormalizedUserFormValues(current, original)

  if (fieldsPatch === null) {
    return null
  }

  return { ...fieldsPatch, version }
}
