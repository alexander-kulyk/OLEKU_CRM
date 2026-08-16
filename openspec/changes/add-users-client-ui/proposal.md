## Why

The `/users` route is currently a no-request placeholder even though BR-USERS v4.0 defines a complete operational user-management experience and the companion `add-users-server-api` change now defines its API contract. The client needs an accessible, URL-addressable Users workspace that consumes that contract without duplicating server state or weakening pagination, concurrency, and error semantics.

## What Changes

- Replace the `/users` placeholder with a server-driven Users table covering the required columns, status presentation, nullable contact fields, sorting, pagination, status filters, debounced search, loading/error/empty/no-results states, responsive horizontal access, and accessible interactions.
- Make validated URL parameters the canonical list-query state, including `pageSize`; explicit page/filter/sort changes create history entries, while typed search and canonical URL repair replace the current entry. A one-character search is retained in the URL but is not sent to the API and does not discard active status/sort controls. Clear filters removes search and status filters and returns to page 1.
- Add detail-before-edit, React Hook Form/Zod validation, normalized dirty detection, versioned merge-patch updates, archive confirmation, pagination repair, list refetch after mutation, and error-specific recovery that preserves unsaved values when required.
- Treat Save on a normalized-clean form as a local no-op: keep the dialog open, send no PATCH, and expose a non-error "No changes to save" status. Never overwrite newer server data automatically after a version conflict; keep the form open and offer an explicit reload-latest path guarded by discard confirmation.
- Extend the shared client error boundary to preserve the server error `code`, optional `field`, and HTTP status, while retaining event error codes introduced by concurrent changes and suppressing expected request-cancellation failures.
- Harden reusable dialog behavior for initial focus, focus containment, topmost-Escape ownership, outside-click semantics, and deterministic focus restoration; keep field errors programmatically associated, including address fields.
- Add a focused client test harness and automated coverage for URL canonicalization/history, request races, list-state distinctions, normalized patch construction, conflict recovery, dialog accessibility, and keyboard interaction. The existing client build remains the required package gate.
- Keep current-operator identity, centralized authentication recovery, and the deployment-wide default phone region as explicit external integration prerequisites. The client SHALL consume those inputs when supplied, display Last Login in UTC, and SHALL NOT infer a phone region from the browser.
- Keep user creation, invitation, authentication/authorization design, roles, restoration, audit storage, permanent erasure, bulk operations, and server implementation outside this client change.

## Capabilities

### New Capabilities

- `user-management`: Client-visible Users list, URL query behavior, edit and archive workflows, concurrency/error recovery, responsive presentation, and accessibility requirements.

### Modified Capabilities

- `app-navigation`: Replace the reserved Users placeholder/no-request requirement with the operational Users page while preserving the existing `/users` route and persistent application shell.

## Impact

- **Client architecture:** `client/src/pages/users` becomes a thin composition boundary over one cohesive `client/src/features/user-management` slice with `ui`, `model`, `api`, `lib`, and `config` segments exposed through a public API. Users domain code does not move into `shared`, and no Users Zustand store or remote-data cache is introduced.
- **Shared client boundaries:** the Axios error normalization and reusable modal/dialog primitives change additively; concurrent `EVENT_VERSION_CONFLICT` support must be preserved.
- **API dependency:** the feature consumes the planned `GET /api/users`, `GET /api/users/:userId`, `PATCH /api/users/:userId`, and `DELETE /api/users/:userId` contracts from `add-users-server-api`. End-to-end verification depends on that change being implemented and routed through the configured `VITE_API_BASE_URL`/CORS environment.
- **External context dependencies:** full self-archive protection and 401 recovery depend on future operator/authentication contracts; national-format phone normalization depends on deployment-wide phone-region configuration. These remain visible blockers, not browser-derived defaults.
- **Dependencies/tooling:** `libphonenumber-js` is added to the client for region-aware phone parsing/normalization, and a client test runner plus React DOM testing utilities are added as dev dependencies through pnpm; no production remote-state dependency is added.
- **Behavioral compatibility:** the existing app-navigation placeholder requirement is deliberately replaced. Existing Calendar/Event behavior, its sanctioned Zustand store, and non-Users API response shapes remain unchanged.
