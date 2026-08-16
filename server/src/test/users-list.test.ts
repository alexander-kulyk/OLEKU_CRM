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

describe('users list API', () => {
  let testEnvironment: TestEnvironment
  let server: Server
  let baseUrl: string
  let UserModel: UserModelModule['UserModel']
  let normalizeUserPatch: NormalizationModule['normalizeUserPatch']

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
    firstName?: string
    lastName?: string
    email?: string
    status?: 'active' | 'inactive' | 'blocked'
    archivedAt?: Date | null
  } = {}) {
    const source = {
      firstName: overrides.firstName ?? 'Anna',
      lastName: overrides.lastName ?? 'Smith',
      email: overrides.email ?? `${crypto.randomUUID()}@example.com`,
      phone: null,
      phoneExtension: null,
      address: null,
      status: overrides.status ?? ('active' as const),
      lastLoginAt: null,
    }
    const normalized = normalizeUserPatch({}, source)

    return UserModel.create({
      ...normalized,
      archivedAt: overrides.archivedAt ?? null,
      version: 1,
    })
  }

  async function get(path: string) {
    const response = await fetch(`${baseUrl}${path}`)
    const body = (await response.json()) as any
    return { response, body }
  }

  it('returns the exact default page shape and preserves health', async () => {
    await Promise.all(
      Array.from({ length: 21 }, (_, index) =>
        insertUser({
          firstName: `User${index.toString().padStart(2, '0')}`,
          email: `user${index}@example.com`,
        }),
      ),
    )

    const { response, body } = await get('/api/users')
    const health = await get('/api/health')

    assert.equal(response.status, 200)
    assert.deepEqual(Object.keys(body).sort(), ['items', 'pagination'])
    assert.equal(body.items.length, 20)
    assert.deepEqual(Object.keys(body.items[0]).sort(), [
      'address',
      'email',
      'firstName',
      'id',
      'lastLoginAt',
      'lastName',
      'phone',
      'status',
    ])
    assert.equal(body.items[0].lastLoginAt, null)
    assert.equal('version' in body.items[0], false)
    assert.deepEqual(body.pagination, {
      page: 1,
      pageSize: 20,
      total: 21,
      totalPages: 2,
    })
    assert.deepEqual(health.body, { status: 'ok' })
  })

  it('rejects unsupported page sizes and non-positive pages', async () => {
    for (const query of [
      'pageSize=37',
      'pageSize=5000',
      'page=0',
      'page=-1',
    ]) {
      const { response, body } = await get(`/api/users?${query}`)
      assert.equal(response.status, 400, query)
      assert.equal(body.error.code, 'VALIDATION_ERROR', query)
    }
  })

  it('returns an empty out-of-range page with the true totals', async () => {
    await Promise.all([insertUser(), insertUser()])

    const { response, body } = await get('/api/users?page=9')

    assert.equal(response.status, 200)
    assert.deepEqual(body.items, [])
    assert.deepEqual(body.pagination, {
      page: 9,
      pageSize: 20,
      total: 2,
      totalPages: 1,
    })
  })

  it('excludes archived users from both items and total', async () => {
    const active = await insertUser({ firstName: 'Visible' })
    await insertUser({ firstName: 'Archived', archivedAt: new Date() })

    const { body } = await get('/api/users')

    assert.equal(body.pagination.total, 1)
    assert.deepEqual(body.items.map((item: { id: string }) => item.id), [
      String(active._id),
    ])
  })

  it('rejects unknown sort fields and status values', async () => {
    for (const query of ['sort=unknown:asc', 'status=deleted', 'status=archived']) {
      const { response, body } = await get(`/api/users?${query}`)
      assert.equal(response.status, 400, query)
      assert.equal(body.error.code, 'VALIDATION_ERROR', query)
    }
  })

  it('filters by multiple statuses', async () => {
    await Promise.all([
      insertUser({ status: 'active' }),
      insertUser({ status: 'inactive' }),
      insertUser({ status: 'blocked' }),
    ])

    const { body } = await get('/api/users?status=active,blocked')
    const statuses = body.items
      .map((item: { status: string }) => item.status)
      .sort()

    assert.deepEqual(statuses, ['active', 'blocked'])
    assert.equal(body.pagination.total, 2)
  })

  it('combines folded search and status filtering for items and total', async () => {
    await Promise.all([
      insertUser({ firstName: 'Марія', status: 'active' }),
      insertUser({ firstName: 'Марія', status: 'blocked' }),
      insertUser({ firstName: 'Other', status: 'active' }),
    ])

    const search = encodeURIComponent('марія')
    const { body } = await get(`/api/users?search=${search}&status=active`)

    assert.equal(body.items.length, 1)
    assert.equal(body.items[0].firstName, 'Марія')
    assert.equal(body.pagination.total, 1)
  })
})
