import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  startTestEnvironment,
  stopTestEnvironment,
  type TestEnvironment,
} from './support/test-environment.ts'

// design.md D8: the exact index events.model.ts declares. Field order
// matters for a compound index, so this compares a JSON-serialized form
// (which preserves key order) rather than a plain deepEqual.
const EXPECTED_EVENT_INDEX_KEY = JSON.stringify({ startAt: 1, endAt: 1 })

describe('event model (events)', () => {
  let testEnvironment: TestEnvironment

  let EventModel: (typeof import('../modules/events/event.model.ts'))['EventModel']

  before(async () => {
    // Per design.md D10: DB_HOST must point at the disposable in-memory
    // database before anything that reaches env.ts — including the
    // Mongoose client and the model — is imported.
    testEnvironment = await startTestEnvironment()

    const { connectToMongo } = await import('../shared/infra/mongoose/client.ts')
    await connectToMongo()

    ;({ EventModel } = await import('../modules/events/event.model.ts'))

    // Mongoose builds declared indexes asynchronously in the background;
    // Model.init() resolves once that has finished, so the index assertion
    // below isn't racing the background build.
    await EventModel.init()
  })

  after(async () => {
    await stopTestEnvironment(testEnvironment)
  })

  it('binds explicitly to the "events" collection name', () => {
    assert.equal(EventModel.collection.collectionName, 'events')
  })

  it('declares the exact { startAt, endAt } index', async () => {
    const indexes = await EventModel.collection.indexes()

    assert.ok(
      indexes.some((index) => JSON.stringify(index.key) === EXPECTED_EVENT_INDEX_KEY),
      `expected events to declare ${EXPECTED_EVENT_INDEX_KEY}, found: ${JSON.stringify(indexes)}`,
    )
  })

  it('defaults createdByUserId and updatedByUserId to null and both participant arrays to empty', () => {
    const event = new EventModel({
      title: 'Untouched defaults',
      startAt: new Date('2026-08-09T09:00:00Z'),
      endAt: new Date('2026-08-09T10:00:00Z'),
    })

    assert.equal(event.createdByUserId, null)
    assert.equal(event.updatedByUserId, null)
    assert.deepEqual(event.attendeeIds, [])
    assert.deepEqual(event.hostIds, [])
  })

  it('trims a padded title at the persistence layer, independent of the schema layer', () => {
    const event = new EventModel({
      title: '  Padded Title  ',
      startAt: new Date('2026-08-09T09:00:00Z'),
      endAt: new Date('2026-08-09T10:00:00Z'),
    })

    assert.equal(event.title, 'Padded Title')
  })

  it('rejects a whitespace-only title via the required+trim persistence backstop', async () => {
    const event = new EventModel({
      title: '   ',
      startAt: new Date('2026-08-09T09:00:00Z'),
      endAt: new Date('2026-08-09T10:00:00Z'),
    })

    await assert.rejects(() => event.validate())
  })

  it('rejects a zero-length span via the pre-validate backstop (design.md D5)', async () => {
    const sameInstant = new Date('2026-08-09T09:00:00Z')
    const event = new EventModel({ title: 'Zero span', startAt: sameInstant, endAt: sameInstant })

    await assert.rejects(() => event.validate())
  })

  it('rejects an inverted span via the pre-validate backstop (design.md D5)', async () => {
    const event = new EventModel({
      title: 'Inverted span',
      startAt: new Date('2026-08-09T10:00:00Z'),
      endAt: new Date('2026-08-09T09:00:00Z'),
    })

    await assert.rejects(() => event.validate())
  })

  it('accepts a document whose endAt is strictly later than startAt', async () => {
    const event = new EventModel({
      title: 'Valid span',
      startAt: new Date('2026-08-09T09:00:00Z'),
      endAt: new Date('2026-08-09T10:00:00Z'),
    })

    await assert.doesNotReject(() => event.validate())
  })
})
