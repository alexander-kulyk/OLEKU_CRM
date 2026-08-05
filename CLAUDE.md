# OLEKU_CRM

pnpm workspace monorepo for a CRM aimed at small service businesses in education.
Two packages: `client` (React SPA) and `server` (Express API). Node >= 24.18, pnpm 11.

## Commands

Run from the repo root:

- `pnpm dev:client` / `pnpm dev:server`
- `pnpm build:client` / `pnpm build:server`

pnpm is the package manager for the whole workspace — install dependencies into a
package with `pnpm --filter <client|server> add <pkg>`, not from inside the folder.

## Agent assets live in `.ai_toolkit/`

`.ai_toolkit/` is a git submodule shared across projects — the single source of truth
for reusable skills, agents, and commands. Everything is wired in by **symlink**, never
copied. Clone with `git clone --recurse-submodules`, or run `git submodule update --init`.

| Where | What goes there | Loaded |
| --- | --- | --- |
| `.claude/settings.json` | permissions, env, hooks | always — **the only settings file that is read**; one in `client/` or `server/` is ignored |
| `.claude/commands/`, `.claude/agents/` | workflow commands and subagents | always — nested copies are not discovered |
| `.claude/skills/` | cross-cutting skills | at session start |
| `client/.claude/skills/`, `server/.claude/skills/` | package-scoped skills, one symlink per skill | lazily, the first time Claude reads or edits a file in that package |

To add a skill: create it in `.ai_toolkit/` (its own repo — update the README index in the
same PR), then symlink it into the scope it belongs to. Link individual skills, not the
whole `skills/` directory, or the client/server split collapses.

## Specs and docs

- `docs/prd/` — product vision and release requirements.
- `openspec/changes/` — change proposals, specs, and task lists. Drive them with the
  `/opsx:*` commands.
