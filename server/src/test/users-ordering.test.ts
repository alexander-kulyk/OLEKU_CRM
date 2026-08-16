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

describe('users ordering and stable pagination', () => {
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
    firstName?: string
    lastName?: string
    status?: 'active' | 'inactive' | 'blocked'
    lastLoginAt?: Date | null
  } = {}) {
    sequence += 1
    const source = {
      firstName: overrides.firstName ?? 'Anna',
      lastName: overrides.lastName ?? 'Smith',
      email: `ordering-${sequence}@example.com`,
      phone: null,
      phoneExtension: null,
      address: null,
      status: overrides.status ?? ('active' as const),
      lastLoginAt: overrides.lastLoginAt ?? null,
    }
    const normalized = normalizeUserPatch({}, source)
    return UserModel.create({ ...normalized, archivedAt: null, version: 1 })
  }

  async function items(query = ''): Promise<any[]> {
    const response = await fetch(`${baseUrl}/api/users${query}`)
    assert.equal(response.status, 200)
    const body = (await response.json()) as { items: any[] }
    return body.items
  }

  it('uses last name, first name, then ascending id for default ordering', async () => {
    await insertUser({ firstName: 'Zoe', lastName: 'Alpha' })
    await insertUser({ firstName: 'Anna', lastName: 'Beta' })
    const tieA = await insertUser({ firstName: 'Anna', lastName: 'Alpha' })
    const tieB = await insertUser({ firstName: 'Anna', lastName: 'Alpha' })

    const result = await items()
    const expectedTieIds = [String(tieA._id), String(tieB._id)].sort()

    assert.deepEqual(
      result.map((user) => `${user.lastName}/${user.firstName}`),
      ['Alpha/Anna', 'Alpha/Anna', 'Alpha/Zoe', 'Beta/Anna'],
    )
    assert.deepEqual(
      result.slice(0, 2).map((user) => user.id),
      expectedTieIds,
    )
  })

  it('orders statuses by rank in both directions', async () => {
    await Promise.all([
      insertUser({ status: 'blocked' }),
      insertUser({ status: 'active' }),
      insertUser({ status: 'inactive' }),
    ])

    const ascending = await items('?sort=status:asc')
    const descending = await items('?sort=status:desc')

    assert.deepEqual(
      ascending.map((user) => user.status),
      ['active', 'inactive', 'blocked'],
    )
    assert.deepEqual(
      descending.map((user) => user.status),
      ['blocked', 'inactive', 'active'],
    )
  })

  it('keeps null last-login values last in both directions', async () => {
    const oldest = await insertUser({
      lastLoginAt: new Date('2025-01-01T00:00:00.000Z'),
    })
    const newest = await insertUser({
      lastLoginAt: new Date('2026-01-01T00:00:00.000Z'),
    })
    const never = await insertUser({ lastLoginAt: null })

    const ascending = await items('?sort=lastLoginAt:asc')
    const descending = await items('?sort=lastLoginAt:desc')

    assert.deepEqual(
      ascending.map((user) => user.id),
      [String(oldest._id), String(newest._id), String(never._id)],
    )
    assert.deepEqual(
      descending.map((user) => user.id),
      [String(newest._id), String(oldest._id), String(never._id)],
    )
  })

  it('orders Cyrillic surnames alphabetically and repeats identically', async () => {
    await Promise.all([
      insertUser({ lastName: 'Іваненко' }),
      insertUser({ lastName: 'Єнот' }),
      insertUser({ lastName: 'Альфа' }),
    ])

    const first = await items('?sort=lastName:asc')
    const second = await items('?sort=lastName:asc')

    assert.deepEqual(
      first.map((user) => user.lastName),
      ['Альфа', 'Єнот', 'Іваненко'],
    )
    assert.deepEqual(
      first.map((user) => user.id),
      second.map((user) => user.id),
    )
  })

  it('pages identical names without duplication or omission', async () => {
    const created = await Promise.all(
      Array.from({ length: 45 }, () =>
        insertUser({ firstName: 'Same', lastName: 'Name' }),
      ),
    )
    const expected = created.map((user) => String(user._id)).sort()
    const observed: string[] = []

    for (const page of [1, 2, 3]) {
      const result = await items(`?page=${page}&pageSize=20`)
      observed.push(...result.map((user) => user.id))
    }

    assert.equal(new Set(observed).size, 45)
    assert.deepEqual(observed, expected)
  })
})
