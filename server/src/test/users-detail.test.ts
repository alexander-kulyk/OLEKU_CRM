import { after, before, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { Server } from 'node:http'
import type { Express } from 'express'
import {
  startTestEnvironment,
  stopTestEnvironment,
  type TestEnvironment,
} from './support/test-environment.ts'

type UserModelModule = typeof import('../modules/users/user.model.ts')
type NormalizationModule = typeof import(
  '../modules/users/user-normalization.ts'
)

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

describe('users detail API', () => {
  let testEnvironment: TestEnvironment
  let server: Server
  let baseUrl: string
  let UserModel: UserModelModule['UserModel']
  let normalizeUserPatch: NormalizationModule['normalizeUserPatch']
  let sequence = 0

  before(async () => {
    testEnvironment = await startTestEnvironment()
    const { connectToMongo } = await import(
      '../shared/infra/mongoose/client.ts'
    )
    await connectToMongo()
    ;({ UserModel } = await import('../modules/users/user.model.ts'))
    ;({ normalizeUserPatch } = await import(
      '../modules/users/user-normalization.ts'
    ))
    const { createApp } = await import('../app.ts')
    ;({ server, baseUrl } = await listen(createApp()))
  })

  beforeEach(async () => {
    await UserModel.deleteMany({})
  })

  after(async () => {
    await closeServer(server)
    await stopTestEnvironment(testEnvironment)
  })

  async function insertUser(overrides: {
    archivedAt?: Date | null
    lastLoginAt?: Date | null
  } = {}) {
    sequence += 1
    const source = {
      firstName: 'Anna',
      lastName: 'Smith',
      email: `detail-${sequence}@example.com`,
      phone: '+380501234567',
      phoneExtension: '42',
      address: { country: 'Ukraine', city: 'Kyiv' },
      status: 'active' as const,
      lastLoginAt: overrides.lastLoginAt ?? null,
    }
    const normalized = normalizeUserPatch({}, source)

    return UserModel.create({
      ...normalized,
      archivedAt: overrides.archivedAt ?? null,
      version: 7,
    })
  }

  async function get(path: string) {
    const response = await fetch(`${baseUrl}${path}`)
    const body = (await response.json()) as any
    return { response, body }
  }

  it('returns an archived user with UTC date strings', async () => {
    const archivedAt = new Date('2026-08-16T12:00:00.000Z')
    const lastLoginAt = new Date('2026-08-15T08:30:00.000Z')
    const user = await insertUser({ archivedAt, lastLoginAt })

    const { response, body } = await get(`/api/users/${user._id}`)

    assert.equal(response.status, 200)
    assert.equal(body.archivedAt, archivedAt.toISOString())
    assert.equal(body.lastLoginAt, lastLoginAt.toISOString())
    assert.match(body.createdAt, /^\d{4}-\d{2}-\d{2}T.*Z$/)
    assert.match(body.updatedAt, /^\d{4}-\d{2}-\d{2}T.*Z$/)
    assert.equal(body.version, 7)
  })

  it('returns NOT_FOUND for an unknown well-formed identifier', async () => {
    const { response, body } = await get(
      '/api/users/64f1b2c3d4e5f6a7b8c9d0e1',
    )

    assert.equal(response.status, 404)
    assert.equal(body.error.code, 'NOT_FOUND')
  })

  it('rejects a malformed identifier before persistence lookup', async () => {
    const model = UserModel as any
    const originalFindOne = model.findOne
    let lookupCount = 0
    model.findOne = () => {
      lookupCount += 1
      throw new Error('persistence must not be reached')
    }

    try {
      const { response, body } = await get('/api/users/not-an-object-id')
      assert.equal(response.status, 400)
      assert.equal(body.error.code, 'VALIDATION_ERROR')
      assert.equal(lookupCount, 0)
    } finally {
      model.findOne = originalFindOne
    }
  })

  it('whitelists exact list and detail fields despite stored extras', async () => {
    const user = await insertUser()
    await UserModel.collection.updateOne(
      { _id: user._id },
      {
        $set: {
          passwordHash: 'must-not-leak',
          accessToken: 'must-not-leak',
          refreshToken: 'must-not-leak',
          securityMetadata: { lastIp: '127.0.0.1' },
          __v: 99,
        } as any,
      },
    )

    const list = await get('/api/users')
    const detail = await get(`/api/users/${user._id}`)
    const listItem = list.body.items[0]

    assert.deepEqual(Object.keys(listItem).sort(), [
      'address',
      'email',
      'firstName',
      'id',
      'lastLoginAt',
      'lastName',
      'phone',
      'status',
    ])
    assert.deepEqual(Object.keys(detail.body).sort(), [
      'address',
      'archivedAt',
      'createdAt',
      'email',
      'firstName',
      'id',
      'lastLoginAt',
      'lastName',
      'phone',
      'phoneExtension',
      'status',
      'updatedAt',
      'version',
    ])

    for (const forbidden of [
      '_id',
      '__v',
      'emailNormalized',
      'firstNameFolded',
      'lastNameFolded',
      'fullNameFolded',
      'fullNameReversedFolded',
      'phoneDigits',
      'statusRank',
      'lastLoginRank',
      'passwordHash',
      'accessToken',
      'refreshToken',
      'securityMetadata',
    ]) {
      assert.equal(forbidden in listItem, false, `list leaked ${forbidden}`)
      assert.equal(forbidden in detail.body, false, `detail leaked ${forbidden}`)
    }
    assert.equal('version' in listItem, false)
  })
})
