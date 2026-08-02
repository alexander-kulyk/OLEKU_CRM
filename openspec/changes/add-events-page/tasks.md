## 1. Data model

- [ ] 1.1 Add `Customer` and `Employee` models to `server/prisma/schema.prisma` with id, first name, last name, optional email, and timestamps
- [ ] 1.2 Add the `Event` model with name, `startsAt`/`endsAt` as `DateTime` (timestamptz), and timestamps
- [ ] 1.3 Add `EventAttendee` (event ↔ customer) and `EventHost` (event ↔ employee) join models with cascade delete from `Event` and `@@unique([eventId, customerId])` / `@@unique([eventId, employeeId])`
- [ ] 1.4 Add a check constraint enforcing `endsAt > startsAt` on `Event`
- [ ] 1.5 Run `prisma migrate dev --name add_events_and_directory` and confirm `server/prisma/migrations/` is created
- [ ] 1.6 Add a seed script inserting a handful of customers and employees, and wire it into `prisma.config.ts`

## 2. Server foundation

- [ ] 2.1 Add `server/src/shared/http/error-envelope.ts` defining the `{ error: { code, message } }` shape and a helper for throwing coded errors
- [ ] 2.2 Add error middleware that converts thrown errors and Zod failures into the envelope with an appropriate status, and never leaks Prisma or stack detail
- [ ] 2.3 Add `zod` to `server/package.json` and a small helper that validates request body/query and throws a coded validation error
- [ ] 2.4 Mount an `/api` router in `server/src/app.ts` and register the error middleware last

## 3. Directory endpoints

- [ ] 3.1 Add `server/src/modules/directory/router.ts` with `GET /api/customers` and `GET /api/employees`, each supporting an optional `search` query and returning id plus displayable name
- [ ] 3.2 Apply case-insensitive matching on first and last name, and cap the result count
- [ ] 3.3 Verify both endpoints return an empty array (not an error) when nothing is registered

## 4. Events endpoints

- [ ] 4.1 Add Zod schemas in `server/src/modules/events/schemas.ts` for create and update payloads (`name`, `startsAt`, `endsAt`, `attendeeIds`, `hostIds`), rejecting whitespace-only names and `endsAt <= startsAt`
- [ ] 4.2 Implement `GET /api/events?from=&to=` returning events overlapping the range with their assigned attendees and hosts
- [ ] 4.3 Implement `POST /api/events` creating the event and its assignments in one transaction, de-duplicating `attendeeIds` and `hostIds`
- [ ] 4.4 Implement `PATCH /api/events/:id` updating fields and replacing assignments wholesale in one transaction
- [ ] 4.5 Implement `DELETE /api/events/:id`, returning a coded not-found error when the event does not exist
- [ ] 4.6 Verify unknown customer or employee ids are rejected with a coded error rather than a raw Prisma failure

## 5. Server tests

- [ ] 5.1 Add a `test` script to `server/package.json` using Node's built-in test runner
- [ ] 5.2 Test `GET /api/events` range filtering: events inside, overlapping, and outside the window
- [ ] 5.3 Test create and update reject `endsAt <= startsAt` and whitespace-only names
- [ ] 5.4 Test participant replacement: adding, removing, and repeating an id in one payload yields exactly one assignment per person per role
- [ ] 5.5 Test delete removes the event and cascades its assignments, and that a missing id returns the coded not-found error
- [ ] 5.6 Test that error responses carry the envelope shape and expose no technical detail

## 6. Client foundation

- [ ] 6.1 Remove the unused `@mui/x-date-pickers` and `zustand` entries from the root `package.json`
- [ ] 6.2 Add `@hookform/resolvers` to `client/package.json`
- [ ] 6.3 Add the `/events` route to `client/src/app/router.tsx` and scaffold `client/src/features/events/EventsPage.tsx`
- [ ] 6.4 Add `client/src/features/events/api/` fetch helpers that parse the error envelope and surface a coded client error
- [ ] 6.5 Add `model/mapping.ts` converting between the form's date + start/end wall-clock fields and UTC `startsAt`/`endsAt` instants
- [ ] 6.6 Add `model/schema.ts` with the Zod event form schema mirroring the server rules

## 7. Calendar

- [ ] 7.1 Render FullCalendar in `calendar/EventCalendar.tsx` with `dayGridMonth`, `timeGridWeek`, and `timeGridDay` views plus the interaction plugin
- [ ] 7.2 Wire the view switcher and the previous/next/today controls, keeping the displayed date anchored when the view changes
- [ ] 7.3 Track the visible range via `datesSet` and drive a TanStack Query keyed by that range
- [ ] 7.4 Map fetched events into FullCalendar events so each shows its name at the correct date and time range
- [ ] 7.5 Handle the load-failure state with a plain-language message and a retry action
- [ ] 7.6 Treat the calendar as uncontrolled — events in via props, imperative calls through a single ref — so StrictMode double-mounting does not duplicate renders

## 8. Event dialog shell

- [ ] 8.1 Build `dialog/EventDialog.tsx` on a native `<dialog>` opened with `showModal()`, laying out the details, attendees, hosts, and actions sections
- [ ] 8.2 Derive Create vs Edit mode and render Save only in Create mode, Edit and Delete only in Edit mode
- [ ] 8.3 Open the dialog in Create mode from a calendar slot selection, prefilling date, and start time when the slot carries one
- [ ] 8.4 Open the dialog in Edit mode from an event click, populating all fields plus assigned attendees and hosts
- [ ] 8.5 Route the close icon, backdrop click, and the `cancel` event (with `preventDefault`) through one close handler
- [ ] 8.6 Build a reusable `dialog/ConfirmDialog.tsx` for the delete and discard confirmations

## 9. Event details form

- [ ] 9.1 Build `dialog/EventDetailsFields.tsx` with the name text input and native `<input type="date">` and two `<input type="time">` controls with `step="60"`, styled with Tailwind
- [ ] 9.2 Wire React Hook Form with the Zod resolver, keeping attendee and host lists inside form state so `isDirty` covers them
- [ ] 9.3 Disable the dialog's primary action while any required field is missing or invalid
- [ ] 9.4 Render validation messages next to the field each concerns
- [ ] 9.5 Verify whitespace-only names and `end <= start` both block submission and show a message

## 10. Attendees and hosts

- [ ] 10.1 Add TanStack Query hooks for the customer and employee directory endpoints, with a search term input
- [ ] 10.2 Build `dialog/ParticipantSection.tsx` — searchable multi-select, Add action, and assigned list — parameterized so attendees and hosts share it
- [ ] 10.3 Hold the pending selector selection in local state so it does not mark the form dirty; clear it after Add
- [ ] 10.4 Disable Add while nothing is selected
- [ ] 10.5 Render each assigned participant as a chip showing the name and a remove control
- [ ] 10.6 Filter already-assigned people out of the selector and de-duplicate on Add so no one is assigned twice
- [ ] 10.7 Show a non-blocking message when a directory request fails, leaving the rest of the dialog usable

## 11. Mutations

- [ ] 11.1 Add create, update, and delete mutations that invalidate the events query on success
- [ ] 11.2 Close the dialog only after a successful create or update; keep it open and preserve all entered values on failure
- [ ] 11.3 Wire the Delete action to the confirmation, deleting only on confirm and leaving the event and dialog untouched on cancel
- [ ] 11.4 Keep the event in the calendar and the dialog open when a delete fails
- [ ] 11.5 Show a loading state on the active action, disable the dialog's other actions, and block repeat submissions while in flight
- [ ] 11.6 Map error codes to plain-language messages that name the failed operation and expose no technical detail

## 12. Unsaved-changes protection

- [ ] 12.1 Show the discard confirmation on any close attempt while the form is dirty, offering Continue editing and Discard changes
- [ ] 12.2 Keep the dialog open and preserve all input on Continue editing
- [ ] 12.3 Close the dialog and discard changes without creating or updating anything on Discard changes
- [ ] 12.4 Verify the prompt fires identically for the close icon, backdrop click, and Escape, including when the only change is a removed attendee
- [ ] 12.5 Verify a clean form closes immediately by all three routes

## 13. Verification

- [ ] 13.1 Run `pnpm build:client` and `pnpm build:server` and confirm both typecheck clean
- [ ] 13.2 Run the server test suite
- [ ] 13.3 Walk the calendar, creation, editing, and deletion acceptance criteria from `docs/product/release 1.0.0/eventsPage.md` §17 against the running app
- [ ] 13.4 Walk the attendees, hosts, and closing-behavior acceptance criteria against the running app
- [ ] 13.5 Confirm an event created in one view appears correctly in the other two
- [ ] 13.6 Run `openspec validate add-events-page --strict`
