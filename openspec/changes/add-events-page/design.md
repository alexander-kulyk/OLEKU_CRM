## Context

See `proposal.md` — Why. The requirements this design serves live in `specs/event-calendar`, `specs/event-management`, and `specs/event-participants`.

The repository is effectively greenfield, which is the dominant constraint: this change establishes the first patterns the rest of the CRM will copy.

- `server/src/app.ts` builds an Express 5 app with `helmet`, `cors`, `morgan`, JSON parsing, a `/api/health` route, a 404 handler, and an error handler. There is no router layer, no validation layer, and no domain model.
- Persistence is MongoDB Atlas via Mongoose 9. `shared/infra/mongoose/client.ts` connects and disconnects; **no schemas exist**. Mongo has no migrations and no foreign keys — every invariant this design needs must be enforced in the application layer or by an index.
- The `OLEKU_CRM` database already holds four collections — `contacts`, `employees`, `events`, `users` — and all four are **empty, with no validators and no indexes beyond `_id`**. They are placeholders that fix the domain vocabulary, not a schema: nothing constrains what this change writes into them, but the names are settled and this change adopts them rather than introducing parallel ones.
- `users` is the future authentication surface and is out of scope here. Event participants are *contacts* and *employees* — the people the business serves and the people who work there — not login accounts.
- The cluster is a shared personal Atlas cluster hosting unrelated databases as well. Nothing in this change may treat it as disposable.
- The server runs TypeScript directly on Node 24 (`node --watch src/main.ts`) using native type stripping, so **all relative imports carry explicit `.ts` extensions** and no build step runs in development. Only erasable TypeScript is allowed — no enums, no parameter properties, no decorators.
- `client/src/App.tsx` is a placeholder heading and `router.tsx` has a single `/` route. Styling is Tailwind v4 via the Vite plugin; there is no component library.
- The client follows Feature-Sliced Design per `.ai_toolkit/skills/feature-sliced-design`: layers `app → pages → features → shared`, no cross-slice imports within a layer, every slice consumed through an `index.ts` barrel, no business-domain code in `shared`.
- FullCalendar (core, react, daygrid, timegrid, interaction), TanStack Query, React Hook Form, and Zod 4 are installed in `client` but entirely unused. `zod` is not yet a `server` dependency.
- Neither package has a test runner, linter, or formatter configured.

## Goals / Non-Goals

**Goals:**

- Establish the server's request-handling shape — module folder, Zod-validated input, a single error envelope — in a form the next feature can follow.
- Establish the client's FSD slice structure and the first real route.
- Model events and participants so the assignment semantics in `specs/event-participants` (edits persist only on save, no duplicates) fall out of the data model rather than defensive code.
- Compensate deliberately for the invariants MongoDB will not enforce.
- Keep the dependency footprint near flat, using what is already installed.

**Non-Goals:**

- Authentication, authorization, and roles. The endpoints in this change are unauthenticated.
- A shared client/server types package. Worth doing, but it is a workspace-restructuring decision that should not ride along with the first feature.
- A design system or reusable component library. Components are local to the events slice until a second consumer exists.
- Pagination for the directory endpoints — search plus a result cap only.

## Decisions

### Store two UTC instants per event, not date + wall-clock times

The `events` collection stores `startsAt` and `endsAt` as BSON `Date` values, both UTC. The form's three fields (date, start time, end time) compose into these at the client boundary and decompose back when populating Edit mode.

Range queries (`startsAt < to AND endsAt > from`) are the calendar's only read pattern, and FullCalendar's event model is instant-based, so this keeps both ends trivial. A compound index on `{ startsAt: 1, endsAt: 1 }` serves it. The alternative — a date string plus two time strings — mirrors the form more literally but makes every range query a composed expression and pushes the same conversion work into the query layer.

`endsAt > startsAt` has no database-level enforcement available: Mongo has no check constraints, and MongoDB's JSON-schema validators cannot compare two fields to each other. The rule is therefore enforced twice in the application layer — in the Zod request schema and again in a Mongoose `pre('validate')` hook, so a write that bypasses the route still cannot store an inverted range.

### UTC storage with browser-local rendering

Conversion happens once at each client boundary: local wall-clock in, UTC out on submit; UTC in, local wall-clock out on load. The server never interprets a time zone.

Time-zone handling is an open product decision (§18 of the source document), so this is the default cheapest to change later — adding a per-business or per-event zone means adding a field and moving the conversion server-side, without restating what is stored.

The visible consequence: a user who changes time zone sees existing events shift. That is correct for instant-based scheduling and wrong for "the lesson is at 4pm wherever I am". Only the product decision can settle which is intended.

### Models bind explicitly to the existing collections

Each Mongoose model declares its `collection` name rather than relying on Mongoose's automatic pluralization: `Event → events`, `Contact → contacts`, `Employee → employees`. Automatic pluralization happens to produce the same three names today, which is exactly why the binding is written down — an implicit match is indistinguishable from a coincidence, and a later model rename would silently start writing to a new collection.

The empty collections are adopted as-is. Nothing needs to be created or dropped; the schemas simply describe what will be written into them, and the declared indexes are built on first connection.

### Contacts and employees carry a split name

Both directory schemas are `{ firstName, lastName, email?, timestamps }` with `firstName` and `lastName` required, plus a `fullName` virtual used for display. Reads expose `{ id, firstName, lastName, fullName }`.

Split fields are the CRM convention and keep sorting and searching by last name available without parsing. A single `name` string would be marginally simpler for a selector that only ever renders a full name, but the Client Management and Employee Management changes will own these records properly, and splitting a populated `name` field later means a backfill against real data.

This is the minimum shape the Events page needs, deliberately: everything else a contact or employee record will eventually carry — phone, notes, history, role — belongs to those later changes, which extend this schema rather than replace it. Search matches against either name part.

### Participants are embedded reference arrays on the event document

The event document holds `attendeeIds: ObjectId[]` (referencing `contacts`) and `hostIds: ObjectId[]` (referencing `employees`).

This is the document-database counterpart of join tables, and it fits the access pattern exactly: participants are only ever read and written as part of their event, the arrays are small and bounded by how many people fit in a lesson, and the calendar's range query returns everything the dialog needs in one round trip. Separate `eventAttendees` / `eventHosts` collections would import a relational habit with no payoff here — every read would need a `$lookup`, and every write a multi-document transaction, to reconstruct what a single document already expresses.

Two arrays rather than one array of `{ personId, role }`: attendees reference contacts and hosts reference employees, so they point at different collections. A single array would need a discriminator plus a per-role reference field and would give up the ability to `populate` either role directly.

The cost is that Mongo enforces no referential integrity. Two compensations, both specified in `specs/event-participants`: writes verify that every submitted id exists in its collection and reject unknown ids, and reads tolerate a missing reference by dropping it rather than failing the whole query. Deleting a contact or employee is not possible in this change, so no cascade is needed yet — the future Client and Employee Management change owns that decision.

### Participants are replaced wholesale on write, not patched incrementally

`POST /api/events` and `PATCH /api/events/:id` accept `attendeeIds` and `hostIds` as the complete intended set. The stored arrays are replaced with what the request carries.

This maps one-to-one onto "participant edits persist only on save": the form holds intent, the request carries intent, and nothing is written until the user commits. Incremental `POST /events/:id/attendees` endpoints would persist each add and remove immediately, directly contradicting `specs/event-participants` and requiring the client to track and replay an undo log when the user discards.

Duplicates are then prevented in two independent places: the Zod schema de-duplicates the incoming array, and the Mongoose path carries a setter that de-duplicates again before any write. Because assignment is a whole-array replacement, there is no state in which a duplicate can accumulate.

### API surface

```
GET    /api/events?from=<iso>&to=<iso>     → events overlapping [from, to)
POST   /api/events                          → create
PATCH  /api/events/:id                      → update
DELETE /api/events/:id                      → delete
GET    /api/contacts?search=&limit=         → eligible attendees
GET    /api/employees?search=&limit=        → eligible hosts
```

Reads return participants resolved to `{ id, firstName, lastName, fullName }` rather than bare ids, so the dialog can render assigned chips from the calendar's payload alone and never needs the full directory just to display an event it already has. Writes take ids. The asymmetry is deliberate: it keeps the read self-sufficient and the write minimal.

`from` and `to` are required on the list endpoint. An unbounded "all events" read has no caller — the calendar always knows its visible period — and refusing it keeps the collection scan from ever becoming the default.

### Native date and time inputs

`<input type="date">` and `<input type="time">` styled with Tailwind, as confirmed with the user. The browser supplies the date picker and hour/minute selection that `specs/event-management` requires, plus keyboard and screen-reader behavior, for zero bundle cost.

The rejected alternative was MUI X pickers, which the root `package.json` currently references. `@mui/x-date-pickers` needs `@mui/material` and Emotion as peers — neither installed — which would put a second styling system next to Tailwind v4 for the sake of two fields. The stray root-level `@mui/x-date-pickers` and `zustand` entries are removed as part of this change; in a pnpm workspace they are not resolvable from `client/` anyway.

The trade-off is that picker chrome and display format vary across browsers. Acceptable: the spec explicitly permits locale-dependent display, and `step="60"` pins time granularity to whole minutes.

### Native `<dialog>` for the Event dialog and both confirmations

`showModal()` provides the modal backdrop, focus trapping, and Escape handling that `specs/event-management` requires, without a headless-UI dependency.

Escape needs interception rather than the default: the element's `cancel` event is `preventDefault()`-ed and routed through the same close handler as the close icon and the backdrop click, so all three routes hit the dirty check identically — which is exactly what the spec requires of them. Backdrop clicks are detected by comparing the click target against the dialog element itself.

The delete and discard confirmations are the same `ConfirmDialog` primitive with different copy and actions, nested inside the Event dialog so the dialog stays visible behind them.

### Attendee and host lists live inside form state

Assigned attendees and hosts are React Hook Form fields, not separate `useState`. This is what makes `formState.isDirty` a correct answer to "are there unsaved changes" — the discard confirmation must fire when the only change is a removed attendee (`specs/event-management`), and it would not if participants lived outside the form.

Pending selector selections stay in local component state: they are not part of the event until Add moves them in, and a pending selection must not trigger the discard prompt.

### One `events` feature slice, not separate calendar and dialog slices

FSD forbids cross-slice imports inside a layer. The calendar and the dialog share the event query keys, the fetch functions, and the mutation invalidations — splitting them into `features/event-calendar` and `features/event-dialog` would force either a forbidden cross-slice import, a premature `entities` layer, or business-domain code pushed down into `shared`, which the project's FSD rules call a smell.

So the capability boundary in the specs (three capabilities) and the code boundary (one slice) deliberately differ. The specs describe behavior; the slice is the unit of code isolation.

```
client/src/
  app/
    providers/      query-client provider
    router/         router.tsx
  pages/
    EventsPage/     ui/, index.ts
  features/
    events/
      ui/           EventCalendar, EventDialog, EventDetailsFields,
                    ParticipantSection, EventFormActions
      model/        form schema, mapping, query keys, hooks
      api/          events.ts, directory.ts
      lib/          datetime helpers
      index.ts
  shared/
    api/            http client, error envelope parsing
    components/     Modal, ConfirmDialog, Field, Button, Spinner
    lib/            generic helpers
```

`ParticipantSection` is one component used twice — `specs/event-participants` defines the host section as following the attendee section's interaction model exactly, so two copies would be two things to keep in sync.

```
server/src/
  modules/events/     event.model.ts, event.schemas.ts, event.service.ts, event.routes.ts
  modules/directory/  contact.model.ts, employee.model.ts, directory.service.ts, directory.routes.ts
  shared/http/        error-envelope.ts, error-middleware.ts, validate.ts
  shared/db/          seed.ts
```

### Validation schemas are duplicated, deliberately

The same rules are expressed as a Zod schema on the client (via `@hookform/resolvers/zod`, the one new runtime dependency) and again on the server (`zod` added to `server`). The server cannot delegate validation to the client, and there is no shared workspace package to hold a single copy. Duplication is the honest cost of not restructuring the workspace in this change; it is small and self-contained, and a future `shared/` package can collapse it.

### A single error envelope

Failures return `{ error: { code, message } }` with an appropriate status. The client maps `code` to user-facing copy rather than displaying the server's `message`, which keeps `specs/event-management`'s "no technical detail" requirement enforceable on the client side and prevents a leaked driver or validation error from reaching a user. The existing error middleware in `app.ts` is rewritten to be the single place that shapes this — today it forwards `error.message` and, outside production, a stack trace.

### Testing

**Server** — integration tests with Node 24's built-in `node:test` runner (`node --test`), no test framework dependency. They exercise the routes against a real Mongoose connection backed by `mongodb-memory-server`, the one new server dev dependency, so a run needs no external database and each run starts from a clean state. Coverage targets the rules that matter most: range filtering at period boundaries, `endsAt > startsAt` rejection, unknown participant ids rejected, duplicate ids collapsed, wholesale participant replacement on update, and the error envelope's shape.

The in-memory server is not merely convenient here — the only configured database is a shared hosted Atlas cluster, and a suite that truncates collections between tests must be structurally incapable of pointing at it. The test helper therefore builds its connection string from the in-memory instance and never reads `DB_HOST`. The trade-off accepted is `mongodb-memory-server`'s one-time binary download on first run.

**Client** — Vitest with `@testing-library/react` and jsdom. Tests cover what carries the subtle rules: the dialog's mode-dependent actions, validation gating of the commit action, the three close routes reaching the same dirty check, `ParticipantSection`'s add/remove/duplicate behavior, and the local↔UTC mapping functions. The API layer is stubbed with `vi.mock` on the slice's `api` segment rather than adding MSW — the slice already funnels every request through those functions.

FullCalendar itself is not unit-tested. It does not render meaningfully in jsdom, and testing it would test the library rather than this change; the calendar scenarios in `specs/event-calendar` are verified manually against the acceptance criteria, with the date-range and mapping logic that feeds it covered directly.

## Risks / Trade-offs

**Unauthenticated endpoints against a shared Atlas cluster** → The database is hosted MongoDB Atlas, not a local instance, so anyone reaching the server can read and modify every event and the full contact and employee directory in the real cluster. Roles are out of scope by the source document, but this is a real exposure, not a stylistic gap: the API must not be deployed beyond local development until the authorization change lands. Recorded here so it is known debt rather than a later discovery.

**No referential integrity in MongoDB** → A participant id can point at a document that no longer exists. Mitigated by validating ids on write and dropping unresolvable references on read; revisited when contact and employee deletion becomes possible.

**This change fixes the shape of collections other features will share** → `contacts` and `employees` are empty today, so the schemas defined here are the first word on records that Client Management and Employee Management will own. Mitigated by keeping the shape minimal and additive — required first and last name, optional email — so later changes extend it rather than migrate it.

**Time-zone semantics may be wrong** → See the storage decision. Mitigated by confining conversion to one module (`features/events/lib`) so a product ruling changes one file plus a data backfill.

**Duplicated Zod schemas drift** → Server tests assert the server-side rules independently, so client-side drift surfaces as a rejected request rather than silent divergence.

**FullCalendar under React 19 StrictMode** → Double-mounting in development can produce duplicate render artifacts. Mitigated by treating the calendar as an uncontrolled component: events flow in as props from the query cache, and imperative API calls go through a single ref.

**Unbounded directory growth** → With no pagination, a large contact list makes the selector slow and the payload large. Accepted for now — server-side `search` filtering with a result cap is in scope, pagination is not, and current volumes do not justify it.

**Native `<dialog>` and native pickers vary across browsers** → Appearance and picker chrome differ per browser and locale. Accepted: the spec permits locale-dependent display, and the behavioral contract (focus trap, Escape, backdrop) is consistent across current browsers.

## Migration Plan

1. Define the Mongoose schemas against the collections that already exist. MongoDB needs no migration step, and the collections need no creation — Mongoose builds the declared indexes on first connection, which is instant against empty collections.
2. Seed `contacts` and `employees` with a handful of people. The attendee and host acceptance criteria cannot be exercised against empty collections, and there is no management UI to populate them. The seed is idempotent — it upserts by email — because it writes to the real Atlas cluster, not a throwaway database.
3. Ship server and client together. There is no deployed consumer, so no compatibility window is needed.

Rollback: delete the documents this change wrote and drop the indexes it declared, then revert the commit. The four collections predate this change and stay. Safe only while the database holds no real data — which stops being true after this change.

## Open Questions

- **Result cap for directory search.** A cap is needed; the specific number can be tuned against seeded data during implementation without affecting the API shape.
- **Where shared request/response types eventually live.** A `shared/` workspace package would remove the duplicated Zod schemas, but restructuring the workspace is its own change and does not affect anything decided here.

Everything else in §18 of the source document is a product decision, deferred as recorded in the proposal — not an engineering unknown.
