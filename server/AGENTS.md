# Server package guidance

## Scope

These instructions apply to everything under `server/` and extend the repository-level
`AGENTS.md`.

## Architecture

- The server is an Express 5 API using TypeScript and Mongoose 9 on Node.js 24.
- Development runs TypeScript directly with `node --watch src/main.ts`; relative local
  imports must include the `.ts` extension.
- Keep the startup flow `main.ts -> server.ts -> app.ts`: database and process lifecycle
  belong in `server.ts`, while middleware and routes belong in `app.ts`.
- Add feature code under `src/modules/<feature>/` and mount routers under `/api`.
- Keep shared configuration and infrastructure under `src/shared/`.

## Project standards

- Read environment variables only in `src/shared/config/env.ts`. `DB_HOST` is the required
  MongoDB connection variable; never commit credentials or `.env` files.
- Validate request input with Zod at the HTTP boundary.
- Pass operational errors to the centralized error handler; do not expose stack traces or
  internal details in production.
- Mount new routers before the catch-all 404 handler and the final error handler.
- Keep connection setup and graceful shutdown in `server.ts`.
- Use `contacts` for clients and `employees` for staff in the CRM people directory.
  `users` holds account identity plus the account profile used to administer access.
- When runtime behavior genuinely varies by a stable key, consult
  `../.ai_toolkit/skills/strategy-registries`; prefer direct code for simple closed branches.

## Verification

- Run `pnpm --filter server build` after server changes.
- Run `pnpm --filter server test` (`node --test src/test/*.test.ts`) after behavioral
  server changes. There is currently no server lint script; the test gate does not replace
  the build gate.

## Code review rules

- Treat missing input validation, secret leakage, unsafe database writes, and route/error
  middleware ordering regressions as blocking.
- Flag API contract changes that are not reflected in the client, specs, or verification.
- Verify shutdown and database lifecycle changes for both normal startup and failure paths.
