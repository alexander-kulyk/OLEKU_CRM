# Tasks: Events client UI

**Verification reality (F-024):** `pnpm --filter client build` is the only automated gate in this package — there is no client test runner or linter, and this change does not add one. Every behavioral check below is a manual observation against a running client and server. No Stage may claim a scenario is "tested"; it is observed. Where an observation could not be performed, say so rather than marking the task complete.

**Environment prerequisite (U-002, U-003):** the events API exists only on `feat/add-events-server-api`. Stages 3 onward require a server running that code, reachable at the configured base URL. Without it every read 404s and the calendar renders empty with a load error — which is correct behavior, not a defect.

## 1. Foundation

- [ ] 1.1 Add `zustand` to the client with `pnpm --filter client add zustand`, and commit the updated `client/package.json` and `pnpm-lock.yaml`
- [ ] 1.2 Remove `@tanstack/react-query` from `client/package.json`, delete `client/src/app/query-client.ts`, and drop `QueryClientProvider` from `client/src/main.tsx`
- [ ] 1.3 Create the FSD layer directories `src/pages/`, `src/features/`, and `src/shared/` with the segment structure from design.md D1, each slice exposing an `index.ts` public API
- [ ] 1.4 Define the global style layer in `client/src/index.css`: a Tailwind v4 `@theme` block with color, spacing, radius, and typography tokens, plus a base layer covering box sizing, body background and text color, and focus-visible treatment
- [ ] 1.5 Create the axios instance in `src/shared/api` with `baseURL` from `import.meta.env.VITE_API_BASE_URL` defaulting to `http://localhost:3000/api`, and commit `client/.env.example` documenting that variable and the `CORS_ORIGIN` it must agree with
- [ ] 1.6 Add the response interceptor that normalises every failure into one internal error shape carrying the server's `code`, or a transport marker when no error envelope is present

**Validation:**

- `pnpm --filter client build`
- `grep -n '"zustand"' client/package.json` prints a line — proves the dependency is declared in the client, not resolved upward from the root (R-003)
- `grep -rn "@tanstack/react-query" client/src client/package.json` prints nothing
- `pnpm install --frozen-lockfile` succeeds from a clean `node_modules`

**Done when:**

- The build passes, `zustand` appears in `client/package.json`, no TanStack Query reference remains in `client/`, and the four FSD layer directories exist with `index.ts` public APIs

**Do not:** edit anything under `.ai_toolkit/` — it is a submodule shared with other projects (design.md D8).

**Rollback:** `git revert` the Stage commit and run `pnpm install` to restore the previous lockfile state.

## 2. App shell and routing

- [ ] 2.1 Build the layout shell in `src/app`: a persistent left vertical navigation with the Calendar, Analytics, and Users entries, and a routed outlet for page content
- [ ] 2.2 Style the active navigation entry distinctly, driven by the current location
- [ ] 2.3 Define the routes — `/events` for the calendar, `/analytics`, `/users`, a redirect from `/` to `/events`, and a catch-all route
- [ ] 2.4 Create the Analytics and Users stub pages: identifying placeholder content, no API access
- [ ] 2.5 Create the not-found page, rendered inside the shell with a link back to `/events`

**Validation:**

- `pnpm --filter client build`
- With `pnpm dev:client` running: open `/` and confirm the calendar page is displayed at `/events`
- Click each of the three navigation entries and confirm the content area swaps, the active indication follows, and no full page reload occurs
- Use browser Back after navigating and confirm the previous page and its active indication are restored
- Open `/nonexistent` and confirm the not-found page renders inside the shell with the menu still usable and no entry marked active
- With the network panel open, visit Analytics and Users and confirm no API request is issued

**Done when:**

- All five routes resolve as specified in `specs/app-navigation/spec.md`, the shell persists across navigation, and the stub pages issue no requests

**Depends on:** Stage 1

## 3. Event data layer

- [ ] 3.1 Define the client-side event and participant types matching the shipped response shape (`id`, `title`, `startAt`, `endAt`, `attendees[]`, `hosts[]` with `id`/`firstName`/`lastName`/`fullName`)
- [ ] 3.2 Implement the event API functions in `src/shared/api` — period read, create, update, delete — assembling the read query with exactly `from` and `to` in one place that nothing downstream can append to
- [ ] 3.3 Create the zustand store holding calendar UI state (active view, focused date, dialog target) and event data state (active period, events, load status, error), per design.md D2
- [ ] 3.4 Implement the period read action with the stale-response guard: record the period each read was issued for and apply the response only if that period is still active
- [ ] 3.5 Implement the post-mutation refresh — every successful create, update, and delete re-reads the currently active period rather than splicing the local array
- [ ] 3.6 Implement the `(operation, code)` error-copy mapping, with a per-operation default for unmapped codes; the server's `message` is never rendered

**Validation:**

- `pnpm --filter client build`
- `grep -rn "message" client/src/shared/api` — confirm by inspection that no server-supplied `message` is passed to a user-facing surface (F-006)
- Confirm by inspection that no code path can append a third parameter to an event or directory query (R-001)

**Done when:**

- The store exposes the period read, the three mutations, and the refresh trigger; the stale-response guard is in place; and every user-facing string originates in the client

**Depends on:** Stage 2

**Do not:** send a `status` parameter or apply any lifecycle filter — events carry no status field and "active events" means every event overlapping the visible period (research D-005).

## 4. Calendar surface

- [ ] 4.1 Mount FullCalendar on the events page with `headerToolbar: false` and the `dayGrid`, `timeGrid`, and `interaction` plugins, mapping views to `dayGridMonth` / `timeGridWeek` / `timeGridDay`
- [ ] 4.2 Build the custom toolbar matching the reference screenshot — prev/next chevrons and Today on the left, period title centred, Month/Week/Day segmented control on the right — driving the calendar through `ref.getApi()`
- [ ] 4.3 Wire `datesSet` as the single read trigger, passing its `startStr`/`endStr` through unmodified as `from`/`to`
- [ ] 4.4 Map domain events to the library's shape at the boundary (`startAt`→`start`, `endAt`→`end`, remainder in `extendedProps`) and render them in all three views
- [ ] 4.5 Add the loading indication and the failure state with a retry action for the period read
- [ ] 4.6 Wire `dateClick` and `select`/`selectable` to open the dialog in Create mode with the date prefilled, plus the start time in week and day views
- [ ] 4.7 Wire `eventClick` to open the dialog in Edit mode for the selected event

**Validation:**

- `pnpm --filter client build`
- Open `/events` and confirm the current month is displayed with today's cell distinguished
- With the network panel filtered to `/api/events`: navigate prev, next, and Today, and switch views — confirm exactly one request per period change, carrying only `from` and `to`, each returning 200 (R-001)
- In month view, confirm an event dated in a visible leading or trailing adjacent-month cell is rendered (R-004)
- Navigate to a non-current period, switch view, and confirm the new view shows the period containing the focused date, not today
- Navigate prev/next rapidly several times and confirm the events displayed match the period that ended up on screen (stale-response guard)
- Stop the server, navigate a period, and confirm a plain-language load error with a retry appears — not an empty calendar and no server text (R-009)
- Restart the server, select retry, and confirm the events load
- Reload with React StrictMode active and confirm no duplicated calendar DOM (R-012)
- Confirm an event renders as a compact time+title entry in month view and against the time axis in week and day views

**Done when:**

- Every scenario in `specs/event-calendar/spec.md` has been observed, and the events request carries exactly two parameters on every navigation

**Depends on:** Stage 3

## 5. Event dialog

- [ ] 5.1 Build the modal dialog shell with the four PRD sections — event details, attendees, hosts, actions — and mode-dependent actions (Create: Save only; Edit: save-changes plus Delete)
- [ ] 5.2 Build the event details fields with react-hook-form and a zod resolver: text input for name, native `<input type="date">`, and native `<input type="time">` for start and end, styled with Tailwind
- [ ] 5.3 Implement validation — non-blank name, valid date and times, end strictly later than start — with messages next to their fields and the primary action disabled while invalid
- [ ] 5.4 Implement the local date/time ↔ instant conversion boundary in `src/shared/lib`, interpreting entered values in the browser's time zone
- [ ] 5.5 Populate Edit mode from the selected event's list data, copied into form state on open
- [ ] 5.6 Wire create, update, and delete through the store, closing the dialog only on success
- [ ] 5.7 Implement submission states: loading on the triggering action, disabled form actions, and prevention of repeated submission
- [ ] 5.8 Implement the delete confirmation with Cancel and Delete, and the failure path that keeps the event and the dialog
- [ ] 5.9 Implement the discard confirmation for close icon, outside click, and Escape, offering Continue editing and Discard changes, shown only when the form is dirty
- [ ] 5.10 Handle the case where the event open in Edit mode disappears from a refresh: keep the dialog and its values, surface the failure on save

**Validation:**

- `pnpm --filter client build`
- Click an empty month cell and confirm Create mode opens with the date prefilled and no Edit or Delete action
- Click an empty week and day slot and confirm the start time is prefilled too
- Leave each required field empty in turn and confirm the primary action stays disabled with a message next to that field
- Enter a whitespace-only name and confirm it is rejected as missing
- Set end time equal to, then earlier than, start time and confirm the validation message and disabled action
- Save a valid event and confirm the dialog closes and the event appears at its date and time without a reload (R-002)
- Open the created event and confirm Edit mode is populated and shows save-changes plus Delete, with no Create Save action
- Change the date/time, save, and confirm the calendar shows it at the new position and not the old (R-002)
- Stop the server, attempt a save, and confirm the dialog stays open, every entered value survives, and the message is plain language with no server text
- Restart the server, resubmit, and confirm the save succeeds
- Trigger Delete, confirm the confirmation appears; Cancel and confirm the event and dialog are unchanged; Delete and confirm it leaves the calendar immediately (R-002)
- Activate the primary action repeatedly during a submission and confirm only one operation is issued (network panel)
- Close a clean dialog via close icon, outside click, and Escape — confirm each closes immediately
- Dirty the form and repeat all three close routes — confirm the discard confirmation each time, that Continue editing preserves everything, and that Discard closes without creating or updating
- Delete an event from a second browser tab while its dialog is open in the first, then save — confirm a plain-language "no longer found" message and preserved data (R-005, R-009)

**Done when:**

- Every scenario in `specs/event-management/spec.md` has been observed

**Depends on:** Stage 4

## 6. Attendees and hosts

- [ ] 6.1 Implement the directory API functions for contacts and employees, sending `search` to the service and `canHostEvents=true` for hosts, with the query assembled so no extra parameter can be appended
- [ ] 6.2 Build the searchable multi-select control used by both sections, with server-resolved search and a no-matches indication
- [ ] 6.3 Implement the explicit Add step: Add disabled while nothing is selected, moving the selection into the assigned list and clearing the selector
- [ ] 6.4 Implement duplicate prevention, both against the existing assigned list and within a single Add
- [ ] 6.5 Render assigned people as chips showing the name and a remove control, removing only that person and leaving the dialog open
- [ ] 6.6 Send the complete intended `attendeeIds` and `hostIds` on every save, including `[]`, and including the role the user did not change
- [ ] 6.7 Implement the empty-directory state — an indication that nobody is available to assign, with no error and no block on saving
- [ ] 6.8 Implement the per-section load-failure state with a retry, leaving the event detail fields usable and populated

**Validation:**

- `pnpm --filter client build`
- With the network panel filtered to `/api/contacts` and `/api/employees`: open each selector and confirm the request carries only the permitted parameters and returns 200 (R-001)
- Confirm the host selector's request carries `canHostEvents=true` and that an ineligible or inactive employee is not offered (R-007)
- Type a search term and confirm it is sent to the service rather than filtering a held list (R-008)
- Add a person, then attempt to add the same person again, and confirm they appear exactly once
- Confirm Add is disabled with nothing selected, and that selecting without Add leaves the assigned list unchanged
- **Remove every attendee from an existing event, save, reopen it, and confirm none are assigned** — then remove one of several hosts, save, reopen, and confirm exactly the remaining hosts (R-006; this fails silently if the payload omits a role, so verify by reopening, not by the request alone)
- Change only the attendees, save, reopen, and confirm the hosts are still exactly as shown before the save (R-006)
- Attempt to save with a participant that the server rejects and confirm a plain-language message with the entered data preserved (R-007)
- Against an empty directory, confirm both selectors show an empty state with no error, and that an event with no participants saves successfully (U-001)
- Stop the server, open a selector, and confirm the section shows a plain-language load error with a retry while the detail fields stay usable

**Done when:**

- Every scenario in `specs/event-participants/spec.md` has been observed, or — for the participant-eligibility scenarios — explicitly reported as unexercised because the directory is empty (U-001)

**Depends on:** Stage 5

## 7. Documentation and final verification

- [ ] 7.1 Update `client/CLAUDE.md` — replace the TanStack Query and same-origin `/api` guidance with the zustand store, the axios base-URL strategy, and the Tailwind v4 styling rule, noting these override the shared skills for this package
- [ ] 7.2 Update `client/AGENTS.md` the same way, keeping its verification and code-review sections consistent with what now exists
- [ ] 7.3 Confirm no file under `.ai_toolkit/` was modified
- [ ] 7.4 Run the full manual pass end to end against a running server, in month, week, and day view
- [ ] 7.5 Record which spec scenarios were observed and which could not be exercised, with the reason

**Validation:**

- `pnpm --filter client build`
- `git -C .ai_toolkit status --porcelain` prints nothing
- `git status --short` shows changes only under `client/`, `openspec/changes/add-events-client-ui/`, and `pnpm-lock.yaml`
- `grep -n "TanStack\|tanstack" client/CLAUDE.md client/AGENTS.md` prints nothing
- With the dev server on a port other than 5173, confirm requests fail with a CORS rejection and that `client/.env.example` documents the `CORS_ORIGIN` agreement this depends on (R-011)

**Done when:**

- The build passes, both instruction documents describe the shipped stack, the submodule is untouched, and the manual pass is recorded with any unexercised scenario named and explained

**Depends on:** Stage 6

**Do not:** claim any scenario is covered by automated tests — none exist in this package (F-024).
