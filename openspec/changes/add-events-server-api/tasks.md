## 1. Confirm the database precondition and establish isolated tests

- [x] 1.1 Obtain a read-only observation from the user or an authorized database owner for `contacts`, `employees`, and `events`: actual collection names, document counts, and one redacted sample from each non-empty collection. The verifier records the observation in the Stage report; no implementation agent reads credentials or edits an OpenSpec artifact.
- [x] 1.2 Stop before adding persistence code if any observed event uses `name`, `startsAt`, or `endsAt`, or if the observed collection names conflict with the explicit bindings in design.md; request a migration decision instead of guessing.
- [x] 1.3 From the repository root, add `zod` as a server dependency and `mongodb-memory-server` as a server development dependency through pnpm, updating `server/package.json` and `pnpm-lock.yaml` together.
- [x] 1.4 Add the server `test` script with the exact runner target `node --test src/test/*.test.ts`.
- [x] 1.5 Add a test-environment helper that starts `mongodb-memory-server`, assigns its URI to `process.env.DB_HOST`, and only then dynamically imports application, configuration, database, or model modules. Add cleanup that disconnects Mongoose and stops the in-memory server.
- [x] 1.6 Add an isolation test that begins with a non-test `DB_HOST`, invokes the helper, and proves the effective connection URI is the in-memory instance rather than the original value.

**Validation:**

- Manual observation by the user or authorized database owner: collection names, counts, and redacted samples are present in the verifier's Stage report.
- `pnpm install --frozen-lockfile`
- `pnpm --filter server list zod mongodb-memory-server --depth 0`
- `pnpm --filter server test`
- `pnpm --filter server build`

**Done when:**

- The database observation is compatible with `title`, `startAt`, and `endAt`, or all three target collections are confirmed absent or empty.
- Both dependencies are declared in the correct manifest sections and resolved by the `server` importer in `pnpm-lock.yaml`.
- The test suite proves that application imports occur only after `DB_HOST` points at the disposable in-memory database.

**Do not:** read `server/.env`, request or print Atlas credentials, connect to or write a hosted database, edit planning artifacts, or create a commit.

**Rollback:** remove the two dependency declarations and test script through pnpm, and restore the matching lockfile changes; the in-memory database is discarded by test cleanup.

## 2. Replace the shared HTTP terminal behavior

- [x] 2.1 Add the shared error-envelope type and a typed HTTP error carrying a status, one of the specified stable error codes, and a safe public message.
- [x] 2.2 Add a Zod boundary helper that parses supplied params, query, or body, returns the parsed value, and never assigns to `req.query` or another Express request property.
- [x] 2.3 Add one error middleware that maps validation and typed domain errors to `{ error: { code, message } }`, logs the underlying failure server-side, and maps every unknown failure to a generic `INTERNAL_ERROR` response.
- [x] 2.4 Add a terminal not-found handler that returns the exact `NOT_FOUND` envelope without reflecting `req.originalUrl`.
- [x] 2.5 Replace the inline terminal handlers in `src/app.ts`, preserve `GET /api/health` as `{ status: "ok" }`, and keep both terminal handlers last.
- [x] 2.6 Add integration tests for health, unknown routes, Zod validation failure, typed failures, and a synthetic internal failure containing a stack, URL, raw exception message, and MongoDB-like driver text.

**Depends on:** Stage 1

**Validation:**

- `pnpm --filter server test`
- `pnpm --filter server build`

**Done when:**

- Health returns the existing exact payload.
- Every failure uses the exact envelope and stable code, and tests prove that no response includes the requested path, stack, raw exception message, or driver detail.
- Parsed request data reaches handlers without mutating Express request properties.

## 3. Add directory persistence and the local-only seed

- [ ] 3.1 Add a contact model explicitly bound to `contacts` with `firstName`, `lastName`, `email`, and closed `active | inactive` status values defaulting to `active`.
- [ ] 3.2 Add an employee model explicitly bound to `employees` with the contact fields plus `position`, `department`, and `canHostEvents` defaulting to `false`; use erasable TypeScript and do not add a model for `users`.
- [ ] 3.3 Add `{ status: 1, lastName: 1, firstName: 1, _id: 1 }` indexes to both directory models and do not add a unique email index.
- [ ] 3.4 Add an explicit seed command that upserts a fixed directory dataset by email, includes inactive and ineligible examples, never touches `events` or `users`, and refuses every MongoDB URI whose host is not loopback.
- [ ] 3.5 Add tests that run the seed twice against the in-memory database, compare the resulting records and counts, and prove that a non-loopback URI is rejected before connecting or writing.

**Depends on:** Stage 1

**Validation:**

- `pnpm --filter server test`
- `pnpm --filter server build`

**Done when:**

- Both models use the exact collection names, fields, defaults, status values, and indexes from design.md.
- Two seed runs produce the same directory records without duplicates.
- Automated tests prove the seed cannot target Atlas or another non-loopback host and never changes `events` or `users`.

**Do not:** execute the seed with `server/.env` or against any shared, hosted, or production-like database.

## 4. Implement the read-only directory API

- [ ] 4.1 Add directory query schemas accepting only `search` and `status` for contacts, plus `canHostEvents` for employees; cap `search` at 100 characters and reject unknown query keys such as `size` or `limit`.
- [ ] 4.2 Add directory services that treat search text literally, match `firstName` or `lastName` case-insensitively, default status to `active`, cap results at 50, and order by `lastName`, `firstName`, then `_id`.
- [ ] 4.3 Add controllers and routes for exactly `GET /api/contacts` and `GET /api/employees`, returning `{ contacts: [...] }` and `{ employees: [...] }` with only the fields specified for each projection.
- [ ] 4.4 Mount the directory router under `/api` above the terminal handlers and add no directory write route.
- [ ] 4.5 Add integration tests for exact wrappers and projections, active-by-default behavior, explicit inactive selection, employee eligibility filtering, deterministic tie ordering, the 50-result cap, literal metacharacter search, the 100-character boundary, rejected unknown query keys, and 404 responses for attempted writes.

**Depends on:** Stages 2 and 3

**Validation:**

- `pnpm --filter server test`
- `pnpm --filter server build`

**Done when:**

- Every directory scenario in `specs/directory-api/spec.md` passes against the in-memory database.
- Directory responses expose no persistence metadata and no route can create, update, or delete a person.

## 5. Implement event persistence and domain rules

- [ ] 5.1 Add an event model explicitly bound to `events` with `title`, `startAt`, `endAt`, `attendeeIds`, `hostIds`, nullable `createdByUserId`, and nullable `updatedByUserId`, plus the `{ startAt: 1, endAt: 1 }` index.
- [ ] 5.2 Add schemas for `from`/`to`, create, partial PATCH, and id params. Parse full ISO instants with `z.iso.datetime({ offset: true })`; reject date-only and zone-less values; trim non-empty titles; strip client-supplied audit fields.
- [ ] 5.3 Add one shared service function for the primary `endAt > startAt` check and call it with the complete candidate state from both create and PATCH. Add a document validation hook as a persistence backstop.
- [ ] 5.4 Implement create with document `save()` and PATCH as load, merge only supplied fields, validate the merged candidate, then `save()`; an omitted participant field remains unchanged and an explicitly empty array clears that role.
- [ ] 5.5 De-duplicate participant ids and batch-resolve each supplied role. On create validate every id as new; on PATCH require existence, active status, and host eligibility only for ids newly added relative to the stored role, while allowing retained inactive or newly ineligible assignments to remain and be removed.
- [ ] 5.6 Complete participant validation before mutating the loaded event so a rejected write leaves storage unchanged. Resolve attendees only from contacts and hosts only from employees.
- [ ] 5.7 Ignore client audit values, persist both audit fields as null, serialize dates with `toISOString()`, batch-resolve participant projections on reads, and omit dangling references without failing the event.
- [ ] 5.8 Add service and persistence tests for zero or inverted spans on both write paths, one-sided boundary patches, omitted and empty participant arrays, duplicate ids, unknown ids, wrong-role ids, inactive new ids, ineligible new hosts, retained historical assignments, removal of historical assignments, dangling references, forged audit values, and atomic failed writes.

**Depends on:** Stages 2 and 3

**Validation:**

- `pnpm --filter server test`
- `pnpm --filter server build`

**Done when:**

- Create and PATCH both invoke the shared span function and reach the document-validation backstop through `save()`; no event write uses `updateOne`, `findOneAndUpdate`, or another bare query update.
- All participant transition and failure cases preserve the exact rules in `specs/event-api/spec.md`, including unchanged stored state after rejection.
- Event mapping exposes only the domain fields and never audit or persistence metadata.

## 6. Expose and verify the event HTTP contract

- [ ] 6.1 Add async event controllers and routes for exactly `GET /api/events`, `POST /api/events`, `PATCH /api/events/:id`, and `DELETE /api/events/:id`, relying on Express 5 to forward rejected promises.
- [ ] 6.2 Implement the required period query as `startAt < to AND endAt > from`; reject a missing or non-increasing `from`/`to` pair before data access.
- [ ] 6.3 Return `{ events: [...] }` from the period read, a direct event from create and PATCH, status 201 from create, status 200 from PATCH, and status 204 with no body from delete.
- [ ] 6.4 Return the specified `VALIDATION_ERROR`, `INVALID_PARTICIPANT`, and `NOT_FOUND` codes for their exact cases, including unknown event ids, and mount the router under `/api` above the terminal handlers.
- [ ] 6.5 Add integration tests proving equivalent `+03:00` and `Z` periods return the same events, boundary-touching events are excluded, overlapping events are included, required and ordered boundaries are enforced, and date-only or zone-less values are rejected.
- [ ] 6.6 Add contract tests for exact route names, query names, wrappers, projections, status codes, partial PATCH preservation, explicit participant clearing, not-found behavior, audit suppression, dangling-reference reads, and empty response body on delete.
- [ ] 6.7 Add endpoint-level tests proving invalid create and PATCH requests leave the database unchanged and every error response remains free of internal details.

**Depends on:** Stages 4 and 5

**Validation:**

- `pnpm --filter server test`
- `pnpm --filter server build`

**Done when:**

- Every scenario in `specs/event-api/spec.md` and every shared response requirement in `specs/api-foundation/spec.md` passes against the in-memory database.
- The observable API matches proposal.md exactly, with no whole-object update behavior and no alternate route or query vocabulary.

## 7. Run the final change gate

- [ ] 7.1 Review the implementation against proposal.md, design.md, and all three delta specs, and record the evidence for each Stage in the verifier report without modifying the planning artifacts.
- [ ] 7.2 Confirm all relative source imports use `.ts`, all feature files remain under `server/src/modules/`, environment access remains in `server/src/shared/config/env.ts`, routers precede the terminal handlers, and no model or write path targets `users`.
- [ ] 7.3 Confirm the implementation changed only the server package and the workspace lockfile; do not implement client mapping, authentication, recurrence, concurrency control, or future time-zone policy.
- [ ] 7.4 Run the complete dependency, test, and build gates from the repository root and retain their outputs in the verifier report.

**Depends on:** Stage 6

**Validation:**

- `pnpm install --frozen-lockfile`
- `pnpm --filter server list zod mongodb-memory-server --depth 0`
- `pnpm --filter server test`
- `pnpm --filter server build`

**Done when:**

- Every Stage criterion is supported by observed command output or an explicit manual observation, and every research verification concern R-001, R-004, R-005, R-006, R-007, R-009, and R-011 has recorded evidence.
- No validation contacted Atlas, no planning artifact was edited by executor or verifier, and no deployment, push, or commit occurred.
- The change is ready for an orchestrator-controlled implementation commit and subsequent `/opsx:verify`; it is not exposed outside local development while authorization remains out of scope.

**Do not:** deploy the unauthenticated endpoints, edit the superseded changes, create a commit, or archive/sync this change during implementation.
