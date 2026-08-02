## Why

The CRM has no scheduling surface yet — the client is a stub page and the Prisma schema has no models. Calendar and Scheduling is a core product area, and the Events page is the first place a business user can actually do work in the system: create lessons, meetings, and consultations, and assign the customers and employees involved.

This change implements the Events page defined in `docs/product/release 1.0.0/eventsPage.md`.

## What Changes

- **Events page at `/events`** rendering a FullCalendar calendar with month, week, and day views, previous/next/today navigation, and existing events shown at their correct dates and times.
- **Event dialog** with two states: Create mode (Save only) and Edit mode (Edit + Delete). Opened by selecting a calendar slot (prefilling date and start time) or an existing event.
- **Event create, update, and delete** end to end — Prisma models, Express endpoints, and TanStack Query wiring — including delete confirmation, per-field validation, loading states that block double submission, and errors that never discard entered data.
- **Attendee and host assignment** via searchable multi-select controls with an explicit Add step, chip list of assigned participants, per-item removal, and duplicate prevention. Participant edits persist only when the event is saved.
- **Unsaved-changes protection** — closing via the close icon, outside click, or Escape prompts a discard confirmation whenever the form is dirty.
- **Minimal participant directory** — `Customer` and `Employee` models with read-only list/search endpoints, purely to populate the selectors. No management CRUD or UI; that belongs to the future Client Management and Employee Management changes.
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

**Database (new)** — `server/prisma/schema.prisma` currently declares no models. Adds `Event`, `Customer`, `Employee`, and the `EventAttendee` / `EventHost` join tables with unique constraints enforcing one assignment per person per event. Requires the first migration and a seed for directory data.

**Server** — `server/src/app.ts` mounts no routes today. Adds an events module (list by date range, create, update, delete) and read-only customer/employee list endpoints, plus Zod request validation and a shared error shape so the client can render user-facing messages.

**Client** — `client/src/app/router.tsx` has a single `/` route. Adds the `/events` route and an events feature module (calendar, dialog, participant sections, query hooks). Builds on the already-installed FullCalendar, TanStack Query, React Hook Form, and Zod; the only new dependency is `@hookform/resolvers`, the official bridge between the latter two.

**Timekeeping** — event times are stored as UTC timestamps and rendered in the browser's local zone. Time-zone handling is listed as an open product decision; this is the working default, not a settled rule.

**Deferred open decisions** (§18 of the source document) — event overlap rules, past-event restrictions, mandatory hosts, multi-day and all-day events, duration limits, recurrence, notification triggers, removal confirmations, drag-and-resize, and per-type event fields are all left unimplemented. The specs assume the permissive reading: events are single-day, hosts are optional, past dates are allowed, and overlaps are not blocked.
