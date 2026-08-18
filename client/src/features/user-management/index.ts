// Public API for the `user-management` feature slice
// (specs/user-management/spec.md; design.md D1). Populated incrementally as
// later stages add list/edit/archive UI
// (openspec/changes/add-users-client-ui/tasks.md Stages 4-7) — Stage 3 only
// establishes the slice boundary, its internal DTO/query/patch/runtime
// contracts, and its API adapter, most of which stay internal to the
// feature until a page or app-level provider needs them.
export type { UsersRuntimeContext } from './model/users-runtime-context'
