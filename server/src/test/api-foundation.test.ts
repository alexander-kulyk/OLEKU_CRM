import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { Server } from 'node:http'
import express, { type Express } from 'express'
import { z } from 'zod'
import {
  startTestEnvironment,
  stopTestEnvironment,
  type TestEnvironment,
} from './support/test-environment.ts'

// Deliberately internal-looking strings a caller must never see. They stand
// in for the kind of detail a real failure can carry — a stack frame, the
// requested URL, the raw exception text, and MongoDB driver text — so the
// tests can prove none of it reaches an actual HTTP response, in line with
// specs/api-foundation/spec.md ("Error responses expose no internal
// detail").
const SYNTHETIC_STACK_MARKER =
  'at Object.<anonymous> (/definitely/not/a/real/path.ts:42:17)'
const SYNTHETIC_URL_MARKER = '/internal/definitely-secret-path'
const SYNTHETIC_DRIVER_MARKER =
  'MongoServerError: E11000 duplicate key error collection: crm.events index: email_1 dup key: { email: "leak@example.com" }'
const SYNTHETIC_RAW_MESSAGE = `boom near ${SYNTHETIC_URL_MARKER} — ${SYNTHETIC_DRIVER_MARKER}`

function listen(app: Express): Promise<{ server: Server; baseUrl: string }> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0)

    server.once('error', reject)
    server.once('listening', () => {
      const address = server.address()

      if (address === null || typeof address === 'string') {
        reject(new Error('expected the test server to report a network address'))
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

function assertExactErrorKeys(error: Record<string, unknown>): void {
  const expectedKeys = ['code', 'message']

  if ('field' in error) {
    expectedKeys.push('field')
  }

  assert.deepEqual(Object.keys(error).sort(), expectedKeys.sort())
}

describe('shared HTTP terminal behavior', () => {
  let testEnvironment: TestEnvironment

  let appServer: Server
  let appBaseUrl: string

  let probeServer: Server
  let probeBaseUrl: string

  before(async () => {
    // Per design.md D10: DB_HOST must point at the disposable in-memory
    // database before anything that reaches env.ts is imported — including
    // app.ts, which every scenario below (directly or via the probe app's
    // reuse of the same shared middleware) depends on.
    testEnvironment = await startTestEnvironment()

    const { createApp } = await import('../app.ts')
    const { HttpError } = await import('../shared/http/error-envelope.ts')
    const { notFoundHandler } = await import(
      '../shared/http/not-found-handler.ts'
    )
    const { errorMiddleware } = await import(
      '../shared/http/error-middleware.ts'
    )
    const { validate } = await import('../shared/http/validate.ts')

    // The real, production-assembled app: exercises GET /api/health and the
    // unknown-route case end to end.
    ;({ server: appServer, baseUrl: appBaseUrl } = await listen(createApp()))

    // No feature route validates or throws yet (directory and event
    // modules land in later Stages), so a small probe app reuses the exact
    // same shared building blocks — validate(), HttpError, and both
    // terminal handlers — to exercise the validation, typed-failure, and
    // internal-failure paths that a real feature route will hit later.
    const probeSchema = z.strictObject({ value: z.string().min(1) })

    const probeApp = express()

    probeApp.get('/probe/validate', (req, res) => {
      // Express 5's `query` is a getter with no setter (it reparses
      // `req.url` on every read — see express/lib/request.js). If
      // validate() ever attempted `req.query = parsed`, that assignment
      // would throw synchronously in this strict ESM module, and the
      // request would fail with 500 instead of returning the parsed value
      // below — so a 200 here is itself evidence validate() never assigns
      // to req.query (design.md D2).
      const parsed = validate(probeSchema, req.query)
      res.json(parsed)
    })

    probeApp.get('/probe/not-found', () => {
      throw new HttpError('NOT_FOUND', 'The requested widget does not exist.')
    })

    probeApp.get('/probe/invalid-participant', () => {
      throw new HttpError(
        'INVALID_PARTICIPANT',
        'That person cannot be assigned to this event.',
      )
    })

    probeApp.get('/probe/field-error', () => {
      throw new HttpError(
        'EMAIL_ALREADY_EXISTS',
        'That email address is already in use.',
        'email',
      )
    })

    probeApp.get('/probe/internal', () => {
      const failure = new Error(SYNTHETIC_RAW_MESSAGE)
      failure.stack = `Error: ${SYNTHETIC_RAW_MESSAGE}\n    ${SYNTHETIC_STACK_MARKER}`
      throw failure
    })

    probeApp.use(notFoundHandler)
    probeApp.use(errorMiddleware)
    ;({ server: probeServer, baseUrl: probeBaseUrl } = await listen(probeApp))
  })

  after(async () => {
    await Promise.all([closeServer(appServer), closeServer(probeServer)])
    await stopTestEnvironment(testEnvironment)
  })

  it('GET /api/health returns the exact preserved payload', async () => {
    const response = await fetch(`${appBaseUrl}/api/health`)
    const body = await response.json()

    assert.equal(response.status, 200)
    assert.deepEqual(body, { status: 'ok' })
  })

  it('an unknown route returns the exact NOT_FOUND envelope without reflecting the request', async () => {
    const secretPath = '/api/this-route-does-not-exist'
    const secretQuery = 'super-secret-token=abc123'

    const response = await fetch(`${appBaseUrl}${secretPath}?${secretQuery}`)
    const rawBody = await response.text()
    const body = JSON.parse(rawBody) as {
      error: { code: string; message: string }
    }

    assert.equal(response.status, 404)
    assert.deepEqual(Object.keys(body), ['error'])
    assertExactErrorKeys(body.error)
    assert.equal(body.error.code, 'NOT_FOUND')
    assert.equal(typeof body.error.message, 'string')
    assert.ok(body.error.message.length > 0)

    assert.ok(!rawBody.includes('this-route-does-not-exist'))
    assert.ok(!rawBody.includes('super-secret-token'))
    assert.ok(!rawBody.includes(secretPath))
  })

  it('validate() returns the parsed value to the handler and never assigns to req.query', async () => {
    const response = await fetch(`${probeBaseUrl}/probe/validate?value=hello`)
    const body = await response.json()

    assert.equal(response.status, 200)
    assert.deepEqual(body, { value: 'hello' })
  })

  it('a Zod validation failure returns the exact VALIDATION_ERROR envelope', async () => {
    // Omits the required `value` query parameter.
    const response = await fetch(`${probeBaseUrl}/probe/validate`)
    const body = (await response.json()) as {
      error: { code: string; message: string }
    }

    assert.equal(response.status, 400)
    assert.deepEqual(Object.keys(body), ['error'])
    assertExactErrorKeys(body.error)
    assert.equal(body.error.code, 'VALIDATION_ERROR')
    assert.equal(typeof body.error.message, 'string')
    assert.ok(body.error.message.length > 0)
  })

  it('an unknown request member maps to UNKNOWN_FIELD', async () => {
    const response = await fetch(
      `${probeBaseUrl}/probe/validate?value=hello&unexpected=true`,
    )
    const body = (await response.json()) as {
      error: Record<string, unknown> & { code: string }
    }

    assert.equal(response.status, 400)
    assert.deepEqual(Object.keys(body), ['error'])
    assertExactErrorKeys(body.error)
    assert.equal(body.error.code, 'UNKNOWN_FIELD')
    assert.equal(body.error.field, 'unexpected')
  })

  it('multiple unknown request members omit field', async () => {
    const response = await fetch(
      `${probeBaseUrl}/probe/validate?value=hello&first=true&second=true`,
    )
    const body = (await response.json()) as {
      error: Record<string, unknown> & { code: string; field?: string }
    }

    assert.equal(response.status, 400)
    assert.deepEqual(Object.keys(body), ['error'])
    assertExactErrorKeys(body.error)
    assert.equal(body.error.code, 'UNKNOWN_FIELD')
    assert.equal(body.error.field, undefined)
  })

  it('a single-field validation failure identifies its field', async () => {
    const response = await fetch(`${probeBaseUrl}/probe/validate?value=`)
    const body = (await response.json()) as {
      error: Record<string, unknown> & { code: string; field?: string }
    }

    assert.equal(response.status, 400)
    assert.deepEqual(Object.keys(body), ['error'])
    assertExactErrorKeys(body.error)
    assert.equal(body.error.code, 'VALIDATION_ERROR')
    assert.equal(body.error.field, 'value')
  })

  it('a typed field error includes only code, message, and field', async () => {
    const response = await fetch(`${probeBaseUrl}/probe/field-error`)
    const body = (await response.json()) as {
      error: Record<string, unknown> & {
        code: string
        message: string
        field?: string
      }
    }

    assert.equal(response.status, 409)
    assert.deepEqual(Object.keys(body), ['error'])
    assertExactErrorKeys(body.error)
    assert.deepEqual(body.error, {
      code: 'EMAIL_ALREADY_EXISTS',
      message: 'That email address is already in use.',
      field: 'email',
    })
  })

  it('a typed NOT_FOUND domain failure maps to its exact envelope and status', async () => {
    const response = await fetch(`${probeBaseUrl}/probe/not-found`)
    const body = await response.json()

    assert.equal(response.status, 404)
    assert.deepEqual(body, {
      error: {
        code: 'NOT_FOUND',
        message: 'The requested widget does not exist.',
      },
    })
  })

  it('a typed INVALID_PARTICIPANT domain failure maps to its exact envelope and status', async () => {
    const response = await fetch(`${probeBaseUrl}/probe/invalid-participant`)
    const body = await response.json()

    assert.equal(response.status, 400)
    assert.deepEqual(body, {
      error: {
        code: 'INVALID_PARTICIPANT',
        message: 'That person cannot be assigned to this event.',
      },
    })
  })

  it('a synthetic internal failure never leaks its stack, URL, message, or driver text', async () => {
    const response = await fetch(`${probeBaseUrl}/probe/internal`)
    const rawBody = await response.text()
    const body = JSON.parse(rawBody) as {
      error: { code: string; message: string }
    }

    assert.equal(response.status, 500)
    assert.deepEqual(Object.keys(body), ['error'])
    assertExactErrorKeys(body.error)
    assert.equal(body.error.code, 'INTERNAL_ERROR')
    assert.notEqual(body.error.message, SYNTHETIC_RAW_MESSAGE)

    assert.ok(!rawBody.includes(SYNTHETIC_STACK_MARKER))
    assert.ok(!rawBody.includes('.ts:42:17'))
    assert.ok(!rawBody.includes(SYNTHETIC_URL_MARKER))
    assert.ok(!rawBody.includes(SYNTHETIC_DRIVER_MARKER))
    assert.ok(!rawBody.includes('MongoServerError'))
    assert.ok(!rawBody.includes(SYNTHETIC_RAW_MESSAGE))
    assert.ok(!rawBody.includes('/probe/internal'))
  })
})
