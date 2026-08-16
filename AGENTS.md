# OLEKU_CRM repository guidance

## Scope

These instructions apply to the whole repository. The `client/AGENTS.md` and
`server/AGENTS.md` files add package-specific rules for work under those directories.

## Repository overview

- This is a pnpm 11 workspace running on Node.js 24.18 or newer.
- `client/` is the React SPA; `server/` is the Express API.
- `docs/prd/` contains product requirements.
- `openspec/changes/` contains change proposals, designs, specs, and task lists.
- `.ai_toolkit/` is a Git submodule and the canonical source for reusable agent assets.
  Do not copy toolkit assets or edit the submodule as part of an application change.
- Codex discovers repository skills through `.agents/skills/`, starting at its working
  directory and walking up to the repository root. Launch Codex from `client/` for the
  frontend profile and from `server/` for the backend profile.

## Package management

- Use pnpm only. Do not create or restore `package-lock.json` or `yarn.lock`.
- Install dependencies from the repository root with
  `pnpm --filter <client|server> add <package>`.
- Commit `pnpm-lock.yaml` whenever a dependency change updates it.
- Do not edit `node_modules/`, `dist/`, or generated output by hand.

## Common commands

Run commands from the repository root:

- `pnpm dev:client` — start the Vite client.
- `pnpm dev:server` — start the API in watch mode.
- `pnpm build:client` — type-check and build the client.
- `pnpm build:server` — type-check the server.

There is currently no repository lint script or repo-wide test script. The server package
does have `pnpm --filter server test`, which runs `node --test src/test/*.test.ts`. Do not
claim that lint or tests passed unless the corresponding command was actually run.

## Working agreements

- Read the nearest `AGENTS.md` before changing files in a package.
- Preserve existing user changes and keep edits scoped to the request.
- For work tied to an OpenSpec change, read its proposal, design, specs, and tasks before
  implementation; keep task status aligned with completed work.
- Keep client/server contracts synchronized when changing routes, payloads, validation, or
  error behavior.
- Add production dependencies only when the requested behavior requires them.
- Run the build for every affected package. Run both builds for cross-package changes.
- Do not create commits, push branches, or modify the submodule revision unless explicitly
  requested.

## Code review rules

- Treat broken client/server contracts, missing boundary validation, exposed secrets,
  authorization gaps, and data-loss risks as blocking findings.
- Flag hand-edited generated output and package-manager drift.
- Keep formatting-only observations secondary unless they hide a behavioral problem.
