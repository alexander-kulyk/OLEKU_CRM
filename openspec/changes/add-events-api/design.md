## Context

See `proposal.md` — Why. The behavior this design serves lives in `specs/api-foundation`, `specs/event-api`, and `specs/directory-api`.

The server is greenfield below `app.ts`, which is the dominant constraint: this change fixes the module shape every later feature copies.

- `server/src/app.ts` builds an Express 5 app with `helmet`, `cors`, `morgan`, body parsers, `GET /api/health`, a catch-all 404 that echoes `req.originalUrl` back to the caller, and an error handler that forwards `error.message` plus a stack trace outside production. There is no router layer, no validation layer, and no domain model.
- The server runs TypeScript natively on Node 24 (`node --watch src/main.ts`), so **relative imports carry an explicit `.ts` extension** and **only erasable TypeScript is allowed** — no enums, no parameter properties, no decorators.
- Persistence is MongoDB Atlas via Mongoose 9. `shared/infra/mongoose/client.ts` connects and disconnects; no schemas exist. Mongo has no migrations, no foreign keys, and no check constraints — every invariant must be enforced in the application layer or by an index.
- `contacts`, `employees`, `events`, and `users` already exist in the `OLEKU_CRM` database, all empty, with no validators and no indexes beyond `_id`. They fix the domain vocabulary, not a schema.
- The cluster is a shared personal Atlas cluster hosting unrelated databases. Nothing here may treat it as disposable.
- `zod` is not yet a server dependency, and neither package has a test runner.
- The consumer is FullCalendar 6.1.21, already installed in `client` and entirely unused. Its behavior is a hard input to this design and is treated as such below.

## Goals / Non-Goals

**Goals:**

- Establish the server's request-handling shape — controller, service, model, boundary validation, one error envelope — in a form the next feature copies without thinking about it.
- Guarantee the read payload drives FullCalendar without loss, ambiguity, or silent misrendering, while keeping the calendar library out of the API contract.
- Enforce, server-side, every invariant Mongo will not: span ordering, participant existence and eligibility, single assignment per person.
- Make the destructive failure modes structurally impossible rather than merely avoided — an unbounded read, a test suite pointed at Atlas, a client-set audit field.

**Non-Goals:**

- Any client code. The mapping to FullCalendar is documented here for the client implementer; it is not built here.
- Authentication and authorization. Endpoints are unauthenticated.
- A shared client/server types package. Worth doing; it is a workspace-restructuring decision that must not ride along with the first feature.
- Pagination for the directory. Search plus a result cap only.
- Reusing `server/dist/`. It is untracked build output from an uncommitted attempt and will vanish on the next clean build.

## Decisions

### The FullCalendar contract, verified against the installed package

This is the question the request asked to settle first, and three findings drive decisions below. Verified against `@fullcalendar/core@6.1.21` in `node_modules`, not from memory.

**Nothing is strictly required except a resolvable `start`.** An event with no parseable start is silently dropped from the calendar. `title`, `end`, `allDay`, and `extendedProps` are all optional.

**An `end` that is not after `start` is silently discarded** and replaced with the one-hour default duration. An inverted span therefore does not fail loudly — it renders as a plausible, wrong block. This is the argument for enforcing `endAt > startAt` server-side *twice*, at the boundary and in the model.

**Any unrecognized top-level key silently becomes an `extendedProps` entry.** A typo like `titel` does not error; the event renders untitled. A server that emits FullCalendar's own shape therefore has no failure signal for a misspelled field.

**`allDay` is inferred when omitted**, from whether the start and end strings specify a time. A full ISO instant resolves it to `false`, which is what this feature wants; a date-only string like `2026-08-10` would flip it to `true` and move the event into the all-day row. Hence the spec's requirement that returned instants always carry a time component and a zone designator.

**`end` is exclusive.** For a *timed* event this is a non-issue: the exclusive end and the real end instant are the same value. The classic off-by-one-day adjustment applies only to all-day events, which are out of scope. No adjustment is made, and this is recorded so nobody adds one.

**A JSON-feed source sends `start`, `end`, and `timeZone`** as query parameters, and the values come from an ISO formatter that appends the **browser's local numeric offset** whenever it is non-zero. A browser at UTC+03:00 sends `start=2026-08-01T00:00:00+03:00`, not a `Z` instant. See the range-parsing decision below — this is a live trap.

### Domain wire shape, with the mapping documented here

The API returns its own shape, not FullCalendar's:

```
{ id, title, startAt, endAt,
  attendees: [{ id, firstName, lastName, fullName }],
  hosts:     [{ id, firstName, lastName, fullName }] }
```

The client maps it in one function:

| API field | FullCalendar field | Note |
| --- | --- | --- |
| `id` (string) | `id` | Must be a string; the refiner is `String` |
| `title` | `title` | Verbatim — the names already match |
| `startAt` | `start` | ISO instant is a valid `DateInput` |
| `endAt` | `end` | Exclusive boundary; for a timed event this *is* the real end |
| `attendees`, `hosts` | `extendedProps.attendees`, `extendedProps.hosts` | Nest explicitly; never rely on the leftover-key path |
| — | `allDay` | Omit — correctly inferred as `false` from timed instants |

The rejected alternative was emitting FullCalendar's native shape so the array could be handed straight to the `events` prop, or used as a JSON-feed URL. It saves one client function and costs the contract: a rendering library's vocabulary becomes the API every future consumer must speak, a FullCalendar major upgrade becomes an API change, and — because unknown keys become `extendedProps` — a server-side typo produces a silently untitled event instead of a failure. A dual-format second route was rejected as two contracts to keep in sync for one saved function.

Participants are returned **resolved on read** but taken as **bare ids on write**. The asymmetry is deliberate: it makes the calendar read self-sufficient, so the dialog can render assigned chips without also fetching the directory, while keeping writes minimal and unambiguous.

### Field names follow the request, not the committed change

`title`, `startAt`, `endAt` — replacing `name`, `startsAt`, `endsAt` in `openspec/changes/add-events-page`. `title` is FullCalendar's own property name, so it maps verbatim and removes one line of mapping. The collections are empty, so the rename costs nothing today and a backfill once data exists. `add-events-page` is not edited by this change; the divergence is recorded in `proposal.md` and listed as a risk below.

### Two UTC instants per event, not a date plus wall-clock times

`startAt` and `endAt` are BSON `Date` values, both absolute instants. The form's three fields — date, start time, end time — compose into these at the client boundary and decompose on the way back.

The overlap query `startAt < to AND endAt > from` is the calendar's only read pattern, and FullCalendar's model is instant-based, so this keeps both ends trivial. A compound index on `{ startAt: 1, endAt: 1 }` serves it. The alternative — a date string plus two time strings — mirrors the form more literally but turns every range query into a composed expression and pushes the same conversion work into the query layer instead of the client boundary.

The server never interprets a time zone. Conversion happens once at each client boundary. Time-zone policy is an open product decision (§18 of the source document); this is the reading cheapest to change, since a per-business or per-event zone means adding a field and moving conversion server-side without restating what is stored.

### Range parameters must accept a numeric offset, not only `Z`

The list query parses `from` and `to` with `z.iso.datetime({ offset: true })`, then converts to `Date`.

**Without the `offset` flag this endpoint would reject every request from a browser outside UTC** — Zod's plain ISO datetime accepts only a `Z` designator, and FullCalendar emits the local numeric offset. That is a total-failure bug that would look like a broken calendar, not a validation nicety, so it is called out here rather than left to the implementer. The same parsing applies to `startAt` and `endAt` in write bodies.

`z.coerce.date()` was rejected as the looser alternative: it accepts `"hello"`-adjacent garbage and, worse, accepts a zone-naive local string like `2026-08-01T10:00:00`, which would be silently interpreted in the *server's* zone. Requiring an explicit designator makes the instant unambiguous at the boundary.

### The range is required and bounded at 366 days

There is no unbounded read. The calendar always knows its visible period, so no caller needs one, and refusing it keeps a full collection scan from ever becoming the default path. 366 days covers the largest view a calendar of this shape produces, with a leap year's slack.

### Module layout: controller, routes, service, model

```
server/src/
  modules/events/     event.model.ts, event.schemas.ts, event.service.ts,
                      event.controller.ts, event.routes.ts
  modules/directory/  contact.model.ts, employee.model.ts, person-summary.ts,
                      directory.schemas.ts, directory.service.ts,
                      directory.controller.ts, directory.routes.ts
  shared/http/        error-envelope.ts, error-middleware.ts, validate.ts
  shared/db/          seed.ts
```

`server/CLAUDE.md` describes a module as model, routes, service. This splits the handler out into its own `*.controller.ts` file, as the request asked for: `routes.ts` wires paths to handlers and nothing else, `controller.ts` translates HTTP into a service call and a status code, and `service.ts` never sees a request or response object. The split is what keeps the services directly testable and keeps the layering visible in the file list rather than only in the code. It is an addition to the documented convention, not a departure from it.

Each router mounts under `/api` **above** the catch-all 404 and the error handler, which stay last.

### One error envelope, with codes the client can switch on

Failures return `{ error: { code, message } }`. Four codes cover this change:

| Code | Status | Raised when |
| --- | --- | --- |
| `VALIDATION_ERROR` | 400 | Boundary schema rejection, or a Mongoose `CastError` / `ValidationError` reaching the handler |
| `NOT_FOUND` | 404 | An event id matched nothing; an undefined route |
| `INVALID_PARTICIPANT` | 400 | A submitted attendee or host does not exist, is inactive, or is not eligible to host |
| `INTERNAL_ERROR` | 500 | Anything else |

The client maps `code` to user-facing copy rather than displaying `message`. That is what makes "no technical detail reaches the user" enforceable rather than aspirational — a leaked driver string cannot become UI copy if the UI never renders `message`. The middleware is the single place that shapes this, and it never emits a stack trace, in any environment. `INVALID_PARTICIPANT` is a distinct code precisely so the dialog can point at the right section instead of showing a generic form error.

The existing 404 handler is rewritten to stop echoing `req.originalUrl` — reflecting caller-controlled text back into a response body is a habit worth not establishing.

Success responses carry the resource directly. Collections are a named array (`{ events: [...] }`, `{ contacts: [...] }`) rather than a bare top-level JSON array; single resources are the object itself; delete returns 204 with no body. No `success` flag, no envelope timestamp.

### Participants are embedded reference arrays, replaced wholesale on write

The event document holds `attendeeIds: ObjectId[]` referencing `contacts` and `hostIds: ObjectId[]` referencing `employees`.

This fits the access pattern exactly: participants are only ever read and written as part of their event, the arrays are bounded by how many people fit in a lesson, and the calendar's range query returns everything the dialog needs in one round trip. Separate join collections would import a relational habit with no payoff — every read would need a `$lookup` and every write a transaction, to reconstruct what one document already expresses.

Two arrays rather than one array of `{ personId, role }`: attendees and hosts point at *different collections*, so a single array would need a discriminator plus a per-role reference field, and would give up direct population of either role.

Writes accept the complete intended set and replace the stored array. This maps one-to-one onto the product rule that participant edits persist only when the event is saved: the form holds intent, the request carries intent, nothing is written until the user commits. Incremental `POST /events/:id/attendees` endpoints would persist each add and remove immediately, contradicting that rule and forcing the client to replay an undo log when the user discards.

### Participant validation is one query per role, diffed

Create and update resolve each submitted set with a single query selecting `_id`, `status`, and — for employees — `canHostEvents`, then diff against what was submitted. A count comparison would be cheaper but could not distinguish *unknown* from *inactive* from *ineligible*, and the three deserve different messages. The message names the role and the rule; it never names a collection or echoes a driver error.

Eligibility is enforced on write, not only filtered on read. The directory endpoint's `canHostEvents` filter is a convenience for the selector; the write-side check is the actual rule. A field named `canHostEvents` that only ever filters a dropdown is decoration — the server has to be the one that refuses.

Already-assigned people are exempt on read: a person who goes inactive after being assigned stays visible on the event. Only *new* assignments are checked. Blocking the read would make an old event unopenable because of a later personnel change.

### Duplicates are collapsed twice, and dangling references are dropped on read

The Zod schema de-duplicates the incoming array, and the Mongoose path carries a de-duplicating setter so a write that bypasses the route still cannot store a duplicate. Because assignment is a whole-array replacement, there is no state in which duplicates can accumulate.

Mongo enforces no referential integrity, so a reference can outlive its target. Reads use `populate` with a field projection; Mongoose yields `null` for an unresolvable reference, and those are filtered out. Dropping is the right failure mode here: one deleted contact must not make an entire month of the calendar unreadable. Contact and employee deletion is not possible in this change, so no cascade is needed yet — the future management change owns that decision.

`endAt > startAt` is likewise enforced twice, in the Zod refinement and in a Mongoose `pre('validate')` hook. Mongo has no check constraints, and its JSON-schema validators cannot compare two fields to each other, so the model hook is the only backstop available. Given that FullCalendar silently renders an inverted span as a wrong one-hour block, a single layer of enforcement is not enough.

### Status and eligibility are string unions with a `const` map, not enums

`status` is `'active' | 'inactive'`, defaulting to `'active'`; `canHostEvents` is a boolean defaulting to `false` — host duty is opt-in, so an employee never becomes a host candidate by accident.

TypeScript `enum` is not erasable and Node's native type stripping rejects it, so the values live in a `const` object with a derived union type. This is a hard runtime constraint of the chosen toolchain, not a style preference.

The directory shape stays minimal on purpose. Everything else a contact or employee will carry — phone, notes, history, manager — belongs to the future Client Management and Employee Management changes, which extend this schema rather than replace it. Names are split into `firstName` / `lastName` with a `fullName` virtual: splitting a populated single `name` field later means a backfill against real data, and sorting by last name is a CRM expectation.

### Models bind explicitly to the existing collections

Each model declares its `collection` name rather than relying on Mongoose's pluralization: `Event → events`, `Contact → contacts`, `Employee → employees`. Automatic pluralization happens to produce the same three names, which is exactly why the binding is written down — an implicit match is indistinguishable from a coincidence, and a later model rename would silently start writing to a new collection.

`users` gets no model. It is the authentication surface and is not touched.

### Audit fields are declared, never accepted, never returned

`createdByUserId` and `updatedByUserId` are nullable `ObjectId` references to `users`, always written as `null`. The write schemas do not declare them, and Zod strips undeclared keys, so a body carrying `createdByUserId` cannot mass-assign it. They are omitted from the response projection as well — exposing a field that is structurally always `null` invites a client to build on it.

Declaring them now rather than adding them at authentication time costs nothing (Mongo needs no migration to add a field) and records the intent where the next implementer will find it. The rejected alternative — accepting an actor id from a header during development — would populate a forgeable audit trail, which is worse than an empty one.

### Directory search escapes pattern metacharacters and bounds its input

Search is a case-insensitive match against either name part. The term is escaped before it becomes a pattern, and its length is capped at the boundary.

Escaping is not optional: an unescaped user-supplied pattern is both a correctness bug (`.` matching any character) and a denial-of-service vector via catastrophic backtracking. A text index was the alternative and does not fit — `$text` matches whole words, and a selector needs substring and prefix matching as the user types. At the volumes this directory will hold, a scan behind a `{ lastName, firstName }` index is the right trade; pagination is a later concern, and the result cap is what keeps it honest until then.

### Testing: `node:test` against an in-memory MongoDB

Integration tests use Node 24's built-in test runner — no framework dependency — against real Mongoose backed by `mongodb-memory-server`, the one new dev dependency. Each run starts clean.

The in-memory server is not merely convenient. The only configured database is a shared hosted Atlas cluster, and a suite that truncates collections between tests **must be structurally incapable of pointing at it**. The test helper therefore builds its connection string from the in-memory instance and never reads `DB_HOST`. The accepted cost is a one-time binary download on first run.

Coverage targets the rules that would fail silently in production: overlap filtering at both period boundaries, offset-bearing ISO parsing (the regression test for the trap above), span-ordering rejection at both layers, participant existence / eligibility / activity, duplicate collapsing, wholesale replacement, dangling-reference tolerance, audit fields unset from a body that names them, and the envelope carrying no stack trace.

The existing `pnpm --filter server build` stays the verification gate; a `test` script is added alongside it, not in place of it.

### Seeding is idempotent and upserts by email

The attendee and host scenarios cannot be exercised against empty collections, and no management UI exists to populate them. The seed writes a handful of contacts and employees — including at least one inactive person and one employee not eligible to host, so the filters are exercisable — and upserts by email, because it runs against the real Atlas cluster and re-running it must not duplicate anyone.

## Risks / Trade-offs

**Unauthenticated write endpoints against a shared Atlas cluster** → Anyone who reaches the server can read and modify every event and the full directory in a real cluster hosting unrelated databases. Roles are out of scope by the source document, but this is exposure, not a stylistic gap. Mitigation: the API must not be exposed beyond local development until the authorization change lands. Recorded so it is known debt rather than a later discovery.

**The Zod / FullCalendar ISO offset mismatch** → Omitting `{ offset: true }` rejects every calendar request from a browser outside UTC, and it presents as an empty calendar rather than an obvious validation bug. Mitigation: an explicit regression test asserting that an offset-bearing range and its `Z` equivalent select the same events.

**No referential integrity in MongoDB** → A participant reference can outlive its target. Mitigation: validate on write, drop unresolvable references on read. Revisited when contact and employee deletion becomes possible.

**Divergence from `add-events-page`** → Two committed changes now describe the same server surface with different field names. Mitigation: `proposal.md` states the supersession explicitly. This remains a real inconsistency until `add-events-page` is revised, and anyone implementing the client from it will use the wrong field names.

**Audit fields are structurally empty** → There is no audit trail for events until authentication lands, and no way to answer "who created this". Accepted: the alternative is a forgeable trail. Revisit with the authentication change.

**Eligibility and status rules are inferred, not stated by the PRD** → The source document does not say that hosts must be eligible or that participants must be active; those rules follow from the requested fields. Mitigation: they are enforced only on *new* assignments, so the strictest consequence is a rejected write and not an unopenable event. Loosening either is a one-line change to the validation query.

**This change fixes collection shapes other features will share** → `contacts` and `employees` get their first schema here, and Client Management and Employee Management will own them later. Mitigation: the shape is minimal and additive, so later changes extend rather than migrate.

**`mongodb-memory-server` downloads a binary on first run** → The first test run is slow and needs network access. Accepted; the alternative is a suite that can reach Atlas.

**Unbounded directory growth** → With no pagination, a large directory makes the selector slow. Accepted for now: server-side search and a result cap are in scope, pagination is not, and current volumes do not justify it.

**Time-zone semantics may be wrong** → Storing instants is correct for "this lesson happens at this moment" and wrong for "the lesson is at 4pm wherever I am". Only the product decision settles it. Mitigation: no server-side zone interpretation, so changing the ruling adds a field rather than reinterpreting stored data.

## Migration Plan

1. Define the schemas against the collections that already exist. MongoDB needs no migration and the collections need no creation; Mongoose builds the declared indexes on first connection, which is instant against empty collections.
2. Run the seed to populate `contacts` and `employees`, including the inactive and non-host cases the filters need.
3. Ship the server alone. There is no deployed consumer and no client code depends on these endpoints yet, so no compatibility window is needed.

Rollback: delete the documents this change wrote, drop the indexes it declared, revert the commit. The four collections predate this change and stay. This is safe only while the database holds no real data — which stops being true once anyone uses the Events page.

## Open Questions

- **The directory result cap.** A cap is required by `specs/directory-api`; the specific number can be tuned against seeded data during implementation without affecting the API shape or any task.
- **Where shared request/response types eventually live.** A workspace `shared/` package would let the client import these contracts instead of restating them, but restructuring the workspace is its own change and does not affect anything decided here.

Everything else in §18 of the source document is a product decision, deferred as recorded in `proposal.md` — not an engineering unknown.
