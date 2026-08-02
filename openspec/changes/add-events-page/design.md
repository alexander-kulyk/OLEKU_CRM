## Context

See `proposal.md` — Why. The requirements this design serves live in `specs/event-calendar`, `specs/event-management`, and `specs/event-participants`.

The repository is effectively greenfield, which is the dominant constraint: this change establishes the first patterns the rest of the CRM will copy.

- `server/prisma/schema.prisma` declares a generator and datasource and **no models**; `server/prisma/migrations/` does not exist yet.
- `server/src/app.ts` builds an Express 5 app with `express.json()` and mounts no routes. There is no router layer, no validation layer, and no error middleware.
- The server runs TypeScript directly on Node 24 (`node --watch src/main.ts`) using native type stripping, so **all relative imports carry explicit `.ts` extensions** and no build step runs in development. `erasableSyntaxOnly` semantics apply — no enums, no parameter properties.
- `client/src/App.tsx` is a placeholder heading and `router.tsx` has a single `/` route. Styling is Tailwind v4 via the Vite plugin; there is no component library.
- FullCalendar (core, react, daygrid, timegrid, interaction), TanStack Query, React Hook Form, and Zod 4 are already installed but entirely unused.
- Neither package has a test runner, linter, or formatter configured.

## Goals / Non-Goals

**Goals:**

- Establish the server's request-handling shape — router module, Zod-validated input, a single error envelope — in a form the next feature can follow.
- Establish the client's feature-module shape under `client/src/features/`.
- Model events and participants so that the assignment semantics in `specs/event-participants` (edits persist only on save, no duplicates) fall out of the data model rather than defensive code.
- Keep the dependency footprint essentially flat, using what is already installed.

**Non-Goals:**

- Authentication, authorization, and roles. The endpoints in this change are unauthenticated.
- A shared client/server types package. Worth doing, but it is a workspace-restructuring decision that should not ride along with the first feature.
- A design system or reusable component library. Components here are local to the events feature until a second consumer exists.
- Client component tests — see the testing decision below.

## Decisions

### Store two UTC instants per event, not date + wall-clock times

`Event` holds `startsAt` and `endsAt` as `DateTime` (Postgres `timestamptz`), both UTC. The form's three fields (date, start time, end time) compose into these at the client boundary and decompose back when populating Edit mode.

Range queries (`startsAt < to AND endsAt > from`) are the calendar's only read pattern, and FullCalendar's event model is instant-based, so this keeps both ends trivial. The alternative — a `date` column plus two `time` columns — mirrors the form more literally but makes every range query a composed expression and pushes the same conversion work into SQL.

A DB-level check constraint enforces `endsAt > startsAt`, so the rule in `specs/event-management` holds even if a caller bypasses the API validation.

### UTC storage with browser-local rendering

Conversion happens once at each client boundary: local wall-clock in, UTC out on submit; UTC in, local wall-clock out on load. The server never interprets a time zone.

Time-zone handling is an open product decision (§18 of the source document), so this is the default that is cheapest to change later — adding a per-business or per-event zone means adding a column and moving the conversion server-side, without restating what is stored.

The visible consequence: a user who changes time zone sees existing events shift. That is correct for instant-based scheduling and wrong for "the lesson is at 4pm wherever I am". Only the product decision can settle which is intended.

### Participants are replaced wholesale on write, not patched incrementally

`POST /api/events` and `PATCH /api/events/:id` accept `attendeeIds: string[]` and `hostIds: string[]` representing the complete intended set. The server diffs against stored assignments inside a transaction.

This maps one-to-one onto "participant edits persist only on save": the form holds intent, the request carries intent, and nothing is written until the user commits. Incremental `POST /events/:id/attendees` endpoints would persist each add and remove immediately, directly contradicting the spec and requiring the client to track and replay an undo log when the user discards.

Duplicates are then prevented in two independent places: the server de-duplicates the incoming array, and `@@unique([eventId, customerId])` / `@@unique([eventId, employeeId])` on the join tables makes a duplicate unrepresentable.

### Separate join tables for attendees and hosts

`EventAttendee` links `Event` to `Customer`; `EventHost` links `Event` to `Employee`. The two roles reference different entities, so a single polymorphic `EventParticipant` table with a role discriminator would give up referential integrity on the person side and buy nothing — the sections are already specified as parallel-but-separate.

### Native date and time inputs

`<input type="date">` and `<input type="time">` styled with Tailwind, as confirmed with the user. The browser supplies the date picker and hour/minute selection that `specs/event-management` requires, plus keyboard and screen-reader behavior, for zero bundle cost.

The rejected alternative was MUI X pickers, which the root `package.json` currently references. `@mui/x-date-pickers` needs `@mui/material` and Emotion as peers — neither installed — which would put a second styling system next to Tailwind v4 for the sake of two fields. The stray root-level `@mui/x-date-pickers` and `zustand` entries are removed as part of this change; in a pnpm workspace they are not resolvable from `client/` anyway.

The trade-off is that picker chrome and display format vary across browsers. Acceptable: the spec explicitly permits locale-dependent display, and `step="60"` pins time granularity to whole minutes.

### Native `<dialog>` for both the Event dialog and the confirmations

`showModal()` provides the modal backdrop, focus trapping, and Escape handling that `specs/event-management` requires, without a headless-UI dependency.

Escape needs interception rather than the default: the element's `cancel` event is `preventDefault()`-ed and routed through the same close handler as the close icon and the backdrop click, so all three routes hit the dirty check identically. Backdrop clicks are detected by comparing the click target against the dialog element itself.

### Attendee and host lists live inside form state

Assigned attendees and hosts are React Hook Form fields, not separate `useState`. This is what makes `formState.isDirty` a correct answer to "are there unsaved changes" — the discard confirmation must fire when the only change is a removed attendee, and it would not if participants lived outside the form.

Pending selector selections stay in local component state: they are not part of the event until Add moves them in, and a pending selection must not trigger the discard prompt.

### Validation schemas are duplicated, deliberately

The same rules are expressed as a Zod schema on the client (via `@hookform/resolvers/zod`, the one new dependency) and again on the server. The server cannot delegate validation to the client, and there is no shared workspace package to hold a single copy. Duplication is the honest cost of not restructuring the workspace in this change; it is small and self-contained, and a future `shared/` package can collapse it.

### A single error envelope

Failures return `{ error: { code, message } }` with an appropriate status. The client maps `code` to user-facing copy rather than displaying the server's `message`, which keeps `specs/event-management`'s "no technical detail" requirement enforceable on the client side and prevents a leaked Prisma error from reaching a user. An Express error middleware is the single place that shapes this.

### Server tests with `node:test`; client behavior verified manually

The server gets integration tests for the events and directory endpoints using Node 24's built-in test runner — no new dependency, and it covers the rules that matter most (range filtering, duplicate rejection, `endsAt > startsAt`, wholesale participant replacement).

Client component tests are deliberately not added here. Vitest plus Testing Library plus a jsdom setup is its own change with its own conventions to settle, and bundling it would double this change's surface. The client scenarios in the specs are verified manually against the acceptance criteria, and the follow-up is called out in Open Questions rather than left implicit.

### Layout

```
server/src/
  modules/events/       { router, service, schemas }.ts
  modules/directory/    router.ts          # customers + employees, read-only
  shared/http/          error-envelope.ts, error-middleware.ts

client/src/features/events/
  EventsPage.tsx
  calendar/             EventCalendar.tsx
  dialog/               EventDialog.tsx, EventDetailsFields.tsx,
                        ParticipantSection.tsx, ConfirmDialog.tsx
  api/                  events.ts, directory.ts, queries.ts
  model/                schema.ts, mapping.ts
```

`ParticipantSection` is one component used twice — `specs/event-participants` defines the host section as following the attendee section's interaction model exactly, so two copies would be two things to keep in sync.

## Risks / Trade-offs

**Unauthenticated endpoints** → Anyone reaching the server can read and modify every event and the full customer and employee directory. Roles are out of scope by the source document, but this is a real exposure, not a stylistic gap: the API must not be deployed beyond local development until the authorization change lands. Recorded here so it is a known debt rather than a discovery.

**Time-zone semantics may be wrong** → See the storage decision. Mitigated by confining conversion to one client-side module (`model/mapping.ts`) so a product ruling changes one file plus a migration.

**Duplicated Zod schemas drift** → Server tests assert the server-side rules independently, so a client-side drift surfaces as a rejected request rather than silent divergence.

**FullCalendar under React 19 StrictMode** → Double-mounting in development can produce duplicate render artifacts. Mitigated by treating the calendar as an uncontrolled component: events flow in as props from the query cache, and imperative API calls go through a single ref.

**Unbounded directory endpoints** → With no pagination, a large customer list makes the selector slow and the payload large. Accepted for now — server-side `search` filtering with a result cap is in scope, pagination is not, and the volumes at this stage do not justify it.

**No migration rollback path** → This is the first migration on a database with no production data, so rollback is `prisma migrate reset`. Worth stating plainly because it stops being true after this change.

## Migration Plan

1. Add the models to `schema.prisma`, then `prisma migrate dev --name add_events_and_directory` to create the first migration.
2. Seed the directory with a handful of customers and employees — the attendee and host acceptance criteria cannot be exercised against an empty database, and there is no management UI to populate it.
3. Ship server and client together. There is no deployed consumer, so no compatibility window is needed.

Rollback: `prisma migrate reset` and revert the commit. Safe only while the database holds no real data.

## Open Questions

- **Client test infrastructure.** Vitest, Testing Library, and jsdom as a follow-up change — worth doing before the events feature grows a second maintainer, but it changes no spec and no task here.
- **Result cap for directory search.** A cap is needed; the specific number can be tuned against seeded data during implementation without affecting the API shape.

Everything else in §18 of the source document is a product decision, deferred as recorded in the proposal — not an engineering unknown.
