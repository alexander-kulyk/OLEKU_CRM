# Implementation Tasks: Server-side Events API (events, contacts, employees)

Derived from `../report/research-report.md` and `../plan/implementation-plan.md`. Read both
before starting. Task numbering is stable; stage numbering matches the plan.

## Estimation basis

**Unit.** Ranges are **focused implementation hours** — time spent writing, running and
fixing code — not calendar duration. They exclude code review, PR turnaround, meetings,
context switching, and waiting on the open decisions listed at the end of the research
report.

**Assumptions behind the estimates.**

- One implementer already familiar with TypeScript, Express and Mongoose, but **new to this
  repository**; time to read the two package instruction files and the OpenSpec design is
  folded into Stage 0 and Stage 1.
- The repository state matches what the research verified: `server/src` has no modules, and
  `server/dist/` holds untracked reference output that is read but never copied.
- Stage 0 confirms the collections are empty. **If it does not**, a migration or discard
  decision is required and every estimate below shifts — see *Main uncertainty* in the
  summary table.
- `pnpm install` and the `mongodb-memory-server` binary download both succeed. A cached
  binary appears to exist under `server/node_modules/.cache`, but a clean machine will
  download it.
- Tests are written with `node --test` and the in-memory harness from TASK-003. Writing a
  named integration test against an existing harness is estimated at roughly 10–20 minutes
  each, including the fixture setup it needs.
- No authentication, no client work, no CI configuration.

**Exclusions.** Client implementation, authentication, deployment, linting/formatting setup,
performance benchmarking, and any migration of pre-existing documents.

**Confidence.** Medium-high overall. The architecture is prescribed by committed project
instructions and a committed design document, and the third-party contracts (FullCalendar
6.1.21, Express 5.2.1, Mongoose 9.9.1, Zod 4.4.3) were verified against installed versions
rather than assumed. The residual uncertainty is environmental, not architectural.

**Factors that could change the estimates.**

- Pre-existing documents in `events` under the superseded `name`/`startsAt`/`endsAt` names
  (+4–8 h for a migration or discard decision, plus a new stage).
- `mongodb-memory-server` failing to obtain its binary (+2–6 h to find an alternative test
  strategy, or the whole test scope is renegotiated).
- Mongoose 9's stricter TypeScript surface (no generic parameter on `create()`, query-filter
  properties no longer resolving to `any`) producing more friction than expected (+2–4 h
  across TASK-008, TASK-012, TASK-015).
- Any of the open decisions being settled differently — particularly write-time
  `canHostEvents` enforcement (+1–2 h) or omitting `email` from directory responses
  (+0.5–1 h).

## Estimate summary

| Scope | Effort range | Confidence | Main uncertainty |
| --- | --- | --- | --- |
| Stage 0 — Ground truth | 0.5–1 h | High | Whether the collections are actually empty; a non-empty `events` blocks the plan |
| Stage 1 — Dependencies and test harness | 2–4 h | Medium | `mongodb-memory-server` binary acquisition and the Mongoose 9 connection lifecycle in tests |
| Stage 2 — Shared HTTP foundation | 7–11 h | High | How many error classes the middleware must special-case |
| Stage 3 — Directory module | 9–16 h | Medium-high | The `email` unique-partial-index decision and query-coercion friction under Express 5's simple parser |
| Stage 4 — Event model and schemas | 7.5–12 h | Medium-high | Choosing a Mongoose validator that yields a 400 rather than a 500 |
| Stage 5 — Event calendar read API | 8–13 h | Medium | Batched participant resolution plus the six boundary cases and the offset regression test |
| Stage 6 — Event write API | 13–21 h | Medium | Breadth of the failure-path test matrix, not implementation difficulty |
| Stage 7 — Seed script | 2–3.5 h | High | Nothing material |
| Stage 8 — Contract and OpenSpec reconciliation | 5–8 h | Medium | How much of `design.md` needs rewriting versus annotating |
| Stage 9 — Final verification | 3–5 h | Medium-high | Number of defects found during the manual walkthrough |
| **Overall — one implementer, sequential** | **57–95 h (≈ 7–12 focused days)** | Medium-high | Stage 0's outcome; the test-matrix breadth in Stages 5 and 6 |
| **Overall — two implementers, adjusted for the safe parallel groups** | **≈ 35–55 h of critical-path time** | Medium | Coordination on the two shared files, `server/src/app.ts` and `event.routes.ts` |

Totals are the sum of the task ranges below; no shared work is double-counted (the test
harness is built once in TASK-003 and reused by every later test task).

## Task summary

| ID | Title | Stage | Depends on | Estimate | Parallelizable |
| --- | --- | --- | --- | --- | --- |
| TASK-001 | Verify live collection state read-only and record the go/stop decision | 0 | — | 0.5–1 h | No (blocks everything) |
| TASK-002 | Declare `zod` and `mongodb-memory-server` and add the `test` and `seed` scripts | 1 | TASK-001 | 0.5–1 h | No (blocks everything) |
| TASK-003 | Build and prove the in-memory MongoDB test harness | 1 | TASK-002 | 1.5–3 h | Yes — with TASK-004, TASK-008, TASK-013 |
| TASK-004 | Create the error envelope and the Zod validate helper | 2 | TASK-002 | 2–3 h | Yes — with TASK-003, TASK-008, TASK-013 |
| TASK-005 | Create the centralized error middleware | 2 | TASK-004 | 2–3 h | Yes — with Stage 3/4 model work |
| TASK-006 | Wire `createApp()` to the middleware, envelope the 404, add the router mount point | 2 | TASK-005 | 1–2 h | No (shared file `app.ts`) |
| TASK-007 | Test the HTTP foundation: health, 404, envelope, Mongoose error mapping | 2 | TASK-003, TASK-006 | 2–3 h | Yes — with Stage 3/4 work |
| TASK-008 | Build the person schema factory and the Contact and Employee models | 3 | TASK-002 | 2–4 h | Yes — with TASK-003, TASK-004, TASK-013 |
| TASK-009 | Build the person summary mapper, directory query schemas and directory service | 3 | TASK-008, TASK-004 | 3–5 h | Yes — with Stage 4 work |
| TASK-010 | Add the directory routes and mount them under `/api` | 3 | TASK-009, TASK-006 | 1–2 h | No (shared file `app.ts`) |
| TASK-011 | Test the directory endpoints: search, sort, cap, status and host filters | 3 | TASK-010, TASK-003 | 3–5 h | Yes — with Stage 4/5 work |
| TASK-012 | Build the Event model with its invariants and range index | 4 | TASK-002 | 2.5–4 h | Yes — with TASK-013 and Stage 3 work |
| TASK-013 | Build the event request schemas with offset-tolerant ISO parsing | 4 | TASK-002, TASK-004 | 2.5–4 h | Yes — with TASK-012 and Stage 3 work |
| TASK-014 | Unit-test the Event model invariants and the request schemas | 4 | TASK-012, TASK-013, TASK-003 | 2.5–4 h | Yes — with Stage 3 work |
| TASK-015 | Implement `listEvents` with batched participant resolution and the read-shape mapper | 5 | TASK-012, TASK-008 | 3–5 h | No (critical path) |
| TASK-016 | Add `GET /api/events` and mount the events router | 5 | TASK-015, TASK-013, TASK-006 | 1–2 h | No (shared files `app.ts`, `event.routes.ts`) |
| TASK-017 | Test the range read: six boundary cases plus the UTC-offset regression | 5 | TASK-016, TASK-003 | 4–6 h | Yes — with TASK-018/019/020 |
| TASK-018 | Implement the `assertPeopleExist` guard and `createEvent` | 6 | TASK-015 | 2.5–4 h | No (critical path) |
| TASK-019 | Implement `updateEvent` with wholesale participant replacement | 6 | TASK-018 | 2–3.5 h | Yes — with TASK-020 |
| TASK-020 | Implement `deleteEvent` | 6 | TASK-015 | 1–1.5 h | Yes — with TASK-018, TASK-019 |
| TASK-021 | Add the `POST`, `PATCH /:id` and `DELETE /:id` routes | 6 | TASK-018, TASK-019, TASK-020, TASK-016 | 1.5–3 h | No (shared file `event.routes.ts`) |
| TASK-022 | Test event creation, including every rejection path | 6 | TASK-021, TASK-003 | 3–4 h | Yes — with TASK-023 |
| TASK-023 | Test event update and delete, including wholesale replacement and 404/400 paths | 6 | TASK-021, TASK-003 | 3–5 h | Yes — with TASK-022 |
| TASK-024 | Write the idempotent contacts and employees seed script | 7 | TASK-008 | 2–3.5 h | Yes — from TASK-008 onward |
| TASK-025 | Reconcile `design.md` and publish the API contract with the FullCalendar mapping | 8 | TASK-017, TASK-023 | 3–5 h | No |
| TASK-026 | Update the OpenSpec `tasks.md` statuses | 8 | TASK-025 | 1–1.5 h | Yes — with TASK-027 |
| TASK-027 | Update `README.md` with `test`, `seed` and the unauthenticated-API warning | 8 | TASK-003, TASK-024 | 1–1.5 h | Yes — from TASK-024 onward |
| TASK-028 | Run the clean-install build and test gate | 9 | all implementation tasks | 1–2 h | No |
| TASK-029 | Walk the manual end-to-end and failure paths and audit the blast radius | 9 | TASK-028, TASK-024 | 2–3 h | No |

---

## Stage 0 — Establish ground truth about the database and the collections

### TASK-001 — Verify live collection state read-only and record the go/stop decision

- **Description:** The entire plan rests on the assertion in
  `openspec/changes/add-events-page/design.md:9` that `events`, `contacts`, `employees` and
  `users` are empty with no indexes beyond `_id`. That statement predates an untracked
  implementation attempt whose seed script may have been run since. Connect read-only using
  `DB_HOST` and establish the facts before any field name is committed to code, because
  pre-existing documents under the superseded `name`/`startsAt`/`endsAt` names would render
  as untitled events or be dropped entirely by FullCalendar's parser.
- **Requirements:** Enabling for REQ-005, REQ-006, REQ-012, REQ-015.
- **Depends on:** none.
- **Deliverables:**
  - Recorded output for: the resolved database name, `countDocuments()` on all four
    collections, `getIndexes()` on all four collections, and `findOne()` field names for any
    non-empty collection.
  - A written go / stop decision, appended to the research report's *Unknowns* section or
    captured in the stage commit message.
- **Acceptance criteria:**
  - [ ] The database name that `DB_HOST` resolves to is recorded.
  - [ ] Document counts for `events`, `contacts`, `employees` and `users` are recorded.
  - [ ] The existing index list for each of the four collections is recorded.
  - [ ] For each non-empty collection, one sample document's field names are recorded.
  - [ ] An explicit "proceed" or "blocked" decision is written down, with the reason.
  - [ ] No document, collection or index was created, modified or dropped.
- **Validation:** the recorded output itself. Confirm afterwards that document counts are
  unchanged from the first reading, proving the inspection was read-only.
- **Risks / notes:** Use only `countDocuments`, `findOne` and `getIndexes`. Never call
  `create`, `insert`, `update`, `delete`, `drop` or `createIndex`. Keep any throwaway script
  **outside** the repository so it cannot be committed. Never paste any part of `DB_HOST`
  into a file, a log or a commit message — `.env` is deny-listed for reading and its
  contents must not leak. **If `events` holds documents using `name`/`startsAt`/`endsAt`,
  stop and raise it** rather than proceeding on assumption; that outcome adds a migration
  stage before TASK-012.
- **Estimate:** 0.5–1 hour
- **Estimate confidence:** High — four read-only queries against an existing connection
  helper, plus writing down the result.

---

## Stage 1 — Add dependencies, scripts, and a proven test harness

### TASK-002 — Declare `zod` and `mongodb-memory-server` and add the `test` and `seed` scripts

- **Description:** `server/AGENTS.md:22` mandates Zod at the HTTP boundary, but `zod` is not
  in `server/package.json` and not in the lockfile's `server` importer. Orphan symlinks to
  `zod@4.4.3` and `mongodb-memory-server@11.2.0` **do** exist under `server/node_modules/`
  from an earlier install, so an implementation that imports them will appear to work locally
  and break on a fresh checkout. Declare both properly and add the scripts the later stages
  need.
- **Requirements:** REQ-028, REQ-029; enabling for REQ-001.
- **Depends on:** TASK-001 (go decision).
- **Deliverables:**
  - `zod` in `server/package.json` `dependencies`; `mongodb-memory-server` in
    `devDependencies`; both reflected in the `server:` importer of `pnpm-lock.yaml`.
  - `"test"` and `"seed"` scripts in `server/package.json`; optionally a `"test:server"`
    convenience script in the root `package.json`.
  - A recorded decision on whether test files fall inside `server/tsconfig.json`'s `include`.
- **Acceptance criteria:**
  - [ ] `server/package.json` lists `zod` under `dependencies` and `mongodb-memory-server`
        under `devDependencies`.
  - [ ] The `server:` importer block in `pnpm-lock.yaml` lists both, and the lockfile change
        is staged.
  - [ ] `server/package.json` has a `test` script using `node --test` and a `seed` script.
  - [ ] `pnpm --filter server build` passes.
- **Validation:** `pnpm --filter server add zod`, `pnpm --filter server add -D
  mongodb-memory-server` (both run **from the repository root**), then inspect the `server:`
  importer in `pnpm-lock.yaml`, then `pnpm --filter server build`.
- **Risks / notes:** Do **not** hand-edit `server/package.json` or `pnpm-lock.yaml` — let
  pnpm write them (`AGENTS.md:22-25`). Do not add a test framework; Node 24 ships
  `node --test` and the committed design chose it. Do **not** remove the root
  `@mui/x-date-pickers` and `zustand` entries — that is client-side cleanup owned by the
  OpenSpec change, not by this server work. Decide the tsconfig `include` question now:
  `strict`, `noUnusedLocals` and `noUnusedParameters` are on, so any test file inside
  `include` must type-check cleanly.
- **Estimate:** 0.5–1 hour
- **Estimate confidence:** High — two install commands plus two script lines; the only
  variable is the tsconfig decision.

### TASK-003 — Build and prove the in-memory MongoDB test harness

- **Description:** Every test in this plan runs against an in-memory MongoDB instance. The
  only configured database is a **shared hosted Atlas cluster** and the suite truncates
  collections between tests, so the harness must be structurally incapable of reaching it.
  Build the harness and prove it with one trivial round trip **before** writing any real
  test — this is the de-risking spike for the binary download and the Mongoose 9 connection
  lifecycle.
- **Requirements:** REQ-028.
- **Depends on:** TASK-002.
- **Deliverables:**
  - `server/test/helpers/mongo.ts` — starts a `MongoMemoryServer`, takes `getUri()`,
    connects Mongoose, exposes `clearCollections()` and `stop()`, and **asserts internally**
    that the resolved connection host is the in-memory instance.
  - `server/test/harness.test.ts` — starts the harness, writes and reads a document through
    an ad-hoc model, clears, tears down.
  - Test file layout and naming convention settled for the rest of the plan.
- **Acceptance criteria:**
  - [ ] `pnpm --filter server test` runs the harness test and it passes.
  - [ ] The harness contains no reference to `DB_HOST` and does not import
        `shared/config/env.ts`.
  - [ ] The harness throws if the resolved connection host is not the in-memory instance.
  - [ ] `clearCollections()` empties every collection between tests.
  - [ ] Teardown disconnects Mongoose and stops the in-memory server, and the test process
        exits cleanly with no open handles.
  - [ ] `pnpm --filter server build` passes.
- **Validation:** `pnpm --filter server test`; then `grep -rn "DB_HOST" server/test/` returns
  nothing; then `grep -rn "shared/config/env" server/test/` returns nothing.
- **Risks / notes:** **This is the single highest-consequence file in the change** — a future
  edit that repoints it at `DB_HOST` would truncate a shared Atlas cluster. The internal host
  assertion exists to make that impossible to do quietly; do not remove it. The first run
  downloads a MongoDB binary; if that fails, raise it before writing any tests rather than
  working around it. Watch for a hanging process — Mongoose 9 and `MongoMemoryServer` both
  need explicit teardown.
- **Estimate:** 1.5–3 hours
- **Estimate confidence:** Medium — the code is short but the failure modes (binary
  download, open handles, connection lifecycle) are environmental and can consume the upper
  half of the range.

---

## Stage 2 — Shared HTTP foundation and application wiring

### TASK-004 — Create the error envelope and the Zod validate helper

- **Description:** Establish the two primitives every endpoint depends on: a typed
  application error carrying the HTTP status and a stable machine-readable code, and a helper
  that parses a request part against a Zod schema and converts a failure into that error.
  The client maps the `code` to user-facing copy (`client/CLAUDE.md:26`), so the code set is
  a contract, not an implementation detail.
- **Requirements:** REQ-001, REQ-002.
- **Depends on:** TASK-002.
- **Deliverables:**
  - `server/src/shared/http/error-envelope.ts` — `AppError extends Error` with `status`,
    `code` and `message`, plus factory helpers for at least `VALIDATION_ERROR` (400),
    `NOT_FOUND` (404), `UNKNOWN_PARTICIPANT` (400) and `INTERNAL_ERROR` (500).
  - `server/src/shared/http/validate.ts` — a generic helper that `safeParse`s and either
    returns the parsed data or throws `VALIDATION_ERROR` carrying a user-facing message
    derived from the first issue.
- **Acceptance criteria:**
  - [ ] `AppError` carries `status`, `code` and `message` as ordinary class fields — **no
        parameter properties**, which are non-erasable and break native type stripping.
  - [ ] Factories exist for all four codes above and each sets the correct status.
  - [ ] The validate helper **returns** parsed data and never assigns to `req.query`, which
        is a read-only getter in Express 5.
  - [ ] The validate helper's thrown message is user-facing and contains no Zod internals,
        no path dump and no schema description.
  - [ ] Every relative import carries the `.ts` extension.
  - [ ] `pnpm --filter server build` passes.
- **Validation:** `pnpm --filter server build`; then `pnpm dev:server` boots without a native
  type-stripping error (this catches non-erasable syntax that `tsc` alone would accept).
- **Risks / notes:** Reference `server/dist/shared/http/error-envelope.js` and `validate.js`
  for shape, but **do not copy them** — they are untracked build output. Keep the code set
  small; every code added here becomes a contract the client's error-message table must
  handle.
- **Estimate:** 2–3 hours
- **Estimate confidence:** High — two small, well-specified files with a prior reference
  implementation to compare against.

### TASK-005 — Create the centralized error middleware

- **Description:** Replace the current inline handler, which returns `error.message` and —
  outside production — `error.stack` (`server/src/app.ts:31-38`), in direct violation of
  `server/AGENTS.md:23`. The replacement is the single place that shapes every error
  response, and it must translate the error types that can actually reach it into the right
  status without leaking internals.
- **Requirements:** REQ-002, REQ-004.
- **Depends on:** TASK-004.
- **Deliverables:** `server/src/shared/http/error-middleware.ts` — an `ErrorRequestHandler`
  mapping, in order: `AppError` → `{ error: { code, message } }` at `error.status`; Mongoose
  `CastError` and `ValidationError` → 400 with a user-facing message; an error carrying a
  numeric `status`/`statusCode` in the 4xx range (body-parser's 413 on an oversized payload,
  for example) → that status with a safe generic message; everything else → 500 with a
  **fixed** generic message. The real error is logged server-side only.
- **Acceptance criteria:**
  - [ ] Every response body is exactly `{ error: { code, message } }`.
  - [ ] No response includes a `stack` key in any `NODE_ENV`.
  - [ ] No response contains a Mongoose or driver message, or any part of the connection
        string.
  - [ ] A Mongoose `CastError` produces 400, not 500.
  - [ ] A Mongoose `ValidationError` produces 400, not 500.
  - [ ] An oversized JSON body produces 413, not 500.
  - [ ] An unrecognised error produces 500 with a fixed message and is logged server-side.
  - [ ] `pnpm --filter server build` passes.
- **Validation:** `pnpm --filter server build`; behavioural proof comes from TASK-007.
- **Risks / notes:** The `ValidationError` mapping is what keeps TASK-012's model-level
  `endAt > startAt` guard from surfacing as a 500. Do not swallow the real error — log it,
  just never return it. Detect Mongoose errors by `name` or `instanceof` against the imported
  classes, not by string matching on the message.
- **Estimate:** 2–3 hours
- **Estimate confidence:** High — one file, though the branch list may grow by one or two
  cases during TASK-007.

### TASK-006 — Wire `createApp()` to the middleware, envelope the 404, add the router mount point

- **Description:** Swap the inline error handler for the imported middleware, bring the
  catch-all 404 body into the same envelope, and leave a clearly marked insertion point where
  TASK-010 and TASK-016 mount their routers. Ordering is a blocking review item
  (`server/AGENTS.md:40-41`): a router mounted below the catch-all 404 is unreachable.
- **Requirements:** REQ-002, REQ-003.
- **Depends on:** TASK-005.
- **Deliverables:** modified `server/src/app.ts` — imports and uses `errorMiddleware`; the
  404 handler returns `{ error: { code: 'NOT_FOUND', message } }`; a marked router mount
  point sits between `/api/health` and the 404 handler.
- **Acceptance criteria:**
  - [ ] The inline error handler at `app.ts:27-41` is gone and `errorMiddleware` is used.
  - [ ] The 404 handler returns the shared envelope.
  - [ ] The 404 handler and the error middleware are the **last two** `app.use` calls in
        `createApp()`.
  - [ ] `helmet`, `cors`, `morgan`, the body parsers and `/api/health` are unchanged.
  - [ ] A marked insertion point for routers exists above the 404 handler.
  - [ ] `pnpm --filter server build` passes and `pnpm dev:server` boots.
- **Validation:** `pnpm --filter server build`; start `pnpm dev:server` and confirm by hand
  that `GET /api/health` returns `{ status: 'ok' }` and an unknown route returns the
  envelope.
- **Risks / notes:** **Shared file** — TASK-010 and TASK-016 also modify `app.ts`. Sequence
  those three, do not run them in parallel. Do not add a new environment variable: `env.ts`
  is the only reader (`server/AGENTS.md:21`) and nothing here needs one.
- **Estimate:** 1–2 hours
- **Estimate confidence:** High — a small, well-bounded edit to one file.

### TASK-007 — Test the HTTP foundation: health, 404, envelope, Mongoose error mapping

- **Description:** Prove the foundation behaves before three modules are built on top of it.
  These tests are the regression net for the single most security-relevant property of the
  change: that no internal detail ever reaches a response body.
- **Requirements:** REQ-002, REQ-003, REQ-004.
- **Depends on:** TASK-003, TASK-006.
- **Deliverables:** `server/test/` integration tests covering the scenarios below, driven
  through the real app returned by `createApp()`.
- **Acceptance criteria:**
  - [ ] `GET /api/health` returns 200 and `{ status: 'ok' }`.
  - [ ] An unknown route returns 404 with `{ error: { code, message } }`.
  - [ ] A route that throws an `AppError` returns that error's status and code.
  - [ ] A route that throws a generic `Error` returns 500 with the fixed generic message and
        **no** `stack` key, asserted with `NODE_ENV` unset **and** set to `production`.
  - [ ] A route that throws a Mongoose `CastError` returns 400.
  - [ ] A route that throws a Mongoose `ValidationError` returns 400.
  - [ ] No response body in any of the above contains the substring `stack`, a driver
        message, or any part of a connection string.
  - [ ] `pnpm --filter server test` passes.
- **Validation:** `pnpm --filter server test`.
- **Risks / notes:** The throwing routes should be registered on a test-only app instance,
  not added to the production `createApp()`. Assert on the **absence** of keys, not only on
  the presence of the expected ones — that is what catches a leak.
- **Estimate:** 2–3 hours
- **Estimate confidence:** Medium-high — the scenarios are simple, but exercising both
  `NODE_ENV` values and constructing genuine Mongoose error instances takes some fiddling.

---

## Stage 3 — Directory module: person models and the contacts/employees read API

### TASK-008 — Build the person schema factory and the Contact and Employee models

- **Description:** Define the first schema for the `contacts` and `employees` collections.
  These records are inherited by the future Client Management and Employee Management
  changes, so the shape must be minimal and additive. Both share a person core; the employee
  adds `position`, `department` and `canHostEvents` from the prompt's schema sketch. Bind
  each model explicitly to its collection — automatic pluralization happens to produce the
  same names today, which is exactly why the binding must be written down.
- **Requirements:** REQ-005, REQ-006, REQ-007.
- **Depends on:** TASK-002.
- **Deliverables:**
  - `server/src/modules/directory/person.schema.ts` — `createPersonSchema(collectionName)`
    with `firstName` (required, trimmed), `lastName` (required, trimmed), `email` (optional,
    trimmed, lowercased), `status` (`'active' | 'inactive'`, default `'active'`),
    `{ timestamps: true }`, an explicit `{ collection }` binding, a `fullName` virtual with
    virtuals enabled for `toJSON`/`toObject`, and a `{ lastName: 1, firstName: 1 }` index.
  - `server/src/modules/directory/contact.model.ts` — `Contact`, bound to `contacts`.
  - `server/src/modules/directory/employee.model.ts` — `Employee`, bound to `employees`,
    adding `position` (optional), `department` (optional) and `canHostEvents` (Boolean,
    default `true`).
  - A recorded decision on the unique partial index on `email`.
- **Acceptance criteria:**
  - [ ] Both models declare their collection explicitly; neither relies on pluralization.
  - [ ] `firstName` and `lastName` are required; `email`, `position` and `department` are
        optional.
  - [ ] `status` defaults to `'active'` and accepts only the agreed values, expressed as a
        union or `const` object — **not a TypeScript `enum`**.
  - [ ] `canHostEvents` defaults to `true`.
  - [ ] `fullName` renders `"<firstName> <lastName>"` and appears in `toJSON` output.
  - [ ] The `{ lastName: 1, firstName: 1 }` index is declared.
  - [ ] A decision on the `email` unique partial index
        (`{ unique: true, partialFilterExpression: { email: { $type: 'string' } } }`) is made
        and recorded, either implemented or explicitly deferred with a reason.
  - [ ] No model, query or write references the `users` collection.
  - [ ] `pnpm --filter server build` passes.
- **Validation:** `pnpm --filter server build`; then a harness-backed test that saves one
  contact and one employee, reads them back, and asserts the collection names, the defaults
  and the `fullName` virtual.
- **Risks / notes:** Use one factory, not two hand-copied schemas — they will drift. The
  `email` index decision matters for TASK-024: without it, the upsert-by-email seed can
  create duplicates under concurrent runs. Building the index is instant against empty
  collections. Mongoose 9 has a stricter TypeScript surface than 8; expect some friction
  around inferred document types.
- **Estimate:** 2–4 hours
- **Estimate confidence:** Medium-high — mechanical, with Mongoose 9 typing as the variable.

### TASK-009 — Build the person summary mapper, directory query schemas and directory service

- **Description:** Turn the two models into a searchable, sorted, capped read. The search
  term is the only place raw user text enters a query, so it must be regex-escaped and
  length-bounded. Express 5's default query parser is "simple", so every query value arrives
  as a string and must be coerced deliberately — a naive boolean check would treat the
  string `'false'` as truthy.
- **Requirements:** REQ-008, REQ-009, REQ-010, REQ-011.
- **Depends on:** TASK-008, TASK-004.
- **Deliverables:**
  - `server/src/modules/directory/person-summary.ts` — maps a document to
    `{ id, firstName, lastName, fullName, email?, status }` with `id` as a **string**; the
    employee variant adds `position?`, `department?` and `canHostEvents`.
  - `server/src/modules/directory/directory.schemas.ts` — Zod query schemas: `search`
    (trimmed, optional, maximum length bounded), `limit` (coerced integer, positive,
    maximum 100, optional), `status` (optional), and `canHostEvents` (optional, coerced from
    `'true'`/`'false'`) for employees.
  - `server/src/modules/directory/directory.service.ts` — a shared `listPeople(model, query)`
    plus exported `listContacts` and `listEmployees`.
- **Acceptance criteria:**
  - [ ] `search` matches case-insensitively against `firstName` **or** `lastName`.
  - [ ] Regex metacharacters in `search` are escaped and matched literally.
  - [ ] `search` length is bounded by the schema.
  - [ ] Results are sorted by `{ lastName: 1, firstName: 1 }`.
  - [ ] The default result cap is 50 and `limit` above 100 is rejected by the schema rather
        than silently clamped.
  - [ ] Records whose `status` is not active are excluded unless an explicit status filter
        asks for them.
  - [ ] `canHostEvents=false` filters correctly and is not treated as truthy.
  - [ ] Every returned `id` is a string.
  - [ ] `pnpm --filter server build` passes.
- **Validation:** `pnpm --filter server build`; behavioural proof comes from TASK-011.
- **Risks / notes:** Do **not** add pagination — search plus a cap is the agreed scope. Do
  not return any field beyond those listed; `email` inclusion is an open decision flagged in
  the research report because these endpoints are unauthenticated. Reference
  `server/dist/modules/directory/directory.service.js` for the escaping approach, but do not
  copy it.
- **Estimate:** 3–5 hours
- **Estimate confidence:** Medium-high — the query-coercion details under Express 5's simple
  parser are the main source of variance.

### TASK-010 — Add the directory routes and mount them under `/api`

- **Description:** Expose the service through two thin async handlers that validate the query
  and delegate. Express 5 forwards rejected promises to the error middleware automatically,
  so no `try/catch` wrapper is needed — this is deliberate and should be noted so it is not
  mistaken for missing error handling.
- **Requirements:** REQ-003, REQ-008, REQ-009.
- **Depends on:** TASK-009, TASK-006.
- **Deliverables:**
  - `server/src/modules/directory/directory.routes.ts` — `GET /contacts` and
    `GET /employees`, each validating `req.query` through the shared helper and returning
    `{ contacts: [...] }` / `{ employees: [...] }`.
  - `server/src/app.ts` — `app.use('/api', directoryRouter)` at the marked insertion point.
- **Acceptance criteria:**
  - [ ] Both handlers validate the query through the shared helper before any database
        access.
  - [ ] Neither handler contains a `try/catch`; rejections reach the error middleware.
  - [ ] Handlers contain no business logic — they validate, delegate and respond.
  - [ ] The router is mounted **above** the catch-all 404 handler.
  - [ ] `GET /api/contacts` and `GET /api/employees` are reachable and return 200.
  - [ ] `pnpm --filter server build` passes.
- **Validation:** `pnpm --filter server build`; start `pnpm dev:server` and confirm both
  routes return 200 with an empty list against an unseeded database.
- **Risks / notes:** **Shared file** — `server/src/app.ts` is also touched by TASK-006 and
  TASK-016. Sequence them. Mounting below the 404 handler is the classic failure here and
  produces a confusing "route not found" for a route that plainly exists.
- **Estimate:** 1–2 hours
- **Estimate confidence:** High — two short handlers and one mount line.

### TASK-011 — Test the directory endpoints: search, sort, cap, status and host filters

- **Description:** Prove every filter and every shape guarantee the selectors depend on.
  These tests also lock in the security-relevant behaviour that a regex metacharacter in
  `search` is matched literally.
- **Requirements:** REQ-008, REQ-009, REQ-010, REQ-011.
- **Depends on:** TASK-010, TASK-003.
- **Deliverables:** an integration test file covering every scenario below against the
  in-memory harness through the real app.
- **Acceptance criteria:**
  - [ ] Search matches on a first name.
  - [ ] Search matches on a last name.
  - [ ] Search is case-insensitive.
  - [ ] A search value of `.*` matches only records literally containing `.*` — not
        everything.
  - [ ] A search value longer than the bound is rejected with 400.
  - [ ] Results are ordered by last name then first name.
  - [ ] The default cap of 50 is applied when more records exist.
  - [ ] `limit` above 100 returns 400 in the shared envelope.
  - [ ] A person with a non-active `status` is absent from the default response.
  - [ ] `GET /api/employees?canHostEvents=true` excludes an employee whose flag is `false`.
  - [ ] Every entry carries a string `id` and a `fullName`; employee entries additionally
        carry `position`, `department` and `canHostEvents`.
  - [ ] `pnpm --filter server test` passes.
- **Validation:** `pnpm --filter server test`.
- **Risks / notes:** Seeding more than 50 fixture people to prove the cap is slow; insert a
  batch with `insertMany` in one call. The `.*` test is the one most likely to be skipped and
  is the one that matters most — do not drop it.
- **Estimate:** 3–5 hours
- **Estimate confidence:** Medium-high — eleven named scenarios plus fixture setup.

---

## Stage 4 — Event persistence and request schemas

### TASK-012 — Build the Event model with its invariants and range index

- **Description:** Define the `events` schema using the prompt's field names — `title`,
  `startAt`, `endAt` — which supersede the committed design's `name`/`startsAt`/`endsAt` and
  are strictly closer to FullCalendar's own `title` property. MongoDB enforces neither
  referential integrity nor cross-field constraints, so the invariants this feature depends
  on must live in the schema: de-duplicating participant setters and an `endAt > startAt`
  guard that a write bypassing the route still cannot escape.
- **Requirements:** REQ-012, REQ-013, REQ-014, REQ-015, REQ-026.
- **Depends on:** TASK-002.
- **Deliverables:** `server/src/modules/events/event.model.ts` — schema bound to
  `{ collection: 'events' }` with `title` (required, trimmed), `startAt` (Date, required),
  `endAt` (Date, required), `attendeeIds` (`ObjectId[]`, `ref: 'Contact'`, default `[]`, with
  a de-duplicating setter), `hostIds` (`ObjectId[]`, `ref: 'Employee'`, same treatment),
  `createdByUserId` and `updatedByUserId` (`ObjectId`, `ref: 'User'`, default `null`),
  `{ timestamps: true }`, the `{ startAt: 1, endAt: 1 }` index, and the `endAt > startAt`
  guard.
- **Acceptance criteria:**
  - [ ] The model declares `{ collection: 'events' }` explicitly.
  - [ ] All seven domain paths plus timestamps are present with the types above.
  - [ ] Assigning `attendeeIds` or `hostIds` with a repeated identifier stores exactly one
        entry.
  - [ ] Saving a document with `endAt` equal to or earlier than `startAt` fails.
  - [ ] The failure surfaces as a Mongoose `ValidationError` (which TASK-005 maps to 400) —
        **not** a plain `Error` thrown from a hook, which would become a 500.
  - [ ] The `{ startAt: 1, endAt: 1 }` index is declared.
  - [ ] `createdByUserId` and `updatedByUserId` default to `null`.
  - [ ] No `enum`, parameter property or decorator is used.
  - [ ] `pnpm --filter server build` passes.
- **Validation:** `pnpm --filter server build`; behavioural proof comes from TASK-014.
- **Risks / notes:** Prefer a path or schema validator over `pre('validate')`. If a `pre`
  hook is used, remember that **Mongoose 9 pre-middleware no longer receives `next()`** — use
  an async function or throw. The prior build output
  (`server/dist/modules/events/event.model.js:30-34`) throws a plain `Error` from
  `pre('validate')`, which produces a 500; do not reproduce that. Do **not** add an `allDay`
  field — all-day events are a deferred product decision.
- **Estimate:** 2.5–4 hours
- **Estimate confidence:** Medium-high — the validator choice and Mongoose 9 typing are the
  variables.

### TASK-013 — Build the event request schemas with offset-tolerant ISO parsing

- **Description:** Encode every boundary rule in Zod. **The load-bearing detail:** the range
  parameters must use `z.iso.datetime({ offset: true })`, not the plain form. FullCalendar's
  `formatIso` emits the browser's numeric UTC offset (`2026-08-01T00:00:00+03:00`) for its
  rendered range, and Zod 4's default `z.iso.datetime()` **rejects** offsets. The prior build
  output made exactly this mistake, which would have rejected every calendar request from a
  browser outside UTC.
- **Requirements:** REQ-013, REQ-014, REQ-017, REQ-018, REQ-024, REQ-026.
- **Depends on:** TASK-002, TASK-004.
- **Deliverables:** `server/src/modules/events/event.schemas.ts` —
  - `objectIdString`: `z.string().regex(/^[0-9a-fA-F]{24}$/)` with a user-facing message;
  - `eventIdParamSchema`: `{ id: objectIdString }`;
  - `listEventsQuerySchema`: `from` and `to` as `z.iso.datetime({ offset: true })`
    transformed to `Date`, refined so `to > from` and so the span does not exceed 366 days;
  - `eventBodySchema`: `title` (`z.string().trim().min(1)`), `startAt` and `endAt`
    (`z.iso.datetime({ offset: true })`), `attendeeIds` and `hostIds`
    (`z.array(objectIdString).default([])` transformed to a de-duplicated array), refined so
    `endAt > startAt` reporting on the `endAt` path, and **stripping unknown keys**.
- **Acceptance criteria:**
  - [ ] `listEventsQuerySchema` accepts `2026-08-01T00:00:00Z`.
  - [ ] `listEventsQuerySchema` accepts `2026-08-01T00:00:00+03:00` and yields the correct
        UTC instant.
  - [ ] `listEventsQuerySchema` rejects a local-naive string with no zone designator.
  - [ ] `listEventsQuerySchema` rejects a missing `from` or `to`, `to == from`, `to < from`,
        and a span above 366 days.
  - [ ] `eventBodySchema` rejects an empty or whitespace-only `title`.
  - [ ] `eventBodySchema` rejects `endAt == startAt` and `endAt < startAt`, reporting on the
        `endAt` path.
  - [ ] `eventBodySchema` collapses duplicate identifiers in `attendeeIds` and `hostIds`.
  - [ ] `eventBodySchema` **drops** `createdByUserId` and `updatedByUserId` if present in the
        input — no `.passthrough()`.
  - [ ] `eventIdParamSchema` rejects a non-24-hex identifier.
  - [ ] `pnpm --filter server build` passes.
- **Validation:** `pnpm --filter server build`; behavioural proof comes from TASK-014.
- **Risks / notes:** **Do not copy `server/dist/modules/events/event.schemas.js`** — it
  contains the verified `z.iso.datetime()` defect and the superseded field names. Do not make
  `from`/`to` optional; an unbounded "all events" read has no caller and refusing it keeps a
  collection scan from becoming the default. Note that `zod@4.4.3` is what the workspace
  resolves; the `z.iso.*` namespace is Zod 4 API and does not exist in Zod 3.
- **Estimate:** 2.5–4 hours
- **Estimate confidence:** Medium-high — well specified, but the refinement chaining and
  transform ordering in Zod 4 take some iteration.

### TASK-014 — Unit-test the Event model invariants and the request schemas

- **Description:** Prove the data rules directly, at the level where they are cheapest to
  assert and hardest to reach through HTTP. This is where the `+03:00` acceptance is first
  locked down.
- **Requirements:** REQ-012, REQ-013, REQ-014, REQ-017, REQ-018, REQ-026.
- **Depends on:** TASK-012, TASK-013, TASK-003.
- **Deliverables:** test files covering the model invariants (against the in-memory harness)
  and the schemas (as pure unit tests, no database needed).
- **Acceptance criteria:**
  - [ ] A saved event lands in the `events` collection with all seven domain paths.
  - [ ] Saving with a duplicated participant id stores exactly one entry.
  - [ ] Saving with `endAt <= startAt` fails with a Mongoose `ValidationError`.
  - [ ] `getIndexes()` on `events` after connection includes an index on
        `{ startAt: 1, endAt: 1 }`.
  - [ ] Schema tests cover: `Z` bounds accepted; `+03:00` bounds accepted with correct
        instants; local-naive rejected; `to == from` rejected; `to < from` rejected;
        over-long span rejected; whitespace-only `title` rejected; `endAt == startAt`
        rejected; duplicates collapsed; `createdByUserId` stripped from parsed output;
        malformed `:id` rejected.
  - [ ] `pnpm --filter server test` passes.
- **Validation:** `pnpm --filter server test`.
- **Risks / notes:** The `+03:00` assertion must check the resulting **instant**, not just
  that parsing succeeded — a schema that accepts the string but mis-parses the offset would
  pass a weaker test. Index assertions need the connection to have finished building indexes;
  await `Model.init()` or the equivalent rather than racing it.
- **Estimate:** 2.5–4 hours
- **Estimate confidence:** Medium-high — eleven schema cases plus four model cases, all
  short.

---

## Stage 5 — Event calendar read API

### TASK-015 — Implement `listEvents` with batched participant resolution and the read-shape mapper

- **Description:** The calendar's only read pattern. Query events overlapping the half-open
  interval `[from, to)`, then resolve every participant across the **whole result set** in
  exactly two `$in` queries — one against `Contact`, one against `Employee`. Resolving per
  event, as the prior build output did, is an N+1 that means roughly one hundred round trips
  to a hosted cluster for a busy month. Participant references that no longer resolve are
  dropped rather than failing the request, because MongoDB enforces no referential integrity.
- **Requirements:** REQ-016, REQ-019, REQ-020, REQ-026.
- **Depends on:** TASK-012, TASK-008.
- **Deliverables:** `server/src/modules/events/event.service.ts` — `listEvents({ from, to })`
  plus the shared read-shape mapper reused by the write operations in Stage 6.
- **Acceptance criteria:**
  - [ ] The query is `Event.find({ startAt: { $lt: to }, endAt: { $gt: from } })` sorted
        `{ startAt: 1 }`.
  - [ ] Participants are resolved in **at most two** database queries regardless of how many
        events are returned.
  - [ ] The mapper returns `{ id, title, startAt, endAt, attendees, hosts }` with `id` as
        `_id.toString()` and the instants as `toISOString()`.
  - [ ] Each participant is `{ id, firstName, lastName, fullName }` with a string `id`.
  - [ ] A participant id with no matching person is omitted, and the remaining participants
        keep their stored order.
  - [ ] `createdByUserId` and `updatedByUserId` are **not** present in the mapped output.
  - [ ] The mapper is exported so Stage 6 reuses it rather than duplicating the shape.
  - [ ] `pnpm --filter server build` passes.
- **Validation:** `pnpm --filter server build`; behavioural proof comes from TASK-017.
- **Risks / notes:** Do **not** use `populate()` — it returns full documents, works per path,
  and hides the drop-unresolvable behaviour this requirement needs. Reference
  `server/dist/modules/events/event.service.js` for structure but replace its per-event
  resolution. Keep the mapper pure and separately callable; three later operations depend on
  it producing an identical shape.
- **Estimate:** 3–5 hours
- **Estimate confidence:** Medium — the batching and the ordered drop-unresolvable behaviour
  need care.

### TASK-016 — Add `GET /api/events` and mount the events router

- **Description:** Expose the range read through one thin async handler and mount the events
  router above the 404 handler.
- **Requirements:** REQ-003, REQ-016, REQ-017, REQ-018.
- **Depends on:** TASK-015, TASK-013, TASK-006.
- **Deliverables:**
  - `server/src/modules/events/event.routes.ts` — `GET /` validating `req.query` through the
    shared helper and returning `{ events }`.
  - `server/src/app.ts` — `app.use('/api/events', eventsRouter)` at the marked insertion
    point.
- **Acceptance criteria:**
  - [ ] The handler validates the query before any database access.
  - [ ] The handler contains no `try/catch` and no business logic.
  - [ ] The response is `{ events: [...] }` with status 200, and `{ events: [] }` for an
        empty period.
  - [ ] The events router is mounted **above** the catch-all 404 handler.
  - [ ] `pnpm --filter server build` passes.
- **Validation:** `pnpm --filter server build`; start `pnpm dev:server` and confirm
  `GET /api/events?from=...&to=...` returns 200 with an empty list, and that omitting `from`
  returns 400 in the shared envelope.
- **Risks / notes:** **Shared files** — `server/src/app.ts` (also TASK-006, TASK-010) and
  `event.routes.ts` (also TASK-021). Sequence these, do not parallelize.
- **Estimate:** 1–2 hours
- **Estimate confidence:** High — one handler and one mount line.

### TASK-017 — Test the range read: six boundary cases plus the UTC-offset regression

- **Description:** Prove the overlap semantics exactly, including both exclusions at the
  period edges, and lock in the FullCalendar offset tolerance at the HTTP level. **The
  offset test is the single most important regression test in the change** — it is the defect
  found in the prior build output, and without it a browser outside UTC gets an empty
  calendar with no error.
- **Requirements:** REQ-016, REQ-017, REQ-018, REQ-019, REQ-020, REQ-026.
- **Depends on:** TASK-016, TASK-003.
- **Deliverables:** an integration test file covering every scenario below.
- **Acceptance criteria:**
  - [ ] An event fully inside the range is returned.
  - [ ] An event fully before the range is not returned.
  - [ ] An event fully after the range is not returned.
  - [ ] An event straddling `from` is returned.
  - [ ] An event straddling `to` is returned.
  - [ ] An event containing the whole range is returned.
  - [ ] An event ending **exactly** at `from` is **excluded**.
  - [ ] An event starting **exactly** at `to` is **excluded**.
  - [ ] An empty period returns 200 with `{ events: [] }`.
  - [ ] Results are ordered ascending by `startAt`.
  - [ ] **Bounds carrying `+03:00` are accepted and select exactly the same events as the
        equivalent `Z` bounds.**
  - [ ] A missing `from`, a missing `to`, `to <= from`, and an over-long span each return 400
        in the shared envelope.
  - [ ] Every returned `id` is a 24-character hex string, and `startAt`/`endAt` end in `Z`.
  - [ ] An event holding a participant id with no matching person is still returned, with
        that person absent from the list.
  - [ ] No response contains `createdByUserId` or `updatedByUserId`.
  - [ ] `pnpm --filter server test` passes.
- **Validation:** `pnpm --filter server test`.
- **Risks / notes:** Build the fixtures from explicit UTC instants so the boundary assertions
  are not affected by the machine's time zone. The two exclusion cases are the ones most
  often implemented as `<=` / `>=` by accident, which double-counts events at period edges.
  Remember to URL-encode the `+` in the offset test (`%2B`), or it will be parsed as a space
  and the test will pass for the wrong reason.
- **Estimate:** 4–6 hours
- **Estimate confidence:** Medium — fifteen named scenarios plus careful fixture
  construction; the URL-encoding trap can cost an hour on its own.

---

## Stage 6 — Event write API: create, update, delete

### TASK-018 — Implement the `assertPeopleExist` guard and `createEvent`

- **Description:** Create an event, but only after proving every submitted participant
  identifier exists in its collection. Validation must run **before** any write, so a
  rejection leaves the collection untouched. The audit fields are constructed server-side as
  `null` — they are never read from the request body, because there is no authenticated actor
  and accepting them would be a forgeable audit trail.
- **Requirements:** REQ-021, REQ-025, REQ-026, REQ-013, REQ-014.
- **Depends on:** TASK-015.
- **Deliverables:** in `event.service.ts` — `assertPeopleExist(ids, model)` and
  `createEvent(body)`.
- **Acceptance criteria:**
  - [ ] `assertPeopleExist` performs **no query** for an empty array.
  - [ ] `assertPeopleExist` runs exactly one `find({ _id: { $in } }, { _id: 1 })` per
        collection and throws `UNKNOWN_PARTICIPANT` if any submitted id is missing.
  - [ ] Both participant sets are validated **before** the event is written.
  - [ ] The document is constructed field by field — `req.body` is **never** spread into it.
  - [ ] `createdByUserId` and `updatedByUserId` are written as `null` by the service.
  - [ ] `createEvent` returns the created event through the **shared mapper** from TASK-015,
        producing an identical shape to the list endpoint.
  - [ ] `pnpm --filter server build` passes.
- **Validation:** `pnpm --filter server build`; behavioural proof comes from TASK-022.
- **Risks / notes:** The empty-array short-circuit matters: attendees and hosts are optional
  and most events will have at least one empty set, so a naive implementation adds two
  pointless round trips per write. Mass assignment is the security risk here — the Zod schema
  strips unknown keys, but the service must not undo that by spreading the parsed object into
  the document wholesale either.
- **Estimate:** 2.5–4 hours
- **Estimate confidence:** Medium-high.

### TASK-019 — Implement `updateEvent` with wholesale participant replacement

- **Description:** Replace the event's title, times and **both participant arrays** with the
  submitted sets. Wholesale replacement is what makes the PRD's "participant edits persist
  only on save" fall out of the data model: the form holds the intent, the request carries
  the intent, and nothing is written until the user commits.
- **Requirements:** REQ-022, REQ-024, REQ-025, REQ-026, REQ-013, REQ-014.
- **Depends on:** TASK-018.
- **Deliverables:** `updateEvent(id, body)` in `event.service.ts`.
- **Acceptance criteria:**
  - [ ] Both participant sets are validated before any write.
  - [ ] `attendeeIds` and `hostIds` are **replaced**, not merged — a previously assigned
        person absent from the request is no longer assigned.
  - [ ] `title`, `startAt` and `endAt` are updated.
  - [ ] `NOT_FOUND` is thrown when the identifier matches no event.
  - [ ] The implementation uses `findOneAndUpdate(..., { new: true, runValidators: true })`
        rather than read-modify-`save()`, so a concurrent delete cannot resurrect the
        document.
  - [ ] `createdByUserId` is left untouched; `updatedByUserId` stays `null` and is never read
        from the body.
  - [ ] The updated event is returned through the shared mapper.
  - [ ] `pnpm --filter server build` passes.
- **Validation:** `pnpm --filter server build`; behavioural proof comes from TASK-023.
- **Risks / notes:** `runValidators: true` is required for the model-level `endAt > startAt`
  guard to apply on an update path — Mongoose does not run validators on
  `findOneAndUpdate` by default. Do **not** add incremental participant endpoints; they
  contradict the deferred-persistence requirement.
- **Estimate:** 2–3.5 hours
- **Estimate confidence:** Medium-high — the `runValidators` and de-duplicating-setter
  interaction on the update path may need a little probing.

### TASK-020 — Implement `deleteEvent`

- **Description:** Delete by identifier and report a miss as a not-found rather than
  silently succeeding, so the client can tell "already gone" from "deleted now".
- **Requirements:** REQ-023, REQ-024.
- **Depends on:** TASK-015.
- **Deliverables:** `deleteEvent(id)` in `event.service.ts`.
- **Acceptance criteria:**
  - [ ] Uses `findOneAndDelete` (or `findByIdAndDelete`) and throws `NOT_FOUND` when nothing
        matched.
  - [ ] Returns nothing on success — the route sends 204 with an empty body.
  - [ ] `pnpm --filter server build` passes.
- **Validation:** `pnpm --filter server build`; behavioural proof comes from TASK-023.
- **Risks / notes:** No cascade is needed: participants are embedded on the event document,
  and no deletion endpoint exists for people.
- **Estimate:** 1–1.5 hours
- **Estimate confidence:** High — a few lines.

### TASK-021 — Add the `POST`, `PATCH /:id` and `DELETE /:id` routes

- **Description:** Expose the three write operations as thin async handlers that validate
  params and body through the shared helper and delegate, returning the agreed status codes.
- **Requirements:** REQ-021, REQ-022, REQ-023, REQ-024.
- **Depends on:** TASK-018, TASK-019, TASK-020, TASK-016.
- **Deliverables:** three handlers added to `server/src/modules/events/event.routes.ts`.
- **Acceptance criteria:**
  - [ ] `POST /` returns 201 with `{ event }`.
  - [ ] `PATCH /:id` returns 200 with `{ event }`.
  - [ ] `DELETE /:id` returns 204 with an **empty** body.
  - [ ] `PATCH` and `DELETE` validate `:id` through `eventIdParamSchema` before any database
        access.
  - [ ] `POST` and `PATCH` validate the body through `eventBodySchema`.
  - [ ] No handler contains a `try/catch` or any business logic.
  - [ ] `pnpm --filter server build` passes.
- **Validation:** `pnpm --filter server build`; start `pnpm dev:server` and complete one
  create → fetch → update → delete round trip by hand.
- **Risks / notes:** **Shared file** — `event.routes.ts` is also modified by TASK-016.
  Sequence them. Returning a body from `DELETE` alongside 204 is a common slip and some
  clients treat it as a protocol error.
- **Estimate:** 1.5–3 hours
- **Estimate confidence:** High.

### TASK-022 — Test event creation, including every rejection path

- **Description:** Prove that a valid create succeeds and is retrievable, and that every
  rejection path returns the right status **and leaves the collection unchanged**. The
  "collection unchanged" assertion is what proves validation runs before the write.
- **Requirements:** REQ-021, REQ-013, REQ-014, REQ-025, REQ-026, REQ-002.
- **Depends on:** TASK-021, TASK-003.
- **Deliverables:** an integration test file for the create endpoint.
- **Acceptance criteria:**
  - [ ] A valid body returns 201, and the event is retrievable through a containing range
        query.
  - [ ] A whitespace-only `title` returns 400.
  - [ ] `endAt == startAt` returns 400; `endAt < startAt` returns 400.
  - [ ] An unknown attendee id returns 400 **and the `events` count is unchanged**.
  - [ ] An unknown host id returns 400 **and the `events` count is unchanged**.
  - [ ] Duplicate ids in the request produce exactly one stored assignment per person.
  - [ ] Empty `attendeeIds` and `hostIds` are accepted.
  - [ ] The same person assigned as both attendee and host stores both assignments.
  - [ ] A body containing `createdByUserId` does not write it and does not echo it.
  - [ ] Every failure response is `{ error: { code, message } }` with no `stack`.
  - [ ] `pnpm --filter server test` passes.
- **Validation:** `pnpm --filter server test`.
- **Risks / notes:** The "same person in both roles" case is legitimate and must pass —
  attendees reference `contacts` and hosts reference `employees`, so they are different
  people even when they share a name. Use a real seeded contact and a real seeded employee
  for the happy path so participant resolution is genuinely exercised.
- **Estimate:** 3–4 hours
- **Estimate confidence:** Medium-high — ten scenarios against an existing harness.

### TASK-023 — Test event update and delete, including wholesale replacement and 404/400 paths

- **Description:** Prove wholesale participant replacement — the behaviour the whole dialog
  design depends on — and the full not-found and malformed-identifier matrix for both
  operations.
- **Requirements:** REQ-022, REQ-023, REQ-024, REQ-025, REQ-014, REQ-002.
- **Depends on:** TASK-021, TASK-003.
- **Deliverables:** an integration test file for the update and delete endpoints.
- **Acceptance criteria:**
  - [ ] Updating an event assigned to A and B with `[B, C]` leaves exactly B and C assigned.
  - [ ] `title`, `startAt` and `endAt` are updated and reflected in a subsequent range query.
  - [ ] A valid but unmatched event id returns 404 on `PATCH`.
  - [ ] A malformed event id returns 400 on `PATCH`.
  - [ ] An unknown participant id on update returns 400 **and the event is unchanged**.
  - [ ] Duplicate ids on update produce exactly one stored assignment.
  - [ ] `endAt <= startAt` on update returns 400.
  - [ ] `DELETE` returns 204 with an empty body and the event no longer appears in a range
        query.
  - [ ] A valid but unmatched event id returns 404 on `DELETE`.
  - [ ] A malformed event id returns 400 on `DELETE`.
  - [ ] Every failure response is `{ error: { code, message } }` with no `stack`.
  - [ ] `pnpm --filter server test` passes.
- **Validation:** `pnpm --filter server test`.
- **Risks / notes:** The wholesale-replacement test must assert both directions — the removed
  person is gone **and** the added person is present. Asserting only one of them passes
  against a merging implementation.
- **Estimate:** 3–5 hours
- **Estimate confidence:** Medium-high — eleven scenarios plus multi-step fixtures.

---

## Stage 7 — Seed script for contacts and employees

### TASK-024 — Write the idempotent contacts and employees seed script

- **Description:** The attendee and host acceptance criteria cannot be exercised against
  empty collections and no management UI exists to populate them. Seed a small, varied
  directory. The script writes to whatever `DB_HOST` names — which is a **shared personal
  Atlas cluster hosting unrelated databases** — so it must be idempotent, must touch only two
  collections, and must contain no destructive operation anywhere.
- **Requirements:** REQ-027, REQ-007.
- **Depends on:** TASK-008.
- **Deliverables:** `server/src/shared/db/seed.ts`, runnable through the `seed` script added
  in TASK-002.
- **Acceptance criteria:**
  - [ ] The script logs the resolved database name **before** the first write.
  - [ ] Every write is `updateOne({ email }, { $set }, { upsert: true })` — idempotent.
  - [ ] Running the script twice leaves identical document counts in `contacts` and
        `employees`.
  - [ ] The seed set includes several active contacts, several active employees with
        `canHostEvents: true`, **at least one employee with `canHostEvents: false`**, and
        **at least one person with `status: 'inactive'`**.
  - [ ] Employees carry `position` and `department`.
  - [ ] Last names are varied enough to make sorting observable, and at least one pair shares
        a first-name prefix so search narrowing is observable.
  - [ ] The script writes **only** to `contacts` and `employees`; `events` and `users` counts
        are unchanged after a run.
  - [ ] The script contains no `deleteMany`, no `drop` and no `createIndex`.
  - [ ] The script disconnects and exits cleanly.
- **Validation:** `pnpm --filter server seed` twice, comparing document counts; then check
  `events` and `users` counts against the TASK-001 reading; then `GET /api/contacts`,
  `GET /api/employees` and `GET /api/employees?canHostEvents=true` and confirm the filters
  behave as expected.
- **Risks / notes:** Without the unique partial index on `email` from TASK-008, concurrent
  runs could create duplicates — low risk for a manually run script, but note which way that
  decision went. Do not seed `events`; the write endpoints exist for that. Do not use the
  seed as a substitute for test fixtures — tests use the in-memory harness.
- **Estimate:** 2–3.5 hours
- **Estimate confidence:** High — mostly data authoring, with care around the safety rules.

---

## Stage 8 — Publish the contract and reconcile the OpenSpec change

### TASK-025 — Reconcile `design.md` and publish the API contract with the FullCalendar mapping

- **Description:** `openspec/changes/add-events-page/design.md` is the project's own design
  document for this feature and currently specifies `name`/`startsAt`/`endsAt` and a minimal
  person shape. If it is not corrected, the client implementer will build against names the
  server does not use. Publish the final contract, including the API → FullCalendar
  `EventInput` mapping table and the reason the range parameters must tolerate a numeric UTC
  offset — the detail most likely to be lost.
- **Requirements:** REQ-030, REQ-019.
- **Depends on:** TASK-017, TASK-023 (the contract must be final before it is published).
- **Deliverables:** an updated `openspec/changes/add-events-page/design.md` carrying the
  implemented field names, all six endpoints with their verbs and parameters, the request and
  response shapes, the error code set, and the FullCalendar mapping table.
- **Acceptance criteria:**
  - [ ] Every event field name in `design.md` is `title` / `startAt` / `endAt`, matching the
        code.
  - [ ] The person schema descriptions include `status`, and the employee description
        includes `position`, `department` and `canHostEvents`.
  - [ ] The event description includes `createdByUserId` / `updatedByUserId` and states that
        they are server-constructed, never client-settable, and not exposed.
  - [ ] The API surface block lists all six endpoints with their actual verbs, parameters and
        status codes.
  - [ ] The FullCalendar mapping table is published and includes both the `id`-must-be-a-
        string constraint and the offset-tolerance requirement, with the reason.
  - [ ] The documented error codes match the ones the implementation actually emits.
- **Validation:** re-read `design.md` line by line against `event.model.ts`,
  `event.schemas.ts`, `event.service.ts`, `directory.service.ts` and `event.routes.ts`, and
  confirm every field name, parameter and status code matches. Then
  `pnpm --filter server build`.
- **Risks / notes:** Prefer the project's `/opsx:*` commands over hand-editing where they
  apply (`CLAUDE.md`). Do **not** archive the change — the client half is still outstanding.
  Do not delete the three capability specs. Do not create a parallel API documentation file;
  it will drift.
- **Estimate:** 3–5 hours
- **Estimate confidence:** Medium — the amount of rewriting versus annotating in a
  208-line design document is the main variable.

### TASK-026 — Update the OpenSpec `tasks.md` statuses

- **Description:** `AGENTS.md:44-46` requires keeping OpenSpec task status aligned with
  completed work. Mark the server tasks this change delivered, correct the superseded field
  names in the remaining task text, and leave every client task open.
- **Requirements:** REQ-030.
- **Depends on:** TASK-025.
- **Deliverables:** an updated `openspec/changes/add-events-page/tasks.md`.
- **Acceptance criteria:**
  - [ ] Server tasks corresponding to sections 2–6 of that file are marked complete only
        where the work was actually done.
  - [ ] Field names in the remaining task text match the implementation.
  - [ ] **No client task is marked complete.**
  - [ ] Tasks this change deliberately did not do (removing the root `@mui/x-date-pickers`
        and `zustand` entries, client dependencies) remain open.
- **Validation:** read the file against the actual deliverables of TASK-002 through TASK-024.
- **Risks / notes:** Over-marking is the risk. When in doubt, leave a task open and note why.
- **Estimate:** 1–1.5 hours
- **Estimate confidence:** High.

### TASK-027 — Update `README.md` with `test`, `seed` and the unauthenticated-API warning

- **Description:** The README currently documents only `pnpm install`, `dev:client` and
  `dev:server`. Add the two new commands and — more importantly — state plainly that these
  endpoints are unauthenticated and run against a shared Atlas cluster. This is real,
  recorded exposure, and it should be discoverable rather than buried in a design document.
- **Requirements:** REQ-030.
- **Depends on:** TASK-003, TASK-024.
- **Deliverables:** an updated `README.md`.
- **Acceptance criteria:**
  - [ ] `pnpm --filter server test` is documented, with a note that
        `mongodb-memory-server` downloads a MongoDB binary on first run.
  - [ ] `pnpm --filter server seed` is documented, with a note that it writes to whichever
        database `DB_HOST` names and is safe to re-run.
  - [ ] A clear warning states that the API is **unauthenticated**, runs against a shared
        Atlas cluster, and **must not be exposed beyond local development** until the
        authorization change lands.
  - [ ] A pointer to the published API contract in the OpenSpec change is included.
  - [ ] No credential, connection string or `.env` content appears anywhere.
- **Validation:** read the file; confirm both commands run as documented.
- **Risks / notes:** Do not restate the whole API contract in the README — point at the
  single source in the OpenSpec change so the two cannot drift.
- **Estimate:** 1–1.5 hours
- **Estimate confidence:** High.

---

## Stage 9 — Final verification

### TASK-028 — Run the clean-install build and test gate

- **Description:** Prove the change works from the lockfile rather than from a warm local
  `node_modules` — the specific failure this catches is a dependency that is imported but
  never declared, which the stale `zod` and `mongodb-memory-server` symlinks under
  `server/node_modules/` would otherwise hide.
- **Requirements:** REQ-028, REQ-029.
- **Depends on:** every implementation task (TASK-002 through TASK-024).
- **Deliverables:** recorded output of the three gate commands and the two `grep` checks.
- **Acceptance criteria:**
  - [ ] `pnpm install` from a clean state succeeds.
  - [ ] `pnpm --filter server build` exits zero with no diagnostics.
  - [ ] `pnpm --filter server test` passes with every named scenario from Stages 2–6 present.
  - [ ] `grep -rn "DB_HOST" server/test/` returns nothing.
  - [ ] `grep -rn "users" server/src/` shows no model, query or write against that
        collection.
- **Validation:** the commands above, run in order, from the repository root.
- **Risks / notes:** `pnpm build:client` and `pnpm build:server` are pre-approved in
  `.claude/settings.json`; `pnpm install`, `test` and `seed` are not and will prompt. Do not
  claim a command passed that was not actually run.
- **Estimate:** 1–2 hours
- **Estimate confidence:** Medium-high — assumes no defects surface; each one found adds
  time here or reopens an earlier task.

### TASK-029 — Walk the manual end-to-end and failure paths and audit the blast radius

- **Description:** Automated tests run against an in-memory database and a synthetic app.
  The manual walkthrough covers what they cannot: the real Atlas connection, the real dev
  server booting under Node's native type stripping, and confirmation that the change touched
  nothing it should not have.
- **Requirements:** REQ-002, REQ-003, REQ-007, and end-to-end confirmation of all others.
- **Depends on:** TASK-028, TASK-024.
- **Deliverables:** a recorded walkthrough result and a blast-radius audit.
- **Acceptance criteria:**
  - [ ] `pnpm dev:server` boots with no native type-stripping error.
  - [ ] `GET /api/health` returns `{ status: 'ok' }`.
  - [ ] `GET /api/contacts?search=<partial>` and `GET /api/employees?canHostEvents=true`
        return the expected seeded people.
  - [ ] A full round trip succeeds: `POST` an event → `GET` it over a containing range
        **once with `Z` bounds and once with `+03:00` bounds** → `PATCH` its participants →
        `GET` again confirming the change → `DELETE` → `GET` confirming removal.
  - [ ] Each failure path returns the shared envelope with no `stack`: an unknown route; a
        malformed event id; a valid but unmatched event id; a blank title;
        `endAt <= startAt`; an unknown participant id; a missing `from`.
  - [ ] The `users` document count matches the TASK-001 reading exactly.
  - [ ] Only `contacts`, `employees` and `events` were written.
  - [ ] `git status` shows changes only under `server/src/`, `server/test/`,
        `server/package.json`, `pnpm-lock.yaml`, `openspec/changes/add-events-page/`,
        `README.md` and `specs/add-events-api/` — and **nothing** under `client/`,
        `.ai_toolkit/` or `server/dist/`.
- **Validation:** the walkthrough above, plus `git status` and a read-only collection count.
- **Risks / notes:** Remember to URL-encode the `+` in the offset request (`%2B`). Do not fix
  unrelated pre-existing issues found along the way — raise them separately. Do not skip the
  manual walkthrough because the test suite is green; the two cover different failure modes.
- **Estimate:** 2–3 hours
- **Estimate confidence:** Medium-high — depends on how many defects surface.

---

## Requirements-to-tasks traceability

| Requirement | Task(s) | Acceptance coverage |
| --- | --- | --- |
| REQ-001 Zod validation at the boundary | TASK-004, TASK-009, TASK-010, TASK-013, TASK-016, TASK-021 | Validate helper returns parsed data; every endpoint validates before database access; 400 assertions in TASK-011, TASK-014, TASK-017, TASK-022, TASK-023 |
| REQ-002 Single error envelope, no internals | TASK-004, TASK-005, TASK-006, TASK-007, TASK-022, TASK-023, TASK-029 | Envelope shape and absent-`stack` assertions across both `NODE_ENV` values; per-endpoint failure assertions; manual failure walkthrough |
| REQ-003 Routers mounted under `/api` above 404/error | TASK-006, TASK-010, TASK-016, TASK-007, TASK-029 | Handler ordering criterion; unknown-route test; endpoints reachable in tests and by hand |
| REQ-004 Mongoose `CastError`/`ValidationError` → 400 | TASK-005, TASK-007, TASK-012 | Middleware mapping tests; malformed-id tests return 400 in TASK-022 and TASK-023 |
| REQ-005 Contact model bound to `contacts` | TASK-001, TASK-008 | Explicit `collection` option; save/read-back test; `fullName` virtual assertion |
| REQ-006 Employee model with `position`/`department`/`canHostEvents` | TASK-001, TASK-008 | Model field criteria; employee response-shape assertion in TASK-011 |
| REQ-007 `users` untouched | TASK-008, TASK-024, TASK-028, TASK-029 | `grep` check in TASK-028; document count matched against TASK-001 in TASK-029 |
| REQ-008 `GET /api/contacts` search/sort/cap | TASK-009, TASK-010, TASK-011 | Search, sort, cap and shape scenarios |
| REQ-009 `GET /api/employees` + `canHostEvents` filter | TASK-009, TASK-010, TASK-011 | Filter scenario using an employee with the flag set to `false` |
| REQ-010 Active-only by default | TASK-009, TASK-011, TASK-024 | Non-active person excluded scenario, backed by a seeded inactive person |
| REQ-011 Search escaped and bounded | TASK-009, TASK-011 | `.*` literal-match scenario; over-long term returns 400 |
| REQ-012 Event model fields and collection binding | TASK-001, TASK-012, TASK-014 | Explicit `collection` option; all seven paths asserted on save/read-back |
| REQ-013 `endAt > startAt` at both layers | TASK-012, TASK-013, TASK-014, TASK-018, TASK-019, TASK-022, TASK-023 | Model `ValidationError` test; schema rejection tests; 400 on create and update |
| REQ-014 No duplicate participants | TASK-012, TASK-013, TASK-014, TASK-018, TASK-019, TASK-022, TASK-023 | Setter test; schema de-duplication test; one-stored-assignment assertions on create and update |
| REQ-015 Range index declared | TASK-001, TASK-012, TASK-014 | `getIndexes()` assertion after connection |
| REQ-016 Half-open overlap range read | TASK-015, TASK-016, TASK-017 | Six boundary scenarios including both exclusions; ordering assertion |
| REQ-017 Offset-bearing ISO bounds accepted | TASK-013, TASK-014, TASK-017, TASK-029 | Schema `+03:00` instant assertion; HTTP `+03:00` selection assertion; manual `%2B03:00` request |
| REQ-018 Range required, ordered, span-capped | TASK-013, TASK-014, TASK-017 | Missing-bound, `to <= from` and over-span 400 assertions at both levels |
| REQ-019 FullCalendar-mappable read shape | TASK-015, TASK-017, TASK-025 | String-`id` and ISO-`Z` assertions; published mapping table |
| REQ-020 Dangling reference tolerated | TASK-015, TASK-017 | Unresolvable-participant scenario returning the event without that person |
| REQ-021 `POST` creates, returns 201 | TASK-018, TASK-021, TASK-022 | 201 plus containing-range retrieval |
| REQ-022 `PATCH` replaces participants wholesale | TASK-019, TASK-021, TASK-023 | Removed-gone **and** added-present assertion |
| REQ-023 `DELETE` returns 204 | TASK-020, TASK-021, TASK-023 | 204 with empty body plus range-query confirmation of removal |
| REQ-024 404 for unmatched id, 400 for malformed | TASK-013, TASK-019, TASK-020, TASK-021, TASK-023 | Four scenarios across `PATCH` and `DELETE` |
| REQ-025 Unknown participant rejected, nothing written | TASK-018, TASK-019, TASK-022, TASK-023 | 400 plus collection-unchanged assertions on both create and update |
| REQ-026 Audit fields never client-settable or exposed | TASK-012, TASK-013, TASK-014, TASK-015, TASK-018, TASK-019, TASK-022 | Schema strips the key; service constructs `null`; response-shape assertions on list and create |
| REQ-027 Idempotent seed | TASK-024 | Two runs with identical counts; variety and collection-scope criteria |
| REQ-028 Test harness never reads `DB_HOST` | TASK-002, TASK-003, TASK-028 | In-helper host assertion; `grep` check |
| REQ-029 `pnpm --filter server build` passes | every implementation task, TASK-028 | Build criterion on every task; clean-install gate |
| REQ-030 Contract published, OpenSpec reconciled | TASK-025, TASK-026, TASK-027 | Field-by-field re-read against the code; task-status criteria; README criteria |

Every task maps to at least one requirement or to enabling/verification work: TASK-001 is
enabling for REQ-005/006/012/015; TASK-028 and TASK-029 are verification for the whole set.

---

## Critical path and parallel work

### Critical path

```
TASK-001 → TASK-002 → TASK-008 → TASK-012 → TASK-015 → TASK-016 → TASK-018 → TASK-019
        → TASK-021 → TASK-023 → TASK-025 → TASK-026 → TASK-028 → TASK-029
```

Critical-path effort: **≈ 26–44 focused hours**. Everything else can be overlapped by a
second implementer.

`TASK-016` has a second predecessor chain — `TASK-002 → TASK-004 → TASK-005 → TASK-006`
(5–8 h) — which runs in parallel with `TASK-008 → TASK-012 → TASK-015` (7.5–13 h) and is
therefore not on the critical path.

### Safe parallel groups

| Group | Tasks | Precondition | Note |
| --- | --- | --- | --- |
| P1 | TASK-003, TASK-004, TASK-008, TASK-013 | TASK-002 complete | Four independent files in four different directories; no shared file |
| P2 | TASK-005 ∥ TASK-009 ∥ TASK-012 | TASK-004 / TASK-008 respectively complete | Different modules entirely |
| P3 | TASK-011 ∥ TASK-014 ∥ TASK-024 | TASK-010 / TASK-013 / TASK-008 respectively complete | Two test files and one script; no overlap |
| P4 | TASK-019 ∥ TASK-020 | TASK-018 / TASK-015 complete | Both add separate functions to `event.service.ts` — see the conflict note below |
| P5 | TASK-017 ∥ TASK-022 ∥ TASK-023 | TASK-016 / TASK-021 complete | Three separate test files |
| P6 | TASK-026 ∥ TASK-027 | TASK-025 / TASK-024 complete | Two different documentation files |

### Shared-file and contract conflicts — do **not** parallelize these

| File | Tasks that modify it | Required order |
| --- | --- | --- |
| `server/src/app.ts` | TASK-006, TASK-010, TASK-016 | TASK-006 → TASK-010 → TASK-016. Three separate edits to one file; running them concurrently guarantees a merge conflict and risks the router landing below the 404 handler. |
| `server/src/modules/events/event.routes.ts` | TASK-016, TASK-021 | TASK-016 → TASK-021 |
| `server/src/modules/events/event.service.ts` | TASK-015, TASK-018, TASK-019, TASK-020 | TASK-015 first (it exports the shared mapper the others reuse). TASK-018 → TASK-019 (update reuses `assertPeopleExist`). TASK-020 may run alongside TASK-018/019 but touches the same file — coordinate or sequence. |
| `server/package.json`, `pnpm-lock.yaml` | TASK-002 only | Nothing else may add a dependency; a second concurrent `pnpm add` will churn the lockfile. |
| `server/test/helpers/mongo.ts` | TASK-003 only | Every later test task **consumes** it read-only. If a later task needs to change the harness, sequence that change and re-run the full suite. |
| Read shape `{ id, title, startAt, endAt, attendees, hosts }` | TASK-015 (defines) → TASK-018, TASK-019 (reuse), TASK-025 (publishes) | A contract, not a file. All three write operations must return the **identical** shape produced by the TASK-015 mapper; do not let a second copy appear. |
| Error code set | TASK-004 (defines) → every service and TASK-025 (publishes) | Adding a code late means the client's error table and the published contract both need revisiting. Settle the set in TASK-004. |

### Sequencing notes

- **TASK-001 blocks everything.** A non-empty `events` collection under the superseded field
  names invalidates Stage 4 onward and inserts a migration stage. Do not start TASK-002 until
  the go decision is written down.
- **TASK-003 blocks every test task** (TASK-007, TASK-011, TASK-014, TASK-017, TASK-022,
  TASK-023). If the in-memory harness cannot be made to work, raise it immediately — the
  entire test scope is renegotiated, not worked around.
- **TASK-025 must wait for TASK-017 and TASK-023.** Publishing a contract before the
  endpoints are proved risks documenting a shape that then changes.

---

## Final verification task

**TASK-029** is the end-to-end verification task. It proves the change against the plan's
*Overall definition of done*:

1. **Clean-install gate** (TASK-028): `pnpm install` → `pnpm --filter server build` →
   `pnpm --filter server test`, all green, from the lockfile rather than a warm
   `node_modules` — proving no dependency is imported without being declared.
2. **Safety greps**: no `DB_HOST` reference anywhere under `server/test/`; no model, query or
   write against `users` anywhere under `server/src/`.
3. **Happy path against the real database**: boot `pnpm dev:server`; `GET /api/health`;
   `GET /api/contacts?search=<partial>`; `GET /api/employees?canHostEvents=true`;
   `POST /api/events`; `GET /api/events` over a containing range **with `Z` bounds and again
   with `%2B03:00` bounds**; `PATCH /api/events/:id` changing participants; `GET` again to
   confirm; `DELETE /api/events/:id`; `GET` to confirm removal.
4. **Failure paths**: unknown route; malformed event id; valid-but-unmatched event id; blank
   title; `endAt <= startAt`; unknown participant id; missing `from`. Every response must be
   exactly `{ error: { code, message } }` with no `stack`, no driver text and no
   connection-string fragment.
5. **Data safety**: the `users` document count matches the TASK-001 reading exactly, and only
   `contacts`, `employees` and `events` were written.
6. **Blast radius**: `git status` shows changes only under `server/src/`, `server/test/`,
   `server/package.json`, `pnpm-lock.yaml`, `openspec/changes/add-events-page/`, `README.md`
   and `specs/add-events-api/` — and nothing under `client/`, `.ai_toolkit/` or
   `server/dist/`.
7. **Contract**: `openspec/changes/add-events-page/design.md` matches the implemented field
   names, endpoints and error codes, and carries the FullCalendar mapping table; `README.md`
   documents `test` and `seed` and warns that the API is unauthenticated.

Any failure at any step reopens the owning task rather than being patched in place at the
verification stage.
