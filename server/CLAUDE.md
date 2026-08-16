# server

Express 5 API on Node 24, running TypeScript natively — `node --watch src/main.ts`, no
build step in development. There is no ts-node or tsx, so **relative imports must carry
the `.ts` extension** (see `src/app.ts`).

## Layout

- `src/main.ts` → `src/server.ts` (connect Mongo, listen, graceful shutdown) → `src/app.ts`
  (middleware, routes, 404 and error handlers).
- `src/shared/config/env.ts` — the only place `process.env` is read. Add new variables here.
- `src/shared/infra/mongoose/client.ts` — the Mongoose 9 connection.
- `src/modules/<feature>/` — one folder per feature (model, routes, service), mounted in
  `app.ts` under `/api`.

## Conventions

- The Mongo URI comes from `DB_HOST`, not `MONGO_URI`. It is required — the process throws
  at startup when it is missing.
- `DEFAULT_PHONE_REGION` is required and must be a supported two-letter country code (for
  example, `UA`) used to parse phone numbers supplied in national format.
- The catch-all 404 and the error handler stay last in `app.ts`; mount new routers above them.
- Validate request input with zod at the route boundary and return the shared error envelope
  so the client can render the message.
- Domain data lives in `contacts` (clients) and `employees` (staff). `users` is the future
  authentication surface — not a people directory, so do not attach domain data to it.
