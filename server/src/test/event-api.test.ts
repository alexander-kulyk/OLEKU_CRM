import { after, before, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { Server } from 'node:http'
import type { Express } from 'express'
import {
  startTestEnvironment,
  stopTestEnvironment,
  type TestEnvironment,
} from './support/test-environment.ts'

// This file proves the event-api.spec.md requirements Stage 5 already
// covered at the service layer (event-service.test.ts, event-schema.test.ts)
// also hold end to end through the actual HTTP routes wired in this Stage:
// exact route names, query names, wrappers, projections, status codes, and
// error codes (tasks.md 6.5-6.7).

const START = '2026-08-09T09:00:00Z'
const END = '2026-08-09T10:00:00Z'
const UNKNOWN_ID = '64f1b2c3d4e5f6a7b8c9d0e1'

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

interface HttpResponse {
  status: number
  body: any
  rawText: string
}

async function request(
  baseUrl: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<HttpResponse> {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  const rawText = await response.text()
  const parsedBody = rawText.length > 0 ? JSON.parse(rawText) : undefined

  return { status: response.status, body: parsedBody, rawText }
}

function getJson(baseUrl: string, path: string): Promise<HttpResponse> {
  return request(baseUrl, 'GET', path)
}

function postJson(baseUrl: string, path: string, body: unknown): Promise<HttpResponse> {
  return request(baseUrl, 'POST', path, body)
}

function patchJson(baseUrl: string, path: string, body: unknown): Promise<HttpResponse> {
  return request(baseUrl, 'PATCH', path, body)
}

function deleteRequest(baseUrl: string, path: string): Promise<HttpResponse> {
  return request(baseUrl, 'DELETE', path)
}

describe('event API (GET/POST/PATCH/DELETE /api/events)', () => {
  let testEnvironment: TestEnvironment

  let appServer: Server
  let baseUrl: string

  let ContactModel: (typeof import('../modules/directory/contact.model.ts'))['ContactModel']
  let EmployeeModel: (typeof import('../modules/directory/employee.model.ts'))['EmployeeModel']
  let EventModel: (typeof import('../modules/events/event.model.ts'))['EventModel']

  before(async () => {
    // Per design.md D10: DB_HOST must point at the disposable in-memory
    // database before anything that reaches env.ts — including app.ts and
    // every model below — is imported.
    testEnvironment = await startTestEnvironment()

    const { connectToMongo } = await import('../shared/infra/mongoose/client.ts')
    await connectToMongo()

    ;({ ContactModel } = await import('../modules/directory/contact.model.ts'))
    ;({ EmployeeModel } = await import('../modules/directory/employee.model.ts'))
    ;({ EventModel } = await import('../modules/events/event.model.ts'))

    const { createApp } = await import('../app.ts')
    ;({ server: appServer, baseUrl } = await listen(createApp()))
  })

  after(async () => {
    await closeServer(appServer)
    await stopTestEnvironment(testEnvironment)
  })

  // Every scenario starts from empty collections so counts and exact-shape
  // assertions never depend on another test's fixtures.
  beforeEach(async () => {
    await Promise.all([
      ContactModel.deleteMany({}),
      EmployeeModel.deleteMany({}),
      EventModel.deleteMany({}),
    ])
  })

  let uniqueSeq = 0
  function nextSeq(): number {
    uniqueSeq += 1
    return uniqueSeq
  }

  interface ContactOverrides {
    firstName?: string
    lastName?: string
    email?: string
    status?: 'active' | 'inactive'
  }

  interface EmployeeOverrides extends ContactOverrides {
    canHostEvents?: boolean
  }

  function insertContact(overrides: ContactOverrides = {}) {
    const seq = nextSeq()
    return ContactModel.create({
      firstName: overrides.firstName ?? `First${seq}`,
      lastName: overrides.lastName ?? `Last${seq}`,
      email: overrides.email ?? `contact${seq}@example.test`,
      status: overrides.status ?? 'active',
    })
  }

  function insertEmployee(overrides: EmployeeOverrides = {}) {
    const seq = nextSeq()
    return EmployeeModel.create({
      firstName: overrides.firstName ?? `First${seq}`,
      lastName: overrides.lastName ?? `Last${seq}`,
      email: overrides.email ?? `employee${seq}@example.test`,
      status: overrides.status ?? 'active',
      position: 'Tester',
      department: 'QA',
      canHostEvents: overrides.canHostEvents ?? false,
    })
  }

  function validCreateBody(overrides: Record<string, unknown> = {}) {
    return {
      title: 'Untitled event',
      startAt: START,
      endAt: END,
      ...overrides,
    }
  }

  async function createViaApi(overrides: Record<string, unknown> = {}) {
    const response = await postJson(baseUrl, '/api/events', validCreateBody(overrides))
    assert.equal(
      response.status,
      201,
      `expected create to succeed, got ${response.status}: ${response.rawText}`,
    )
    return response.body
  }

  describe('calendar reads use an exact bounded route', () => {
    it('returns 200 with { events: [...] } and includes an event overlapping the requested period', async () => {
      const created = await createViaApi({ title: 'Overlapping event' })

      const { status, body } = await getJson(
        baseUrl,
        `/api/events?${new URLSearchParams({
          from: '2026-08-09T08:30:00Z',
          to: '2026-08-09T09:30:00Z',
        })}`,
      )

      assert.equal(status, 200)
      assert.deepEqual(Object.keys(body), ['events'])
      assert.ok(body.events.some((event: { id: string }) => event.id === created.id))
    })

    it('excludes events whose boundary only touches the requested period', async () => {
      // Ends exactly at "from"
      await createViaApi({
        title: 'Ends at from',
        startAt: '2026-08-09T08:00:00Z',
        endAt: '2026-08-09T09:00:00Z',
      })
      // Starts exactly at "to"
      await createViaApi({
        title: 'Starts at to',
        startAt: '2026-08-09T10:00:00Z',
        endAt: '2026-08-09T11:00:00Z',
      })

      const { status, body } = await getJson(
        baseUrl,
        `/api/events?${new URLSearchParams({
          from: '2026-08-09T09:00:00Z',
          to: '2026-08-09T10:00:00Z',
        })}`,
      )

      assert.equal(status, 200)
      assert.deepEqual(body.events, [])
    })

    it('rejects a request missing from or to with VALIDATION_ERROR', async () => {
      const missingFrom = await getJson(baseUrl, '/api/events?to=2026-08-09T10:00:00Z')
      const missingTo = await getJson(baseUrl, '/api/events?from=2026-08-09T09:00:00Z')
      const missingBoth = await getJson(baseUrl, '/api/events')

      for (const response of [missingFrom, missingTo, missingBoth]) {
        assert.equal(response.status, 400)
        assert.equal(response.body.error.code, 'VALIDATION_ERROR')
      }
    })

    it('rejects an inverted or zero-length period with VALIDATION_ERROR', async () => {
      const inverted = await getJson(
        baseUrl,
        `/api/events?${new URLSearchParams({
          from: '2026-08-09T10:00:00Z',
          to: '2026-08-09T09:00:00Z',
        })}`,
      )
      const zeroLength = await getJson(
        baseUrl,
        `/api/events?${new URLSearchParams({
          from: '2026-08-09T09:00:00Z',
          to: '2026-08-09T09:00:00Z',
        })}`,
      )

      assert.equal(inverted.status, 400)
      assert.equal(inverted.body.error.code, 'VALIDATION_ERROR')
      assert.equal(zeroLength.status, 400)
      assert.equal(zeroLength.body.error.code, 'VALIDATION_ERROR')
    })
  })

  describe('accepted instants are zone-explicit absolute moments', () => {
    it('a numeric-offset period and its Z-equivalent period return the same event identifiers', async () => {
      const created = await createViaApi({ title: 'Offset equivalence' })

      const zPeriod = await getJson(
        baseUrl,
        `/api/events?${new URLSearchParams({
          from: '2026-08-09T08:30:00Z',
          to: '2026-08-09T10:30:00Z',
        })}`,
      )
      // The same absolute moments as above, expressed with a +03:00 offset.
      const offsetPeriod = await getJson(
        baseUrl,
        `/api/events?${new URLSearchParams({
          from: '2026-08-09T11:30:00+03:00',
          to: '2026-08-09T13:30:00+03:00',
        })}`,
      )

      assert.equal(zPeriod.status, 200)
      assert.equal(offsetPeriod.status, 200)

      const zIds = zPeriod.body.events.map((event: { id: string }) => event.id).sort()
      const offsetIds = offsetPeriod.body.events.map((event: { id: string }) => event.id).sort()

      assert.deepEqual(zIds, offsetIds)
      assert.ok(zIds.includes(created.id))
    })

    it('accepts a numeric-offset startAt/endAt on create as the same moment as its Z equivalent', async () => {
      const created = await postJson(
        baseUrl,
        '/api/events',
        // 2026-08-09T13:00:00+03:00 is the same absolute moment as
        // 2026-08-09T10:00:00Z — one hour after the Z-suffixed startAt.
        validCreateBody({ startAt: '2026-08-09T09:00:00Z', endAt: '2026-08-09T13:00:00+03:00' }),
      )

      assert.equal(created.status, 201, `expected create to succeed, got ${created.status}: ${created.rawText}`)
      assert.equal(created.body.startAt, new Date('2026-08-09T09:00:00Z').toISOString())
      assert.equal(created.body.endAt, new Date('2026-08-09T13:00:00+03:00').toISOString())
    })

    it('rejects a date-only or zone-less from/to on the calendar read with VALIDATION_ERROR', async () => {
      const dateOnly = await getJson(
        baseUrl,
        `/api/events?${new URLSearchParams({ from: '2026-08-09', to: '2026-08-10' })}`,
      )
      const zoneLess = await getJson(
        baseUrl,
        `/api/events?${new URLSearchParams({
          from: '2026-08-09T09:00:00',
          to: '2026-08-09T10:00:00',
        })}`,
      )

      assert.equal(dateOnly.status, 400)
      assert.equal(dateOnly.body.error.code, 'VALIDATION_ERROR')
      assert.equal(zoneLess.status, 400)
      assert.equal(zoneLess.body.error.code, 'VALIDATION_ERROR')
    })

    it('rejects a date-only or zone-less startAt/endAt on create with VALIDATION_ERROR', async () => {
      const dateOnly = await postJson(baseUrl, '/api/events', validCreateBody({ startAt: '2026-08-09' }))
      const zoneLess = await postJson(
        baseUrl,
        '/api/events',
        validCreateBody({ endAt: '2026-08-09T10:00:00' }),
      )

      assert.equal(dateOnly.status, 400)
      assert.equal(dateOnly.body.error.code, 'VALIDATION_ERROR')
      assert.equal(zoneLess.status, 400)
      assert.equal(zoneLess.body.error.code, 'VALIDATION_ERROR')
      assert.equal(await EventModel.countDocuments(), 0)
    })
  })

  describe('returned events use the domain payload', () => {
    it('exposes exactly id, title, startAt, endAt, attendees, hosts with resolved participants', async () => {
      const attendee = await insertContact({ firstName: 'Ada', lastName: 'Lovelace' })
      const host = await insertEmployee({ firstName: 'Grace', lastName: 'Hopper', canHostEvents: true })

      const created = await createViaApi({
        title: 'Full shape check',
        attendeeIds: [String(attendee._id)],
        hostIds: [String(host._id)],
      })

      assert.deepEqual(Object.keys(created).sort(), ['attendees', 'endAt', 'hosts', 'id', 'startAt', 'title'])
      assert.equal(typeof created.id, 'string')
      assert.match(created.startAt, /Z$/)
      assert.match(created.endAt, /Z$/)
      assert.deepEqual(created.attendees, [
        { id: String(attendee._id), firstName: 'Ada', lastName: 'Lovelace', fullName: 'Ada Lovelace' },
      ])
      assert.deepEqual(created.hosts, [
        { id: String(host._id), firstName: 'Grace', lastName: 'Hopper', fullName: 'Grace Hopper' },
      ])
    })
  })

  describe('events can be created', () => {
    it('returns 201 with the created event directly, and a covering calendar read returns it', async () => {
      const response = await postJson(baseUrl, '/api/events', validCreateBody({ title: 'Valid create' }))

      assert.equal(response.status, 201)
      assert.ok(!('events' in response.body))
      assert.ok(!('error' in response.body))
      assert.equal(response.body.title, 'Valid create')
      assert.equal(typeof response.body.id, 'string')

      const read = await getJson(
        baseUrl,
        `/api/events?${new URLSearchParams({
          from: '2026-08-09T08:00:00Z',
          to: '2026-08-09T11:00:00Z',
        })}`,
      )
      assert.ok(read.body.events.some((event: { id: string }) => event.id === response.body.id))
    })

    it('defaults both participant arrays to empty when omitted', async () => {
      const created = await createViaApi()

      assert.deepEqual(created.attendees, [])
      assert.deepEqual(created.hosts, [])
    })
  })

  describe('event titles are meaningful', () => {
    it('rejects a whitespace-only title on create with VALIDATION_ERROR and creates nothing', async () => {
      const response = await postJson(baseUrl, '/api/events', validCreateBody({ title: '   ' }))

      assert.equal(response.status, 400)
      assert.equal(response.body.error.code, 'VALIDATION_ERROR')
      assert.equal(await EventModel.countDocuments(), 0)
    })

    it('rejects a whitespace-only title on PATCH with VALIDATION_ERROR and leaves the event unchanged', async () => {
      const created = await createViaApi({ title: 'Original title' })

      const response = await patchJson(baseUrl, `/api/events/${created.id}`, { title: '   ' })

      assert.equal(response.status, 400)
      assert.equal(response.body.error.code, 'VALIDATION_ERROR')

      const stored = await EventModel.findById(created.id).lean()
      assert.equal(stored?.title, 'Original title')
    })

    it('trims a padded title on create', async () => {
      const created = await createViaApi({ title: '  Padded  ' })

      assert.equal(created.title, 'Padded')
    })

    it('trims a padded title on PATCH', async () => {
      const created = await createViaApi({ title: 'Original' })

      const response = await patchJson(baseUrl, `/api/events/${created.id}`, {
        title: '  Padded via PATCH  ',
      })

      assert.equal(response.status, 200)
      assert.equal(response.body.title, 'Padded via PATCH')
    })
  })

  describe('end is strictly later than start', () => {
    it('rejects create when end is equal to or earlier than start, creating nothing', async () => {
      const equalResponse = await postJson(
        baseUrl,
        '/api/events',
        validCreateBody({ startAt: START, endAt: START }),
      )
      const invertedResponse = await postJson(
        baseUrl,
        '/api/events',
        validCreateBody({ startAt: END, endAt: START }),
      )

      assert.equal(equalResponse.status, 400)
      assert.equal(equalResponse.body.error.code, 'VALIDATION_ERROR')
      assert.equal(invertedResponse.status, 400)
      assert.equal(invertedResponse.body.error.code, 'VALIDATION_ERROR')
      assert.equal(await EventModel.countDocuments(), 0)
    })

    it('rejects a PATCH that would invert the merged span, leaving the stored event unchanged', async () => {
      const created = await createViaApi()

      const response = await patchJson(baseUrl, `/api/events/${created.id}`, { endAt: START })

      assert.equal(response.status, 400)
      assert.equal(response.body.error.code, 'VALIDATION_ERROR')

      const stored = await EventModel.findById(created.id).lean()
      assert.equal(stored?.startAt.toISOString(), new Date(START).toISOString())
      assert.equal(stored?.endAt.toISOString(), new Date(END).toISOString())
    })
  })

  describe('PATCH updates only supplied fields', () => {
    it('changes only the title, leaving instants and participants unchanged', async () => {
      const attendee = await insertContact()
      const created = await createViaApi({ attendeeIds: [String(attendee._id)] })

      const response = await patchJson(baseUrl, `/api/events/${created.id}`, { title: 'Title only' })

      assert.equal(response.status, 200)
      assert.ok(!('events' in response.body))
      assert.ok(!('error' in response.body))
      assert.equal(response.body.title, 'Title only')
      assert.equal(response.body.startAt, created.startAt)
      assert.equal(response.body.endAt, created.endAt)
      assert.deepEqual(response.body.attendees, created.attendees)
    })

    it('replaces the attendee set entirely when a new array is supplied (set replacement, not merge)', async () => {
      const a = await insertContact()
      const b = await insertContact()
      const c = await insertContact()
      const created = await createViaApi({ attendeeIds: [String(a._id), String(b._id)] })

      const response = await patchJson(baseUrl, `/api/events/${created.id}`, {
        attendeeIds: [String(b._id), String(c._id)],
      })

      assert.equal(response.status, 200)
      assert.deepEqual(
        response.body.attendees.map((person: { id: string }) => person.id).sort(),
        [String(b._id), String(c._id)].sort(),
      )
    })

    it('clears every host assignment when PATCH supplies an explicit empty hostIds array', async () => {
      const host = await insertEmployee({ canHostEvents: true })
      const created = await createViaApi({ hostIds: [String(host._id)] })

      const response = await patchJson(baseUrl, `/api/events/${created.id}`, { hostIds: [] })

      assert.equal(response.status, 200)
      assert.deepEqual(response.body.hosts, [])
    })

    it('rejects an empty PATCH body with VALIDATION_ERROR', async () => {
      const created = await createViaApi()

      const response = await patchJson(baseUrl, `/api/events/${created.id}`, {})

      assert.equal(response.status, 400)
      assert.equal(response.body.error.code, 'VALIDATION_ERROR')
    })

    it('returns 404 NOT_FOUND when PATCH targets a well-formed id matching no event', async () => {
      const response = await patchJson(baseUrl, `/api/events/${UNKNOWN_ID}`, { title: 'Anything' })

      assert.equal(response.status, 404)
      assert.equal(response.body.error.code, 'NOT_FOUND')
    })
  })

  describe('new participant assignments must be valid', () => {
    it('rejects an unknown participant id newly assigned with INVALID_PARTICIPANT', async () => {
      const response = await postJson(baseUrl, '/api/events', validCreateBody({ attendeeIds: [UNKNOWN_ID] }))

      assert.equal(response.status, 400)
      assert.equal(response.body.error.code, 'INVALID_PARTICIPANT')
      assert.equal(await EventModel.countDocuments(), 0)
    })

    it('rejects an employee id supplied as an attendee (wrong role) with INVALID_PARTICIPANT', async () => {
      const employee = await insertEmployee({ canHostEvents: true })

      const response = await postJson(
        baseUrl,
        '/api/events',
        validCreateBody({ attendeeIds: [String(employee._id)] }),
      )

      assert.equal(response.status, 400)
      assert.equal(response.body.error.code, 'INVALID_PARTICIPANT')
    })

    it('rejects a contact id supplied as a host (wrong role) with INVALID_PARTICIPANT', async () => {
      const contact = await insertContact()

      const response = await postJson(baseUrl, '/api/events', validCreateBody({ hostIds: [String(contact._id)] }))

      assert.equal(response.status, 400)
      assert.equal(response.body.error.code, 'INVALID_PARTICIPANT')
    })

    it('rejects a newly assigned inactive contact as an attendee with INVALID_PARTICIPANT', async () => {
      const inactive = await insertContact({ status: 'inactive' })

      const response = await postJson(
        baseUrl,
        '/api/events',
        validCreateBody({ attendeeIds: [String(inactive._id)] }),
      )

      assert.equal(response.status, 400)
      assert.equal(response.body.error.code, 'INVALID_PARTICIPANT')
    })

    it('rejects a newly assigned active-but-ineligible employee as a host with INVALID_PARTICIPANT', async () => {
      const ineligible = await insertEmployee({ status: 'active', canHostEvents: false })

      const response = await postJson(
        baseUrl,
        '/api/events',
        validCreateBody({ hostIds: [String(ineligible._id)] }),
      )

      assert.equal(response.status, 400)
      assert.equal(response.body.error.code, 'INVALID_PARTICIPANT')
    })

    it('allows an existing assignment to be retained after becoming inactive when PATCH omits that role', async () => {
      const attendee = await insertContact({ status: 'active' })
      const created = await createViaApi({ attendeeIds: [String(attendee._id)] })

      await ContactModel.findByIdAndUpdate(attendee._id, { status: 'inactive' })

      const response = await patchJson(baseUrl, `/api/events/${created.id}`, { title: 'Unrelated edit' })

      assert.equal(response.status, 200)
      assert.deepEqual(
        response.body.attendees.map((person: { id: string }) => person.id),
        [String(attendee._id)],
      )
    })
  })

  describe('duplicate assignments collapse within a role', () => {
    it('collapses a repeated identifier in one participant array to a single assignment', async () => {
      const attendee = await insertContact()

      const response = await postJson(
        baseUrl,
        '/api/events',
        validCreateBody({ attendeeIds: [String(attendee._id), String(attendee._id)] }),
      )

      assert.equal(response.status, 201)
      assert.equal(response.body.attendees.length, 1)
      assert.equal(response.body.attendees[0].id, String(attendee._id))
    })
  })

  describe('dangling participant references do not break reads', () => {
    it('omits an unresolvable participant from a calendar read without failing the event', async () => {
      const host = await insertEmployee({ canHostEvents: true })
      const created = await createViaApi({ hostIds: [String(host._id)] })

      await EmployeeModel.findByIdAndDelete(host._id)

      const response = await getJson(
        baseUrl,
        `/api/events?${new URLSearchParams({
          from: '2026-08-09T08:00:00Z',
          to: '2026-08-09T11:00:00Z',
        })}`,
      )

      assert.equal(response.status, 200)
      const event = response.body.events.find((candidate: { id: string }) => candidate.id === created.id)
      assert.ok(event, 'expected the event with the dangling host to still be returned')
      assert.deepEqual(event.hosts, [])
    })
  })

  describe('audit fields are server-controlled', () => {
    it('ignores a client-supplied createdByUserId/updatedByUserId on create; neither is returned nor persisted', async () => {
      const response = await postJson(
        baseUrl,
        '/api/events',
        validCreateBody({ createdByUserId: UNKNOWN_ID, updatedByUserId: UNKNOWN_ID }),
      )

      assert.equal(response.status, 201)
      assert.deepEqual(
        Object.keys(response.body).sort(),
        ['attendees', 'endAt', 'hosts', 'id', 'startAt', 'title'],
      )

      const stored = await EventModel.findById(response.body.id).lean()
      assert.equal(stored?.createdByUserId, null)
      assert.equal(stored?.updatedByUserId, null)
    })

    it('ignores a client-supplied updatedByUserId on PATCH; audit fields remain null and absent from the response', async () => {
      const created = await createViaApi()

      const response = await patchJson(baseUrl, `/api/events/${created.id}`, {
        title: 'Retitled',
        updatedByUserId: UNKNOWN_ID,
      })

      assert.equal(response.status, 200)
      assert.deepEqual(
        Object.keys(response.body).sort(),
        ['attendees', 'endAt', 'hosts', 'id', 'startAt', 'title'],
      )

      const stored = await EventModel.findById(created.id).lean()
      assert.equal(stored?.createdByUserId, null)
      assert.equal(stored?.updatedByUserId, null)
    })
  })

  describe('failed writes are atomic', () => {
    it('creates no document when create fails participant validation', async () => {
      const response = await postJson(baseUrl, '/api/events', validCreateBody({ attendeeIds: [UNKNOWN_ID] }))

      assert.equal(response.status, 400)
      assert.equal(await EventModel.countDocuments(), 0)
    })

    it('leaves the stored event unchanged when PATCH combines a valid title with an invalid new host', async () => {
      const created = await createViaApi({ title: 'Original title' })

      const response = await patchJson(baseUrl, `/api/events/${created.id}`, {
        title: 'Attempted retitle',
        hostIds: [UNKNOWN_ID],
      })

      assert.equal(response.status, 400)
      assert.equal(response.body.error.code, 'INVALID_PARTICIPANT')

      const stored = await EventModel.findById(created.id).lean()
      assert.equal(stored?.title, 'Original title')
      assert.deepEqual(stored?.hostIds, [])
    })
  })

  describe('events can be deleted', () => {
    it('returns 204 with an empty body, and the event is gone from a subsequent calendar read', async () => {
      const created = await createViaApi()

      const response = await deleteRequest(baseUrl, `/api/events/${created.id}`)

      assert.equal(response.status, 204)
      assert.equal(response.rawText, '')
      assert.equal(response.body, undefined)

      const read = await getJson(
        baseUrl,
        `/api/events?${new URLSearchParams({
          from: '2026-08-09T08:00:00Z',
          to: '2026-08-09T11:00:00Z',
        })}`,
      )
      assert.ok(!read.body.events.some((event: { id: string }) => event.id === created.id))
      assert.equal(await EventModel.countDocuments(), 0)
    })

    it('returns 404 NOT_FOUND when deleting a well-formed id matching no event', async () => {
      const response = await deleteRequest(baseUrl, `/api/events/${UNKNOWN_ID}`)

      assert.equal(response.status, 404)
      assert.equal(response.body.error.code, 'NOT_FOUND')
    })

    it('returns 400 VALIDATION_ERROR for a malformed event identifier on PATCH or DELETE', async () => {
      const patchResponse = await patchJson(baseUrl, '/api/events/not-an-object-id', { title: 'x' })
      const deleteResponse = await deleteRequest(baseUrl, '/api/events/not-an-object-id')

      assert.equal(patchResponse.status, 400)
      assert.equal(patchResponse.body.error.code, 'VALIDATION_ERROR')
      assert.equal(deleteResponse.status, 400)
      assert.equal(deleteResponse.body.error.code, 'VALIDATION_ERROR')
    })
  })

  describe('route and query contract', () => {
    it('rejects an undeclared events query key with VALIDATION_ERROR', async () => {
      const response = await getJson(
        baseUrl,
        `/api/events?${new URLSearchParams({
          from: '2026-08-09T09:00:00Z',
          to: '2026-08-09T10:00:00Z',
          limit: '10',
        })}`,
      )

      assert.equal(response.status, 400)
      assert.equal(response.body.error.code, 'VALIDATION_ERROR')
    })

    it('returns 404 NOT_FOUND for an undeclared method or path under /api/events', async () => {
      const created = await createViaApi()

      const putOnItem = await request(baseUrl, 'PUT', `/api/events/${created.id}`)
      const deleteOnCollection = await request(baseUrl, 'DELETE', '/api/events')
      const getOnItem = await request(baseUrl, 'GET', `/api/events/${created.id}`)

      for (const response of [putOnItem, deleteOnCollection, getOnItem]) {
        assert.equal(response.status, 404)
        assert.equal(response.body.error.code, 'NOT_FOUND')
      }

      // None of the undeclared requests above mutated anything.
      assert.equal(await EventModel.countDocuments(), 1)
    })
  })

  describe('event error responses stay within the shared envelope', () => {
    it('every event error response is exactly { error: { code, message } } with no internal detail', async () => {
      const scenarios: Array<{ label: string; run: () => Promise<HttpResponse> }> = [
        { label: 'missing period boundary', run: () => getJson(baseUrl, '/api/events?from=2026-08-09T09:00:00Z') },
        {
          label: 'whitespace title on create',
          run: () => postJson(baseUrl, '/api/events', validCreateBody({ title: '   ' })),
        },
        {
          label: 'unknown participant on create',
          run: () => postJson(baseUrl, '/api/events', validCreateBody({ attendeeIds: [UNKNOWN_ID] })),
        },
        {
          label: 'PATCH unknown event id',
          run: () => patchJson(baseUrl, `/api/events/${UNKNOWN_ID}`, { title: 'x' }),
        },
        { label: 'DELETE malformed id', run: () => deleteRequest(baseUrl, '/api/events/not-an-object-id') },
      ]

      for (const scenario of scenarios) {
        const response = await scenario.run()

        assert.ok(
          response.status === 400 || response.status === 404,
          `unexpected status for ${scenario.label}: ${response.status}`,
        )
        assert.deepEqual(Object.keys(response.body), ['error'], `unexpected top-level keys for ${scenario.label}`)
        assert.deepEqual(
          Object.keys(response.body.error).sort(),
          ['code', 'message'],
          `unexpected error keys for ${scenario.label}`,
        )
        assert.equal(typeof response.body.error.message, 'string')
        assert.ok(response.body.error.message.length > 0)
        assert.ok(
          !response.rawText.includes('/api/events'),
          `error body for ${scenario.label} must not reflect the request path`,
        )
      }
    })
  })
})
