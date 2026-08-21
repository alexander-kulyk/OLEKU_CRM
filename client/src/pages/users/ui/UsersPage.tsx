import type React from 'react'
import { UserManagement } from '../../../features/user-management'
import type { UserManagementProps } from '../../../features/user-management'

/**
 * The `/users` destination (specs/app-navigation/spec.md — "Users is an
 * operational destination"). A thin composition over the feature's public
 * `UserManagement` entry point (design.md D1, D6): this page owns no Users
 * domain logic of its own and only forwards the optional runtime-context
 * seam (current operator id, deployment phone region, 401 recovery) through
 * to the feature. No app-level provider supplies that context yet, so it
 * stays unset here until a future authentication/settings provider is
 * wired in at the `app` layer.
 */
export const UsersPage: React.FC<UserManagementProps> = ({ runtimeContext }) => (
  <UserManagement runtimeContext={runtimeContext} />
)
