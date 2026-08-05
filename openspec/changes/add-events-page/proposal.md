## Why

The CRM has no scheduling surface yet — the client renders a placeholder heading and the server exposes only a health check. Calendar and Scheduling is a core product area, and the Events page is the first screen where a business user can actually do work in the system: create lessons, meetings, and consultations, and assign the contacts and employees involved.

This change implements the Events page defined in `docs/prd/release 1.0.0/eventsPage.md`.

## What Changes

- **Events page at `/events`** rendering a FullCalendar calendar with month, week, and day views, previous/next/today navigation, and existing events shown at their correct dates and times.
- **Event dialog** with two states: Create mode (Save only) and Edit mode (Edit + Delete). Opened by selecting a calendar slot — which prefills date and start time — or by selecting an existing event.
- **Event create, update, and delete** end to end — Mongoose models, Express routes, and TanStack Query wiring — including delete confirmation, per-field validation, loading states that block double submission, and errors that never discard entered data.
- **Attendee and host assignment** via searchable multi-select controls with an explicit Add step, a chip list of assigned participants, per-item removal, and duplicate prevention. Participant edits persist only when the event is saved.
- **Unsaved-changes protection** — closing via the close icon, outside click, or Escape prompts a discard confirmation whenever the form is dirty.
- **Minimal participant directory** — the existing but empty `contacts` and `employees` collections get their first schema, read-only list/search endpoints, and a seed script, purely to populate the selectors. No management CRUD or UI; that belongs to the future Client Management and Employee Management changes.
- **First client architecture** — the client gains its FSD layers (`app`, `pages`, `features`, `shared`) and the first real route, establishing the structure later features copy.
- **Test infrastructure for both packages** — `node:test` integration tests on the server, Vitest + Testing Library + jsdom on the client.
- Removes the unused root-level `@mui/x-date-pickers` and `zustand` dependencies. Date and time inputs use native `<input type="date">` / `<input type="time">` styled with Tailwind, avoiding a second styling system alongside Tailwind v4.

Out of scope, per the source document: roles and permissions, notifications, recurring events, reminders, external calendar and video integrations, and attendance tracking.

## Capabilities

### New Capabilities

- `event-calendar`: The Events page calendar — month/week/day views, period navigation, rendering existing events, and the entry points that open the Event dialog.
- `event-management`: The Event dialog lifecycle — Create and Edit modes, the event detail fields and their validation, create/update/delete operations, delete confirmation, discard-changes confirmation, submission states, and error handling.
- `event-participants`: Attendee and host assignment — the eligible-participant directory that backs the selectors, search and multi-select, the Add step, duplicate prevention, removal, and how participant edits are persisted.

### Modified Capabilities

None — `openspec/specs/` is empty; this is the first change to define specs.

## Impact

**Database** — MongoDB Atlas via Mongoose, which currently connects but defines no models. The `OLEKU_CRM` database already contains `contacts`, `employees`, `events`, and `users`, all empty and carrying no indexes beyond `_id` — placeholders with no schema behind them. This change defines the first schema for three of them: `events` gains `startsAt` / `endsAt` instants plus embedded `attendeeIds` and `hostIds` reference arrays, and `contacts` / `employees` gain the minimal person shape the selectors need. `users` is left untouched — it is the future authentication surface, and event participants are contacts and employees, not login accounts. Needs a seed script: the attendee and host acceptance criteria cannot be exercised against empty collections, and no management UI exists to populate them.

**Server** — `server/src/app.ts` mounts no routes today. Adds an events module (list by date range, create, update, delete), read-only contact/employee list endpoints, Zod request validation, and a shared error envelope so the client can render user-facing messages. This establishes the server's module layout for every feature that follows.

**Client** — `client/src/app/router.tsx` has a single `/` route and `App.tsx` is a stub. Adds the `/events` route, an `EventsPage` slice, and an `events` feature slice under the FSD rules in `.ai_toolkit/skills/feature-sliced-design`. Builds on the already-installed FullCalendar, TanStack Query, React Hook Form, and Zod; the only new runtime dependency is `@hookform/resolvers`, the official bridge between the latter two.

**Dependencies** — adds `@hookform/resolvers` to `client` and `zod` to `server`, plus Vitest + Testing Library + jsdom (client) and `mongodb-memory-server` (server) as dev dependencies; removes `@mui/x-date-pickers` and `zustand` from the root `package.json`, where they are unused and not resolvable from `client/` anyway.

**Timekeeping** — event times are stored as UTC instants and rendered in the browser's local zone. Time-zone handling is listed as an open product decision; this is the working default, not a settled rule.

**Security** — the endpoints in this change are unauthenticated, since roles and permissions are out of scope by the source document. The database is a shared hosted Atlas cluster, so the API must not be exposed beyond local development until the authorization change lands.

**Deferred open decisions** (§18 of the source document) — event overlap rules, past-event restrictions, mandatory hosts, multi-day and all-day events, duration limits, recurrence, notification triggers, participant-removal confirmations, drag-and-resize, and per-type event fields are left unimplemented. The specs assume the permissive reading: events are single-day, hosts are optional, past dates are allowed, and overlaps are not blocked.
