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

describe('users update API', () => {
  let testEnvironment: TestEnvironment
  let server: Server
  let baseUrl: string
  let UserModel: UserModelModule['UserModel']
  let normalizeUserPatch: NormalizationModule['normalizeUserPatch']
  let sequence = 0

  before(async () => {
    testEnvironment = await startTestEnvironment()
    const { connectToMongo } = await import('../shared/infra/mongoose/client.ts')
    await connectToMongo()
    ;({ UserModel } = await import('../modules/users/user.model.ts'))
    ;({ normalizeUserPatch } = await import('../modules/users/user-normalization.ts'))
    await UserModel.collection.createIndex(
      { emailNormalized: 1 },
      { unique: true, name: 'users_email_normalized_unique' },
    )
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
    email?: string
    version?: number
    archivedAt?: Date | null
  } = {}) {
    sequence += 1
    const source = {
      firstName: 'Original',
      lastName: 'Person',
      email: overrides.email ?? `update-${sequence}@example.com`,
      phone: '+380501234567',
      phoneExtension: '42',
      address: {
        country: 'Ukraine',
        city: 'Kyiv',
        street: 'Main',
        postalCode: '01001',
      },
      status: 'active' as const,
      lastLoginAt: null,
    }
    const normalized = normalizeUserPatch({}, source)
    return UserModel.create({
      ...normalized,
      archivedAt: overrides.archivedAt ?? null,
      version: overrides.version ?? 7,
    })
  }

  async function request(
    userId: unknown,
    body: unknown,
    contentType = 'application/json',
  ) {
    const response = await fetch(`${baseUrl}/api/users/${userId}`, {
      method: 'PATCH',
      headers: { 'content-type': contentType },
      body: JSON.stringify(body),
    })
    const raw = await response.text()
    return { response, body: raw ? JSON.parse(raw) : undefined }
  }

  it('applies merge semantics, trims names, and increments version once per write', async () => {
    const user = await insertUser()
    let result = await request(user._id, { firstName: 'Anna ', version: 7 })
    assert.equal(result.response.status, 200)
    assert.equal(result.body.firstName, 'Anna')
    assert.equal(result.body.lastName, 'Person')
    assert.equal(result.body.phone, '+380501234567')
    assert.equal(result.body.version, 8)

    result = await request(user._id, { phone: null, version: 8 })
    assert.equal(result.body.phone, null)

    result = await request(user._id, { address: { city: 'Lviv' }, version: 9 })
    assert.deepEqual(result.body.address, {
      country: 'Ukraine', city: 'Lviv', street: 'Main', postalCode: '01001',
    })

    result = await request(user._id, {
      address: { postalCode: null }, version: 10,
    })
    assert.deepEqual(result.body.address, {
      country: 'Ukraine', city: 'Lviv', street: 'Main',
    })

    result = await request(user._id, {
      address: {}, status: 'inactive', version: 11,
    })
    assert.equal(result.body.status, 'inactive')
    assert.deepEqual(result.body.address, {
      country: 'Ukraine', city: 'Lviv', street: 'Main',
    })

    result = await request(user._id, { address: null, version: 12 })
    assert.equal(result.body.address, null)
    assert.equal(result.body.version, 13)

    const detail = await fetch(`${baseUrl}/api/users/${user._id}`).then((r) => r.json()) as any
    assert.equal(detail.version, 13)
  })

  it('rejects invalid, version-only, and unknown-field patches atomically', async () => {
    const user = await insertUser()
    const invalid = await request(user._id, { firstName: '', version: 7 })
    assert.equal(invalid.response.status, 400)
    assert.equal(invalid.body.error.code, 'VALIDATION_ERROR')
    assert.equal(invalid.body.error.field, 'firstName')

    const noChanges = await request(user._id, { version: 7 })
    assert.equal(noChanges.response.status, 400)
    assert.equal(noChanges.body.error.code, 'NO_CHANGES_SUBMITTED')

    const unknown = await request(user._id, {
      firstName: 'ShouldNotApply', createdAt: 'forged', version: 7,
    })
    assert.equal(unknown.response.status, 400)
    assert.equal(unknown.body.error.code, 'UNKNOWN_FIELD')

    const stored = await UserModel.findById(user._id).lean()
    assert.equal(stored?.firstName, 'Original')
    assert.equal(stored?.version, 7)
  })

  it('accepts JSON and merge-patch media types identically', async () => {
    const jsonUser = await insertUser()
    const mergeUser = await insertUser()
    const json = await request(jsonUser._id, { firstName: 'Anna', version: 7 })
    const merge = await request(
      mergeUser._id,
      { firstName: 'Anna', version: 7 },
      'application/merge-patch+json',
    )

    assert.equal(json.response.status, 200)
    assert.equal(merge.response.status, 200)
    assert.equal(json.body.firstName, merge.body.firstName)
    assert.equal(json.body.version, merge.body.version)
  })

  it('rejects a stale version without overwriting the winning write', async () => {
    const user = await insertUser()
    const results = await Promise.all([
      request(user._id, { firstName: 'First', version: 7 }),
      request(user._id, { firstName: 'Second', version: 7 }),
    ])
    const winner = results.find((result) => result.response.status === 200)
    const loser = results.find((result) => result.response.status === 409)

    assert.ok(winner)
    assert.equal(loser?.body.error.code, 'USER_VERSION_CONFLICT')
    const stored = await UserModel.findById(user._id).lean()
    assert.equal(stored?.firstName, winner.body.firstName)
    assert.equal(stored?.version, 8)
  })

  it('returns USER_ARCHIVED when archive wins before an update', async () => {
    const user = await insertUser()
    await UserModel.updateOne({ _id: user._id }, { $set: { archivedAt: new Date() } })

    const result = await request(user._id, { firstName: 'Changed', version: 7 })

    assert.equal(result.response.status, 409)
    assert.equal(result.body.error.code, 'USER_ARCHIVED')
    const stored = await UserModel.findById(user._id).lean()
    assert.equal(stored?.firstName, 'Original')
  })

  it('translates active and archived duplicate-email owners', async () => {
    await insertUser({ email: 'anna@example.com' })
    const target = await insertUser()
    const active = await request(target._id, {
      email: ' ANNA@example.com ', version: 7,
    })
    assert.equal(active.response.status, 409)
    assert.equal(active.body.error.code, 'EMAIL_ALREADY_EXISTS')
    assert.equal(active.body.error.field, 'email')

    await UserModel.updateOne(
      { emailNormalized: 'anna@example.com' },
      { $set: { archivedAt: new Date() } },
    )
    const archived = await request(target._id, {
      email: 'anna@example.com', version: 7,
    })
    assert.equal(archived.body.error.code, 'EMAIL_TAKEN_BY_ARCHIVED_USER')
  })

  it('keeps dots and plus suffixes as distinct email addresses', async () => {
    await insertUser({ email: 'anna.smith@example.com' })
    const first = await insertUser()
    const second = await insertUser()

    const withoutDot = await request(first._id, {
      email: 'annasmith@example.com', version: 7,
    })
    const withSuffix = await request(second._id, {
      email: 'anna.smith+crm@example.com', version: 7,
    })

    assert.equal(withoutDot.response.status, 200)
    assert.equal(withSuffix.response.status, 200)
  })

  it('allows exactly one concurrent claim of a new email without a 500', async () => {
    for (let run = 0; run < 3; run += 1) {
      const first = await insertUser()
      const second = await insertUser()
      const email = `shared-${run}@example.com`
      const results = await Promise.all([
        request(first._id, { email, version: 7 }),
        request(second._id, { email, version: 7 }),
      ])
      const statuses = results.map((result) => result.response.status).sort()

      assert.deepEqual(statuses, [200, 409])
      assert.equal(results.some((result) => result.response.status === 500), false)
      assert.equal(
        results.find((result) => result.response.status === 409)?.body.error.code,
        'EMAIL_ALREADY_EXISTS',
      )
    }
  })

  it('refreshes derived search keys in the successful conditional update', async () => {
    const user = await insertUser({ email: 'old@example.com' })
    const result = await request(user._id, {
      firstName: 'Fresh', lastName: 'Identity', email: 'fresh@example.com', version: 7,
    })
    assert.equal(result.response.status, 200)

    const fresh = await fetch(`${baseUrl}/api/users?search=fresh%20identity`).then((r) => r.json()) as any
    const old = await fetch(`${baseUrl}/api/users?search=old@example`).then((r) => r.json()) as any
    assert.deepEqual(fresh.items.map((item: any) => item.id), [String(user._id)])
    assert.deepEqual(old.items, [])
  })
})
