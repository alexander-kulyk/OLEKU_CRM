# Research: Users client UI (BR-USERS v4.0)

## Research status

- **Change:** `add-users-client-ui`
- **Confidence:** Medium — the complete PRD, current client, project rules, installed frontend contracts, and the planned Users API were inspected; confidence is below high because the API is not implemented and the identity, authentication, organization-timezone, and phone-region inputs needed by mandatory UI behavior do not exist.
- **Blocking unknowns:** 3 — availability of the planned Users API (U-001), current-operator/authentication context (U-002), and organization timezone/default phone-region context (U-003).

## Executive summary

The requested outcome is the client side of the Users page in BR-USERS v4.0, without duplicating the already-created server change. Today `/users` is an intentional placeholder that issues no request, while the active `add-users-server-api` change defines the four required endpoints but has not implemented them (F-001, F-002). The client therefore has a stable planning contract, not a callable local API.

The client can support the list without a new state or caching dependency: React Router already owns navigation and query parameters; Axios supports abort signals; the existing client demonstrates latest-request guards and refetch-after-mutation. The project rules favor local state unless it crosses feature/page boundaries (F-003, F-005). The principal compatibility gap is the current error normalizer: it recognizes only four old codes and retains only `code`, so every planned Users-specific code becomes `TRANSPORT_ERROR`, `error.field` is lost, and HTTP status is unavailable for central 401/403 recovery (F-006).

Recommended direction: replace the placeholder with a thin page that composes one cohesive user-management feature; make validated URL parameters the canonical list-query state; keep the current page result, request status, edit session, and dialog state local to that feature; use the planned server DTOs as the source of truth; cancel superseded reads and independently reject stale completions; and harden the shared error and dialog boundaries before relying on them. Full PRD compliance remains blocked until operator identity/auth recovery and organization timezone/phone-region contracts exist (U-002, U-003).

## Input and scope

### Explicit requirements

- User request, preserved verbatim: **“[research.md](.ai_toolkit/commands/research.md) створи для client сторони /Users/oleku/work space/learning path/OLEKU_CRM/docs/prd/release 1.0.0/usersPage/usersPage.md
  для server вже створено”**.
- Replace the `/users` placeholder with the client behavior in BR-USERS v4.0; treat `add-users-server-api` as contract evidence and do not duplicate server work.
- Render the non-archived, server-paginated Users table with the eight specified columns, explicit status text and status-dependent styling, formatted nullable address/phone, organization-timezone Last Login, accessible Edit action, and narrow-viewport usability (`docs/prd/release 1.0.0/usersPage/usersPage.md:393-540,1024-1097`).
- Drive pagination, search, multi-status filtering, and supported sorting through `GET /api/users`; debounce eligible search by about 300 ms, never request a one-character search, enforce latest-request-wins, validate/correct URL state, distinguish loading/error/true-empty/no-results, and repair out-of-range pages (`docs/prd/release 1.0.0/usersPage/usersPage.md:558-825,913-1021,1118-1139,2110-2122`).
- Fetch the latest detail before editing; provide the specified editable/read-only fields; validate locally with inline errors; issue a versioned merge patch; preserve unsaved values across failures; refetch the list after successful update/archive; and repair pagination (`docs/prd/release 1.0.0/usersPage/usersPage.md:1142-1375,1378-1690`).
- Provide archive confirmation, self-archive protection, operation-level conflict handling, normalized dirty detection, close/outside/Escape behavior, stacked dialogs, and keyboard/screen-reader accessibility (`docs/prd/release 1.0.0/usersPage/usersPage.md:1694-2038`).

### Constraints and exclusions

- Research only: no proposal, spec, design, task decomposition, estimate, product code, test, dependency, or server change was created.
- Authentication, authorization, roles, account recovery, user creation/invitation, restoration, privacy erasure, audit storage, and organization timezone management remain separately scoped by the PRD (`docs/prd/release 1.0.0/usersPage/usersPage.md:2513-2532`).
- The package requires FSD `app -> pages -> features -> shared`, public APIs, no business-domain code in `shared`, Tailwind v4 tokens, local state by default, React Hook Form plus Zod for non-trivial forms, and the centralized Axios client (`client/AGENTS.md:8-16,28-52`).
- No new client-wide store or remote-data cache is justified; the existing Zustand exception is explicitly limited to event/calendar data (`client/AGENTS.md:28-44`).

### Research questions

| ID | Question | Why it matters | Answer or status | Evidence | Consequence for later artifacts |
| --- | --- | --- | --- | --- | --- |
| RQ-001 | What Users client behavior exists now? | Establishes replacement and compatibility scope | Answered: route/navigation exist; page is a no-request placeholder | EVID-002, F-001 | The existing app-navigation placeholder requirement must be revised |
| RQ-002 | Is the server contract implemented and callable? | The client depends on all four endpoints | Answered: planning complete, implementation absent | EVID-008, EVID-009, F-002 | Client may be contract-first; integration is blocked by U-001 |
| RQ-003 | What owns list query and remote state? | Prevents duplicate state and broken Back/Forward behavior | Answered: URL should own query; feature-local state is sufficient | EVID-003, EVID-005, EVID-012, F-003, F-005 | No new global store/cache is warranted |
| RQ-004 | Can current API/error infrastructure express Users failures? | Field errors, conflicts, auth recovery, and retry depend on it | Answered: request base works, error shape does not | EVID-004, EVID-008, F-006 | Shared error contract must be reconciled with both active changes |
| RQ-005 | Can existing forms and dialogs be reused unchanged? | Accessibility and nested field errors are blocking review concerns | Answered: no | EVID-006, EVID-007, EVID-014, F-008, F-009 | Later artifacts must define shared-boundary hardening or isolated equivalents |
| RQ-006 | What mutation invariants must the client preserve? | Prevents data loss and invalid patches | Answered except clean-save behavior | EVID-001, EVID-008, F-007, D-001 | Specs must settle no-op Save and exact normalized diff behavior |
| RQ-007 | Are identity and organization settings available? | Self-archive, 401/403, phone parsing, and Last Login depend on them | Unresolved: none exist | EVID-010, F-010, U-002, U-003 | Full compliance cannot be claimed without explicit integration contracts |
| RQ-008 | Do active changes overlap? | Avoids incompatible edits to shared contracts | Answered: drag-and-drop overlaps the shared error union/API foundation only | EVID-011, F-013 | Reconcile additively; do not overwrite its event conflict code |
| RQ-009 | What verification surface exists? | Race, URL, dialog, and accessibility behavior are not build-only properties | Answered: client build exists; no lint/test script or client tests | EVID-003, EVID-016, F-014 | Proposal must decide whether to add a client test harness |

## Evidence reviewed

| ID | Source | Evidence type | What it establishes |
| --- | --- | --- | --- |
| EVID-001 | `docs/prd/release 1.0.0/usersPage/usersPage.md:393-660,680-825,913-1375,1378-2038,2141-2510` | Product requirements | Complete client-visible Users behavior and acceptance scenarios |
| EVID-002 | `client/src/pages/users/ui/UsersPage.tsx:3-13`; `client/src/app/router/AppRouter.tsx:15-25`; `openspec/specs/app-navigation/spec.md:79-86` | Code + main spec | `/users` is wired but intentionally renders a placeholder and makes no request |
| EVID-003 | `client/AGENTS.md:8-16,28-58`; `.ai_toolkit/skills/feature-sliced-design/SKILL.md:79-127`; `.ai_toolkit/skills/state-management/SKILL.md:15-44` | Project instructions | FSD boundaries, local-state default, event-only Zustand exception, RHF/Zod, Axios, and build gate |
| EVID-004 | `client/src/shared/api/http-client.ts:4-24`; `client/src/shared/api/error.ts:4-100`; `client/src/shared/api/events.ts:14-43` | Code | One Axios instance; failures are reduced to a four-code union or `TRANSPORT_ERROR`; only `code` survives |
| EVID-005 | `client/src/features/event-participants/model/use-directory-options.ts:16-74`; `client/src/shared/model/event-store.ts:135-207` | Code | Existing latest-request guard and refetch-after-mutation patterns; no reusable Users cache |
| EVID-006 | `client/src/shared/ui/Modal.tsx:19-68`; `client/src/shared/ui/ConfirmDialog.tsx:50-115`; `client/src/features/event-dialog/model/use-event-dialog-controller.ts:107-128` | Code | Dialog markup exists, but focus management is absent and stacked Escape is currently guarded into a no-op |
| EVID-007 | `client/src/shared/ui/Input.tsx:30-85`; `client/src/shared/ui/Field.tsx:24-71`; `client/src/shared/lib/create-zod-resolver.ts:15-40` | Code | Accessible input/error wiring exists; the custom resolver stores dotted nested paths as flat keys |
| EVID-008 | `openspec/changes/add-users-server-api/proposal.md:7-32,38-47`; `openspec/changes/add-users-server-api/specs/users-api/spec.md:41-88,137-260,300-499`; `openspec/changes/add-users-server-api/specs/api-foundation/spec.md:3-25,87-120` | Active OpenSpec contract | Planned DTOs, list/query behavior, merge patch, version, archive, widened error envelope, and explicit server deferrals |
| EVID-009 | `openspec/changes/add-users-server-api/tasks.md:1-213`; bounded inventory of `server/src/modules` and `server/src/test` on 2026-08-16 | Active change + command output | All server tasks remain unchecked and no `server/src/modules/users` exists |
| EVID-010 | `client/src/app/App.tsx:1-8`; `client/src/main.tsx:1-5`; bounded repository search on 2026-08-16 | Code + command output | Client has no auth/session/current-operator/organization/timezone provider |
| EVID-011 | `openspec/changes/add-calendar-drag-and-drop/proposal.md:10-32` | Active OpenSpec change | Concurrent work adds `EVENT_VERSION_CONFLICT` and touches client API/error types |
| EVID-012 | `client/package.json:17-23`; React Router 7.18.2 [`useSearchParams`](https://reactrouter.com/api/hooks/useSearchParams), accessed 2026-08-16 | Manifest + official docs | Installed router exposes URL search params and navigation updates; query state need not be mirrored globally |
| EVID-013 | `client/package.json:17`; Axios 1.19.0 [Cancellation](https://axios-http.com/docs/cancellation), accessed 2026-08-16 | Manifest + official docs | Installed Axios supports `AbortController.signal`; cancellation rejects and must be ignored intentionally |
| EVID-014 | W3C WAI-ARIA APG [Dialog (Modal) Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/), accessed 2026-08-16 | Authoritative accessibility guidance | Modal focus enters, stays within, Escape closes the active dialog, and focus returns logically |
| EVID-015 | W3C WAI-ARIA APG [Table Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/table/), accessed 2026-08-16 | Authoritative accessibility guidance | Native table is preferred; sortable header state belongs on the header through `aria-sort` |
| EVID-016 | `client/package.json:6-32`; bounded inventory for `client/**/*.{test,spec}.{ts,tsx}` on 2026-08-16 | Manifest + command output | Build is the only client verification script; no client test files exist |
| EVID-017 | `client/src/index.css:20-131`; bounded `client/src`/`client/assets` search on 2026-08-16 | Code + command output | Tailwind tokens exist, but no table/pagination/status/pencil primitive exists |
| EVID-018 | `client/src/shared/api/http-client.ts:4-14`; `client/.env.example:1-9` | Code + config doc | Actual unset base URL is deployed Azure, while `.env.example` says the fallback is localhost |

## Current system and relevant flows

`BrowserRouter` renders `UsersPage` inside the persistent shell at `/users`; navigation already becomes active without a full reload (EVID-002). The page currently renders only a heading and unavailable message. All client HTTP calls go through the environment-based Axios instance; its response interceptor converts every rejection before feature code sees it (EVID-004).

The server change plans `GET /users` under the Axios `/api` base, returning `{ items, pagination }`; list items omit `version`. Edit must call `GET /users/:id`, whose detail DTO includes `version` and `archivedAt`. A save sends a merge-patch-like body plus the last-read version, while archive sends `DELETE /users/:id` with no version and expects 204. Successful mutations are followed by a list refetch, not an optimistic local row splice (EVID-008).

The list query is naturally `URL -> validated canonical query -> request -> feature-local result/status`. Search text may be present in the URL while being ineligible for a request at length one; page/filter/sort changes navigate normally, whereas typed search and invalid-URL correction replace history. Superseded requests can be aborted through Axios and their completions still guarded by a request key (EVID-012, EVID-013). This gives refresh, sharing, Back/Forward, latest-request-wins, Retry, and mutation refetch one source of query truth without a global store.

## Findings

### Contracts and observable behavior

- **F-001 [Verified]** The current route is usable but its required behavior is the opposite of the new request: the main spec says it must remain a no-request placeholder (`openspec/specs/app-navigation/spec.md:79-86`). A client delta must explicitly replace that requirement.
- **F-002 [Verified]** `add-users-server-api` is planning evidence, not runtime state. It specifies the exact four endpoints and DTO/error behavior, but its tasks are unchecked and the module is absent (EVID-008, EVID-009). The deployed Azure endpoint was not probed.
- **F-003 [Verified]** Query state belongs in the URL because the PRD requires refresh, browser history, and sharing; React Router 7.18.2 already supplies that boundary (`docs/prd/release 1.0.0/usersPage/usersPage.md:940-988`; EVID-012). Remote results and dialog state are page-feature concerns, so project rules do not justify a new global store (`client/AGENTS.md:37-44`).
- **F-004 [Inference]** A canonical query serializer must be singular and deterministic. Otherwise invalid-value correction, comma-separated status filters, Back/Forward, debounce, and page repair can trigger request/navigation loops. This follows from `docs/prd/release 1.0.0/usersPage/usersPage.md:913-988` and F-003; the exact inclusion of `pageSize` remains D-002.
- **F-005 [Verified]** Latest-request-wins is feasible without a dependency: the project already discards stale request IDs (`use-directory-options.ts:34-67`) and Axios 1.19.0 accepts an abort signal (EVID-013). Cancellation alone is insufficient because the current interceptor maps a canceled rejection to `TRANSPORT_ERROR`; stale/canceled outcomes must not become visible failures.
- **F-006 [Verified]** The current API error boundary is incompatible with the planned server contract. New Users codes are rejected by `isServerErrorCode`, optional `field` is not read, and HTTP status is not retained (`client/src/shared/api/error.ts:8-78`). This prevents inline email/phone errors and reliable 401/403 delegation. The active drag change also widens this union, so the edits must compose (EVID-011).

### Data and invariants

- **F-007 [Verified]** The edit session cannot be hydrated from the list row: list items deliberately omit `version`, while the detail response supplies the concurrency token and can reveal that another operator archived the user (`openspec/changes/add-users-server-api/specs/users-api/spec.md:210-260`). A patch must distinguish omitted from `null`, including per-address-property nulls (`openspec/changes/add-users-server-api/specs/users-api/spec.md:258-336`), and must not send immutable/read-only fields.
- **F-008 [Inference]** Dirty state and patch construction need one normalization boundary. Raw RHF `isDirty` is insufficient because the PRD equates values after trim/normalization (`docs/prd/release 1.0.0/usersPage/usersPage.md:1922-1947`). A normalized diff also avoids overwriting omitted fields, but it produces no mutable member for a clean form; the server rejects version-only patches, leaving D-001 unresolved.
- **F-009 [Verified]** Existing field primitives correctly associate labels, `aria-invalid`, and error descriptions, but the Zod resolver writes `address.city` as one flat error key (`create-zod-resolver.ts:25-39`). A nested address schema consumed as `errors.address.city` would silently lose its message. A flat form model or a resolver capable of nested errors is required.
- **F-010 [Verified]** Mandatory context is missing. There is no current operator for disabling self-archive, no central auth recovery flow for 401, no organization timezone for Last Login, and no organization phone region for equivalent phone normalization (EVID-010). The server change explicitly defers self/last-admin enforcement, auth statuses, audit, and rate limiting (`add-users-server-api/proposal.md:38-45`).
- **F-011 [Verified]** The URL-mandated search can contain names, emails, or phone numbers, so browser history and shared URLs can contain PII (`docs/prd/release 1.0.0/usersPage/usersPage.md:750-803,940-966`). No client storage/telemetry was found, but URL exposure is inherent in the requirement and should be acknowledged rather than hidden.

### Project patterns and constraints

- **F-012 [Verified]** A native semantic `<table>` with button-based sortable headers is the closest contract fit; no table or grid abstraction exists (EVID-015, EVID-017). Horizontal overflow preserves complete content without requiring an unimplemented accessible tooltip, and is explicitly permitted by the PRD (`docs/prd/release 1.0.0/usersPage/usersPage.md:528-542`). Exact breakpoints remain a PRD open decision (`docs/prd/release 1.0.0/usersPage/usersPage.md:2536-2548`).
- **F-013 [Verified]** The only active implementation overlap is additive shared error/API work from `add-calendar-drag-and-drop`; its event-specific version conflict must survive the Users widening (EVID-011). Its calendar store is not a precedent for Users state (`client/AGENTS.md:37-44`).
- **F-014 [Verified]** Type-check/build can verify contracts but not debounce timing, stale-response exclusion, history behavior, patch null/omission semantics, dialog stack focus, or keyboard interaction. There is no current client test harness (EVID-016); whether to introduce one is D-004.
- **F-015 [Verified]** Local runtime routing is configuration-sensitive: the actual no-env Axios fallback is Azure, contrary to `.env.example`'s localhost claim (EVID-018). Static code does not establish whether that deployed API contains Users endpoints or allows the current origin.

### External contracts

- **F-016 [Verified]** React Router 7.18.2 can update search parameters through navigation, including array-capable values; later artifacts can represent URL state without duplicating it into a store (EVID-012).
- **F-017 [Verified]** Axios 1.19.0 supports standards-based AbortController cancellation; canceled requests reject, so internal cancellation must be distinguished from a user-visible transport failure (EVID-013).
- **F-018 [Verified]** The current `role="dialog"`/`aria-modal` markup is only part of the modal contract. WAI-ARIA requires initial focus, a contained tab sequence, Escape on the active dialog, and logical focus return; current `Modal` and `ConfirmDialog` do not implement those behaviors (EVID-006, EVID-014).

## Options and research-informed direction

| Direction | Evidence-supported benefits | Costs and risks | Reversibility |
| --- | --- | --- | --- |
| A. One cohesive user-management feature composed by a thin Users page; URL query state plus feature-local remote/dialog state | Fits FSD and local-state rules; keeps list/edit/archive coordination in one slice; avoids feature cross-imports and a new cache/store; directly supports F-003 to F-009 | The feature needs disciplined internal component/hook boundaries to avoid a god component | High; boundaries can be split later behind the feature public API |
| B. Put the whole flow in the Users page slice | Few initial boundaries | Violates thin-page guidance; couples URL, requests, table, form, archive, and accessibility; high god-component risk | Medium; later extraction is disruptive |
| C. Separate list and editor into sibling features with shared Context/store | Strong UI separation | Sibling features cannot import each other; refresh/dialog coordination moves upward or into shared state, adding ceremony without a second consumer | Medium |

### Recommended direction

Choose Direction A. Keep the route page a composition boundary, keep Users domain types/API/model/UI inside one cohesive feature, and retain only project-agnostic primitives and the Axios/error boundary in `shared`. Treat the URL as the canonical list query, retain only the current server page in local feature state, use RHF/Zod for the edit session, and use the detail DTO/version plus a normalized merge-patch diff for writes. This recommendation depends only on verified project rules and contracts; U-001 through U-003 remain explicit integration blockers.

## Risks and edge cases

| ID | Risk or edge case | Evidence | Likelihood | Impact | Constraint for later artifacts |
| --- | --- | --- | --- | --- | --- |
| R-001 | Client ships against absent or different Users endpoints | F-002, F-015 | High until server apply | High | Pin client types and behavior to EVID-008; do not claim runtime integration before verification |
| R-002 | Older list/detail response overwrites newer URL or selected user | F-005 | Medium | High | Cancellation plus stale-completion guard; Retry preserves canonical query |
| R-003 | Users conflict/field/auth error becomes generic transport failure | F-006, F-013 | High without boundary change | High | Preserve code, optional field, and status; merge active error-code additions |
| R-004 | Empty strings or whole-address replacement clear/preserve the wrong data | F-007, F-008 | Medium | High | Specify omission/null/nested-address diff semantics precisely |
| R-005 | Self-archive is offered or auth expiry destroys unsaved data | F-010 | High with current app | High | Block full compliance on U-002; server enforcement remains authoritative |
| R-006 | Last Login or phone normalization uses browser guesses | F-010 | High with current app | Medium/High | Block organization-specific formatting/validation on U-003 |
| R-007 | Escape affects the wrong dialog or focus escapes/gets lost | F-018 | High if primitives reused unchanged | High | Dialog stack must have one active owner and deterministic focus restoration |
| R-008 | Invalid/out-of-range URL causes correction/refetch loops, including `totalPages=0` | F-004 | Medium | Medium | Define canonicalization and zero-result repair as stable, idempotent behavior |
| R-009 | Clean Save causes `NO_CHANGES_SUBMITTED` or meaningless version increment | F-008, D-001 | High | Medium | Resolve D-001 before specification |
| R-010 | Nested address error is not announced or rendered | F-009 | High if nested schema reused | High | Preserve programmatic field/message association for every nested field |
| R-011 | Search PII persists in URLs/history/referrers | F-011 | High | Medium | Acknowledge required exposure; avoid additional persistence/logging |
| R-012 | Narrow layouts hide Actions or full values | F-012 | Medium | Medium | Preserve semantic table, keyboard reachability, and horizontal access at all supported widths |
| R-013 | Filter/search mutation leaves current page invalid | EVID-001, F-004 | Medium | Medium | Reset/repair page deterministically after query changes and mutation refetches |

## Unknowns, assumptions, and decisions needed

| ID | Type | Item | Impact if wrong | How to resolve |
| --- | --- | --- | --- | --- |
| U-001 | Unknown | When and where `add-users-server-api` will be implemented and exposed to the client | No end-to-end Users behavior is callable | Apply/verify that change and confirm `VITE_API_BASE_URL`/CORS environment |
| U-002 | Unknown | Contract for current operator identity and centralized 401/403 recovery | Cannot safely disable self-archive or preserve/recover an authenticated edit | Define authentication context and recovery ownership in its separate change |
| U-003 | Unknown | Source and wire shape for organization timezone and default phone region | Last Login and normalized phone dirty/validation behavior can be wrong | Define organization-settings contract; do not infer either from the browser |
| D-001 | Decision needed | What clean-form Save does when Save must remain available but version-only PATCH is rejected | Could show an avoidable error, close unexpectedly, or create a meaningless write | Product/spec decision: suppress and remain open, suppress and close, or another explicit outcome |
| D-002 | Decision needed | Whether selected `pageSize` is URL state; PRD lists page/search/status/sort but supports 20/50/100 | Refresh/share may reset page size or URLs may exceed the minimum required state | Product/spec decision with one canonical serialization rule |
| D-003 | Decision needed | Whether one-character search preserves status-filtered results or the fully unfiltered list, and whether “Clear filters” clears search too | Empty/no-results and request behavior differ | Clarify wording before scenarios are drafted |
| D-004 | Decision needed | Whether this change establishes a client test harness | Build-only verification leaves the highest-risk behavior untested | Decide during proposal based on F-014; choose tooling only then |
| D-005 | Decision needed | Exact user-facing recovery for version conflict, 404 detail, and last-admin/self-archive conflicts | Form preservation, close/refetch, and retry behavior may diverge | Specify per code/status; retain unsaved data wherever PRD requires it |
| A-001 | Assumption | English labels are acceptable for this release because no localization framework exists and the current shell is English | Copy may not match product locale expectations | Confirm locale scope; keep API status values lowercase regardless |

## Handoff to OpenSpec

### Facts later artifacts may rely on

- F-001, F-002, F-003, F-005, F-007, F-012, F-013, F-016, F-017.

### Constraints later artifacts must preserve

- F-006, F-008, F-009, F-010, F-011, F-018 and R-001 through R-013.

### Decisions proposal/design must resolve

- U-001, U-002, U-003, D-001, D-002, D-003, D-004, D-005, A-001.

### Behaviors specs must define precisely

- RQ-003, RQ-004, RQ-005, RQ-006 and R-002, R-004, R-007, R-008, R-009, R-010, R-013.

### Verification concerns tasks must eventually cover

- F-014 and R-001 through R-013, with explicit contract, race, URL-history, accessibility, and responsive evidence rather than build-only claims.

## Not investigated

- No deployed API, database, organization data, user records, credentials, auth service, audit system, or rate-limiter state was accessed; static artifacts cannot prove runtime availability.
- Server implementation internals beyond the active Users contract were not redesigned; that work belongs to `add-users-server-api`.
- User creation, invitation, restore/archive browsing, permanent erasure, bulk operations, and card-based responsive UI were excluded by the PRD.
- Exact visual design beyond the existing Tailwind tokens and shared controls was not invented; no Users-specific mockup or table asset exists.
- No dependency alternatives or test libraries were compared because D-004 must be resolved before tool selection.
