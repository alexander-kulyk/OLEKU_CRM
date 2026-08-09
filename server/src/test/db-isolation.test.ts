import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  startTestEnvironment,
  stopTestEnvironment,
} from './support/test-environment.ts'

// Deliberately synthetic and unreachable — this value must never actually be
// connected to. It stands in for whatever `DB_HOST` a shell or `server/.env`
// might already have set (see design.md D10) before the test environment
// helper takes over.
const NON_TEST_DB_HOST =
  'mongodb://not-a-real-host.invalid:27017/should-never-connect'

test('the test environment helper isolates DB_HOST from a pre-existing non-test value', async () => {
  process.env.DB_HOST = NON_TEST_DB_HOST

  const testEnvironment = await startTestEnvironment()

  try {
    assert.equal(process.env.DB_HOST, testEnvironment.mongoUri)
    assert.notEqual(process.env.DB_HOST, NON_TEST_DB_HOST)

    // Only now dynamically import configuration and database modules — this
    // is the first point at which anything reads DB_HOST via env.ts.
    const { env } = await import('../shared/config/env.ts')

    assert.equal(env.mongoUri, testEnvironment.mongoUri)
    assert.notEqual(env.mongoUri, NON_TEST_DB_HOST)

    const { connectToMongo } = await import(
      '../shared/infra/mongoose/client.ts'
    )
    await connectToMongo()

    const mongoose = (await import('mongoose')).default
    const instanceInfo = testEnvironment.mongoServer.instanceInfo

    assert.ok(instanceInfo, 'expected the in-memory server to report instance info while running')
    // readyState 1 === connected (see Mongoose's ConnectionStates).
    assert.equal(mongoose.connection.readyState, 1)
    assert.equal(mongoose.connection.host, instanceInfo.ip)
    assert.equal(mongoose.connection.port, instanceInfo.port)
  } finally {
    await stopTestEnvironment(testEnvironment)
  }
})
