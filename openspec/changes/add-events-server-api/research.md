# Research: Server-side Events API (events, contacts, employees)

## Research status

- **Change:** `add-events-server-api`
- **Confidence:** Medium-high — every project and library claim below was read from tracked source or the installed package, but the runtime database state could not be inspected and three artifact sets already describe this same server surface.
- **Blocking unknowns:** 2 blocking (D-001 relationship to the existing `add-events-api` change; U-001 actual contents of the MongoDB collections), plus 4 product decisions that change observable behavior (D-002 to D-005).

## Executive summary

The request is the server slice behind `docs/prd/release 1.0.0/eventsPage.md`: endpoints and controllers to read events for a calendar, create, update and delete an event, plus read endpoints for contacts and employees that populate the attendee and host selectors — over the supplied field sketch, with the FullCalendar contract verified *first* because the sketch may not fit it.

Verified current state: the server is a bare Express 5 app with one health route, a 404 that echoes the caller's URL, and an inline error handler that returns `error.message` plus a stack trace outside production (EVID-001). No modules, models, routers, validation, envelope, or tests exist in tracked source. `zod` is not a declared server dependency, though it is physically linked into `server/node_modules` from a reverted install (EVID-004, EVID-005). The client has no code that calls any API (EVID-020), so there is no consumer to break.

The gating question is answered: **the supplied sketch does fit FullCalendar 6.1.21** — nothing needs renaming for the calendar's sake, and `title` happens to be FullCalendar's own property name. But three library behaviors constrain the server regardless (F-001 to F-004): an `end` that is not later than `start` is silently discarded and replaced by a one-hour default; any unrecognized top-level key is silently absorbed into `extendedProps`; and the calendar sends period boundaries as ISO strings carrying the **browser's numeric offset**, not `Z`. The third interacts with Zod 4's default ISO parser, which accepts only `Z` — a mismatch that would reject every request from a non-UTC browser and present as an empty calendar rather than an error (F-005).

The dominant finding is not technical. Three tracked artifact sets already cover this exact surface: the OpenSpec change `add-events-api` (proposal, design, three capability specs, 74 tasks, none done), the non-OpenSpec set under `specs/add-events-api/`, and the full-stack change `add-events-page` (63 tasks, none done) which specifies the same endpoints under different field names (EVID-008 to EVID-010). Producing a fourth parallel description is the main risk this change carries; the recommended direction treats it as a reconciliation, but that call belongs to the proposal (D-001).

## Input and scope

### Explicit requirements

1. Implement the server side of `docs/prd/release 1.0.0/eventsPage.md`.
2. Endpoints and controllers to fetch events for the calendar.
3. Create an event.
4. Delete an event.
5. Update an event.
6. Additionally, endpoints to fetch contacts and employees.
7. Persist the supplied field sketch: `employees{firstName,lastName,email,position,department,canHostEvents,status}`, `contacts{firstName,lastName,email,status}`, `events{title,startAt,endAt,attendeeIds[],hostIds[],createdByUserId,updatedByUserId}`.
8. Verbatim: *"befor check what contracts requires fullcalendar for events becouse events data base scheem can be not relevant"* — verify the FullCalendar contract first and treat the sketch as provisional.

### Constraints and exclusions

- Out of scope by the PRD: role-based permissions, notifications, recurring events, reminders, calendar integrations, video-meeting integrations, attendance tracking (`docs/prd/release 1.0.0/eventsPage.md:30-38`).
- Deferred product rules by the PRD §18: host overlap, overlapping attendance, past events, mandatory host, multiple hosts, multi-day events, all-day events, duration limits, recurrence, **time-zone handling**, notification triggers, participant-removal confirmation, drag/resize, per-type fields (`docs/prd/release 1.0.0/eventsPage.md:596-611`).
- "for server side" excludes client work; no client change was requested.
- Project constraints are recorded as EVID-006 and EVID-007.

### Research questions

| ID | Question | Why it matters | Answer or status | Evidence | Consequence for later artifacts |
| --- | --- | --- | --- | --- | --- |
| RQ-001 | What does FullCalendar 6.1.21 actually require of an event, and does the supplied sketch satisfy it? | The user made this the gating question | Answered: only a resolvable `start` is required; the sketch satisfies the contract; two silent-failure modes constrain the server | EVID-014, F-001 to F-003 | Specs must fix the returned instant format and the span invariant |
| RQ-002 | What form do the calendar's period boundaries take on the wire? | A parser mismatch presents as an empty calendar, not an error | Answered: ISO strings carrying the browser's **numeric offset** whenever the local offset is non-zero | EVID-015, EVID-016, F-004, F-005 | Specs must accept offset-bearing instants; verification must cover it |
| RQ-003 | What exists on the server today and what must be preserved? | Determines the true delta | Answered: health route, URL-echoing 404, leaking error handler; nothing else | EVID-001 | Specs must preserve health and redefine 404 / error behavior |
| RQ-004 | Are the dependencies a validation layer needs actually declared? | A phantom dependency builds locally and fails on a clean install | Answered: `zod@4.4.3` and `mongodb-memory-server@11.2.0` are linked into `server/node_modules` but absent from `server/package.json` and the lockfile | EVID-004, EVID-005 | Dependency addition must go through pnpm with the lockfile committed |
| RQ-005 | Which existing changes cover this surface, and do they conflict? | Duplicate contracts drift | Answered: `add-events-api` covers it exactly; `add-events-page` covers it with different field names; neither has started | EVID-008 to EVID-010, F-010 | D-001 must be resolved before specs are written |
| RQ-006 | Which invariants can storage enforce, and does the ORM enforce them on every write path? | An invariant enforced on one path only is not enforced | Answered: MongoDB enforces none here; Mongoose `validate` is document middleware and update validators default to off | EVID-017, EVID-018, F-008 | Design must pick a write path that actually triggers the check |
| RQ-007 | What is the actual runtime state of the database? | Pre-existing documents under other field names would render wrong | **Unknown** — reading the Atlas credential is denied by project settings and was not authorized | U-001, EVID-022 | Proposal must not assert "empty collections" as fact |
| RQ-008 | What do the directory endpoints need to serve the selectors? | Determines filters and payload | Answered from the PRD: search by name, no duplicate assignment, host candidates are *eligible* employees | `docs/prd/release 1.0.0/eventsPage.md:293-320, 346-376` | Specs must define search, ordering, bounding, eligibility |
| RQ-009 | Does Express 5 forward async handler failures to the error middleware without a wrapper? | Determines whether every controller needs try/catch | Answered: yes — the router forwards a rejected returned promise to `next(err)` | EVID-019 | No async-wrapper dependency is needed |
| RQ-010 | What security posture applies? | These endpoints will write to a hosted cluster | Answered: no auth exists anywhere in tracked source; roles are out of PRD scope | EVID-001, R-002 | Proposal must record the exposure explicitly |

## Evidence reviewed

| ID | Source | Evidence type | What it establishes |
| --- | --- | --- | --- |
| EVID-001 | `server/src/app.ts:16-39` | Source | Only `/api/health` (`:16-18`); the 404 echoes `req.originalUrl` (`:20-25`); the error handler returns `error.message` (`:31`) and a stack trace outside production (`:37`); no router, validation, or envelope |
| EVID-002 | `server/src/server.ts:8-27`, `server/src/main.ts:1-3` | Source | Startup order `main → server → app`; Mongo connect precedes `listen`; SIGINT/SIGTERM close then disconnect |
| EVID-003 | `server/src/shared/config/env.ts:5-23`, `server/src/shared/infra/mongoose/client.ts:12-20` | Source | `DB_HOST` is required and throws at startup; `CORS_ORIGIN` defaults to `http://localhost:5173`; one Mongoose connection, no schemas |
| EVID-004 | `server/package.json:9-27` | Manifest | Scripts are `dev`, `build`, `start` only — no test script; dependencies are cors, dotenv, express, helmet, mongoose, morgan; **no `zod`** |
| EVID-005 | `pnpm-lock.yaml:83-116` (`server` importer) vs `server/node_modules/zod` → `zod@4.4.3`, `server/node_modules/mongodb-memory-server` → `11.2.0` (symlinks dated Aug 5) | Command output | Both packages are linked into the package but declared in neither the manifest nor the lockfile — phantom dependencies from a reverted install |
| EVID-006 | `server/AGENTS.md:12,15,20,22,25,27,34`; `server/CLAUDE.md:5,13,18,20,21,23` | Instructions | `.ts` extensions on relative imports; feature code in `src/modules/<feature>/` (model, routes, service) mounted under `/api`; env read only in `env.ts`; Zod at the boundary; routers above the 404; `contacts`/`employees` are the people collections, `users` is authentication only; `pnpm --filter server build` is the gate |
| EVID-007 | `AGENTS.md:24-25,37`; `server/tsconfig.json:7-17`; `package.json:5-8` | Instructions/config | pnpm-only installs from the root with the lockfile committed; no repo lint or test script today; `allowImportingTsExtensions` + `rewriteRelativeImportExtensions`, `strict`, `noUnusedLocals`, `noUnusedParameters`; Node ≥ 24.18, pnpm 11.18.0 |
| EVID-008 | `openspec/changes/add-events-api/` (`proposal.md`, `design.md`, `specs/{api-foundation,event-api,directory-api}/spec.md`, `tasks.md`; `.openspec.yaml` = `spec-driven`, created 2026-08-07) | Project doc | A complete, tracked change for exactly this request — 74 checkbox tasks, 0 checked |
| EVID-009 | `openspec/changes/add-events-page/design.md:8-12`, `tasks.md:4-52`; `.openspec.yaml` created 2026-08-05 | Project doc | A tracked full-stack change specifying the same server endpoints under `name`/`startsAt`/`endsAt`; 63 tasks, 0 checked; asserts the four collections are empty on a shared Atlas cluster |
| EVID-010 | `specs/add-events-api/report/research-report.md`, `plan/implementation-plan.md`, `tasks/tasks.md` (3,435 lines, tracked at `313e41d`) | Project doc | A third, non-OpenSpec research/plan/tasks set for the same request |
| EVID-011 | `git show --stat bce2dbf` | Command output | The commit claiming to "implement the Events page" contains only the seven `openspec/changes/add-events-page/*` files — no application source was ever committed |
| EVID-012 | `git show --stat 6497b1f 05ea020`; `git status --porcelain` → `?? openspec/changes/add-events-server-api/` | Command output | A prior `research.md` for this change (219 lines) was added then deleted as "outdated"; the change directory is currently untracked and holds only `.openspec.yaml` |
| EVID-013 | `server/dist/modules/**`, `server/dist/shared/**` (untracked; `.gitignore:2` ignores `dist`) | Build output | A prior local attempt: `name`/`startsAt`/`endsAt`, no `status`/`position`/`department`/`canHostEvents`, `z.iso.datetime()` **without** an offset option, `{ error: { code, message } }` envelope, `startsAt < to && endsAt > from` overlap query, dedupe setters, `pre('validate')` span check |
| EVID-014 | `client/node_modules/@fullcalendar/core/internal-common.js:3162-3175, 3200-3202, 3223, 3233-3246, 3253-3260, 3269-3281`, `:1491-1493` | External source (installed 6.1.21) | Event refiners and `parseSingle`; leftover keys → `extendedProps`; unresolvable `start` → event dropped; `allDay` inferred from whether both instants specify a time; `endMarker <= startMarker` → end nulled and replaced by `defaultTimedEventDuration` (`01:00:00`) |
| EVID-015 | `client/node_modules/@fullcalendar/core/index.js:960-969`; `internal-common.js:821-837, 853-862, 4575-4576` | External source | A JSON feed sends `start`/`end` via `dateEnv.formatIso`, which replaces `Z` with `+HH:MM` whenever the local offset is non-zero; `timeZone` is sent only when the calendar zone is not `local`; `fetchInfo.startStr`/`endStr` use the same formatter |
| EVID-016 | `node_modules/.pnpm/zod@4.4.3/node_modules/zod/v4/core/regexes.js:82-92` | External source | `datetime()` accepts only a `Z` designator by default; `{ offset: true }` adds `[+-]HH:MM` |
| EVID-017 | `node_modules/.pnpm/mongoose@9.9.1/.../lib/query.js:3614, 3852, 4235` (via `server/node_modules/mongoose`) | External source | `runValidators` defaults to `false` on query update operations |
| EVID-018 | https://mongoosejs.com/docs/middleware.html (accessed 2026-08-09) | External doc | `validate` is document middleware by default; it does not fire on `findOneAndUpdate()`/`updateOne()` unless registered with `{ query: true }` |
| EVID-019 | `node_modules/.pnpm/router@2.2.0/node_modules/router/index.js:650-657` (Express 5.2.1's router) | External source | A handler returning a rejected promise has its error forwarded to `next(error)` |
| EVID-020 | `client/package.json:11-24`; `client/src/App.tsx`, `client/src/app/router.tsx`, `client/src/app/query-client.ts` | Manifest/source | FullCalendar 6.1.21 (core, react, daygrid, timegrid, interaction), TanStack Query, axios, react-hook-form, zod 4.4.3 are installed; the app renders a placeholder heading on one route and calls no API |
| EVID-021 | `openspec/config.yaml`; `openspec/specs/` (empty) | Project config | Schema is `research-driven`; artifact rules require proposal to resolve every Decision needed and specs to cover every handoff behavior; there is **no** capability baseline to modify |
| EVID-022 | `.claude/settings.json` (`deny: Read(/**/.env)`) | Project config | The Atlas credential in `server/.env` is not readable, so runtime database state cannot be established here |

## Current system and relevant flows

There is no request flow to trace beyond middleware today. `main.ts` awaits `runServer()`, which connects Mongoose from `DB_HOST` before binding the port and registers SIGINT/SIGTERM handlers that close the server then disconnect (EVID-002, EVID-003). `createApp()` applies `helmet`, `cors` scoped to `CORS_ORIGIN`, `morgan`, and body parsers, then registers `GET /api/health`, a catch-all 404, and an inline error handler (EVID-001).

Two properties of that terminal pair matter for the requested change. The 404 reflects `req.originalUrl` into the response body, and the error handler returns the raw `error.message` in every environment plus `error.stack` outside production — the opposite of the PRD's requirement that user-facing errors avoid technical detail (`docs/prd/release 1.0.0/eventsPage.md:512-529`). Any new routers must mount above both (EVID-006).

The consumer side is empty: the client renders a placeholder and has no API layer (EVID-020). The only *de facto* prior implementation is untracked build output under `server/dist/` (EVID-013), which is gitignored and will disappear on the next clean build. It is evidence of intended shape, not code in the system.

## Findings

### Contracts and observable behavior

- **F-001 [Verified]** FullCalendar requires only a resolvable `start`; an event whose start does not parse is dropped from the calendar without any signal (EVID-014, `:3243-3246`). `title`, `end`, `allDay`, `extendedProps` are optional.
- **F-002 [Verified]** An `end` that is not strictly after `start` is discarded and replaced by `defaultTimedEventDuration` (`01:00:00`) (EVID-014, `:3266-3281`, `:1491-1493`). An inverted or zero-length span therefore renders as a plausible but wrong one-hour block instead of failing. This is the argument for enforcing the span invariant server-side on every write path.
- **F-003 [Verified]** Any unrecognized top-level key on an event object is absorbed into `extendedProps` (EVID-014, `:3200-3202`, `:3223`). A misspelled field never errors; it renders an untitled event. A server that emits FullCalendar's own shape has no failure signal for a typo.
- **F-004 [Verified]** `allDay` is inferred from whether both instants specify a time (EVID-014, `:3253-3260`). A full ISO instant resolves it to `false`; a date-only string flips the event into the all-day row. Returned instants must always carry a time component and a zone designator.
- **F-005 [Verified]** FullCalendar formats outbound range parameters with `formatIso`, which substitutes `+HH:MM` for `Z` whenever the local offset is non-zero (EVID-015). Zod 4.4.3's ISO datetime accepts only `Z` unless `{ offset: true }` is passed (EVID-016). The prior local attempt used the default form (EVID-013), so it would have rejected every calendar request from a non-UTC browser. Symptom: an empty calendar, not a visible validation failure.
- **F-006 [Inference, from F-001 to F-004]** The supplied `events` sketch is compatible with the calendar as written; the user's stated worry that the schema "can be not relevant" does not materialize. `title` maps verbatim, `startAt`/`endAt` map to `start`/`end`, and participants belong under `extendedProps` when mapped. Nothing in the sketch must be renamed for FullCalendar's sake.
- **F-007 [Verified]** `end` is treated as an exclusive boundary by FullCalendar's range model; for a *timed* event the exclusive end and the real end instant are the same value, so the classic off-by-one-day adjustment applies only to all-day events (EVID-014 range construction; all-day events are out of scope per the PRD §18 deferral).
- **F-008 [Verified]** Express 5.2.1 forwards rejected promises from handlers to the error middleware (EVID-019), so async controllers need no wrapper library and no per-handler try/catch to reach a centralized envelope.

### Data and invariants

- **F-009 [Verified]** MongoDB enforces none of the required invariants here, and Mongoose will not compensate automatically: `validate` is document middleware that does not fire on `findOneAndUpdate`/`updateOne` (EVID-018), and `runValidators` defaults to `false` on query updates (EVID-017). An invariant expressed only as a `pre('validate')` hook is enforced on `document.save()` and bypassed by a query update.
- **F-010 [Verified]** Field naming is already contested inside the repository: `add-events-page` specifies `name`/`startsAt`/`endsAt` (EVID-009) while `add-events-api` and this request specify `title`/`startAt`/`endAt` (EVID-008). The prior local build used the former (EVID-013). Two tracked changes currently disagree about the same wire contract.
- **F-011 [Verified]** The supplied sketch adds fields no prior artifact implemented: `status` on contacts, and `position`, `department`, `canHostEvents`, `status` on employees (EVID-013 shows the prior person schema carried only `firstName`, `lastName`, `email`). `canHostEvents` is the only field that expresses the PRD's "eligible hosts" notion (`docs/prd/release 1.0.0/eventsPage.md:346-376`).
- **F-012 [Verified]** `createdByUserId` / `updatedByUserId` reference a `users` collection that project instructions reserve for authentication and forbid attaching domain data to (EVID-006). No authentication exists anywhere in tracked source (EVID-001), so no trustworthy value can be produced for these fields today.
- **F-013 [Assumption]** The calendar's only read pattern is period overlap (`startAt < to AND endAt > from`), as implemented by the prior attempt (EVID-013) and specified by both existing changes. It follows from FullCalendar's fetch model but no running consumer confirms it.
- **F-014 [Unknown]** Whether `contacts`, `employees`, `events`, and `users` exist and are empty. Both existing designs assert it (EVID-009); the credential needed to check is denied by project settings (EVID-022, U-001).

### Project patterns and constraints

- **F-015 [Verified]** Conventions that later artifacts must not break: relative imports carry `.ts`; feature code lives in `src/modules/<feature>/`; routers mount under `/api` above the catch-all 404 and error handler; `process.env` is read only in `env.ts`; Zod validates at the boundary; `contacts`/`employees` hold people and `users` is left alone (EVID-006).
- **F-016 [Verified]** `server/CLAUDE.md:13` describes a module as *model, routes, service*. The request explicitly asks for "controllers", so a `<feature>.controller.ts` split is an addition to the documented convention rather than a departure from it — `add-events-api` already made that call (EVID-008, `design.md:99-114`), while the third artifact set did not (EVID-010).
- **F-017 [Verified]** TypeScript runs natively on Node 24 with `strict`, `noUnusedLocals`, `noUnusedParameters` (EVID-007). Only erasable TypeScript is usable, so `enum` is not available for `status` / eligibility unions.
- **F-018 [Verified]** `pnpm --filter server build` is the only verification gate that exists; there is no test script in either package and root instructions forbid claiming tests passed until one is added and run (EVID-004, EVID-007).
- **F-019 [Verified]** Dependency state is drifted: `zod` and `mongodb-memory-server` resolve at runtime today but vanish on a clean install (EVID-005). Any artifact that assumes `zod` is available is relying on a local accident.
- **F-020 [Verified]** `openspec/specs/` is empty (EVID-021), so every capability this change touches is new; there is nothing to modify and no archived baseline to reconcile against.

### External contracts

Versions resolved from the workspace: `@fullcalendar/*` 6.1.21 (client), `zod` 4.4.3 (client dependency; only phantom-linked in server), `mongoose` 9.9.1, `express` 5.2.1 with `router` 2.2.0. The FullCalendar and Zod findings above (F-001 to F-005, EVID-014 to EVID-016) were read from the installed packages rather than documentation, so they describe the exact versions this workspace resolves. The Mongoose middleware classification (EVID-018) is from the official documentation, accessed 2026-08-09.

## Options and research-informed direction

| Direction | Evidence-supported benefits | Costs and risks | Reversibility |
| --- | --- | --- | --- |
| A. Treat this change as the single server change and explicitly retire/supersede `add-events-api` and the server half of `add-events-page` | Removes the contradiction in F-010; one contract survives; the supplied field sketch (F-011) is honored in one place | Requires an explicit editorial decision about two tracked changes; loses nothing technical since neither has started (EVID-008, EVID-009) | High — all three sets are documents; no code exists yet |
| B. Write a fourth parallel description and leave the others in place | No editorial work now | Four descriptions of one API; the `name` vs `title` split (F-010) stays live and whoever implements from the wrong document ships a broken contract | Low in practice — divergence compounds once code lands |
| C. Abandon this change and implement `add-events-api` as written | Its design already resolves F-001 to F-005, F-009, F-016 | It predates the supplied sketch's `status`/`position`/`department`/`canHostEvents` emphasis only partially, and the user asked for this change | High |
| D. Emit FullCalendar's native event shape from the API | Client can pass the array straight to the `events` prop | F-003 makes a server-side typo silently render an untitled event; a rendering library's vocabulary becomes the permanent API contract | Low once a client depends on it |
| E. Return a domain shape (`id`, `title`, `startAt`, `endAt`, `attendees[]`, `hosts[]`) and map on the client | Keeps the library out of the contract; a mapping mistake is a compile-time/local failure, not a silent render (F-003) | One small mapping function on the client | High |

### Recommended direction

Pursue **A + E**, bounded as follows.

Treat this change as the *reconciling* server change rather than a fourth description, and make the supersession explicit in the proposal (D-001 is still a decision the proposal owns, not one research can settle). Keep the wire contract domain-shaped and let the client map to FullCalendar, because F-003 turns a FullCalendar-shaped payload into a contract with no failure signal.

Boundaries the evidence supports:

- The calendar read is period-bounded; the supplied sketch survives verification unchanged (F-006), so `title`/`startAt`/`endAt` are adopted and the `name`/`startsAt`/`endsAt` naming in `add-events-page` is the one that gives way (F-010).
- Instants crossing the boundary must accept a numeric offset, not only `Z` (F-005), and instants returned must always be time-bearing and zone-explicit (F-004).
- The span invariant must hold on whichever write path is chosen, given that document validation does not run on query updates (F-009) and FullCalendar hides an inverted span (F-002).
- Directory reads must be bounded and searchable, and host eligibility must be enforced on write and not merely filtered on read, or `canHostEvents` is decoration (F-011).
- Audit fields (F-012) cannot be filled truthfully today; whether to declare them now or defer them is D-004.

## Risks and edge cases

| ID | Risk or edge case | Evidence | Likelihood | Impact | Constraint for later artifacts |
| --- | --- | --- | --- | --- | --- |
| R-001 | Offset-bearing range parameters rejected by a `Z`-only parser; the calendar renders empty with no error | F-005, EVID-013, EVID-015, EVID-016 | High if unaddressed — the prior attempt already had this bug | High | Specs must require acceptance of offset-bearing instants; verification must include the non-UTC case |
| R-002 | Unauthenticated read and write endpoints against a hosted cluster shared with unrelated databases | EVID-001, EVID-009 (`design.md:8-12`) | Certain — roles are out of PRD scope | High | Proposal must record the exposure as known debt and constrain deployment |
| R-003 | A fourth contradictory description of the same API; the `name` vs `title` split ships to whoever reads the wrong document | F-010, EVID-008, EVID-009 | High without D-001 | High | D-001 must be resolved before specs are written |
| R-004 | An inverted or zero-length span persists and renders as a wrong one-hour block | F-002, F-009 | Medium | Medium | Specs must state the invariant as observable behavior, not as an implementation hook |
| R-005 | Invariant enforced only in a document hook while a write path uses a query update | F-009, EVID-017, EVID-018 | Medium | High | Design must state which write path is used and why the check fires there |
| R-006 | `zod` disappears on a clean install because it is undeclared | F-019, EVID-005 | High | Medium | The dependency must be added through pnpm with the lockfile committed (EVID-007) |
| R-007 | Pre-existing documents under different field names, or a non-empty collection, invalidate the "no migration needed" premise | F-014, U-001 | Unknown | High if realized | Proposal must not assert emptiness; the check must happen before writes |
| R-008 | Unbounded reads: a directory with no cap, or an events read with no required period | F-013, EVID-013 (`limit` optional, default 50) | Medium | Medium | Specs must require a bounded calendar period and a bounded directory result set |
| R-009 | Search term used directly as a pattern — incorrect matches and catastrophic backtracking | EVID-013 escapes it; nothing enforces that in tracked source | Medium | Medium | Specs must require the term to be treated as literal text and length-bounded |
| R-010 | Dangling participant references after a person is deleted make a whole calendar period unreadable | F-009 (no referential integrity), EVID-013 (drops unresolved on read) | Low now (no delete path exists) | Medium | Specs must define read behavior for an unresolvable reference |
| R-011 | Error responses leak `error.message` and stack traces, contradicting the PRD's error-handling rule | EVID-001, `docs/prd/release 1.0.0/eventsPage.md:512-529` | Certain until the handler is replaced | Medium | Specs must define the envelope and the no-internal-detail rule; the 404 must stop echoing the URL |
| R-012 | Time-zone policy is an open product decision; storing instants is correct for "this moment" and wrong for "4pm wherever I am" | PRD §18, F-004 | Medium | Medium | Specs must state the storage semantics explicitly so the ruling can be applied later |
| R-013 | Duplicate submission of a create while the dialog is in its loading state produces two events | PRD §15 (`:499-508`) describes client-side prevention only | Low | Low-medium | Idempotency is not solved by the PRD; specs should state whether the server tolerates it |

## Unknowns, assumptions, and decisions needed

| ID | Type | Item | Impact if wrong | How to resolve |
| --- | --- | --- | --- | --- |
| U-001 | Unknown | Whether the four collections exist, are empty, and carry no indexes or validators | A rename or first-write assumption could corrupt or shadow real data (R-007) | The user (or someone authorized to use `server/.env`) inspects the cluster and reports collection names, counts, and a sample document |
| U-002 | Unknown | Whether any environment other than local development points at this API | R-002's blast radius | Ask the user; nothing in tracked source describes a deployment |
| A-001 | Assumption | The calendar's only read pattern is period overlap (F-013) | An extra read shape would be needed later; additive, not breaking | Confirm when the client feature is built |
| A-002 | Assumption | `status` on contacts/employees means active/inactive lifecycle, and inactive people should not be offered as new participants | Over-restrictive writes; a rejected assignment | The user confirms the intended status values and their effect |
| D-001 | Decision needed | The relationship between this change and `add-events-api` (and the server half of `add-events-page`): supersede, merge, or coexist | R-003; four contradictory contracts | Proposal must state it explicitly; `openspec/config.yaml` already requires decisions to be resolved there (EVID-021) |
| D-002 | Decision needed | Whether `PATCH` semantics are partial or whole-object, given that participant edits persist only on save (`docs/prd/release 1.0.0/eventsPage.md:334-343, 378-385`) | A partial update that omits participants either clears or preserves them — opposite outcomes | Product choice; specs must state which |
| D-003 | Decision needed | Whether host eligibility (`canHostEvents`) and person `status` are enforced on write or only filtered on read | A "can host" flag that only filters a dropdown is unenforced (F-011) | Product/engineering choice; the PRD says "eligible" but not what enforcement means |
| D-004 | Decision needed | Whether `createdByUserId` / `updatedByUserId` are declared now and always null, accepted from the client, or deferred until authentication exists | Accepting them from a request creates a forgeable audit trail (F-012) | Proposal must choose; instructions forbid attaching domain data to `users` (EVID-006) |
| D-005 | Decision needed | Whether the change introduces a test runner, given no test script exists and root instructions forbid claiming untested work passed (F-018) | Verification claims that cannot be substantiated | Proposal/design choice; the build gate stays either way |

## Handoff to OpenSpec

<!-- Reference finding/risk/decision IDs rather than restating their content. -->

### Facts later artifacts may rely on

F-001 to F-008 (FullCalendar 6.1.21 and Express 5 behavior, version-pinned via EVID-014, EVID-015, EVID-019); F-009 (Mongoose enforcement paths); F-015 to F-020 (project conventions, toolchain limits, dependency and baseline state). EVID-001 is the exact current server surface the change starts from.

### Constraints later artifacts must preserve

F-015 (module layout, mounting order, env boundary, `users` untouched); F-017 (erasable TypeScript only); F-018 and F-019 (verification gate and pnpm dependency handling); R-002 (deployment constraint); R-011 (existing behavior that must change rather than be extended).

### Decisions proposal/design must resolve

D-001 (blocking, and it gates whether specs are written at all in this change), D-002, D-003, D-004, D-005. A-002 must be confirmed or carried forward as a labeled assumption rather than silently promoted.

### Behaviors specs must define precisely

The period-bounded calendar read and its boundary semantics (F-013, R-008); instant format on the way in and out (F-004, F-005, R-001); the span invariant as observable behavior (F-002, R-004); participant assignment semantics under update (D-002); eligibility and status enforcement (D-003, F-011); unresolvable-reference read behavior (R-010); directory search, ordering, and bounding (R-008, R-009); the error envelope and the no-internal-detail rule including the 404 (R-011).

### Verification concerns tasks must eventually cover

R-001 (non-UTC range parameters), R-004 and R-005 (invariant holds on the actual write path), R-006 (clean-install dependency resolution), R-007 (database state confirmed before first write), R-009 (literal-text search), R-011 (no stack trace, no echoed URL, no driver text). F-018 constrains what may be claimed about any of these until a test script exists and is run.

## Not investigated

- **Client implementation of the Events page.** Explicitly out of the request's scope; the FullCalendar mapping is recorded as a fact (F-006) rather than designed here.
- **The full text of the three overlapping artifact sets.** Their headings, task states, and the specific claims cited above were read (EVID-008 to EVID-010); their scenario bodies were not exhaustively compared, because D-001 must settle their status before any line-by-line reconciliation is meaningful.
- **Runtime database contents and Atlas cluster configuration.** Blocked by EVID-022 and by the rule against using credentials without explicit authorization; recorded as U-001 with a resolution path rather than guessed.
- **Authentication, roles, and the `users` collection.** Out of PRD scope (`:30-38`) and forbidden as a domain surface by EVID-006.
- **Root-level dependency hygiene** (`@mui/x-date-pickers` and `zustand` declared in the root manifest) and client build tooling. Neither affects the server contract; both are safe to leave to a client-side change.
- **Performance profiling and index strategy beyond query shape.** Volumes are zero or unknown (U-001); the shape-level concerns are captured in R-008.
