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

describe('users search', () => {
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
    email?: string
    phone?: string | null
  } = {}) {
    sequence += 1
    const source = {
      firstName: overrides.firstName ?? 'Other',
      lastName: overrides.lastName ?? 'Person',
      email: overrides.email ?? `search-${sequence}@example.com`,
      phone: overrides.phone ?? null,
      phoneExtension: null,
      address: null,
      status: 'active' as const,
      lastLoginAt: null,
    }
    const normalized = normalizeUserPatch({}, source)
    return UserModel.create({ ...normalized, archivedAt: null, version: 1 })
  }

  async function search(term: string): Promise<any[]> {
    const response = await fetch(
      `${baseUrl}/api/users?search=${encodeURIComponent(term)}`,
    )
    assert.equal(response.status, 200)
    const body = (await response.json()) as { items: any[] }
    return body.items
  }

  it('matches full names in first-last and last-first order', async () => {
    const user = await insertUser({ firstName: 'Anna', lastName: 'Smith' })

    for (const term of ['anna smith', 'smith anna']) {
      const result = await search(term)
      assert.deepEqual(result.map((item) => item.id), [String(user._id)])
    }
  })

  it('matches Cyrillic case-insensitively through folded keys', async () => {
    const user = await insertUser({ firstName: 'Марія' })
    const result = await search('марія')

    assert.deepEqual(result.map((item) => item.id), [String(user._id)])
  })

  it('matches Latin names without requiring the stored diacritic', async () => {
    const user = await insertUser({ lastName: 'Sánchez' })
    const result = await search('sanchez')

    assert.deepEqual(result.map((item) => item.id), [String(user._id)])
  })

  it('matches a normalized email prefix', async () => {
    const user = await insertUser({ email: 'Anna.Smith@Example.com' })
    const result = await search('anna.smith@example')

    assert.deepEqual(result.map((item) => item.id), [String(user._id)])
  })

  it('finds one E.164 phone through international and national formats', async () => {
    const user = await insertUser({ phone: '+380501234567' })

    for (const term of [
      '+38 (050) 123-45-67',
      '050 123 45 67',
      '0501234567',
    ]) {
      const result = await search(term)
      assert.deepEqual(result.map((item) => item.id), [String(user._id)])
    }
  })

  it('escapes regex metacharacters and returns promptly', { timeout: 1_000 }, async () => {
    const dotStar = await insertUser({ firstName: '.*Literal' })
    const nested = await insertUser({ firstName: '(a+)+Literal' })

    const dotStarResult = await search('.*')
    const nestedResult = await search('(a+)+')

    assert.deepEqual(dotStarResult.map((item) => item.id), [String(dotStar._id)])
    assert.deepEqual(nestedResult.map((item) => item.id), [String(nested._id)])
  })
})
