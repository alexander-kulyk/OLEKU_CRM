# Research: Server-side Events API (events, contacts, employees)

## Research status

- **Change:** `add-events-server-api`
- **Confidence:** High on the technical findings — every project claim is read from tracked source, and every external contract is read from the installed package — but medium on scope, because two committed change sets already describe this same server surface and the runtime database state could not be verified.
- **Blocking unknowns:** 2 blocking (relationship to the existing `add-events-api` change — D-001; actual database contents — U-001), plus 4 product decisions that change observable behavior (D-002 to D-005).

## Executive summary

The request asks for the server slice behind `docs/prd/release 1.0.0/eventsPage.md`: endpoints and controllers to read events for a calendar, create, update and delete an event, plus read endpoints for contacts and employees, over the supplied `events` / `contacts` / `employees` field sketch — and asks that the FullCalendar contract be verified first because the sketch may not fit it.

The server today is a bare Express 5 app: middleware, one health route, a 404 that echoes the caller's URL, and an inline error handler that returns `error.message` and a stack trace (EVID-001). There are no modules, models, routers, validation, tests, or error envelope in tracked source. `zod` is not a declared server dependency (EVID-004).

The supplied schema sketch **does** fit FullCalendar 6.1.21; nothing needs renaming for the calendar's sake, and `title` happens to be FullCalendar's own property name. Two library behaviors constrain the server anyway (EVID-011 to EVID-014): an `end` that is not later than `start` is silently discarded and replaced by a one-hour default, and any unrecognized top-level key is silently absorbed into `extendedProps`. Both turn a server-side mistake into a plausible-but-wrong render rather than an error.

The dominant scope finding is not technical. Three artifact sets already cover this exact surface: the tracked OpenSpec change `add-events-api` (proposal, design, three capability specs, 74 tasks, none done), the tracked non-OpenSpec set under `specs/add-events-api/`, and the tracked full-stack change `add-events-page` (63 tasks, none done) which specifies the same endpoints under different field names (EVID-007 to EVID-009). A fourth description of the same API is the main risk this change carries.

Recommended direction: keep the domain-shaped wire contract and the boundary-plus-model double enforcement that the prior design already justified, and treat this change primarily as a *reconciliation* of the existing overlapping artifacts rather than a fourth parallel description — but that call is a decision the proposal must make explicitly (D-001), not one research can settle.

## Input and scope

### Explicit requirements

1. Implement the server side of `docs/prd/release 1.0.0/eventsPage.md`.
2. Endpoints and controllers to fetch events for the calendar.
3. Create an event.
4. Delete an event.
5. Update an event.
6. Additionally, endpoints to fetch contacts and employees.
7. Persist the supplied field sketch: `employees{firstName,lastName,email,position,department,canHostEvents,status}`, `contacts{firstName,lastName,email,status}`, `events{title,startAt,endAt,attendeeIds[],hostIds[],createdByUserId,updatedByUserId}`.
8. Verbatim: "befor check what contracts requires fullcalendar for events becouse events data base scheem can be not relevant" — verify the FullCalendar contract first, treating the sketch as provisional.

### Constraints and exclusions

- Out of scope by the PRD: roles and permissions, notifications, recurring events, reminders, calendar and video integrations, attendance tracking (`docs/prd/release 1.0.0/eventsPage.md:30-38`).
- Deferred product rules by the PRD: overlap rules, past events, mandatory hosts, multi-day and all-day events, duration limits, recurrence, time-zone policy, notification triggers, drag/resize, per-type fields (`docs/prd/release 1.0.0/eventsPage.md:596-611`).
- "for server side" excludes client work; the request names no client change.
- Project constraints are recorded as EVID-005 and EVID-006 below.

### Research questions

| ID | Question | Why it matters | Answer or status | Evidence | Consequence for later artifacts |
| --- | --- | --- | --- | --- | --- |
| RQ-001 | What does FullCalendar 6.1.21 actually require of an event, and does the supplied sketch satisfy it? | The user made this the gating question | Answered: only a resolvable `start` is required; the sketch satisfies the contract; two silent-failure modes constrain the server | EVID-011, EVID-012, EVID-013 | Specs must state the returned instant format and the span invariant |
| RQ-002 | What form do the calendar's period boundaries take on the wire? | A parser mismatch presents as an empty calendar, not an error | Answered: ISO strings carrying the browser's **numeric offset**, not `Z`, whenever the local offset is non-zero | EVID-014, EVID-015, EVID-016 | Specs must accept offset-bearing instants; tasks must regression-test it |
| RQ-003 | What exists on the server today and what must be preserved? | Determines the true delta | Answered: health route, URL-echoing 404, leaking error handler; nothing else | EVID-001 | Specs must preserve health and redefine 404/error behavior |
| RQ-004 | Are the dependencies a validation layer needs actually declared? | A phantom dependency builds locally and fails on clean install | Answered: `zod` and `mongodb-memory-server` are present in `server/node_modules` but absent from both `server/package.json` and the lockfile | EVID-004, EVID-010 | Tasks must add them through pnpm and commit the lockfile |
| RQ-005 | Which existing OpenSpec changes cover this surface, and do they conflict? | Duplicate contracts drift | Answered: `add-events-api` covers it exactly; `add-events-page` covers it with different field names; neither has started | EVID-007, EVID-008, EVID-009 | D-001 must be resolved in the proposal |
| RQ-006 | Which invariants can storage enforce, and does the ORM enforce them on every path? | An invariant enforced on one path only is not enforced | Answered: MongoDB enforces none; Mongoose document hooks do **not** run for query updates, and update validators are off by default | EVID-017, EVID-018 | Specs must state the invariant; design must pick a write path that actually triggers it |
| RQ-007 | What is the actual runtime state of the database? | Pre-existing documents under other field names would render wrong | **Unknown** — verifying requires the Atlas credential in `server/.env`, which this research is not authorized to use | U-001 | Proposal must not assert "empty collections" as fact |
| RQ-008 | What do the directory endpoints need to serve the selectors? | Determines filters and payload | Answered from the PRD: search by name, no duplicates, host candidates are "eligible" employees | `docs/prd/release 1.0.0/eventsPage.md:293-320, 346-376` | Specs must define search, ordering, bounding, and eligibility filtering |
| RQ-009 | What security posture applies? | Endpoints will write to a shared cluster | Answered: no auth exists anywhere in tracked source; roles are out of PRD scope | EVID-001, EVID-020 | Proposal must record the exposure explicitly |

## Evidence reviewed

| ID | Source | Evidence type | What it establishes |
| --- | --- | --- | --- |
| EVID-001 | `server/src/app.ts:7-44` | Source | Only `/api/health` (`:16-18`); the 404 echoes `req.originalUrl` (`:20-25`); the error handler returns `error.message` (`:31`) and a stack trace outside production (`:37`); no router, validation, or envelope |
| EVID-002 | `server/src/server.ts:8-27`, `server/src/main.ts:1-3` | Source | Startup order `main → server → app`; Mongo connect before listen; SIGINT/SIGTERM close then disconnect |
| EVID-003 | `server/src/shared/config/env.ts:5-23`, `server/src/shared/infra/mongoose/client.ts:12-20` | Source | `DB_HOST` is required and throws at startup; `CORS_ORIGIN` defaults to the Vite dev origin; a single Mongoose connection, no schemas |
| EVID-004 | `server/package.json:9-21` | Manifest | Scripts are `dev`, `build`, `start` only — no test script; dependencies are cors, dotenv, express, helmet, mongoose, morgan; **no `zod`** |
| EVID-005 | `server/AGENTS.md:10,15,20,22,25,27,34`; `server/CLAUDE.md:5,18,20,21,23` | Instructions | Express 5 + Mongoose 9 on Node 24; `.ts` extensions on relative imports; feature code in `src/modules/<feature>/` mounted under `/api`; env read only in `env.ts`; Zod at the boundary; routers above the 404; `contacts`/`employees` are the people collections and `users` is authentication only; `pnpm --filter server build` is the gate |
| EVID-006 | `AGENTS.md:22-25,37`; `server/tsconfig.json:15-16`; `package.json:6-7`; `.nvmrc` | Instructions/config | pnpm-only installs from the root with the lockfile committed; no repo lint or test script today; `noUnusedLocals`/`noUnusedParameters` are on; pnpm 11.18.0, Node 24 |
| EVID-007 | `openspec/changes/add-events-api/` (`proposal.md`, `design.md`, 3 specs, `tasks.md`; `.openspec.yaml` `schema: spec-driven, created: 2026-08-07`) | Project doc | A complete, tracked, spec-driven change for exactly this request; 74 tasks, 0 done |
| EVID-008 | `openspec/changes/add-events-page/proposal.md`, `design.md:8-12`, `tasks.md` | Project doc | A tracked full-stack change covering the same server endpoints under `name`/`startsAt`/`endsAt`; 63 tasks, 0 done; states the four collections are empty and the Atlas cluster is shared |
| EVID-009 | `specs/add-events-api/report/research-report.md`, `plan/implementation-plan.md`, `tasks/tasks.md` (3,435 lines, tracked at commit `313e41d`) | Project doc | A prior non-OpenSpec research/plan/tasks set for the same request, reaching partly different conclusions (notably `canHostEvents` default and no controller layer) |
| EVID-010 | `pnpm-lock.yaml:83-115` vs `server/node_modules/zod`, `server/node_modules/mongodb-memory-server` (symlinks dated Aug 5) | Command output | The lockfile's `server` importer declares neither package, yet both are linked into `server/node_modules` — phantom dependencies from a reverted install |
| EVID-011 | `client/node_modules/@fullcalendar/core/internal-common.js:3236-3245` | External source (installed 6.1.21) | An event whose `start` does not resolve returns `null` from `parseSingle` and is silently dropped |
| EVID-012 | `client/node_modules/@fullcalendar/core/internal-common.js:3266-3281`, `:1491-1493` | External source | `endMarker <= startMarker` sets the end to `null`; the event then gets `defaultTimedEventDuration` (`01:00:00`). An inverted span renders as a wrong one-hour block, never an error |
| EVID-013 | `client/node_modules/@fullcalendar/core/internal-common.js:1619-1633`, `:3223`, `:3251-3260` | External source | `refineProps` collects every unrecognized key into `extra`, which `parseEventDef` merges into `extendedProps`; `allDay` is inferred from whether start and end strings specify a time |
| EVID-014 | `client/node_modules/@fullcalendar/core/internal-common.js:821-837`, `:853-862`, `:2139-2149`, `:2161-2172` | External source | `formatIso` emits `Z` only at offset 0; a non-zero offset is written as `±HH:MM`; a `null` offset (named zone without a plugin) **strips the designator entirely** |
| EVID-015 | `client/node_modules/@fullcalendar/core/index.js:1104`, `:964-967`, `:1514-1516` | External source | `datesSet` reports the visible range via `formatIso`; the JSON-feed source sends `start`, `end`, `timeZone` query parameters built the same way |
| EVID-016 | `client/node_modules/zod/src/v4/core/regexes.ts:119-132` (zod 4.4.3) | External source | `z.iso.datetime()` accepts only `Z`; `{ offset: true }` additionally accepts `±HH:MM`; `{ local: true }` accepts no designator |
| EVID-017 | `node_modules/.pnpm/mongoose@9.9.1/node_modules/mongoose/lib/query.js:3614,3852` | External source (installed 9.9.1) | `runValidators` defaults to **false** for update queries |
| EVID-018 | https://mongoosejs.com/docs/middleware.html (accessed 2026-08-09) | External doc | "Pre and post `save()` hooks are not executed on `update()`, `findOneAndUpdate()`, etc." |
| EVID-019 | `server/node_modules/express/lib/request.js:217-228`, `lib/application.js:97`; `node_modules/.pnpm/router@2.2.0/node_modules/router/lib/layer.js:142-172` | External source (express 5.2.1) | `req.query` is a getter with no setter; the default query parser is `simple`; the router forwards a rejected promise from a handler to `next(error)` |
| EVID-020 | `docs/prd/release 1.0.0/eventsPage.md` (`:30-38`, `:104-118`, `:151-160`, `:164-198`, `:285-287`, `:293-332`, `:346-376`, `:390-411`, `:499-529`, `:596-611`) | Project doc | Scope and exclusions; create/update/delete flows; end later than start; attendee/host selection, search, no duplicates; required fields; submission and error-handling expectations; deferred product decisions |
| EVID-021 | `server/dist/` (untracked build output; `.gitignore:2`) — `modules/events/event.schemas.js:9-24`, `event.model.js:14-34`, `event.service.js:49-91`, `modules/directory/*.js`, `shared/http/*.js`, `app.js` | Command output | A prior, uncommitted implementation: `name`/`startsAt`/`endsAt`, `z.iso.datetime()` **without** `{ offset: true }`, full-body PATCH, no `status`/`canHostEvents`/`position`/`department`, no audit fields, escaped regex search capped at 50, and an envelope error middleware |
| EVID-022 | `git ls-files openspec specs`, `git status --short --ignored`, `git log 313e41d bce2dbf` | Command output | All three artifact sets are tracked; `server/dist/` and `server/.env` are ignored; no `server/src` module code was ever committed |

## Current system and relevant flows

A request enters `createApp()` (EVID-001) and passes `helmet`, `cors` bound to `env.corsOrigin`, `morgan`, `express.json({ limit: '1mb' })`, and `express.urlencoded`. The only route is `GET /api/health`. Everything else falls into the catch-all 404, which reflects `req.originalUrl` into the body. The error handler is registered last and is reached today only through the router's promise/throw forwarding (EVID-019); it logs the error and returns `{ success, error, timestamp }` plus `stack` outside production — a shape no client contract depends on yet, because there is no client code beyond a router stub and a query-client (`client/src/` holds five files).

Persistence is a single Mongoose connection opened in `server.ts` before `listen` (EVID-002, EVID-003). No schema, model, or index is declared anywhere in tracked source, so every invariant the PRD states — non-blank title, end later than start, no duplicate participants, participants must exist — is currently enforced nowhere, and MongoDB itself enforces neither referential integrity nor cross-field constraints.

On the consumer side, the client depends on FullCalendar 6.1.21 and TanStack Query but contains no events code. FullCalendar's visible range reaches application code as `startStr`/`endStr` from `datesSet`, or as `start`/`end`/`timeZone` query parameters for a JSON feed, all formatted by `formatIso` (EVID-014, EVID-015).

## Findings

### Contracts and observable behavior

- **[Verified]** F-001 — The only tracked HTTP contracts are `GET /api/health` returning `{ status: 'ok' }` and the two failure shapes in EVID-001. Nothing else can break, because nothing else exists; there is no deployed consumer and no client code reads these endpoints.
- **[Verified]** F-002 — The current error handler returns `error.message` verbatim and a stack trace outside production (EVID-001:31,37). Any thrown driver, schema, or connection error becomes response text today. The PRD requires errors that avoid exposing technical detail (EVID-020:512-529), so this is a behavior the change must replace, not extend.
- **[Verified]** F-003 — Express 5's `req.query` is a getter with no setter (EVID-019); validated query values must be carried by return value, not by reassigning the request. The default query parser is `simple`, so bracket/nested query syntax is not parsed — repeated keys become arrays, nested objects do not exist.
- **[Verified]** F-004 — The router forwards a rejected promise from a 1-3 argument handler to `next(error)` (EVID-019), so `async` handlers that throw reach the error middleware without a wrapper. A handler declared with four parameters is treated as an error handler and skipped for normal requests — relevant given `noUnusedParameters` (EVID-006) forces underscore-prefixed placeholders.
- **[Inference, from EVID-020:104-118,151-160,499-508]** F-005 — The PRD's dialog behavior (dialog stays open on failure, data preserved, repeated submission prevented) implies the API must fail atomically: a rejected create or update must leave storage untouched so a retry with the same payload is safe.

### Data and invariants

- **[Verified]** F-006 — No schema or index exists in tracked source (EVID-001 to EVID-003), so this change writes the first schema for whichever collections it touches.
- **[Verified]** F-007 — Mongoose document hooks do not run on query updates and update validators default to off (EVID-017, EVID-018). An invariant such as "end later than start" holds on the update path only if the update is performed as a document load-mutate-`save()`, or if validators are explicitly enabled and expressed in a form update validation can evaluate.
- **[Verified]** F-008 — The supplied sketch adds four person fields (`position`, `department`, `canHostEvents`, `status` on employees; `status` on contacts) and two audit fields that the uncommitted prior implementation never had (EVID-021). Those fields are the substantive delta of this request against the abandoned attempt.
- **[Verified]** F-009 — The PRD never states that a host must be eligible, that a participant must be active, or that an assignment must be rejected when it is not (EVID-020:293-320,346-376). `canHostEvents` and `status` come from the request sketch, not from stated behavior. Whether they gate writes or only filter selectors is D-002.
- **[Inference, from EVID-020:334-342,378-384]** F-010 — "For an existing event, this change becomes persistent only after the user saves" implies participant assignment is a whole-set replacement on the event write, and argues against per-participant endpoints.
- **[Unknown]** F-011 — Whether `events`, `contacts`, `employees` exist and are empty in the target database. Both prior artifact sets assert it (EVID-008:9), and neither cites a verification. See U-001.

### Project patterns and constraints

- **[Verified]** F-012 — Feature code belongs under `src/modules/<feature>/` mounted under `/api`, above the 404 and error handler; Zod is the prescribed boundary validator; env access is confined to `env.ts`; `users` is authentication-only (EVID-005). The request's explicit ask for "controllers" is an addition to the documented model/routes/service triple, and the two committed artifact sets disagree about whether that addition is warranted (EVID-007 design vs EVID-009 plan).
- **[Verified]** F-013 — `zod` and `mongodb-memory-server` resolve from `server/node_modules` today but are declared in neither the manifest nor the lockfile (EVID-004, EVID-010). Code importing them compiles and runs on this machine and breaks on a clean `pnpm install --frozen-lockfile`.
- **[Verified]** F-014 — `pnpm --filter server build` is the only verification gate; there is no test script in either package (EVID-004, EVID-006). Any test stack introduced here is new project infrastructure, and the instructions forbid claiming tests passed unless a script exists and was run.
- **[Verified]** F-015 — Node 24 native type stripping is the runtime (EVID-005), and `server/tsconfig.json` sets no `erasableSyntaxOnly`, so a non-erasable construct (a TypeScript `enum`, a parameter property) would pass `tsc` and fail at runtime under `node --watch`.
- **[Verified]** F-016 — Three tracked artifact sets describe this surface (EVID-007, EVID-008, EVID-009), none implemented, disagreeing on field names (`title`/`startAt`/`endAt` vs `name`/`startsAt`/`endsAt`), on `canHostEvents` default (`false` vs `true`), and on whether a controller layer exists.

### External contracts

FullCalendar `@fullcalendar/core` 6.1.21 (installed in `client`):

- **[Verified]** F-017 — Only a resolvable `start` is required; an unresolvable start silently drops the event (EVID-011). `title`, `end`, `allDay` are optional; `id` is refined with `String`.
- **[Verified]** F-018 — An `end` not later than `start` is discarded and replaced by a one-hour default (EVID-012). A server that emits an inverted span produces a plausible wrong render, never a client-side error.
- **[Verified]** F-019 — Any unrecognized top-level key silently becomes an `extendedProps` entry (EVID-013). A misspelled field renders as an untitled event rather than failing.
- **[Verified]** F-020 — `allDay` is inferred from whether both boundary strings specify a time (EVID-013). A date-only string flips an event into the all-day row; a full instant resolves it to `false`.
- **[Verified]** F-021 — Range boundaries reach application code as `formatIso` output: `Z` only when the offset is zero, `±HH:MM` otherwise, and **no designator at all** when the offset is unknown, which happens when `timeZone` names a zone with no plugin loaded (EVID-014, EVID-015).
- **[Verified]** F-022 — Zod 4's `z.iso.datetime()` accepts only `Z` unless `{ offset: true }` is passed, and the offset alternative matches exactly `±HH:MM` (EVID-016). The abandoned implementation used the default form (EVID-021), which would have rejected every request from a browser outside UTC. This is the concrete answer to the user's "check FullCalendar first" instruction: the trap is in the *range parameters*, not in the event body shape.
- **[Verified]** F-023 — FullCalendar treats `end` as exclusive. For timed events the exclusive end and the real end instant coincide, so no adjustment applies; the well-known off-by-one-day adjustment concerns all-day events, which the PRD defers (EVID-020:596-611).
- **[Inference, from F-017 to F-021]** F-024 — The supplied `events` sketch is compatible with FullCalendar without renaming. `title` matches verbatim; `startAt`/`endAt` map to `start`/`end`; resolved participants belong in `extendedProps` explicitly rather than via the leftover-key path.

## Options and research-informed direction

| Direction | Evidence-supported benefits | Costs and risks | Reversibility |
| --- | --- | --- | --- |
| A. Treat this change as the single reconciled description of the server API and retire/supersede `add-events-api` explicitly | One contract; removes the drift in F-016; carries forward verified findings | Requires an explicit supersession decision and leaves `add-events-page`'s server half stale until revised | Moderate — an archived or edited change is recoverable from git |
| B. Write a fourth parallel description alongside the existing three | No coordination needed now | Compounds F-016; the client will be built from whichever document is read first, with `name` vs `title` as the failure mode | Poor — drift widens as documents age |
| C. Abandon this change and implement `add-events-api` as written | Zero new documentation; that change is complete and internally consistent | Loses the corrections this research surfaced (F-007, F-013, F-021's null-offset case) and the research-driven schema this change was created under | High — nothing has been implemented |
| D. Domain-shaped wire contract (`id`, `title`, `startAt`, `endAt`, `attendees[]`, `hosts[]`) | Keeps a rendering library out of the API; F-019 makes the native shape fail silently on a typo | One mapping function on the client | High |
| E. FullCalendar-native wire shape | Client passes the array straight to `events` | F-019 removes the failure signal for a server-side typo; a FullCalendar major becomes an API change | Low |

### Recommended direction

Reconcile rather than duplicate (A), and keep the domain-shaped contract (D). The boundaries research supports:

- The calendar read is a bounded period query; there is no unbounded "all events" read, since the calendar always knows its visible period and an unbounded default would become a full collection scan.
- Instants are exchanged with an explicit zone designator and accepted with a numeric offset (F-021, F-022); returned instants always carry a time component so `allDay` inference cannot flip (F-020).
- Span ordering and participant uniqueness are enforced at the boundary, and any persistence-level backstop must sit on a write path that actually executes it (F-007).
- The directory endpoints stay read-only, searched by name, ordered, and bounded in result count (EVID-020:293-320, F-010).
- Audit fields are never accepted from a request body; there is no authenticated actor to fill them (F-008).

Everything above is a constraint, not a plan. Which of `add-events-api`'s three capability names this change adopts, and whether it supersedes or replaces that change, is D-001.

## Risks and edge cases

| ID | Risk or edge case | Evidence | Likelihood | Impact | Constraint for later artifacts |
| --- | --- | --- | --- | --- | --- |
| R-001 | Four documents describe one API; the client is built against the wrong field names | F-016, EVID-007, EVID-008, EVID-009 | High | High | The proposal must state the relationship to `add-events-api` and `add-events-page` before defining any endpoint |
| R-002 | Range parsing rejects every request from a non-UTC browser | F-021, F-022, EVID-021 | High if unguarded | High — presents as an empty calendar, not an error | Specs must define accepted instant forms; verification must cover an offset-bearing range |
| R-003 | An inverted or zero-length span renders as a wrong one-hour block instead of failing | F-018 | Medium | Medium | The invariant must be stated as a rejection, not left to the client |
| R-004 | A model-level backstop is assumed to protect updates but does not run on query updates | F-007, EVID-017, EVID-018 | Medium | High — a silently invalid stored span | Design must name the write path that triggers the backstop, or drop the claim |
| R-005 | `zod` / `mongodb-memory-server` are used but undeclared; clean installs and CI break | F-013, EVID-010 | High if unnoticed | Medium | Tasks must add them via pnpm from the root and commit the lockfile; verification must check the `server` importer |
| R-006 | Unauthenticated read/write endpoints against a shared hosted Atlas cluster | EVID-003, EVID-008:11, EVID-020:30-38 | High while reachable | High — full directory read and event destruction | Proposal must record the exposure and the local-only constraint as known debt |
| R-007 | A test suite that truncates collections reads `DB_HOST` and points at Atlas | EVID-003, EVID-008:171 | Low | Very high — irreversible data loss | Verification design must make the suite structurally unable to read `DB_HOST` |
| R-008 | A seed script writes into a shared cluster non-idempotently | EVID-021 (`seed.js` upserts by email), EVID-008:198 | Medium | Medium | Any seeding must be idempotent and touch only directory collections |
| R-009 | Existing documents under the old field names (`name`/`startsAt`/`endsAt`) from the abandoned attempt | EVID-021, U-001 | Unknown | High — such events would render untitled or be dropped (F-017, F-019) | Proposal must not assert empty collections; a read-only check must precede any claim |
| R-010 | The error handler leaks driver text and stack traces to the client | F-002 | Certain today | Medium | Specs must define what an error response may never contain, in every environment |
| R-011 | Unescaped or unbounded search terms cause pattern injection or catastrophic backtracking | EVID-021 (prior code escaped and capped), EVID-020:293-320 | Medium | Medium | Specs must require literal matching and a bounded term and result count |
| R-012 | Referential drift: a participant reference outlives its contact or employee | F-006, F-009 | Medium over time | Medium — a whole period of the calendar could fail to render | Specs must define read behavior for an unresolvable reference |
| R-013 | A non-erasable TypeScript construct passes `tsc` and fails at runtime | F-015 | Low | Medium | Constraint for design; verification must exercise the dev entry point, not only `build` |
| R-014 | `datesSet`/JSON-feed strings arrive with **no** zone designator when a named `timeZone` is configured without a plugin | F-021 (EVID-014 null-offset branch) | Low today | Medium | Record as a client-side configuration constraint; a strict server parser will reject those strings |
| R-015 | The directory endpoints expose personal data (names, emails, employment details) of every contact and employee to any unauthenticated caller, and the calendar read exposes who attends what | F-009, R-006, EVID-020:293-332 | High while reachable | High | Specs must define the minimum person fields each response carries; the proposal must treat the directory payload as PII, not as a convenience projection |

## Unknowns, assumptions, and decisions needed

| ID | Type | Item | Impact if wrong | How to resolve |
| --- | --- | --- | --- | --- |
| U-001 | Unknown | Whether the target database's `events`/`contacts`/`employees` collections exist and are empty | High — R-009; a rename would need a backfill instead of costing nothing | A read-only document count and one sample per collection, run by someone authorized to use the Atlas credential |
| U-002 | Unknown | Whether `users` documents exist and what identifier type they carry | Low now — only affects the audit reference type | Same read-only check |
| U-003 | Unknown | Whether the user wants the abandoned implementation under `server/dist/` recovered or treated as evidence only | Low — the compiled output is readable but predates the requested field set (F-008) | Ask the user |
| U-004 | Unknown | Whether `mongodb-memory-server` can obtain its binary in this environment | Medium — a test stack that cannot run offline | Attempt one run after declaring the dependency |
| D-001 | Decision needed | Whether `add-events-server-api` supersedes, replaces, or coexists with `add-events-api`, and how `add-events-page`'s server half is reconciled | High — R-001 | Product/engineering call in the proposal; both changes are unstarted, so either direction is currently free |
| D-002 | Decision needed | Whether `canHostEvents` and `status` gate event writes or only filter the selectors, and whether `canHostEvents` defaults to `true` or `false` | Medium — a `false` default yields an empty host selector until backfilled; write-time enforcement can reject valid business cases the PRD never forbids (F-009) | Product call; the two prior artifact sets chose opposite defaults (EVID-007 vs EVID-009) |
| D-003 | Decision needed | Whether event update accepts a partial subset or requires the full editable field set | Medium — changes both the client contract and the invariant checks on a one-sided span change | Product/engineering call; the prior implementation required a full body (EVID-021), the prior design chose partial (EVID-007) |
| D-004 | Decision needed | The maximum period span for a calendar read and the directory result cap | Low — both are tunable without changing shape | Engineering call recorded in design |
| D-005 | Decision needed | Time-zone policy: absolute instants versus business-local wall-clock scheduling | High if reversed later — changes what is stored, not just what is returned | Deferred by the PRD (EVID-020:596-611); proposal should state the working reading explicitly |
| A-001 | Assumption | Attendees are `contacts` and hosts are `employees`, per the request sketch and project instructions (EVID-005) | Low — consistent across every source | Confirmed by instructions; no further action |
| A-002 | Assumption | `status` is a closed two-value set (`active`/`inactive`) | Low — widening is additive | Confirm with the product owner |
| A-003 | Assumption | No authenticated actor exists, so audit fields cannot be populated | Low — matches tracked source | Revisit with the authorization change |

## Handoff to OpenSpec

<!-- Reference finding/risk/decision IDs rather than restating their content. -->

### Facts later artifacts may rely on

F-001, F-003, F-004, F-006, F-012, F-014, F-015 for the current system and its rules; F-017 through F-024 for the FullCalendar and Zod contracts that answer the user's gating question; EVID-007 to EVID-009 for what already exists on paper; EVID-021 for what the abandoned attempt did and did not cover.

### Constraints later artifacts must preserve

EVID-005 and EVID-006 in full (module placement, mounting order, boundary validation, env confinement, `users` untouched, pnpm-only installs, the build gate). F-002 and R-010 for what an error response may carry. F-007 for where an invariant is actually enforced. F-013/R-005 for dependency declaration. R-006, R-007, and R-015 as non-negotiable safety and privacy constraints on anything that touches the shared cluster or exposes directory data.

### Decisions proposal/design must resolve

D-001 first, because it determines whether the rest of this change is a new contract or a reconciliation. Then D-002, D-003, D-005; D-004 may be settled in design. U-001 must be resolved or explicitly carried as an unknown — the proposal must not restate "the collections are empty" as verified fact.

### Behaviors specs must define precisely

Period-overlap semantics including boundary exclusion (F-024, R-002); accepted and returned instant formats (F-020, F-021, F-022); the span invariant and where it holds (F-018, R-003, R-004); participant set replacement and uniqueness (F-010); participant resolution and unresolvable references (R-012); directory search, ordering, bounding, literal matching, and eligibility filtering (RQ-008, R-011); the failure envelope and what it must never contain (F-002, R-010); preservation of `GET /api/health` and the redefined unknown-route behavior (F-001); atomic failure of writes (F-005); audit fields never accepted and never returned (F-008, A-003).

### Verification concerns tasks must eventually cover

The offset-bearing range regression (R-002); update-path invariant enforcement (R-004); dependency declaration in the lockfile (R-005); test isolation from `DB_HOST` (R-007); seed idempotence (R-008); absence of stack traces and driver text in every environment (R-010); search-term escaping and bounding (R-011); dangling-reference reads (R-012); and the dev entry point as well as `pnpm --filter server build` (R-013, F-014).

## Not investigated

- **The Atlas database contents.** Reading them requires the credential in the gitignored `server/.env`, which this research was not authorized to use. Recorded as U-001 rather than assumed.
- **Client implementation.** The request is explicitly server-side and the client holds no events code, so there is no consumer contract to break today (F-001). FullCalendar was investigated only as far as it constrains the server payload.
- **Authentication and authorization design.** Out of PRD scope (EVID-020:30-38); only its absence is recorded, as R-006 and R-015.
- **Runtime performance measurement and `.ai_toolkit/` internals.** No query exists yet to measure, cluster latency is not observable without connecting, and the submodule's skills do not constrain the API contract.
- **The unused root dependencies (`@mui/x-date-pickers`, `zustand`).** Unrelated to the server API; removing them belongs to whichever change owns the client.
