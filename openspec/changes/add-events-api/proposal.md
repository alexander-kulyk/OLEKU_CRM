## Why

The server is a bare Express 5 app: `createApp()` registers middleware, one `/api/health` route, a 404 handler, and an inline error handler. There are no modules, no models, no validation layer, and no error envelope. Nothing in `docs/prd/release 1.0.0/eventsPage.md` can be built until the API behind it exists — the calendar has nothing to read, the dialog has nothing to write to, and the attendee and host selectors have no directory to populate from.

This change delivers that server slice, and only that slice. It also establishes the request-handling shape — controller, service, model, Zod validation at the boundary, one error envelope — that every feature after it copies.

## What Changes

- **Event calendar read** — `GET /api/events?from&to` returns every event overlapping the requested period. The range is required; there is no unbounded "all events" read, because the calendar always knows its visible period.
- **Event write** — `POST /api/events`, `PATCH /api/events/:id`, `DELETE /api/events/:id`, with the rules the source document states enforced server-side: non-blank title, `endAt > startAt`, participants must exist, no duplicate assignments.
- **Directory read** — `GET /api/contacts` and `GET /api/employees` back the attendee and host selectors: case-insensitive search on either name part, sorted results, a bounded result count, active-only by default, and a `canHostEvents` filter so the host selector can ask for eligible hosts only.
- **Three Mongoose models** bound explicitly to the existing empty `contacts`, `employees`, and `events` collections, carrying the field set in the request: contacts gain `status`; employees gain `position`, `department`, `canHostEvents`, and `status`; events carry `title`, `startAt`, `endAt`, `attendeeIds`, `hostIds`, and nullable `createdByUserId` / `updatedByUserId`.
- **A shared HTTP foundation** — a Zod validation helper at the route boundary, a single `{ error: { code, message } }` envelope, and centralized error middleware replacing today's inline handler, which currently forwards raw `error.message` and a stack trace.
- **A controller layer** — request handlers live in `<feature>.controller.ts`, separate from the `<feature>.routes.ts` that wires paths to them, so HTTP concerns never leak into the services.
- **Seed and tests** — an idempotent seed for `contacts` and `employees` (the selectors cannot be exercised against empty collections, and no management UI exists), plus `node:test` integration tests against `mongodb-memory-server`.

**Verified before designing, as requested:** FullCalendar 6.1.21 requires only a resolvable `start`; `title`, `start`, `end`, `allDay`, and `extendedProps` are the properties that matter here. Two behaviors drive server-side decisions. It **silently discards an `end` that is not after `start`** and substitutes a one-hour default — so an inverted range renders as a wrong block rather than an error, which is why `endAt > startAt` is enforced twice server-side. And **any unrecognized top-level key silently becomes an `extendedProps` entry** — a typo does not fail, it renders an untitled event. The API therefore returns a **domain shape** (`id`, `title`, `startAt`, `endAt`, `attendees[]`, `hosts[]`), not FullCalendar's, with the client mapping documented in `design.md`. The database sketch survives verification with one adjustment: `title` is adopted verbatim because it is FullCalendar's own property name, and `startAt` / `endAt` replace the `name` / `startsAt` / `endsAt` in `add-events-page`.

Out of scope, per the source document: authentication, roles and permissions, notifications, recurring events, reminders, external calendar and video integrations, and attendance tracking. Also out of scope: all client work, and any create/update/delete of contacts or employees — the directory is read-only here.

## Capabilities

### New Capabilities

- `api-foundation`: The server's shared request-handling contract — Zod validation at the HTTP boundary, the single error envelope, error middleware and status mapping, and router mounting order relative to the existing 404 and error handlers.
- `event-api`: Event persistence and the event endpoints — the calendar range read, create, update, delete, the invariants MongoDB cannot enforce, participant assignment semantics, and the payload's compatibility with FullCalendar.
- `directory-api`: Contact and employee persistence and their read endpoints — the person shape, search, sorting, result cap, active-status filtering, and host eligibility.

### Modified Capabilities

None. `openspec/specs/` is empty, so nothing exists to modify.

**Supersession note:** the committed change `openspec/changes/add-events-page` declares `event-calendar`, `event-management`, and `event-participants` and covers this same server surface as part of a full-stack change (0 of its 63 tasks are done). Its server-side requirements, its API field names (`name`, `startsAt`, `endsAt`), and its server tasks are superseded by this change. Its client-side requirements stand. The two documents disagree until `add-events-page` is revised; this change does not edit it.

## Impact

**Server** — the only package this change touches. Adds `src/modules/events/`, `src/modules/directory/`, `src/shared/http/`, and `src/shared/db/seed.ts`; rewrites the error handler in `src/app.ts` and mounts two routers above the catch-all 404. `src/shared/config/env.ts` gains nothing — no new environment variables are needed.

**Database** — MongoDB Atlas via Mongoose 9, which connects today but defines no schemas. `contacts`, `employees`, and `events` already exist and are empty, with no validators and no indexes beyond `_id`. This change writes their first schema and declares their first indexes. No migration is needed, and no data is at risk — but the same is not true after this change lands. `users` is left entirely untouched: it is the future authentication surface, not a people directory.

**Audit fields** — `createdByUserId` and `updatedByUserId` are declared as nullable references and always written as `null`. There is no authenticated actor to fill them, and accepting them from a request body would be a forgeable audit trail, so they are never client-settable and never returned. The authentication change populates them later without a schema migration.

**Dependencies** — adds `zod` to `server` dependencies and `mongodb-memory-server` to `server` dev dependencies. The client is untouched; no root dependency changes.

**Prior work** — a previous attempt at this feature exists only as untracked build output under `server/dist/`, which is gitignored and will vanish on the next clean build. No source was ever committed. It is evidence of the intended shape, not code to reuse.

**Security** — these endpoints are unauthenticated, because roles are out of scope by the source document, and they write to a shared personal Atlas cluster that hosts unrelated databases. Anyone who can reach the server can read and modify every event and the full directory. The API must not be exposed beyond local development until the authorization change lands. Recorded here as known debt, not a later discovery.

**Deferred product decisions** (§18 of the source document) — overlap rules, past-event restrictions, mandatory hosts, multi-day and all-day events, duration limits, recurrence, notification triggers, and time-zone policy are left unimplemented. The specs take the permissive reading: events are single-day and timed, hosts are optional, past dates are allowed, overlaps are not blocked, and times are stored as UTC instants.
