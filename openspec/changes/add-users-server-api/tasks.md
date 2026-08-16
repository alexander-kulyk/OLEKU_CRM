## 1. Shared contract foundation

- [ ] 1.1 Add the phone parser: `pnpm --filter server add libphonenumber-js` from the repo root, and commit the updated `pnpm-lock.yaml`.
- [ ] 1.2 Extend `server/src/shared/config/env.ts` with `defaultPhoneRegion` (from `DEFAULT_PHONE_REGION`) and `defaultOrganizationId` (from `DEFAULT_ORGANIZATION_ID`), keeping it the only file that reads `process.env`. Document both in `server/.env.example` if one exists, otherwise in `server/CLAUDE.md`.
- [ ] 1.3 Extend `server/src/shared/http/error-envelope.ts`: add `EMAIL_ALREADY_EXISTS`, `EMAIL_TAKEN_BY_ARCHIVED_USER`, `USER_VERSION_CONFLICT`, `USER_ARCHIVED`, `NO_CHANGES_SUBMITTED`, and `UNKNOWN_FIELD` to `ErrorCode` and to `STATUS_BY_CODE` (409 for the four conflicts, 400 for the two request-shape codes); add an optional `field` to `ErrorEnvelope['error']` and to the `HttpError` constructor, and emit it from `toEnvelope()` only when set.
- [ ] 1.4 Confirm `server/src/shared/http/error-middleware.ts` propagates the new member — it maps `HttpError` through `toEnvelope()`, so verify rather than assume — and that a non-`HttpError` still collapses to `INTERNAL_ERROR` with no `field`.
- [ ] 1.5 In `server/src/shared/http/validate.ts`, branch a Zod failure whose issues are exclusively `unrecognized_keys` to `UNKNOWN_FIELD`; every other failure stays `VALIDATION_ERROR`. Attach `field` when a single issue path identifies one field.
- [ ] 1.6 In `server/src/app.ts`, configure `express.json({ limit: '1mb', type: ['application/json', 'application/merge-patch+json'] })`.
- [ ] 1.7 Update `server/src/test/api-foundation.test.ts` where it asserts the exact key set of the response body and of `body.error` (around lines 146-147 and 173-174) so an optional `field` is permitted, while still proving no unexpected member appears.

**Validation:**

- `pnpm --filter server build`
- `pnpm --filter server test`

**Done when:**

- `libphonenumber-js` appears in `server/package.json` dependencies and in the committed lockfile.
- Every existing test passes with the widened envelope, and the api-foundation test still fails if an unexpected member is added to a response body.
- A `HttpError` constructed without a `field` produces a body with exactly `error.code` and `error.message`.

**Do not:** add `401`, `403`, or `429` to the status map — no code path in this change can produce them, and the map is designed to be extended additively when auth and rate limiting land.

**Rollback:** revert the four shared files and the lockfile; nothing else depends on them yet.

## 2. User model, derived keys, and indexes

- [ ] 2.1 Create `server/src/modules/users/user-status.ts` with the closed status set as an `as const` tuple plus its derived union and a `statusRank` map (`active → 0`, `inactive → 1`, `blocked → 2`), following the `directory/status.ts` precedent. No `enum` — the project compiles erasable TypeScript only.
- [ ] 2.2 Create `server/src/modules/users/user.model.ts` with the domain fields from the PRD logical model plus the derived keys from design.md D1 (`emailNormalized`, `firstNameFolded`, `lastNameFolded`, `fullNameFolded`, `fullNameReversedFolded`, `phoneDigits`, `statusRank`, `lastLoginRank`), `versionKey: false`, and `version` as a plain required number.
- [ ] 2.3 Declare the indexes: unique on `(organizationId, emailNormalized)` with no partial filter and no collation; `(organizationId, archivedAt, lastName, firstName, _id)` with `{ locale: 'uk', strength: 2 }`; `(organizationId, archivedAt, statusRank, _id)`; `(organizationId, archivedAt, lastLoginRank, lastLoginAt, _id)`; and indexes supporting prefix search on the folded keys and `phoneDigits`.
- [ ] 2.4 Create `server/src/modules/users/user-normalization.ts`: one pure function that takes a validated patch plus the current document and returns the complete `$set` payload — normalized domain fields and every derived key computed in the same expression (design.md D3). Include NFC normalization, trim, case folding, diacritic folding, email lowercase-trim, and `parsePhoneNumberFromString(input, env.defaultPhoneRegion)` producing E.164 plus `phoneDigits`.
- [ ] 2.5 Add `server/src/test/users-model.test.ts` covering the normalization function directly: NFC output, trimming, folding of Cyrillic and diacritics, E.164 conversion from formatted input, extension kept out of `phone`, `statusRank` mapping, and `lastLoginRank` of 1 when `lastLoginAt` is null.

**Depends on:** Stage 1

**Validation:**

- `pnpm --filter server build`
- `pnpm --filter server exec node --test src/test/users-model.test.ts`

**Done when:**

- Every derived key is produced by the single normalization function, and no derived key is assigned anywhere else in the module.
- `parsePhoneNumberFromString` output for `+38 (050) 123-45-67`, `050 123 45 67`, and `0501234567` under the configured region yields the same `phone` and the same `phoneDigits`.
- No `enum` appears anywhere in the module.

**Do not:** place any invariant in a `pre('validate')` hook — the write path uses `findOneAndUpdate`, which does not run document middleware, so a hook-based invariant would silently never execute.

## 3. Organization context seam

- [ ] 3.1 Create the request-context accessor that supplies `organizationId` for the current request, returning `env.defaultOrganizationId` until authentication exists (design.md D7).
- [ ] 3.2 Define every users service function to take `organizationId` as an explicit argument, and ensure no service function accepts or builds a filter without it.
- [ ] 3.3 Add `server/src/test/users-context.test.ts` asserting that an organization identifier supplied in a query parameter, a request header, or a request body does not change the scope of any result.

**Depends on:** Stage 2

**Validation:**

- `pnpm --filter server build`
- `pnpm --filter server exec node --test src/test/users-context.test.ts`

**Done when:**

- Grepping the users module finds no read of `req.headers`, `req.query`, `req.params`, or `req.body` that yields an organization identifier.
- The context test passes and fails if the accessor is changed to read the value from the request.

**Do not:** derive `organizationId` from any request input. This is the review-blocking rule of the change: doing so turns REQ-USR-004 from a scoping rule into a cross-tenant data leak.

## 4. List endpoint

- [ ] 4.1 Create `server/src/modules/users/user.schema.ts` list-query schema with `z.strictObject`: `page` (integer ≥ 1), `pageSize` (20 | 50 | 100, default 20), `search` (trimmed, length-bounded), `status` (comma-separated subset of the three operational values), and `sort` (`<field>:<asc|desc>` over first name, last name, status, last login).
- [ ] 4.2 Implement the list service: filter on `organizationId` and `archivedAt: null`, apply the status filter, build the search predicate as escaped literal `$regex` against the folded keys plus `phoneDigits` (never against display fields, and with no `i` flag), sort with the `_id` tiebreaker appended to every ordering, apply `.collation({ locale: 'uk', strength: 2 })` for name orderings, and run `countDocuments` on the same filter for an exact `total`.
- [ ] 4.3 Implement the list mapper producing exactly the `UserListItemDto` field set, with dates as ISO 8601 UTC strings and no `version`.
- [ ] 4.4 Create the controller and `user.routes.ts` for `GET /api/users`, and mount the router in `server/src/app.ts` above the 404 and error handlers.
- [ ] 4.5 Add `server/src/test/users-list.test.ts` covering: default page shape and page size; `pageSize=37` and `pageSize=5000` rejected with 400; `page=0` and `page=-1` rejected; page beyond `totalPages` returning 200 with empty `items` and true `total`/`totalPages`; archived users absent from `items` and uncounted; unknown sort field rejected; unknown status value including `archived` rejected; multi-value status filter; search combined with a filter narrowing `total`.

**Depends on:** Stage 3

**Validation:**

- `pnpm --filter server build`
- `pnpm --filter server exec node --test src/test/users-list.test.ts`

**Done when:**

- A list response body contains exactly `items` and `pagination`, and `pagination` carries `page`, `pageSize`, `total`, and `totalPages`.
- `total` reflects the filtered set, not the returned page.
- The users router is mounted above both terminal handlers and `GET /api/health` still returns `{ "status": "ok" }`.

## 5. Ordering and search verification

- [ ] 5.1 Add `server/src/test/users-ordering.test.ts`: default ordering is last name, first name, `_id`; ascending status order is `active, inactive, blocked` and descending reverses it; `lastLoginAt` nulls appear last ascending **and** last descending; Cyrillic surnames order by alphabet and the identical request returns the identical sequence twice.
- [ ] 5.2 Add a stable-pagination test: seed a set whose members share last name and first name, page through the whole set at page size 20, and assert the union equals the seeded set with no duplicate and no omission.
- [ ] 5.3 Add `server/src/test/users-search.test.ts`: `anna smith` matches first name `Anna` + last name `Smith`; `smith anna` matches the same record; `марія` matches `Марія`; an email substring matches; `+380501234567` is found by `+38 (050) 123-45-67`, `050 123 45 67`, and `0501234567`; a search term containing `.*` and `(a+)+` is matched literally and returns promptly.
- [ ] 5.4 Add a derived-key freshness test: after an update changes name and email, a search by the new values finds the record and a search by the old values does not.

**Depends on:** Stage 4

**Validation:**

- `pnpm --filter server exec node --test src/test/users-ordering.test.ts src/test/users-search.test.ts`

**Done when:**

- Every scenario under the users-api spec's ordering and search requirements has a passing test.
- The nulls-last assertion fails if `lastLoginRank` is removed from the sort, and the Cyrillic assertion fails if search is pointed at the display fields instead of the folded keys.

## 6. Detail endpoint

- [ ] 6.1 Add the identifier schema rejecting a malformed user id at the boundary before any persistence lookup.
- [ ] 6.2 Implement the detail service scoped to `{ _id, organizationId }` with **no** `archivedAt` condition, so archived records are returned.
- [ ] 6.3 Implement the detail mapper producing exactly the `UserDto` field set including `version`, `archivedAt`, `createdAt`, `updatedAt`, with dates as ISO 8601 UTC strings.
- [ ] 6.4 Add `server/src/test/users-detail.test.ts`: an archived user returns 200 with a non-null `archivedAt`; an unknown well-formed id returns 404 `NOT_FOUND`; a malformed id returns 400 with no persistence lookup; a foreign-organization id returns 404 and leaks no field value from the foreign record.
- [ ] 6.5 Add a response-whitelist test asserting that no list item and no detail body contains `emailNormalized`, any folded key, `statusRank`, `lastLoginRank`, `organizationId`, a credential, a token, or persistence metadata — and that list items carry no `version`.

**Depends on:** Stage 4

**Validation:**

- `pnpm --filter server build`
- `pnpm --filter server exec node --test src/test/users-detail.test.ts`

**Done when:**

- The whitelist test enumerates the permitted keys and fails on any additional key, for both list items and detail bodies.
- A foreign-organization detail request is byte-identical to an unknown-id request.

## 7. Update endpoint

- [ ] 7.1 Define the patch schema with `z.strictObject` over exactly `firstName`, `lastName`, `email`, `phone`, `phoneExtension`, `address`, `status`, and `version`, with a refinement requiring at least one mutable member beyond `version` (`NO_CHANGES_SUBMITTED`). Names: required, trimmed, non-blank, ≤ 100 characters, Unicode with apostrophes and hyphens, control characters rejected. Email: required, trimmed, ≤ 254 characters, valid format. Address properties: trimmed, Unicode, non-blank when present.
- [ ] 7.2 Implement merge-patch application: omitted member unchanged, value replaces, `null` removes on nullable fields, address merges property by property, `address: {}` is a no-op, `address: null` removes the whole address.
- [ ] 7.3 Implement the conditional write: `findOneAndUpdate({ _id, organizationId, archivedAt: null, version }, { $set: <normalized payload>, $inc: { version: 1 } }, { new: true })`, building the payload only through the Stage 2 normalization function.
- [ ] 7.4 Implement failure disambiguation on a null result: re-read `{ _id, organizationId }`; no document → 404 `NOT_FOUND`; `archivedAt` set → 409 `USER_ARCHIVED`; otherwise → 409 `USER_VERSION_CONFLICT`.
- [ ] 7.5 Implement duplicate-key translation: catch `E11000`, confirm it came from the email index (re-throw otherwise), read the owning record's `archivedAt`, and return 409 `EMAIL_ALREADY_EXISTS` or 409 `EMAIL_TAKEN_BY_ARCHIVED_USER`, each with `field: 'email'`. Do not pre-check for duplicates.
- [ ] 7.6 Add `server/src/test/users-update.test.ts` covering merge semantics: omitted member unchanged; `phone: null` removes; partial address update leaves the other three properties; `address: { postalCode: null }` clears one property and preserves the rest; `address: null` removes the whole address; `address: {}` is a no-op; empty-string first name rejected with 400 and a `field`; version-only body rejected with `NO_CHANGES_SUBMITTED`; unknown member rejected with `UNKNOWN_FIELD` and nothing else in the request applied; `"Anna "` persisted as `Anna`.
- [ ] 7.7 Add a content-type test sending the identical valid body as `application/json` and as `application/merge-patch+json` and asserting identical outcomes.
- [ ] 7.8 Add concurrency tests: two readers at version 7, first succeeds and second returns 409 `USER_VERSION_CONFLICT` with the first writer's values intact; a record archived between read and save returns 409 `USER_ARCHIVED` and is unmodified; two concurrent updates setting the same previously unused email yield exactly one success and one 409 `EMAIL_ALREADY_EXISTS` with zero 500 responses.
- [ ] 7.9 Add email-uniqueness tests: case and whitespace differences collide; dots and `+suffix` are distinct addresses; the same email succeeds in a second organization; an archived owner produces `EMAIL_TAKEN_BY_ARCHIVED_USER`.

**Depends on:** Stage 6

**Validation:**

- `pnpm --filter server build`
- `pnpm --filter server exec node --test src/test/users-update.test.ts`

**Done when:**

- A successful update increments `version` by exactly one and a subsequent detail read reports the new value.
- The concurrent-email test observes zero `500` responses across repeated runs.
- No code path pre-checks email uniqueness before the write.

**Do not:** enforce the version, organization, or archived-state precondition in application code between a read and a write — all three belong in the single write filter, which is the whole point of the design.

## 8. Archive endpoint

- [ ] 8.1 Implement archive as a conditional write scoped to `{ _id, organizationId }` setting `archivedAt` to the current UTC timestamp only when it is not already set, leaving `status` and `version` untouched, and returning 204 with no body.
- [ ] 8.2 Return 404 when no record matches `{ _id, organizationId }`, and accept a request carrying no version.
- [ ] 8.3 Add `server/src/test/users-archive.test.ts`: successful archive sets `archivedAt`, preserves `status`, keeps the record readable through the detail endpoint, and removes it from the list with `total` decreased by one; repeating the request returns 204 and the stored `archivedAt` retains its original value; a foreign-organization id returns 404 and does not set `archivedAt`; an unknown id returns 404.
- [ ] 8.4 Add a reference-survival assertion: after archiving, a record referencing that user still resolves to the stored document.

**Depends on:** Stage 7

**Validation:**

- `pnpm --filter server build`
- `pnpm --filter server exec node --test src/test/users-archive.test.ts`

**Done when:**

- A repeated archive returns 204 and the `archivedAt` value is byte-identical to the first call's.
- No code path physically removes a user document.

## 9. Index provisioning and deployment precondition

- [ ] 9.1 Inspect the target `users` collection's actual state and confirm no duplicate `(organizationId, emailNormalized)` pairs exist. Do not assume the collection is empty — its real contents were never verified.
- [ ] 9.2 Create the unique index and the sort/search indexes as an explicit, verified step, and confirm each finished building.
- [ ] 9.3 Record the confirmed `DEFAULT_PHONE_REGION` and `DEFAULT_ORGANIZATION_ID` values for each deployment environment.

**Depends on:** Stage 8

**Validation:**

- Query the target database for duplicate `(organizationId, emailNormalized)` groups and observe zero rows before index creation.
- List the collection's indexes and observe every index from task 2.3 present and complete.

**Done when:**

- The unique index exists on the target database and a duplicate insert is rejected by the datastore, not by application code.

**Do not:** rely on an implicit `syncIndexes()` at startup to create the unique index — a failure there is silent and leaves uniqueness unenforced.

**Rollback:** drop the newly created indexes. This is the only destructive step in the change; unmounting the router does not require it.

## 10. Documentation and full-suite verification

- [ ] 10.1 Narrow the `users` rule in `server/CLAUDE.md:23-24` and `server/AGENTS.md:27-28`: `users` holds account identity plus account profile; `contacts` and `employees` remain the CRM people directory.
- [ ] 10.2 Correct the stale claim in `server/AGENTS.md` (Verification) and `AGENTS.md:37-38` that there is no server test script — `pnpm --filter server test` exists and runs `node --test src/test/*.test.ts`.
- [ ] 10.3 Document the deferred requirements in the module so the gap is visible in the code, not only in the change: REQ-USR-067 self-archive, REQ-USR-068 last-administrative-user, REQ-USR-081 audit trail, REQ-USR-084 rate limiting, and the `401`/`403` rows of REQ-USR-073.
- [ ] 10.4 Run the full suite and the build together and confirm no existing test regressed.

**Depends on:** Stage 9

**Validation:**

- `pnpm --filter server build`
- `pnpm --filter server test`

**Done when:**

- The full server suite passes, including the nine pre-existing test files.
- No documentation file still states that `users` must not carry profile data, and none still states that no server test script exists.
- The deferred requirements are named in the module with a pointer to this change.
