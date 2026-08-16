## Context

See `proposal.md` — Why. The constraints that actually shape this design, all verified in `research.md`:

- **The house module anatomy is fixed** (F-025): `src/modules/<feature>/` with model, schema, service, controller, routes; `.ts` on relative imports; router mounted in `app.ts` under `/api` above the 404 and error handlers; Zod at the boundary; `process.env` only in `env.ts`; erasable TypeScript only, so closed sets are `as const` tuples plus derived unions, never `enum`.
- **MongoDB will not give us the required ordering from a plain sort.** `null` sorts *first* ascending (EVID-013), so `NULLS LAST` for `lastLoginAt` is not `sort({ lastLoginAt: 1 })`. `active, inactive, blocked` is not the lexical order of those strings nor any collation's output (F-011). Collation applies to `find`/`aggregate`/`createIndex` but **not** to `$regex` (EVID-014, EVID-016), and under PCRE2 the `i` flag is ASCII-oriented, so `$options: 'i'` does not fold Cyrillic case (F-013). Aggregation `$sort` stops using an index once `$addFields` precedes it, with a 100 MB in-memory ceiling (EVID-015).
- **The house search shape cannot satisfy the requirement.** `$or: [{firstName: /x/i}, {lastName: /x/i}]` can never match `anna smith` against `Anna` + `Smith` (F-014).
- **`express.json()` will not parse `application/merge-patch+json`** — body-parser defaults its accepted type to `application/json`, and on a non-match sets `req.body = undefined` and skips parsing (F-005, EVID-011, EVID-012).
- **Mongoose query updates bypass document middleware**: `pre('validate')` does not run on `findOneAndUpdate` and `runValidators` is off by default (EVID-026). Mongoose's own optimistic concurrency is off by default and *requires* a `versionKey` (EVID-017).
- **Nothing enforces email uniqueness today** — both directory models deliberately declare no unique index (EVID-008) — and a losing concurrent write raises a driver `E11000`, which is not an `HttpError` and collapses to `500` (F-018).

## Goals / Non-Goals

**Goals:**

- Serve every required ordering and search case from an index, so `< 500 ms` (REQ-USR-082) is a property of the design rather than a hope.
- Express the whole update precondition — identifier, archived state, and version — as one atomic write, because evaluating those in application code between a read and a save reintroduces exactly the lost update the requirement exists to prevent.
- Keep the derived keys impossible to forget: they are computed in one place that every write path must pass through.

**Non-Goals:**

- Authentication, authorization, roles, or session handling.
- Operator identity, audit records, rate limiting, `401`/`403`. Deferred per the proposal; the design only ensures adding them later is additive.
- User creation and restore endpoints. `POST /api/users` and the restore flow are out of scope (PRD §85), but the model and index are designed so they slot in without a migration.
- Any client work.

## Decisions

### D1 — Ordering and matching live in persisted derived keys, not in the query

The stored document carries, alongside the domain fields, a set of derived keys maintained on every write:

| Key | Derived from | Serves |
| --- | --- | --- |
| `emailNormalized` | `email`, trimmed + lowercased | uniqueness index, email search |
| `firstNameFolded`, `lastNameFolded` | names, NFC + case-folded + diacritic-insensitive | name search |
| `fullNameFolded` | `firstNameFolded + ' ' + lastNameFolded` | full-name phrase search |
| `fullNameReversedFolded` | `lastNameFolded + ' ' + firstNameFolded` | reversed phrase search |
| `phoneDigits` | E.164 phone with `+` and separators stripped | phone search |
| `statusRank` | `active → 0`, `inactive → 1`, `blocked → 2` | status ordering |
| `lastLoginRank` | `0` when `lastLoginAt` is set, `1` when null | nulls-last ordering |

Ordering then becomes a plain `find().sort()` over stored fields — `{ statusRank: dir, _id: 1 }`, `{ lastLoginRank: 1, lastLoginAt: dir, _id: 1 }`, `{ lastName: dir, firstName: dir, _id: 1 }` — every one of which an index can serve. Name ordering additionally carries an explicit `.collation({ locale: 'uk', strength: 2 })` matched by an identically-collated index, satisfying the Unicode/Cyrillic requirement (REQ-USR-026).

Note `lastLoginRank` is `1` for nulls in **both** directions: the rank is always sorted ascending and only `lastLoginAt` flips, which is what makes nulls-last hold descending too (R-009).

Search runs as an anchored, escaped `$regex` against the **folded** keys, never against the display fields. Because the keys are already case-folded, the regex needs no `i` flag at all — which sidesteps the PCRE2 ASCII-only problem (F-013) rather than trying to work around it. The full-name phrase case (`anna smith`) matches `fullNameFolded`, and the reversed case matches `fullNameReversedFolded`.

*Alternatives considered.* An aggregation pipeline computing rank and order per request (research Direction B) is more readable and keeps no derived state — but `$sort` after `$addFields` cannot use an index (EVID-015) and would sort the whole filtered set in memory under a 100 MB ceiling, and `$regex` is still not collation-aware inside it, so it solves neither problem it was reached for. MongoDB Atlas Search would solve the search half cleanly but is not available in the current deployment and is unverified (U-004). Derived keys were chosen because they are the only option that makes *all* of ordering, filtering, and search index-servable at once.

*Cost accepted.* Derived keys rot silently if any write path forgets them. D3 is what prevents that.

### D2 — Mutation is one conditional `findOneAndUpdate`, with a disambiguating read only on failure

The update filter carries the entire precondition:

```
{ _id, archivedAt: null, version }
```

A matched document is updated with `$set` of the validated fields and derived keys plus `$inc: { version: 1 }`, returning the new document. One round trip; no window between check and write.

When nothing matches, the result is ambiguous — missing, archived, or stale — so a single follow-up read scoped to `{ _id }` disambiguates it:

- no document → `404 NOT_FOUND`
- `archivedAt` set → `409 USER_ARCHIVED`
- otherwise → `409 USER_VERSION_CONFLICT`

The extra read costs one round trip only on the failure path, and it is *read after failure*, so it cannot itself introduce a race that changes a successful outcome.

Archive is the same shape without the version and without `archivedAt: null` in the filter, using `$set: { archivedAt: <now> }` only if not already set — which is what makes the repeat call idempotent while preserving the original timestamp (REQ-USR-070).

*Alternatives considered.* Mongoose's built-in `optimisticConcurrency` (research Direction C) is library-maintained and works with the house load-merge-save path, but it requires re-introducing a `versionKey` that every existing model deliberately sets to `false` (F-016), and it increments on *every* save including archive — which REQ-USR-071 deliberately keeps version-free. The house load-merge-save pattern (`event.service.ts:317-368`) was rejected because the archived-state and version preconditions would be evaluated in application code.

*Cost accepted.* `findOneAndUpdate` bypasses `pre('validate')` (EVID-026), so **no invariant may live in document middleware**. D3 addresses this.

### D3 — One normalization function owns validation, normalization, and derived keys

A single pure function takes the validated patch plus the current document and returns the complete `$set` payload — normalized domain fields *and* every derived key together. It is the only way a write is constructed, for both the update and any future create.

This is the direct answer to the cost accepted in D1 and D2: derived keys cannot drift from their sources because they are computed in the same expression, and no invariant depends on middleware that `findOneAndUpdate` would skip. The Mongoose schema still declares the fields and their types, but is not where correctness lives.

### D4 — `version` is a domain field, not persistence metadata

`version` is declared on the schema as a plain required number, and models keep `versionKey: false` like every other model in the codebase. This is a deliberate distinction: the main specs forbid exposing *persistence* metadata (EVID-010), and `version` is exposed on purpose because REQ-USR-048 requires the client to read it and REQ-USR-060 requires the client to send it back. It is part of the contract, so it appears in the detail mapper and is deliberately absent from the list mapper (REQ-USR-039).

### D5 — Uniqueness is enforced by the index, and `E11000` is translated, not pre-checked

A unique index on `emailNormalized` — no partial filter, so archived records keep reserving their address (REQ-USR-006) — is the sole authority. The service does **not** pre-check for a duplicate: a pre-check cannot be atomic and would surface the loser of a concurrent write as `500` (F-018, R-004).

Instead the driver's duplicate-key error is caught and translated. Because the error alone does not say who owns the address (F-019), the handler reads the owning record's `archivedAt` to choose between `EMAIL_ALREADY_EXISTS` and `EMAIL_TAKEN_BY_ARCHIVED_USER`, both with `field: 'email'`. Any duplicate-key error from a *different* index is re-thrown unchanged rather than mislabelled.

The index is created with the same collation as the name index only if that proves compatible; email normalization is already explicit (lowercase), so the uniqueness index needs no collation and must not have one — a case-insensitive collation on top of already-lowercased keys would be redundant and would complicate the plan.

### D6 — `total` is an exact count per request

`countDocuments` runs against the same filter as the page query. Exactness is required because REQ-USR-021 makes `totalPages` the value the client navigates to when a page is out of range, and an approximation would send the client to a page that does not exist.

Deep pagination via `skip` is accepted at the expected scale. This is the one place the design knowingly trades a scaling property for simplicity; R-014 records it, and the fix (range pagination on the same sort keys) is available later without changing the response contract, since `page`/`pageSize` remain the client's interface.

*Alternative considered.* A `$facet` returning items and count in one round trip — rejected because it forces the whole read into an aggregation, which per D1 gives up the index-served sort.

### D8 — Widen the JSON parser by type, at the app level

`express.json()` is configured with `type: ['application/json', 'application/merge-patch+json']`. This is a one-line change in `app.ts`, applies uniformly, and is preferable to a users-local body parser because the failure it prevents (`req.body === undefined` and a misleading "body missing" validation error, F-005) is exactly the kind of silent divergence a local override reintroduces the next time an endpoint documents a media type.

Merge-patch semantics themselves are implemented in the users schema, not in the parser — content type only controls parsing.

### D9 — `UNKNOWN_FIELD` comes from Zod's strict-object failure, distinguished at the boundary

`z.strictObject` already rejects rather than strips unknown keys, and the repository already relies on that for query parameters (`directory.schema.ts:33-46`). The shared `validate()` helper currently flattens every Zod failure to `VALIDATION_ERROR` (F-006), so it gains one narrow branch: a failure whose only issues are `unrecognized_keys` becomes `UNKNOWN_FIELD`; everything else stays `VALIDATION_ERROR`. `NO_CHANGES_SUBMITTED` is a schema-level refinement — at least one mutable member beyond `version` — following the precedent already in `event.schema.ts:107-119`.

`error.field` is added as an optional third member on `HttpError` and flows through `toEnvelope()`. Existing throw sites are unchanged and simply omit it.

### D10 — Phone: parse with `libphonenumber-js`, region from config

`parsePhoneNumberFromString(input, env.defaultPhoneRegion)` produces the E.164 value stored in `phone`; `phoneDigits` is that value stripped of `+`. Search normalizes the *query* the same way before matching against `phoneDigits`, with a fallback to a digits-only substring match so that a national-format query still matches an international stored number (REQ-USR-033). The extension is stored separately and never concatenated into `phone` (REQ-USR-032).

## Risks / Trade-offs

- **[Derived keys drift from their sources]** → D3 makes them a single expression with the fields they derive from; a test asserts that after an update, search by the *new* name and email finds the record and search by the old one does not.
- **[Unique index creation fails on pre-existing duplicate `emailNormalized` values (U-006, R-005)]** → The collection selected by `DB_HOST` must not be assumed empty. Index creation is an explicit, verified step with a duplicate check before it, not an implicit `syncIndexes()` side effect at startup.
- **[Concurrent duplicate email surfaces as `500`]** → D5 removes the pre-check entirely and translates `E11000`; verified with two concurrent writes to the same new address, asserting one `409` and zero `500`s.
- **[Cyrillic search silently under-matches, reading as "no results" rather than an error (R-007)]** → Folding at write time (D1) means the query carries no `i` flag; verified with a Cyrillic case-difference search and a Latin diacritic search.
- **[Unstable pagination repeats or drops records (R-010)]** → `_id` ascending is appended to *every* sort, not just the default; verified by paging a set of identical names end-to-end and asserting the union equals the full set with no duplicates.
- **[Deep pagination and an unindexed count degrade the list endpoint (R-014)]** → Accepted at expected scale (D6). Mitigated by the sort keys all being indexed; revisit when the real dataset size is known (research open item 5).
- **[Collation choice is baked into an index and cannot be altered in place]** → Recorded as a deliberate one-way decision; changing locale or strength later means an index rebuild, not a code change. `strength: 2` is chosen so ordering is case- and accent-insensitive, matching operator expectation for a name column.
- **[Amending `api-foundation` breaks its existing tests]** → `server/src/test/api-foundation.test.ts:146-147,173-174` asserts the exact key set of the body and of `body.error`; those assertions change deliberately as part of this change, and the new assertion must keep proving that no *unexpected* member appears — the point of the original test survives (R-011).
- **[Merge-patch content type still unparsed]** → D8 plus a test that sends the identical body under both media types and asserts identical outcomes (R-003).
- **[The PRD's `version` member inside the patch body is not RFC 7396]** → Acknowledged: this is merge-patch-*like*. Documentation and the spec describe it as such rather than claiming conformance, since a strict RFC 7396 processor would treat `version` as a field to set.
- **[Audit and operator-dependent rules are deferred while the PRD marks them MUST]** → Stated in the proposal as an explicit scope decision, not an omission. Future authentication work must define the operator-identity boundary; any future audit write is cross-collection and cannot assume atomicity because the test environment is a standalone in-memory MongoDB with no transactions (F-024, U-004).
- **[`AGENTS.md` claims there is no server test script, but nine test files and a working `test` script exist (F-023)]** → Verification uses `pnpm --filter server test` and `pnpm --filter server build`; the stale instruction is corrected as part of the docs touched by this change rather than silently worked around.

## Migration Plan

No data migration: the `users` collection has no server-side consumer today and the client page is a placeholder that issues no request (F-022).

1. Require `DB_HOST`, identify the target without exposing URI credentials, and verify that target's `users` collection has no duplicate `emailNormalized` values. Do not assume it is empty (U-006).
2. Create the unique index and the sort/search indexes explicitly and verify they built.
3. Deploy the server; the endpoints are additive and no existing route changes shape.

**Rollback:** unmount the users router. The `api-foundation` envelope change is backward-compatible for existing clients — `field` is optional and additive, and the existing named-array collection shapes are untouched — so it does not need to be reverted with the router. Dropping the unique index is the only destructive step and is only needed if the index itself is the problem.

## Open Questions

These are deferrable: none changes the specs, the approach, or the task breakdown.

- **Collation locale (U-003 adjacent, A-002).** `uk` at strength 2 is the deployment-wide working choice for deterministic ordering. A future locale change requires an index rebuild, not an API redesign.
- **`DEFAULT_PHONE_REGION` value (U-003).** A configured default is required by REQ-USR-031; which region it starts at is a deployment setting and can change without code.
- **Production MongoDB topology and version (U-004).** Affects transaction availability and PCRE2-era regex behavior, neither of which this design depends on — the design deliberately avoids transactions and avoids `i`-flag matching.
- **Whether a platform-level rate limiter fronts the API (U-005).** Rate limiting is out of scope for this change; the answer only determines whether the future implementation is application- or platform-level.
