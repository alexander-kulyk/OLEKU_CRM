## 1. Test Harness and Shared Error Contract

- [ ] 1.1 Add `libphonenumber-js` to the client with `pnpm --filter client add libphonenumber-js`, then add Vitest, jsdom, React Testing Library, user-event, and jest-dom with `pnpm --filter client add -D vitest jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom`; preserve the pnpm lockfile changes.
- [ ] 1.2 Add deterministic `test` and `test:watch` client scripts, a jsdom Vitest configuration/setup, and a root `test:client` forwarding script without replacing the existing build scripts.
- [ ] 1.3 Extend the shared API error model and normalizer additively with Users server codes, optional `field`, HTTP `status`, and a distinct internal cancellation marker/helper; preserve all existing directory/event codes, including concurrent `EVENT_VERSION_CONFLICT` if present, and continue to ignore server message text for generic copy.
- [ ] 1.4 Add shared error tests for recognized and unknown envelopes, field/status preservation, cancellation, transport failures, and regression behavior for existing event/directory error mapping.

**Do not:** Remove existing error codes, expose raw server messages as UI copy, add a remote-data library, or edit generated/package-manager output by hand.

**Rollback:** Remove the added client/root scripts and dependencies with pnpm, restore the prior shared error shape and tests together, and keep `pnpm-lock.yaml` synchronized.

**Validation:**

- `pnpm --filter client test -- src/shared/api/error.test.ts src/shared/api/event-error-messages.test.ts src/shared/api/directory-error-messages.test.ts`
- `pnpm build:client`

**Done when:**

- The deterministic client test command runs in jsdom, Users errors retain code/field/status, cancellation is distinguishable, existing consumers still compile and pass, and the client build succeeds.

## 2. Accessible Shared Dialog Stack

**Depends on:** Stage 1.

- [ ] 2.1 Add a project-agnostic modal stack provider/registry in the shared UI boundary and mount it once from the application layer so dialogs register stable tokens and only the topmost dialog owns dismissal and focus containment.
- [ ] 2.2 Refactor `Modal` to preserve its public composition contract while adding initial focus, Tab/Shift+Tab containment, topmost Escape/outside handling, and logical focus restoration.
- [ ] 2.3 Refactor `ConfirmDialog` to compose the modal primitive, use unique ARIA IDs, expose explicit dismissal, and preserve its data-driven tone presentation and pending-action guard.
- [ ] 2.4 Add single- and stacked-dialog tests covering initial focus, focus cycling, topmost Escape, outside interaction, busy confirmation, unique labelling, and focus restoration; include a regression render of the existing Event dialog consumer.

**Do not:** Put Users-specific state or copy into shared UI, add one document key listener per stacked dialog, or change Event dialog behavior without matching regression evidence.

**Rollback:** Revert the provider registration and both dialog primitives as one unit if existing dialog consumers regress.

**Validation:**

- `pnpm --filter client test -- src/shared/ui/Modal.test.tsx src/shared/ui/ConfirmDialog.test.tsx src/features/event-dialog`
- `pnpm build:client`

**Done when:**

- One and multiple dialogs meet the focus/Escape/restoration contract, Event dialogs remain compatible, and the client build succeeds.

## 3. Users Contracts, Query Canonicalization, and API Adapter

**Depends on:** Stage 1.

- [ ] 3.1 Create `client/src/features/user-management` with `api`, `model`, `lib`, `config`, and `ui` segments plus a minimal public `index.ts`; keep all Users DTOs and domain types inside this feature.
- [ ] 3.2 Define typed list/detail/pagination/query/patch/runtime-context contracts that match `add-users-server-api`, including list/detail version separation and supported status/sort/page-size unions.
- [ ] 3.3 Implement pure parse, canonicalize, serialize, wire-query, and page-repair functions for `page`, `pageSize`, `search`, statuses, and sort, with deterministic defaults/order and one-character search suppression.
- [ ] 3.4 Implement feature-local Users API functions for list/detail/PATCH/archive through the shared Axios client, including read cancellation signals, merge-patch content type, explicit typed response shapes, and no client-side tenant parameter.
- [ ] 3.5 Add pure/API tests for invalid URL repair, stable serialization, Back/Forward-ready state restoration, supported query combinations, `totalPages` zero/out-of-range repair, DTO/version separation, request shapes, and cancellation/error propagation.

**Do not:** Create a Users store, add a remote cache, copy Users types into `shared`, read `organizationId` from the URL/client, or call a deployed endpoint in tests.

**Validation:**

- `pnpm --filter client test -- src/features/user-management/lib src/features/user-management/api`
- `pnpm build:client`

**Done when:**

- Pure functions produce one idempotent canonical URL, API calls match the planned server contract, all contract/edge tests pass, and the feature is consumable only through its public API.

## 4. Server-Driven Users List

**Depends on:** Stages 2 and 3.

- [ ] 4.1 Implement a feature-local list reducer/hook that derives the query from Router state, applies approximately 300 ms search debounce, aborts superseded reads, guards every completion by canonical request key, and preserves the URL for Retry.
- [ ] 4.2 Implement URL-driven search, multi-status, sortable headers, page-size, and pagination controls with replace-versus-push history semantics and a Clear filters action that preserves page size/sort while resetting search/status/page.
- [ ] 4.3 Implement declarative loading, error, one-character guidance, true-empty, no-results, and loaded-result components with live/status semantics and mutation-triggered refetch support.
- [ ] 4.4 Implement the native Users table using typed column/status configuration, the eight required columns, address/phone/Last Login formatting, explicit status text, record-specific Edit labels, and horizontally accessible responsive presentation.
- [ ] 4.5 Add routed list tests with fake timers and controlled promises for debounce, latest-request-wins, canceled-request silence, Retry, URL repair/history, filter/search distinctions, server-only dataset handling, pagination repair, semantic sorting state, missing values, and all collection states.

**Do not:** Mirror URL query values in component state, mutate the returned page locally, load an unbounded collection, store search/results in browser storage, or communicate status by color alone.

**Validation:**

- `pnpm --filter client test -- src/features/user-management/model/use-users-list.test.tsx src/features/user-management/ui/UsersList.test.tsx`
- `pnpm build:client`

**Done when:**

- Every list query is server-driven and URL-reproducible, stale responses cannot alter visible state, all collection states and pagination repairs are covered, and the responsive semantic table remains keyboard accessible.

## 5. Edit Form Normalization and Patch Semantics

**Depends on:** Stages 2 and 3.

- [ ] 5.1 Implement a flat React Hook Form model and Zod schema for names, email, phone, extension, address members, and status, including trim/NFC/control-character/length rules and region-aware `libphonenumber-js` validation.
- [ ] 5.2 Implement pure detail-to-form, normalization, normalized-dirty, date/address/phone display, and merge-patch builders; distinguish omitted values from `null`, partial address updates from full removal, and clean Save from a version-only request.
- [ ] 5.3 Implement detail-before-edit loading and the Edit User form with all editable/read-only fields, associated field errors, idle-only Save availability, a synchronous duplicate-submit guard, and non-error `No changes to save` feedback.
- [ ] 5.4 Add tests for Unicode names, invalid control characters, email limits, international/regional phone cases, missing phone region, flat address errors, normalized equality, per-field clears, full-address removal, immutable-field omission, version inclusion, clean Save, and duplicate activation.

**Do not:** Hydrate edits from list rows, use raw RHF `isDirty` as the domain dirty decision, send empty strings to clear nullable values, handwrite phone regex parsing, or permit browser timezone/region inference.

**Validation:**

- `pnpm --filter client test -- src/features/user-management/lib/user-form src/features/user-management/ui/EditUserDialog.test.tsx`
- `pnpm build:client`

**Done when:**

- Form validation is accessible, normalized dirty and patch outputs match every omission/null/address invariant, clean Save sends no request, duplicate Save is blocked, and the client build succeeds.

## 6. Mutation, Conflict, Archive, and Runtime-Context Workflows

**Depends on:** Stages 2, 4, and 5.

- [ ] 6.1 Implement the explicit edit/dialog reducer and focused async hooks for detail loading, save, reload-latest, archive confirmation, discard confirmation, archived acknowledgement, and refetch completion without boolean-per-dialog state.
- [ ] 6.2 Implement the typed Users operation/code recovery matrix for inline email errors, generic validation, version conflict, archived/not-found records, self/last-administrator archive conflicts, 401 delegation, 403/429/5xx/transport failures, and silent cancellation.
- [ ] 6.3 Implement successful PATCH behavior that closes the editor and refetches the canonical query, plus version-conflict Reload latest guarded by discard confirmation and `USER_ARCHIVED` acknowledgement followed by close/refetch.
- [ ] 6.4 Implement Archive confirmation and DELETE without version, idempotent 204 success handling, duplicate-submit prevention, canonical refetch/page repair, and operation-level conflict preservation.
- [ ] 6.5 Implement the optional runtime-context injection seam; disable Archive when operator identity is missing or matches the target, preserve dirty forms across 401/403 paths, expose unavailable timezone/region/recovery behavior, and never synthesize those values from the browser.
- [ ] 6.6 Add interaction tests for success/refetch/filter disappearance, every recovery-matrix branch, dirty close/outside/Escape, Continue editing, Discard changes, stacked archive/discard dialogs, self-archive presentation, missing runtime context, and unsaved-value preservation.

**Do not:** Automatically retry conflicted writes, overwrite newer server data, close/reset dirty forms on recoverable failures, claim archive success on conflicts, or enable archive without operator identity.

**Validation:**

- `pnpm --filter client test -- src/features/user-management/model/use-user-management-controller.test.tsx src/features/user-management/ui/UserManagement.test.tsx`
- `pnpm build:client`

**Done when:**

- Update/archive outcomes follow the complete recovery matrix, unsaved work survives all required failures, only the top dialog responds, safe unavailable states cover missing integrations, and all tests/build pass.

## 7. Route Composition, Responsive Review, and Package Conformance

**Depends on:** Stages 4 and 6.

- [ ] 7.1 Replace the `/users` placeholder with a thin `UsersPage` composition of the feature public API while preserving the existing route, shell, active navigation, basename handling, and optional runtime-context prop seam.
- [ ] 7.2 Complete Tailwind v4 presentation using existing CSS-first tokens, keeping status, focus, error, loading, and narrow-table behavior accessible without adding `tailwind.config.*` or styled-components.
- [ ] 7.3 Audit FSD import direction/public APIs, one-component-per-file structure, declarative JSX, local state ownership, typed config-driven variants, descriptive types/handlers, and the 250-line file cap; split any oversized concern before completion.
- [ ] 7.4 Add route-level tests for direct/query URLs, navigation activation, no full reload, keyboard-only list/edit/archive flow, live feedback, record-specific labels, full-value access, and absence of Users search/result persistence.
- [ ] 7.5 Manually review `/users` at 320 px, 768 px, and 1440 px viewport widths with long names, addresses, and empty values; verify no overlap, horizontal access, visible focus, complete-value access, and reachable Actions.

**Do not:** Import feature internals from the page, add Users business code to `shared`, reuse the calendar Zustand store, add a second store, or hand-edit generated build output.

**Validation:**

- `pnpm --filter client test`
- `pnpm build:client`
- `rg --files client/src/features/user-management client/src/pages/users | xargs -n1 wc -l | awk '$1 > 250 { print; failed=1 } END { exit failed }'`
- `! rg -n "from ['\"][^'\"]*(app|pages)/" client/src/features/user-management`
- `! rg -n "localStorage|sessionStorage|sendBeacon|telemetry" client/src/features/user-management client/src/pages/users`
- Manual: run `pnpm dev:client`, open `/users` at 320 px, 768 px, and 1440 px, and perform the keyboard/responsive observations in task 7.5.

**Done when:**

- `/users` is operational inside the unchanged shell, all automated checks pass, the feature respects client architecture/style rules, and manual responsive/accessibility observations have no blocking failures.

## 8. Contract Integration and Final Gate

**Depends on:** Stage 7 and the implementation of `add-users-server-api`.

- [ ] 8.1 Confirm every `add-users-server-api` implementation task is complete, its server build passes, and its list/detail/patch/archive DTOs, content type, error field/codes, and CORS/base-URL environment still match this client's adapter.
- [ ] 8.2 Run the full client suite/build and strict OpenSpec validation, then review the resulting diff to confirm only intended client, package/lockfile, root script, and `add-users-client-ui` task-status changes are present.
- [ ] 8.3 Against an approved local/non-production environment, smoke-test initial list, search/filter/sort/pagination, detail-before-edit, clean Save, successful update, duplicate email, version conflict, archive, pagination repair, and configured operator/timezone/phone-region behavior.
- [ ] 8.4 Record any unavailable auth/settings integration as an explicit blocker and leave the corresponding task unchecked; do not mark full BR-USERS client compliance until current-operator, 401 recovery, organization timezone, and default phone region are supplied and exercised.

**Do not:** Probe the deployed Azure API, use production credentials/data, bypass server organization scoping, or mark integration complete from mocks alone.

**Validation:**

- `! rg -n '^- \[ \]' openspec/changes/add-users-server-api/tasks.md`
- `pnpm build:server`
- `pnpm test:client`
- `pnpm build:client`
- `openspec validate add-users-client-ui --strict`
- Manual: run `pnpm dev:server` and `pnpm dev:client` against an approved local/non-production configuration, then execute the scenarios in task 8.3.

**Done when:**

- Both package builds, all client tests, strict OpenSpec validation, and the approved-environment smoke matrix pass; API/auth/settings blockers are resolved rather than inferred; and every applicable research risk has objective verification evidence.
