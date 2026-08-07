## 1. Dependencies and scripts

- [ ] 1.1 Add `zod` to `server` dependencies with `pnpm --filter server add zod` from the repo root, and commit the updated `pnpm-lock.yaml`
- [ ] 1.2 Add `mongodb-memory-server` to `server` dev dependencies with `pnpm --filter server add -D mongodb-memory-server`
- [ ] 1.3 Add `"test": "node --test"` and `"seed": "node src/shared/db/seed.ts"` scripts to `server/package.json`, leaving `build` as the existing verification gate
- [ ] 1.4 Run `pnpm --filter server build` and confirm it still passes before writing any module code

## 2. Shared HTTP foundation

- [ ] 2.1 Create `server/src/shared/http/error-envelope.ts` — an application error type carrying `status`, `code`, and a user-facing `message`, plus constructors for `VALIDATION_ERROR` (400), `NOT_FOUND` (404), `INVALID_PARTICIPANT` (400), and `INTERNAL_ERROR` (500)
- [ ] 2.2 Create `server/src/shared/http/error-middleware.ts` emitting `{ error: { code, message } }` and nothing else — no stack trace in any environment, no driver or schema text, no echoed request path
- [ ] 2.3 In the same middleware, map Mongoose `CastError` and `ValidationError` to `VALIDATION_ERROR` with status 400, and everything unrecognized to `INTERNAL_ERROR` with status 500 and a generic message
- [ ] 2.4 Create `server/src/shared/http/validate.ts` — a helper that parses a named request part (`body`, `query`, `params`) with a Zod schema and throws the `VALIDATION_ERROR` application error on failure, returning the parsed value so handlers use parsed data rather than the raw request
- [ ] 2.5 Rewrite the catch-all 404 in `server/src/app.ts` to throw `NOT_FOUND` through the shared middleware, and stop echoing `req.originalUrl` into the response body
- [ ] 2.6 Replace the inline error handler in `server/src/app.ts` with the shared middleware, keeping it and the 404 handler last in the chain
- [ ] 2.7 Confirm `GET /api/health` still returns `{ status: 'ok' }` with status 200 after the rewrite

## 3. Directory persistence

- [ ] 3.1 Create `server/src/modules/directory/person-status.ts` — an `active` / `inactive` `const` object with a derived union type; no TypeScript `enum`, which Node's type stripping rejects
- [ ] 3.2 Create `server/src/modules/directory/contact.model.ts` — required `firstName` and `lastName` (trimmed), optional lowercased `email`, `status` defaulting to active, timestamps, a `fullName` virtual, and an explicit binding to the `contacts` collection
- [ ] 3.3 Create `server/src/modules/directory/employee.model.ts` — the same person fields plus optional `position` and `department`, `canHostEvents` defaulting to `false`, `status` defaulting to active, and an explicit binding to the `employees` collection
- [ ] 3.4 Add a `{ lastName: 1, firstName: 1 }` index to both schemas to serve the sorted directory read
- [ ] 3.5 Create `server/src/modules/directory/person-summary.ts` — the shared `{ id, firstName, lastName, fullName }` projection used by both the directory responses and the resolved participants on an event
- [ ] 3.6 Confirm no model, read, or write targets the `users` collection anywhere in the change

## 4. Event persistence

- [ ] 4.1 Create `server/src/modules/events/event.model.ts` bound explicitly to the `events` collection — required trimmed `title`, required `startAt` and `endAt` dates, `attendeeIds` referencing `Contact`, `hostIds` referencing `Employee`, nullable `createdByUserId` and `updatedByUserId` referencing `User`, and timestamps
- [ ] 4.2 Add a de-duplicating setter to the `attendeeIds` and `hostIds` paths so a duplicate reference can never be stored, even by a write that bypasses the route
- [ ] 4.3 Add a `pre('validate')` hook rejecting `endAt <= startAt`, so an inverted or zero-length span cannot be stored outside the request path
- [ ] 4.4 Add the compound index on `{ startAt: 1, endAt: 1 }` that serves the calendar's overlap query

## 5. Directory read API

- [ ] 5.1 Create `server/src/modules/directory/directory.schemas.ts` — the list query schema with an optional length-capped `search`, an optional `status` filter defaulting to active-only, and an optional `canHostEvents` boolean for the employee endpoint
- [ ] 5.2 Add a helper that escapes regular-expression metacharacters in the search term before it is used as a pattern, so a term is matched as literal text and cannot cause catastrophic backtracking
- [ ] 5.3 Create `server/src/modules/directory/directory.service.ts` — list contacts and list employees with case-insensitive matching on either name part, sorted by last name then first name, capped at a fixed result limit, active-only unless a status is named
- [ ] 5.4 Extend the employee listing with the `canHostEvents` filter so the host selector can request only eligible candidates
- [ ] 5.5 Create `server/src/modules/directory/directory.controller.ts` — handlers that validate the query, call the service, and respond with `{ contacts: [...] }` and `{ employees: [...] }`; contacts carry the person summary plus `email` and `status`, employees add `position`, `department`, and `canHostEvents`
- [ ] 5.6 Create `server/src/modules/directory/directory.routes.ts` wiring `GET /contacts` and `GET /employees` to the controller, and mount it under `/api` in `app.ts` above the 404 handler

## 6. Event read API

- [ ] 6.1 Create `server/src/modules/events/event.schemas.ts` with an ISO instant schema built on `z.iso.datetime({ offset: true })` transformed to `Date` — the `offset` flag is required, since FullCalendar sends the browser's numeric offset and the plain form would reject every request from outside UTC
- [ ] 6.2 Add the list query schema to the same file — `from` and `to` both required, both parsed with the instant schema, refined so `to` is later than `from` and the span does not exceed 366 days
- [ ] 6.3 Add a shared read-shape mapper returning `{ id, title, startAt, endAt, attendees, hosts }` with `id` as a string, both instants serialized with a time component and an explicit zone designator, and participants as person summaries
- [ ] 6.4 Create `server/src/modules/events/event.service.ts` with a list function querying `startAt < to AND endAt > from`, populating attendees and hosts with a field projection, and dropping any reference that populates to null rather than failing the read
- [ ] 6.5 Create `server/src/modules/events/event.controller.ts` with the list handler responding `{ events: [...] }`
- [ ] 6.6 Confirm the read-shape mapper omits `createdByUserId` and `updatedByUserId` entirely

## 7. Event write API

- [ ] 7.1 Add the create and update body schemas to `event.schemas.ts` — non-blank trimmed `title`, both instants, de-duplicated id arrays, `endAt > startAt` refined on create and on any update that supplies both; the update schema accepts any subset and declares no audit fields, so Zod strips a submitted `createdByUserId`
- [ ] 7.2 Add the event id path-parameter schema, so a malformed identifier is rejected as 400 at the boundary rather than surfacing as a cast error
- [ ] 7.3 Add a participant-resolution function to `event.service.ts` — one query per role selecting `_id`, `status`, and `canHostEvents`, diffed against the submitted set, raising `INVALID_PARTICIPANT` with a message naming the role and whether the person is unknown, inactive, or ineligible to host
- [ ] 7.4 Add the create function — resolve participants, reject on failure, write with `createdByUserId` and `updatedByUserId` set to null, and return the event in read shape
- [ ] 7.5 Add the update function — resolve any supplied participant set, replace that stored array wholesale, leave an omitted set untouched, apply an `endAt` change against the stored `startAt` when only one side is supplied, and raise `NOT_FOUND` when no event matches
- [ ] 7.6 Add the delete function raising `NOT_FOUND` when nothing matched
- [ ] 7.7 Add the create, update, and delete handlers to `event.controller.ts` — 201 with the created event, 200 with the updated event, 204 with no body on delete
- [ ] 7.8 Create `server/src/modules/events/event.routes.ts` wiring `GET /`, `POST /`, `PATCH /:id`, `DELETE /:id`, and mount it at `/api/events` in `app.ts` above the 404 handler
- [ ] 7.9 Confirm no route adds or removes a single participant — participant changes are only ever a whole-set replacement on the event

## 8. Seed data

- [ ] 8.1 Create `server/src/shared/db/seed.ts` seeding a handful of contacts and employees, upserting by email so a re-run against the Atlas cluster duplicates nobody
- [ ] 8.2 Include at least one inactive contact, one inactive employee, and one active employee not eligible to host, so the status and eligibility filters are exercisable by hand
- [ ] 8.3 Run the seed twice against the configured database and confirm the record count is identical after both runs

## 9. Test infrastructure

- [ ] 9.1 Create a test helper that starts `mongodb-memory-server`, connects Mongoose to it, clears collections between tests, and tears both down — it must build its own connection string and never read `DB_HOST`, so a suite that truncates collections is structurally incapable of reaching Atlas
- [ ] 9.2 Add a helper that builds the Express app for tests and issues requests against it, plus fixtures creating contacts and employees in the states the participant rules need
- [ ] 9.3 Add an assertion helper that checks a response is the error envelope with an expected code and carries no `stack`, no driver text, and no connection-string fragment

## 10. Foundation and directory tests

- [ ] 10.1 Test that a malformed query, body, and path parameter each return 400 in the envelope and that nothing is written
- [ ] 10.2 Test that an undefined route returns 404 in the envelope without echoing the requested path, and that `GET /api/health` is unchanged
- [ ] 10.3 Test that an unhandled failure returns 500 in the envelope with no stack trace while `NODE_ENV` is not production
- [ ] 10.4 Test contact and employee search — matching on either name part, case-insensitively, with results ordered by last name then first name and the result cap honored
- [ ] 10.5 Test that a search term containing regular-expression metacharacters is matched literally and does not error, and that an over-long term returns 400
- [ ] 10.6 Test that inactive people are excluded by default and returned when the status filter names them, and that the `canHostEvents` filter excludes ineligible employees while its absence returns both

## 11. Event read tests

- [ ] 11.1 Test the overlap query at both boundaries — events inside, straddling either edge, and spanning the whole period are returned; events entirely outside are not; an event ending exactly when the period begins is excluded
- [ ] 11.2 Test that a missing boundary, an inverted period, and a span over 366 days each return 400
- [ ] 11.3 Test that a range expressed with a numeric UTC offset selects the same events as the identical range expressed with `Z` — the regression test for the FullCalendar offset trap
- [ ] 11.4 Test that an instant supplied without a zone designator is rejected, and that every returned instant carries a time component and an explicit zone designator
- [ ] 11.5 Test that returned participants are resolved to `{ id, firstName, lastName, fullName }`, that `id` is a JSON string, and that no audit field appears in the payload
- [ ] 11.6 Test that an event holding a participant reference that no longer resolves is still returned with only its resolvable participants

## 12. Event write tests

- [ ] 12.1 Test create — a valid event is stored with its participants and returned in read shape with status 201; a blank or whitespace-only title is rejected; a padded title is stored trimmed
- [ ] 12.2 Test that `endAt` earlier than and equal to `startAt` are both rejected at the boundary, and that a direct model write with an inverted span is rejected by the `pre('validate')` hook
- [ ] 12.3 Test participant rules — an unknown reference, a contact id submitted as a host, an employee not eligible to host, and an inactive person each return 400 with the `INVALID_PARTICIPANT` code and leave storage unchanged
- [ ] 12.4 Test that a repeated reference in a submitted set produces exactly one assignment, both through the endpoint and through a direct model write
- [ ] 12.5 Test update — a supplied set replaces the stored set wholesale, an empty set clears assignments, an omitted set is left untouched, and an update naming only a new title leaves participants unchanged
- [ ] 12.6 Test that an update supplying only an `endAt` earlier than the stored `startAt` returns 400 and leaves the event unchanged, and that a failed update leaves the original title and participants intact
- [ ] 12.7 Test that an event already holding a person who has since gone inactive still reads back with that person assigned
- [ ] 12.8 Test delete — the event is gone from a subsequent range read, a non-existent id returns 404, and a malformed id returns 400
- [ ] 12.9 Test that a create body naming `createdByUserId` does not write it, and that neither audit field appears in any response

## 13. Verification

- [ ] 13.1 Run `pnpm --filter server build` and confirm it passes
- [ ] 13.2 Run `pnpm --filter server test` and confirm the whole suite passes from a clean state
- [ ] 13.3 Exercise the six endpoints by hand against the seeded database — a month range read, a create, an update, a delete, and both directory reads — and confirm the payloads match the read shape in `design.md`
- [ ] 13.4 Record the chosen directory result cap in `design.md`, replacing the corresponding open question
- [ ] 13.5 Confirm `server/CLAUDE.md`'s module description still matches the delivered layout, and note the added controller layer there if it does not
