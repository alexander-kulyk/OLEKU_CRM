import assert from 'node:assert/strict'
import type { Express } from 'express'
import type { Server } from 'node:http'
import { after, before, beforeEach, describe, it } from 'node:test'
import {
  startTestEnvironment,
  stopTestEnvironment,
  type TestEnvironment,
} from './support/test-environment.ts'

type EventModelModule = typeof import('../modules/events/event.model.ts')
type UserModelModule = typeof import('../modules/users/user.model.ts')
type NormalizationModule = typeof import('../modules/users/user-normalization.ts')

function listen(app: Express): Promise<{ server: Server; baseUrl: string }> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0)
    server.once('error', reject)
    server.once('listening', () => {
      const address = server.address()
      if (address === null || typeof address === 'string') {
        reject(new Error('expected a network address'))
        return
      }
      resolve({ server, baseUrl: `http://127.0.0.1:${address.port}` })
    })
  })
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })
}

describe('users archive API', () => {
  let testEnvironment: TestEnvironment
  let server: Server
  let baseUrl: string
  let EventModel: EventModelModule['EventModel']
  let UserModel: UserModelModule['UserModel']
  let normalizeUserPatch: NormalizationModule['normalizeUserPatch']
  let sequence = 0

  before(async () => {
    testEnvironment = await startTestEnvironment()
    const { connectToMongo } = await import('../shared/infra/mongoose/client.ts')
    await connectToMongo()
    ;({ EventModel } = await import('../modules/events/event.model.ts'))
    ;({ UserModel } = await import('../modules/users/user.model.ts'))
    ;({ normalizeUserPatch } = await import('../modules/users/user-normalization.ts'))
    const { createApp } = await import('../app.ts')
    ;({ server, baseUrl } = await listen(createApp()))
  })

  beforeEach(async () => {
    await Promise.all([EventModel.deleteMany({}), UserModel.deleteMany({})])
  })

  after(async () => {
    await closeServer(server)
    await stopTestEnvironment(testEnvironment)
  })

  async function insertUser(overrides: {
    email?: string
    status?: 'active' | 'inactive' | 'blocked'
    version?: number
  } = {}) {
    sequence += 1
    const source = {
      firstName: 'Archive',
      lastName: `Person ${sequence}`,
      email: overrides.email ?? `archive-${sequence}@example.com`,
      phone: null,
      phoneExtension: null,
      address: null,
      status: overrides.status ?? ('blocked' as const),
      lastLoginAt: null,
    }
    return UserModel.create({
      ...normalizeUserPatch({}, source),
      archivedAt: null,
      version: overrides.version ?? 7,
    })
  }

  async function archive(userId: unknown) {
    const response = await fetch(`${baseUrl}/api/users/${userId}`, {
      method: 'DELETE',
    })
    return { response, body: await response.text() }
  }

  it('soft archives without a version and preserves lifecycle fields', async () => {
    const user = await insertUser()
    await insertUser()
    const beforeList = await fetch(`${baseUrl}/api/users`).then((response) =>
      response.json(),
    ) as any

    const result = await archive(user._id)

    assert.equal(result.response.status, 204)
    assert.equal(result.body, '')
    const stored = await UserModel.findById(user._id).lean()
    assert.ok(stored)
    assert.ok(stored.archivedAt instanceof Date)
    assert.equal(stored.status, 'blocked')
    assert.equal(stored.version, 7)

    const detailResponse = await fetch(`${baseUrl}/api/users/${user._id}`)
    const detail = await detailResponse.json() as any
    assert.equal(detailResponse.status, 200)
    assert.equal(detail.archivedAt, stored.archivedAt.toISOString())

    const afterList = await fetch(`${baseUrl}/api/users`).then((response) =>
      response.json(),
    ) as any
    assert.equal(afterList.pagination.total, beforeList.pagination.total - 1)
    assert.equal(
      afterList.items.some((item: any) => item.id === String(user._id)),
      false,
    )
  })

  it('returns 204 repeatedly without changing the original archive timestamp', async () => {
    const user = await insertUser()
    const first = await archive(user._id)
    const firstStored = await UserModel.findById(user._id).lean()
    assert.ok(firstStored?.archivedAt)
    const originalBytes = firstStored.archivedAt.toISOString()

    const second = await archive(user._id)
    const secondStored = await UserModel.findById(user._id).lean()

    assert.equal(first.response.status, 204)
    assert.equal(second.response.status, 204)
    assert.equal(second.body, '')
    assert.equal(secondStored?.archivedAt?.toISOString(), originalBytes)
    assert.equal(secondStored?.version, 7)
  })

  it('returns NOT_FOUND for an unknown well-formed user id', async () => {
    const result = await archive('507f1f77bcf86cd799439011')

    assert.equal(result.response.status, 404)
    assert.equal(JSON.parse(result.body).error.code, 'NOT_FOUND')
  })

  it('keeps another entity reference resolvable after archival', async () => {
    const user = await insertUser()
    const event = await EventModel.create({
      title: 'Reference holder',
      startAt: new Date('2026-08-16T09:00:00.000Z'),
      endAt: new Date('2026-08-16T10:00:00.000Z'),
      attendeeIds: [],
      hostIds: [],
      createdByUserId: user._id,
      updatedByUserId: null,
    })

    const result = await archive(user._id)
    const storedEvent = await EventModel.findById(event._id).lean()
    const referencedUser = await UserModel.findById(
      storedEvent?.createdByUserId,
    ).lean()

    assert.equal(result.response.status, 204)
    assert.equal(String(storedEvent?.createdByUserId), String(user._id))
    assert.equal(String(referencedUser?._id), String(user._id))
    assert.ok(referencedUser?.archivedAt)
  })
})
