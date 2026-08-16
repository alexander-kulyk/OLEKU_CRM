# Research: Add calendar drag and drop

## Research status

- **Change:** `add-calendar-drag-and-drop`
- **Confidence:** Medium-high on frontend feasibility and current contracts; medium overall because event concurrency, DST duration semantics, and multi-day eligibility are not yet defined consistently.
- **Blocking unknowns:** 3 — the Event API concurrency token/error contract, the precedence between elapsed duration and wall-clock preservation across offset transitions, and whether multi-day events are eligible for dragging.

## Executive summary

The requested month/week/day movement, optimistic placement, rollback, per-event pending state, no-op suppression, slot snapping, and no-resize boundary are feasible with the dependencies already installed. FullCalendar 6.1.21's interaction plugin is mounted today but dragging is disabled. For a valid move, the installed library updates its internal event immediately, emits `eventDrop` with both the old and resolved new event, and supplies `revert()`; it does not emit a drop for an unchanged hit or an invalid target (EVID-011). Its timed-grid default is already 30-minute slots/snapping. No new drag library or pixel-to-time calculation is warranted.

The current application is not ready to own the async transaction. The sanctioned Zustand store owns calendar events but has only period-read status, no per-event pending registry or scheduling snapshot, discards the successful PATCH response, and re-reads the whole period after a mutation. Its same-period read guard does not order two reads for the same range. Error codes are converted to plain messages before callers receive them. These facts conflict with event-scoped locking, exact rollback, response-as-truth, and conflict-specific refresh (EVID-003, EVID-004, EVID-007).

Most importantly, REQ-CAL-DND-029 cannot be met by the current Event API. Event payloads and PATCH bodies contain no version, the Mongoose schema disables its version key, and the load-merge-save path is explicitly last-write-wins. The draft's example error names also differ from the shared API's four current codes. This is therefore a coordinated client/server contract change unless the concurrency requirement is explicitly revised. The research-informed direction is to keep FullCalendar as the destination resolver, keep optimistic scheduling and per-event locks in the existing store, reconcile success from the returned event, and add an atomic Event API precondition. An explicit domain `version` carried by every event read and schedule PATCH best matches the body-based draft and the active users change, but proposal/design must confirm that choice and the conflict code before implementation.

## Input and scope

### Explicit requirements

- REQ-CAL-DND-001 through 011: move existing timed events in month, week, and day views; month changes date only, week supports vertical/horizontal/diagonal movement, day changes time only, and every move preserves duration (`docs/prd/release 1.0.0/eventsPage/dragAndDrop.md:44-333`).
- REQ-CAL-DND-012 through 016: update the existing ID through one PATCH containing only scheduling values that changed plus any concurrency field; all examples send both `startAt` and `endAt` (`dragAndDrop.md:337-421`). Because shifting an event changes both absolute boundary instants, both timestamp fields change for every effective drag even when only the displayed date or time component changes.
- REQ-CAL-DND-017 through 021: show the destination immediately, expose an event-level pending state, block another drag of that event, adopt the server response on success, and restore an original `{ eventId, startAt, endAt }` snapshot with an error on failure (`dragAndDrop.md:425-530`).
- REQ-CAL-DND-022 through 028: preserve identity; suppress no-op, cancelled, and invalid drops; use the calendar-resolved destination and configured slot precision; and never mutate an event merely because the view changed (`dragAndDrop.md:534-646`).
- REQ-CAL-DND-029 through 032: reject stale writes, roll back and refresh on conflict or concurrent deletion, use the common API error envelope, distinguish business from transport/server failures, and inform the operator (`dragAndDrop.md:650-721`).
- REQ-CAL-DND-033: retain the Edit Event dialog as a non-drag rescheduling path (`dragAndDrop.md:725-733`). AC-CAL-DND-001 through 015 restate these behaviors (`dragAndDrop.md:758-892`).

### Constraints and exclusions

- Only existing displayed events are draggable. Creation, title/participant/color changes, resizing, recurring behavior, authorization, notifications, collision policy, and past-event restrictions are excluded (`dragAndDrop.md:28-38,737-754`).
- Repository architecture is `app -> pages -> features -> shared`; the existing Zustand store is the single sanctioned owner of event and calendar UI state, and a second cache/store is forbidden (`client/AGENTS.md:12-41,63-67`).
- The canonical route is `PATCH /api/events/:id`; `:eventId` in the draft is explicitly an example, not a second endpoint (`server/src/modules/events/event.routes.ts:9-21`; `dragAndDrop.md:341-349`).
- Research was read-only except for this artifact. No service was started, no remote database was inspected, and no future implementation was tested.

### Research questions

| ID | Question | Why it matters | Answer or status | Evidence | Consequence for later artifacts |
| --- | --- | --- | --- | --- | --- |
| RQ-001 | Can the mounted calendar resolve and report all required drops without custom geometry? | Core feasibility and REQ-026 | Answered: yes; v6.1.21 supplies valid moved values, old values, and revert | EVID-002, EVID-011, F-001 to F-004 | Use the library interaction boundary; prohibit independent pixel arithmetic |
| RQ-002 | Can the current PATCH persist a schedule-only move atomically? | Payload and invariant correctness | Partly: it accepts both instants in one request and validates the merged span, but has no concurrency precondition | EVID-005, EVID-006, F-005 to F-007 | Preserve the partial-PATCH contract and extend it deliberately for concurrency |
| RQ-003 | Where can optimistic schedule, snapshot, pending, and rollback state live? | Single source and failure recovery | Answered: the existing store is mandated, but its present shape cannot represent the transaction | EVID-003, EVID-004, F-008 to F-011 | No local copy or second store; the event store contract must cover per-ID mutation state |
| RQ-004 | Will unchanged, cancelled, or invalid drops issue requests? | REQ-004/023/024/025 | Answered at library boundary: `eventDrop` is emitted only for a valid changed mutation | EVID-011, F-003 | Network mutation must originate only from `eventDrop` and still compare resolved instants defensively |
| RQ-005 | What slot and time-zone semantics apply? | Date correctness and duration | Partly: runtime is browser-local and timed-grid snap is 30 minutes; DST precedence is unresolved | EVID-009, EVID-011, EVID-012, F-012 to F-014 | Freeze slot behavior explicitly and resolve D-002 before normative schedule arithmetic |
| RQ-006 | Can the client distinguish conflict, missing event, validation, and transport failure? | Required rollback messages/refresh | No: conflict is absent and the store currently erases the machine code | EVID-007, F-015 to F-017 | Preserve typed classification through the drag transaction and settle the shared code map |
| RQ-007 | Do existing or active OpenSpec changes conflict? | Compatibility | The archived event designs chose no optimism/concurrency; active users work only overlaps the shared error contract | EVID-009, EVID-010, F-018 to F-020 | Modify current specs intentionally and compose with the pending `api-foundation` delta |
| RQ-008 | Is the accessibility fallback already available? | REQ-033 | Yes: clicking an event opens an Edit form with date/start/end controls | EVID-008, F-021 | Preserve the dialog path; drag need not become the only scheduling interaction |
| RQ-009 | Are multi-day/all-day events safely defined for dragging? | Duration/date edge behavior | Unknown: API permits multi-day spans, while product policy remains open | EVID-005, EVID-009, F-022 | Proposal/design must decide eligibility rather than infer it from rendering |

## Evidence reviewed

| ID | Source | Evidence type | What it establishes |
| --- | --- | --- | --- |
| EVID-001 | `docs/prd/release 1.0.0/eventsPage/dragAndDrop.md:1-950` | Draft PRD | Complete 33-requirement baseline, exclusions, acceptance examples, optimistic flow |
| EVID-002 | `client/src/features/event-calendar/ui/EventCalendar.tsx:55-203`; `client/src/features/event-calendar/lib/calendar-view-config.ts:3-40` | Client source | Three mounted views and interaction plugin; current callbacks; no drag options today |
| EVID-003 | `client/src/shared/model/event-store.ts:43-98,100-208` | Client source | Single-period store, period-only loading/error, same-period guard, mutation-refetch behavior |
| EVID-004 | `client/src/shared/api/event-types.ts:20-78`; `client/src/shared/api/events.ts:32-39`; `client/src/features/event-calendar/lib/map-events.ts:16-45` | Client contract/source | Exact DTO and partial PATCH types; returned record is available at API layer; domain-to-calendar mapping |
| EVID-005 | `server/src/modules/events/event.schema.ts:4-15,98-131`; `server/src/modules/events/event.model.ts:13-22,55-87` | Server source | Zone-explicit instants, editable PATCH keys, no version, `versionKey:false`, persistence span backstop |
| EVID-006 | `server/src/modules/events/event.service.ts:217-265,302-368`; `server/src/test/event-api.test.ts:504-575,690-725` | Server source/tests | UTC response mapping; load-merge-save; span/omitted-field behavior; exact response has no concurrency member |
| EVID-007 | `server/src/shared/http/error-envelope.ts:1-24`; `client/src/shared/api/error.ts:4-21,64-100`; `client/src/shared/api/event-error-messages.ts:19-75`; `client/src/shared/model/event-store.ts:186-193` | Cross-boundary source | Four server codes plus client transport marker; update store turns classified error into message-only `Error` |
| EVID-008 | `openspec/specs/event-management/spec.md:37-101`; `client/src/features/event-calendar/ui/EventCalendar.tsx:160-165`; `client/src/features/event-dialog/ui/EventDetailsFields.tsx:27-75` | Main spec/source | Existing accessible Edit route exposes scheduling fields |
| EVID-009 | `openspec/changes/archive/2026-08-16-add-events-server-api/design.md:25-29,61-71,116-123`; `openspec/changes/archive/2026-08-16-add-events-client-ui/design.md:18-22,41-89,99-114`; `docs/prd/release 1.0.0/eventsPage/eventsPage.md:594-611` | Archived design/PRD | Last-write-wins and refetch-after-write were deliberate; optimistic updates, multi-day, all-day, and timezone policy were deferred |
| EVID-010 | `openspec/changes/add-users-server-api/proposal.md:20-26,55-73`; `openspec/changes/add-users-server-api/specs/api-foundation/spec.md:3-62` | Active change | Explicit domain-version precedent and an overlapping widening of the shared error envelope/code map |
| EVID-011 | `client/package.json:11-23`; installed `@fullcalendar/core` 6.1.21 `internal-common.d.ts:1859-1875`, `internal-common.js:1498-1524,3752-3835`; installed `@fullcalendar/interaction` 6.1.21 `index.js:1294-1401,1523-1556`; installed `@fullcalendar/timegrid` 6.1.21 `index.js:15-21`, `internal.js:979-1017` | Exact dependency source | Editability defaults, drop/revert contract, same-delta start/end mutation, invalid/no-op suppression, 30-minute slot/snap behavior |
| EVID-012 | [FullCalendar eventDrop](https://fullcalendar.io/docs/eventDrop), [editability](https://fullcalendar.io/docs/editable), [snapDuration](https://fullcalendar.io/docs/snapDuration), [timeZone](https://fullcalendar.io/docs/timeZone) (accessed 2026-08-16) | Official external docs | Public interaction/revert, drag-vs-resize controls, snapping, and local-zone semantics; exact version behavior is pinned by EVID-011 because current web docs are v7 |
| EVID-013 | `client/package.json:6-9`; `server/package.json:12-17`; `client/AGENTS.md:44-51` | Manifest/instructions | Client has build only and no test runner; server has build and Node tests |

## Current system and relevant flows

FullCalendar is mounted with day-grid, time-grid, and interaction plugins. `datesSet` is the sole read trigger: it forwards the rendered range to `readPeriod`, which replaces the store's one event array. That array is mapped from `{ id, title, startAt, endAt, ... }` to FullCalendar's `{ id, title, start, end, extendedProps }`. Existing-event clicks open Edit mode (EVID-002 to EVID-004).

The current update path is store `updateEvent` → Axios PATCH → discard the returned event → `refreshActivePeriod`. No calendar mutation state changes during PATCH. Only the later GET sets global `status='loading'`; its failure is caught inside `readPeriod`, clears the event array, and does not reject `updateEvent`. Thus a PATCH may persist successfully, the refresh may fail, and the caller still observes success while the calendar becomes empty (`event-store.ts:135-161,186-196`). Two GETs for identical `from`/`to` also both pass `isSamePeriod`, so an older same-range response can overwrite newer optimistic or server-returned data (EVID-003).

Server PATCH validates a non-empty subset, loads the document, merges supplied and stored boundaries, enforces `endAt > startAt`, assigns only supplied fields, saves, and returns the mapped event directly. Unknown IDs are `404 NOT_FOUND`; malformed instants/spans are `400 VALIDATION_ERROR`. There is no version predicate, so two editors loading the same event can overwrite one another silently (EVID-005 to EVID-007).

## Findings

### Contracts and observable behavior

- **F-001 [Verified]** Current events are not draggable: the calendar supplies no editability/drop option (`EventCalendar.tsx:182-203`), and installed FullCalendar defaults `editable` to false (EVID-011).
- **F-002 [Verified]** All required view geometries already exist and use the interaction plugin (`EventCalendar.tsx:182-203`). No additional dependency is needed.
- **F-003 [Verified]** FullCalendar commits a valid same-calendar move before `eventDrop`, exposes `oldEvent`, updated `event`, and `revert()`, and suppresses a same-hit mutation or invalid target (EVID-011; official callback corroboration in EVID-012). This satisfies the library half of immediate display, snapshot input, rollback, and no invalid request.
- **F-004 [Verified]** Global `editable=true` would enable both moving and resizing; installed v6 derives `startEditable` and `durationEditable` from it. The no-resize boundary therefore requires start editability without duration editability (EVID-011).
- **F-005 [Verified]** Canonical `PATCH /api/events/:id` accepts both `startAt` and `endAt` in one non-empty partial body, retains all omitted fields, validates the merged span, and returns the updated event (EVID-005, EVID-006).
- **F-006 [Inference from F-003/F-005]** Every effective schedule move changes both absolute boundary instants, even when only the displayed date or time component changes. Sending both timestamp fields in one PATCH is consistent with REQ-012 through 016 and is safer than a one-sided boundary update.
- **F-007 [Verified]** The current event contract cannot reject stale updates: there is no readable token, accepted precondition, conflict code, or atomic version filter; `versionKey` is disabled and the archived design names the path last-write-wins (EVID-005, EVID-006, EVID-009).

### Data and invariants

- **F-008 [Verified]** The existing store is the required single owner of events, but it carries neither original schedule snapshots nor pending IDs (`event-store.ts:43-56`; `client/AGENTS.md:28-41`).
- **F-009 [Verified]** The API layer receives the successful `EventRecord`, but store `updateEvent` returns `Promise<void>` and discards it before a full refresh (`events.ts:32-39`; `event-store.ts:80-84,186-196`). That does not directly satisfy the draft's returned-response-as-final-truth wording.
- **F-010 [Verified]** The only duplicate-submission guard is local to the Event dialog. Its synchronous ref is sound for a single dialog session, but it cannot lock an event in the calendar (`use-async-action.ts:12-53`).
- **F-011 [Inference from F-003/F-008/F-009]** Relying only on FullCalendar's internal optimistic event while separately re-rendering store-derived old events creates two temporary authorities. Durable pending presentation and exact reconciliation require the sanctioned store to represent the optimistic schedule and per-event transaction, while FullCalendar remains the destination resolver.
- **F-012 [Verified]** Installed time-grid defaults to 30-minute `slotDuration`; absent a `snapDuration`, snapping inherits it (EVID-011). The project does not state an independent interval, so 30 minutes is runtime fact, not yet a product guarantee.
- **F-013 [Verified]** The current calendar uses FullCalendar's `local` timezone default, and the dialog likewise interprets schedule fields in the browser's zone before sending UTC ISO instants (`event-datetime.ts:1-50`; EVID-011, EVID-012).
- **F-014 [Decision needed]** Across DST/offset transitions, “same wall-clock start/end” and “same elapsed duration” can conflict. The PRD mandates both but never states precedence, and the main events PRD defers timezone policy (EVID-001, EVID-009). Ordinary dates do not expose the conflict.
- **F-015 [Verified]** The API supports a deleted-during-drag outcome as `NOT_FOUND`, but events have no archive/lifecycle state; “archived event” has no current domain meaning (`event-api/spec.md:54-63,210-223`).
- **F-016 [Verified]** The client can distinguish transport from the four current server codes at the Axios boundary, then loses that distinction when the store throws a message-only `Error` (EVID-007).
- **F-017 [Decision needed]** The draft's `EVENT_NOT_FOUND`, `INVALID_EVENT_DATE`, `INVALID_EVENT_TIME`, and `EVENT_UPDATE_FAILED` examples do not exist in the common contract. Existing generic `NOT_FOUND`, `VALIDATION_ERROR`, `INTERNAL_ERROR`, and the client-only transport marker already cover those categories; only a concurrency conflict has no equivalent (EVID-007).

### Project patterns and constraints

- **F-018 [Verified]** The archived client design intentionally excluded optimistic updates and requires a post-success period reread (EVID-009). Main specs do not prohibit optimism, so this is a deliberate design revision, not a main-spec contradiction.
- **F-019 [Verified]** The active `add-users-server-api` change does not alter events, but it widens the same shared error envelope and code map. Drag work must compose with its delta rather than restore the old exact set (EVID-010).
- **F-020 [Inference from EVID-010]** An explicit domain `version` is the best-fit concurrency direction: the draft anticipates a body concurrency field, event list data is the only event read surface, and the active users change establishes domain versions while keeping Mongoose `versionKey:false`. ETag/`If-Match` remains viable but would need per-event validators to be transported from a collection response.
- **F-021 [Verified]** Edit mode already changes date/start/end through standard form controls, so the non-pointer accessibility fallback exists (EVID-008).
- **F-022 [Unknown]** Existing data may contain multi-day events because the API enforces only `endAt > startAt`; the main PRD leaves multi-day/all-day policy open. No deployed database was inspected (EVID-005, EVID-009).

### External contracts

- **FullCalendar 6.1.21:** the exact installed source, not current v7 docs, establishes the operative behavior. Drag applies the same calendar delta to start and end, valid mutation is merged before `eventDrop`, and `revert()` merges the pre-change event store. Invalid/no-op hits do not emit `eventDrop` (EVID-011).
- **FullCalendar public API:** official documentation confirms `eventDrop` supplies old/new data and a failure-oriented `revert()`, editability can separate moving from resizing, snapping follows `snapDuration`, and `local` timezone uses the browser zone (EVID-012, accessed 2026-08-16). No v7-only behavior is required by the recommendation.

## Options and research-informed direction

| Direction | Evidence-supported benefits | Costs and risks | Reversibility |
| --- | --- | --- | --- |
| Client-only drag using current PATCH | Smallest contract surface; FullCalendar already supports move/revert | Cannot satisfy stale-write rejection; loses error classification; remains last-write-wins (F-007, F-016) | High, but requirements remain unmet |
| FullCalendar owns transient movement; store only sends/refetches | Uses native optimistic primitive and existing mutation path | Two temporary authorities; pending-driven React updates or same-period reads may restore stale times; response is discarded (F-009, F-011) | Medium |
| Store-owned per-event optimistic transaction plus coordinated API version guard | Aligns with sanctioned state ownership; supports per-ID pending/rollback, direct response reconciliation, and genuine conflict detection (F-008 to F-011, F-020) | Cross-package contract/data change; pre-existing event versions need a safe initialization policy; DST and multi-day decisions remain | Medium |
| ETag/`If-Match` concurrency instead of a body version | Standard HTTP conditional-write semantics; keeps token out of PATCH JSON | The only read is a collection, so each event still needs an exposed validator; differs from draft examples and active users precedent | Medium |

### Recommended direction

Use the coordinated store/API direction. FullCalendar should remain the sole resolver of valid destination date/time and slot snapping; enable start movement while keeping duration resizing disabled. The existing Zustand store should remain the sole application authority for optimistic schedule, original snapshot, per-event pending lock, typed outcome, rollback, and adoption of the returned event. Success should reconcile from the PATCH response; conflict/deletion should roll back and refresh current server data. Keep the canonical partial PATCH and add an atomic precondition, preferably an explicit event-domain `version` present on every event read and required by schedule updates, with a 409 conflict code that composes with the shared envelope. Preserve current generic error codes unless product explicitly declares the draft examples normative.

This direction does not settle D-002 or D-003 below. Schedule specifications must define the DST precedence and multi-day eligibility before those edge behaviors can be claimed. Pin the observed 30-minute slot/snap interval in the calendar contract if that is intended to remain product behavior; otherwise name the chosen interval explicitly.

## Risks and edge cases

| ID | Risk or edge case | Evidence | Likelihood | Impact | Constraint for later artifacts |
| --- | --- | --- | --- | --- | --- |
| R-001 | Two stale editors silently overwrite schedules | F-007 | High under multi-operator use | High | Concurrency must be an atomic server write precondition, not a client comparison |
| R-002 | DST move cannot preserve both elapsed duration and both wall-clock endpoints | F-013, F-014 | Low-frequency | High correctness ambiguity | Resolve D-002 and cover offset-transition examples |
| R-003 | Store re-render restores old values over FullCalendar's internal optimistic move | F-009, F-011 | Medium | High UX/data confusion | One application owner must contain the optimistic schedule |
| R-004 | Rapid duplicate drop starts two writes before UI disables | F-010 | Medium | High | Per-event lock must be synchronous at transaction entry, not visual state alone |
| R-005 | Older same-range GET overwrites newer optimistic/response data | `event-store.ts:89-98,135-160` | Medium | High | Same-period reads need ordering/reconciliation protection |
| R-006 | PATCH succeeds, follow-up refresh fails, caller sees success while events clear | `event-store.ts:151-161,186-196` | Medium | High | Do not make successful drag truth depend solely on a swallowed GET failure |
| R-007 | Conflict/not-found/transport collapses to generic message before recovery policy | F-016, F-017 | Certain today | High | Preserve machine-readable cause through rollback/message/refresh handling |
| R-008 | Enabling `editable` also exposes resize handles | F-004 | High if configured broadly | Medium | Start movement and duration editing must be controlled separately |
| R-009 | Event is deleted while PATCH is pending | F-015 | Low-medium | Medium | Roll back, remove stale event through refresh, and show not-available copy |
| R-010 | Multi-day event crosses cells/dates with undefined drag semantics | F-022 | Unknown | High | Resolve D-003; do not silently assume single-day data |
| R-011 | User changes view/period while a drag request is pending | EVID-003, REQ-028 | Medium | Medium | Completion/rollback must not inject an event blindly into a different active-period array |
| R-012 | Another event may remain usable while one is pending, producing concurrent successes in one period | REQ-018; R-005 | Medium | Medium | Per-ID locks and same-period reconciliation must coexist |
| R-013 | Clicking/editing the same event while its drag is pending creates overlapping mutation origins | EVID-008, F-010 | Low-medium | High | Define same-event interaction eligibility during pending state |
| R-014 | No automated client coverage exists for drag, rollback, pending, or DST | EVID-013 | Certain | High regression risk | Verification must not claim these behaviors from build success alone |
| R-015 | Adding versions to existing stored events has an unknown migration/default state | F-020, F-022 | Unknown | High | Inspect authorized data and define initialization/rollback before deployment |

## Unknowns, assumptions, and decisions needed

| ID | Type | Item | Impact if wrong | How to resolve |
| --- | --- | --- | --- | --- |
| D-001 | Decision needed | Event concurrency transport/token and conflict code; recommended explicit domain `version` plus `EVENT_VERSION_CONFLICT` at 409 | REQ-029 remains impossible or clients overwrite newer data | Resolve in proposal/design with synchronized event-api and client contracts |
| D-002 | Decision needed | At offset transitions, does original “duration” mean elapsed milliseconds or displayed wall-clock span, and which wins over unchanged month-view endpoint times? | Different persisted `endAt` and visible end time | Product decision with forward/backward DST scenarios |
| D-003 | Decision needed | Are multi-day timed events draggable, or explicitly ineligible until multi-day behavior is specified? | Date shifts may change visible span or violate scope | Align with the open main-PRD multi-day decision before specification |
| D-004 | Decision needed | Are REQ-031 error names illustrative or required replacements/additions? Recommended: retain generic current codes and add only the missing conflict code | Unnecessary breaking shared-contract churn or failure to meet expected code names | Product/API owner confirms taxonomy; compose with `add-users-server-api` |
| D-005 | Decision needed | Should 30-minute slot/snap behavior be a stable product rule? | Dependency defaults can change and acceptance precision stays ambiguous | Add an explicit calendar configuration decision |
| A-001 | Assumption | Past-event and overlap restrictions remain permissive because the drag PRD excludes them | Later policy could make currently valid targets invalid | Revisit only when corresponding requirements exist |
| U-001 | Unknown | Production/browser timezone distribution and events spanning DST transitions | Frequency of R-002 is unknown | Use supported target zones and representative offset-transition cases in verification |
| U-002 | Unknown | Deployed event collection contents, including multi-day events and documents requiring version initialization | Migration and eligibility risk cannot be sized | Authorized read-only data assessment before persistence contract rollout |
| U-003 | Unknown | Desired calendar-level feedback placement/copy for drag failures | Accessibility and recovery clarity | Product/UI decision; ensure an announced non-technical message exists |

## Handoff to OpenSpec

### Facts later artifacts may rely on

- F-001 through F-007: installed FullCalendar and the existing partial schedule PATCH are sufficient for move mechanics, but current events are non-draggable and the API is last-write-wins.
- F-008 through F-013: the event store is the mandated owner; its current mutation/refetch/error model does not meet optimistic drag semantics; runtime snap and display zone are presently 30 minutes and browser-local.
- F-015, F-016, F-018 through F-022: deletion, error, active-change, accessibility, and multi-day ground truth.

### Constraints later artifacts must preserve

- Use FullCalendar-resolved drop values, preserve event ID, issue one schedule PATCH, disable resizing, suppress unchanged/invalid/cancelled drops, and keep other events usable (F-003 to F-006, R-008).
- Keep one application state owner and preserve typed failure causes through recovery (F-008, F-011, F-016).
- Coordinate the event contract with the active shared-envelope delta (F-019) and do not invent archive semantics for events (F-015).

### Decisions proposal/design must resolve

- D-001 through D-005. D-001, D-002, and D-003 are blocking for complete requirements coverage.

### Behaviors specs must define precisely

- View-specific movement and timestamp derivation, including slot precision and duration semantics (RQ-001, RQ-005, R-002).
- The per-event optimistic lifecycle: immediate move, synchronous duplicate guard, pending presentation, response adoption, exact rollback, and navigation/concurrent-event interactions (RQ-003, R-003 to R-006, R-011 to R-013).
- Stale-write, deleted-event, validation, server, and transport outcomes with their message and refresh behavior (RQ-006, R-001, R-007, R-009).
- No-op/cancel/invalid-target suppression, no resize, identity preservation, and Edit-dialog fallback (RQ-004, RQ-008).

### Verification concerns tasks must eventually cover

- Month date-only, week vertical/horizontal/diagonal, and day up/down drops; original ID and exact duration; both directions and 30-minute boundaries.
- No request for same hit, outside target, invalid target, or view change; exactly one request during rapid repeat activation.
- Immediate event-scoped pending UI, unaffected-event usability, response normalization, rollback, and announced error.
- Conflict and concurrent deletion with server refresh; competing same-period responses; navigation during pending work.
- Offset-transition and multi-day cases after D-002/D-003; server atomic version conflicts and pre-existing-version initialization.
- Client build is not behavioral evidence: no client test runner exists (EVID-013). Server contract assertions can use the existing Node test surface once the contract changes.

## Not investigated

- Authorization, notifications, collision rules, recurring events, and past-event restrictions were intentionally excluded by the supplied PRD.
- Production database contents and deployed runtime behavior were not inspected; no credentials or remote state were used.
- Alternative calendar/drag libraries were not compared because the installed exact version already provides every required interaction primitive.
- Detailed visual styling was not researched beyond the current custom event renderer lacking pending/error state; it does not change contract feasibility.
- No implementation, proposal, specification, design, task decomposition, estimate, build, or test run was performed.
