import { after, before, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  startTestEnvironment,
  stopTestEnvironment,
  type TestEnvironment,
} from './support/test-environment.ts'

const START = '2026-08-09T09:00:00Z'
const END = '2026-08-09T10:00:00Z'

describe('event service (createEvent, patchEvent, toEventPayloads)', () => {
  let testEnvironment: TestEnvironment

  let mongoose: (typeof import('mongoose'))['default']
  let ContactModel: (typeof import('../modules/directory/contact.model.ts'))['ContactModel']
  let EmployeeModel: (typeof import('../modules/directory/employee.model.ts'))['EmployeeModel']
  let EventModel: (typeof import('../modules/events/event.model.ts'))['EventModel']
  let createEvent: (typeof import('../modules/events/event.service.ts'))['createEvent']
  let patchEvent: (typeof import('../modules/events/event.service.ts'))['patchEvent']
  let toEventPayloads: (typeof import('../modules/events/event.service.ts'))['toEventPayloads']
  let eventCreateSchema: (typeof import('../modules/events/event.schema.ts'))['eventCreateSchema']
  let eventPatchSchema: (typeof import('../modules/events/event.schema.ts'))['eventPatchSchema']
  let HttpError: (typeof import('../shared/http/error-envelope.ts'))['HttpError']

  before(async () => {
    // Per design.md D10: DB_HOST must point at the disposable in-memory
    // database before anything that reaches env.ts — including every module
    // below — is imported.
    testEnvironment = await startTestEnvironment()

    mongoose = (await import('mongoose')).default

    const { connectToMongo } = await import('../shared/infra/mongoose/client.ts')
    await connectToMongo()

    ;({ ContactModel } = await import('../modules/directory/contact.model.ts'))
    ;({ EmployeeModel } = await import('../modules/directory/employee.model.ts'))
    ;({ EventModel } = await import('../modules/events/event.model.ts'))
    ;({ createEvent, patchEvent, toEventPayloads } = await import('../modules/events/event.service.ts'))
    ;({ eventCreateSchema, eventPatchSchema } = await import('../modules/events/event.schema.ts'))
    ;({ HttpError } = await import('../shared/http/error-envelope.ts'))
  })

  after(async () => {
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

  function buildCreateInput(overrides: Record<string, unknown> = {}) {
    return eventCreateSchema.parse({
      title: 'Untitled event',
      startAt: START,
      endAt: END,
      ...overrides,
    })
  }

  function buildPatchInput(overrides: Record<string, unknown>) {
    return eventPatchSchema.parse(overrides)
  }

  function unknownObjectId(): string {
    return new mongoose.Types.ObjectId().toString()
  }

  async function assertHttpErrorCode(promise: Promise<unknown>, code: string): Promise<void> {
    let caught: unknown

    try {
      await promise
    } catch (error) {
      caught = error
    }

    assert.ok(caught instanceof HttpError, `expected an HttpError to be thrown, got: ${String(caught)}`)
    assert.equal((caught as InstanceType<typeof HttpError>).code, code)
  }

  describe('returned events use the domain payload', () => {
    it('exposes exactly the declared fields with resolved participant summaries and zone-explicit ISO instants', async () => {
      const attendee = await insertContact({ firstName: 'Ada', lastName: 'Lovelace' })
      const host = await insertEmployee({ firstName: 'Grace', lastName: 'Hopper', canHostEvents: true })

      const created = await createEvent(
        buildCreateInput({
          title: 'Full shape check',
          attendeeIds: [String(attendee._id)],
          hostIds: [String(host._id)],
        }),
      )

      assert.deepEqual(Object.keys(created).sort(), ['attendees', 'endAt', 'hosts', 'id', 'startAt', 'title'])
      assert.equal(typeof created.id, 'string')
      assert.equal(created.startAt, new Date(START).toISOString())
      assert.equal(created.endAt, new Date(END).toISOString())
      assert.deepEqual(created.attendees, [
        { id: String(attendee._id), firstName: 'Ada', lastName: 'Lovelace', fullName: 'Ada Lovelace' },
      ])
      assert.deepEqual(created.hosts, [
        { id: String(host._id), firstName: 'Grace', lastName: 'Hopper', fullName: 'Grace Hopper' },
      ])
    })
  })

  describe('events can be created', () => {
    it('creates an event with empty attendee and host arrays when both are omitted', async () => {
      const created = await createEvent(buildCreateInput())

      assert.deepEqual(created.attendees, [])
      assert.deepEqual(created.hosts, [])
      assert.equal(await EventModel.countDocuments(), 1)
    })

    it('trims a padded title end to end through the schema and the service', async () => {
      const created = await createEvent(buildCreateInput({ title: '  Padded via pipeline  ' }))

      assert.equal(created.title, 'Padded via pipeline')
    })
  })

  describe('end is strictly later than start, on both write paths', () => {
    it('rejects create when endAt equals startAt', async () => {
      await assertHttpErrorCode(
        createEvent(buildCreateInput({ startAt: START, endAt: START })),
        'VALIDATION_ERROR',
      )
      assert.equal(await EventModel.countDocuments(), 0)
    })

    it('rejects create when endAt is before startAt', async () => {
      await assertHttpErrorCode(
        createEvent(buildCreateInput({ startAt: END, endAt: START })),
        'VALIDATION_ERROR',
      )
      assert.equal(await EventModel.countDocuments(), 0)
    })

    it('rejects PATCH when the merged span becomes zero-length', async () => {
      const created = await createEvent(buildCreateInput())

      await assertHttpErrorCode(
        patchEvent(created.id, buildPatchInput({ endAt: START })),
        'VALIDATION_ERROR',
      )

      const stored = await EventModel.findById(created.id).lean()
      assert.equal(stored?.startAt.toISOString(), new Date(START).toISOString())
      assert.equal(stored?.endAt.toISOString(), new Date(END).toISOString())
    })

    it('rejects PATCH when the merged span becomes inverted', async () => {
      const created = await createEvent(buildCreateInput())

      await assertHttpErrorCode(
        patchEvent(created.id, buildPatchInput({ startAt: END, endAt: START })),
        'VALIDATION_ERROR',
      )
    })

    it('accepts a later-only endAt patch and leaves startAt untouched (one-sided boundary)', async () => {
      const created = await createEvent(buildCreateInput())
      const laterEnd = '2026-08-09T11:00:00Z'

      const updated = await patchEvent(created.id, buildPatchInput({ endAt: laterEnd }))

      assert.equal(updated.startAt, new Date(START).toISOString())
      assert.equal(updated.endAt, new Date(laterEnd).toISOString())
    })

    it('accepts an earlier-only startAt patch and leaves endAt untouched (one-sided boundary)', async () => {
      const created = await createEvent(buildCreateInput())
      const earlierStart = '2026-08-09T08:00:00Z'

      const updated = await patchEvent(created.id, buildPatchInput({ startAt: earlierStart }))

      assert.equal(updated.startAt, new Date(earlierStart).toISOString())
      assert.equal(updated.endAt, new Date(END).toISOString())
    })

    it('rejects an endAt-only patch that would land at or before the stored startAt (one-sided boundary)', async () => {
      const created = await createEvent(buildCreateInput())

      await assertHttpErrorCode(
        patchEvent(created.id, buildPatchInput({ endAt: '2026-08-09T08:00:00Z' })),
        'VALIDATION_ERROR',
      )
    })

    it('rejects a startAt-only patch that would land at or after the stored endAt (one-sided boundary)', async () => {
      const created = await createEvent(buildCreateInput())

      await assertHttpErrorCode(
        patchEvent(created.id, buildPatchInput({ startAt: '2026-08-09T11:00:00Z' })),
        'VALIDATION_ERROR',
      )
    })
  })

  describe('PATCH updates only supplied fields', () => {
    it('changes only the title, leaving instants and participants unchanged', async () => {
      const attendee = await insertContact()
      const created = await createEvent(buildCreateInput({ attendeeIds: [String(attendee._id)] }))

      const updated = await patchEvent(created.id, buildPatchInput({ title: 'Title only' }))

      assert.equal(updated.title, 'Title only')
      assert.equal(updated.startAt, created.startAt)
      assert.equal(updated.endAt, created.endAt)
      assert.deepEqual(updated.attendees, created.attendees)
    })

    it('replaces the attendee set entirely rather than merging with the stored set', async () => {
      const a = await insertContact()
      const b = await insertContact()
      const c = await insertContact()
      const created = await createEvent(buildCreateInput({ attendeeIds: [String(a._id), String(b._id)] }))

      const updated = await patchEvent(
        created.id,
        buildPatchInput({ attendeeIds: [String(b._id), String(c._id)] }),
      )

      assert.deepEqual(
        updated.attendees.map((person) => person.id).sort(),
        [String(b._id), String(c._id)].sort(),
      )
    })

    it('leaves both participant sets unchanged when PATCH omits both arrays', async () => {
      const attendee = await insertContact()
      const host = await insertEmployee({ canHostEvents: true })
      const created = await createEvent(
        buildCreateInput({ attendeeIds: [String(attendee._id)], hostIds: [String(host._id)] }),
      )

      const updated = await patchEvent(created.id, buildPatchInput({ title: 'Renamed' }))

      assert.equal(updated.title, 'Renamed')
      assert.deepEqual(updated.attendees.map((person) => person.id), [String(attendee._id)])
      assert.deepEqual(updated.hosts.map((person) => person.id), [String(host._id)])
    })

    it('clears a role when PATCH supplies an explicit empty array', async () => {
      const host = await insertEmployee({ canHostEvents: true })
      const created = await createEvent(buildCreateInput({ hostIds: [String(host._id)] }))

      const updated = await patchEvent(created.id, buildPatchInput({ hostIds: [] }))

      assert.deepEqual(updated.hosts, [])
    })

    it('rejects PATCH targeting a well-formed id matching no event', async () => {
      await assertHttpErrorCode(
        patchEvent(unknownObjectId(), buildPatchInput({ title: 'Anything' })),
        'NOT_FOUND',
      )
    })
  })

  describe('duplicate assignments collapse within a role', () => {
    it('collapses a duplicated attendee id on create', async () => {
      const attendee = await insertContact()

      const created = await createEvent(
        buildCreateInput({ attendeeIds: [String(attendee._id), String(attendee._id)] }),
      )

      assert.equal(created.attendees.length, 1)
      assert.equal(created.attendees[0]?.id, String(attendee._id))
    })

    it('collapses a duplicated host id newly added on PATCH', async () => {
      const host = await insertEmployee({ canHostEvents: true })
      const created = await createEvent(buildCreateInput())

      const updated = await patchEvent(
        created.id,
        buildPatchInput({ hostIds: [String(host._id), String(host._id)] }),
      )

      assert.equal(updated.hosts.length, 1)
    })
  })

  describe('new participant assignments must be valid', () => {
    it('rejects an unknown attendee id on create', async () => {
      await assertHttpErrorCode(
        createEvent(buildCreateInput({ attendeeIds: [unknownObjectId()] })),
        'INVALID_PARTICIPANT',
      )
      assert.equal(await EventModel.countDocuments(), 0)
    })

    it('rejects an unknown host id newly added on PATCH', async () => {
      const created = await createEvent(buildCreateInput())

      await assertHttpErrorCode(
        patchEvent(created.id, buildPatchInput({ hostIds: [unknownObjectId()] })),
        'INVALID_PARTICIPANT',
      )
    })

    it('rejects an employee id supplied as an attendee (wrong role)', async () => {
      const employee = await insertEmployee({ canHostEvents: true })

      await assertHttpErrorCode(
        createEvent(buildCreateInput({ attendeeIds: [String(employee._id)] })),
        'INVALID_PARTICIPANT',
      )
    })

    it('rejects a contact id supplied as a host (wrong role)', async () => {
      const contact = await insertContact()

      await assertHttpErrorCode(
        createEvent(buildCreateInput({ hostIds: [String(contact._id)] })),
        'INVALID_PARTICIPANT',
      )
    })

    it('rejects a newly assigned inactive contact as an attendee', async () => {
      const inactive = await insertContact({ status: 'inactive' })

      await assertHttpErrorCode(
        createEvent(buildCreateInput({ attendeeIds: [String(inactive._id)] })),
        'INVALID_PARTICIPANT',
      )
    })

    it('rejects a newly assigned inactive employee as a host', async () => {
      const inactive = await insertEmployee({ status: 'inactive', canHostEvents: true })

      await assertHttpErrorCode(
        createEvent(buildCreateInput({ hostIds: [String(inactive._id)] })),
        'INVALID_PARTICIPANT',
      )
    })

    it('rejects a newly assigned active-but-ineligible employee as a host', async () => {
      const ineligible = await insertEmployee({ status: 'active', canHostEvents: false })

      await assertHttpErrorCode(
        createEvent(buildCreateInput({ hostIds: [String(ineligible._id)] })),
        'INVALID_PARTICIPANT',
      )
    })
  })

  describe('retained vs. removed historical assignments', () => {
    it('keeps an attendee retained after becoming inactive when the array is omitted on PATCH', async () => {
      const attendee = await insertContact({ status: 'active' })
      const created = await createEvent(buildCreateInput({ attendeeIds: [String(attendee._id)] }))

      await ContactModel.findByIdAndUpdate(attendee._id, { status: 'inactive' })

      const updated = await patchEvent(created.id, buildPatchInput({ title: 'Unrelated edit' }))

      assert.deepEqual(updated.attendees.map((person) => person.id), [String(attendee._id)])
    })

    it('keeps a host retained when re-supplied in the array after becoming ineligible', async () => {
      const host = await insertEmployee({ canHostEvents: true, status: 'active' })
      const created = await createEvent(buildCreateInput({ hostIds: [String(host._id)] }))

      await EmployeeModel.findByIdAndUpdate(host._id, { canHostEvents: false })

      const updated = await patchEvent(created.id, buildPatchInput({ hostIds: [String(host._id)] }))

      assert.deepEqual(updated.hosts.map((person) => person.id), [String(host._id)])
    })

    it('keeps a host retained when its array is omitted after becoming inactive', async () => {
      const host = await insertEmployee({ canHostEvents: true, status: 'active' })
      const created = await createEvent(buildCreateInput({ hostIds: [String(host._id)] }))

      await EmployeeModel.findByIdAndUpdate(host._id, { status: 'inactive' })

      const updated = await patchEvent(created.id, buildPatchInput({ title: 'Unrelated edit' }))

      assert.deepEqual(updated.hosts.map((person) => person.id), [String(host._id)])
    })

    it('removes a historical host omitted from a newly supplied array without re-validating it', async () => {
      const keep = await insertEmployee({ canHostEvents: true })
      const drop = await insertEmployee({ canHostEvents: true })
      const created = await createEvent(
        buildCreateInput({ hostIds: [String(keep._id), String(drop._id)] }),
      )

      // "drop" becomes ineligible after assignment, so its removal below is
      // not merely coincidental with it still passing validation.
      await EmployeeModel.findByIdAndUpdate(drop._id, { canHostEvents: false })

      const updated = await patchEvent(created.id, buildPatchInput({ hostIds: [String(keep._id)] }))

      assert.deepEqual(updated.hosts.map((person) => person.id), [String(keep._id)])
    })
  })

  describe('dangling participant references do not break reads', () => {
    it('omits a dangling attendee reference from toEventPayloads without failing the event', async () => {
      const resolvable = await insertContact({ firstName: 'Resolvable', lastName: 'Attendee' })
      const danglingId = new mongoose.Types.ObjectId()

      const event = await EventModel.create({
        title: 'Has a dangling attendee',
        startAt: new Date(START),
        endAt: new Date(END),
        attendeeIds: [resolvable._id, danglingId],
        hostIds: [],
      })

      const [payload] = await toEventPayloads([event])

      assert.equal(payload?.id, String(event._id))
      assert.deepEqual(
        payload?.attendees.map((person) => person.id),
        [String(resolvable._id)],
      )
    })

    it('omits a host reference that dangles after the referenced employee is deleted', async () => {
      const host = await insertEmployee({ canHostEvents: true })
      const created = await createEvent(buildCreateInput({ hostIds: [String(host._id)] }))

      await EmployeeModel.findByIdAndDelete(host._id)

      const stored = await EventModel.findById(created.id)
      assert.ok(stored, 'expected the event to still exist')

      const [payload] = await toEventPayloads([stored])

      assert.equal(payload?.id, created.id)
      assert.deepEqual(payload?.hosts, [])
    })
  })

  describe('audit fields are server-controlled', () => {
    it('ignores a forged createdByUserId/updatedByUserId on create and always persists both as null', async () => {
      const forgedInput = eventCreateSchema.parse({
        title: 'Forged audit attempt',
        startAt: START,
        endAt: END,
        createdByUserId: unknownObjectId(),
        updatedByUserId: unknownObjectId(),
      })

      const created = await createEvent(forgedInput)

      assert.deepEqual(Object.keys(created).sort(), ['attendees', 'endAt', 'hosts', 'id', 'startAt', 'title'])

      const stored = await EventModel.findById(created.id).lean()
      assert.equal(stored?.createdByUserId, null)
      assert.equal(stored?.updatedByUserId, null)
    })

    it('ignores a forged updatedByUserId on PATCH and keeps both audit fields null', async () => {
      const created = await createEvent(buildCreateInput())

      const forgedPatch = eventPatchSchema.parse({
        title: 'Retitled',
        updatedByUserId: unknownObjectId(),
      })

      await patchEvent(created.id, forgedPatch)

      const stored = await EventModel.findById(created.id).lean()
      assert.equal(stored?.createdByUserId, null)
      assert.equal(stored?.updatedByUserId, null)
    })
  })

  describe('failed writes are atomic', () => {
    it('creates no document when create fails participant validation', async () => {
      await assertHttpErrorCode(
        createEvent(buildCreateInput({ attendeeIds: [unknownObjectId()] })),
        'INVALID_PARTICIPANT',
      )

      assert.equal(await EventModel.countDocuments(), 0)
    })

    it('leaves the stored event unchanged when PATCH combines a valid title with an invalid new host', async () => {
      const created = await createEvent(buildCreateInput({ title: 'Original title' }))

      await assertHttpErrorCode(
        patchEvent(
          created.id,
          buildPatchInput({ title: 'Attempted retitle', hostIds: [unknownObjectId()] }),
        ),
        'INVALID_PARTICIPANT',
      )

      const stored = await EventModel.findById(created.id).lean()
      assert.equal(stored?.title, 'Original title')
      assert.deepEqual(stored?.hostIds, [])
    })

    it('leaves the stored event unchanged when PATCH combines a valid title with an inverted span', async () => {
      const created = await createEvent(buildCreateInput({ title: 'Original title' }))

      await assertHttpErrorCode(
        patchEvent(
          created.id,
          buildPatchInput({ title: 'Attempted retitle', startAt: END, endAt: START }),
        ),
        'VALIDATION_ERROR',
      )

      const stored = await EventModel.findById(created.id).lean()
      assert.equal(stored?.title, 'Original title')
    })
  })
})
