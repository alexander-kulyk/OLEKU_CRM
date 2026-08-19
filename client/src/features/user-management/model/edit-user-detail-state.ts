import type { UserDetailDto } from './user-dto'

/**
 * What `EditUserDialog` needs to know about its detail-before-edit read
 * (specs/user-management/spec.md — "Editing starts from current detail
 * data"). This stage builds the dialog to accept either phase as a prop —
 * `'loading'` renders a loading placeholder inside the open dialog shell,
 * `'ready'` renders the actual form bound to `detail` — without owning the
 * `GET /api/users/:userId` request itself. Issuing that request, deciding
 * when to mount this dialog at all, and reacting to a 404/archived detail
 * response are Stage 6's async hooks/reducer
 * (openspec/changes/add-users-client-ui/tasks.md task 6.1).
 */
export type EditUserDetailState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly detail: UserDetailDto }
