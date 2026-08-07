# Implementation Plan: Server-side Events API (events, contacts, employees)

## Objective

The `server` package exposes six working endpoints under `/api` — a bounded event range
read, event create/update/delete, and read-only contact and employee directories — backed
by Mongoose models bound to the existing `events`, `contacts` and `employees` collections,
validated with Zod at the HTTP boundary, and reporting every failure through a single
`{ error: { code, message } }` envelope.

The delivered change is observable when, against a seeded database:

- `GET /api/events?from=<iso>&to=<iso>` returns every event overlapping the period, each
  with a string `id`, a `title`, UTC `startAt`/`endAt` instants, and resolved `attendees`
  and `hosts`, and **accepts bounds carrying a numeric UTC offset** such as `+03:00`;
- `POST`, `PATCH /:id` and `DELETE /:id` create, replace and remove an event, rejecting a
  blank title, an `endAt` not after `startAt`, and unknown participant identifiers;
- `GET /api/contacts` and `GET /api/employees` return searchable, sorted, capped person
  summaries, with `canHostEvents` filtering available on employees;
- no response anywhere carries a stack trace or a raw driver message;
- `pnpm --filter server build` and `pnpm --filter server test` both pass;
- `users` is untouched.

No client code is written. No authentication is added.

## Source of truth

`../report/research-report.md` — the sibling research report in this specification package.
Read it before starting; this plan does not restate its evidence.

The chosen approach is the recommendation in that report's *Recommended approach* section:
build the server slice in the project's own `src/modules/<feature>/` shape (model, schemas,
service, thin route controllers) plus a `src/shared/http/` foundation, adopting the prompt's
field names (`title`, `startAt`, `endAt`) and a **domain-shaped** wire format that the
client maps to FullCalendar's `EventInput` in one function.

Secondary authorities, in precedence order:

1. `server/AGENTS.md` and `server/CLAUDE.md` — package rules (module layout, `.ts` import
   extensions, Zod at the boundary, router ordering, `contacts`/`employees`/`users`).
2. `AGENTS.md` and `CLAUDE.md` — repository rules (pnpm only, build gates, no hand-edited
   `dist/`).
3. `openspec/changes/add-events-page/{proposal.md,design.md,tasks.md}` and its three
   capability specs — the committed design for this feature. Where its field names conflict
   with the prompt, the prompt wins and the OpenSpec change is reconciled in Stage 8.
4. `docs/prd/release 1.0.0/eventsPage.md` — the product requirements.

## Assumptions and prerequisites

**Prerequisites**

- A working `pnpm install` from the repository root; Node ≥ 24.18 (`.nvmrc` says `24`).
- `server/.env` present with a valid `DB_HOST` (already the case locally). Never read,
  print or commit its contents.
- Network access for `pnpm install` and for `mongodb-memory-server`'s first-run binary
  download.

**Assumptions carried from the report** (each is recorded there with its rationale and
reversibility; the implementer should not silently change one)

- `events`, `contacts` and `employees` are empty and carry no indexes beyond `_id`.
  **Stage 0 verifies this and is blocking.**
- `status` is `'active' | 'inactive'`, default `'active'`; directory reads filter to active
  by default.
- `canHostEvents` is a boolean defaulting to `true`, used as a directory filter only — it
  is **not** enforced when a host is assigned to an event.
- `position` and `department` are optional free-text strings.
- `createdByUserId` and `updatedByUserId` are declared, nullable, always written as `null`,
  never accepted from a request body, and never exposed in a response.
- `PATCH /api/events/:id` carries the complete editable field set and replaces the
  participant arrays wholesale.
- Directory results default to 50 and cap at 100; the event range span caps at 366 days.
- Times are stored as UTC instants; the server never interprets a time zone.
- The test stack is `node:test` plus `mongodb-memory-server`.

**Explicitly not assumed**

- That any code under `server/dist/` can be reused. It is untracked, gitignored build
  output from an implementation that was never committed, and it contains at least one
  verified defect (`z.iso.datetime()` without `offset: true`). Read it for reference only;
  **do not copy it, do not compile from it, do not edit it.**

## Delivery strategy

**Ordering principle.** Discovery first, then the shared foundation every module depends
on, then two vertical feature slices delivered read-before-write, then data seeding,
documentation and a final gate. Each stage from 2 onward leaves the server buildable,
startable and testable.

**Risk reduction.** The two highest-impact unknowns are front-loaded into Stage 0 and
Stage 1: whether the database is genuinely empty (which would otherwise be discovered after
the field names are already committed to code) and whether the in-memory Mongo harness works
in this environment (which gates every test in the plan). Both are timeboxed and produce a
go/no-go answer before dependent work starts.

The FullCalendar-driven ISO-offset requirement is not deferred to a later hardening pass —
it is built into the Stage 4 schema and proved by a named regression test in Stage 5,
because it is the single defect most likely to be reproduced from the prior build output.

**Vertical slicing.** Stage 3 (directory) is a complete slice: models, service, routes,
mounting and tests. It is deliberately delivered before the events module, because the
events service depends on the Contact and Employee models for participant validation, and
because it is the simpler of the two — proving the foundation on easy ground.

**Rollout.** Server-only, single deployment unit, no feature flag, no compatibility window,
no deployed consumer. The seed script is run manually, once.

**Rollback points.** Every stage is an independent, revertible commit. Stages 0 and 8 write
no runtime code at all. The only stage that touches an existing file is Stage 2
(`server/src/app.ts`); Stages 3 and 5 add two lines each to the same file for router
mounting. The only stage that writes to a real database is Stage 7, and its script is
idempotent.

**Commit discipline.** One Conventional Commit per stage, per `.ai_toolkit/commands/commit.md`.
Do not commit unless asked; leave the changes staged and reviewable if commit permission has
not been given.

---

## Stages

### Stage 0 — Establish ground truth about the database and the collections

- **Goal:** Replace the report's highest-impact assumption with a verified fact before any
  schema is written, so the field names and index declarations are committed against reality.
- **Requirements:** Enabling for REQ-005, REQ-006, REQ-012, REQ-015 (validates the
  "collections are empty" assumption those requirements rest on).
- **Depends on:** none.
- **Areas affected:** none — this stage is read-only and produces findings, not code.
- **Changes:**
  1. Using the existing Mongoose connection helper (`server/src/shared/infra/mongoose/client.ts`)
     from a **throwaway script run outside the repository**, or an interactive `mongosh`
     session, connect using `DB_HOST` and record, read-only:
     - `db.getName()` — confirm which database `DB_HOST` actually resolves to;
     - `countDocuments()` for `events`, `contacts`, `employees` and `users`;
     - `findOne()` for each non-empty collection, to see the field names in use;
     - `getIndexes()` for each of the four collections.
  2. Record the findings in the stage's commit message or as a note appended to
     `specs/add-events-api/report/research-report.md` under *Unknowns*.
  3. Decide the branch:
     - **All four empty** → proceed to Stage 1 with the plan unchanged.
     - **`events` holds documents using `name` / `startsAt` / `endsAt`** → **stop and raise
       it.** Do not proceed on assumption. The options are a one-off `updateMany` with
       `$rename`, or discarding the documents as test data. Either choice must be agreed
       before Stage 4, and adds a migration stage.
     - **`users` is non-empty** → note the `_id` type for the `ref: 'User'` declaration and
       continue; nothing else changes.
  4. Do not create, drop, write or index anything.
- **Acceptance criteria:**
  - [ ] The resolved database name is recorded.
  - [ ] Document counts for `events`, `contacts`, `employees` and `users` are recorded.
  - [ ] The existing index list for each of the four collections is recorded.
  - [ ] For any non-empty collection, one sample document's field names are recorded.
  - [ ] An explicit go / stop decision is written down.
- **Validation:** the recorded output itself. No build or test runs in this stage.
- **Expected outcome:** either a written confirmation that the collections are empty and the
  plan proceeds unchanged, or a written blocker describing the pre-existing data.
- **Risks and mitigations:** *Risk* — an exploratory script accidentally writes to the
  shared Atlas cluster. *Mitigation* — use read-only operations only (`countDocuments`,
  `findOne`, `getIndexes`); never call `create`, `insert`, `update`, `delete`, `drop` or
  `createIndex`; keep the script outside the repository so it cannot be committed.
- **Rollback:** nothing to roll back.
- **Do not:** do not write any model, route or schema file in this stage; do not run the
  seed script; do not create indexes; do not paste any part of `DB_HOST` into a file, a log
  or a commit message.

---

### Stage 1 — Add dependencies, scripts, and a proven test harness

- **Goal:** `zod` and `mongodb-memory-server` are declared in `server/package.json` and in
  the lockfile's `server` importer, `test` and `seed` scripts exist, and a single trivial
  integration test proves the in-memory MongoDB harness works end to end.
- **Requirements:** REQ-028, REQ-029; enabling for REQ-001 (Zod availability).
- **Depends on:** Stage 0 (go decision).
- **Areas affected:** `server/package.json`, `pnpm-lock.yaml`, root `package.json`
  (optional convenience script), new `server/test/` directory.
- **Changes:**
  1. From the repository root: `pnpm --filter server add zod` and
     `pnpm --filter server add -D mongodb-memory-server`. **Do not hand-edit
     `server/package.json` or `pnpm-lock.yaml`** — let pnpm write them (`AGENTS.md:22-25`).
  2. Verify the `server:` importer block in `pnpm-lock.yaml` now lists `zod` under
     `dependencies` and `mongodb-memory-server` under `devDependencies`. This is the check
     that closes the stale-symlink trap described in the report's *Findings*: `zod` and
     `mongodb-memory-server` already exist as orphan symlinks under `server/node_modules/`
     from an earlier install that was never reflected in `server/package.json`.
  3. Add to `server/package.json` scripts: `"test": "node --test"` (extend with a test
     directory glob once the layout is settled) and
     `"seed": "node src/shared/db/seed.ts"`. Optionally add `"test:server": "pnpm --filter
     server test"` to the root `package.json` alongside the existing `dev:*` / `build:*`
     scripts.
  4. Create `server/test/helpers/mongo.ts` (or the equivalent the implementer settles on):
     starts a `MongoMemoryServer`, takes `getUri()`, connects Mongoose to it, exposes
     `clearCollections()` and `stop()`. It **must build its own connection string and must
     never read `DB_HOST` or import `shared/config/env.ts`.** Add a guard inside the helper
     that throws if the resolved connection host is not the in-memory instance.
  5. Create `server/test/harness.test.ts` — one test that starts the harness, writes and
     reads a document through an ad-hoc Mongoose model, clears, and tears down. This is the
     spike that de-risks the binary download and the Mongoose 9 connection lifecycle.
  6. Confirm `server/tsconfig.json`'s `include` covers whatever directory the tests live in,
     or that they are deliberately excluded from the build. Decide this now — `strict`,
     `noUnusedLocals` and `noUnusedParameters` are on, so test files inside `include` must
     type-check cleanly.
- **Acceptance criteria:**
  - [ ] `server/package.json` lists `zod` in `dependencies` and `mongodb-memory-server` in
        `devDependencies`.
  - [ ] The `server:` importer in `pnpm-lock.yaml` lists both, and the lockfile change is
        staged for commit.
  - [ ] `pnpm --filter server test` runs the harness test and it passes.
  - [ ] The harness file contains no reference to `DB_HOST` or to `shared/config/env`.
  - [ ] `pnpm --filter server build` passes.
- **Validation:**
  `pnpm install` → `pnpm --filter server test` → `pnpm --filter server build`; then
  `grep -rn "DB_HOST" server/test/` returns nothing.
- **Expected outcome:** a green harness test and two correctly declared dependencies.
- **Risks and mitigations:** *Risk* — `mongodb-memory-server` cannot download its binary.
  *Mitigation* — this stage exists precisely to surface that early; if it fails, raise it
  before writing any tests. A cached binary already appears under
  `server/node_modules/.cache`. *Risk* — the test helper is later edited to read `DB_HOST`
  and truncates the shared Atlas cluster. *Mitigation* — the in-helper host assertion.
- **Rollback:** `git checkout` the two manifests and delete `server/test/`; rerun
  `pnpm install`.
- **Do not:** do not hand-edit the lockfile; do not add a test framework (`vitest`, `jest`,
  `mocha`) — Node 24 ships `node --test` and the committed design chose it; do not point any
  test at `DB_HOST`; do not remove the root `@mui/x-date-pickers` / `zustand` entries in this
  change — they are client-side cleanup owned by the OpenSpec change, not by this server work.

---

### Stage 2 — Shared HTTP foundation and application wiring

- **Goal:** One place shapes every error response, one helper validates every request part,
  and `createApp()` uses both while keeping `/api/health` working and the 404/error handlers
  last.
- **Requirements:** REQ-001, REQ-002, REQ-003, REQ-004, REQ-029.
- **Depends on:** Stage 1.
- **Areas affected:** new `server/src/shared/http/`; modified `server/src/app.ts`;
  new tests under `server/test/`.
- **Changes:**
  1. `server/src/shared/http/error-envelope.ts` — an `AppError extends Error` carrying
     `status: number`, `code: string`, `message: string`, plus factory helpers for at least
     `VALIDATION_ERROR` (400), `NOT_FOUND` (404), `UNKNOWN_PARTICIPANT` (400) and
     `INTERNAL_ERROR` (500). Plain class fields only — **no parameter properties**, they are
     non-erasable TypeScript and the dev server runs native type stripping.
  2. `server/src/shared/http/validate.ts` — a generic helper that `safeParse`s a request
     part against a Zod schema, returns the parsed data on success, and throws the
     `VALIDATION_ERROR` app error carrying a user-facing message derived from the first
     issue on failure. It must **return** a new object and never assign back to `req.query`,
     which is a read-only getter in Express 5.
  3. `server/src/shared/http/error-middleware.ts` — an `ErrorRequestHandler` that maps, in
     order: `AppError` → `{ error: { code, message } }` at `error.status`; Mongoose
     `CastError` and `ValidationError` → 400 with a user-facing message; an error carrying a
     numeric `status`/`statusCode` in the 4xx range (for example body-parser's 413) → that
     status with a safe generic message; anything else → 500 with a **fixed** generic message.
     Log the real error server-side only. **Never** include `stack`, a driver message, or any
     part of the connection string in the response.
  4. `server/src/app.ts` — import and use `errorMiddleware` in place of the current inline
     handler (`app.ts:27-41`); change the catch-all 404 body (`app.ts:20-25`) to the same
     `{ error: { code: 'NOT_FOUND', message } }` envelope; leave `helmet`, `cors`, `morgan`,
     the body parsers and `/api/health` exactly as they are; leave a clearly marked insertion
     point between `/api/health` and the 404 handler where Stages 3 and 5 mount their routers.
  5. Tests: `/api/health` still returns `{ status: 'ok' }`; an unknown route returns 404 in
     the envelope; a deliberately thrown `AppError` returns its status and code; a
     deliberately thrown generic `Error` returns 500 with the fixed message and **no** `stack`
     key in either `NODE_ENV`.
- **Acceptance criteria:**
  - [ ] Every error response body from the app matches `{ error: { code, message } }` exactly.
  - [ ] No response body contains a `stack` key, a Mongoose/driver message, or a
        `DB_HOST` fragment, in any `NODE_ENV`.
  - [ ] A Mongoose `CastError` reaching the middleware produces HTTP 400, not 500.
  - [ ] `GET /api/health` returns `{ status: 'ok' }` with status 200.
  - [ ] The 404 handler and the error middleware are the last two `app.use` calls in
        `createApp()`.
  - [ ] Every relative import in the new files carries the `.ts` extension.
- **Validation:** `pnpm --filter server test` (the new envelope tests) and
  `pnpm --filter server build`; then start the server with `pnpm dev:server` and confirm
  `GET /api/health` and one unknown route by hand.
- **Expected outcome:** the application behaves as before for `/api/health`, and every
  failure path now produces the shared envelope.
- **Risks and mitigations:** *Risk* — the error middleware is registered before the 404
  handler, so unmatched routes never reach the 404. *Mitigation* — the ordering acceptance
  criterion plus the unknown-route test. *Risk* — non-erasable syntax (parameter properties,
  enums) breaks `node --watch src/main.ts` while still compiling under `tsc`. *Mitigation* —
  boot the dev server once in this stage, not only at the end.
- **Rollback:** revert `server/src/app.ts` and delete `server/src/shared/http/`. Nothing
  else depends on it yet.
- **Do not:** do not change `helmet`, `cors`, `morgan`, the JSON body limit, or
  `/api/health`; do not add a new environment variable (`server/AGENTS.md:21` — `env.ts` is
  the only reader and nothing here needs one); do not swallow errors in the middleware — log
  the real one server-side; do not use `enum`, parameter properties or decorators.

---

### Stage 3 — Directory module: person models and the contacts/employees read API

- **Goal:** `GET /api/contacts` and `GET /api/employees` return searchable, sorted, capped,
  status-filtered person summaries from the existing `contacts` and `employees` collections,
  with `canHostEvents` filtering available on employees.
- **Requirements:** REQ-003, REQ-005, REQ-006, REQ-007, REQ-008, REQ-009, REQ-010, REQ-011,
  REQ-029.
- **Depends on:** Stage 2.
- **Areas affected:** new `server/src/modules/directory/`; two lines added to
  `server/src/app.ts`; new tests.
- **Changes:**
  1. `person.schema.ts` — a `createPersonSchema(collectionName: string)` factory returning a
     Mongoose schema with `firstName` (String, required, trimmed), `lastName` (String,
     required, trimmed), `email` (String, optional, trimmed, lowercased), `status` (String,
     one of `'active' | 'inactive'`, default `'active'`, indexed), `{ timestamps: true }`
     and an explicit `{ collection: collectionName }` binding. Add a `fullName` virtual and
     enable virtuals for `toJSON`/`toObject`. Add a `{ lastName: 1, firstName: 1 }` index for
     the sorted read. Use a `const` object or a union type for the status values — **not an
     `enum`**.
  2. `contact.model.ts` — `createPersonSchema('contacts')`, exported as `Contact`.
  3. `employee.model.ts` — `createPersonSchema('employees')` extended with `position`
     (String, optional, trimmed), `department` (String, optional, trimmed) and
     `canHostEvents` (Boolean, default `true`), exported as `Employee`. Consider an index on
     `{ canHostEvents: 1, status: 1 }` only if Stage 0 showed meaningful volume; otherwise
     document why it was deferred.
  4. Consider a unique partial index on `email`
     (`{ unique: true, partialFilterExpression: { email: { $type: 'string' } } }`) so the
     Stage 7 upsert-by-email seed cannot create duplicates. Building it is instant against
     empty collections; record the decision either way.
  5. `person-summary.ts` — maps a person document to
     `{ id, firstName, lastName, fullName, email?, status }`, with `id` as a **string**.
     The employee variant additionally carries `position?`, `department?` and
     `canHostEvents`.
  6. `directory.schemas.ts` — Zod schemas for the list queries: `search` (trimmed, optional,
     **maximum length bounded**), `limit` (coerced integer, positive, maximum 100, optional),
     `status` (optional), and, for employees only, `canHostEvents` (optional boolean coerced
     from the string `'true'`/`'false'` — Express 5's simple query parser yields strings).
  7. `directory.service.ts` — a shared `listPeople(model, query)` that builds the filter
     (default `status: 'active'` unless overridden; `$or` on `firstName`/`lastName` with a
     **regex-escaped**, case-insensitive term when `search` is present; `canHostEvents` when
     supplied), sorts by `{ lastName: 1, firstName: 1 }`, limits to `query.limit ?? 50`, and
     maps through the summary function. Export `listContacts` and `listEmployees`.
  8. `directory.routes.ts` — `GET /contacts` and `GET /employees`, each validating
     `req.query` through the shared helper and returning `{ contacts: [...] }` /
     `{ employees: [...] }`. Thin async handlers; no `try/catch` — Express 5 forwards
     rejections to the error middleware.
  9. `server/src/app.ts` — `app.use('/api', directoryRouter)` at the marked insertion point,
     above the 404 handler.
  10. Tests: search matches a first name; search matches a last name; search is
      case-insensitive; a search containing regex metacharacters (`.*`) is treated literally;
      results are sorted by last then first name; the default cap applies; `limit` above the
      maximum returns 400; a non-active person is excluded by default; `canHostEvents=true`
      filters employees; the response carries `fullName`; the employee response carries
      `position`, `department` and `canHostEvents`.
- **Acceptance criteria:**
  - [ ] Both models are bound to `contacts` / `employees` by an explicit `collection` option.
  - [ ] No model, query or write references the `users` collection anywhere in the package.
  - [ ] `GET /api/contacts?search=<term>` matches on either name part, case-insensitively.
  - [ ] A `search` value containing regex metacharacters matches literally.
  - [ ] Results are sorted by last name then first name and capped.
  - [ ] Non-active people are excluded unless an explicit status filter asks for them.
  - [ ] `GET /api/employees?canHostEvents=true` returns only eligible employees.
  - [ ] Each returned `id` is a string.
  - [ ] The directory router is mounted above the 404 handler.
- **Validation:** `pnpm --filter server test`, `pnpm --filter server build`, plus a manual
  `curl` of both endpoints once Stage 7 has seeded data.
- **Expected outcome:** two working read endpoints that can populate the attendee and host
  selectors, and two models the events module can validate participants against.
- **Risks and mitigations:** *Risk* — unescaped `search` allows a ReDoS or an unintended
  match. *Mitigation* — escape metacharacters and bound the term length; both are covered by
  named tests. *Risk* — `canHostEvents` arrives as the string `'true'` and is truthy for
  `'false'` too. *Mitigation* — coerce explicitly in the Zod schema and test the `false` case.
  *Risk* — automatic pluralization happens to produce the right collection name, hiding a
  missing explicit binding. *Mitigation* — the explicit-binding acceptance criterion.
- **Rollback:** delete `server/src/modules/directory/` and remove the one `app.use` line.
- **Do not:** do not add create/update/delete endpoints for people — read-only only; do not
  model, read or write `users`; do not add pagination (search plus a cap is the agreed
  scope); do not return password, credential or any field not listed above; do not duplicate
  the person schema across two files — use the factory.

---

### Stage 4 — Event persistence and request schemas

- **Goal:** The `Event` model and its Zod request schemas exist and encode every rule the
  API must enforce, including the FullCalendar-driven ISO-offset tolerance, before any event
  endpoint is wired.
- **Requirements:** REQ-012, REQ-013, REQ-014, REQ-015, REQ-017, REQ-018, REQ-026, REQ-029.
- **Depends on:** Stage 3 (the service in Stage 6 validates participants against `Contact`
  and `Employee`; the schemas themselves depend only on Stage 1).
- **Areas affected:** new `server/src/modules/events/event.model.ts` and
  `event.schemas.ts`; new schema tests.
- **Changes:**
  1. `event.model.ts` — a schema bound to `{ collection: 'events' }` with:
     - `title`: String, required, trimmed;
     - `startAt`: Date, required;
     - `endAt`: Date, required;
     - `attendeeIds`: `[{ type: Schema.Types.ObjectId, ref: 'Contact' }]`, default `[]`,
       with a **de-duplicating setter**;
     - `hostIds`: `[{ type: Schema.Types.ObjectId, ref: 'Employee' }]`, default `[]`, with
       the same setter;
     - `createdByUserId`, `updatedByUserId`: `Schema.Types.ObjectId`, `ref: 'User'`,
       default `null`;
     - `{ timestamps: true }`.
  2. Declare the compound index `{ startAt: 1, endAt: 1 }` for the range read.
  3. Enforce `endAt > startAt` at the model layer as defence in depth. Prefer a path
     `validate` or a schema-level validator that produces a Mongoose `ValidationError` over
     a `pre('validate')` hook that throws a plain `Error` — Stage 2's middleware maps
     `ValidationError` to 400, whereas a plain `Error` becomes a 500. If a `pre` hook is
     used, remember that **Mongoose 9 pre-middleware no longer receives `next()`**; use an
     async function or throw.
  4. `event.schemas.ts` —
     - `objectIdString`: `z.string().regex(/^[0-9a-fA-F]{24}$/)` with a user-facing message.
     - `eventIdParamSchema`: `{ id: objectIdString }`.
     - `listEventsQuerySchema`: `from` and `to`, both **`z.iso.datetime({ offset: true })`**,
       transformed to `Date`. This is mandatory: FullCalendar's `formatIso` emits the
       browser's numeric UTC offset, and the plain `z.iso.datetime()` form rejects it,
       which would make the calendar fail for every non-UTC user. Refine that `to > from`
       and that `to - from` does not exceed the maximum span (366 days).
     - `eventBodySchema`: `title` (`z.string().trim().min(1)`), `startAt` and `endAt`
       (`z.iso.datetime({ offset: true })`), `attendeeIds` and `hostIds`
       (`z.array(objectIdString).default([])` transformed to a de-duplicated array), plus a
       refinement that `endAt > startAt` reporting on the `endAt` path. The schema must
       **strip unknown keys** — do not use `.passthrough()` — so `createdByUserId` and
       `updatedByUserId` can never arrive from a request body.
  5. Tests for the schemas: `Z` bounds accepted; `+03:00` bounds accepted and yielding the
     correct instants; a local-naive string rejected; `to == from` rejected; `to < from`
     rejected; an over-long span rejected; whitespace-only `title` rejected;
     `endAt == startAt` rejected; duplicate ids collapsed; a body containing
     `createdByUserId` parses without that key present in the output.
- **Acceptance criteria:**
  - [ ] The model is bound to `events` by an explicit `collection` option and declares
        `title`, `startAt`, `endAt`, `attendeeIds`, `hostIds`, `createdByUserId`,
        `updatedByUserId` and timestamps.
  - [ ] Setting `attendeeIds` or `hostIds` with a repeated identifier stores one entry.
  - [ ] Saving a document with `endAt <= startAt` fails at the model layer.
  - [ ] The `{ startAt: 1, endAt: 1 }` index is declared.
  - [ ] `listEventsQuerySchema` accepts `2026-08-01T00:00:00+03:00` and rejects
        `2026-08-01T00:00:00` (no zone).
  - [ ] `eventBodySchema` drops unknown keys, including `createdByUserId`.
  - [ ] No `enum`, parameter property or decorator is used.
- **Validation:** `pnpm --filter server test` (schema and model tests) and
  `pnpm --filter server build`.
- **Expected outcome:** the event data rules are encoded and independently proved before any
  endpoint exists.
- **Risks and mitigations:** *Risk* — `z.iso.datetime()` is copied from the prior `dist/`
  output without `offset: true`, silently breaking every non-UTC browser. *Mitigation* — the
  named acceptance criterion and the `+03:00` test. *Risk* — a `pre('validate')` hook that
  throws surfaces as a 500. *Mitigation* — prefer a Mongoose validator; Stage 2's
  `ValidationError` mapping is the backstop. *Risk* — Mongoose 9's stricter query-filter and
  ObjectId typing produces confusing compile errors. *Mitigation* — build after each file
  rather than at the end of the stage.
- **Rollback:** delete the two files and their tests. No endpoint depends on them yet.
- **Do not:** do not copy `server/dist/modules/events/event.schemas.js` verbatim — it
  contains the verified `z.iso.datetime()` defect and the superseded `name`/`startsAt`/
  `endsAt` names; do not accept `createdByUserId` or `updatedByUserId` from a request body;
  do not make `from`/`to` optional; do not add an `allDay` field — all-day events are a
  deferred product decision.

---

### Stage 5 — Event calendar read API

- **Goal:** `GET /api/events?from=&to=` returns every event overlapping the half-open period,
  sorted, with participants resolved in a bounded number of queries, in a shape the client
  can map to FullCalendar's `EventInput` without a second request.
- **Requirements:** REQ-003, REQ-016, REQ-017, REQ-018, REQ-019, REQ-020, REQ-026, REQ-029.
- **Depends on:** Stage 4 (model and schemas), Stage 3 (Contact and Employee models for
  participant resolution).
- **Areas affected:** new `server/src/modules/events/event.service.ts` (list portion) and
  `event.routes.ts`; two lines added to `server/src/app.ts`; new tests.
- **Changes:**
  1. In `event.service.ts`, implement `listEvents({ from, to })`:
     - query `Event.find({ startAt: { $lt: to }, endAt: { $gt: from } }).sort({ startAt: 1 })`;
     - collect every distinct attendee id and host id **across the whole result set**, then
       run exactly two `find({ _id: { $in: [...] } })` calls — one against `Contact`, one
       against `Employee` — and build lookup maps. Do **not** resolve per event; that is an
       N+1 against a hosted cluster.
     - map each event to `{ id, title, startAt, endAt, attendees, hosts }` where `id` is
       `_id.toString()`, `startAt`/`endAt` are `toISOString()` (UTC, `Z`-suffixed), and each
       participant is `{ id, firstName, lastName, fullName }`;
     - **drop** any participant id with no matching person rather than failing the request,
       preserving the stored order of the remaining ones;
     - do not include `createdByUserId` or `updatedByUserId` in the read shape.
  2. In `event.routes.ts`, add `GET /` — validate `req.query` through the shared helper, call
     the service, respond `{ events }`. Thin async handler, no `try/catch`.
  3. `server/src/app.ts` — `app.use('/api/events', eventsRouter)` at the marked insertion
     point, above the 404 handler and above (or beside) the directory mount.
  4. Tests, all against the in-memory harness through the real app:
     - an event fully inside the range is returned;
     - an event fully before and one fully after are not;
     - an event straddling `from` is returned; one straddling `to` is returned;
     - an event containing the whole range is returned;
     - an event ending exactly at `from` is **excluded**;
     - an event starting exactly at `to` is **excluded**;
     - an empty period returns `{ events: [] }` with status 200;
     - results are ordered ascending by `startAt`;
     - **`from`/`to` carrying `+03:00` are accepted and select the correct events** — the
       FullCalendar regression test;
     - a missing `from` or `to` returns 400; `to <= from` returns 400; an over-long span
       returns 400;
     - `id` is a 24-character hex **string**, `startAt`/`endAt` end in `Z`;
     - an event holding a participant id with no matching person is still returned, with
       that person absent from the list;
     - the response contains no `createdByUserId` / `updatedByUserId`.
- **Acceptance criteria:**
  - [ ] The overlap semantics are exactly `startAt < to AND endAt > from`, with the boundary
        cases above proved by tests.
  - [ ] A request whose bounds carry a numeric UTC offset succeeds and selects correctly.
  - [ ] Participants are resolved in at most two queries regardless of how many events are
        returned.
  - [ ] Every returned `id` is a string; every instant is an ISO UTC string.
  - [ ] A dangling participant reference does not fail the request.
  - [ ] Audit fields are absent from the response.
  - [ ] The events router is mounted above the 404 handler.
- **Validation:** `pnpm --filter server test`, `pnpm --filter server build`, and a manual
  `curl` with both a `Z` range and a `+03:00` range once Stage 7 has seeded data.
- **Expected outcome:** the calendar's only read pattern works and is provably
  FullCalendar-compatible.
- **Risks and mitigations:** *Risk* — per-event participant resolution reintroduces N+1.
  *Mitigation* — the explicit two-query acceptance criterion; assert the query count in a
  test if the harness makes that easy, otherwise review the code path. *Risk* — the boundary
  semantics are implemented as `<=` / `>=` and double-count events at period edges.
  *Mitigation* — the two exclusion tests. *Risk* — `id` is serialized as a BSON ObjectId
  object and FullCalendar's String refiner mangles it. *Mitigation* — the string assertion.
- **Rollback:** remove the `GET /` handler and the `listEvents` function, and remove the one
  `app.use` line. Stage 4's model and schemas can stay.
- **Do not:** do not make `from`/`to` optional or add an "all events" mode; do not return
  raw Mongoose documents; do not `populate()` — it returns full documents and hides the
  drop-unresolvable behaviour; do not add pagination; do not reshape the payload into
  FullCalendar's native `EventInput` — that mapping belongs to the client.

---

### Stage 6 — Event write API: create, update, delete

- **Goal:** `POST /api/events`, `PATCH /api/events/:id` and `DELETE /api/events/:id` commit
  event changes with full participant validation, wholesale participant replacement, and
  correct status codes.
- **Requirements:** REQ-013, REQ-014, REQ-021, REQ-022, REQ-023, REQ-024, REQ-025, REQ-026,
  REQ-029.
- **Depends on:** Stage 5.
- **Areas affected:** `server/src/modules/events/event.service.ts`, `event.routes.ts`;
  new tests.
- **Changes:**
  1. `assertPeopleExist(ids: string[], model)` in the service — short-circuits on an empty
     array **without querying**; otherwise runs one `find({ _id: { $in } }, { _id: 1 })` and
     throws the `UNKNOWN_PARTICIPANT` app error if any submitted id is missing. Returns the
     `ObjectId[]`.
  2. `createEvent(body)` — validate both participant sets, then `Event.create` with `title`,
     `new Date(startAt)`, `new Date(endAt)`, the validated id arrays, and
     `createdByUserId: null` / `updatedByUserId: null` **constructed server-side**, never
     spread from the request. Return the created event in the same read shape Stage 5
     produces (reuse the mapper).
  3. `updateEvent(id, body)` — validate both participant sets first, then replace `title`,
     `startAt`, `endAt`, `attendeeIds` and `hostIds` **wholesale**. Prefer
     `findOneAndUpdate({ _id: id }, ..., { new: true, runValidators: true })` over
     read-modify-`save()` so a concurrent delete cannot resurrect the document. Throw
     `NOT_FOUND` when nothing matched. Leave `createdByUserId` untouched and keep
     `updatedByUserId` at `null`.
  4. `deleteEvent(id)` — `findOneAndDelete`; throw `NOT_FOUND` when nothing matched.
  5. Routes: `POST /` → 201 `{ event }`; `PATCH /:id` → 200 `{ event }`;
     `DELETE /:id` → 204 with no body. Each validates params and/or body through the shared
     helper first. Thin async handlers, no `try/catch`.
  6. Tests:
     - *create* — valid body → 201 and the event is retrievable through a containing range;
       whitespace-only `title` → 400; `endAt == startAt` → 400; `endAt < startAt` → 400;
       an unknown attendee id → 400 **and the collection is unchanged**; an unknown host id
       → 400; duplicate ids collapse to one stored entry; empty participant arrays accepted;
       a body containing `createdByUserId` does not write it;
     - *update* — participants replaced wholesale (removed gone, added present); title and
       times updated; an unknown-but-valid event id → 404; a malformed id → 400; an unknown
       participant id → 400 **and the event unchanged**; duplicate ids collapse;
     - *delete* — 204 with an empty body; the event no longer appears in a range query; an
       unknown id → 404; a malformed id → 400;
     - *envelope* — every one of the above failures returns `{ error: { code, message } }`
       and no `stack`.
- **Acceptance criteria:**
  - [ ] `POST` returns 201 with the created event in the read shape.
  - [ ] `PATCH` replaces `attendeeIds` and `hostIds` wholesale — a previously assigned
        person absent from the request is no longer assigned.
  - [ ] `DELETE` returns 204 with an empty body.
  - [ ] A valid-but-unmatched id returns 404; a malformed id returns 400.
  - [ ] An unknown participant id returns 400 and leaves the `events` collection unchanged.
  - [ ] Duplicate participant ids in a request produce exactly one stored assignment.
  - [ ] `createdByUserId` and `updatedByUserId` are written as `null` by the service and are
        never read from the request body.
  - [ ] `assertPeopleExist` performs no query for an empty array.
- **Validation:** `pnpm --filter server test`, `pnpm --filter server build`, then a manual
  create → range-fetch → update → delete round trip against the seeded database.
- **Expected outcome:** the full event lifecycle works through the API with every rule the
  PRD states enforced server-side.
- **Risks and mitigations:** *Risk* — mass assignment through spreading `req.body` into the
  document. *Mitigation* — construct the document field by field; the Zod schema strips
  unknown keys as a second line of defence; a named test covers it. *Risk* — read-modify-save
  resurrects a concurrently deleted event. *Mitigation* — `findOneAndUpdate`. *Risk* — an
  unknown-participant rejection still creates the event because validation runs after the
  write. *Mitigation* — validate participants before any write, proved by the
  collection-unchanged assertions.
- **Rollback:** remove the three handlers and the three service functions; the list endpoint
  from Stage 5 keeps working.
- **Do not:** do not add incremental participant endpoints (`POST /events/:id/attendees`) —
  they contradict "participant edits persist only on save"; do not spread `req.body` into a
  Mongoose document; do not enforce `canHostEvents` at write time (recorded as an open
  decision — adding it later only tightens); do not add optimistic concurrency; do not
  return a body from `DELETE`.

---

### Stage 7 — Seed script for contacts and employees

- **Goal:** A safe, idempotent script populates `contacts` and `employees` with enough
  variety to exercise every directory filter, so the selectors and the manual verification
  in Stage 9 have data to work with.
- **Requirements:** REQ-027, REQ-007.
- **Depends on:** Stage 3.
- **Areas affected:** new `server/src/shared/db/seed.ts`; `server/package.json` `seed` script
  (added in Stage 1).
- **Changes:**
  1. `seed.ts` — connect through the existing `connectToMongo()` helper, log the resolved
     database name **before writing anything**, upsert each seed person by `email`
     (`updateOne({ email }, { $set: seed }, { upsert: true })`), log the counts, then
     `disconnectFromMongo()`.
  2. Seed content must include, at minimum: several active contacts; several active
     employees with `canHostEvents: true`; **at least one employee with
     `canHostEvents: false`**; **at least one person with `status: 'inactive'`**; varied last
     names so sorting is observable; and at least one pair sharing a first-name prefix so
     search narrowing is observable. Populate `position` and `department` on employees.
  3. Write to `contacts` and `employees` **only**. Never touch `events` or `users`.
  4. The script must be safe to run repeatedly against the shared Atlas cluster: idempotent
     upserts, never `deleteMany`, never `drop`, never `collection.drop()`.
- **Acceptance criteria:**
  - [ ] Running the seed twice leaves identical document counts in `contacts` and
        `employees`.
  - [ ] The seed set contains at least one `canHostEvents: false` employee and at least one
        non-active person.
  - [ ] The script writes only to `contacts` and `employees`; `events` and `users` counts are
        unchanged after a run.
  - [ ] The resolved database name is logged before the first write.
  - [ ] The script exits cleanly and disconnects.
- **Validation:** `pnpm --filter server seed` twice; then `GET /api/contacts`,
  `GET /api/employees` and `GET /api/employees?canHostEvents=true` and confirm the filters
  behave; then confirm `users` and `events` counts are unchanged.
- **Expected outcome:** a small, realistic directory that makes every Stage 3 filter
  observable by hand.
- **Risks and mitigations:** *Risk* — the script is run against the shared Atlas cluster and
  pollutes a real database. *Mitigation* — idempotent upserts, only two collections, the
  database name logged before writing, and no destructive operation anywhere in the file.
  *Risk* — repeated runs create duplicates because `email` is not unique. *Mitigation* — the
  Stage 3 partial unique index on `email`, or an accepted, documented risk if that index was
  deferred.
- **Rollback:** delete the seeded documents by their known emails, and delete the script.
- **Do not:** do not seed `events` (the write endpoints exist for that); do not seed or touch
  `users`; do not use `deleteMany` or `drop` anywhere in the script; do not run the seed
  against the in-memory test instance as a substitute for test fixtures.

---

### Stage 8 — Publish the contract and reconcile the OpenSpec change

- **Goal:** The client implementer can build the Events page against the names and shapes
  that were actually implemented, and the project's own OpenSpec change no longer carries
  superseded field names.
- **Requirements:** REQ-030.
- **Depends on:** Stages 5, 6, 7 (the contract must be final before it is published).
- **Areas affected:** `openspec/changes/add-events-page/design.md`,
  `openspec/changes/add-events-page/tasks.md`, `README.md`.
- **Changes:**
  1. In `openspec/changes/add-events-page/design.md`, update the field names in the storage
     decision (`design.md:37-43`) and the API surface block (`design.md:87-98`) from
     `name` / `startsAt` / `endsAt` to `title` / `startAt` / `endAt`, and add the
     `createdByUserId` / `updatedByUserId`, `position`, `department`, `canHostEvents` and
     `status` fields to the model descriptions. Add a short note recording **why** the ISO
     range parameters must accept a numeric offset, citing FullCalendar's `formatIso`
     behaviour — this is the detail most likely to be lost.
  2. In `openspec/changes/add-events-page/tasks.md`, mark the server tasks this change
     completes and correct the field names in the remaining task text, per
     `AGENTS.md:44-46` ("keep task status aligned with completed work"). Do not mark client
     tasks complete.
  3. Add an API contract section — routes, query parameters, request bodies, response
     shapes, error codes, and the **API → FullCalendar `EventInput` mapping table** from the
     research report — where the client implementer will find it. The OpenSpec design
     document is the natural home; a short pointer from `README.md` is enough.
  4. In `README.md`, document the new `pnpm --filter server test` and
     `pnpm --filter server seed` commands, note that `mongodb-memory-server` downloads a
     binary on first run, and state plainly that **the API is unauthenticated, runs against
     a shared Atlas cluster, and must not be exposed beyond local development** until the
     authorization change lands.
  5. Prefer the project's `/opsx:*` commands for OpenSpec edits where they apply
     (`CLAUDE.md`), rather than editing the files by hand.
- **Acceptance criteria:**
  - [ ] Every field name in `design.md` matches what the code implements.
  - [ ] The API surface block lists all six endpoints with their actual verbs and parameters.
  - [ ] The FullCalendar mapping table is published and includes the `id`-must-be-a-string
        and the offset-tolerance notes.
  - [ ] `tasks.md` server task statuses reflect what was actually built; no client task is
        marked complete.
  - [ ] `README.md` documents `test` and `seed` and carries the unauthenticated-API warning.
- **Validation:** re-read `design.md` against the implemented `event.model.ts`,
  `event.schemas.ts` and `directory.service.ts` and confirm every field name and every
  parameter matches. Run `pnpm --filter server build` to confirm nothing was broken.
- **Expected outcome:** a client implementer starting the Events page finds a contract that
  matches the running server.
- **Risks and mitigations:** *Risk* — the documentation drifts again as the client change
  lands. *Mitigation* — the contract lives in the OpenSpec change that owns both halves, not
  in a separate file. *Risk* — editing `tasks.md` marks client work complete by accident.
  *Mitigation* — the explicit acceptance criterion.
- **Rollback:** revert the documentation commits. No runtime behaviour is affected.
- **Do not:** do not edit anything under `.ai_toolkit/` (it is a submodule, `AGENTS.md:14-15`);
  do not archive the OpenSpec change — the client half is still outstanding; do not delete
  the existing capability specs; do not create a parallel API documentation file that will
  drift from the OpenSpec change.

---

### Stage 9 — Final verification

- **Goal:** Prove the whole change against the definition of done, on a clean install, and
  confirm the blast radius is exactly what was intended.
- **Requirements:** REQ-002, REQ-003, REQ-007, REQ-028, REQ-029 and end-to-end confirmation
  of all others.
- **Depends on:** Stages 1–8.
- **Areas affected:** none — verification only.
- **Changes:**
  1. From a clean state: `pnpm install`, then `pnpm --filter server build`, then
     `pnpm --filter server test`. All three must pass with no diagnostics.
  2. `grep -rn "DB_HOST" server/test/` returns nothing; `grep -rn "users" server/src/`
     returns no model, query or write against that collection.
  3. Start `pnpm dev:server` and walk the full happy path by hand against the seeded
     database: `GET /api/health`; `GET /api/contacts?search=<partial>`;
     `GET /api/employees?canHostEvents=true`; `POST /api/events`; `GET /api/events` over a
     range that contains it, **once with `Z` bounds and once with `+03:00` bounds**;
     `PATCH /api/events/:id` changing participants; `GET /api/events` again to confirm the
     change; `DELETE /api/events/:id`; `GET /api/events` to confirm removal.
  4. Walk the failure paths by hand: an unknown route; a malformed event id; a valid but
     unmatched event id; a blank title; `endAt <= startAt`; an unknown participant id; a
     missing `from`. Confirm every response body is exactly `{ error: { code, message } }`
     with no `stack`.
  5. Confirm `users` document count is unchanged from the Stage 0 reading and that only
     `contacts`, `employees` and `events` were written.
  6. Confirm `git status` shows changes only under `server/src/`, `server/test/`,
     `server/package.json`, `pnpm-lock.yaml`, `openspec/changes/add-events-page/`,
     `README.md`, and `specs/add-events-api/` — and **nothing** under `client/`,
     `.ai_toolkit/` or `server/dist/`.
- **Acceptance criteria:**
  - [ ] `pnpm --filter server build` passes with no diagnostics.
  - [ ] `pnpm --filter server test` passes with every named scenario present.
  - [ ] The manual happy path succeeds with both `Z` and `+03:00` range bounds.
  - [ ] Every manual failure path returns the shared envelope with no `stack`.
  - [ ] `users` is unchanged.
  - [ ] No file under `client/`, `.ai_toolkit/` or `server/dist/` is modified.
- **Validation:** the commands and manual walkthrough above.
- **Expected outcome:** a signed-off, reviewable server change with no unintended blast
  radius.
- **Risks and mitigations:** *Risk* — verification is performed against a warm local
  `node_modules` that hides a missing dependency declaration. *Mitigation* — reinstall from
  the lockfile before running the gate. *Risk* — manual steps are skipped because the tests
  pass. *Mitigation* — the manual paths cover exactly what the tests cannot: the real Atlas
  connection and the real dev-server startup under native type stripping.
- **Rollback:** n/a — verification only.
- **Do not:** do not claim any command passed that was not actually run; do not fix
  unrelated pre-existing issues found along the way — raise them separately.

---

## Cross-cutting concerns

### Testing

- Test level is **integration first**: routes → service → model → in-memory MongoDB, through
  the real Express app built by `createApp()`. Zod schema edge cases that would be awkward to
  reach through HTTP are covered by direct unit tests in Stage 4.
- The harness (Stage 1) must build its own connection string, must never read `DB_HOST` or
  import `shared/config/env.ts`, and must assert its own connection host. This is the single
  most important safety rule in the plan: the only configured database is a shared hosted
  Atlas cluster and the suite truncates collections.
- Tests live with the stage that owns the behaviour, not in a separate "add tests" stage.
- Named scenarios are enumerated per stage; the full catalogue is in the research report's
  *Testing and verification strategy*.
- The one scenario that must not be dropped: **range bounds carrying a numeric UTC offset**
  (Stage 5). It is the regression test for the defect found in the prior build output.

### Security and privacy

- All six endpoints are unauthenticated and three of them mutate data. This is out of scope
  by the PRD but is real exposure — Stage 8 must state it in `README.md`, and the API must
  not be exposed beyond local development.
- `createdByUserId` and `updatedByUserId` are constructed server-side and never read from a
  request body (Stages 4 and 6). The Zod write schema strips unknown keys as a second line
  of defence.
- Error responses never carry a stack trace, a raw driver message or any part of the
  connection string (Stage 2).
- Directory `search` input is regex-escaped and length-bounded (Stage 3).
- Every identifier is validated as a 24-hex string before it reaches a query, so operator
  injection through `$`-prefixed values is unreachable.
- The directory endpoints return personal data with no access control. Returning `email`,
  `position` and `department` is the planned default because the prompt names them as stored
  fields — this is flagged as an open decision in the report and should be settled before the
  client codes against it.
- `users` is never modelled, read or written (Stages 3, 7, 9).
- `.env` is never read, printed or committed.

### Performance and observability

- The range query is indexed on `{ startAt: 1, endAt: 1 }` and bounded by required `from`/
  `to` plus a maximum span, so it can never degenerate into a full collection scan.
- Participants are resolved in exactly two batched `$in` queries per response regardless of
  event count (Stage 5) — explicitly avoiding the N+1 pattern in the prior build output.
- Directory reads are sorted on an index, capped at 50 by default and 100 maximum. The
  unanchored case-insensitive regex cannot use the index; accepted at current volume and
  revisited with a text index if the directory grows.
- Observability is unchanged: `morgan` already logs every request, and the error middleware
  logs the real error server-side only. No metrics or tracing exist in the project and none
  are added.

### Accessibility

Not applicable — this change has no user interface. The PRD's accessibility-relevant
behaviour (dialogs, pickers, focus management) is entirely client-side and out of scope.

### Documentation

- Stage 8 owns all documentation: the OpenSpec design and task reconciliation, the published
  API contract with the FullCalendar mapping table, and the `README.md` updates for `test`,
  `seed` and the unauthenticated-API warning.
- Every stage's decisions that deviate from the plan must be recorded in that stage's commit
  message.
- `.ai_toolkit/` is a submodule and is never edited by this change.

### Data, compatibility, migration, and rollout

- **Data:** three collections gain their first schema and their first indexes beyond `_id`.
  No collection is created or dropped. Mongoose builds declared indexes on first connection,
  instantly against empty collections.
- **Migration:** none required if Stage 0 confirms the collections are empty. If it finds
  documents under the superseded `name`/`startsAt`/`endsAt` names, Stage 0 stops the plan and
  a migration stage is inserted before Stage 4.
- **Compatibility:** no deployed consumer; no existing client code calls these endpoints. The
  only existing contract changed is the shape of error responses, including the catch-all
  404 — deliberate, with no consumer to break.
- **Rollout:** server-only, single unit, no feature flag, no compatibility window. The seed
  runs once, manually.
- **Rollback:** revert the commits, `pnpm install` to restore the lockfile state, then delete
  any seeded or manually created documents and drop the declared indexes. The four
  collections predate this change and stay. Safe only while the database holds no real data.

---

## Requirements traceability

| Requirement | Covered by stage(s) | Verification |
| --- | --- | --- |
| REQ-001 Zod validation at the boundary | 2, 3, 4, 5, 6 | Validate helper unit behaviour + 400 responses in every endpoint test |
| REQ-002 Single error envelope, no internals | 2, 3, 5, 6, 9 | Envelope tests in Stage 2; per-endpoint failure assertions; manual failure walkthrough |
| REQ-003 Routers mounted under `/api` above 404/error | 2, 3, 5, 9 | Unknown-route test; `/api/health` test; endpoints reachable in tests and by hand |
| REQ-004 Mongoose `CastError`/`ValidationError` → 400 | 2, 4, 6 | Malformed-id tests return 400, not 500 |
| REQ-005 Contact model bound to `contacts` | 0, 3 | Explicit `collection` option; documents readable back; `fullName` virtual test |
| REQ-006 Employee model with `position`/`department`/`canHostEvents` | 0, 3 | Model test; employee response shape test |
| REQ-007 `users` untouched | 3, 7, 9 | `grep` for `users` in `src/`; document count unchanged from Stage 0 |
| REQ-008 `GET /api/contacts` search/sort/cap | 3 | Search, sort, cap and shape tests |
| REQ-009 `GET /api/employees` + `canHostEvents` filter | 3 | Filter test with an ineligible employee |
| REQ-010 Active-only by default | 3, 7 | Non-active person excluded test; seeded inactive person |
| REQ-011 Search escaped and bounded | 3 | Regex-metacharacter literal-match test; over-long term rejected |
| REQ-012 Event model fields and collection binding | 0, 4 | Model test; explicit `collection` option |
| REQ-013 `endAt > startAt` at both layers | 4, 6 | Schema unit tests; model save test; `POST`/`PATCH` 400 tests |
| REQ-014 No duplicate participants | 4, 6 | Schema de-duplication test; model setter test; create/update duplicate tests |
| REQ-015 Range index declared | 0, 4 | Index declaration asserted; `getIndexes()` after connect |
| REQ-016 Half-open overlap range read | 5 | Six boundary tests including both exclusions |
| REQ-017 Offset-bearing ISO bounds accepted | 4, 5, 9 | `+03:00` schema test; `+03:00` endpoint test; manual `+03:00` request |
| REQ-018 Range required, ordered, span-capped | 4, 5 | Missing-bound, `to <= from` and over-span 400 tests |
| REQ-019 FullCalendar-mappable read shape | 5, 8 | String-`id` and ISO-`Z` assertions; published mapping table |
| REQ-020 Dangling reference tolerated | 5 | Unresolvable-participant test |
| REQ-021 `POST` creates, returns 201 | 6 | Create test plus a containing-range fetch |
| REQ-022 `PATCH` replaces participants wholesale | 6 | Removed-gone / added-present test |
| REQ-023 `DELETE` returns 204 | 6 | Delete test plus a range fetch confirming removal |
| REQ-024 404 for unmatched id, 400 for malformed | 6 | Four tests across `PATCH` and `DELETE` |
| REQ-025 Unknown participant rejected, nothing written | 6 | 400 plus collection-unchanged assertions on create and update |
| REQ-026 Audit fields never client-settable or exposed | 4, 5, 6 | Schema strips the key; service constructs it; response-shape assertion |
| REQ-027 Idempotent seed | 7 | Two runs, identical counts; variety assertions |
| REQ-028 Test harness never reads `DB_HOST` | 1, 9 | In-helper host assertion; `grep` check |
| REQ-029 `pnpm --filter server build` passes | 1–9 | Run at the end of every stage and in Stage 9 |
| REQ-030 Contract published, OpenSpec reconciled | 8 | Field-by-field re-read of `design.md` against the code |

Every stage maps to at least one requirement: Stage 0 is enabling work for REQ-005/006/012/015;
Stages 1–9 each appear in the table above.

---

## Overall definition of done

- [ ] Stage 0's read-only findings are recorded and the go decision is written down.
- [ ] `zod` and `mongodb-memory-server` appear in `server/package.json` **and** in the
      `server:` importer of `pnpm-lock.yaml`, and the lockfile change is committed.
- [ ] `pnpm --filter server build` passes with no diagnostics from a clean install.
- [ ] `pnpm --filter server test` passes and includes every named scenario, including the
      `+03:00` range regression test.
- [ ] `GET /api/events?from&to` returns overlapping events with a string `id`, a `title`,
      ISO UTC `startAt`/`endAt` and resolved `attendees`/`hosts`, for both `Z` and
      offset-bearing bounds.
- [ ] `POST`, `PATCH /:id` and `DELETE /:id` complete a create → fetch → update → delete
      round trip, and reject a blank title, `endAt <= startAt`, an unknown participant and a
      malformed or unmatched id with the right status each time.
- [ ] `GET /api/contacts` and `GET /api/employees` return searchable, sorted, capped,
      active-only summaries, with `canHostEvents` filtering working on employees.
- [ ] Every error response is exactly `{ error: { code, message } }` with no `stack`, no
      driver text and no connection-string fragment, in every `NODE_ENV`.
- [ ] `createdByUserId` and `updatedByUserId` are stored as `null`, never accepted from a
      request body, and never present in a response.
- [ ] The seed script is idempotent, writes only to `contacts` and `employees`, and includes
      a `canHostEvents: false` employee and a non-active person.
- [ ] `users` is unchanged from the Stage 0 reading.
- [ ] `openspec/changes/add-events-page/design.md` and `tasks.md` match what was implemented,
      and the FullCalendar mapping table is published.
- [ ] `README.md` documents `test` and `seed` and warns that the API is unauthenticated and
      must not be exposed beyond local development.
- [ ] `git status` shows no modification under `client/`, `.ai_toolkit/` or `server/dist/`.

---

## Out of scope

- **All client work** — the Events page, the Event dialog, FullCalendar wiring, TanStack
  Query hooks, the FSD slice layout, client-side Zod schemas and client tests. This change
  publishes the contract they will consume; it does not consume it.
- **Authentication, authorization and roles**, and therefore any real population of
  `createdByUserId` / `updatedByUserId`.
- **Contact and employee management CRUD** — create, update and delete of people. Read-only
  only.
- **Any use of the `users` collection.**
- **Notifications, recurring events, reminders, external calendar and video integrations,
  attendance tracking** — excluded by the PRD.
- **All-day events, multi-day events, overlap rules, past-event restrictions, mandatory
  hosts, duration limits and time-zone policy** — deferred product decisions.
- **Write-time enforcement of `canHostEvents`** — recorded as an open decision; adding it
  later only tightens behaviour.
- **Pagination** for the directory endpoints — search plus a result cap is the agreed scope.
- **A shared client/server types package** — a workspace-restructuring decision of its own.
- **Removing the unused root `@mui/x-date-pickers` and `zustand` dependencies** — client-side
  cleanup owned by the OpenSpec change, not by this server work.
- **Linting, formatting, CI, containers, deployment manifests, health/readiness probes,
  rate limiting, metrics and tracing** — none exist in the project and none are required here.
- **Restoring or reusing the untracked `server/dist/` output** — read as evidence, rebuilt
  from source.
