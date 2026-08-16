## Context

See `proposal.md` for motivation and scope. The calendar already mounts FullCalendar's interaction plugin, but event movement is disabled. FullCalendar 6.1.21 can supply the resolved old/new event values and rollback primitive, while the application currently maps server events into the calendar from a single Zustand-owned array.

The current client mutation path discards the PATCH response and performs a whole-period reread. The store has no per-event mutation state, preserves only the active period against cross-period responses, and collapses typed API failures to message-only `Error` objects. The server uses a load-merge-save update with no concurrency token and explicitly disables Mongoose's version key. These constraints make the change cross-package.

The design follows the research-informed direction without deviation. It also respects the client package's FSD and React rules: event/calendar state remains in the sanctioned store, feature-specific drag orchestration stays inside the existing `event-calendar` slice, derived presentation is not mirrored through effects, and the calendar component is not expanded into a larger multi-concern component.

## Goals / Non-Goals

**Goals:**

- Make the server's event revision an explicit, atomic domain contract shared by all event update origins.
- Give one store-owned transaction a clear lifecycle from destination resolution through optimistic display, success reconciliation, or rollback.
- Prevent stale period reads and stale writers from replacing newer schedule data.
- Keep drop calculation, API transport, state transitions, and presentation independently testable.
- Provide a safe, idempotent path for initializing versions on existing event documents.

**Non-Goals:**

- Defining all-day, multi-day, recurring, overlap, authorization, notification, or past-event policy.
- Adding event resizing or an alternative drag library.
- Introducing a second remote-data cache, a new React Context, or a new FSD layer.
- Reworking create/delete invalidation beyond the ordering protections required to coexist with drag transactions.

## Decisions

### D1. Use an explicit event-domain version

Add a required positive integer `version` to `EventAttributes`, persisted event documents, server/client event payloads, and PATCH inputs. New events start at version 1; every successful PATCH increments it exactly once. Keep `versionKey: false` so the public revision is deliberate domain data rather than Mongoose metadata.

The server validates that PATCH contains `version` plus at least one editable field. Edit-dialog updates and drag updates use the same version guard, because leaving any update origin unguarded would still allow it to overwrite a successful drag.

Alternatives considered:

- Mongoose `__v`: rejected because it is currently disabled, would leak persistence mechanics into the contract, and would not match the explicit domain-version precedent in the active users change.
- ETag/`If-Match`: viable HTTP semantics, but every event in a collection read would still need an individual validator and the PRD already anticipates a body concurrency field.

### D2. Replace load-save with validate-then-atomic-update for PATCH

The service first reads the stored event to build and validate the complete candidate span and to validate newly added participants. After validation, it performs one atomic conditional update filtered by `_id` and the supplied `version`, applies only the submitted fields, and increments `version` in the same operation. The returned post-update document is mapped directly to the response.

The existing document `pre('validate')` hook does not protect query updates, so the service-level merged-span check remains mandatory before the atomic write. If the conditional update matches nothing, a follow-up existence check distinguishes current `NOT_FOUND` from `EVENT_VERSION_CONFLICT`; either result leaves stored data unchanged.

Alternatives considered:

- Check the version and then call `save()`: rejected because another writer can commit between the check and save.
- Enable Mongoose optimistic concurrency on documents: rejected because the contract uses an explicit version, and the existing service must still distinguish missing from stale records predictably.

### D3. Initialize existing versions through an idempotent maintenance command

Add a server-side one-shot migration command that reports the number of event documents missing `version` and sets only those documents to version 1. New schema defaults cover new documents; the migration covers existing documents because Mongoose defaults do not rewrite stored data.

Run the migration while event writes are paused, before deploying the strict PATCH contract. Re-running it is safe because documents already carrying a version are untouched. This avoids a permanent compatibility branch for missing versions in every read and write.

Alternatives considered:

- Treat missing versions as 1 forever: rejected because an atomic increment of a missing field does not naturally produce the required next revision and leaves ambiguous legacy state in the hot path.
- Backfill on server startup: rejected because startup should not silently perform a production-wide data mutation and concurrent instances could obscure migration status.

### D4. Model drag as one store-owned transaction per event

Extend the existing event store with an immutable record of pending schedule transactions keyed by event ID. A transaction carries a unique request token, the original `{ startAt, endAt, version }`, the optimistic `{ startAt, endAt }`, and the period context in which it began. A synchronous store check creates the transaction and applies the optimistic schedule in one state update before the request starts.

The same event cannot start another drag or Edit-dialog mutation while its transaction exists. Other IDs are independent. Completion handlers compare the request token before changing state, so a late callback cannot finalize a superseded transaction. The store retains typed API error codes until recovery policy and user-facing copy have been selected.

Feature UI reads events and pending IDs from the store; it does not keep a second event copy in component state. Pending presentation is derived while mapping event records to calendar inputs.

Alternatives considered:

- Let FullCalendar remain the only optimistic owner: rejected because a React render from the store can restore the old event and there is nowhere durable to expose pending state or coordinate navigation.
- Put transactions in component-local state or Context: rejected by the package's sanctioned Zustand ownership and because the Event dialog and event renderer need the same per-ID lock.

### D5. Reconcile reads by request order, event version, and pending overlay

Give every period read a monotonically increasing request ID and commit only the latest request for the active period. When a read is accepted, reconcile by event ID instead of blindly replacing newer local state:

- Preserve the optimistic schedule for an event with a pending transaction.
- Never replace a locally known event with a response carrying a lower version.
- Use the accepted response as authoritative for non-pending events at the same or newer version.
- Filter optimistic/success results against the currently active half-open period before inserting them, so completion after navigation cannot inject an unrelated event.

On successful drag, replace the event from the PATCH response and remove the transaction without requiring a GET. On conflict or deletion, restore the snapshot, clear pending, then request the active period; the version/read-order rules prevent an older response from winning. Ordinary validation, server, or transport failures roll back without an automatic read.

Alternatives considered:

- Continue unconditional refetch-after-write: rejected because success then depends on a second request and same-range responses can arrive out of order.
- Use only a period equality check: rejected because it cannot order two requests for the same range or distinguish event revisions.

### D6. Separate destination resolution from schedule arithmetic

Configure explicit `eventStartEditable: true`, `eventDurationEditable: false`, `slotDuration: '00:30:00'`, and `snapDuration: '00:30:00'`. The drop callback supplies the destination start; a pure feature helper checks eligibility, computes `durationMs = oldEnd - oldStart`, and derives `newEnd = newStart + durationMs`. It compares the resulting ISO instants with the original before starting a transaction.

Month movement therefore preserves the original local start time selected by the calendar while elapsed duration remains invariant across DST. The duration-derived end intentionally wins if retaining both wall-clock endpoints would change elapsed duration. Eligibility is also a pure display-zone check: only timed events whose start and end share one local calendar date can enter drag.

The callback and calculation live in the existing `features/event-calendar` slice. The handler is extracted into a focused model hook/helper rather than growing `EventCalendar.tsx` past the project size limit or placing business behavior in JSX.

Alternatives considered:

- Trust the library's moved end blindly: rejected because adding a calendar day to both endpoints can conflict with the chosen elapsed-duration rule at an offset transition.
- Convert pointer coordinates manually: rejected because the calendar already owns valid-target and snap resolution.

### D7. Render pending and failure state declaratively

The calendar event mapper adds derived pending metadata from the store transaction record. `CalendarEventContent` renders one pending treatment and exposes the event as busy/temporarily unavailable to assistive technology. A calendar-level live region presents drag outcomes because an event may move out of view or be removed after refresh.

Error categories use a typed data table keyed by `EVENT_VERSION_CONFLICT`, `NOT_FOUND`, `VALIDATION_ERROR`, `INTERNAL_ERROR`, and transport failure to select copy and whether refresh is required. This keeps one render shape and one recovery dispatcher instead of parallel boolean states or repeated JSX branches. Exact visual styling and copy use the existing calendar tokens and message conventions.

Alternatives considered:

- Reuse only the global period-loading overlay: rejected because it disables or obscures unrelated events and cannot identify the affected event.
- Throw message-only errors from the store: rejected because the client must select different recovery for conflict, deletion, and transport outcomes.

### D8. Keep client/server contract changes synchronized

Update the client DTO parser/types, PATCH input, dialog update mapping, server schema/model/service mapper, and shared error union in the same implementation. The drag body carries only `version`, `startAt`, and `endAt`; the dialog carries `version` with its normal edited fields. The shared error change is merged with, rather than replacing, the optional `field` and user conflict codes in the active `add-users-server-api` delta.

No new runtime package is required. Add a client test script with Vitest as a development-only dependency so pure schedule calculation, eligibility, store transaction/reconciliation, and error-policy behavior can be exercised. Full browser drag acceptance remains a manual verification concern because the repository has no browser automation harness.

## Risks / Trade-offs

- [The contract is breaking for clients that omit `version`] → Deploy the server and client together after maintenance-mode backfill; document the coordinated release and reject old callers clearly with boundary validation.
- [Production event count and legacy shapes are unknown] → Run the migration in report/dry-run mode first, record counts, back up the collection, and size the maintenance window from observed data.
- [Atomic query updates bypass document validation middleware] → Keep explicit full-candidate validation in the service and cover invalid-span atomicity in service/API tests.
- [Participant eligibility can change after validation but before the atomic event update] → Preserve the existing validation contract and minimize the interval; directory/event cross-collection transactions remain outside this change.
- [Transport failure may occur after the server committed] → Roll back locally as specified; a retry with the old version will conflict and trigger refresh, preventing silent overwrite.
- [A read during a pending transaction may contain newer remote data] → Preserve the pending overlay until the PATCH resolves; the version guard forces conflict, after which the required refresh adopts the remote revision.
- [DST behavior may surprise operators because the visible end can shift] → Keep elapsed duration normative, cover forward/backward offset transitions, and present the server-normalized result immediately after success.
- [Multi-day records may already exist] → Determine eligibility from actual returned instants and leave those records editable through the dialog; do not infer that the collection is single-day.
- [Past-event and overlap policies may later restrict targets] → Keep target validation extensible, but treat those moves as allowed until a separate normative rule exists.
- [Concurrent active changes touch the shared error envelope] → Reconcile against `add-users-server-api` before implementation and validate both delta sets; do not restore the old exact-key assumptions.
- [Client drag behavior lacks browser automation] → Add deterministic unit tests for all pure/state transitions, run both package builds and server tests, and execute the PRD acceptance matrix manually in Month, Week, and Day views.

## Migration Plan

1. Reconcile the shared error-envelope implementation with the active users change and prepare the idempotent event-version migration command.
2. Back up the events collection, pause event writes, run the migration in report mode, then apply it and verify that every event has a positive integer version.
3. Deploy the synchronized server and client contract, including version-aware dialog updates, while writes remain paused.
4. Run API smoke checks for read/create/current-version PATCH/stale-version PATCH and browser checks for one successful and one failed drag in each view; then resume writes.
5. Monitor 400 missing-version responses, 409 conflict frequency, migration logs, and client drag failures.

Rollback deploys the previous client and server together. The added `version` field is additive to stored documents and can remain; no data downgrade is required. Event writes become last-write-wins again while the old server is active, so rollback is a temporary safety action, not a steady supported mode.

## Open Questions

- Exact pending indicator styling and final localized error copy can be selected during UI implementation without changing the specified states, recovery behavior, or task structure.
- Migration batch size and maintenance-window duration depend on the authorized preflight count; the idempotent missing-version-only algorithm does not change.
