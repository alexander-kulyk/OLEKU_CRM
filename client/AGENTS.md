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
Code and Codex respectively.

- Use TanStack Query for remote server state.
- Keep UI state local where possible; introduce shared state only for a demonstrated
  cross-component or cross-feature need.
- Use React Hook Form with Zod for non-trivial forms.
- Keep API routes under `/api` and centralize Axios configuration when adding the API
  client. Coordinate request, response, and error shapes with `server/`.
- Keep JSX declarative and avoid storing values in state when they can be derived during
  render.

## Verification

- Run `pnpm --filter client build` after client changes.
- There is currently no client lint or test script. If a change introduces one, document
  and run it without replacing the build gate.

## Code review rules

- Flag FSD import-direction or slice-isolation violations.
- Flag duplicated remote state, effect-driven derived state, and client assumptions that
  do not match the server contract.
- Treat accessibility regressions in interactive controls and forms as blocking.
