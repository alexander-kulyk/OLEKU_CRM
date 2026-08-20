// Public API for the `user-management` feature slice
// (specs/user-management/spec.md; design.md D1). Populated incrementally as
// later stages add list/edit/archive UI
// (openspec/changes/add-users-client-ui/tasks.md Stages 4-7) — Stage 3
// established the slice boundary, its internal DTO/query/patch/runtime
// contracts, and its API adapter; Stage 4 added the server-driven list;
// Stage 6 wires list + edit + archive + conflict/runtime-context recovery
// into one composed `UserManagement` entry point.
// `UserManagement` is not yet wired into `/users` — that composition is
// Stage 7's `pages/users` boundary — but is exported here so that stage
// only needs to import this slice's public API.
export type { UsersRuntimeContext } from './model/users-runtime-context'

export { UsersList } from './ui/UsersList'
export { UserManagement } from './ui/UserManagement'
export type { UserManagementProps } from './ui/UserManagement'
