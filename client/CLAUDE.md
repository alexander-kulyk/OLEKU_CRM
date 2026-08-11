# client

React 19 SPA: Vite 8, TypeScript, Tailwind 4, react-router 7
(`BrowserRouter` route tree in `src/app/router/AppRouter.tsx`), zustand, axios,
react-hook-form + zod, FullCalendar 6.
Dev server runs on port 5173 — the server's default `CORS_ORIGIN`.

## Layout

Feature-Sliced Design with four layers: `app` → `pages` → `features` → `shared`.
Imports only travel downward, and a slice is reached through its public `index.ts`.
All four layers are populated: `app` holds the router and layout shell, `pages` the
routed screens, `features` the event-calendar/event-dialog/event-participants slices,
and `shared` the API client, the event store, UI primitives, and `lib`/`config`.

## Conventions

The React skills in `.claude/skills/` are the source of truth for component and hook
style, FSD layering, and anti-patterns. They load automatically when working in this
package — follow them instead of restating the rules here, **except** where this file
states a package-level override below; an override wins for this package only.

- **State placement is overridden for events.** The shared `state-management` skill's
  rule — Context is the only sanctioned cross-component/cross-feature mechanism, no
  store library — does not hold here. A zustand store (`src/shared/model/event-store.ts`)
  is the single owner of both event data and calendar UI state (design.md D2, D8); it is
  not a fallback for "neither fits". There is no separate remote-data-caching library in
  this package — do not duplicate event data into local component state or a second
  store; that is exactly the review-blocking duplication this override exists to
  prevent. The skill's guidance still applies to any other state in this package that
  isn't event/calendar data.
- Forms use react-hook-form with a zod resolver.
- **The API is not same-origin.** There is no Vite proxy. The axios instance
  (`src/shared/api/http-client.ts`) reads `baseURL` from `VITE_API_BASE_URL`, defaulting
  to `http://localhost:3000/api` (see `client/.env.example`). Because requests cross
  origins, the dev server's port (5173 by default) and the API server's `CORS_ORIGIN`
  must agree, or every request is rejected by CORS — see `client/.env.example` for the
  exact coupling.
- **Styling is overridden.** The `react-best-practices` skill's styled-components/
  `spTheme` section does not apply to this package; Tailwind v4 is canonical here
  (CSS-first `@theme` tokens in `src/index.css`, no `tailwind.config.*`). The same
  skill's FSD layering rules are not overridden — they were followed as-is.
