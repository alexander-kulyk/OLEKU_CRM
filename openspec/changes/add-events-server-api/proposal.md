## Why

`docs/prd/release 1.0.0/eventsPage.md` describes a calendar where a user creates, opens, updates and deletes events and assigns attendees and hosts. None of it can be built: the server is a bare Express 5 app with one health route, a 404 that echoes the caller's URL, and an inline error handler that returns `error.message` plus a stack trace outside production (research.md EVID-001). There are no modules, models, routers, validation layer, or error envelope. The calendar has nothing to read, the dialog has nothing to write to, and the attendee and host selectors have no directory to populate from.

This change delivers that server slice and nothing else. It also establishes the request-handling shape — controller, service, model, validation at the boundary, one error envelope — that later server features copy.

## What Changes

- **Canonical server contract** — this change supersedes `add-events-api` and the server-side requirements and tasks in `add-events-page`. Only `add-events-server-api` is to be implemented and archived for this server surface; the client-side scope of `add-events-page` remains valid but must consume this change's wire contract.
- **Calendar read** — `GET /api/events?from=<instant>&to=<instant>` returns `{ events: [...] }` containing every event that overlaps the required period. There is no unbounded event read (research.md F-013, R-008).
- **Event write** — `POST /api/events`, `PATCH /api/events/:id`, and `DELETE /api/events/:id` create, partially update, and delete events. `PATCH` changes only supplied fields; omitting a participant array leaves it unchanged, while supplying an empty array clears that role. The span invariant is enforced on the actual write path, not only in a document hook (research.md F-009, R-005).
- **Participant rules** — attendees resolve to contacts and hosts resolve to employees; duplicate ids collapse to one assignment. On create, every participant must exist and be active, and every host must have `canHostEvents=true`. On update, those rules apply to newly added assignments; an already assigned person may be retained after becoming inactive or ineligible, so an unrelated edit never invalidates historical participation.
- **Directory read** — `GET /api/contacts` returns `{ contacts: [...] }` and `GET /api/employees` returns `{ employees: [...] }`. Both accept optional `search` and `status`; employees additionally accept `canHostEvents`. Search treats input literally, ordering is deterministic, active-only is the default, and the server applies a fixed result cap rather than exposing a caller-controlled size parameter.
- **Three Mongoose models** — `contacts` carry `firstName`, `lastName`, `email`, and `status`; `employees` additionally carry `position`, `department`, and `canHostEvents`; `events` carry `title`, `startAt`, `endAt`, participant ids, and `createdByUserId` / `updatedByUserId`. `status` is the closed lifecycle `active | inactive`, with `active` as the default; `canHostEvents` defaults to false.
- **Server-controlled audit fields** — no authentication exists, so `createdByUserId` and `updatedByUserId` are nullable and always written as null. They are not part of an accepted request or response shape; a client-supplied value is ignored rather than persisted (research.md F-012).
- **Explicit v1 time semantics** — accepted instants carry `Z` or a numeric UTC offset, are stored as absolute UTC instants, and are returned as time-bearing ISO strings with a zone designator. The broader product decision about business-local or per-event time zones remains deferred, but v1 does not leave its storage semantics ambiguous (research.md F-004, F-005, R-012).
- **Shared HTTP foundation** — boundary validation, the exact `{ error: { code, message } }` failure envelope, and centralized error and not-found handlers replace today's leaking terminal handlers. Success collections use the named wrappers above; create and update return the event directly; delete returns 204 with no body.
- **Controller layer** — request handlers live in `<feature>.controller.ts`, separate from route wiring and HTTP-free services, as the request asks (research.md F-016).
- **Declared dependencies and verification** — `zod` and `mongodb-memory-server` are declared through pnpm with the lockfile committed, and a `node:test` integration gate is added without replacing `pnpm --filter server build`. The test harness must assign its in-memory URI to `process.env.DB_HOST` before importing any module that reads `env.ts`, so tests are structurally unable to connect to Atlas.
- **Directory-only development seed** — an explicit idempotent script populates contacts and employees for local or scratch environments. It never runs on startup and never touches `events` or `users`.

Out of scope, per the PRD: authentication, roles and permissions, notifications, recurring events, reminders, external calendar and video integrations, attendance tracking, client implementation, and create/update/delete operations for contacts or employees. The PRD's remaining §18 decisions — overlaps, past events, mandatory hosts, multi-day and all-day events, duration limits, and the future time-zone policy — stay deferred.

**The FullCalendar question is settled.** The supplied field sketch fits `@fullcalendar/core` 6.1.21 as written. The API deliberately returns the domain shape `{ id, title, startAt, endAt, attendees, hosts }`, which the client maps to FullCalendar. FullCalendar silently absorbs unrecognized top-level fields into `extendedProps` and silently substitutes a default duration for an invalid end, so emitting its native shape would turn server mistakes into plausible but wrong rendering (research.md F-002, F-003, F-006).

## Capabilities

### New Capabilities

- `api-foundation`: Boundary validation; exact success and failure shapes; error, not-found, and health behavior; router ordering.
- `event-api`: Exact event routes and payloads; bounded period read; create, partial update, delete; instant semantics; participant and audit rules.
- `directory-api`: Exact contact and employee reads; response projections; literal search; deterministic ordering; fixed bounding; status and eligibility filtering.

### Modified Capabilities

None. `openspec/specs/` is empty (research.md F-020, EVID-021), so there is no archived capability baseline to modify.

## Impact

**Server** — the only package whose application code changes. Adds events and directory modules plus a shared HTTP layer and seed; replaces the inline 404 and error handler; mounts feature routers above them. No new environment variable is introduced.

**Dependencies** — adds `zod` as a server dependency, `mongodb-memory-server` as a server development dependency, and a `test` script through pnpm, committing the updated lockfile.

**Database precondition** — U-001 remains intentionally unverified. Before implementation writes data, the user or an authorized database owner must perform a read-only check of the actual `contacts`, `employees`, and `events` collection names, counts, and one sample from each non-empty collection. The executor does not read credentials and does not edit planning artifacts to record this; the orchestrator/verifier records the supplied observation in the Stage report. Existing documents under `name` / `startsAt` / `endsAt` stop implementation for a migration decision.

**Database writes** — after the precondition passes, the change declares the first application schemas and indexes for `contacts`, `employees`, and `events`. `users` remains untouched.

**Security** — these endpoints remain unauthenticated because authorization is out of scope. They must not be exposed beyond local development until an authorization change lands (research.md R-002).

**Supersession** — `add-events-api` must not be implemented or archived after this change is selected. The server requirements and tasks in `add-events-page` are superseded; its future client implementation must use this change's `title` / `startAt` / `endAt` contract.
