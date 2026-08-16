## Why

The Users page is specified in full (`docs/prd/release 1.0.0/usersPage/usersPage.md`, BR-USERS v4.0) and the client route already exists as a declared placeholder that issues no request, but the server has no `users` model, route, or service at all — the page cannot be built against anything. This change delivers only the server half: the four endpoints the PRD requires, with the tenant scoping, ordering, search, uniqueness, soft-delete, and concurrency semantics that the page depends on and that cannot be retrofitted cheaply once data exists.

Research established that the obvious implementation silently produces wrong behavior in six places — merge-patch bodies are not parsed, `null` sorts first not last, the required status order is not a collation order, `$regex` is not collation-aware, `i` is ASCII-only under PCRE2, and the house two-field `$or` cannot match a full-name phrase — so the contract and the data model both need to be settled deliberately rather than copied from the existing modules.

## What Changes

### New `users` module

- `GET /api/users` — server-side pagination (`page`, `pageSize` ∈ {20, 50, 100}, default 20), search across first name, last name, full name, email and phone, multi-value status filtering, and sorting by first name, last name, status, or last login. Archived records are excluded. Response body is `{ items, pagination }`.
- `GET /api/users/:userId` — full `UserDto` including `version` and `archivedAt`; returns archived records too, so the client can detect an already-archived target.
- `PATCH /api/users/:userId` — merge-patch-*like* partial update (RFC 7396 semantics for omitted / `null` / nested address merge) with a mandatory `version` guard, unknown-member rejection, and empty-patch rejection.
- `DELETE /api/users/:userId` — archive (soft delete): sets `archivedAt`, preserves `status`, returns `204`, and is idempotent.

### Data model carries the ordering and matching semantics

- The stored document persists derived keys — `emailNormalized`, folded name and full-name keys, a phone digits key, and a numeric `statusRank` — so every required ordering and search case is index-servable rather than computed in an in-memory aggregation. This is the only shape that satisfies REQ-USR-022 through REQ-USR-027 simultaneously.
- A compound unique index on `(organizationId, emailNormalized)` spanning archived records enforces per-organization email uniqueness in the database, with the duplicate-key error mapped to `EMAIL_ALREADY_EXISTS` or `EMAIL_TAKEN_BY_ARCHIVED_USER` depending on the owner's archived state.
- `version` is an explicit **domain** field, present in the detail DTO and absent from the list DTO. It is not a Mongoose `versionKey`; models keep `versionKey: false` as the house style requires.

### **BREAKING** — shared API contract widens

- The error envelope gains an optional `error.field` member. The existing `{ code, message }` shape and the "no internal detail" rule are otherwise unchanged, but the current `api-foundation` requirement forbids any other member, and a foundation test asserts the exact key set — both must change.
- The shared code→status map gains the codes this change can actually produce: `EMAIL_ALREADY_EXISTS`, `EMAIL_TAKEN_BY_ARCHIVED_USER`, `USER_VERSION_CONFLICT`, `USER_ARCHIVED`, `NO_CHANGES_SUBMITTED`, `UNKNOWN_FIELD`.
- Collection reads gain a second permitted shape: a paginated read returns `{ items, pagination }`. The existing single-named-array rule stays in force for the non-paginated `events`, `contacts`, and `employees` reads, which are unaffected.

### Request handling

- `express.json()` is widened to accept `application/merge-patch+json` in addition to `application/json`, because the PRD recommends that content type and the current parser leaves `req.body` undefined for it.
- A single request-context seam supplies `organizationId`. It is server-derived and **never** read from a header, query parameter, or body; every read and every write filters on it from the first commit.
- `libphonenumber-js` is added as a runtime dependency, with a `DEFAULT_PHONE_REGION` variable in `env.ts` standing in for the organization default region until organization configuration exists.

### Standing instruction narrowed

- `server/CLAUDE.md:23-24` and `server/AGENTS.md:27-28` currently say `users` is the authentication surface and must not carry domain data. The PRD's user record *is* an account (email uniqueness, `blocked` status, `lastLoginAt`), so the rule is narrowed rather than broken: `users` holds account identity plus account profile; `contacts` and `employees` remain the CRM people directory. Both files are updated in this change so the instruction and the code agree.

### Explicitly deferred (stated, not omitted)

The PRD marks these MUST, and each depends on a system that does not exist anywhere in the repository. Each is deferred to the authentication/authorization work, with the seam left in place so adding it later is a substitution rather than a rewrite:

- REQ-USR-067 self-archive protection (`CANNOT_ARCHIVE_SELF`) — requires operator identity.
- REQ-USR-068 last-administrative-user protection (`CANNOT_ARCHIVE_LAST_ADMINISTRATIVE_USER`) — requires a role model the PRD itself defers (§90).
- REQ-USR-081 audit trail — requires operator identity and an audit retention policy.
- REQ-USR-084 rate limiting and the `401` / `403` rows of REQ-USR-073 — no code path in this change can produce them; the status map is extended additively so they can be added without another contract change.

Everything client-side is out of scope by instruction: REQ-USR-012 to 017, 028, 029, 035 to 038, 041 (display half), 043 to 045, 049, 054, 063 to 066, and 074 to 080.

## Capabilities

### New Capabilities

- `users-api`: the `/api/users` collection and item contract — list pagination, search, filtering and ordering; detail reads including archived records; merge-patch updates with optimistic concurrency; archive as an idempotent soft delete; per-organization email uniqueness; DTO whitelists; and organization scoping as a server-derived filter on every operation.

### Modified Capabilities

- `api-foundation`: the failure envelope admits an optional `field` member; the stable code→status map is extended with the users conflict and validation codes; and a paginated collection read may return `{ items, pagination }` instead of a single named array.

## Impact

**New code** — `server/src/modules/users/` (model, schema, service, controller, routes, mapper), mounted in `server/src/app.ts` under `/api` above the terminal handlers.

**Modified code** — `server/src/shared/http/error-envelope.ts` (new codes, `field` member), `server/src/shared/http/error-middleware.ts` (propagate `field`), `server/src/shared/http/validate.ts` (distinguish `UNKNOWN_FIELD` from `VALIDATION_ERROR`), `server/src/app.ts` (JSON parser content types, users router), `server/src/shared/config/env.ts` (`DEFAULT_PHONE_REGION`, organization context default).

**Modified tests** — `server/src/test/api-foundation.test.ts` asserts the exact key set of the error body and of `body.error`; those assertions change deliberately with the envelope.

**Modified docs** — `server/CLAUDE.md`, `server/AGENTS.md` (the `users` rule).

**Dependencies** — adds `libphonenumber-js` (MIT, no production dependencies) via `pnpm --filter server add`, lockfile committed.

**Database** — a new `users` collection with a compound unique index. Creating that index fails if pre-existing documents contain duplicate `(organizationId, emailNormalized)` pairs; the collection's real state has not been inspected and must be checked before the first write, not assumed empty.

**Not affected** — the client package, the `events` and `directory` modules, `GET /api/health`, and the existing non-paginated collection response shapes.
