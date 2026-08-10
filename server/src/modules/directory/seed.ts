import mongoose from 'mongoose'
import { ContactModel, type ContactAttributes } from './contact.model.ts'
import { EmployeeModel, type EmployeeAttributes } from './employee.model.ts'
import { CONTACT_SEEDS, EMPLOYEE_SEEDS } from './seed-data.ts'

const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1'])
const LOOPBACK_IPV4_PATTERN = /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/

function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase()
  return LOOPBACK_HOSTNAMES.has(normalized) || LOOPBACK_IPV4_PATTERN.test(normalized)
}

/**
 * Extracts every bare hostname (no port, no credentials, no brackets) named
 * by a MongoDB connection string. Handles the multi-host
 * `mongodb://a,b,c/db` form used by replica sets as well as the
 * single-host `mongodb+srv://` form used by Atlas. Pure string parsing —
 * no DNS lookup, no I/O — so it is safe to call before any connection
 * attempt.
 */
export function extractMongoHosts(mongoUri: string): string[] {
  const withoutScheme = mongoUri.replace(/^mongodb(\+srv)?:\/\//, '')
  const withoutCredentials = withoutScheme.replace(/^[^/@]*@/, '')
  const [authority] = withoutCredentials.split(/[/?]/, 1)

  return (authority ?? '')
    .split(',')
    .map((hostPort) => {
      const bracketed = /^\[([^\]]+)\]/.exec(hostPort)
      if (bracketed?.[1]) {
        return bracketed[1]
      }
      const [host] = hostPort.split(':')
      return host ?? ''
    })
    .map((host) => host.trim())
    .filter((host) => host.length > 0)
}

/**
 * Throws when `mongoUri` names any host that is not loopback. Synchronous
 * and does no I/O itself, so calling it first — before `mongoose.connect`
 * — is what makes the refusal happen before connecting (design.md D11;
 * tasks.md 3.4). A connection string naming several hosts (a replica set)
 * is rejected if even one of them is not loopback: seeding must never have
 * a path to a non-local member.
 */
export function assertLoopbackMongoUri(mongoUri: string): void {
  const hosts = extractMongoHosts(mongoUri)

  if (hosts.length === 0) {
    throw new Error(
      'Refusing to seed: could not determine a host from the supplied MongoDB connection string.',
    )
  }

  const nonLoopback = hosts.filter((host) => !isLoopbackHostname(host))

  if (nonLoopback.length > 0) {
    throw new Error(
      `Refusing to seed a non-loopback MongoDB host: ${nonLoopback.join(', ')}. ` +
        'The directory seed only ever runs against a local or disposable database.',
    )
  }
}

export interface DirectorySeedSummary {
  contacts: number
  employees: number
}

async function upsertContact(seed: ContactAttributes): Promise<void> {
  await ContactModel.findOneAndUpdate(
    { email: seed.email },
    { $set: seed },
    { upsert: true, runValidators: true, setDefaultsOnInsert: true },
  )
}

async function upsertEmployee(seed: EmployeeAttributes): Promise<void> {
  await EmployeeModel.findOneAndUpdate(
    { email: seed.email },
    { $set: seed },
    { upsert: true, runValidators: true, setDefaultsOnInsert: true },
  )
}

/**
 * Upserts the fixed dataset declared in `seed-data.ts` into `contacts` and
 * `employees`, matching each record by `email`. Refuses a non-loopback
 * `mongoUri` before opening any connection or issuing any write
 * (design.md D11). Running it twice against the same database converges
 * to the same records instead of duplicating them, because every write is
 * an upsert keyed by `email`.
 *
 * Touches only the two directory models — never `events`, never `users`.
 *
 * Connects the shared Mongoose default connection when one is not already
 * open; does not disconnect it, mirroring the separate `connectToMongo()`
 * / `disconnectFromMongo()` lifecycle functions in
 * `shared/infra/mongoose/client.ts` — the caller (the CLI entry point
 * below, or a test's own cleanup) owns disconnection.
 */
export async function seedDirectory(mongoUri: string): Promise<DirectorySeedSummary> {
  assertLoopbackMongoUri(mongoUri)

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(mongoUri)
  }

  for (const contact of CONTACT_SEEDS) {
    await upsertContact(contact)
  }

  for (const employee of EMPLOYEE_SEEDS) {
    await upsertEmployee(employee)
  }

  return { contacts: CONTACT_SEEDS.length, employees: EMPLOYEE_SEEDS.length }
}

/**
 * The CLI entry point behind `pnpm --filter server seed`. Never imported
 * by `main.ts` / `server.ts` / `app.ts` — the seed only ever runs when a
 * developer explicitly asks for it, never at application startup
 * (design.md D11; tasks.md 3.4).
 */
async function runFromCli(): Promise<void> {
  const { env } = await import('../../shared/config/env.ts')
  const { disconnectFromMongo } = await import('../../shared/infra/mongoose/client.ts')

  try {
    const summary = await seedDirectory(env.mongoUri)
    console.log(`Seeded ${summary.contacts} contact(s) and ${summary.employees} employee(s).`)
  } finally {
    await disconnectFromMongo()
  }
}

if (import.meta.main) {
  runFromCli().catch((error) => {
    console.error('Directory seed failed:', error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
