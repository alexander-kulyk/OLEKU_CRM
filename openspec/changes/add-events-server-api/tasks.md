## 1. Confirm database state and declare dependencies

- [ ] 1.1 Confirm the runtime state of the `contacts`, `employees`, and `events` collections before any code writes to them: actual collection names, document counts, and one sample document per non-empty collection. Tooling cannot read `server/.env`, so this requires the user or someone authorized to run it and report the result.
- [ ] 1.2 Record the confirmed state in this change (a short note under this stage is enough). If any collection holds documents under the older `name` / `startsAt` / `endsAt` naming, stop and raise it — design.md's models would read them as untitled events with no times, and the plan needs revisiting before a write happens.
- [ ] 1.3 Add `zod` as a server dependency from the repo root: `pnpm --filter server add zod`.
- [ ] 1.4 Add `mongodb-memory-server` as a server dev dependency from the repo root: `pnpm --filter server add -D mongodb-memory-server`.
- [ ] 1.5 Add a `test` script to `server/package.json` running `node --test` over `src/**/*.test.ts`.
- [ ] 1.6 Commit the updated `pnpm-lock.yaml` alongside `server/package.json`.

**Validation:**

- `pnpm install --frozen-lockfile` (from the repo root — proves the lockfile matches the manifests)
- `pnpm --filter server exec node -e "require.resolve('zod')"`
- `pnpm --filter server build`

**Done when:**

- The state of all three collections is confirmed and written down, with no unreported pre-existing documents.
- `zod` and `mongodb-memory-server` appear in `server/package.json` and in `pnpm-lock.yaml`'s `server` importer.
- `pnpm install --frozen-lockfile` succeeds from a clean `node_modules`.

**Do not:** write to any collection during this stage, and do not treat "the existing changes say they are empty" as confirmation.

## 2. Shared HTTP foundation

- [ ] 2.1 Add `src/shared/http/error-envelope.ts` and `src/shared/http/http-error.ts`: the `{ error: { code, message } }` shape and a typed error carrying an HTTP status and a stable code.
- [ ] 2.2 Add `src/shared/http/validate.ts` — a boundary helper that validates params, query, and body with zod and raises a 400 typed error on failure, before any data access.
- [ ] 2.3 Add `src/shared/http/error-handler.ts`: map typed errors to their status and code, validation failures to 400, everything else to a generic 500. Log the real error server-side; emit no message, stack, or driver text in the response.
- [ ] 2.4 Add `src/shared/http/not-found.ts`: emit the envelope with a 404 without reflecting `req.originalUrl`.
- [ ] 2.5 Replace the inline 404 and error handler in `src/app.ts` with these two, keeping them last in the middleware order and leaving `GET /api/health` unchanged.

**Depends on:** Stage 1

**Validation:**

- `pnpm --filter server build`
- `pnpm --filter server dev`, then `curl -i http://localhost:<port>/api/does-not-exist` — status 404, envelope shape, and the response body does not contain `does-not-exist`
- `curl -i http://localhost:<port>/api/health` — unchanged successful response

**Done when:**

- No response body in any environment can contain `error.stack`, a raw exception message, or the caller's URL — verified by reading `src/app.ts` and the new handlers, with no remaining reference to `error.message` or `error.stack` in a response path.
- `GET /api/health` behaves exactly as before.

## 3. Directory persistence and seed

- [ ] 3.1 Add `src/modules/directory/contact.model.ts` bound to the `contacts` collection: `firstName`, `lastName`, `email`, `status`.
- [ ] 3.2 Add `src/modules/directory/employee.model.ts` bound to the `employees` collection: `firstName`, `lastName`, `email`, `position`, `department`, `canHostEvents`, `status`.
- [ ] 3.3 Declare the indexes supporting the status filter and the name ordering on both models.
- [ ] 3.4 Add `src/shared/db/seed.ts` — an idempotent seed for contacts and employees, including at least one inactive person and one employee with `canHostEvents` false, so the filtering paths have data to exercise.
- [ ] 3.5 Add a script to run the seed against the configured database.

**Depends on:** Stage 1

**Validation:**

- `pnpm --filter server build`
- Run the seed twice against a scratch database; the second run creates no duplicates

**Done when:**

- Both models bind explicitly to the existing collection names.
- The seed is idempotent and produces at least one inactive person and one non-hosting employee.

**Do not:** touch the `users` collection.

**Rollback:** drop the declared indexes and remove seeded documents from the scratch database; no other durable state is created.

## 4. Directory endpoints

- [ ] 4.1 Add `directory.schema.ts` — query validation for search term (length-capped), status selection, host-eligibility filter, and requested size.
- [ ] 4.2 Add `directory.service.ts` — resolve queries with the search term escaped as literal text, active-only unless other statuses are explicitly requested, deterministic ordering, and a server-enforced result cap that clamps rather than rejects an over-large request.
- [ ] 4.3 Add `directory.controller.ts` translating HTTP to service calls and back.
- [ ] 4.4 Add `directory.routes.ts` exposing the contact read and the employee read, the latter accepting the host-eligibility filter.
- [ ] 4.5 Mount the directory router in `src/app.ts` under `/api`, above the 404 and error handler.

**Depends on:** Stages 2, 3

**Validation:**

- `pnpm --filter server build`
- Against the seeded database: a read with no filters excludes the inactive person; a read restricted to eligible hosts returns only employees with `canHostEvents` true; a search term containing `.*` returns only literal matches and does not error; a search term over the cap returns 400; a requested size above the maximum returns the maximum rather than an error

**Done when:**

- Every directory scenario in `specs/directory-api/spec.md` is observably satisfied.
- No directory route creates, modifies, or deletes a person.

## 5. Event persistence and rules

- [ ] 5.1 Add `src/modules/events/event.model.ts` bound to the `events` collection: `title`, `startAt`, `endAt`, `attendeeIds`, `hostIds`, `createdByUserId`, `updatedByUserId`, with a compound index on `{ startAt, endAt }`.
- [ ] 5.2 Add `event.schema.ts` — validation for the calendar period and for event bodies, with every instant parsed by an ISO datetime validator configured to **accept a numeric UTC offset**, not only `Z`. Reject date-only and zone-less values.
- [ ] 5.3 Add `event.service.ts` create and update as a document round-trip (`new … save()` / load → assign → save), never a bare query update, so document validation runs on both paths.
- [ ] 5.4 Enforce `endAt > startAt` in the service for both create and update, and express it on the schema as defense in depth.
- [ ] 5.5 Implement participant resolution as one step: collapse duplicates, resolve attendee ids against `contacts` and host ids against `employees`, then reject unknown ids, non-active people, ineligible hosts, and role mismatches with a single 400.
- [ ] 5.6 Ignore any client-supplied actor field; write `createdByUserId` and `updatedByUserId` as null.
- [ ] 5.7 Serialize instants back as ISO strings that always carry a time component and a zone designator, and resolve participants into person records, omitting any that no longer resolve.

**Depends on:** Stages 2, 3

**Validation:**

- `pnpm --filter server build`

**Done when:**

- No create or update path reaches storage through `findOneAndUpdate` or `updateOne` — verified by reading `event.service.ts`.
- The span check and the participant check each exist exactly once and are reached by both create and update.

## 6. Event endpoints

- [ ] 6.1 Add `event.controller.ts` for the period read, create, whole-object update, and delete.
- [ ] 6.2 Add `event.routes.ts` wiring the four operations with boundary validation; controllers are `async` and throw, relying on Express 5 forwarding rejections to the error handler.
- [ ] 6.3 Implement the period read as `startAt < to AND endAt > from`, with both boundaries required and an inverted period rejected with 400.
- [ ] 6.4 Implement update as a whole-object replace: omitted participant collections clear the assignments; a missing event id returns 404.
- [ ] 6.5 Implement delete, returning 404 for an unknown id.
- [ ] 6.6 Mount the events router in `src/app.ts` under `/api`, above the 404 and error handler.

**Depends on:** Stage 5

**Validation:**

- `pnpm --filter server build`
- Against a scratch database: create an event, read it back in a covering period, update it with participants omitted and confirm they are cleared, delete it and confirm a covering period no longer returns it; a period read missing a boundary returns 400; update and delete of an unknown id return 404

**Done when:**

- Every scenario in `specs/event-api/spec.md` is observably satisfied.
- An event created with participants and then updated without them has no participants afterwards.

## 7. Automated verification

- [ ] 7.1 Add the test harness: start `mongodb-memory-server`, connect, and reset collections between tests.
- [ ] 7.2 Test the period read with **offset-bearing boundaries** (for example `+03:00`) and assert the same result set as the equivalent `Z` boundaries, and that a matching event is returned rather than an empty list.
- [ ] 7.3 Test that a date-only or zone-less instant is rejected with 400.
- [ ] 7.4 Test the span invariant on **both** paths: creation with `end == start` and with `end < start`, and an update that inverts the span, asserting in the update case that the stored event is unchanged.
- [ ] 7.5 Test boundary semantics: an event ending exactly at the period start and one beginning exactly at the period end are both excluded.
- [ ] 7.6 Test participant rules: unknown id, non-active person, employee without `canHostEvents` assigned as host, contact assigned as host, employee assigned as attendee, and a repeated id collapsing to one assignment.
- [ ] 7.7 Test that an event whose stored participant no longer resolves is still returned with the remaining participants.
- [ ] 7.8 Test that a client-supplied actor field is ignored and the stored actor fields stay null.
- [ ] 7.9 Test directory search with regular-expression characters in the term, the length cap, the requested-size clamp, and active-only-by-default.
- [ ] 7.10 Test the error contract: an unknown route's 404 body does not contain the requested path, and no failure response contains a stack trace, a raw exception message, or driver text.

**Depends on:** Stages 4, 6

**Validation:**

- `pnpm --filter server test`
- `pnpm --filter server build`
- `pnpm install --frozen-lockfile` from a clean `node_modules`

**Done when:**

- `pnpm --filter server test` passes, and its output is the evidence for every claim made about this change's behavior. Until this stage passes, no stage above may be reported as verified beyond its own stated checks.
- The offset-boundary test fails if the instant validator is reverted to `Z`-only, and the update-span test fails if the service is switched to a bare query update — confirm each by temporarily reverting, observing the failure, and restoring.
