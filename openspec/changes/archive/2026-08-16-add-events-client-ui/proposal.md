## Why

The CRM's server now exposes a complete, test-covered event and directory API (`add-events-server-api`, research EVID-029), but nothing consumes it: the client is still a single `/` route rendering a placeholder heading (EVID-012). Calendar and Scheduling is the first product area where a business user can do real work, and this change turns the shipped API into the screen that uses it — a persistent left navigation, a router, and a working month/week/day calendar with full event create, edit, and delete.

## What Changes

- **App shell and routing** — a persistent left vertical navigation (Calendar → `/events`, Analytics → `/analytics`, Users → `/users`) with the active item highlighted, rendered around a routed outlet so navigation swaps content without a reload. `/` redirects to `/events`; any unmatched path renders a Not Found page inside the shell with a link back to the calendar (research D-003).
- **Analytics and Users stub pages** — placeholder content only, no data access. They exist to prove routing and to reserve the navigation slots.
- **Events calendar at `/events`** — FullCalendar 6.1.21 with month, week, and day views, opening on the current period; a custom toolbar matching the reference screenshot (prev/next chevrons + Today on the left, period title centered, Month/Week/Day segmented control on the right) built with `headerToolbar: false` plus the imperative `getApi()` (F-010).
- **Period-driven event loading** — every period or view change fires `GET /api/events?from=…&to=…` for the calendar's **active range** (which in month view includes the leading and trailing days of adjacent months), using FullCalendar's own offset-bearing ISO strings. Exactly those two parameters are sent; the server's query schema is strict, so any third parameter is a 400 that would present as an empty calendar (F-004, F-012, R-001, R-004).
- **Event dialog** — the PRD's four-section form (Event details, Attendees, Hosts, Actions) in two modes: Create (Save only, opened by selecting an empty date or time slot, prefilling date and start time) and Edit (Edit + Delete, opened by selecting an existing event). Includes delete confirmation, discard-changes confirmation on close icon / outside click / Escape, per-field validation with disabled primary action, loading states that block double submission, and errors that never discard entered data.
- **Attendee and host assignment** — searchable multi-selects backed by `GET /api/contacts` and `GET /api/employees` (hosts filtered with `canHostEvents=true`), with an explicit Add step, a chip list with per-item removal, and duplicate prevention. Search is sent to the server, not applied to a client-side slice — the directory is hard-capped at 50 with no pagination (R-008). Every commit sends the **complete** intended `attendeeIds` and `hostIds`, because the server treats an omitted array as "leave unchanged" and removals would otherwise never persist (R-006).
- **zustand as the event store** — event data for the visible period, plus calendar UI state (current view, focused date, dialog target), live in a zustand store keyed by period. The store defines its own refresh trigger: every successful create, update, or delete re-reads the active period, so the calendar can never show stale data (research D-001, R-002).
- **axios API layer** — one configured axios instance with `baseURL` from `VITE_API_BASE_URL`, defaulting to `http://localhost:3000/api`, plus a `client/.env.example`. No Vite proxy. Development therefore relies on the server's `CORS_ORIGIN` default matching Vite's dev origin (research D-004, A-001, R-011).
- **Global styles** — Tailwind v4 theme tokens (color, spacing, radius, typography scale) and a base layer in `client/src/index.css`, which today contains only `@import "tailwindcss"` (EVID-014).
- **FSD layers** — `app`, `pages`, `features`, and `shared` created for the first time, with downward-only imports and `index.ts` public APIs (F-019).
- **Instruction corrections** — `client/CLAUDE.md:19-22` and `client/AGENTS.md:26-31` currently mandate TanStack Query for server state and same-origin `/api`. They are updated to record the zustand, axios, and Tailwind decisions, so the repository stops asserting the opposite of what it ships. The shared `.ai_toolkit` skills are **not** edited — that submodule is shared with the SPDMS projects, which do depend on its styled-components guidance (research D-006).
- **TanStack Query removed** — `QueryClientProvider` and `src/app/query-client.ts` are unused once zustand owns event data, and `client/AGENTS.md:44` treats duplicated remote state as review-blocking. The provider wiring and the `@tanstack/react-query` dependency are removed rather than left as a second, dormant data paradigm.
- **Dependencies** — `zustand` is added to `client` via `pnpm --filter client add`. It currently resolves only from the repository root, which works by upward resolution today and would break on a clean install (R-003). Date and time use native `<input type="date">` / `<input type="time">` styled with Tailwind; `@mui/x-date-pickers` is not adopted (research D-007, F-021).

Out of scope, per the PRD: roles and permissions, notifications, recurring events, reminders, external calendar and video integrations, and attendance tracking. No server, schema, or seed change — this is client-only. PRD §18's deferred rules (overlap policy, all-day and multi-day events, time-zone policy, drag-and-resize) stay unimplemented; the permissive reading applies.

## Capabilities

### New Capabilities

- `app-navigation`: The application shell — the persistent left vertical menu, active-link indication, route-to-component resolution, the root redirect, and unmatched-path handling. Includes the Analytics and Users stub pages as routed placeholders.
- `event-calendar`: The calendar surface — month/week/day views and how an event renders in each, period navigation and Today, the current-period default, the active-range read that fires on every period or view change, and the entry points that open the Event dialog.
- `event-management`: The Event dialog lifecycle — Create and Edit modes, the event detail fields and their validation, create/update/delete operations, delete confirmation, discard-changes confirmation, submission states, error handling, and how the calendar refreshes after a successful mutation.
- `event-participants`: Attendee and host assignment — the server-backed eligible-participant search, multi-select and the Add step, duplicate prevention, chip removal, host eligibility filtering, the empty-directory state, and the whole-set commit semantics that make removals persist.

### Modified Capabilities

None — `openspec/specs/` is empty (EVID-030); these are the first capabilities defined.

## Impact

**Client source** — nearly all of it is new. `client/src/app/` gains the router, the layout shell, and the axios instance; `pages/`, `features/`, and `shared/` are created. `App.tsx`, `router.tsx`, `main.tsx`, and `index.css` are all rewritten.

**Server** — untouched. The wire contract is consumed exactly as shipped: `title`/`startAt`/`endAt`, participants pre-resolved to `{id, firstName, lastName, fullName}` on the list response (so Edit mode needs no second request), `POST` → 201 with body, `PATCH` → 200 with body, `DELETE` → 204 empty, and failures always as `{ error: { code, message } }` with one of four codes.

**Dependencies** — adds `zustand` to `client`; removes `@tanstack/react-query`. No other runtime dependency changes. Root-level `zustand` and `@mui/x-date-pickers` entries are left alone; the change that planned their removal is being deleted (research D-002).

**Documentation** — `client/CLAUDE.md` and `client/AGENTS.md` are corrected in this change, not after it.

**Error copy** — the server's messages are safe but technical (`"endAt must be strictly later than startAt."`) while the PRD requires non-technical language, and `NOT_FOUND` is ambiguous between a wrong URL and a deleted event. The client owns the user-facing mapping, chosen per operation rather than per code (F-005, F-006).

**Verification** — `pnpm --filter client build` is the only gate that exists; there is no client lint or test script (F-024). Everything behavioral is verified by running the client against a local server, so no automated claim can be made about it in this change.

**Security** — the API is unauthenticated until the authorization change lands, so this change introduces no deployed client build target (R-013).

**Superseded work** — `openspec/changes/add-events-page/` describes this same screen with an opposing stack and the superseded `name`/`startsAt`/`endsAt` field names. Per research D-002 it is being removed by the user; this change neither inherits from nor supersedes it.

**Carried assumptions** (from research, not silently promoted) — dev origins are `http://localhost:5173` and `http://localhost:3000` (A-001); no auth header is needed (A-002); "pop-up" means the PRD's full Event dialog including the Attendees and Hosts sections (A-003, adopted here). **Open context**: whether the server is running locally and whether `contacts`/`employees` hold any data (U-001, U-002) — the user has confirmed an empty directory is acceptable for now, so the selectors must render an empty state without erroring, and the PRD's participant acceptance criteria cannot be fully exercised until the directory is seeded. Whether the server branch merges before this client lands (U-003) determines whether the calendar has an API to call at all.
