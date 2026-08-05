## 1. Dependencies and workspace cleanup

- [ ] 1.1 Remove the unused `@mui/x-date-pickers` and `zustand` entries from the root `package.json`
- [ ] 1.2 Add `zod` to `server` dependencies and `mongodb-memory-server` to `server` dev dependencies
- [ ] 1.3 Add `@hookform/resolvers` to `client` dependencies, and `vitest`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `jsdom` to `client` dev dependencies
- [ ] 1.4 Add a `test` script to both packages (`node --test` for `server`, `vitest run` for `client`) and a root `test` script that runs both; run `pnpm install` and confirm both packages still build

## 2. Server data model

- [ ] 2.1 Create `server/src/modules/directory/contact.model.ts` and `employee.model.ts` — Mongoose schemas with required `firstName` and `lastName`, optional `email`, a `fullName` virtual, timestamps, and a `{ lastName, firstName }` index for sorted search; bind each explicitly to the existing `contacts` and `employees` collections
- [ ] 2.2 Create `server/src/modules/events/event.model.ts` bound to the existing `events` collection — `name`, `startsAt`, `endsAt`, `attendeeIds` (ref Contact), `hostIds` (ref Employee), timestamps
- [ ] 2.3 Add a de-duplicating setter to the `attendeeIds` and `hostIds` paths so a duplicate id can never be stored
- [ ] 2.4 Add a `pre('validate')` hook rejecting `endsAt <= startsAt`, and a compound index on `{ startsAt: 1, endsAt: 1 }`
- [ ] 2.5 Create `server/src/shared/db/seed.ts` seeding a handful of contacts and employees into the existing empty collections, upserting by email so re-running it against the Atlas cluster is safe; add a `seed` script to `server/package.json`
- [ ] 2.6 Leave the `users` collection untouched — no model, no reads, no writes

## 3. Server HTTP foundation

- [ ] 3.1 Create `server/src/shared/http/error-envelope.ts` — an application error type carrying `status`, `code`, and `message`, with helpers for the codes this change needs (validation failure, not found, unknown participant)
- [ ] 3.2 Rewrite the error handler in `server/src/app.ts` to emit `{ error: { code, message } }` only, never a stack trace or raw driver message, and move it to `server/src/shared/http/error-middleware.ts`
- [ ] 3.3 Create `server/src/shared/http/validate.ts` — a helper that parses a request part with a Zod schema and throws the validation application error on failure

## 4. Server events module

- [ ] 4.1 Create `server/src/modules/events/event.schemas.ts` — Zod schemas for the list query (`from`, `to` required ISO instants), the create body, and the update body, including the `endsAt > startsAt` refinement and non-blank `name`
- [ ] 4.2 Create `server/src/modules/events/event.service.ts` with a list function querying `startsAt < to AND endsAt > from`, populating attendee and host names, dropping unresolvable references, and returning `{ id, name, startsAt, endsAt, attendees: [...], hosts: [...] }` with each person as `{ id, firstName, lastName, fullName }`
- [ ] 4.3 Add the create function — verifies every submitted attendee and host id exists, rejecting unknown ids, then inserts and returns the created event in read shape
- [ ] 4.4 Add the update function — same id verification, replaces the participant arrays wholesale with the submitted sets, returns the updated event or the not-found error
- [ ] 4.5 Add the delete function — deletes by id, returns the not-found error when nothing matched
- [ ] 4.6 Create `server/src/modules/events/event.routes.ts` wiring `GET`, `POST`, `PATCH /:id`, `DELETE /:id` through the validation helper, and mount it at `/api/events` in `app.ts`

## 5. Server directory module

- [ ] 5.1 Create `server/src/modules/directory/directory.service.ts` — list contacts and list employees with optional case-insensitive `search` matching either first or last name, sorted by last then first name, capped at a fixed result limit
- [ ] 5.2 Create `server/src/modules/directory/directory.routes.ts` exposing `GET /api/contacts` and `GET /api/employees` returning `{ id, firstName, lastName, fullName }` entries, and mount it in `app.ts`

## 6. Server tests

- [ ] 6.1 Add a test helper that starts `mongodb-memory-server`, connects Mongoose to it, clears collections between tests, and tears both down — it must build its own connection string and never read `DB_HOST`, so a suite that truncates collections can never reach the Atlas cluster
- [ ] 6.2 Test the list endpoint — events overlapping the range are returned, events entirely outside it are not, and events straddling either boundary are included
- [ ] 6.3 Test create — a valid event is stored with its participants; `endsAt <= startsAt` is rejected; a blank name is rejected; an unknown attendee or host id is rejected
- [ ] 6.4 Test create and update with duplicate ids in the request — exactly one assignment per person is stored
- [ ] 6.5 Test update — participant arrays are replaced wholesale (removed people gone, added people present) and an unknown event id returns not found
- [ ] 6.6 Test delete — the event is removed, and deleting a non-existent id returns not found
- [ ] 6.7 Test that an event holding a participant reference that no longer resolves is still returned, with the unresolvable person omitted
- [ ] 6.8 Test that error responses carry only `{ error: { code, message } }` with no stack trace or internal detail
- [ ] 6.9 Test the directory endpoints — search matches on either first or last name, results are sorted, and the result cap is honored

## 7. Client foundation

- [ ] 7.1 Create the FSD layers: move the query client into `client/src/app/providers/`, move the router into `client/src/app/router/`, and update `main.tsx` to the new paths
- [ ] 7.2 Create `client/src/shared/api/` — a fetch wrapper that parses the `{ error: { code, message } }` envelope into a typed client error, plus the API base URL config
- [ ] 7.3 Create `client/src/shared/components/` — `Modal` (native `<dialog>` with `showModal()`, intercepted `cancel` event, and backdrop-click detection, all routed through one close handler), `ConfirmDialog`, `Button` with a loading state, `Field` wrapper rendering a label and validation message, and the segment barrel
- [ ] 7.4 Add a Vitest config with the jsdom environment and a setup file registering `@testing-library/jest-dom`
- [ ] 7.5 Add the `/events` route to the router and a placeholder `pages/EventsPage` slice with its `index.ts` barrel, so the route resolves before the feature exists

## 8. Client events slice — data layer

- [ ] 8.1 Create `features/events/api/events.ts` and `api/directory.ts` — request functions for list/create/update/delete and for the contact and employee directories
- [ ] 8.2 Create `features/events/model/queryKeys.ts` and query/mutation hooks over TanStack Query, invalidating the event list on every successful mutation
- [ ] 8.3 Create `features/events/lib/datetime.ts` — compose a local date + start/end times into UTC instants, and decompose stored instants back into the three local form fields
- [ ] 8.4 Create `features/events/model/eventFormSchema.ts` — the Zod schema mirroring the server rules (non-blank name, required date and times, end later than start), wired through `@hookform/resolvers/zod`
- [ ] 8.5 Create `features/events/model/errorMessages.ts` mapping server error codes to user-facing copy per operation, with a generic fallback that never surfaces server text

## 9. Client events slice — UI

- [ ] 9.1 Build `ui/EventCalendar.tsx` — FullCalendar with month, week, and day views, previous/next/today navigation, and the current date highlighted; events passed in from the query cache and the calendar driven through a single ref
- [ ] 9.2 Wire the calendar's visible period to the list query so navigating or switching view refetches that period, and preserve the focused date across view switches
- [ ] 9.3 Add the calendar's loading indicator and its failure state with a retry action
- [ ] 9.4 Handle the calendar's open-event and select-slot interactions — opening the dialog in Edit mode for an existing event, and in Create mode prefilled with the selected date and, in time-based views, the slot's start time
- [ ] 9.5 Build `ui/EventDetailsFields.tsx` — name text input, native date input, native start and end time inputs with `step="60"`, each rendering its validation message adjacent to the field
- [ ] 9.6 Build `ui/ParticipantSection.tsx` — searchable multi-select over the directory showing each person's full name and excluding already-assigned people, an Add action disabled while nothing is selected, the assigned chip list with per-item remove, and pending selections held in local state
- [ ] 9.7 Build `ui/EventDialog.tsx` — React Hook Form holding the detail fields plus the attendee and host lists, mode-dependent actions (Save only in Create; Edit and Delete in Edit), and the commit action disabled while the form is invalid
- [ ] 9.8 Add the create and update flows — loading state on the triggering action, repeat submission blocked, dialog closed on success, dialog kept open with all entered data and a user-facing error on failure
- [ ] 9.9 Add the delete flow — confirmation stating the event will be removed and cannot be undone; cancel leaves the event and the dialog untouched; confirm deletes and closes both; failure keeps the event and the dialog with an error
- [ ] 9.10 Add the discard-changes flow — the close icon, backdrop click, and Escape all run the same dirty check, closing immediately when clean and prompting to continue editing or discard when dirty
- [ ] 9.11 Compose `pages/EventsPage` from the calendar and the dialog, export the slice through `features/events/index.ts`, and confirm no cross-slice or upward imports were introduced

## 10. Client tests

- [ ] 10.1 Test `lib/datetime.ts` round-trips — form fields to UTC instants and back, including across a day boundary
- [ ] 10.2 Test the form schema — blank and whitespace-only names, missing date or times, and end time equal to or earlier than start all fail; a valid event with no participants passes
- [ ] 10.3 Test the dialog's mode-dependent actions — Create shows Save without Edit or Delete; Edit shows Edit and Delete without Save and populates the existing values
- [ ] 10.4 Test that the commit action is disabled while the form is invalid and enabled once every rule is satisfied
- [ ] 10.5 Test `ParticipantSection` — search narrows options, several people can be added at once, the selector clears after Add, Add is disabled with an empty selection, an assigned person is not offered again, and removing one person leaves the rest and the other section untouched
- [ ] 10.6 Test the three close routes against a clean form (closes immediately) and a dirty form (prompts), including the case where the only change is a removed attendee
- [ ] 10.7 Test that continuing to edit preserves the form and discarding closes without committing
- [ ] 10.8 Test failure handling — a failed create or update keeps the dialog open with the entered data and shows a user-facing message carrying no server text

## 11. Verification

- [ ] 11.1 Run the seed script, then walk the acceptance criteria in `docs/prd/release 1.0.0/eventsPage.md` §17 against the running app, including the calendar scenarios not covered by automated tests
- [ ] 11.2 Run both test suites and both builds (`pnpm build:client`, `pnpm build:server`) and confirm they pass clean
- [ ] 11.3 Confirm the seed and the app wrote only into `contacts`, `employees`, and `events`, and that `users` is still empty and untouched
- [ ] 11.4 Update `README.md` with the seed and test commands and note that the API is unauthenticated, runs against a shared Atlas cluster, and must not be exposed beyond local development
