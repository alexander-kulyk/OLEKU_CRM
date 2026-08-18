/**
 * The optional integration seam `UserManagement`/`UsersPage` accept from
 * the `app` layer (design.md D6). The feature never derives any of these
 * from the browser (locale, timezone, URL data, or editable user data) —
 * when a value is not supplied, the affected behavior SHALL expose a
 * configuration-unavailable state instead of substituting one
 * (specs/user-management/spec.md — "Operator context and deployment phone
 * configuration are explicit inputs").
 */
export interface UsersRuntimeContext {
  /**
   * The signed-in operator's user id, used only to disable Archive with an
   * explanation when it matches the record being edited. Never sourced
   * from anything other than this injected value.
   */
  readonly currentOperatorId?: string
  /**
   * The deployment-wide default phone region (e.g. `UA`), used to parse
   * and validate a national-format phone number the same way the server
   * does. Missing this value blocks ambiguous national-phone input while
   * unambiguous international input remains valid.
   */
  readonly defaultPhoneRegion?: string
  /**
   * Delegates a 401 response to centralized authentication recovery
   * without the feature intentionally closing or resetting a dirty form.
   */
  readonly onUnauthorized?: () => void
}
