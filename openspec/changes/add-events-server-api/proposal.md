## Why

`docs/prd/release 1.0.0/eventsPage.md` describes a calendar where a user creates, opens, updates and deletes events and assigns attendees and hosts. None of it can be built: the server is a bare Express 5 app with one health route, a 404 that echoes the caller's URL, and an inline error handler that returns `error.message` plus a stack trace outside production (research.md EVID-001). There are no modules, models, routers, validation layer, or error envelope. The calendar has nothing to read, the dialog has nothing to write to, and the attendee and host selectors have no directory to populate from.

This change delivers that server slice and nothing else. It also establishes the request-handling shape — controller, service, model, validation at the boundary, one error envelope — that later server features copy.

## What Changes

- **Calendar read** — a period-bounded event read returning every event overlapping the requested range. The period is required; there is no unbounded "all events" read, because the calendar always knows its visible period (research.md F-013, R-008).
- **Event write** — create, update and delete, with the rules the PRD states enforced server-side: non-blank title, end strictly after start, participants that exist, no duplicate assignment. The span invariant is enforced on the actual write path, not only in a document hook — Mongoose's `validate` is document middleware and update validators default to off, so a hook-only invariant is bypassed by a query update (research.md F-009, R-005).
- **Update replaces the whole event** (decision D-002). An update request carries the complete event including both participant lists; an omitted list means "no participants", matching how the Event dialog submits. There is no partial-merge update.
- **Directory read** — contact and employee reads backing the two selectors: literal-text search on either name part, deterministic ordering, a bounded result count, active-only by default, and host-eligibility filtering (research.md R-008, R-009).
- **Eligibility is enforced on write** (decision D-003). Assigning an employee whose `canHostEvents` is false, or a person whose status is not active, is rejected — not merely hidden from the selector. A flag that only filters a dropdown is not a rule.
- **Three Mongoose models** bound to the `contacts`, `employees` and `events` collections carrying the requested field set: contacts gain `status`; employees gain `position`, `department`, `canHostEvents`, `status`; events carry `title`, `startAt`, `endAt`, `attendeeIds`, `hostIds`, and `createdByUserId` / `updatedByUserId`.
- **Audit fields are declared but never client-supplied** (decision D-004). No authentication exists anywhere in tracked source, and project instructions reserve `users` for authentication, so no trustworthy actor value can be produced today. `createdByUserId` and `updatedByUserId` are declared nullable and always written as null. Accepting them from a request would create a forgeable audit trail (research.md F-012).
- **Instants accept a numeric UTC offset, not only `Z`** — FullCalendar formats period boundaries with the browser's local offset, and Zod 4's default ISO parser rejects that form. The abandoned local attempt under `server/dist/` had exactly this bug, which presents as an empty calendar rather than an error (research.md F-005, R-001). Returned instants are always time-bearing and zone-explicit so the calendar does not flip an event into the all-day row (research.md F-004).
- **A shared HTTP foundation** — validation at the route boundary, a single `{ error: { code, message } }` envelope, and centralized error middleware **replacing** today's handler. The 404 stops reflecting the caller's URL and the error path stops emitting `error.message` and stack traces, which contradict the PRD's error-handling rule (research.md R-011).
- **A controller layer** — request handlers live in `<feature>.controller.ts`, separate from the `<feature>.routes.ts` that wires paths to them, as the request asks. `server/CLAUDE.md:13` describes a module as model/routes/service; this adds a file to that convention rather than departing from it (research.md F-016).
- **Zod becomes a declared server dependency.** It resolves at runtime today only because it is physically linked into `server/node_modules` from a reverted install — it appears in neither `server/package.json` nor the lockfile, and vanishes on a clean install (research.md F-019, R-006).
- **A server test gate** (decision D-005) — `node:test` with `mongodb-memory-server`, added as declared dependencies with a `test` script. `pnpm --filter server build` is the only gate that exists today, and it cannot catch the offset-parsing trap or the update-validator gap.
- **An idempotent seed** for contacts and employees. The selectors cannot be exercised against empty collections and no management UI exists.

Out of scope, per the PRD: authentication, roles and permissions, notifications, recurring events, reminders, external calendar and video integrations, attendance tracking. Also out of scope: all client work, and any create/update/delete of contacts or employees — the directory is read-only here. The PRD's §18 deferrals (host overlap, past events, mandatory host, multi-day and all-day events, duration limits, time-zone policy) stay deferred; this change stores instants and does not decide time-zone semantics.

**The FullCalendar question is settled.** The supplied field sketch fits `@fullcalendar/core` 6.1.21 as written — nothing needs renaming, and `title` is FullCalendar's own property name (research.md F-006). But the API returns a **domain shape** (`id`, `title`, `startAt`, `endAt`, resolved `attendees` and `hosts`), not FullCalendar's, with the client mapping documented in design.md. FullCalendar silently absorbs any unrecognized top-level key into `extendedProps` and silently replaces an end that is not after start with a one-hour default (research.md F-002, F-003) — a payload shaped like FullCalendar's has no failure signal for a typo.

## Capabilities

### New Capabilities

- `api-foundation`: The server's shared request-handling contract — boundary validation, the single error envelope, error and not-found behavior, and router mounting order relative to the existing terminal handlers.
- `event-api`: Event persistence and the event endpoints — the period-bounded calendar read, create, whole-object update, delete, the invariants storage cannot enforce, participant assignment semantics, and instant format on both directions of the wire.
- `directory-api`: Contact and employee persistence and their read endpoints — the person shape, search, ordering, result bounding, status filtering, and host eligibility.

### Modified Capabilities

None. `openspec/specs/` is empty (research.md F-020, EVID-021), so there is no capability baseline to modify.

## Impact

**Server** — the only package this change touches. Adds `src/modules/events/`, `src/modules/directory/`, `src/shared/http/`, and a seed; rewrites the error handler and 404 in `src/app.ts` and mounts the new routers above them. `src/shared/config/env.ts` gains nothing — no new environment variables are needed.

**Dependencies** — `zod`, `mongodb-memory-server` and a `test` script are added to `server/package.json` through pnpm from the repo root, with the lockfile committed.

**Database** — MongoDB Atlas via Mongoose 9, which connects today but defines no schemas. This change writes the first schemas and declares the first indexes for `contacts`, `employees` and `events`. `users` is left entirely untouched: it is the future authentication surface, not a people directory.

**Unresolved and carried forward, not assumed:**

- **U-001 — the runtime state of those collections is unverified.** Both existing changes assert they exist and are empty; the Atlas credential needed to confirm it is denied by project settings and was not authorized. This proposal does **not** assert emptiness. Pre-existing documents under different field names would render as wrong or unreadable data, so the collection state must be confirmed before the first write (research.md R-007).
- **A-002 — assumption, unconfirmed.** `status` on contacts and employees is read as an active/inactive lifecycle, and non-active people are not assignable. Decision D-003 gives this assumption teeth by enforcing it on write, so if the intended status values differ, the write rules change with them.
- **Known exposure.** These endpoints read and write a hosted cluster with no authentication, because roles are out of PRD scope (research.md R-002). This is accepted debt for this change, and it constrains where the server may be deployed.

**Accepted overlap (decision D-001).** Two tracked changes already describe this same server surface: `add-events-api` (74 tasks, 0 done) and `add-events-page` (63 tasks, 0 done), the latter under the conflicting field names `name` / `startsAt` / `endsAt`. The decision is that all three coexist; neither is edited or retired by this change. Two consequences follow and are accepted deliberately: the field-naming contradiction stays live, so whoever implements from `add-events-page` ships a different contract than this one; and all three declare the same new capability paths, so archiving more than one of them will require reconciling their specs by hand. Only one of these changes should be implemented and archived.
