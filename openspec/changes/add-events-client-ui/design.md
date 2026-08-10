## Context

See proposal.md — Why. What shapes the approach here:

- The client is effectively empty: `src/App.tsx`, `src/app/router.tsx` (one `/` route), `src/app/query-client.ts`, `src/main.tsx`, and an `index.css` holding a single `@import "tailwindcss"`. Nothing calls an API and only the `app` FSD layer exists.
- The server API is already shipped and test-covered on `feat/add-events-server-api`. Its contract is a fixed input, not a design variable: period-bounded read only (no `GET /api/events/:id`), strict query objects, `title`/`startAt`/`endAt`, participants pre-resolved on the read, `PATCH` semantics where an omitted participant array means "leave unchanged", and a uniform `{ error: { code, message } }` failure envelope with four codes.
- Every stack decision was settled by the user and recorded in research.md (D-001…D-007). This design implements those answers; it does not re-open them.
- `pnpm --filter client build` is the only verification gate that exists (F-024). There is no client test runner or linter.

## Goals / Non-Goals

**Goals**

- One data path for events: zustand + axios, with a defined invalidation trigger, so the calendar is never stale and remote state is never duplicated.
- Keep every request the calendar issues within what the server's strict schemas accept, so a malformed read can never degrade into a silently empty calendar.
- Establish FSD layers and the global style layer that later features copy without rework.

**Non-Goals**

- Introducing a client test runner. None exists; choosing one is separate work and would expand this change's footprint (F-024).
- Optimistic updates, offline behavior, or request cancellation beyond what avoids applying a stale response.
- Generalising the calendar into a reusable scheduling component. It serves this page.
- Any accessibility remediation of FullCalendar's own DOM. The controls this change owns are keyboard-reachable and labelled; the library's internals are out of scope.

## Decisions

### D1. FSD layer layout

```
src/
  app/        router, layout shell, axios instance, global providers
  pages/      events, analytics, users, not-found
  features/   event-calendar, event-dialog, event-participants
  shared/     api (client + error mapping), ui (primitives), lib (date/time), config
```

Imports travel downward only (`app → pages → features → shared`), slices never import each other's internals, and each slice is reached through its `index.ts`. Cross-feature needs are resolved by lifting the shared piece to `shared/`, not by a sideways import.

The one place this bites: the dialog (`event-dialog`) and the calendar (`event-calendar`) both need the event store and the event API. Both live in `shared/` — the store under a `shared/model` segment, the API under `shared/api` — rather than in one feature that the other reaches into. *Alternative considered:* a single fat `features/events` slice holding calendar, dialog, and participants together. Rejected: it would put the 250-line-scale component boundary inside one slice and make the calendar's period state indistinguishable from the dialog's form state.

### D2. zustand store shape and period-keyed caching

One store owns both event data and calendar UI state (research D-001):

- **UI state**: active view (`month` | `week` | `day`), the focused date, and the dialog target (`closed` | `create` with prefill | `edit` with an event id).
- **Data state**: the active period (`from`/`to` as the exact strings sent to the server), the events for that period, a load status, and an error.

Only one period is held at a time. Navigating replaces it rather than accumulating a keyed cache. *Rationale:* the alternative — a `Map` keyed by period string — buys a flicker-free back-and-forth at the cost of a manual eviction and cross-period invalidation policy that this change has no test infrastructure to defend. Correctness over cache depth.

**Stale-response guard.** Each read records the period it was issued for; a response is applied only if that period is still the active one. Without this, navigating quickly (month → next → next) can land an earlier response last and render the wrong month's events.

**Invalidation trigger** (spec: *Calendar reflects a mutation without a reload*): every successful create, update, and delete re-reads the currently active period from the server. Not a local splice into the array. A create can produce a schedule outside the rendered period, an update can move an event out of it, and the server owns the resolved participant objects — a re-read is the only version that is right in all three cases. The cost is one extra round trip per mutation, which is acceptable for a single-user local surface.

### D3. Reading a period: source of the boundaries

FullCalendar's `datesSet` fires on every period or view change and reports the **active range** — the whole rendered grid, including the leading and trailing days of adjacent months. Its `startStr`/`endStr` are time-bearing ISO strings carrying the browser's numeric offset, a form the shipped server accepts and has tests for. Those strings are passed through to `from`/`to` unmodified.

Two things this design deliberately does not do:

- Derive the boundaries from the focused date and the view. That reconstructs, with new bugs, a value the library already computes, and gets month view wrong (R-004).
- Reformat, truncate, or normalise the strings to `Z`. Pass-through keeps the client out of the timezone conversion business on the read path.

`datesSet` is the *only* trigger for a read. Prev/next/today/view-change mutate the calendar, `datesSet` observes the result, and the store reads. One path, no double-fetch.

**Exactly two parameters.** The event query schema is strict — an unrecognised key is a `VALIDATION_ERROR`, which the user experiences as an empty calendar, not as an error (R-001). Nothing else is appended: no cache-buster, no `timeZone`, no `limit`, and in particular no `status`, since events have no status field and "active events" means "everything overlapping the visible period" (research D-005).

### D4. axios layer and error mapping

One axios instance in `shared/api` with `baseURL` from `import.meta.env.VITE_API_BASE_URL`, defaulting to `http://localhost:3000/api`, plus a committed `client/.env.example`. No Vite proxy (research D-004).

A single response interceptor converts every failure into one internal error shape carrying the server's `code` (or a transport marker when there is no envelope — network failure, timeout, CORS rejection). **The server's `message` is never rendered.** User-facing copy is produced at the call site, keyed by `(operation, code)`, because `NOT_FOUND` from a delete means "this event is gone" while the same code from a bad URL means something the user cannot act on (F-005, F-006). A default per operation covers unmapped codes.

*Alternative considered:* rendering the server message when it exists, mapping only the rest. Rejected — messages like `"endAt must be strictly later than startAt."` are field-level engineering copy, and the PRD requires non-technical language.

### D5. Date and time handling

Native `<input type="date">` and `<input type="time">` styled with Tailwind (research D-007), which means the form's values are a local date string and two local time strings.

The conversion boundary is explicit and lives in `shared/lib`: `(dateString, timeString) → Date → toISOString()` on the way out, and instant → local date/time fields on the way in. The interpretation is the browser's own time zone, so an event created at 09:00 is stored as the instant that is 09:00 where the user is. This is the working default, not a settled product rule — PRD §18 defers time-zone policy (R-010).

Client-side `end > start` validation is a UX affordance that keeps the primary action disabled; the server enforces the same rule on every write and remains the guarantee (F-009).

### D6. FullCalendar integration

`headerToolbar: false` with a custom toolbar driving the calendar through `ref.getApi()` — `prev()`, `next()`, `today()`, `changeView()`. This is what makes the reference screenshot's layout (chevrons + Today left, title centred, segmented control right) achievable without fighting the library's own toolbar markup.

The calendar is treated as **uncontrolled**: React owns the toolbar and the store owns the events, but the calendar's internal date/view cursor is driven imperatively and read back through `datesSet` rather than being mirrored in React state and pushed back down. Mirroring invites a render loop, since every programmatic change re-fires `datesSet`. Under React 19 StrictMode's double-mount this also keeps the failure mode to a duplicated read rather than duplicated DOM (R-012).

Views map to `dayGridMonth`, `timeGridWeek`, `timeGridDay`; the empty-slot entry point is `dateClick` plus `select`/`selectable`, and existing events open through `eventClick`. Events are mapped domain → library at the boundary (`title`→`title`, `startAt`→`start`, `endAt`→`end`, the rest carried in `extendedProps`). No CSS import is needed — v6 injects its own stylesheet.

### D7. Global styles

`index.css` gains a Tailwind v4 `@theme` block defining color, spacing, radius, and typography tokens, plus a small base layer (box sizing, body background and text color, focus-visible treatment). No `tailwind.config.*` file — v4's CSS-first configuration is the current shape of this package. Components consume tokens through utility classes; there is no second styling system (research D-006).

### D8. Removing TanStack Query

`QueryClientProvider` and `src/app/query-client.ts` are removed along with the dependency. With zustand owning event data, leaving Query wired provides a second, dormant way to hold remote state — which `client/AGENTS.md:44` treats as review-blocking. `client/CLAUDE.md:19-22` and `client/AGENTS.md:26-31` are corrected in the same change so the repository documents what it actually does, with a note that the zustand and Tailwind choices override the shared `.ai_toolkit` skills for this package. **The submodule itself is not touched** — it is shared with the SPDMS projects, which do depend on its styled-components guidance.

## Risks / Trade-offs

- **A stray query parameter turns every read into a 400 that looks like an empty calendar (R-001)** → exactly two parameters are assembled in one place in `shared/api`; nothing downstream can append to an event or directory query. Verified by watching the network panel during navigation.
- **Duplicated remote state going stale (R-002)** → single store, single source, mandatory re-read of the active period after every successful mutation (D2). No local array splicing.
- **`zustand` currently resolves from the repo root, not `client` — it works via upward resolution today and breaks on a clean install (R-003)** → added with `pnpm --filter client add` and the lockfile committed; verified by confirming the entry lands in `client/package.json`.
- **Fetching the calendar month rather than the rendered grid leaves adjacent-month cells empty (R-004)** → boundaries come only from `datesSet`, never reconstructed (D3).
- **No `GET /api/events/:id`, so an open Edit dialog is backed by list data and can be invalidated by a refresh or a concurrent delete (R-005)** → the dialog copies the event into form state on open and does not re-read from the store afterwards; if the event vanishes, the dialog stays open with the user's values and the failure surfaces on save.
- **A `PATCH` omitting a participant array silently keeps the old participants, so removals never persist (R-006)** → the update payload always carries both `attendeeIds` and `hostIds` in full, including `[]`. This is the highest-value thing to check manually, because it fails silently and looks like a success.
- **Offering ineligible people produces `INVALID_PARTICIPANT` at save time instead of at selection time (R-007)** → host options are requested with the host-eligibility filter and the directory returns active-only by default; the mapped error still exists as a backstop, because eligibility can change between load and save.
- **The directory caps at 50 with no pagination, so an unlisted person is unreachable (R-008)** → search text is always sent to the service; there is no client-side filtering of a held slice.
- **`NOT_FOUND` is ambiguous between a wrong URL and a deleted event (R-009)** → copy is keyed by `(operation, code)`, not by code alone (D4).
- **Composing local date + time into instants crosses time zones and DST; PRD §18 defers the policy (R-010)** → one conversion boundary in `shared/lib`, documented as the working default so a future policy change has one place to land.
- **Vite may fall back off port 5173, breaking the server's default `CORS_ORIGIN` (A-001, R-011)** → `client/.env.example` documents both origins; if the dev port moves, `CORS_ORIGIN` must move with it. This is the accepted cost of choosing axios over a proxy.
- **React 19 StrictMode double-mount can duplicate reads or render artifacts (R-012)** → uncontrolled calendar (D6); the stale-response guard makes a duplicate read harmless. Verify visually on first load.
- **The API is unauthenticated (R-013, A-002)** → this change adds no deployed build target and no auth handling; local development only.
- **No automated verification exists (F-024)** → everything behavioral is checked by running the client against a local server. No test-backed claim may be made about any spec scenario in this change, and the task list must say so rather than implying coverage.
- **The participant directory may be empty (U-001)** → the user has accepted this as temporary. The selectors must render an empty state rather than erroring, and the participant scenarios in `event-participants` cannot be fully exercised until the directory is seeded. That gap must be reported, not glossed.

## Migration Plan

Additive to an effectively empty client; no data migration and no server change. The only removals are `@tanstack/react-query` and its provider wiring, which nothing consumes.

**Sequencing dependency (U-003):** the events API exists only on `feat/add-events-server-api`. On a branch without it, every request 404s and the calendar renders empty with a load error. This work should branch from, or merge after, the server branch; whoever verifies it needs a server running with that code (U-002).

Rollback is `git revert` — the change is self-contained within `client/`, plus the two instruction documents.

## Open Questions

These can be answered later without changing the specs, the approach, or the task breakdown:

- Time-zone policy beyond "interpret in the browser's zone" — deferred by PRD §18, isolated to one conversion boundary (D5, R-010).
- Whether the third navigation destination keeps the label "Users". The label is the user's, and the page is a stub; but `users` is the authentication surface, and the people this product manages are contacts and employees (F-023). The name can change when that page acquires real content, with no effect on this change beyond a string and a path.
- Whether to introduce a client test runner, and which. Out of scope here (F-024); the first change that needs regression coverage should decide it.
- Maximum event-name length. The PRD leaves it to a future data-validation spec and the server does not currently cap it.
