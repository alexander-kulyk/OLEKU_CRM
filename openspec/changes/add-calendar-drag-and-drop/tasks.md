## 1. Versioned Event API and Atomic Updates

- [ ] 1.1 Reconcile the shared error envelope with the active `add-users-server-api` delta and add `EVENT_VERSION_CONFLICT` as a fieldless HTTP 409 code without removing its optional `field` or user conflict codes.
- [ ] 1.2 Add the explicit positive integer `version` field to event persistence, new-event defaults, all event mappers/DTOs, fixtures, and exact response assertions while keeping Mongoose `versionKey: false`.
- [ ] 1.3 Make PATCH boundary validation strict and require `version` plus at least one accepted editable field, preserving existing validation and unknown/not-found behavior.
- [ ] 1.4 Replace PATCH load-save persistence with merged-candidate validation followed by one `_id`-and-`version` conditional update that applies submitted fields and increments the version atomically.
- [ ] 1.5 Distinguish a failed conditional match as `NOT_FOUND` or `EVENT_VERSION_CONFLICT` without mutating the event, and return the post-update event directly on success.
- [ ] 1.6 Update server schema, service, and HTTP tests for missing/current/stale versions, exact +1 increments, invalid-span atomicity, concurrent same-version writers, exact payload shape, and the shared 409 envelope.

**Depends on:**

- The active `add-users-server-api` shared-envelope delta must be reconciled rather than overwritten.

**Rollback:**

- Revert server/client contract changes together; leaving only one side version-aware breaks PATCH. Persisted version values are additive and do not need removal.

**Validation:**

- `pnpm --filter server test`
- `pnpm --filter server build`

**Done when:**

- Every event response has a positive version, one of two competing same-version PATCHes succeeds, every loser receives fieldless `409 EVENT_VERSION_CONFLICT`, and all existing server behavior remains green.

## 2. Existing-Event Version Migration

- [ ] 2.1 Add an idempotent server migration command with `--help`, report/dry-run, and apply modes that targets only event documents missing `version` and initializes them to 1.
- [ ] 2.2 Add memory-backed tests proving report mode is read-only, apply mode updates only missing versions, repeated apply is a no-op, and existing positive versions remain unchanged.
- [ ] 2.3 Document the preflight count, backup, paused-write, apply, verification, coordinated deploy, and rollback sequence without embedding credentials or assuming the deployed collection is empty.

**Depends on:**

- Stage 1 defines the final stored field and response contract.

**Do not:**

- Do not run apply mode against a deployed or shared database without explicit authorization, a verified backup, and paused event writes.

**Rollback:**

- Restore the collection backup only if migration verification finds an incorrect write. A correct backfill is additive and can remain when application code rolls back.

**Validation:**

- `pnpm --filter server test`
- `pnpm --filter server build`
- `pnpm --filter server run migrate:events-version -- --help`

**Done when:**

- The tested command can report and initialize legacy documents safely and the runbook defines objective before/after counts and recovery steps.

## 3. Client Contract and Store Transaction Model

- [ ] 3.1 Add Vitest as a client development dependency and a non-watch `test` script, updating `pnpm-lock.yaml` through pnpm only.
- [ ] 3.2 Add `version` to parsed client event records and require it in every update payload, including the existing Edit Event dialog flow.
- [ ] 3.3 Preserve machine-readable API error codes through store mutations and add a typed drag recovery table for conflict, missing, validation, internal, and transport outcomes.
- [ ] 3.4 Add immutable per-event pending schedule transactions with original/optimistic snapshots, request tokens, synchronous same-event locking, and independent operation for other event IDs.
- [ ] 3.5 Reconcile period reads by request order, event version, and pending overlay so older same-period responses cannot overwrite optimistic or successful values.
- [ ] 3.6 Reconcile a successful drag directly from the returned event; roll back exact original instants on failure; refresh the active period only for conflict or deletion; and avoid injecting results after navigation.
- [ ] 3.7 Add store/API tests for rapid duplicate suppression, simultaneous different-event moves, response normalization, exact rollback, conflict/deletion refresh, same-period response races, navigation during pending work, and version-aware dialog updates.

**Depends on:**

- Stage 1 supplies the synchronized API payload and error contract.

**Do not:**

- Do not create a second event cache, React Context, or component-local event copy; the existing Zustand store remains the single owner.

**Rollback:**

- Revert the test script and remove Vitest with `pnpm --filter client remove --save-dev vitest` if the client test harness is rolled back; commit the resulting lockfile change.

**Validation:**

- `pnpm --filter client test`
- `pnpm --filter client build`

**Done when:**

- Typed tests prove one transaction per event, newer event revisions always win, success does not require a GET, and every specified failure restores or refreshes the correct state.

## 4. Calendar Drag Interaction and Feedback

- [ ] 4.1 Add pure feature helpers for single-day timed eligibility, effective-drop comparison, destination-start normalization, and `newEnd = newStart + originalElapsedDuration`.
- [ ] 4.2 Add tests for Month date-only moves, Week vertical/horizontal/diagonal moves, Day up/down moves, both directions, exact identity/duration preservation, 30-minute boundaries, forward/backward offset transitions, and multi-day/all-day ineligibility.
- [ ] 4.3 Extract a focused drag orchestration hook/helper inside `features/event-calendar` and wire the calendar's resolved drop event to the store without pointer arithmetic or JSX business logic.
- [ ] 4.4 Configure start movement and explicit 30-minute slot/snap behavior while disabling duration editing and retaining existing empty-slot selection and event-click behavior.
- [ ] 4.5 Suppress pending state and requests for same-position, cancelled, outside, invalid, and view-only interactions, including exactly one request under rapid repeated activation.
- [ ] 4.6 Derive pending metadata during event mapping, render an event-scoped busy treatment, prevent same-event drag/edit while pending, and keep other events interactive.
- [ ] 4.7 Add one accessible live-region outcome surface with data-driven messages for rollback, conflict, deletion, validation, server, and transport failures using existing visual tokens.
- [ ] 4.8 Keep `EventCalendar.tsx` and new components/hooks within project size, naming, FSD import-direction, public-API, declarative-rendering, and state-colocation rules.

**Depends on:**

- Stage 3 provides store transactions, recovery outcomes, and typed pending state.

**Do not:**

- Do not enable resize handles, add a drag dependency, calculate time from pixels, make multi-day/all-day events draggable, or replace the Edit Event dialog fallback.

**Validation:**

- `pnpm --filter client test`
- `pnpm --filter client build`

**Done when:**

- Automated client checks cover the pure calculations and transaction wiring, eligible events expose move-only drag in all three views, and pending/error UI is scoped and accessible.

## 5. Cross-Package Acceptance and Release Readiness

- [ ] 5.1 Run all server and client automated checks together and resolve contract drift in DTO fields, PATCH validation, status codes, or exact envelopes.
- [ ] 5.2 Start both development packages and manually verify Month date-only, Week vertical/horizontal/diagonal, and Day up/down drops in both directions at 30-minute boundaries, checking ID and elapsed duration before and after each move.
- [ ] 5.3 Manually verify no request for same-position, cancelled/outside/invalid drops or view changes, exactly one request for rapid repeated activation, no resize affordance, and continued Edit-dialog rescheduling.
- [ ] 5.4 Manually verify immediate event-scoped pending feedback, usability of a different event, adoption of the returned server payload, exact rollback with an announced error, and safe navigation while pending.
- [ ] 5.5 Exercise stale-version and concurrently deleted-event responses, confirming rollback then current-period refresh, current server truth/removal, and no overwrite from delayed same-period reads.
- [ ] 5.6 Rehearse migration report/apply/idempotency only against an isolated disposable database and record the expected preflight, backup, paused-write, deploy, smoke, monitoring, and rollback evidence for an authorized rollout.
- [ ] 5.7 Validate the completed OpenSpec change strictly and keep all completed task checkboxes aligned with work actually verified.

**Depends on:**

- Stages 1 through 4 are complete.

**Do not:**

- Do not treat a build as evidence of drag behavior, run the migration against production, commit, push, or deploy without separate authorization.

**Rollback:**

- Roll back client and server releases together. Keep the additive version field; restore the database backup only for a verified migration defect, and pause writes while switching contracts.

**Validation:**

- `pnpm --filter server test`
- `pnpm --filter server build`
- `pnpm --filter client test`
- `pnpm --filter client build`
- `openspec validate add-calendar-drag-and-drop --strict`
- Manual observation: the PRD acceptance matrix passes in Month, Week, and Day views, including conflict, deletion, navigation, DST-duration, and multi-day-ineligibility cases.

**Done when:**

- Every delta-spec scenario has automated or recorded manual evidence, both packages build, both available test suites pass, the migration rehearsal is recoverable, and strict OpenSpec validation succeeds.
