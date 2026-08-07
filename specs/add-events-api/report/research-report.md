# Research Report: Server-side Events API (events, contacts, employees)

## Executive summary

**Requested outcome.** Build the server side of the Events page defined in
`docs/prd/release 1.0.0/eventsPage.md`: Express endpoints plus controller/service/model
layers for fetching events for the calendar, creating, updating and deleting an event,
and read endpoints for contacts and employees that back the attendee and host selectors.
The prompt also supplies a revised domain sketch (`events.title/startAt/endAt/attendeeIds/
hostIds/createdByUserId/updatedByUserId`, `employees.position/department/canHostEvents/
status`, `contacts.status`) and explicitly asks that the FullCalendar event contract be
verified first, because the sketched database schema may not match what the calendar needs.

**Current state.** The server is a bare Express 5 app: `createApp()` registers `helmet`,
`cors`, `morgan`, body parsers, a single `/api/health` route, a catch-all 404 and an
inline error handler (`server/src/app.ts:7-44`). There are **no** modules, models,
routers, validation layer, tests or error envelope in tracked source — `server/src/`
contains only `app.ts`, `main.ts`, `server.ts`, `shared/config/env.ts` and
`shared/infra/mongoose/client.ts`. `zod` is not a server dependency
(`server/package.json:14-21`, `pnpm-lock.yaml:83-115`).

A previous attempt at exactly this feature exists **only as untracked build output** under
`server/dist/` (gitignored via `.gitignore:2`). `git show --stat bce2dbf` proves that the
commit whose message claims to implement the Events page contained *only* the seven
`openspec/changes/add-events-page/*` files — no `server/src` or `client/src` code was ever
committed. That `dist/` output is therefore high-value evidence of the intended shape, not
code that can be reused as-is, and it will disappear on the next clean build.

The committed OpenSpec change `openspec/changes/add-events-page/` (proposal, design, three
capability specs, tasks) is the project's own settled design for this feature and is the
strongest available statement of intent.

**Recommendation.** Implement the server slice as three additions that follow the
committed design and the package instructions verbatim — `shared/http/` (error envelope,
error middleware, Zod validate helper), `modules/directory/` (Contact + Employee models,
service, thin route controllers), `modules/events/` (Event model, Zod schemas, service,
thin route controllers) — mounted under `/api` above the existing 404 and error handlers.
Adopt the prompt's field names (`title`, `startAt`, `endAt`) because they are strictly
closer to the FullCalendar contract than the committed design's `name`/`startsAt`/`endsAt`
and the collections are empty, so renaming costs nothing. Keep the wire format **domain
shaped**, not FullCalendar shaped, and document the one-line client mapping.

**Overall risk: medium-low.** Greenfield code against empty collections, no deployed
consumer, no migration. The three real risks are (1) a Zod/FullCalendar ISO-offset
mismatch that would reject every calendar request, (2) unauthenticated write endpoints
against a shared hosted Atlas cluster, and (3) `createdByUserId`/`updatedByUserId` being
unfillable because authentication does not exist yet.

---

## Requirements baseline

### Goals

- Expose a calendar read endpoint that returns every event overlapping a requested period.
- Expose create, update and delete endpoints for a single event.
- Expose read endpoints for contacts (attendee candidates) and employees (host candidates),
  with search, so the dialog's selectors can be populated.
- Persist events, contacts and employees in the existing `events`, `contacts` and
  `employees` MongoDB collections with the field set named in the prompt.
- Guarantee the response payload can drive FullCalendar 6.1.21 without loss or ambiguity.
- Enforce, server-side, every rule the PRD states about event data: non-blank title,
  `endAt > startAt`, no duplicate participants, participants must exist.
- Establish the server's reusable request-handling shape (validation, error envelope) that
  later features copy.

### Non-goals

- Any client work. The Events page UI, the dialog, FullCalendar wiring and TanStack Query
  hooks are explicitly out of this request ("for server side").
- Authentication, authorization and roles — out of scope by `docs/prd/release 1.0.0/eventsPage.md:32`
  and by the committed proposal (`openspec/changes/add-events-page/proposal.md:19`).
- Contact and employee management CRUD (create/update/delete of people). Read-only only.
- Notifications, recurring events, reminders, external calendar/video integrations,
  attendance tracking (`docs/prd/release 1.0.0/eventsPage.md:32-38`).
- All-day events, multi-day events, overlap rules, past-event restrictions, mandatory
  hosts, duration limits, time-zone policy — deferred product decisions
  (`docs/prd/release 1.0.0/eventsPage.md:596-611`).
- Pagination for the directory endpoints (`openspec/changes/add-events-page/design.md:33`
  — search plus a result cap only).
- A shared client/server types package (`openspec/changes/add-events-page/design.md:31`).

### Constraints

| # | Constraint | Evidence |
| --- | --- | --- |
| C-1 | Express 5 + TypeScript + Mongoose 9 on Node ≥ 24.18; TypeScript runs natively via `node --watch src/main.ts`, so **relative imports must carry the `.ts` extension** | `server/CLAUDE.md:3-5`, `server/package.json:10`, `server/src/app.ts:5` |
| C-2 | Only erasable TypeScript — no enums, no parameter properties, no decorators | `openspec/changes/add-events-page/design.md:12` |
| C-3 | Feature code lives in `src/modules/<feature>/` (model, routes, service); routers mount under `/api` | `server/AGENTS.md:15`, `server/CLAUDE.md:13-14` |
| C-4 | Environment variables are read **only** in `src/shared/config/env.ts`; `DB_HOST` is the Mongo URI | `server/AGENTS.md:21`, `server/src/shared/config/env.ts:21` |
| C-5 | Validate request input with Zod at the HTTP boundary | `server/AGENTS.md:22`, `server/CLAUDE.md:21` |
| C-6 | New routers mount **above** the catch-all 404 and the final error handler | `server/AGENTS.md:25`, `server/CLAUDE.md:22` |
| C-7 | `contacts` = clients, `employees` = staff, `users` = authentication only; do not attach CRM person data to `users` | `server/AGENTS.md:27-28`, `server/CLAUDE.md:24-25` |
| C-8 | pnpm only; install with `pnpm --filter server add <pkg>` from the repo root; commit `pnpm-lock.yaml` | `AGENTS.md:22-25`, `CLAUDE.md` |
| C-9 | Verification gate is `pnpm --filter server build`. There is no lint or test script today; a new one must be documented and run without replacing the build gate | `server/AGENTS.md:35-36`, `AGENTS.md:37-38` |
| C-10 | Do not hand-edit `node_modules/` or `dist/` | `AGENTS.md:26` |
| C-11 | `.ai_toolkit/` is a submodule; do not edit it as part of an application change | `AGENTS.md:14-15` |
| C-12 | The database is a **shared personal Atlas cluster** hosting unrelated databases; nothing may treat it as disposable | `openspec/changes/add-events-page/design.md:11` |
| C-13 | FullCalendar 6.1.21 is the calendar library already installed on the client | `client/package.json:11-15` |

### Capabilities

| ID | Capability | Summary |
| --- | --- | --- |
| CAP-A | HTTP foundation | Zod boundary validation, a single `{ error: { code, message } }` envelope, centralized error middleware, router mounting order |
| CAP-B | Directory persistence | Contact and Employee Mongoose models bound to `contacts` / `employees` |
| CAP-C | Directory read API | `GET /api/contacts`, `GET /api/employees` with search, status filter and host-eligibility filter |
| CAP-D | Event persistence | Event Mongoose model bound to `events`, with invariants Mongo cannot enforce |
| CAP-E | Event calendar read API | `GET /api/events?from&to` overlap query returning FullCalendar-mappable payloads |
| CAP-F | Event write API | `POST`, `PATCH /:id`, `DELETE /:id` with participant validation and wholesale replacement |
| CAP-G | FullCalendar contract compatibility | Verified mapping from the API payload to `EventInput`, including ISO offset handling |
| CAP-H | Seed data and verification | Idempotent seed for `contacts` / `employees`, integration tests, build gate |

### Requirements and acceptance scenarios

#### CAP-A — HTTP foundation

- **REQ-001** — Every request body, query and path parameter reaching an events or
  directory handler SHALL be parsed by a Zod schema at the HTTP boundary before any
  database access, and a parse failure SHALL produce HTTP 400.
  - GIVEN a request to any new endpoint
  - WHEN its query, params or body fail the endpoint's Zod schema
  - THEN the response status is 400
  - AND no read or write is performed against MongoDB

- **REQ-002** — All error responses from the new endpoints SHALL use a single envelope
  `{ error: { code: string, message: string } }` and SHALL NOT contain a stack trace, a raw
  Mongoose/driver message, a connection string, or any internal identifier.
  - GIVEN any handled or unhandled failure in a new endpoint
  - WHEN the response is produced
  - THEN the body has exactly the shape `{ error: { code, message } }`
  - AND the body contains no `stack`, no driver text and no `DB_HOST` fragment

- **REQ-003** — The new routers SHALL be mounted under `/api` in `createApp()` after the
  existing middleware and **before** the catch-all 404 handler and the final error handler;
  `/api/health` SHALL keep working unchanged.
  - GIVEN the application is started
  - WHEN `GET /api/health` is called
  - THEN it returns `{ status: 'ok' }` with status 200
  - AND WHEN an unknown route under `/api` is called
  - THEN the 404 handler responds in the shared envelope

- **REQ-004** — Errors raised by Mongoose (`CastError`, `ValidationError`) SHALL be mapped
  to HTTP 400 in the shared envelope rather than surfacing as HTTP 500.
  - GIVEN a request that reaches Mongoose with a value Mongoose rejects
  - WHEN the error propagates to the error middleware
  - THEN the response status is 400 with a user-facing message

#### CAP-B — Directory persistence

- **REQ-005** — A `Contact` model SHALL be bound explicitly to the existing `contacts`
  collection with `firstName` (required), `lastName` (required), `email` (optional,
  trimmed, lowercased), `status`, timestamps, and a `fullName` virtual.
  - GIVEN a contact document is saved
  - WHEN it is read back
  - THEN it is stored in `contacts`
  - AND `fullName` renders `"<firstName> <lastName>"`

- **REQ-006** — An `Employee` model SHALL be bound explicitly to the existing `employees`
  collection with `firstName` (required), `lastName` (required), `email` (optional),
  `position` (optional), `department` (optional), `canHostEvents` (boolean),
  `status`, timestamps, and a `fullName` virtual.
  - GIVEN an employee document is saved
  - WHEN it is read back
  - THEN it is stored in `employees` and carries `position`, `department`,
    `canHostEvents` and `status`

- **REQ-007** — The `users` collection SHALL NOT be modelled, read or written by this
  change.
  - GIVEN the full server test suite and the seed script have run
  - WHEN `users` is inspected
  - THEN it is unchanged and holds no CRM person data

#### CAP-C — Directory read API

- **REQ-008** — `GET /api/contacts` SHALL return contacts as
  `{ id, firstName, lastName, fullName, email?, status }`, sorted by last name then first
  name, filtered by an optional case-insensitive `search` matching either name part,
  restricted to a bounded result count.
  - GIVEN contacts "Anna Kovalenko" and "Marco Rossi" exist
  - WHEN `GET /api/contacts?search=ross` is called
  - THEN only Marco Rossi is returned
  - AND the response is `{ contacts: [ ... ] }`

- **REQ-009** — `GET /api/employees` SHALL return employees as
  `{ id, firstName, lastName, fullName, email?, position?, department?, canHostEvents,
  status }` with the same search, sort and cap semantics, plus an optional
  `canHostEvents` filter so the host selector can request only eligible hosts.
  - GIVEN an employee with `canHostEvents: false` and one with `canHostEvents: true`
  - WHEN `GET /api/employees?canHostEvents=true` is called
  - THEN only the eligible employee is returned

- **REQ-010** — Both directory endpoints SHALL return only records whose `status` is
  active unless an explicit status filter requests otherwise.
  - GIVEN a contact whose `status` is not active
  - WHEN `GET /api/contacts` is called without a status filter
  - THEN that contact is not in the response

- **REQ-011** — Directory `search` input SHALL be treated as a literal string: regular
  expression metacharacters SHALL be escaped and the search term length SHALL be bounded.
  - GIVEN `GET /api/contacts?search=.*`
  - WHEN the query runs
  - THEN it matches only records literally containing `.*`, and does not scan unbounded

#### CAP-D — Event persistence

- **REQ-012** — An `Event` model SHALL be bound explicitly to the existing `events`
  collection with `title` (required, trimmed, non-blank), `startAt` (required `Date`),
  `endAt` (required `Date`), `attendeeIds` (`ObjectId[]`, ref `Contact`, default `[]`),
  `hostIds` (`ObjectId[]`, ref `Employee`, default `[]`), `createdByUserId` and
  `updatedByUserId` (nullable `ObjectId`, ref `User`), and timestamps.
  - GIVEN an event is created
  - WHEN the raw document is inspected
  - THEN it lives in `events` and carries exactly those paths

- **REQ-013** — `endAt` SHALL be later than `startAt`, enforced both in the Zod request
  schema (400) and in the Mongoose model, so a write that bypasses the route cannot store
  an inverted range.
  - GIVEN a create or update request with `endAt <= startAt`
  - WHEN it is submitted
  - THEN the response is 400 in the shared envelope
  - AND no document is written or modified

- **REQ-014** — `attendeeIds` and `hostIds` SHALL never contain a duplicate identifier,
  de-duplicated both in the request schema and by a Mongoose path setter.
  - GIVEN a create or update request listing the same contact id twice
  - WHEN it succeeds
  - THEN the stored `attendeeIds` contains exactly one entry for that contact

- **REQ-015** — The `events` collection SHALL carry an index supporting the calendar's
  range query.
  - GIVEN the application connects
  - WHEN indexes are listed on `events`
  - THEN an index on `{ startAt: 1, endAt: 1 }` exists

#### CAP-E — Event calendar read API

- **REQ-016** — `GET /api/events` SHALL require `from` and `to` ISO 8601 date-time query
  parameters and SHALL return every event overlapping the half-open interval
  `[from, to)` — i.e. `startAt < to AND endAt > from` — sorted ascending by `startAt`.
  - GIVEN an event from 14:00 to 15:30 on 2026-08-10
  - WHEN `from` = 2026-08-10T00:00 and `to` = 2026-08-11T00:00
  - THEN the event is returned
  - AND WHEN `from` = 2026-08-10T15:00 and `to` = 2026-08-10T16:00 (straddling the end)
  - THEN the event is still returned
  - AND WHEN `from` = 2026-08-11T00:00 and `to` = 2026-08-12T00:00
  - THEN the event is not returned

- **REQ-017** — `from` and `to` SHALL accept ISO 8601 strings **with a numeric UTC offset**
  (for example `2026-08-01T00:00:00+03:00`) as well as `Z`, because that is what
  FullCalendar produces from its rendered range.
  - GIVEN `from=2026-08-01T00:00:00%2B03:00` and `to=2026-09-01T00:00:00%2B03:00`
  - WHEN the request is made
  - THEN the response is 200 and the range is interpreted as the corresponding UTC instants

- **REQ-018** — `GET /api/events` SHALL reject a request where `to` is not strictly after
  `from`, and SHALL reject a range wider than a documented maximum span, so the endpoint
  can never degenerate into an unbounded collection scan.
  - GIVEN `to <= from`, or a span greater than the configured maximum
  - WHEN the request is made
  - THEN the response is 400 in the shared envelope

- **REQ-019** — Each returned event SHALL carry `id` as a **string**, `title`, `startAt`
  and `endAt` as ISO 8601 UTC instants, and `attendees` / `hosts` resolved to
  `{ id, firstName, lastName, fullName }`, so the client can build a FullCalendar event
  without a second request.
  - GIVEN an event with two attendees and one host
  - WHEN it is returned by `GET /api/events`
  - THEN `id` is a 24-character hex string, not an object
  - AND `attendees` has two resolved person objects and `hosts` has one

- **REQ-020** — A stored participant reference that no longer resolves to a person SHALL
  be omitted from the response rather than failing the request.
  - GIVEN an event whose `attendeeIds` contains an id with no matching contact
  - WHEN `GET /api/events` returns it
  - THEN the event is present and the unresolvable participant is absent from `attendees`

#### CAP-F — Event write API

- **REQ-021** — `POST /api/events` SHALL create an event from
  `{ title, startAt, endAt, attendeeIds, hostIds }` and return HTTP 201 with the created
  event in the read shape.
  - GIVEN a valid body
  - WHEN `POST /api/events` is called
  - THEN the response is 201 with `{ event: { id, title, startAt, endAt, attendees, hosts } }`
  - AND the event is retrievable through `GET /api/events` for a range containing it

- **REQ-022** — `PATCH /api/events/:id` SHALL update an existing event's title, start,
  end and participant assignments, replacing `attendeeIds` and `hostIds` **wholesale** with
  the submitted sets, and return the updated event.
  - GIVEN an event assigned to contacts A and B
  - WHEN it is updated with `attendeeIds: [B, C]`
  - THEN the stored attendees are exactly B and C
  - AND A is no longer assigned

- **REQ-023** — `DELETE /api/events/:id` SHALL delete the event and return HTTP 204 with
  no body.
  - GIVEN an existing event
  - WHEN it is deleted
  - THEN the response is 204
  - AND a subsequent range query no longer returns it

- **REQ-024** — `PATCH` and `DELETE` SHALL return HTTP 404 in the shared envelope when the
  identifier matches no event, and HTTP 400 when the identifier is not a valid ObjectId.
  - GIVEN an id that is a valid ObjectId but matches nothing
  - WHEN `PATCH` or `DELETE` is called
  - THEN the response is 404 with `{ error: { code, message } }`
  - AND GIVEN an id that is not a valid ObjectId
  - THEN the response is 400

- **REQ-025** — A create or update that assigns an identifier not present in `contacts`
  (for attendees) or `employees` (for hosts) SHALL be rejected, and SHALL NOT create or
  modify any event.
  - GIVEN a body assigning a non-existent contact id
  - WHEN `POST /api/events` is called
  - THEN the response is 400 with a user-facing message
  - AND the `events` collection is unchanged

- **REQ-026** — `createdByUserId` and `updatedByUserId` SHALL NOT be accepted from the
  request body under any circumstance, and SHALL NOT be exposed in the read shape until an
  authenticated actor exists.
  - GIVEN a create or update body that includes `createdByUserId`
  - WHEN the request is processed
  - THEN the submitted value is ignored and never written
  - AND the response does not echo it

#### CAP-H — Seed data and verification

- **REQ-027** — An idempotent seed script SHALL populate `contacts` and `employees` with a
  small, realistic set of people (including at least one employee with
  `canHostEvents: false` and one non-active person), writing only to those two collections.
  - GIVEN the seed script is run twice against the same database
  - WHEN the collections are counted
  - THEN the document counts are identical after both runs

- **REQ-028** — An automated test suite SHALL exercise the endpoints against an
  **in-memory** MongoDB instance whose connection string is built by the test helper and
  never read from `DB_HOST`, so a suite that truncates collections cannot reach the shared
  Atlas cluster.
  - GIVEN the test suite runs with `DB_HOST` pointing at Atlas
  - WHEN the tests execute
  - THEN they connect only to the in-memory instance
  - AND the Atlas cluster is not contacted

- **REQ-029** — `pnpm --filter server build` SHALL succeed with the project's strict
  TypeScript settings (`strict`, `noUnusedLocals`, `noUnusedParameters`) after the change.
  - GIVEN the change is complete
  - WHEN `pnpm build:server` is run from the repository root
  - THEN it exits zero with no diagnostics

- **REQ-030** — The API contract (routes, request shapes, response shapes, error codes)
  and the FullCalendar mapping SHALL be recorded where the client implementer will find it,
  and the committed OpenSpec change SHALL be reconciled with the field names actually
  implemented.
  - GIVEN the server change is merged
  - WHEN a client implementer opens the OpenSpec change or the server docs
  - THEN the documented field names match the implemented ones

---

## Context reviewed

**Project instructions (all read in full).**
`CLAUDE.md`, `AGENTS.md`, `server/CLAUDE.md`, `server/AGENTS.md`, `client/CLAUDE.md`,
`client/AGENTS.md`, `.claude/settings.json`.

**Product documentation.**
`docs/prd/release 1.0.0/eventsPage.md` (the requested source, 611 lines),
`docs/prd/productVision.md`, `docs/overview.md` (empty), `README.md`.

**OpenSpec change (committed, active, un-archived).**
`openspec/changes/add-events-page/{proposal.md,design.md,tasks.md}` and the three capability
specs `specs/{event-calendar,event-management,event-participants}/spec.md`.
`openspec/config.yaml` carries no project context or per-artifact rules — all commented out.

**Source.**
`server/src/{app.ts,main.ts,server.ts}`, `server/src/shared/config/env.ts`,
`server/src/shared/infra/mongoose/client.ts`, `server/{package.json,tsconfig.json}`,
`client/src/{App.tsx,main.tsx,app/router.tsx,app/query-client.ts}`, `client/package.json`,
root `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml` (importers section),
`.nvmrc`, `.gitignore`, `server/.gitignore`.

**Untracked prior build output (read as evidence only).**
`server/dist/modules/events/*.js`, `server/dist/modules/directory/*.js`,
`server/dist/shared/http/*.js`, `server/dist/shared/db/seed.js`, `server/dist/app.js`.

**Skills.**
`.ai_toolkit/skills/nodejs-backend-engineer/SKILL.md` (symlinked into `server/.claude/skills/`
and `server/.agents/skills/`, so it loads for server work). `.ai_toolkit/README.md` index.
The five client-scoped skills were noted but not loaded — this change touches no client code.

**Version control.**
`git log` (23 commits), `git show --stat` for `bce2dbf`, `80ba5d0`, `781882c`,
`git ls-files server client`, `git status`.

**Third-party (authoritative, from installed versions).**
`@fullcalendar/core@6.1.21` `internal-common.d.ts` and `internal-common.js` and `index.js`;
`express@5.2.1` package metadata plus the official Express 5 migration guide;
`mongoose@9.9.1` package metadata plus the official Mongoose 9 migration guide;
`zod@4.4.3` (installed in the client) plus the official Zod 4 `z.iso.datetime()` reference;
the FullCalendar Event Object documentation page.

**Applicable rules discovered.** Listed as C-1 … C-13 in *Constraints* above.

**Conflicts found.** Two, both recorded in *Design decisions* with the chosen resolution:
the prompt's field names versus the committed design's field names, and the prompt's word
"controllers" versus the project's documented `model / routes / service` module layout.

---

## Current state and architecture

### Startup and request flow (verified)

```
main.ts ──▶ runServer()                     server/src/main.ts:1-3
              ├─ connectToMongo()           server/src/server.ts:10  → shared/infra/mongoose/client.ts:12-16
              ├─ createApp()                server/src/server.ts:13  → app.ts:7
              └─ app.listen(env.port)       server/src/server.ts:14
                 └─ SIGINT/SIGTERM ▶ server.close ▶ disconnectFromMongo ▶ exit(0)
                                              server/src/server.ts:20-27
```

`createApp()` (`server/src/app.ts:7-44`) registers, in order:

1. `helmet()` — `app.ts:10`
2. `cors({ origin: env.corsOrigin })` — `app.ts:11` (default `http://localhost:5173`,
   `shared/config/env.ts:22`)
3. `morgan(...)` — `app.ts:12`
4. `express.json({ limit: '1mb' })` and `express.urlencoded` — `app.ts:13-14`
5. `GET /api/health` — `app.ts:16-18`
6. **catch-all 404** — `app.ts:20-25`, currently `{ error, message }`
7. **error handler** — `app.ts:27-41`, currently logs the error and returns
   `{ success, error: <error.message>, timestamp, stack? }`

The insertion point for new routers is between (5) and (6). This is exactly what
`server/AGENTS.md:25` and `server/CLAUDE.md:22` require.

### Data layer (verified)

`shared/infra/mongoose/client.ts` opens a single Mongoose connection from `env.mongoUri`
(`DB_HOST`) and registers `error` / `disconnected` listeners. **No schemas or models
exist.** The committed design records that `contacts`, `employees`, `events` and `users`
already exist in the `OLEKU_CRM` database, are empty, and carry no validators or indexes
beyond `_id` (`openspec/changes/add-events-page/design.md:9`).

### Configuration (verified)

`shared/config/env.ts` is the only reader of `process.env`. It exports
`{ nodeEnv, isProduction, port, mongoUri, corsOrigin }`. `DB_HOST` is required and throws at
startup when missing (`env.ts:5-13, 21`). `server/.env` additionally declares an unused
legacy `MONGODB_URI` key left over from the removed Prisma setup (commit `de164e6`) — no
code reads it.

### Client side of the contract (context only, not in scope)

`client/src/app/router.tsx:4-9` registers a single `/` route rendering the placeholder
`App.tsx`. FullCalendar 6.1.21 (`core`, `react`, `daygrid`, `timegrid`, `interaction`),
TanStack Query 5, React Hook Form 7, Axios 1.19 and Zod 4.4.3 are installed and entirely
unused (`client/package.json:10-23`). The client CLAUDE file states the API is same-origin
under `/api` via Axios and that **the server owns the error envelope**
(`client/CLAUDE.md:26`).

### The FullCalendar event contract (verified against the installed package)

This is the question the prompt asked to settle first.

**What FullCalendar accepts as an event (`EventInput`).** The refiner tables in the
installed package are the contract:

| Group | Properties | Evidence |
| --- | --- | --- |
| Identity / content | `id` (String), `groupId` (String), `title` (String), `url` (String), `interactive` (Boolean) | `node_modules/.pnpm/@fullcalendar+core@6.1.21/node_modules/@fullcalendar/core/internal-common.d.ts:1342-1352` |
| Dates | `start`, `end`, `date` (each `DateInput = Date \| string \| number \| number[]`), `allDay` (Boolean) | same, plus `internal-common.d.ts:213` |
| Custom data | `extendedProps` (object) | `internal-common.d.ts:1342-1352` |
| Presentation | `display`, `editable`, `startEditable`, `durationEditable`, `constraint`, `overlap`, `allow`, `className`/`classNames`, `color`, `backgroundColor`, `borderColor`, `textColor` | `internal-common.d.ts:1424-1438` |
| Catch-all | `[extendedProp: string]: any` — any other top-level key is legal | `internal-common.d.ts:1357-1361` |

**Nothing is strictly required except a resolvable `start`.** `parseSingle` returns `null`
(the event is dropped) when no `start`/`date` can be parsed and open ranges are not allowed
(`internal-common.js:3233-3247`).

**Non-standard top-level keys silently become `extendedProps`.** `parseEventDef` builds
`extendedProps: { ...refined.extendedProps, ...extra }` where `extra` is every leftover key
(`internal-common.js:3223`). This is convenient and dangerous in equal measure: a typo like
`titel` does not error, it becomes an extended prop and the event renders untitled.

**`allDay` is inferred when omitted.** With no `allDay` and no source-level default,
`allDay = startMeta.isTimeUnspecified && endMeta.isTimeUnspecified`
(`internal-common.js:3251-3260`). A full ISO date-time such as `2026-08-10T14:00:00.000Z`
specifies a time, so `allDay` resolves to `false` — which is what this feature wants. A
date-only string like `2026-08-10` would flip it to `true`.

**An `end` that is not after `start` is silently discarded.**
`if (startMarker && endMarker <= startMarker) { endMarker = null }`
(`internal-common.js:3269-3272`), after which the event falls back to
`defaultTimedEventDuration` (one hour). This is a concrete argument for enforcing
`endAt > startAt` server-side (REQ-013): without it, an inverted range does not error — it
renders as a wrong one-hour block.

**What the calendar sends when a URL is used as a JSON feed event source.** Defaults are
`startParam: 'start'`, `endParam: 'end'`, `timeZoneParam: 'timeZone'`, `timeZone: 'local'`
(`internal-common.js:1514-1517`). `buildRequestParams` sets
`params[startParam] = dateEnv.formatIso(range.start)` (`index.js:935-968`), and `formatIso`
appends the **local numeric offset** whenever the offset is non-zero
(`internal-common.js:821-836`, `2139-2150`). So a browser in UTC+03:00 sends
`start=2026-08-01T00:00:00+03:00`, **not** a `Z` instant. The same strings appear as
`startStr` / `endStr` on `DatesSetArg` (`internal-common.d.ts:1554-1566, 1855-1857`) and on
`EventSourceFuncArg` (`internal-common.d.ts:1090-1096`), which is what a TanStack Query
integration would naturally forward.

**Mapping the recommended API payload to `EventInput`:**

| API field | FullCalendar field | Note |
| --- | --- | --- |
| `id` (string) | `id` | Must be a string — the refiner is `StringConstructor` |
| `title` | `title` | Verbatim, no mapping |
| `startAt` (ISO UTC) | `start` | `DateInput` accepts an ISO string |
| `endAt` (ISO UTC) | `end` | Exclusive boundary; for a timed event this is the real end |
| `attendees`, `hosts` | `extendedProps.attendees`, `extendedProps.hosts` | Explicit nesting, not the implicit leftover-key path |
| — | `allDay` | Omit; correctly inferred as `false` from the timed ISO instants |

---

## Findings

### Facts

- [Fact] The tracked server has no modules, models, routers, validation or tests —
  `git ls-files server` returns only `package.json`, `tsconfig.json`, the two markdown
  instruction files, `.gitignore`, two skill symlinks and five `src` files.
- [Fact] The inline error handler leaks internals outside production: it responds with
  `error: error.message` and, when `NODE_ENV !== 'production'`, `stack: error.stack`
  (`server/src/app.ts:31-38`). This directly violates `server/AGENTS.md:23`.
- [Fact] The 404 handler's body shape (`{ error, message }`, `server/src/app.ts:21-24`) is
  not the `{ error: { code, message } }` envelope the committed design requires
  (`openspec/changes/add-events-page/design.md:164-165`).
- [Fact] `zod` is **not** a server dependency. `server/package.json:14-21` lists only
  `cors`, `dotenv`, `express`, `helmet`, `mongoose`, `morgan`; the lockfile's `server`
  importer (`pnpm-lock.yaml:83-115`) agrees.
- [Fact] `server/node_modules/` nonetheless contains **stale symlinks** to `zod@4.4.3` and
  `mongodb-memory-server@11.2.0` from an earlier install that was never reflected in
  `server/package.json`. A clean `pnpm install` removes them. Any implementation that
  imports `zod` without adding it to `server/package.json` will appear to work locally and
  break on a fresh checkout.
- [Fact] The commit whose message claims to implement the Events page (`bce2dbf`) contains
  **only** the seven `openspec/changes/add-events-page/*` files — 957 insertions, no source.
  Verified with `git show --stat bce2dbf`.
- [Fact] `server/dist/` holds compiled output for `modules/events/*`, `modules/directory/*`,
  `shared/http/*` and `shared/db/seed.js` that has no corresponding tracked source, and
  `dist` is gitignored (`.gitignore:2`).
- [Fact] That prior output used `name` / `startsAt` / `endsAt`
  (`server/dist/modules/events/event.model.js:15-17`), which differs from the prompt's
  `title` / `startAt` / `endAt`.
- [Fact] That prior output validated the list range with `z.iso.datetime()`
  (`server/dist/modules/events/event.schemas.js:10-11`). In Zod 4, `z.iso.datetime()`
  **rejects numeric offsets by default** — `"2020-01-01T06:15:00+02:00"` fails unless
  `{ offset: true }` is passed (official Zod 4 API reference). Combined with FullCalendar's
  offset-bearing `formatIso` output, this would have rejected every calendar request from a
  browser outside UTC.
- [Fact] Express 5 forwards rejected promises from async handlers to the error middleware
  automatically ("errors will be passed to the error handler as if calling `next(err)`",
  official Express 5 migration guide), so `async` route handlers need no `try/catch`
  wrapper. Installed version is `express@5.2.1`.
- [Fact] Express 5 makes `req.query` a read-only getter and switches the default query
  parser from "extended" to "simple" (same guide). Validation must therefore *read* and
  produce a new object, never assign back to `req.query`.
- [Fact] Express 5 route paths no longer accept bare `*` wildcards or regex characters
  (same guide). The routes in scope (`/`, `/:id`, `/contacts`, `/employees`) are unaffected.
- [Fact] Mongoose 9 pre-middleware no longer receives a `next()` parameter; hooks must be
  async functions or return promises (official Mongoose 9 migration guide). Installed
  version is `mongoose@9.9.1` with the `mongodb` driver at `~7.5`.
- [Fact] Mongoose 9 `isValidObjectId()` returns `false` for numbers and an ObjectId can no
  longer be constructed from a number (same guide).
- [Fact] FullCalendar's `id` refiner is `StringConstructor`
  (`internal-common.d.ts:1342-1352`), so a raw BSON ObjectId is not an acceptable `id`.
- [Fact] FullCalendar drops an `end` that is `<= start` and substitutes
  `defaultTimedEventDuration` (`internal-common.js:3269-3280`).
- [Fact] FullCalendar's JSON-feed defaults are `start` / `end` / `timeZone`
  (`internal-common.js:1514-1516`) and the emitted values carry the browser's numeric UTC
  offset (`index.js:964-967` with `internal-common.js:821-836`).
- [Fact] There is no lint, format or test script in any package. Root scripts are only
  `dev:client`, `dev:server`, `build:client`, `build:server` (`package.json:9-14`).
- [Fact] `.claude/settings.json` pre-approves exactly four commands, all builds:
  `pnpm build:client`, `pnpm build:server`, `pnpm --filter client build`,
  `pnpm --filter server build`.
- [Fact] The root `package.json` still carries unused `@mui/x-date-pickers` and `zustand`
  dependencies (`package.json:15-18`) that the committed proposal marks for removal
  (`openspec/changes/add-events-page/proposal.md:41`).
- [Fact] The server `tsconfig.json` enables `strict`, `noUnusedLocals`,
  `noUnusedParameters`, `noFallthroughCasesInSwitch`, and `allowImportingTsExtensions` +
  `rewriteRelativeImportExtensions` (`server/tsconfig.json:11-17, 7-8`).

### Inferences

- [Inference] The prompt's schema sketch supersedes the committed design's field names.
  Supporting facts: the prompt names `title`/`startAt`/`endAt` explicitly; the collections
  are empty (`design.md:9`); the prior source was never committed; `title` is FullCalendar's
  own property name, removing one mapping step. Renaming costs nothing today and would cost
  a backfill later.
- [Inference] "Controllers" in the prompt maps to the thin route handlers the project
  already prescribes, not to a new `*.controller.ts` layer. Supporting facts:
  `server/CLAUDE.md:13-14` and `server/AGENTS.md:15` both name the module contents as
  *model, routes, service*; the nodejs-backend-engineer skill says to keep route handlers
  thin and put business decisions in testable application code
  (`.ai_toolkit/skills/nodejs-backend-engineer/SKILL.md:26`, principle 5); the prior
  `dist/` output followed the same split.
- [Inference] The calendar's list request will use TanStack Query + Axios rather than a
  FullCalendar JSON feed, because `client/CLAUDE.md:26` mandates Axios under `/api` and
  `client/AGENTS.md` mandates TanStack Query for server state. The client therefore controls
  the parameter names — which is why `from`/`to` is safe — but the *values* it has readily
  available are `DatesSetArg.startStr`/`endStr`, which still carry the local offset. REQ-017
  is required either way.
- [Inference] A thrown `Error` inside a Mongoose `pre('validate')` hook propagates as a
  generic error, not a `ValidationError`, so it would reach the error middleware as a 500.
  Supporting facts: the prior implementation threw a plain `Error`
  (`server/dist/modules/events/event.model.js:30-34`) and the middleware only special-cases
  `AppError` (`server/dist/shared/http/error-middleware.js:2-11`). Mitigation: keep Zod as
  the 400 path and map Mongoose `ValidationError` / `CastError` in the middleware (REQ-004).
- [Inference] The overlap query `startAt < to AND endAt > from` will use the
  `{ startAt: 1, endAt: 1 }` index only on its `startAt` prefix; `endAt` becomes an in-index
  filter. That is acceptable and standard for interval overlap in MongoDB, and at the
  expected volume the difference is immaterial.
- [Inference] Resolving participants with two `find({ _id: { $in } })` calls per event (the
  prior implementation's `toEventDetails`) is an N+1 pattern across a month of events. A
  single batched lookup for all events in the response is the same amount of code and one
  round trip.

### Assumptions

- [Assumption] `status` is a closed string set `'active' | 'inactive'`, default `'active'`,
  for both contacts and employees. The prompt names the field but not its values. This is
  the smallest set that makes REQ-010 meaningful; widening it later is additive (a new enum
  member requires no backfill). If the product later wants `'archived'` or `'lead'`, only
  the enum and the default filter change.
- [Assumption] `canHostEvents` defaults to `true`. The committed spec says host options come
  from registered employees with no qualifier
  (`openspec/changes/add-events-page/specs/event-participants/spec.md:17-21`), so defaulting
  to `true` preserves that behaviour and makes the flag an explicit *exclusion*. Defaulting
  to `false` would make every employee invisible to the host selector until someone sets the
  flag. Reversible: the collections are empty, so flipping the default costs one line plus a
  seed edit.
- [Assumption] `position` and `department` are optional free-text strings. The prompt gives
  no vocabulary and no PRD section defines them. Making them required would block the seed
  and every future employee import.
- [Assumption] `createdByUserId` and `updatedByUserId` are nullable and always written as
  `null` in this change, never accepted from the client. There is no authenticated actor
  (`openspec/changes/add-events-page/proposal.md:45`), so any other choice either blocks the
  endpoints or lets a caller forge an audit trail. Adding population later is a one-line
  service change once authentication middleware exists.
- [Assumption] `PATCH /api/events/:id` accepts the full editable field set (title, startAt,
  endAt, attendeeIds, hostIds) as a complete replacement, matching the dialog's behaviour
  and the committed design's wholesale-replacement decision
  (`openspec/changes/add-events-page/design.md:77-83`). True partial-update semantics are an
  additive change later.
- [Assumption] The directory result cap is 50 by default with a client-supplied `limit`
  capped at 100 — the numbers used by the prior output
  (`server/dist/modules/directory/directory.service.js:4`,
  `directory.schemas.js:4`) and left open by the committed design
  (`openspec/changes/add-events-page/design.md:205`).
- [Assumption] The maximum `GET /api/events` range span is 366 days. FullCalendar's largest
  built-in fetch range for the installed views is a rendered month (about six weeks), so
  366 days is a generous ceiling that still forbids an unbounded scan.
- [Assumption] Times are stored as UTC instants and the server never interprets a time zone,
  per the committed design (`openspec/changes/add-events-page/design.md:45-51`). Time-zone
  policy is an open product decision.
- [Assumption] `node:test` plus `mongodb-memory-server` is the test stack, per the committed
  design (`openspec/changes/add-events-page/design.md:169-171`). Node 24 ships `node --test`,
  so no framework dependency is added.

### Unknowns

- [Unknown] Whether the `OLEKU_CRM` Atlas database is genuinely still empty. The committed
  design asserts it (`design.md:9`) but that statement is dated 2026-08-05 and the prior
  seed script (`server/dist/shared/db/seed.js`) may have been run since. Impact: if
  documents exist under the old `name`/`startsAt`/`endsAt` field names, they will silently
  fail to render (`title` undefined, `start` undefined → the event is dropped by
  `parseSingle`). **Validate before writing any model code** with a read-only count and a
  sample document per collection.
- [Unknown] Whether `users` documents exist and what their `_id` type is. Only matters for
  the `ref: 'User'` on the audit fields, which is declarative and unused in this change.
- [Unknown] Whether the product intends `canHostEvents` to gate the host selector only, or
  also to reject an event whose host is not eligible. This report assumes selector-level
  filtering only (REQ-009) and does **not** add a write-time `canHostEvents` check, because
  no requirement states it. Impact if wrong: a host assignment could be made through the API
  for an ineligible employee.
- [Unknown] Whether a future authorization change will scope events per business/tenant. If
  it does, `GET /api/events` will need a tenant filter and the index will need a tenant
  prefix. Not investigated; no tenancy model exists anywhere in the repository.
- [Unknown] The actual latency of the shared Atlas cluster from the development machine.
  Affects nothing structural but influences whether the directory search needs a text index.

---

## Patterns and conventions to follow

| Pattern | Where it is established | How this change follows it |
| --- | --- | --- |
| `src/modules/<feature>/` with `*.model.ts`, `*.schemas.ts`, `*.service.ts`, `*.routes.ts` | `server/CLAUDE.md:13-14`, `server/AGENTS.md:15`, `openspec/changes/add-events-page/design.md:151-157` | Two new modules: `modules/events/`, `modules/directory/` |
| Shared cross-cutting code under `src/shared/<concern>/` | `server/CLAUDE.md:10-12`, existing `shared/config/`, `shared/infra/` | New `shared/http/` and `shared/db/` |
| `.ts` extension on every relative import | `server/CLAUDE.md:3-5`, `server/src/app.ts:5`, `server/src/server.ts:1-6` | Every new import written with `.ts` |
| `env.ts` is the only `process.env` reader | `server/AGENTS.md:21`, `server/src/shared/config/env.ts` | Any new variable (none expected) is added there |
| Routers mounted under `/api`, above 404 and error handler | `server/AGENTS.md:25`, `server/src/app.ts:16-41` | `app.use('/api/events', …)`, `app.use('/api', directoryRouter)` inserted at `app.ts:19` |
| Zod at the HTTP boundary via a shared helper | `server/AGENTS.md:22`, prior `dist/shared/http/validate.js` | `shared/http/validate.ts` returning parsed data or throwing the app error |
| Single error envelope `{ error: { code, message } }` | `openspec/changes/add-events-page/design.md:163-165`, `client/CLAUDE.md:26` | `shared/http/error-envelope.ts` + `error-middleware.ts`; 404 handler updated to match |
| Explicit `collection` binding on every model | `openspec/changes/add-events-page/design.md:53-57` | `{ collection: 'events' \| 'contacts' \| 'employees' }` |
| Split first/last name plus a `fullName` virtual | `openspec/changes/add-events-page/design.md:59-65` | Shared `createPersonSchema(collectionName)` factory |
| Participants as embedded reference arrays, replaced wholesale | `openspec/changes/add-events-page/design.md:67-83` | `attendeeIds` / `hostIds` on the event document |
| Thin transport, testable services | `.ai_toolkit/skills/nodejs-backend-engineer/SKILL.md:26` (principle 5), `:113` | Route handlers validate + delegate; all decisions in `*.service.ts` |
| Async handlers without `try/catch` (Express 5 forwards rejections) | Express 5 migration guide; prior `dist/modules/events/event.routes.js` | Same style, documented so it is not mistaken for missing error handling |
| pnpm from the root with `--filter` | `AGENTS.md:22-25`, `CLAUDE.md` | `pnpm --filter server add zod` |
| Conventional Commits | `.ai_toolkit/commands/commit.md`, `git log` | Commit messages per stage |

---

## Dependencies and impact analysis

### Files created (all new)

```
server/src/shared/http/error-envelope.ts      AppError + code factories
server/src/shared/http/error-middleware.ts    the single response shaper
server/src/shared/http/validate.ts            Zod boundary helper
server/src/shared/db/seed.ts                  idempotent contacts/employees seed
server/src/modules/directory/person.schema.ts shared person schema factory
server/src/modules/directory/contact.model.ts
server/src/modules/directory/employee.model.ts
server/src/modules/directory/person-summary.ts  document → { id, firstName, lastName, fullName }
server/src/modules/directory/directory.schemas.ts
server/src/modules/directory/directory.service.ts
server/src/modules/directory/directory.routes.ts
server/src/modules/events/event.model.ts
server/src/modules/events/event.schemas.ts
server/src/modules/events/event.service.ts
server/src/modules/events/event.routes.ts
server/test/**                                integration tests + in-memory Mongo helper
```

### Files modified

| File | Change | Risk |
| --- | --- | --- |
| `server/src/app.ts` | Mount two routers; replace the inline error handler with the imported middleware; align the 404 body with the envelope | Low — additive plus one replacement; ordering is the only footgun |
| `server/package.json` | Add `zod`; add `mongodb-memory-server` (dev); add `test` and `seed` scripts | Low |
| `pnpm-lock.yaml` | Regenerated by pnpm | Low — must be committed (`AGENTS.md:25`) |
| `package.json` (root) | Optionally add a `test:server` script | Low |

### Files deliberately untouched

`server/src/shared/config/env.ts` (no new variables), `server/src/server.ts`,
`server/src/main.ts`, `server/src/shared/infra/mongoose/client.ts`, everything under
`client/`, `.ai_toolkit/`, `server/dist/` (generated).

### Downstream consumers

| Consumer | Impact |
| --- | --- |
| Client Events page (not yet written) | **Primary consumer.** This change fixes the contract it will code against. Needs the mapping table published. |
| `openspec/changes/add-events-page/{design.md,tasks.md}` | Contain the superseded `name`/`startsAt`/`endsAt` names and a client+server task list. Must be reconciled or the next implementer follows stale names (REQ-030). |
| Future Client Management / Employee Management changes | Inherit the `contacts` / `employees` schemas defined here. The shape must stay minimal and additive (`openspec/changes/add-events-page/design.md:183`). |
| Future authentication change | Will populate `createdByUserId` / `updatedByUserId` and add authorization to these routes. |
| Existing `/api/health` | Must keep responding — it is the only current endpoint. |

### Blast radius by dimension

- **API** — six new endpoints under `/api`; one changed error body shape for *all* errors
  including the existing 404. No existing successful response changes.
- **Data** — first schemas and first indexes on three previously schema-less collections.
  No migration; Mongoose builds declared indexes on connect, instantly against empty
  collections. `users` untouched.
- **Security** — six unauthenticated endpoints, three of them writes, against a shared
  hosted Atlas cluster. See *Security* below.
- **Operations** — a new `seed` script that writes to the real cluster, and a new test
  suite that must be structurally incapable of reaching it.
- **Performance** — one bounded range query per calendar period; two capped directory
  queries. Regex search is a collection scan.
- **Documentation** — the OpenSpec change and the README need updating.
- **Accessibility** — not applicable; no user interface in scope.

---

## Options considered

### Option set 1 — Wire format for the event read payload

| Option | Summary | Benefits | Costs and risks | Reversibility |
| --- | --- | --- | --- | --- |
| **1A. Domain shape (`id`, `title`, `startAt`, `endAt`, `attendees[]`, `hosts[]`) — recommended** | Server returns its own domain object; the client maps to `EventInput` in one function | Server independent of a UI library; serves the future customer portal, notifications and mobile equally; contract drift is visible because names differ | One small mapping function on the client | Fully reversible |
| 1B. FullCalendar-native shape (`id`, `title`, `start`, `end`, `allDay`, `extendedProps`) | Server returns exactly what FullCalendar consumes; client passes the array straight to `events` | Zero client mapping; the JSON feed source could be used directly | Bakes a rendering library's contract into a domain API every future consumer must adopt; unknown keys silently become `extendedProps` (`internal-common.js:3223`) so a server-side typo is invisible; a FullCalendar major upgrade becomes an API change | Hard — every consumer would need to change |
| 1C. Both shapes behind a `?format=` parameter | Satisfies both | Two contracts, two test matrices, two things to keep in sync, for one consumer | Reversible but wasteful |

### Option set 2 — Module layering ("controllers")

| Option | Summary | Benefits | Costs and risks | Reversibility |
| --- | --- | --- | --- | --- |
| **2A. `routes` (thin controller) + `service` — recommended** | Route handler validates and delegates; the service holds every decision | Matches `server/CLAUDE.md:13-14` and `server/AGENTS.md:15` verbatim; matches the committed design's file list (`design.md:151-157`); fewest files | The word "controller" does not appear in a filename | Trivial to split later |
| 2B. Explicit `event.controller.ts` between routes and service | Literal reading of the prompt | Familiar to MVC-trained readers | Adds a pass-through layer for four endpoints; contradicts a committed project instruction; the skill warns against "empty wrappers and speculative layers" (`SKILL.md:114`) | Trivial |
| 2C. Class-based controllers with decorators | NestJS-style | — | **Forbidden**: decorators are non-erasable TypeScript and the server runs native type stripping (`design.md:12`, `server/CLAUDE.md:3-5`) | n/a |

### Option set 3 — Event field naming

| Option | Summary | Benefits | Costs and risks | Reversibility |
| --- | --- | --- | --- | --- |
| **3A. Prompt names: `title`, `startAt`, `endAt` — recommended** | Adopt the schema the prompt supplies | `title` is FullCalendar's own property name — one fewer mapping; explicit and current user intent; collections are empty so the rename is free | Diverges from committed `design.md:37-43`; that document must be reconciled (REQ-030) | Free today, a backfill once data exists |
| 3B. Committed names: `name`, `startsAt`, `endsAt` | Keep the OpenSpec design | No document to reconcile | Contradicts the explicit prompt; needs an extra mapping step for `title` | Same |
| 3C. Store `title` but keep `startsAt`/`endsAt` | Split the difference | — | Inconsistent tense within one document; no benefit | Same |

### Option set 4 — Range parameter validation

| Option | Summary | Benefits | Costs and risks | Reversibility |
| --- | --- | --- | --- | --- |
| **4A. `z.iso.datetime({ offset: true })` then transform to `Date` — recommended** | Accept both `Z` and numeric offsets, normalize to a UTC instant | Accepts exactly what FullCalendar's `formatIso` emits (`internal-common.js:821-836`); still rejects garbage and local-naive strings | One option flag that must not be forgotten | Trivial |
| 4B. `z.iso.datetime()` (the prior implementation's choice) | Strict UTC only | Simplest to read | **Rejects every request from a browser outside UTC** — verified Zod 4 behaviour | Trivial, but it is a latent production bug |
| 4C. `z.coerce.date()` | Accept anything `new Date()` accepts | Maximum tolerance | Accepts `"garbage"`? No — but it accepts numbers, partial dates and locale strings, weakening the contract and making error messages unhelpful | Trivial |

### Option set 5 — Participant resolution on read

| Option | Summary | Benefits | Costs and risks | Reversibility |
| --- | --- | --- | --- | --- |
| **5A. One batched lookup for all events in the response — recommended** | Collect every attendee and host id across the result set, run two `find({ _id: { $in } })`, build a map | Two queries regardless of period size | Slightly more code than the naive version | Trivial |
| 5B. Per-event resolution (the prior implementation) | `Promise.all` two finds per event | Simplest code | 2N queries for N events — a busy month means ~100 round trips to a hosted cluster | Trivial |
| 5C. Mongoose `populate()` | Let Mongoose do it | Idiomatic | Still per-path work, returns full documents rather than the summary shape, and hides the "drop unresolvable" behaviour REQ-020 needs | Trivial |

---

## Recommended approach

Build the server slice in the project's own module shape, adopting the prompt's field names
and a domain-shaped wire format, with the FullCalendar mapping documented rather than
embedded.

1. **Dependencies first.** `pnpm --filter server add zod` and
   `pnpm --filter server add -D mongodb-memory-server`, add `test` and `seed` scripts,
   commit the regenerated `pnpm-lock.yaml`. This closes the stale-symlink trap (Fact above).

2. **Verify the database is empty before writing model code.** A read-only count and one
   sample document per collection settles the single highest-impact Unknown. If documents
   exist under the old field names, stop and decide on a rename script before proceeding.

3. **`shared/http/`** — `error-envelope.ts` (an `AppError` carrying `status`, `code`,
   `message`, plus factories for `VALIDATION_ERROR`, `NOT_FOUND`, `UNKNOWN_PARTICIPANT`,
   `INTERNAL_ERROR`), `validate.ts` (parse a request part with a Zod schema, throw the
   validation error carrying the first issue's message), and `error-middleware.ts` (map
   `AppError` → its status; Mongoose `CastError` / `ValidationError` → 400; everything else
   → 500 with a fixed generic message, logging the real error server-side only). Update
   `app.ts` to use it and to emit the same envelope from the 404 handler.

4. **`modules/directory/`** — a `createPersonSchema(collectionName)` factory holding the
   shared `firstName` / `lastName` / `email` / `status` paths, the `fullName` virtual and
   the `{ lastName, firstName }` index; `contact.model.ts` and `employee.model.ts` binding
   it to `contacts` and `employees`, with the employee schema adding `position`,
   `department` and `canHostEvents`; a `person-summary.ts` mapper; a service with the
   escaped-regex search, status filter, sort and cap; and a router exposing
   `GET /api/contacts` and `GET /api/employees`.

5. **`modules/events/`** — `event.model.ts` (`title`, `startAt`, `endAt`, de-duplicating
   setters on `attendeeIds` / `hostIds`, nullable `createdByUserId` / `updatedByUserId`,
   the `{ startAt: 1, endAt: 1 }` index, and an `endAt > startAt` guard);
   `event.schemas.ts` (list query with `offset: true` ISO parsing, ordering and span
   refinements; the write body with a non-blank `title`, the `endAt > startAt` refinement
   and de-duplicated ObjectId-string arrays; the `:id` param schema); `event.service.ts`
   (overlap list with one batched participant lookup, create, update with wholesale
   participant replacement, delete, and a shared `assertPeopleExist` guard);
   `event.routes.ts` (four thin async handlers).

6. **Mount both routers** in `app.ts` between `/api/health` and the 404 handler:
   `app.use('/api/events', eventsRouter)` and `app.use('/api', directoryRouter)`.

7. **Seed and test.** An idempotent upsert-by-email seed for `contacts` and `employees`
   including one `canHostEvents: false` employee and one non-active person; a `node:test`
   integration suite against `mongodb-memory-server` whose helper builds its own URI and
   never reads `DB_HOST`.

8. **Publish the contract** and reconcile the OpenSpec change so the client implementer
   codes against the names that were actually built.

**Why this is the smallest coherent approach.** Every file it adds is named by the
project's own instructions or the committed design. It introduces one runtime dependency
(`zod`) that `server/AGENTS.md:22` already mandates and one dev dependency that the
committed design already chose. It changes exactly one existing file. It adds no layer the
project has not already specified, and it leaves the client contract explicit enough that
the calendar work can start immediately.

**One-way doors.** None in code. The only durable commitments are (a) the collection field
names, which become expensive to change once real data exists — mitigated by verifying
emptiness first and by choosing the names now rather than later — and (b) the
`{ error: { code, message } }` envelope, which every future client error-mapping table will
depend on.

**Migration and rollback.** No migration: MongoDB needs none and the collections already
exist. Rollback is `git revert` plus deleting any documents the seed or manual testing
wrote and dropping the declared indexes. This is safe only while the database holds no real
data — which stops being true the moment someone uses the seeded records
(`openspec/changes/add-events-page/design.md:195-201`).

---

## Proposed change inventory

| Area | Proposed change | Rationale | Requirements | Evidence / confidence |
| --- | --- | --- | --- | --- |
| `server/package.json` | Add `zod` dependency, `mongodb-memory-server` dev dependency, `test` + `seed` scripts | Zod is mandated but absent; the stale symlink hides the gap | REQ-001, REQ-027, REQ-028 | `server/package.json:14-21`, `pnpm-lock.yaml:83-115`, `server/node_modules/` listing — **high** |
| `server/src/shared/http/error-envelope.ts` | `AppError` + code factories | Single envelope required by the design and by the client | REQ-002 | `design.md:163-165`, `client/CLAUDE.md:26` — **high** |
| `server/src/shared/http/validate.ts` | Zod boundary parse helper | Mandated boundary validation, one place to shape the 400 | REQ-001 | `server/AGENTS.md:22` — **high** |
| `server/src/shared/http/error-middleware.ts` | Centralized error shaper incl. Mongoose `CastError`/`ValidationError` → 400 | Current handler leaks `message` and `stack` | REQ-002, REQ-004 | `server/src/app.ts:27-41` vs `server/AGENTS.md:23` — **high** |
| `server/src/app.ts` | Mount both routers above the 404; swap in the error middleware; align the 404 body | Required ordering; single envelope | REQ-003 | `server/AGENTS.md:25`, `server/src/app.ts:16-41` — **high** |
| `server/src/modules/directory/person.schema.ts` | Shared person schema factory with `status`, `fullName` virtual, name index | Avoids two drifting copies; the design prescribes the split-name shape | REQ-005, REQ-006 | `design.md:59-65`, prior `dist/modules/directory/person.schema.js` — **high** |
| `.../contact.model.ts`, `.../employee.model.ts` | Bind to `contacts` / `employees`; employee adds `position`, `department`, `canHostEvents` | Prompt's schema; explicit collection binding | REQ-005, REQ-006, REQ-007 | prompt; `design.md:53-57`; `server/AGENTS.md:27` — **high** |
| `.../directory.service.ts` + `.routes.ts` + `.schemas.ts` | `GET /api/contacts`, `GET /api/employees` with escaped search, status filter, `canHostEvents` filter, sort, cap | Populates both selectors | REQ-008…REQ-011 | prompt; `design.md:92-93`; `specs/event-participants/spec.md:7-33` — **high** |
| `server/src/modules/events/event.model.ts` | `title`, `startAt`, `endAt`, de-duplicating participant setters, nullable audit fields, range index, `endAt > startAt` guard | Prompt's schema plus the invariants Mongo cannot enforce | REQ-012…REQ-015, REQ-026 | prompt; `design.md:37-43, 67-83` — **high** |
| `server/src/modules/events/event.schemas.ts` | List query with `offset: true` ISO parsing + ordering + max-span refinements; write body; id param | FullCalendar emits offset-bearing ISO strings; unbounded reads must be impossible | REQ-016…REQ-018, REQ-013, REQ-014, REQ-024 | `internal-common.js:821-836, 1514-1517`, `index.js:964-967`; Zod 4 docs — **high** |
| `server/src/modules/events/event.service.ts` | Overlap list with one batched participant lookup; create; wholesale-replacement update; delete; `assertPeopleExist` | Avoids N+1; enforces referential rules Mongo will not | REQ-016, REQ-019…REQ-023, REQ-025 | `design.md:67-83`; `specs/event-participants/spec.md:147-176` — **high** |
| `server/src/modules/events/event.routes.ts` | Four thin async handlers (`GET /`, `POST /`, `PATCH /:id`, `DELETE /:id`) | The project's "controller" layer; Express 5 forwards rejections | REQ-021…REQ-024 | `server/CLAUDE.md:13-14`; Express 5 guide — **high** |
| `server/src/shared/db/seed.ts` | Idempotent upsert-by-email seed for `contacts` and `employees` | The selectors cannot be exercised against empty collections; no management UI exists | REQ-027 | `design.md:196-198`; prior `dist/shared/db/seed.js` — **high** |
| `server/test/**` | In-memory Mongo helper + integration tests | The only configured DB is a shared cluster; a truncating suite must be unable to reach it | REQ-028 | `design.md:169-171` — **high** |
| `README.md` / OpenSpec change | Publish the contract + mapping; reconcile field names; document `seed`/`test`; state the API is unauthenticated | Prevents the client being written against stale names | REQ-030 | `AGENTS.md:44-46`; `openspec/changes/add-events-page/tasks.md:95` — **medium** (exact destination is an open decision) |

---

## Design decisions

| Decision | Choice | Rationale | Alternatives rejected |
| --- | --- | --- | --- |
| Wire format | Domain shape (`id`, `title`, `startAt`, `endAt`, `attendees[]`, `hosts[]`) | Keeps a UI library out of the domain contract; the client mapping is one function; unknown keys silently becoming `extendedProps` (`internal-common.js:3223`) makes the native shape fragile | FullCalendar-native shape (1B); dual format (1C) |
| Event field names | `title`, `startAt`, `endAt` | Explicit current user intent; `title` matches FullCalendar exactly; the collections are empty so the rename is free | Committed `name`/`startsAt`/`endsAt` (3B) — reconciled in the OpenSpec change instead |
| "Controllers" | Thin async handlers in `*.routes.ts`, decisions in `*.service.ts` | `server/CLAUDE.md:13-14` and `server/AGENTS.md:15` prescribe *model, routes, service*; the skill warns against empty wrapper layers | A separate `*.controller.ts` (2B); class + decorator controllers (2C, forbidden by native type stripping) |
| Range parameter parsing | `z.iso.datetime({ offset: true })` → `new Date(...)` | FullCalendar's `formatIso` emits the browser's numeric offset; the plain form rejects it | `z.iso.datetime()` (4B, latent bug); `z.coerce.date()` (4C, too loose) |
| Range semantics | Half-open `[from, to)` via `startAt < to AND endAt > from`, required, max span 366 days | Matches the committed design (`design.md:88`) and how calendars page; the required bounds forbid an unbounded scan | Optional bounds (unbounded read has no caller); closed interval (double-counts boundary events) |
| Time storage | Two UTC `Date` instants, no server-side zone interpretation | Committed design (`design.md:45-51`); FullCalendar is instant-based | Date string + two time strings (`design.md:41` rejects it) |
| Participants | Embedded `ObjectId[]` on the event, replaced wholesale on write | Committed design (`design.md:67-83`); makes "edits persist only on save" fall out of the model | Join collections; incremental participant endpoints |
| Duplicate prevention | Twice — Zod de-duplicates the request array, a Mongoose path setter de-duplicates before any write | Defence in depth; a write bypassing the route still cannot store a duplicate | Unique sub-document index (not expressible on an array path this way) |
| `endAt > startAt` | Enforced in Zod (→ 400) and again in the model | Mongo has no check constraints and its JSON-schema validators cannot compare two fields (`design.md:43`); FullCalendar silently swallows an inverted range (`internal-common.js:3269-3272`) | Zod only (a non-route write could store an inverted range) |
| Participant resolution | One batched `$in` lookup per collection for the whole response | Two queries regardless of period size | Per-event resolution (5B, N+1); `populate()` (5C) |
| Unresolvable references | Dropped from the response, event still returned | `specs/event-participants/spec.md:157-161`; Mongo has no referential integrity | Failing the whole range query on one dangling id |
| `createdByUserId` / `updatedByUserId` | Declared nullable, always `null`, never accepted from the body, not exposed in responses | No authenticated actor exists; accepting them from the client would be a forgeable audit trail | Requiring them (blocks every write); accepting from the body (security hole) |
| `status` | `'active' \| 'inactive'`, default `'active'`; directory reads filter to active by default | Smallest set that makes the field meaningful; widening is additive | Free-form string (unfilterable); boolean `isActive` (not the prompt's field name) |
| `canHostEvents` | Boolean, default `true`; an optional query filter on `GET /api/employees`; **not** enforced at write time | Preserves the committed spec's "hosts come from employees"; write-time enforcement is not stated by any requirement (recorded as an Unknown) | Default `false` (empty host selector until backfilled) |
| Update verb | `PATCH /api/events/:id` with the full editable field set | Matches the committed design's verb (`design.md:90`) and the dialog's whole-form submit | `PUT` (more honest but diverges from the committed contract); true partial `PATCH` (additive later) |
| Error middleware scope | Also maps Mongoose `CastError` and `ValidationError` to 400 | A model-level guard would otherwise surface as a 500 | `AppError` only (the prior implementation's behaviour) |
| Test stack | `node:test` + `mongodb-memory-server`, helper builds its own URI | Node 24 ships the runner; the suite must be structurally unable to reach the shared Atlas cluster | A test framework dependency; testing against Atlas |

---

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation | Residual risk |
| --- | --- | --- | --- | --- |
| `z.iso.datetime()` without `offset: true` rejects every calendar request from a non-UTC browser | **High** if the prior `dist/` code is copied verbatim | High — the calendar never loads | REQ-017 plus an explicit test asserting a `+03:00` bound is accepted | Very low |
| Unauthenticated write endpoints against a shared hosted Atlas cluster | High while the API is reachable | High — anyone reaching the server can read the full directory and destroy every event | Do not expose beyond localhost; keep `CORS_ORIGIN` at the Vite dev origin; record as known debt until the authorization change lands (`proposal.md:45`, `design.md:179`) | **Accepted, real.** Must be re-stated in the README |
| The database is not actually empty and holds documents under the old field names | Medium | High — events render untitled or are dropped entirely by `parseSingle` | Verify with a read-only count and sample **before** writing model code; decide on a rename script if documents exist | Low once verified |
| `zod` imported but not added to `server/package.json` (stale `node_modules` symlink hides it) | Medium | High — works locally, breaks on a fresh checkout and in CI | Add the dependency in the first stage; verify by inspecting the `server` importer in `pnpm-lock.yaml` after install | Low |
| The seed script is pointed at the shared Atlas cluster and writes into a real database | Medium | Medium — pollutes a shared cluster; the design forbids treating it as disposable (`design.md:11`) | Idempotent upsert-by-email; touch only `contacts` and `employees`; log the resolved database name before writing | Low |
| A test helper reads `DB_HOST` and truncates collections on Atlas | Low | **Very high — irreversible data loss** | REQ-028: the helper builds its own in-memory URI and never reads `DB_HOST`; assert in the helper that the connection host is the in-memory instance | Very low |
| Model-level `endAt > startAt` guard surfaces as HTTP 500 | Medium | Low | REQ-004 maps Mongoose validation errors to 400; Zod is the primary 400 path | Low |
| Router mounted below the catch-all 404 | Low | High — every new endpoint 404s | Ordering is explicit in the plan; a smoke test hits `/api/events` and `/api/contacts` | Very low |
| Changing the error envelope breaks the existing 404 shape | Low | Low — no consumer exists yet | Change both handlers together in one stage | Very low |
| Regex directory search causes a collection scan | Medium at scale | Low now (empty collections) | Escape metacharacters, bound the search length, cap results; revisit with a text index if volume grows | Accepted |
| N+1 participant lookups on a busy month against a hosted cluster | Medium if 5B is used | Medium — visible calendar latency | Batched `$in` lookup (5A) | Low |
| The OpenSpec change keeps the superseded field names and the client is built against them | **High** if not reconciled | Medium — a wasted client implementation round | REQ-030: reconcile `design.md`/`tasks.md` and publish the contract in the same change | Low |
| `mongodb-memory-server` downloads a MongoDB binary on first run | High | Low — one-time slow test run, fails offline | Documented in the README; the binary is cached under `server/node_modules/.cache` (already present locally) | Accepted (`design.md:171`) |
| Node 24 native type stripping rejects non-erasable syntax | Low | Medium — dev server fails to boot | No enums, no parameter properties, no decorators (C-2); `pnpm --filter server build` catches it | Low |

---

## Edge cases and failure modes

**Range query boundaries.** Half-open `[from, to)` with `startAt < to AND endAt > from`
produces: an event ending exactly at `from` is **excluded** (`endAt > from` is false); an
event starting exactly at `to` is **excluded**; an event straddling either boundary is
**included**; an event entirely containing the range is **included**. `to == from` and
`to < from` are rejected (REQ-018).

**Zero-length and inverted events.** Rejected at both layers (REQ-013). Worth an explicit
test because FullCalendar would otherwise render an inverted range as a silent one-hour
block (`internal-common.js:3269-3280`).

**Empty period.** `GET /api/events` returns `{ events: [] }`, not 404.

**Empty participant arrays.** Valid — attendees and hosts are optional
(`docs/prd/release 1.0.0/eventsPage.md:411`). `assertPeopleExist([])` must short-circuit and
run no query.

**Whitespace-only title.** `z.string().trim().min(1)` rejects it, matching
`specs/event-management/spec.md:52-56`. The model also trims.

**Malformed ObjectId in `:id`, `attendeeIds` or `hostIds`.** Rejected by the Zod
24-hex-character pattern → 400, before Mongoose can raise a `CastError`. The middleware's
`CastError` → 400 mapping is the backstop.

**Valid ObjectId that matches nothing.** `PATCH`/`DELETE` → 404 (REQ-024). A participant id
→ 400 `UNKNOWN_PARTICIPANT` (REQ-025), which is a client-input error, not a missing
resource.

**Duplicate ids in the request.** Collapsed silently by the Zod transform and again by the
model setter — no error, exactly one assignment (REQ-014, matching
`specs/event-participants/spec.md:167-171`).

**The same person as attendee and host.** Both assignments stored; they are separate roles
and reference different collections (`specs/event-participants/spec.md:173-176`).

**Dangling participant reference.** Dropped on read; the event still returns (REQ-020).
Reachable today only by direct database manipulation, because no deletion endpoint exists
for people — but it must not be able to break the calendar.

**Concurrent update of the same event.** Last write wins; `attendeeIds` is replaced
wholesale, so two concurrent editors can silently overwrite each other's participant
changes. No optimistic concurrency is in scope; recorded as accepted.

**Concurrent delete during update.** `findById` succeeds then `save()` re-inserts a deleted
document, or `findById` returns `null` → 404. Using `findOneAndUpdate` avoids the resurrect
case and is the recommended implementation detail.

**Partial failure inside a write.** Participant existence is checked, then the event is
written. If a contact is deleted between the check and the write, a dangling reference
results — harmless, because reads tolerate it (REQ-020). MongoDB multi-document
transactions are not warranted here.

**Mongo unavailable at request time.** The Mongoose promise rejects, Express 5 forwards it,
the middleware returns 500 with the generic message. The real error is logged server-side
only. Note that `runServer` connects before listening (`server/src/server.ts:10-14`), so a
cold start with an unreachable database exits rather than serving 500s.

**Oversized request body.** `express.json({ limit: '1mb' })` (`server/src/app.ts:13`) throws
a body-parser error carrying `status: 413`; the middleware must not turn that into a 500 —
another reason it should honour an `err.status`/`err.statusCode` it recognises.

**Very large `limit` on a directory request.** Capped at 100 by the schema; values above
the cap are a 400 rather than a silent clamp, so the client learns about it.

**Search string containing regex metacharacters.** Escaped and treated literally (REQ-011).

---

## Security, privacy, performance, and accessibility

### Security

- **No authentication or authorization.** All six endpoints are public. Three of them
  mutate data. This is out of scope by the PRD (`docs/prd/release 1.0.0/eventsPage.md:32`)
  and explicitly recorded as known debt in the committed change
  (`proposal.md:45`, `design.md:179`). **The API must not be exposed beyond local
  development until the authorization change lands.** This must be restated in the README
  as part of this change.
- **Shared Atlas cluster.** `DB_HOST` points at a personal cluster hosting unrelated
  databases (`design.md:11`). Every write path and the test suite must be reviewed against
  the possibility of touching it.
- **Error hygiene.** The current handler returns `error.message` and, outside production,
  `error.stack` (`server/src/app.ts:31-38`). The replacement returns a fixed generic
  message for anything that is not a deliberate `AppError`, and logs the real error only.
  This is REQ-002 and is a blocking review item per `server/AGENTS.md:40-41`.
- **Injection.** Mongoose casts query values, and every id is validated as a 24-hex string
  before reaching a query, so operator injection through `$`-prefixed values is not
  reachable. Directory search is the one place raw user text enters a query — escaped, and
  length-bounded against ReDoS.
- **Mass assignment.** `createdByUserId` and `updatedByUserId` must be built server-side and
  never picked from the body. The Zod write schema is the enforcement point: it must not use
  `.passthrough()`, and the service must construct the document from the parsed result
  rather than spreading `req.body`.
- **Helmet and CORS** already applied (`server/src/app.ts:10-11`); `CORS_ORIGIN` defaults to
  the Vite dev origin (`shared/config/env.ts:22`). Unchanged by this work.
- **Rate limiting** — none exists and none is proposed; it belongs with authentication.

### Privacy

The directory endpoints return personal data (names, and optionally email, position and
department) of real people with **no access control**. Recommendation: return `email`,
`position` and `department` only because the prompt names them as stored fields, and
consider omitting `email` from the list responses until authorization exists — the selector
only needs `fullName`. This is recorded as an open decision; the safest default chosen for
planning is to include them (the prompt lists them) while flagging the exposure. `users`
is never read (REQ-007), so no credential material is reachable.

### Performance

- Range query: indexed on `{ startAt: 1, endAt: 1 }`; bounded by required `from`/`to` and a
  maximum span. One query per calendar period.
- Participant resolution: two batched `$in` queries per response regardless of event count.
- Directory: sorted by `{ lastName, firstName }` (indexed), capped at 50 by default / 100
  maximum. Unanchored case-insensitive regex cannot use the index — acceptable at the
  expected volume, revisit with a text index if the directory grows.
- Payload size: a month of events with resolved participants. If a period ever returns
  hundreds of events, consider omitting participants from the list response and resolving
  them on open — **not** proposed now, because the committed design deliberately makes the
  read self-sufficient (`design.md:96`).
- No caching, no connection-pool tuning, no compression middleware proposed; nothing in the
  requirements calls for them.

### Accessibility

Not applicable — this change has no user interface. The PRD's accessibility-relevant
behaviour (dialogs, pickers, focus) is entirely client-side and out of scope.

---

## Data, compatibility, migration, rollout, and rollback

**Data.** Three collections gain their first schema and their first indexes beyond `_id`.
No collection is created or dropped. `users` is untouched. Mongoose builds declared indexes
on first connection, which is instant against empty collections
(`design.md:196-197`).

**Compatibility.** No deployed consumer and no existing client code calls any of these
endpoints (`client/src/` has no API layer). The only existing contract touched is the shape
of error responses, including the catch-all 404 — changed deliberately and with no consumer
to break.

**Migration.** None required *if* the collections are genuinely empty. If the verification
step finds documents written by the earlier untracked implementation under
`name`/`startsAt`/`endsAt`, a one-off rename (`$rename` in an `updateMany`, or a discard)
is needed before the new model is used. This is the single gating unknown and is the reason
verification is the first stage of the plan.

**Rollout.** Server-only, single deployment unit, no feature flag, no compatibility window.
The seed script runs once, manually, against whichever database `DB_HOST` names.

**Rollback.** `git revert` the commits, run `pnpm install` to restore the lockfile state,
then — if the seed or manual testing wrote documents — delete them and drop the declared
indexes. The four collections predate this change and stay. Safe only while the database
holds no real data (`design.md:201`).

**Observability.** `morgan` already logs every request (`server/src/app.ts:12`). The error
middleware logs the real error server-side. No metrics or tracing exist in the project and
none are proposed.

---

## Testing and verification strategy

**Levels.**

| Level | Scope | Tooling |
| --- | --- | --- |
| Integration (primary) | Routes → service → model → MongoDB, through the real Express app | `node --test` + `mongodb-memory-server` |
| Unit (targeted) | Zod schema edge cases where an integration test would be indirect | `node --test` |
| Build / typecheck | Whole server package | `pnpm --filter server build` |
| Manual smoke | Endpoints against the seeded database | `curl` or an HTTP client |

**Test harness rule (non-negotiable).** The helper starts an in-memory MongoDB, builds its
own connection string, connects Mongoose to it, clears collections between tests and tears
both down. **It must never read `DB_HOST`** (REQ-028, `design.md:169-171`). Add an assertion
in the helper that the resolved connection host is the in-memory instance, so a future edit
cannot quietly repoint it.

**Critical scenarios.**

*Range filtering* — event fully inside the range; fully before; fully after; straddling
`from`; straddling `to`; containing the whole range; event ending exactly at `from`
(excluded); event starting exactly at `to` (excluded); empty period returns `[]`; results
sorted ascending by `startAt`.

*Range parameter parsing* — `Z` bounds accepted; **`+03:00` offset bounds accepted and
interpreted as the correct instants** (this is the FullCalendar-driven regression test);
missing `from` or `to` → 400; `to <= from` → 400; span above the maximum → 400;
non-date text → 400.

*Create* — valid body → 201 with the read shape and a string `id`; whitespace-only title →
400; `endAt == startAt` → 400; `endAt < startAt` → 400; unknown attendee id → 400 and no
document written; unknown host id → 400; duplicate ids collapse to one; empty participant
arrays accepted; a body containing `createdByUserId` does not write it.

*Update* — participants replaced wholesale (removed people gone, added present); title and
times updated; unknown event id → 404; malformed id → 400; unknown participant id → 400 and
the event unchanged; duplicate ids collapse.

*Delete* — 204 with an empty body; the event no longer appears in a range query; unknown id
→ 404; malformed id → 400.

*Read shape* — `id` is a 24-hex string; `startAt`/`endAt` are ISO strings ending in `Z`;
`attendees`/`hosts` are resolved person summaries; an event holding a dangling participant
reference is still returned with that person omitted; audit fields are not exposed.

*Directory* — search matches on first name; on last name; case-insensitively; a search
containing regex metacharacters is treated literally; results sorted by last then first
name; the default cap and the maximum `limit` are honoured; `limit` above the maximum → 400;
non-active people are excluded by default; `canHostEvents=true` filters correctly on
`/api/employees`; the response shape carries `fullName`.

*Error envelope* — every failure response is exactly `{ error: { code, message } }`; no
`stack` key in any environment; the message for an unexpected internal error is the fixed
generic string and does not contain driver text; the catch-all 404 uses the same envelope;
`/api/health` still returns `{ status: 'ok' }`.

**Verification commands for the implementer.**

```bash
pnpm install                    # after adding dependencies
pnpm --filter server build      # the project's gate (server/AGENTS.md:35)
pnpm --filter server test       # new; node --test
pnpm --filter server seed       # manual, once, against DB_HOST
pnpm build:client               # only if any cross-package file changed
```

`pnpm build:client` and `pnpm build:server` are pre-approved in
`.claude/settings.json`; `pnpm install`, `test` and `seed` are not and will prompt.

**Manual verification.** With the server running and the database seeded: `GET /api/health`;
`GET /api/contacts?search=<partial>`; `GET /api/employees?canHostEvents=true`; create an
event; fetch it through a range that contains it; update its participants; delete it;
confirm `users` is still empty and that only `contacts`, `employees` and `events` were
written (`openspec/changes/add-events-page/tasks.md:94`).

**Not automatable here.** Anything requiring the client (calendar rendering, dialog
behaviour) — those belong to the client change.

---

## Unknowns, assumptions, and open decisions

| Item | Type | Chosen default for planning | Impact if wrong | How to validate |
| --- | --- | --- | --- | --- |
| Are `events`, `contacts`, `employees` actually empty? | Unknown | Assume empty per `design.md:9` | High — pre-existing documents under old field names render untitled or are dropped | Read-only `countDocuments()` + one `findOne()` per collection **before** writing model code (Stage 0) |
| `status` value set | Assumption | `'active' \| 'inactive'`, default `'active'` | Low — additive to widen | Confirm with the product owner; a future PRD section |
| `canHostEvents` default | Assumption | `true` | Low-medium — a `false` default yields an empty host selector | Confirm with the product owner |
| Should `canHostEvents` be enforced when assigning a host? | Open decision | **No** — selector filtering only | Medium — an ineligible employee could be assigned via the API | Ask the product owner; adding the check later is additive and only tightens |
| `position` / `department` vocabulary | Assumption | Optional free text | Low | Future Employee Management change |
| Who fills `createdByUserId` / `updatedByUserId`? | Open decision | Nullable, always `null`, never client-settable, not exposed | Low now, medium later — no audit trail until authentication lands | Revisit with the authentication change |
| Should `email` be returned by the unauthenticated directory endpoints? | Open decision | Yes — the prompt lists it as a stored field | Medium — personal data exposed without access control | Product/security decision; omitting it later is a contract narrowing, so decide before the client codes against it |
| `PATCH` with a full body vs `PUT` | Open decision | `PATCH`, full editable set | Low — semantic nicety | Settle when the client is written |
| Maximum `GET /api/events` span | Assumption | 366 days | Low | Tune against real calendar usage |
| Directory result cap | Assumption | 50 default / 100 max | Low (`design.md:205` leaves it open) | Tune against seeded data |
| Where the API contract is published | Open decision | Update `openspec/changes/add-events-page/design.md` + `tasks.md` and add a short section to `README.md` | Medium — the client could be built against stale names | Confirm the preferred home; the OpenSpec change is the project's own mechanism (`AGENTS.md:44-46`) |
| Does the reverted `dist/` output correspond to work the user still wants? | Unknown | Treated as evidence only, not restored | Low — the plan reproduces its good decisions and fixes its `z.iso.datetime()` bug | Ask the user whether any lost source should be recovered |
| Whether `mongodb-memory-server` can download its binary in this environment | Unknown | Assume yes; the binary appears to be cached under `server/node_modules/.cache` | Medium — the test suite cannot run offline on a clean machine | Run `pnpm --filter server test` once early (Stage 1 exit check) |
| Future multi-tenancy | Unknown | Not modelled | High if it lands later — index and query changes | Out of scope; no tenancy model exists in the repository |

---

## Scope estimate

**Overall size: medium.** Roughly 15 new source files plus a test suite, one modified file,
two dependency additions, and documentation reconciliation. All greenfield, no migration,
no existing consumers.

**Cost drivers, in order:**

1. The integration test suite and its in-memory Mongo harness — the largest single block,
   and the one with the most externally-imposed uncertainty (binary download, Mongoose 9
   connection lifecycle in tests).
2. The events module — four endpoints, the overlap query, participant validation, batched
   resolution and wholesale replacement.
3. The shared HTTP foundation — small in lines, high in blast radius, because it changes
   the shape of every error response including the existing 404.
4. The directory module — mostly mechanical once the person schema factory exists.
5. Documentation and OpenSpec reconciliation — small but easy to skip, and skipping it is
   what would cost a wasted client round.

**Confidence: medium-high.** The architecture is prescribed by committed project
instructions and a committed design document, the third-party contracts have been verified
against installed versions rather than assumed, and an earlier compiled implementation
confirms that the shape works. The main residual uncertainty is environmental (database
emptiness, `mongodb-memory-server` behaviour), not architectural.

**Recommended spikes:**

- **Spike A (30–60 min, blocking).** Read-only inspection of the three collections:
  document counts, one sample document each, and the current index list. Settles the highest
  impact unknown and determines whether a rename step is needed.
- **Spike B (1–2 h, blocking the test stage).** Stand up `mongodb-memory-server` with
  Mongoose 9 under `node --test` and prove one trivial round trip, before writing any real
  tests. De-risks the binary download and the Mongoose 9 connection lifecycle.

---

## Not investigated

- **Client implementation.** The Events page, dialog, FullCalendar wiring, TanStack Query
  hooks, FSD slice layout and client tests are out of scope. The FullCalendar contract was
  researched only far enough to prove the server payload can drive it and to pin the ISO
  offset requirement.
- **The live database contents.** `.env` is deny-listed for reading in
  `.claude/settings.json` and no connection was attempted. All statements about the
  collections come from `openspec/changes/add-events-page/design.md:9` and are flagged as
  requiring first-hand verification (Spike A).
- **Authentication and authorization design.** Explicitly deferred by the PRD and by the
  committed proposal. `users` was not modelled or inspected.
- **Deployment, CI, containers, health/readiness probes.** No CI configuration, Dockerfile
  or deployment manifest exists anywhere in the repository.
- **Linting and formatting.** No configuration exists; `AGENTS.md:37-38` says so explicitly.
  Introducing either is separate work.
- **Performance benchmarking.** No baseline exists and the collections are empty; index
  choices are justified by query shape, not by measurement.
- **The five client-scoped skills** (`feature-sliced-design`, `react-best-practices`,
  `react-anti-patterns`, `state-management`, `data-driven-rendering`) — noted, not loaded,
  because this change touches no client code.
- **`.ai_toolkit/skills/nodejs-backend-engineer/references/*`** — the routing table in
  `SKILL.md` was followed and the principles applied, but the individual reference documents
  were not read in full; the ones relevant here (`databases`, `api-security`,
  `testing-quality`) are recommended reading for the implementer.
- **Recovering the lost untracked source.** `server/dist/` was read as evidence. No attempt
  was made to decompile, restore or reinstate it, and the plan rebuilds from source rather
  than from build output.
