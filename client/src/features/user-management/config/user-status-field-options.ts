import type { ISegmentedControlOption } from '../../../shared/ui'
import { USER_STATUSES } from '../model/user-status'
import type { UserStatus } from '../model/user-status'
import { USER_STATUS_PRESENTATION } from './users-status-config'

/**
 * The Status field's `SegmentedControl` options (data-driven-rendering
 * skill): derived once from the same `USER_STATUSES`/
 * `USER_STATUS_PRESENTATION` tables the list's Status column already uses
 * (`config/users-status-config.ts`), so the edit form and the list can
 * never disagree about a status's label.
 */
export const USER_STATUS_FIELD_OPTIONS: readonly ISegmentedControlOption<UserStatus>[] = USER_STATUSES.map(
  (status) => ({ value: status, label: USER_STATUS_PRESENTATION[status].label }),
)
