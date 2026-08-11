# Client package guidance

## Scope

These instructions apply to everything under `client/` and extend the repository-level
`AGENTS.md`.

## Architecture

- The client is a React 19, TypeScript, and Vite 8 SPA.
- Follow Feature-Sliced Design with the current layer order
  `app -> pages -> features -> shared`.
- Imports may only move down that layer order. Consume slices through their public
  `index.ts`; do not import another slice's internals.
- Keep business-domain code out of `shared/`.
- Add `entities` or `widgets` only when a concrete feature needs those layers.

## Project standards

Before relevant frontend work, read and follow the canonical skills in
`../.ai_toolkit/skills/`: `feature-sliced-design`, `react-best-practices`,
`react-anti-patterns`, `state-management`, and `data-driven-rendering`. The symlinks in
this package's `.claude/skills/` and `.agents/skills/` expose the same sources to Claude
Code and Codex respectively. Two package-level overrides to those shared skills apply
here and take precedence for this package only (design.md D8; the submodule itself is
untouched):

- **State management:** the `state-management` skill's Context-only rule for
  cross-component/cross-feature state does not hold for event and calendar-UI state. A
  zustand store (`src/shared/model/event-store.ts`) is the sanctioned single owner of
  that data — see the bullet below.
- **Styling:** the `react-best-practices` skill's styled-components/`spTheme` section
  does not apply. Tailwind v4 (CSS-first `@theme` tokens, no `tailwind.config.*`) is
  canonical for this package. That skill's FSD layering rules are not overridden and were
  followed as written.

- Event data and calendar UI state (active view, focused date, dialog target) live in
  the zustand store at `src/shared/model/event-store.ts` — see the override above. Use
  it rather than local component state or a second store for that data. This package
  has no separate remote-data-caching library; do not introduce one as a second,
  dormant way to hold remote state.
- Keep UI state local where possible; introduce shared state only for a demonstrated
  cross-component or cross-feature need (the events store above is that demonstrated
  need; it is not a precedent for defaulting to a store elsewhere).
- Use React Hook Form with Zod for non-trivial forms.
- Keep API routes under `/api` and centralize Axios configuration; the client's Axios
  instance lives in `src/shared/api/http-client.ts` with an environment-driven `baseURL`
  (`VITE_API_BASE_URL`, see `client/.env.example`) rather than a same-origin proxy — the
  dev server's port and the API server's `CORS_ORIGIN` must agree. Coordinate request,
  response, and error shapes with `server/`.
- Keep JSX declarative and avoid storing values in state when they can be derived during
  render.

## Verification

- Run `pnpm --filter client build` after client changes.
- There is currently no client lint or test script. If a change introduces one, document
  and run it without replacing the build gate.

## Code review rules

- Flag FSD import-direction or slice-isolation violations.
- Flag duplicated remote state, effect-driven derived state, and client assumptions that
  do not match the server contract. The zustand store at `src/shared/model/event-store.ts`
  is the one sanctioned place event and calendar-UI state lives; a copy of that data
  reappearing in local component state, a second store, or a reintroduced remote-data
  library is exactly this violation, not an exception to it.
- Treat accessibility regressions in interactive controls and forms as blocking.
