# client

React 19 SPA: Vite 8, TypeScript, Tailwind 4, react-router 7 (data router in
`src/app/router.tsx`), TanStack Query 5, react-hook-form + zod, FullCalendar 6.
Dev server runs on port 5173 — the server's default `CORS_ORIGIN`.

## Layout

Feature-Sliced Design with four layers: `app` → `pages` → `features` → `shared`.
Imports only travel downward, and a slice is reached through its public `index.ts`.
Only `src/app/` exists so far; create the remaining layers as features land.

## Conventions

The React skills in `.claude/skills/` are the source of truth for component and hook
style, state placement, FSD layering, and anti-patterns. They load automatically when
working in this package — follow them instead of restating the rules here.

- Server state belongs to TanStack Query (`src/app/query-client.ts`); component state
  stays local. Reach for a store only when neither fits.
- Forms use react-hook-form with a zod resolver.
- The API is same-origin under `/api` via axios; the server owns the error envelope.
