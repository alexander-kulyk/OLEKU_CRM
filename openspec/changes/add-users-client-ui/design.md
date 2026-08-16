## Context

See `proposal.md` for motivation and `specs/user-management/spec.md` plus `specs/app-navigation/spec.md` for behavior. The current `/users` page is a thin placeholder, the client uses React Router and one shared Axios instance, and no Users feature or client test harness exists. `add-users-server-api` defines the required wire contract but is not implemented, so its DTOs and error codes are a contract dependency rather than evidence of a callable endpoint.

The client enforces Feature-Sliced Design with `app -> pages -> features -> shared`, Tailwind v4, slice public APIs, local state by default, and React Hook Form with Zod for non-trivial forms. The current error normalizer drops status and field data, the custom Zod resolver flattens nested paths, and the reusable dialog primitives do not own a focus stack. Concurrent calendar work may add `EVENT_VERSION_CONFLICT` to the shared error contract, so shared changes must compose additively.

## Goals / Non-Goals

**Goals:**

- Provide one cohesive Users feature behind a thin route page, without a new global store or remote-data cache.
- Keep URL state, remote-result state, form state, and dialog state under one explicit ownership model.
- Preserve the server's paginated, versioned, merge-patch, and error contracts without optimistic row mutation.
- Make request races, URL repair, normalized diffs, error recovery, and dialog focus behavior independently testable.
- Leave typed seams for operator/authentication and organization settings while failing visibly and safely when those inputs are unavailable.

**Non-Goals:**

- Implementing or probing the server Users API, authentication, role policy, organization settings, audit storage, or rate limiting.
- Introducing Users state into the event/calendar Zustand store, adding another client-wide store, or adding a remote caching library.
- Adding user creation, invitations, archived-user browsing/restoration, permanent erasure, bulk actions, localization infrastructure, or a mobile card view.
- Reorganizing existing event features or introducing `entities`/`widgets` solely for this page.

## Decisions

### D1. Use one feature slice and a thin page boundary

`client/src/pages/users/ui/UsersPage.tsx` will only compose the exported `UserManagement` entry from `client/src/features/user-management`. The feature owns its domain DTOs, API functions, query parsing, request lifecycle, form schema/diff logic, and Users-specific UI in `api`, `model`, `lib`, `config`, and `ui` segments. External consumers import only its `index.ts` public API.

Shared changes are limited to project-agnostic infrastructure: additive API-error metadata and accessible modal/focus primitives. Users types, status copy, table columns, filters, and recovery copy remain inside the feature. Files remain below the package's 250-line limit, handlers and derived values stay out of JSX, and the table/status/error variants use typed configuration where they share a render shape.

Alternative considered: multiple sibling list/edit/archive features. It would force coordination upward or into shared state and create forbidden sibling-feature imports. A single feature with internal concern boundaries keeps the workflow cohesive without a god component.

### D2. Treat the URL as query state and local reducer state as request state

Pure parse/canonicalize/serialize functions define one `IUsersListQuery` containing `page`, `pageSize`, `search`, statuses, sort field, and direction. Defaults and ordering are deterministic; statuses serialize in canonical status order. Missing/invalid input is repaired with one replace navigation. Explicit page/page-size/filter/sort changes push history, while every keystroke updates search with replace navigation and the request effect applies the approximately 300 ms eligibility delay.

There is no mirrored query object in component state. A feature-local list reducer holds only the active request key/controller, current server page, loading phase, and visible error. Each request captures a canonical key, aborts the previous controller, and may commit only when its key is still active. Cancellation receives a distinct internal error marker and never becomes UI failure. Retry increments a local request generation while preserving the URL.

Exactly one trimmed search character is excluded from the wire query while page size, status, and sort remain active. Clear filters removes search and statuses and sets page 1 while preserving page size and sort. An out-of-range response replaces `page` with `max(1, totalPages)` only when that differs from the canonical URL; the repaired URL drives the follow-up request, preventing loops.

Alternative considered: a Zustand or Context store for query/results. It duplicates Router ownership and creates a second synchronization problem without another page or feature consumer.

### D3. Keep the Users API adapter inside the feature and widen errors additively

Feature API functions import the shared `httpClient` and expose typed list, detail, patch, and archive operations matching `add-users-server-api/specs/users-api/spec.md`. The adapter accepts `AbortSignal` for reads and sends `application/merge-patch+json` for updates. Runtime responses are consumed through explicit DTO whitelists/types; list data never supplies the edit version.

The shared `ApiError` gains optional HTTP `status` and `field` plus a distinct internal cancellation code/helper. Server codes required by Users are added without removing existing codes, including any concurrent `EVENT_VERSION_CONFLICT`. The normalizer still ignores server-provided message text for generic presentation, but preserves the optional field token needed to place validation failures. Users-specific `(operation, code/status) -> recovery` data stays in a typed feature config. Unknown codes fall back to an operation-level error.

Alternative considered: let Users catch raw Axios errors. That would bypass the client's single error boundary, duplicate envelope parsing, and make event and Users behavior diverge.

### D4. Use a flat form model and one normalization/diff boundary

The edit form uses flat keys for address inputs (`addressCountry`, `addressCity`, `addressStreet`, `addressPostalCode`) so the existing resolver can associate each Zod issue correctly. A pure mapper converts detail DTOs into form defaults. A single normalization function trims and NFC-normalizes applicable text, canonicalizes nullable empty values, and uses the client `libphonenumber-js` dependency to parse and normalize phone data with the supplied organization region. The client and server packages use compatible library versions so their phone semantics do not drift.

Dirty detection compares normalized current values to normalized defaults. A pure patch builder uses the same values and returns either a versioned patch containing changed mutable members or `null` for a clean form. Address diff rules are explicit: changed members appear individually, cleared members become `null`, omitted members remain untouched, and clearing all previously populated components becomes `address: null`. Save with a `null` patch is a local non-error no-op and leaves the dialog open.

Save uses a synchronous in-flight guard as well as disabled UI to reject duplicate activation. A successful mutation closes the flow and triggers a fresh canonical list request; it never splices a row into the paginated result. A version conflict keeps values and offers Reload latest; accepting that action while dirty goes through the same discard confirmation before a new detail request.

Alternatives considered: nested RHF address fields would lose accessible errors because the current resolver creates flat dotted keys; handcrafted phone regular expressions would not provide the required region-aware parsing. A flat feature model plus the same phone library used by the server preserves both boundaries.

### D5. Model edit/archive/dialog transitions explicitly and harden shared focus behavior

The feature controller uses a reducer with explicit phases for closed, detail loading, editing, save pending, archive confirmation/pending, discard confirmation, and archived acknowledgement. Similar confirmation presentation is driven by a typed config keyed by confirmation kind rather than separate boolean flags or repeated JSX. Async user actions remain separated into focused hooks so the composition component does not accumulate unrelated state.

Shared modal infrastructure gains a small provider/stack registry mounted at the application boundary. Every modal registers a stable token and only the top token handles Escape, outside interaction, and focus containment. The primitive records the trigger, assigns unique ARIA IDs, moves focus inside on open, cycles Tab/Shift+Tab, and restores focus on close. `ConfirmDialog` composes that primitive and exposes a dismissal callback; feature policy decides whether dismissal means cancel, discard confirmation, or immediate close.

Alternative considered: independent document key listeners in each dialog. That is the current design and cannot guarantee topmost ownership or correct focus restoration for stacked confirmations.

### D6. Inject operator and organization context; never synthesize it

`UserManagement` accepts a narrow runtime-context interface containing current operator ID, organization timezone, default phone region, and a 401 recovery callback. `UsersPage` exposes the same optional integration seam so a future app-level authentication/settings provider can supply it from the `app` layer without a feature importing upward. The current route may omit the object; the feature then renders configuration-unavailable output for affected values/actions rather than using browser locale/timezone or editable record data as authority.

Missing operator identity disables Archive for all records with an explanation, because enabling it could expose self-archive while neither client nor planned server currently has the required identity policy. Missing timezone leaves a clearly unavailable Last Login presentation for non-null timestamps. Missing default phone region blocks ambiguous national-phone saves while valid international phone input remains eligible. A supplied 401 callback is invoked without resetting local form state; without one, the form stays intact and shows an authentication-recovery-unavailable operation error.

Alternative considered: Vite environment values for operator identity or organization settings. Build-time values cannot securely represent the signed-in operator or per-organization configuration and would silently turn an unknown into global mutable policy.

### D7. Define a recovery matrix instead of generic dialog failure

The Users feature maps outcomes by operation and machine-readable code/status:

- duplicate-email codes plus `field=email`: inline Email error, form remains open;
- validation/unknown-field failures: field placement when a known field is supplied, otherwise form-level error;
- `USER_VERSION_CONFLICT`: operation-level message, form preserved, explicit guarded Reload latest;
- `USER_ARCHIVED`: acknowledgement, then close/refetch;
- detail 404: do not open or close the editor, notify, and refetch;
- archive self/last-administrator conflicts: close confirmation, preserve editor/form, operation-level message;
- 401: delegate through the injected recovery seam without intentional reset;
- 403, 429, transport, and 5xx: operation-level retry/recovery copy with form preserved where one exists;
- cancellation: no visible error.

This matrix is an exhaustive typed data table for known Users operations/codes with a fallback, keeping copy and recovery intent together without trusting server message text or branching throughout components.

Alternative considered: display `error.message` directly. Server copy is not a stable localization or security boundary, and the existing client intentionally maps copy by operation and code.

### D8. Add a client behavior test harness

Add Vitest with jsdom, React Testing Library, `@testing-library/user-event`, and jest-dom matchers as client dev dependencies. Client scripts gain non-watch `test` and watch-mode `test:watch`; the root gains `test:client` for workspace consistency. Tests stay beside feature/shared code and exercise pure query/patch functions separately from routed UI behavior. API functions are mocked at the feature boundary; no real server, remote endpoint, or credentials are used.

High-value integration tests use a memory router to prove canonical URL/history behavior and controlled deferred promises to prove stale-response exclusion. Dialog tests cover focus entry, trapping, topmost Escape, dirty confirmation, and restoration. Build and tests are both required gates because either alone misses material failure modes.

Alternative considered: build-only verification. It cannot observe debounce, request races, history, null-versus-omitted patch semantics, focus, or keyboard behavior identified by research.

## Risks / Trade-offs

- **[Users API is planned but not callable (U-001/R-001)]** → Pin the adapter and fixtures to the active server specs; keep all tests local; require an explicit integrated smoke check against the configured base URL after `add-users-server-api` is applied.
- **[Operator/authentication contracts do not exist (U-002/R-005)]** → Use the injected interface and safe unavailable states; keep Archive disabled without identity; do not claim self-archive or re-authentication completion until an app provider is connected.
- **[Organization timezone/phone region contracts do not exist (U-003/R-006)]** → Never fall back to browser authority; expose unavailable states and allow only unambiguous international phone validation until settings are supplied.
- **[Shared error code overlap with active calendar work (F-013/R-003)]** → Merge the union additively and add regression coverage for existing event/directory mappings as well as Users field/status metadata.
- **[Shared modal changes can regress Event dialogs (R-007)]** → Preserve the current public props where possible, add provider wiring once at the app root, and test single as well as stacked modal behavior before switching Users on.
- **[URL search terms expose PII in browser history/referrers (R-011)]** → Meet the explicit URL requirement but add no client storage or telemetry persistence and avoid logging complete query URLs.
- **[English-only copy may not match future locale expectations (A-001)]** → Follow the existing English shell for this release and keep copy in feature configuration so later localization does not change behavior or architecture.
- **[Horizontal table access is less compact than a card layout (R-012)]** → Prefer semantic completeness and keyboard access; defer card presentation until product breakpoints and content priority are explicitly defined.
- **[Adding test tooling increases dev dependency and CI surface]** → Keep it dev-only, expose one deterministic non-watch command, and avoid a second production data library.
- **[Client/server phone-library versions can drift]** → Add the client package explicitly through pnpm, keep its version compatible with the server declaration, and cover representative international and regional inputs in both contract suites.

## Migration Plan

1. Add the test harness and additive shared error/modal changes with regression tests for current event and directory consumers.
2. Add the feature slice, pure URL/form/patch utilities, typed API adapter, controller hooks, and presentation components behind its public API.
3. Replace the placeholder composition at `/users` and wire the optional runtime-context seam; keep safe unavailable states until real providers exist.
4. Run the client tests and build, then perform an integrated read/edit/archive smoke check only after `add-users-server-api`, base URL, and CORS are confirmed.
5. Connect future authentication/settings providers through the existing injection seam and remove only the corresponding unavailable states after their contracts are verified.

Rollback is client-only: restore the previous Users placeholder at the route composition boundary. Additive error normalization, modal accessibility improvements, and test tooling may remain if their regression suite passes; otherwise revert them together with the feature. No client persistence or database migration requires reversal.

## Open Questions

- Which future app provider will own the runtime-context values and recovery callback? The injection contract and unavailable behavior are fixed here, so the provider name/location can be selected by the separate authentication/settings changes.
- What product localization system will eventually replace the current English copy? Copy is centralized in feature configuration, so adopting localization later does not alter this change's state or API contracts.
