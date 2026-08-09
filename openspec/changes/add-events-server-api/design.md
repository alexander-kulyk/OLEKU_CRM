## Context

See proposal.md — Why. The server currently contains `main.ts → server.ts → app.ts`, configuration, and one Mongoose connection. `createApp()` registers middleware, `GET /api/health`, a catch-all 404 that reflects `req.originalUrl`, and an inline error handler that exposes raw error text and a development stack. No feature module, model, router, validation layer, or test harness exists.

Constraints from research.md F-015 to F-019 and the repository instructions:

- Relative imports carry `.ts`; Node 24 executes only erasable TypeScript.
- Feature code lives under `src/modules/<feature>/`; routers mount under `/api` above the terminal handlers.
- Environment variables are read only in `src/shared/config/env.ts`.
- Zod validates at the HTTP boundary.
- `contacts` and `employees` are domain people collections; `users` is authentication-only.
- Dependencies are added through pnpm from the root with the lockfile committed.
- `pnpm --filter server build` remains required; this change adds a test gate.

## Goals / Non-Goals

**Goals:**

- One explicit contract from route through response mapper.
- Partial updates that preserve omitted data and enforce whole-event invariants.
- Participant rules that reject invalid new assignments without invalidating historical ones.
- Tests structurally incapable of connecting to Atlas.
- Executable Stage gates with no planning-artifact edits or executor-owned commits.

**Non-Goals:**

- Client code or the FullCalendar mapping itself.
- Authentication, authorization, idempotency keys, optimistic concurrency, recurrence, or product-level time-zone policy.
- Pagination or a caller-selected directory page size.
- Editing or archiving the superseded changes as part of implementation; proposal.md defines their status.

## Decisions

### D1. Exact routes and response mappers implement the domain contract

The routes are:

- `GET /api/events?from&to` → `{ events: [...] }`
- `POST /api/events` → event, status 201
- `PATCH /api/events/:id` → event, status 200
- `DELETE /api/events/:id` → status 204, no body
- `GET /api/contacts` → `{ contacts: [...] }`
- `GET /api/employees` → `{ employees: [...] }`

An event mapper emits only `{ id, title, startAt, endAt, attendees, hosts }`; a directory mapper emits only the projections declared in the specs. Mappers convert ObjectIds to strings and dates to ISO strings. They never serialize audit or persistence metadata.

*Alternative considered:* return FullCalendar's native `{ start, end, extendedProps }` shape. Rejected because FullCalendar silently turns unrecognized keys into `extendedProps` (research.md F-003), hiding a server-side typo rather than exposing a contract mismatch.

### D2. Boundary validation returns parsed values and never mutates Express requests

`validate.ts` parses a supplied Zod schema against `req.params`, `req.query`, or `req.body` and returns the parsed value to the route/controller. It does not assign parsed values back to `req.query`; Express 5 exposes query as a getter. Controllers and services receive only the returned parsed data.

The list schemas declare exact query names. Directory queries accept `search`, `status`, and — for employees only — `canHostEvents`; there is no `size` or `limit`. Event writes accept only their editable domain fields. Zod's stripping behavior makes supplied audit fields inert, after which the service explicitly writes both audit fields as null.

### D3. Instants accept offsets and are stored as absolute UTC dates

All request instants use `z.iso.datetime({ offset: true })`, then convert to `Date`. Zone-less and date-only values are rejected. Responses use `toISOString()`, producing a time-bearing UTC value.

*Why:* FullCalendar emits numeric offsets outside UTC while Zod's default ISO parser accepts only `Z` (research.md F-005). Absolute instants are the explicit v1 storage policy. A later business-local/per-event zone decision adds zone data; it does not silently reinterpret stored instants.

### D4. PATCH is load, merge supplied fields, validate, save

Create constructs a document and calls `save()`. PATCH loads the document, assigns only fields present in the validated body, validates the merged event, then calls `save()`. An omitted participant array is untouched; an empty one replaces the stored set with empty.

*Why:* document validation does not run on bare query updates and update validators default to off (research.md F-009). The document round-trip makes the persistence backstop run on both create and update and lets a one-sided boundary update be checked against the stored other boundary.

*Trade-off:* two database round-trips and last-write-wins under concurrent edits. Accepted until a future concurrency requirement introduces optimistic versioning.

### D5. One shared service function owns the primary span check

A single service function evaluates `endAt > startAt` and is called with the full candidate state by both create and PATCH. The event schema also has a document validation hook as defense in depth. These are intentionally two layers: one shared domain check with a stable HTTP error, plus one persistence backstop.

### D6. Participant validation distinguishes new from retained assignments

Participant arrays are de-duplicated before validation. Create treats every submitted id as new. PATCH compares each supplied replacement set with the stored set:

- ids in `submitted − stored` are new and must exist, be active, and — for hosts — be eligible;
- ids in `submitted ∩ stored` are retained and may remain after status or eligibility changes;
- ids in `stored − submitted` are removed;
- an omitted array skips validation and leaves that role unchanged.

Contacts resolve attendees and employees resolve hosts, so querying the role-specific collection enforces role separation. Validation performs at most one batched query per supplied role and completes before mutating the loaded event, preserving atomic failure.

Reads batch-resolve participant ids across the result set with explicit projections. Missing references are omitted from the response rather than failing the event or the whole period.

### D7. Directory behavior uses fixed constants and total ordering

Search escapes pattern metacharacters before a case-insensitive match against `firstName` or `lastName`. The search limit is 100 characters. Responses are capped at 50 and ordered by `{ lastName: 1, firstName: 1, _id: 1 }`; `_id` provides a total tiebreaker. No caller-controlled size parameter is accepted.

Contacts and employees use the closed `active | inactive` status, defaulting to active. `canHostEvents` exists only on employees and defaults to false.

### D8. Models bind explicitly and declare only safe indexes

Models bind explicitly to `contacts`, `employees`, and `events` rather than relying on pluralization. Events declare `{ startAt: 1, endAt: 1 }`; directory collections declare `{ status: 1, lastName: 1, firstName: 1, _id: 1 }`. No unique email index is created before U-001 establishes whether duplicate values already exist. `users` gets no model.

### D9. Express 5 forwards controller failures to one error handler

Controllers are async and throw typed errors. Express 5 forwards rejected promises to the error middleware, so no wrapper or per-controller `try/catch` is added (research.md F-008).

The handler emits the exact envelope and maps `VALIDATION_ERROR`, `INVALID_PARTICIPANT`, `NOT_FOUND`, and `INTERNAL_ERROR` to the statuses in `api-foundation`. It logs the underlying error but returns only a safe message. The not-found handler never includes `req.originalUrl`; both terminal handlers remain last.

### D10. Tests replace DB_HOST before importing application modules

The `node:test` setup starts `mongodb-memory-server`, assigns its URI to `process.env.DB_HOST`, and only then dynamically imports `app.ts`, models, or any module that reaches `env.ts`. Existing `.env` contents cannot override the already assigned value. Tests never import application modules statically ahead of this setup and never derive a URI from `server/.env`.

Feature stages add their integration tests alongside implementation; the final Stage runs the complete suite. Tests cover offset-bearing periods, the actual update enforcement path, participant transitions, literal search, boundary overlap, dangling references, audit suppression, and error leakage.

### D11. The seed is explicit, idempotent, and local-only

The seed upserts a fixed directory dataset by email, never runs at application startup, and touches neither `events` nor `users`. It refuses a non-loopback MongoDB host, preventing accidental execution against Atlas. Tests invoke the seed with the in-memory URI and verify identical contents after two runs.

### D12. U-001 is a manual precondition, not a planning edit

Before Stage 1 can pass, the user or authorized database owner provides the collection names, counts, and one redacted sample from each non-empty collection. The verifier records that observation in its Stage report. Neither executor nor verifier reads credentials or modifies `research.md`, `proposal.md`, `design.md`, specs, or task text. Documents using `name` / `startsAt` / `endsAt` block implementation for a migration decision.

## Risks / Trade-offs

- **[U-001: runtime collection state is unknown]** → D12 blocks writes until an authorized observation confirms the model assumptions.
- **[Unauthenticated hosted-database access]** → Endpoints remain local-development-only until authorization exists.
- **[Superseded changes remain visible]** → Proposal.md is authoritative; only this change may be implemented or archived for the server surface. Future cleanup archives or removes the obsolete planning changes separately.
- **[Load-merge-save is last-write-wins]** → Accepted for the current single-editor behavior; optimistic concurrency is the documented upgrade.
- **[Historical inactive/ineligible assignments remain]** → Deliberate for editability and audit continuity; directory selectors exclude them from new choices.
- **[Future time-zone policy may require additional fields]** → Stored instants are explicitly absolute in v1, avoiding accidental server-local interpretation.
- **[`mongodb-memory-server` may need a first-run binary download]** → The suite stops rather than falling back to Atlas; a disposable local MongoDB is the only permitted fallback.

## Migration Plan

1. Satisfy D12 with a read-only database observation; stop on incompatible existing documents.
2. Declare dependencies and the isolated test bootstrap.
3. Replace the shared terminal HTTP behavior and preserve health.
4. Add directory and event persistence, endpoints, and their integration tests.
5. Run build, complete tests, and the local-only seed test before exposing routes outside the test environment.

Rollback unmounts the feature routers and restores the prior terminal handlers. Source and dependency changes are reverted through Git and pnpm. Seed tests leave only the disposable in-memory database; no rollback operation targets Atlas. Declared indexes may be dropped only from a database on which this change created them and only after the exact target is confirmed.
