# Research: Events client UI — app shell, routing, and calendar

## Research status

- **Change:** `add-events-client-ui`
- **Confidence:** Medium-high — the whole client surface and the already-shipped server contract were read from tracked source and installed packages; three blocking items are product/architecture decisions and one is unverifiable runtime state.
- **Blocking unknowns:** none remaining. The user resolved every decision (D-001 to D-007) and U-001 on 2026-08-10; see the decisions table for each answer and its consequences. U-002 and U-003 remain as runtime/branching context, not blockers.

## Executive summary

The request is the client half of `docs/prd/release 1.0.0/eventsPage.md`: a persistent left vertical nav (Calendar, Analytics, Users), a router that resolves the root and unknown paths, stub pages for Analytics and Users, and a working month/week/day calendar that loads events for whatever period is visible and opens a create/edit/delete dialog matching the PRD's Event dialog.

Verified current state: the client is still a placeholder — one `/` route rendering a heading, a bare `QueryClient`, and `index.css` containing only `@import "tailwindcss"` (EVID-012, EVID-014). Nothing calls an API. The server side is no longer hypothetical: `feat/add-events-server-api` has the full event and directory API committed and test-covered (EVID-029), so the wire contract this UI must speak is fixed and verifiable rather than a design choice (EVID-001 to EVID-009).

The main risk is not FullCalendar; that library is installed, React 19-compatible, and supports every interaction the screenshot and PRD imply (F-010 to F-014). The risk was contradiction: three of the requested stack choices — zustand for event data, axios against localhost, and Tailwind against the skills' styled-components rules — collided with binding project instructions and with an already-planned, unstarted change (F-015 to F-019). **All of those collisions were settled by the user on 2026-08-10** (D-001 zustand, D-004 axios, D-006 Tailwind, D-007 native date/time inputs, D-003 `/events`), and `add-events-page` is being removed rather than reconciled (D-002), which closes F-016, F-017 and R-015. What survives is a documentation obligation: `client/CLAUDE.md` and `client/AGENTS.md` still mandate TanStack Query for server state and must be corrected alongside the code, or the repository contradicts itself.

Recommended direction: this is the single client change; keep the event wire contract exactly as the server defines it (F-001 to F-007); drive fetches from FullCalendar's `datesSet` active range using its own offset-bearing ISO strings (F-012); store events and calendar UI state in zustand, declared through `pnpm --filter client add` (F-020); reach the API through one configured axios instance with an environment-driven `baseURL`; and build the `app`/`pages`/`features`/`shared` layers from scratch (F-019).

## Input and scope

### Explicit requirements

1. A layout menu with links to pages; left-hand and vertical; the active page is highlighted (screenshot).
2. Router handling: main page is the calendar; "no page" (unmatched route) is handled.
3. Analytics and Users pages exist as temporary stubs.
4. Switching or navigating a page swaps the rendered component without a reload.
5. The calendar opens on the current month with its dates and data.
6. Navigating the calendar triggers an events fetch endpoint call ("check it in client part", localhost endpoints acceptable temporarily).
7. Fetch "active events" and display them on the calendar.
8. Clicking an empty calendar cell opens a pop-up with the form described in the PRD.
9. Create, edit, and delete an event.
10. Switch between month, week, and day; an existing event renders differently in each.
11. "For save events data use global storage zustand."
12. "Global styles aligned with best practices."
13. "Follow feature slice design architecture pattern."
14. "for API use axios."
15. Scope: client only.
16. Toolbar shape from the screenshot: prev/next chevrons + Today on the left, period title centered, Month/Week/Day segmented control on the right; out-of-month days dimmed; today tinted; events as compact time+title chips.

### Constraints and exclusions

- "This is only for client part" — no server, schema, or seed change.
- PRD out-of-scope list: roles/permissions, notifications, recurring events, reminders, calendar and video integrations, attendance tracking (`docs/prd/release 1.0.0/eventsPage.md:30-38`).
- PRD §18 deferred product rules, including time-zone policy, all-day and multi-day events, overlap rules, and drag/resize (`:596-611`).
- Repository rules: pnpm-only installs via `pnpm --filter client add`, lockfile committed; no lint or test script exists; `pnpm --filter client build` is the only verification gate (EVID-017, `AGENTS.md:23-25,37-38`).

### Research questions

| ID | Question | Why it matters | Answer or status | Evidence | Consequence for later artifacts |
| --- | --- | --- | --- | --- | --- |
| RQ-001 | What exact HTTP contract must the client speak? | The server is shipped; a guess breaks at runtime | Answered: 4 event + 2 directory routes with fixed payloads and codes | EVID-001 to EVID-009, F-001 to F-007 | Specs state the contract as consumed, not re-derived |
| RQ-002 | Does zustand-for-event-data conflict with binding instructions? | Two documents say opposite things | Answered: yes — `client/CLAUDE.md`, `client/AGENTS.md`, and the state-management skill | EVID-017, EVID-018, F-015 | D-001 |
| RQ-003 | How does the open `add-events-page` change conflict with this request? | Duplicate, contradictory client plans | Answered: same screen, different stack and route, superseded field names, 0/63 done | EVID-026 to EVID-028, F-016, F-017 | D-002 |
| RQ-004 | Can FullCalendar 6.1.21 produce the screenshot's toolbar and three views under React 19? | Feasibility of the requested UI | Answered: yes — `headerToolbar: false` + `ref.getApi()`; plugins installed; React 19 in peers | EVID-021, EVID-022, F-010, F-011 | Design may rely on the imperative API |
| RQ-005 | Which period boundaries should a fetch send, and will the server accept them? | A format mismatch renders an empty calendar with no error | Answered: `datesSet` `startStr`/`endStr` over the *active* range, offset-bearing; server accepts `Z` and `±HH:MM` | EVID-007, EVID-022, EVID-023, F-012 | Fetch is keyed to the active range, not the calendar month |
| RQ-006 | Is zustand usable from `client` today? | A phantom dependency dies on clean install | Answered: declared in the **root** importer only | EVID-016, F-020 | Must go through `pnpm --filter client add` |
| RQ-007 | How should the client reach the API in development? | "localhost endpoints" vs. same-origin `/api` | Answered: no proxy exists; CORS already allows `http://localhost:5173`; both routes work | EVID-010, EVID-011, EVID-013, EVID-036, F-018 | D-004 |
| RQ-008 | What does "active events" mean? | Determines the query | **Decision needed** — events carry no status field; only people do | EVID-037, EVID-008 | D-005 |
| RQ-009 | Will the attendee/host selectors have data? | Participant criteria cannot be exercised against empty collections | **Unknown** — seed refuses non-loopback hosts; `.env` unreadable | EVID-032, EVID-033 | U-001 |
| RQ-010 | Which styling and component conventions are canonical? | Skills mandate styled-components, `React.FC`, non-FSD folders | Answered: repo is Tailwind v4 with no config; the skill text targets another project | EVID-014, EVID-020, F-022 | D-006 |

## Evidence reviewed

| ID | Source | Evidence type | What it establishes |
| --- | --- | --- | --- |
| EVID-001 | `server/src/modules/events/event.routes.ts:18-21` | Source | Exactly `GET /api/events`, `POST /api/events`, `PATCH /api/events/:id`, `DELETE /api/events/:id`. No `GET /api/events/:id`, no `PUT` |
| EVID-002 | `server/src/modules/events/event.controller.ts:19-63` | Source | List → `{ events: [...] }` 200; create → event object, 201; patch → event object, 200; delete → 204 with no body |
| EVID-003 | `server/src/modules/events/event.schema.ts:14,39-61,75-102,104-114` | Source | Instants must be full ISO with `Z` or numeric offset; query is `strictObject{from,to}` with `to > from`; create defaults participant arrays to `[]`; patch requires ≥1 of 5 fields; `:id` must match `^[0-9a-f]{24}$` |
| EVID-004 | `server/src/modules/events/event.service.ts:22-29,247-256,306-354,367-373` | Source | Payload `{id,title,startAt,endAt,attendees[],hosts[]}`, participants as `{id,firstName,lastName,fullName}`; overlap `startAt < to AND endAt > from` (half-open); patch: omitted array = unchanged, `[]` = cleared; delete throws `NOT_FOUND` |
| EVID-005 | `server/src/shared/http/error-envelope.ts:5-24` | Source | `VALIDATION_ERROR` 400, `INVALID_PARTICIPANT` 400, `NOT_FOUND` 404, `INTERNAL_ERROR` 500 |
| EVID-006 | `server/src/shared/http/error-middleware.ts:21-37`; `not-found-handler.ts:13-20` | Source | Failures are always `{ error: { code, message } }`; unexpected errors collapse to a generic 500; an unmatched URL returns the same `NOT_FOUND` code as a missing event |
| EVID-007 | `server/src/test/event-api.test.ts:283-289,302,353,522-568` | Test | `Z` and offset periods both 200 with identical ids; create returns exactly `attendees,endAt,hosts,id,startAt,title`; unknown id → 404; inactive/ineligible participant → 400 `INVALID_PARTICIPANT` |
| EVID-008 | `server/src/modules/directory/directory.routes.ts:14-15`; `directory.schema.ts:33-46`; `directory.service.ts:11-12,92-127` | Source | `{contacts}` / `{employees}`; only `search`/`status` (+`canHostEvents`) accepted, any other key 400; active-only default; deterministic sort; hard cap 50, no pagination |
| EVID-009 | `server/src/test/directory-api.test.ts:134-172` | Test | Contact fields `id,firstName,lastName,fullName,email,status`; employee adds `position,department,canHostEvents` |
| EVID-010 | `server/src/app.ts:15,20-31` | Source | Global `cors({ origin: env.corsOrigin })`; feature routers under `/api` above the terminal handlers |
| EVID-011 | `server/src/shared/config/env.ts:20-22` | Source | Port defaults to 3000; `CORS_ORIGIN` defaults to `http://localhost:5173` |
| EVID-012 | `client/src/app/router.tsx:4-9`; `App.tsx:1-9`; `main.tsx:9-15` | Source | One `/` route rendering a placeholder; `QueryClientProvider` and `RouterProvider` already wired |
| EVID-013 | `client/vite.config.ts:6-8` | Config | React and Tailwind plugins only — no dev proxy, no pinned port |
| EVID-014 | `client/src/index.css:1`; no `tailwind.config.*` in `client/` | Source | Global styling is one Tailwind v4 import with no tokens or resets yet |
| EVID-015 | `client/package.json:12-32` | Manifest | FullCalendar 6.1.21 (core/daygrid/timegrid/interaction/react), TanStack Query 5.101.4, axios 1.19.0, react-hook-form 7.83.0, react-router 7.18.2, zod 4.4.3, Tailwind 4.3.3, Vite 8, React 19.2.8 |
| EVID-016 | `package.json:15-18`; `pnpm-lock.yaml:9-20` vs `:22-47` | Manifest/lockfile | `zustand@5.0.14` and `@mui/x-date-pickers@9.10.1` are in the **root** importer only; `client` has neither |
| EVID-017 | `client/CLAUDE.md:19-22`; `client/AGENTS.md:26-31,37,44` | Instructions | Server state belongs to TanStack Query ("a store only when neither fits"); shared state only on demonstrated need; same-origin `/api` via centralized axios; build gate `pnpm --filter client build`; duplicated remote state is review-blocking |
| EVID-018 | `.ai_toolkit/skills/state-management/SKILL.md:15-33,109-118` | Instructions | React Context in a `context/` folder is the sanctioned cross-page/feature mechanism; no store library appears |
| EVID-019 | `.ai_toolkit/skills/feature-sliced-design/SKILL.md:16-27,88-108,133-147,150-171` | Instructions | `app → pages → features → shared`; downward imports only; no cross-slice imports; segments `ui/model/api/lib/config`; `index.ts` public API |
| EVID-020 | `.ai_toolkit/skills/react-best-practices/SKILL.md:15-37,328-395` | Instructions | Mandates `React.FC<IProps>`, a 250-line cap, a non-FSD folder shape, and styled-components with an external `spTheme` |
| EVID-021 | `client/node_modules/@fullcalendar/react/package.json` (peers); `dist/index.d.ts:23` | External (6.1.21) | React/ReactDOM `^19` are supported peers; component exposes `getApi(): CalendarApi` |
| EVID-022 | `@fullcalendar/core/internal-common.d.ts:1554-1565,1855-1857,2009,2237,2245,2248`; `index.js:1104` | External (6.1.21) | `headerToolbar` accepts `false`; `datesSet` fires with the **active range** as `{start,end,startStr,endStr,timeZone,view}`; `eventClick`, `select`, `selectable` exist |
| EVID-023 | `@fullcalendar/core/internal-common.js:2139-2150,4571-4578` | External | `datesSet` strings come from `formatIso` with `omitTime` unset — always time-bearing, carrying the browser's offset |
| EVID-024 | `@fullcalendar/interaction/index.d.ts:149-153,199` | External | `dateClick` gives `{date,dateStr,allDay,dayEl,view}`; day/slot selection needs this plugin |
| EVID-025 | `@fullcalendar/core/internal-common.js:13-25` | External | The library injects `<style data-fullcalendar>`; v6 needs no CSS import |
| EVID-026 | `openspec/changes/add-events-page/proposal.md:9-17,39-41`; `design.md:100-106,122-147`; `tasks.md` (0/63) | Project doc | Unstarted change for this same screen: TanStack Query, native date/time inputs, native `<dialog>`, `/events` route, one `features/events` slice, and removal of the root `zustand` / `@mui/x-date-pickers` entries |
| EVID-027 | `openspec/changes/add-events-server-api/proposal.md:9,50` | Project doc | Canonical server change; supersedes `add-events-api` and the server half of `add-events-page`; the client must use `title`/`startAt`/`endAt` |
| EVID-028 | `openspec/changes/add-events-page/specs/{event-calendar,event-management,event-participants}/spec.md` | Project doc | Drafted client behavior for the calendar, dialog lifecycle, and participant assignment |
| EVID-029 | `git log --oneline -12`; `git diff --stat main...HEAD`; `add-events-server-api/tasks.md` (41/41) | Command output | The server API exists only on `feat/add-events-server-api` (~4,500 added lines, 9 test files); `main` lacks it |
| EVID-030 | `openspec/specs/` (empty); `openspec/config.yaml` | Project config | No capability baseline; the schema requires the proposal to resolve every decision needed |
| EVID-031 | `docs/prd/release 1.0.0/eventsPage.md:44-58,81-118,121-198,202-287,291-411,415-457,499-529` | Project doc | Views and navigation, Create vs Edit actions, delete and discard confirmations, required fields and `end > start`, participant add/remove, submission and error rules |
| EVID-032 | `server/src/modules/directory/seed.ts:53-61`; `seed-data.ts:19-64` | Source | The seed throws unless every Mongo host is loopback; fixtures are 3 contacts (1 inactive) and 3 employees (1 inactive, 1 not host-eligible) |
| EVID-033 | `.claude/settings.json` (`deny: Read(/**/.env)`) | Project config | The database URI is unreadable here, so no runtime data claim can be verified |
| EVID-034 | `server/CLAUDE.md:23-24` | Instructions | `contacts` are clients, `employees` are staff; `users` is the auth surface and must not hold domain data |
| EVID-035 | `docs/prd/productVision.md:54-66` | Project doc | Product areas include Client Management, Employee Management, Calendar and Scheduling, Dashboard and Analytics |
| EVID-036 | `server/node_modules/cors/lib/index.js:11-12,163-178` | External | The CORS middleware answers preflight `OPTIONS` with 204 itself |
| EVID-037 | `server/src/modules/events/event.model.ts:12-51` | Source | An event has `title`, `startAt`, `endAt`, participant ids, two null audit fields — no status or "active" flag |

## Current system and relevant flows

There is no client flow to trace: `main.tsx` mounts `QueryClientProvider` around a `createBrowserRouter` holding a single `/` route that renders a centered heading (EVID-012). No API module, no FSD layers below `app/`, no global style tokens (EVID-014).

The flow the client must attach to is fully built on the current branch (EVID-029). A period read is `GET /api/events?from=<instant>&to=<instant>`; both boundaries are required, must be zone-explicit ISO instants, and `to` must be strictly greater than `from`; the query object is *strict*, so any third parameter is a 400 (EVID-003). The response is `{ events: [{ id, title, startAt, endAt, attendees, hosts }] }` where each participant is already resolved to `{ id, firstName, lastName, fullName }` (EVID-004) — the dialog can render assigned chips without a second request. Overlap is half-open: an event touching a boundary exactly (`startAt === to` or `endAt === from`) is excluded (EVID-004).

Writes are `POST /api/events` → 201 with the event body, `PATCH /api/events/:id` → 200 with the event body, `DELETE /api/events/:id` → 204 with no body (EVID-002). PATCH is genuinely partial: an omitted `attendeeIds`/`hostIds` leaves that role unchanged while `[]` clears it (EVID-004). Failures always arrive as `{ error: { code, message } }` with one of four codes (EVID-005, EVID-006).

Participant options come from `GET /api/contacts` and `GET /api/employees`, active-only by default, deterministically ordered, hard-capped at 50, with a literal `search` term and an optional `canHostEvents` filter for employees; those query objects are strict too (EVID-008). Creating or updating an event with an inactive contact, an inactive employee, or an employee whose `canHostEvents` is false is rejected with `INVALID_PARTICIPANT` (EVID-007).

## Findings

### Contracts and observable behavior

- **F-001 [Verified]** The only event read is period-bounded; there is no unbounded list and no `GET /api/events/:id` (EVID-001, EVID-003), so Edit mode must be hydrated from the period read.
- **F-002 [Verified]** The payload is domain-shaped, not FullCalendar-shaped: `title`/`startAt`/`endAt` map to `title`/`start`/`end` on the client (EVID-004, EVID-027).
- **F-003 [Verified]** Create returns 201 with the object and delete returns 204 with no body; success responses are not uniformly enveloped (EVID-002).
- **F-004 [Verified]** Any unexpected query parameter on the event or directory reads is a `VALIDATION_ERROR`, not ignored (EVID-003, EVID-008).
- **F-005 [Verified]** An unmatched URL produces the same `NOT_FOUND` code as a deleted event (EVID-005, EVID-006), so error copy must be chosen per operation, not per code alone.
- **F-006 [Verified]** Server messages are safe but technical (`"endAt must be strictly later than startAt."`) while the PRD demands non-technical language (EVID-031 `:512-529`) — the client owns the mapping.
- **F-007 [Verified]** Participant eligibility is enforced only on *newly added* assignments; already-assigned people may be retained after becoming inactive or ineligible (EVID-004 `:306-331`, `add-events-server-api/proposal.md:12`).

### Data and invariants

- **F-008 [Verified]** Events have no lifecycle/status field (EVID-037), so "fetch active events" has no direct server meaning; the only selector available is period overlap (D-005).
- **F-009 [Verified]** `end > start` is enforced on the server on every write path (EVID-004 `:50-54`), and FullCalendar silently substitutes a one-hour default for a non-later end (`openspec/changes/add-events-server-api/research.md` F-002). Client-side validation is a UX affordance, not the guarantee.
- **F-010 [Verified]** FullCalendar 6.1.21 lists React and ReactDOM `^19` as supported peers, and the React wrapper exposes `getApi()` (EVID-021) — the screenshot's custom prev/next/today/view controls are achievable with `headerToolbar: false` plus imperative calls (EVID-022).
- **F-011 [Verified]** All three view plugins plus `interaction` are installed (EVID-015); `dateClick` and `select`/`selectable` are the empty-cell entry points (EVID-022, EVID-024).
- **F-012 [Verified]** `datesSet` reports the **active range** — in month view that includes the leading/trailing days of adjacent months — as `startStr`/`endStr` with a time component and the browser's numeric offset (EVID-022, EVID-023), which the server accepts and which tests cover for both `Z` and offset forms (EVID-007).
- **F-013 [Verified]** FullCalendar v6 injects its own stylesheet; no CSS import is needed (EVID-025).
- **F-014 [Inference, from F-010 to F-012]** Nothing in the requested UI requires a FullCalendar feature that is absent, licensed, or version-blocked; the remaining calendar work is mapping and layout.

### Project patterns and constraints

- **F-015 [Verified]** "Save events data in zustand" contradicts three binding sources: `client/CLAUDE.md:19-20`, `client/AGENTS.md:26-27,44`, and the state-management skill, which names React Context — not a store library — as the cross-feature mechanism (EVID-017, EVID-018).
- **F-016 [Verified]** `add-events-page` is unstarted (0/63) and describes this same screen with TanStack Query, native date/time inputs, a native `<dialog>`, an `/events` route, and removal of the root `zustand` entry (EVID-026). Its server half is superseded (EVID-027), but its three client specs (EVID-028) are the only drafted normative client behavior.
- **F-017 [Verified]** That change's tasks still say `name`/`startsAt`/`endsAt` (`tasks.md:11,25-26`) while the shipped server uses `title`/`startAt`/`endAt` (EVID-004) — a client written from that list cannot work against the real API.
- **F-018 [Verified]** "Localhost endpoints" conflicts with `client/AGENTS.md:30-31` and `client/CLAUDE.md:22` (same-origin `/api`). No Vite proxy exists, but the server's default CORS origin is Vite's default dev origin and preflights are answered (EVID-010, EVID-011, EVID-013, EVID-036), so both routes work.
- **F-019 [Verified]** FSD is required by both the user and the project with identical rules (EVID-019); only `src/app/` exists, so `pages`, `features`, and `shared` are created here.
- **F-020 [Verified]** `zustand` resolves from the repository root, not `client` (EVID-016) — it works in Vite today by upward resolution and breaks when the root entry is removed, which EVID-026 plans.
- **F-021 [Verified]** `@mui/x-date-pickers` is unusable as installed: `@mui/material`, both Emotion packages, and a date adapter are not client dependencies (EVID-016).
- **F-022 [Verified]** The `react-best-practices` skill mandates styled-components, `spTheme`, `React.FC<IProps>`, and a non-FSD folder shape (EVID-020) — written for another codebase and not literally compatible with Tailwind v4 plus EVID-019.
- **F-023 [Verified]** `users` is the auth surface, not a people directory (EVID-034), so a "Users" nav item maps to no collection the client can read; the readable directories are contacts and employees.
- **F-024 [Verified]** No client test runner or lint script exists; `pnpm --filter client build` is the only gate (EVID-017, `AGENTS.md:37-38`).

### External contracts

Versions resolved from the workspace: `@fullcalendar/*` 6.1.21, `react` 19.2.8, `react-router` 7.18.2, `axios` 1.19.0, `@tanstack/react-query` 5.101.4, `react-hook-form` 7.83.0, `zod` 4.4.3, `tailwindcss` 4.3.3, `vite` 8.2.0 (EVID-015), `zustand` 5.0.14 (root only, peers `react >=18`, EVID-016). All FullCalendar findings (F-010 to F-013) were read from the installed package rather than documentation, so they describe the exact build this workspace resolves.

## Options and research-informed direction

| Direction | Evidence-supported benefits | Costs and risks | Reversibility |
| --- | --- | --- | --- |
| A. zustand owns event data; axios calls it directly; TanStack Query dropped | Satisfies requirement 11 literally; one store, one data paradigm | Contradicts EVID-017/EVID-018 unless those docs change too; the store hand-rolls per-period caching, refetch-after-mutation, and in-flight/error state (R-002) | Medium |
| B. TanStack Query owns event data; zustand holds calendar UI state only (view, focused date, dialog target) | Matches every project instruction; invalidate-on-mutation keeps the calendar correct with no manual bookkeeping | Arguably does not satisfy requirement 11 as written; two state tools on one screen | High |
| C. Keep the `add-events-page` plan and drop the zustand/axios asks | No new contradiction; specs drafted (EVID-028) | Overrides three explicit user instructions; still needs the `name`→`title` fix (F-017) | High |
| D. React Context instead of any store (EVID-018) | Follows the canonical skill; no new dependency | Ignores requirement 11; every consumer re-renders on each event-list change | High |

### Recommended direction

Treat this as the **single reconciling client change** and settle the stack in the proposal rather than in code.

- Adopt the shipped server contract verbatim (F-001 to F-007). The client maps to FullCalendar; the API vocabulary does not change.
- Key every read to the active range from `datesSet` and send exactly `from`/`to` using FullCalendar's own strings (F-004, F-012). This satisfies requirement 6 and avoids the empty-calendar failure mode.
- On the state question, the evidence supports **A or B, not a silent blend**. If the user's zustand instruction is authoritative (the reading this research assumes for scope purposes), the change must also update `client/CLAUDE.md` and `client/AGENTS.md` in the same change so the repository stops asserting the opposite, and it must state explicitly how a period-keyed cache is invalidated after each mutation. If instruction compliance is authoritative, option B keeps zustand in the change for calendar UI state only. Either is defensible; picking one implicitly is not (D-001).
- Reconcile `add-events-page` explicitly: its client specs (EVID-028) are reusable normative material, but its task list encodes a superseded contract (F-017) and an opposing stack (F-016). Supersede or rewrite it — do not leave two live client plans (D-002).
- Keep FSD boundaries as EVID-019 states them and treat the `react-best-practices` styled-components/`React.FC` rules as inapplicable to this Tailwind v4 codebase unless the user rules otherwise (F-022, D-006).

## Risks and edge cases

| ID | Risk or edge case | Evidence | Likelihood | Impact | Constraint for later artifacts |
| --- | --- | --- | --- | --- | --- |
| R-001 | An extra query parameter (cache-buster, `timeZone`, `limit`) makes every read a 400, presenting as an empty calendar | F-004, EVID-003, EVID-008 | Medium | High | Specs must fix the exact parameter set per endpoint |
| R-002 | Event data duplicated into a store and not invalidated after create/update/delete leaves a stale calendar; `client/AGENTS.md:44` treats duplicated remote state as blocking | F-015, EVID-017 | High under option A | High | Whichever store wins must define its refresh trigger as observable behavior |
| R-003 | `zustand` is a phantom dependency for `client` and disappears if the root entry is removed as `add-events-page` plans | F-020, EVID-016, EVID-026 | High | Medium | Dependency must be added via `pnpm --filter client add` with the lockfile committed |
| R-004 | Fetching the calendar *month* instead of the *active range* leaves the leading/trailing cells empty | F-012, EVID-022 | Medium | Medium | Specs must define the fetched period as the rendered period |
| R-005 | No `GET /api/events/:id` exists, so an open Edit dialog is backed by list data; a period change, refetch, or concurrent delete can invalidate it | F-001, EVID-001 | Medium | Medium | Specs must state where dialog data comes from and what happens if it disappears |
| R-006 | A PATCH that omits `attendeeIds`/`hostIds` silently keeps the old participants, so removals never persist | F-001, EVID-004 | Medium | High | Specs must state that a commit sends the complete intended participant sets |
| R-007 | Offering inactive contacts or non-eligible employees produces `INVALID_PARTICIPANT` at save time instead of at selection time | F-007, EVID-007, EVID-008 | Medium | Medium | Host options must be filtered with `canHostEvents=true`; errors must be mapped to friendly copy |
| R-008 | The directory is capped at 50 with no pagination, so a person outside the cap is unreachable without server-side search | EVID-008 | Medium | Medium | Search must be sent to the server, not applied to a client-side slice |
| R-009 | `NOT_FOUND` is ambiguous between a wrong URL and a deleted event | F-005, EVID-006 | Low | Medium | Error copy must be chosen per operation |
| R-010 | Composing a local date + times into instants crosses time zones and DST; PRD §18 defers the policy | EVID-031 `:596-611`, F-002 | Medium | Medium | Specs must state the conversion boundary and that stored values are absolute instants |
| R-011 | Vite falls back to a port other than 5173, breaking the server's default `CORS_ORIGIN` | EVID-011, EVID-013 | Low-medium | Medium | D-004 should state the dev-origin assumption or remove it via a proxy |
| R-012 | FullCalendar under React 19 StrictMode double-mounting can produce duplicate render artifacts | `add-events-page/design.md:189` (claim, not verified here) | Low-medium | Low | Treat the calendar as uncontrolled; verify manually |
| R-013 | The API is unauthenticated; a client shipped beyond local development exposes the whole directory and calendar | `add-events-server-api/proposal.md:48` | Certain until auth lands | High | The change must not introduce a deployed client build target |
| R-014 | The Users nav item implies a collection the client cannot read and that project rules reserve for auth | F-023, EVID-034 | Medium | Low-medium | Naming must be settled before specs describe the page |
| R-015 | Two live client plans (`add-events-page` and this change) with different stacks and field names | F-016, F-017 | High without D-002 | High | Resolve supersession before writing specs |

## Unknowns, assumptions, and decisions needed

| ID | Type | Item | Impact if wrong | How to resolve |
| --- | --- | --- | --- | --- |
| U-001 | ~~Unknown~~ **Resolved 2026-08-10** | Whether the developer's database actually contains contacts and employees; the seed refuses non-loopback hosts and `.env` is unreadable | The attendee/host selectors render empty and the PRD's participant criteria cannot be exercised | **User: empty is acceptable — temporary.** Selectors must render an empty state without erroring; the PRD's participant acceptance criteria cannot be fully exercised until the directory is seeded |
| U-002 | Unknown | Whether the server currently runs locally, on which port, and against which database | The "check it in client part" requirement cannot be demonstrated | Ask the user; nothing in tracked source proves a running process |
| U-003 | Unknown | Whether the server branch will be merged before or after this client change | A client on `main` would have no API to call (EVID-029) | Confirm the merge/branching plan with the user |
| A-001 | Assumption | Dev origins are `http://localhost:5173` (client) and `http://localhost:3000` (server) | CORS rejections or 404s in development | Confirmed by defaults (EVID-011) but not by a running process |
| A-002 | Assumption | No authentication header or credentialed request is needed | Requests would fail once auth lands | Re-check when the authorization change is proposed |
| A-003 | Assumption | "Pop-up" means the PRD's Event dialog, including the attendee and host sections | A materially smaller scope, or a much larger one | Confirm with the user |
| D-001 | ~~Decision needed~~ **Decided 2026-08-10** | zustand as the event-data store vs. TanStack Query with zustand for UI state (options A/B) | Either a repository that contradicts its own instructions, or a delivered feature that ignores an explicit requirement | **User: zustand (Option A).** zustand owns event data and calendar UI state. Consequence: `client/CLAUDE.md:19-20` and `client/AGENTS.md:26-27` must stop mandating TanStack Query for server state in the same change, and the `state-management` skill's Context-only rule does not bind this package (see D-006) |
| D-002 | ~~Decision needed~~ **Decided 2026-08-10** | The relationship to `add-events-page`: supersede it, rewrite its client specs, or archive it | Two contradictory client plans, one of which targets a dead field contract (F-017) | **User: `add-events-page` will be removed.** This change does not reconcile with, inherit from, or supersede it; F-016, F-017, R-015 and D-002 are closed. Its specs and task list are not inputs |
| D-003 | ~~Decision needed~~ **Decided 2026-08-10** | Route and IA naming: `/calendar` (screenshot/requirement) vs `/events` (`add-events-page`); what `/` does; what an unmatched path renders; whether the third nav item stays "Users" given F-023 | Broken links between changes and a nav label with no backing data | **User: `/events`.** The calendar route is `/events`. Root and unmatched-route behavior, and whether the third nav item keeps the label "Users" despite F-023, remain for the proposal to state |
| D-004 | ~~Decision needed~~ **Decided 2026-08-10** | Dev API access: Vite proxy for same-origin `/api` (matches EVID-017) vs axios `baseURL` to `http://localhost:3000/api` (matches the "localhost endpoints" wording) | CORS-dependent development, or an instruction violation | **User: axios.** A configured axios instance with an environment-driven `baseURL` pointing at the local server; no Vite proxy. Development therefore depends on the server's CORS allowance (A-001, R-011) |
| D-005 | ~~Decision needed~~ **Decided 2026-08-10** | What "active events" means, given events carry no status (F-008) | A filter that cannot be implemented, or silently dropped events | **User: every event overlapping the currently visible period.** No status filter and no status concept is introduced; the client sends the visible range and renders everything returned. No server change is implied |
| D-006 | ~~Decision needed~~ **Decided 2026-08-10** | Which styling/component conventions are canonical: Tailwind v4 + FSD, or the skill's styled-components/`React.FC`/folder rules (F-022) | Review conflicts and an unusable "global styles" definition | **User: Tailwind v4 is canonical; the styled-components rules do not apply.** Global styles are Tailwind theme tokens plus a base layer. **Scope: override per package, do not edit the shared skills** — `.ai_toolkit` is a submodule of `github.com/alexander-kulyk/ai_toolkit` shared with the SPDMS projects, which do depend on styled-components (`SPI_Artifact_Tasks/package.json`) and on that skill's `spTheme` guidance. The override is declared in `client/CLAUDE.md` and `client/AGENTS.md`, alongside the D-001 zustand override of the `state-management` skill's Context-only rule. No submodule commit |
| D-007 | ~~Decision needed~~ **Decided 2026-08-10** | Date/time controls: native `<input type=date/time>` (planned in EVID-026) vs `@mui/x-date-pickers` (root dependency, missing peers, F-021) | An unplanned second styling system and three new dependencies | **User: native `<input type="date">` / `<input type="time">`**, styled with Tailwind. `@mui/x-date-pickers` is not adopted (F-021 stands) |

## Handoff to OpenSpec

<!-- Reference finding/risk/decision IDs rather than restating their content. -->

### Facts later artifacts may rely on

F-001 to F-007 (the shipped HTTP contract, version-pinned by EVID-001 to EVID-009 and its tests); F-008 (no event status); F-010 to F-014 (FullCalendar 6.1.21 capabilities as installed); F-019 (FSD layers to be created); F-024 (the only verification gate that exists).

### Constraints later artifacts must preserve

F-002 and F-004 (exact request and response shapes); F-006 (client owns user-facing copy); F-007 (participant eligibility semantics); F-019 (FSD import direction and public APIs); F-020 (dependency declaration through pnpm); F-023 and R-013 (domain vocabulary and deployment posture); R-002, R-004, R-006, R-008 as behavioral constraints on whatever data layer is chosen.

### Decisions proposal/design must resolve

**Every decision D-001 to D-007, and U-001, is settled by the user (2026-08-10)** — the proposal must adopt the recorded answers verbatim and must not re-open them. What remains for the proposal is the consequences that follow from those answers, none of which are optional:

- D-001 and D-006 require correcting `client/CLAUDE.md:19-20` and `client/AGENTS.md:26-27` in the same change, declaring the zustand and Tailwind overrides at package level; the shared `.ai_toolkit` skills are explicitly **not** to be edited.
- D-003 fixes the calendar route at `/events` but leaves root-path behavior, unmatched-path behavior, and the "Users" nav label under F-023 still to be stated.
- D-004 makes the CORS-dependent development path (A-001, R-011) a stated constraint rather than an accident, and requires an environment-variable strategy for the axios `baseURL`.
- D-005 means no status filter reaches the wire; R-001 (`z.strictObject`) makes an invented `status` parameter a 400 that presents as an empty calendar.
- U-001 requires an empty-state path through the participant selectors that does not error.

A-001 to A-003 must be confirmed or carried forward as labeled assumptions, never promoted silently. U-002 and U-003 must be visible to whoever verifies the result.

### Behaviors specs must define precisely

The visible-period read and its exact parameters (F-004, F-012, R-001, R-004); calendar view switching and the preserved focused date (EVID-028 `event-calendar`); the empty-cell entry point and its prefill in each view (F-011); the dialog's Create vs Edit actions, validation gating, submission states, and error copy (EVID-031, EVID-028 `event-management`, F-006); participant search, add, remove, and whole-set commit semantics (EVID-028 `event-participants`, R-006, R-007, R-008); post-mutation calendar refresh (R-002); nav, active-link, root, and unmatched-route behavior (D-003).

### Verification concerns tasks must eventually cover

R-001 (no stray query parameter), R-004 (leading/trailing month cells populated), R-006 (participant removal actually persists), R-002 (calendar reflects a mutation without reload), R-003 (clean-install dependency resolution), R-007 and R-009 (error mapping shows no server text), R-011 (dev origin/CORS or proxy works), R-012 (StrictMode double-mount), U-001 (selectors have data). F-024 constrains what may be claimed about any of these until a test script exists and is run.

## Not investigated

- **Server changes of any kind.** Out of scope by the request; the contract was read as a consumer (EVID-001 to EVID-009) and not re-derived.
- **Runtime database contents and whether the API process is up.** Blocked by EVID-033 and the rule against using credentials; recorded as U-001/U-002.
- **`add-events-api` and the non-OpenSpec `specs/add-events-api/` set.** Already declared superseded for the server surface (EVID-027) and carrying no client scope.
- **A client test-runner selection.** No test infrastructure exists (F-024) and the choice is an artifact-level decision, not a research finding.
- **Analytics and Users page content.** The request defines them as stubs; their real requirements belong to the Dashboard/Client/Employee Management product areas (EVID-035).
- **Accessibility auditing of FullCalendar's own DOM, and Tailwind v4 preflight interaction with the injected FullCalendar stylesheet (F-013).** Styling-level only; no evidence of a functional conflict, and both are observable during implementation.
