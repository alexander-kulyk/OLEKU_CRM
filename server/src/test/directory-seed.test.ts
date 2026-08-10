import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  startTestEnvironment,
  stopTestEnvironment,
  type TestEnvironment,
} from './support/test-environment.ts'

// A routable address reserved for documentation/testing by RFC 5737
// (TEST-NET-3) — guaranteed not to be loopback, and never actually dialed
// because assertLoopbackMongoUri() must reject it first.
const NON_LOOPBACK_IP_URI = 'mongodb://203.0.113.1:27017/should-never-connect'
const NON_LOOPBACK_SRV_URI = 'mongodb+srv://cluster0.abc123.mongodb.net/prod'

// Generic rather than `(record: Record<string, unknown>) => ...`: the
// `.lean()` result type Mongoose infers has no index signature, so a
// non-generic `Record<string, unknown>` parameter fails assignability
// (TS2345) when used directly as an `Array.prototype.map` callback.
function serializeRecord<T extends { _id: unknown }>(record: T): Omit<T, '_id'> & { _id: string } {
  const { _id, ...rest } = record
  return { ...rest, _id: String(_id) } as Omit<T, '_id'> & { _id: string }
}

describe('directory seed', () => {
  let testEnvironment: TestEnvironment

  let mongoose: (typeof import('mongoose'))['default']
  let seedDirectory: (typeof import('../modules/directory/seed.ts'))['seedDirectory']
  let assertLoopbackMongoUri: (typeof import('../modules/directory/seed.ts'))['assertLoopbackMongoUri']
  let extractMongoHosts: (typeof import('../modules/directory/seed.ts'))['extractMongoHosts']
  let ContactModel: (typeof import('../modules/directory/contact.model.ts'))['ContactModel']
  let EmployeeModel: (typeof import('../modules/directory/employee.model.ts'))['EmployeeModel']
  let CONTACT_SEEDS: (typeof import('../modules/directory/seed-data.ts'))['CONTACT_SEEDS']
  let EMPLOYEE_SEEDS: (typeof import('../modules/directory/seed-data.ts'))['EMPLOYEE_SEEDS']

  before(async () => {
    // Per design.md D10: DB_HOST must point at the disposable in-memory
    // database before anything that reaches env.ts is imported.
    testEnvironment = await startTestEnvironment()

    mongoose = (await import('mongoose')).default
    ;({ seedDirectory, assertLoopbackMongoUri, extractMongoHosts } = await import(
      '../modules/directory/seed.ts'
    ))
    ;({ ContactModel } = await import('../modules/directory/contact.model.ts'))
    ;({ EmployeeModel } = await import('../modules/directory/employee.model.ts'))
    ;({ CONTACT_SEEDS, EMPLOYEE_SEEDS } = await import('../modules/directory/seed-data.ts'))
  })

  after(async () => {
    await stopTestEnvironment(testEnvironment)
  })

  it('extracts hosts from single-host, credentialed multi-host, and +srv connection strings', () => {
    assert.deepEqual(extractMongoHosts('mongodb://127.0.0.1:27017/db'), ['127.0.0.1'])
    assert.deepEqual(
      extractMongoHosts('mongodb://user:pass@127.0.0.1:27017,localhost:27018/db?replicaSet=rs0'),
      ['127.0.0.1', 'localhost'],
    )
    assert.deepEqual(extractMongoHosts('mongodb://[::1]:27017/db'), ['::1'])
    assert.deepEqual(extractMongoHosts(NON_LOOPBACK_SRV_URI), ['cluster0.abc123.mongodb.net'])
    assert.deepEqual(extractMongoHosts(testEnvironment.mongoUri), ['127.0.0.1'])
  })

  it('accepts every loopback host form (127.0.0.1, localhost, ::1, the in-memory URI)', () => {
    assert.doesNotThrow(() => assertLoopbackMongoUri('mongodb://127.0.0.1:27017/db'))
    assert.doesNotThrow(() => assertLoopbackMongoUri('mongodb://localhost:27017/db'))
    assert.doesNotThrow(() => assertLoopbackMongoUri('mongodb://[::1]:27017/db'))
    assert.doesNotThrow(() => assertLoopbackMongoUri(testEnvironment.mongoUri))
  })

  it('refuses a routable non-loopback host and an Atlas-style +srv host', () => {
    assert.throws(() => assertLoopbackMongoUri(NON_LOOPBACK_IP_URI))
    assert.throws(() => assertLoopbackMongoUri(NON_LOOPBACK_SRV_URI))
  })

  it('refuses a multi-host connection string when even one host is not loopback', () => {
    assert.throws(() =>
      assertLoopbackMongoUri('mongodb://127.0.0.1:27017,203.0.113.1:27017/db?replicaSet=rs0'),
    )
  })

  it('runs the seed twice and converges to identical records without duplicates', async () => {
    const first = await seedDirectory(testEnvironment.mongoUri)
    const firstContacts = await ContactModel.find().sort({ email: 1 }).lean()
    const firstEmployees = await EmployeeModel.find().sort({ email: 1 }).lean()

    const second = await seedDirectory(testEnvironment.mongoUri)
    const secondContacts = await ContactModel.find().sort({ email: 1 }).lean()
    const secondEmployees = await EmployeeModel.find().sort({ email: 1 }).lean()

    assert.deepEqual(first, second)
    assert.equal(firstContacts.length, CONTACT_SEEDS.length)
    assert.equal(firstEmployees.length, EMPLOYEE_SEEDS.length)
    assert.equal(secondContacts.length, CONTACT_SEEDS.length)
    assert.equal(secondEmployees.length, EMPLOYEE_SEEDS.length)

    assert.deepEqual(firstContacts.map(serializeRecord), secondContacts.map(serializeRecord))
    assert.deepEqual(firstEmployees.map(serializeRecord), secondEmployees.map(serializeRecord))

    const contactEmails = secondContacts.map((contact) => contact.email)
    assert.equal(new Set(contactEmails).size, contactEmails.length, 'expected no duplicate contact emails')

    const employeeEmails = secondEmployees.map((employee) => employee.email)
    assert.equal(
      new Set(employeeEmails).size,
      employeeEmails.length,
      'expected no duplicate employee emails',
    )
  })

  it('includes at least one inactive contact, one ineligible employee, and one inactive employee', async () => {
    await seedDirectory(testEnvironment.mongoUri)

    const inactiveContacts = await ContactModel.countDocuments({ status: 'inactive' })
    const ineligibleEmployees = await EmployeeModel.countDocuments({ canHostEvents: false })
    const inactiveEmployees = await EmployeeModel.countDocuments({ status: 'inactive' })

    assert.ok(inactiveContacts >= 1, 'expected at least one inactive contact in the fixed dataset')
    assert.ok(ineligibleEmployees >= 1, 'expected at least one ineligible employee in the fixed dataset')
    assert.ok(inactiveEmployees >= 1, 'expected at least one inactive employee in the fixed dataset')
  })

  it('never creates or modifies documents in events or users', async () => {
    await seedDirectory(testEnvironment.mongoUri)

    const db = mongoose.connection.db
    assert.ok(db, 'expected an active database handle after seeding')

    const eventsCount = await db.collection('events').countDocuments()
    const usersCount = await db.collection('users').countDocuments()

    assert.equal(eventsCount, 0)
    assert.equal(usersCount, 0)
  })

  it('rejects a non-loopback URI before connecting or writing anything', async () => {
    // Establish a known, connected baseline first.
    await seedDirectory(testEnvironment.mongoUri)
    const readyStateBefore = mongoose.connection.readyState
    const beforeContacts = await ContactModel.countDocuments()
    const beforeEmployees = await EmployeeModel.countDocuments()

    const startedAt = performance.now()
    await assert.rejects(() => seedDirectory(NON_LOOPBACK_IP_URI))
    const elapsedMs = performance.now() - startedAt

    // A real attempt to reach an unroutable test-net address would run
    // into MongoDB's server-selection timeout (tens of seconds by
    // default), so a rejection this fast is strong evidence no connection
    // was ever attempted — the validation threw synchronously instead.
    assert.ok(
      elapsedMs < 1000,
      `expected the rejection well before any real network attempt could complete, took ${elapsedMs}ms`,
    )

    // The pre-existing connection to the in-memory database — the only
    // connection this process has open — is completely untouched.
    assert.equal(
      mongoose.connection.readyState,
      readyStateBefore,
      'expected the existing connection state to be unaffected by the rejected call',
    )

    const afterContacts = await ContactModel.countDocuments()
    const afterEmployees = await EmployeeModel.countDocuments()
    assert.equal(afterContacts, beforeContacts)
    assert.equal(afterEmployees, beforeEmployees)
  })
})
