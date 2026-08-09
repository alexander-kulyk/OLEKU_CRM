## Context

See proposal.md — Why. The starting point is five files: `main.ts` → `server.ts` → `app.ts`, plus `shared/config/env.ts` and `shared/infra/mongoose/client.ts`. `createApp()` registers middleware, `GET /api/health`, a catch-all 404 that reflects `req.originalUrl`, and an inline error handler that returns `error.message` in every environment and `error.stack` outside production. There are no modules, models, or routers.

Constraints this design must work inside (research.md F-015, F-017, EVID-006, EVID-007):

- TypeScript runs natively on Node 24, so **relative imports carry `.ts`** and only erasable TypeScript is legal — no `enum`, no parameter properties, no namespaces.
- `strict`, `noUnusedLocals`, `noUnusedParameters` are on.
- Feature code lives in `src/modules/<feature>/`, mounted under `/api` **above** the 404 and error handler, which stay last.
- `process.env` is read only in `env.ts`.
- Dependencies are installed from the repo root with pnpm and the lockfile committed.
- `contacts` and `employees` hold people; `users` is the authentication surface and gets no domain data.
- `pnpm --filter server build` is the gate that exists today; this change adds `pnpm --filter server test`.

## Goals / Non-Goals

**Goals:**

- One request shape every later feature copies: routes → controller → service → model, with validation at the boundary and a single error envelope.
- A wire contract that survives the two silent-failure modes of the calendar library rather than depending on the client to avoid them.
- Invariants enforced on the write path that is actually used, not on a path the code does not take.
- A verification gate that can prove the two traps research identified are closed.

**Non-Goals:**

- Any client code, including the FullCalendar mapping (documented here for the client change to consume, not implemented).
- Authentication, authorization, and anything that would give the actor fields a real value.
- Pagination beyond a bounded result cap, sorting options, or filtering the directory by anything other than status, host eligibility, and name search.
- Reconciling the two overlapping changes — proposal.md records deliberate coexistence.

## Decisions

### D1. Wire contract is domain-shaped; the client maps to FullCalendar

Endpoints return `{ id, title, startAt, endAt, attendees[], hosts[] }`. The client maps `title → title`, `startAt → start`, `endAt → end`, and participants into `extendedProps`.

*Why:* FullCalendar absorbs **any unrecognized top-level key into `extendedProps` without error** (research.md F-003). If the server emitted FullCalendar's own shape, a server-side typo would render an untitled event with no failure signal anywhere in the stack. Keeping the library's vocabulary out of the contract turns that class of mistake into a local client-side mapping bug.

*Alternative considered:* emit `{ title, start, end, extendedProps }` so the client can pass the array straight to the `events` prop. Rejected — it saves one small mapping function and permanently binds the API to a rendering library's naming.

*Mapping note for the client change:* `end` is exclusive in FullCalendar's range model, but for a **timed** event the exclusive end and the real end instant coincide, so no adjustment is needed (research.md F-007). The classic off-by-one-day correction applies only to all-day events, which are deferred by the PRD.

### D2. Instant parsing accepts a numeric offset, everywhere

Every instant crossing the boundary is parsed with an ISO datetime validator configured to accept an offset, not the default `Z`-only form.

*Why:* FullCalendar formats range parameters with `formatIso`, which substitutes `+HH:MM` for `Z` whenever the browser's local offset is non-zero, while Zod 4's `datetime()` accepts only `Z` unless `{ offset: true }` is passed (research.md F-005). The abandoned attempt under `server/dist/` used the default form — it would have rejected every request from a non-UTC browser and presented as an **empty calendar**, not an error. This is the single highest-value correction in the change, and it is invisible to anyone developing in UTC.

Instants are stored as UTC `Date` values and serialized back as ISO strings with a `Z` designator and a time component, which keeps the calendar from inferring an all-day event (research.md F-004).

### D3. Writes go through a document round-trip, not a bare query update

Create is `new Model(...).save()`. Update is *load → assign → save*. Delete is a direct query.

*Why:* Mongoose's `validate` is document middleware and does not fire on `findOneAndUpdate`/`updateOne`, and `runValidators` defaults to `false` on query updates (research.md F-009, EVID-017, EVID-018). An invariant written once as a schema validator would hold on create and silently vanish on update. The load-then-save path makes one enforcement site cover both, and the 404-on-missing behavior falls out of the load.

*Cost:* two round-trips per update and a lost-update window between load and save. Accepted — the Event dialog is single-user-per-event in practice and the PRD defines no concurrency rule.

*Alternative considered:* `findOneAndUpdate` with `runValidators: true` and `context: 'query'`. Rejected — it makes correctness depend on options that are easy to omit on the next endpoint, and update validators do not run schema-level cross-field checks the way document validation does.

### D4. The span invariant is checked in the service, before persistence

`endAt > startAt` is asserted in the service for both create and update, in addition to being expressed on the schema.

*Why:* it must hold on every write path (spec: *End must be strictly later than start*), and the service is the one place both paths pass through. The schema-level expression is defense in depth, not the primary guard — D3 explains why a schema-only guard is not sufficient on its own.

### D5. Participant validation is one resolve-and-check step

The service resolves all attendee ids against `contacts` and all host ids against `employees` in two queries, then checks: every id resolved, every person is active, every host has `canHostEvents`. Duplicates are collapsed before resolution.

*Why:* it satisfies four spec requirements (existence, eligibility, status, role separation) with a fixed two-query cost regardless of participant count, and it produces one clear rejection instead of a partial write. Role separation — contacts may not be hosts and employees may not be attendees — falls out of querying the two collections separately.

*Eligibility is enforced here rather than only filtered in the directory read* (decision D-003 in research.md): a `canHostEvents` flag that only shapes a dropdown is not a rule, and the directory endpoints are not the only way to reach the write path.

### D6. Module layout

```
src/modules/events/      event.model.ts  event.routes.ts  event.controller.ts  event.service.ts  event.schema.ts
src/modules/directory/   contact.model.ts  employee.model.ts  directory.routes.ts
                         directory.controller.ts  directory.service.ts  directory.schema.ts
src/shared/http/         error-envelope.ts  http-error.ts  validate.ts  error-handler.ts  not-found.ts
src/shared/db/seed.ts
```

`server/CLAUDE.md:13` describes a module as model/routes/service. The request asks for controllers, so `<feature>.controller.ts` is added between routes and service: routes wire paths and validation, controllers translate HTTP to service calls and back, services own the rules. Contacts and employees share one `directory` module because they share every read behavior and differ only in fields.

### D7. Error handling relies on Express 5's promise forwarding

Controllers are `async` and throw; no `try`/`catch` per handler and no async-wrapper dependency. Express 5.2.1's router forwards a rejected returned promise to `next(error)` (research.md F-008, EVID-019).

The centralized handler maps a typed `HttpError` to its status and code, a validation failure to 400, and anything else to a generic 500. It logs the real error server-side and **never** puts a message, stack, or driver text into the response (research.md R-011). The existing 404 is replaced with one that emits the envelope without reflecting `req.originalUrl`.

*This replaces existing behavior rather than extending it* — the current handler's `{ success, error, timestamp, stack }` shape is not preserved. Nothing consumes it: the client calls no API (research.md EVID-020).

### D8. Query shape and indexes

The calendar read is `startAt < to AND endAt > from`, backed by a compound index on `{ startAt, endAt }`. Directory reads are backed by an index supporting the status filter and name sort. Search is a case-insensitive match on either name part with the term **escaped as literal text** and length-capped before it reaches the query, which closes both the wrong-match and the pathological-backtracking risks (research.md R-009).

The result cap is enforced server-side: a caller asking for more than the maximum gets the maximum, not an error.

### D9. Dangling participants are dropped on read, not repaired

When a stored participant id no longer resolves, the event is returned with that participant omitted (research.md R-010).

*Why:* the alternative — failing the read — lets one deleted person make an entire calendar period unreadable. No delete path for people exists in this change, so this is a guard against a future one rather than a live condition.

### D10. Tests are `node:test` with `mongodb-memory-server`

A `test` script runs `node --test` against an in-memory MongoDB. Both packages are added properly to `server/package.json`; `mongodb-memory-server` is currently phantom-linked into `server/node_modules` and absent from the lockfile, as is `zod` (research.md F-019, R-006).

*Why a real database rather than mocks:* the two most valuable checks — that an offset-bearing range parameter selects the right events, and that the span invariant survives an update — are both about how a query and a write actually behave. Mocking the layer under test would verify nothing.

## Risks / Trade-offs

- **[The database's real contents are unverified — research.md U-001, R-007]** → No design decision here assumes empty collections. Before the first write, the actual collection names, document counts, and a sample document must be confirmed by someone who can read `server/.env`; the credential is denied to tooling by project settings. If documents exist under the older `name` / `startsAt` / `endsAt` naming, the models in this design will read them as untitled events with no times, and the plan needs revisiting before, not after, a write.
- **[`status` semantics are an unconfirmed assumption — research.md A-002]** → Read as an active/inactive lifecycle, with non-active people unassignable. D5 gives that assumption teeth by enforcing it on write, so if the intended values differ, D5's checks change with them. Carried forward as an assumption, not a fact.
- **[No authentication on endpoints that write to a hosted cluster — research.md R-002]** → Accepted debt; roles are out of PRD scope. It constrains deployment: this API must not be exposed beyond local development until an authorization change lands. The actor fields are declared and always null (proposal decision D-004) so the audit trail is empty rather than forged.
- **[Three tracked changes describe this same surface under conflicting field names — research.md R-003]** → Deliberate, per decision D-001. Two consequences ride along: whoever implements from `add-events-page` ships `name`/`startsAt`/`endsAt` instead of this contract, and all three changes declare the same new capability paths, so archiving more than one will require a manual spec reconciliation. Only one of the three should be implemented and archived.
- **[Load-then-save loses a concurrent update — D3]** → Accepted. The window is small, the PRD defines no concurrency rule, and the alternative costs the invariant guarantee. Revisit if multi-user editing of one event becomes real.
- **[Duplicate submission can create two events — research.md R-013]** → Not solved server-side. The PRD addresses it only as a client-side loading state (§15). No idempotency key is introduced; a retried create makes a second event.
- **[Time-zone policy is deferred by the PRD §18]** → Instants are stored as absolute moments. That is correct for "this specific moment" and wrong for "4pm wherever the user is". The storage semantics are stated explicitly (D2) so the eventual ruling can be applied deliberately rather than discovered.

## Migration Plan

No data migration is planned, and none can be planned until U-001 is resolved. Deployment is additive: new routers mount above the existing terminal handlers, and the only replaced behavior is the 404 and error handler pair, which has no consumer. Rollback is reverting the change — the indexes it declares are the only durable side effect, and dropping them affects nothing else.

## Open Questions

- Whether the result cap and the maximum search-term length should be configurable per endpoint or fixed constants. Fixed constants are assumed; making them configurable later changes no observable behavior at the cap's current value.
- Whether the seed should cover events as well as people. Assumed no — the calendar can be exercised by creating events through the API, while the selectors cannot be exercised against empty collections at all.
