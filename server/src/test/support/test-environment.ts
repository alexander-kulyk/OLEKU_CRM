import { MongoMemoryServer } from 'mongodb-memory-server'

/**
 * A disposable, in-memory MongoDB instance started for a single test file,
 * plus the connection string it is reachable at.
 */
export interface TestEnvironment {
  mongoServer: MongoMemoryServer
  mongoUri: string
}

/**
 * Starts an isolated in-memory MongoDB instance and points `DB_HOST` at it
 * before anything reads that variable.
 *
 * Call this first, `await` it, and only then load `app.ts`, `env.ts`, the
 * Mongoose client, or any model — always with a dynamic `import()`, never a
 * static top-level `import`. Static imports are hoisted and would evaluate
 * before this function runs, letting `env.ts` read whatever `DB_HOST`
 * already happened to be set to (including a real `server/.env` value).
 * `dotenv`'s default `override: false` behavior means once `DB_HOST` is set
 * here, `env.ts`'s own `dotenv.config()` call cannot replace it.
 */
export async function startTestEnvironment(): Promise<TestEnvironment> {
  const mongoServer = await MongoMemoryServer.create()
  const mongoUri = mongoServer.getUri()

  process.env.DB_HOST = mongoUri
  process.env.DEFAULT_PHONE_REGION = 'UA'

  return { mongoServer, mongoUri }
}

/**
 * Disconnects Mongoose and stops the in-memory MongoDB instance started by
 * {@link startTestEnvironment}. Safe to call even when no Mongoose
 * connection was ever opened.
 */
export async function stopTestEnvironment(
  testEnvironment: TestEnvironment,
): Promise<void> {
  const { disconnectFromMongo } = await import(
    '../../shared/infra/mongoose/client.ts'
  )

  await disconnectFromMongo()
  await testEnvironment.mongoServer.stop()
}
