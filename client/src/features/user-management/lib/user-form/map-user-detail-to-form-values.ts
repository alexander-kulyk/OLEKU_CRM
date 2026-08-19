import type { UserDetailDto } from '../../model/user-dto'
import type { UserFormValues } from './user-form-schema'

/**
 * Detail-to-form mapping (task 5.2): the pure, one-way translation from a
 * `GET /api/users/:userId` response into the Edit User form's starting
 * values. Never reads a `UserListItemDto` — the detail DTO (with its
 * `version`) is the only supported edit-session source
 * (specs/user-management/spec.md — "Editing starts from current detail
 * data"; do-not guardrail: "Hydrate edits from list rows").
 *
 * Every nullable detail member becomes an empty string: a native `<input>`
 * has no `null` value, so "not provided" is represented as `''`
 * throughout the flat form model (`UserFormValues`), the same way a
 * missing `address` maps every one of its four flat properties to `''`
 * rather than leaving the form uninitialized.
 */
export function mapUserDetailToFormValues(detail: UserDetailDto): UserFormValues {
  return {
    firstName: detail.firstName,
    lastName: detail.lastName,
    email: detail.email,
    phone: detail.phone ?? '',
    phoneExtension: detail.phoneExtension ?? '',
    addressCountry: detail.address?.country ?? '',
    addressCity: detail.address?.city ?? '',
    addressStreet: detail.address?.street ?? '',
    addressPostalCode: detail.address?.postalCode ?? '',
    status: detail.status,
  }
}
