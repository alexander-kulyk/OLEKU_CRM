import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  eventCreateSchema,
  eventIdParamsSchema,
  eventPatchSchema,
  eventPeriodQuerySchema,
} from '../modules/events/event.schema.ts'

// event.schema.ts has no dependency on env.ts, Mongoose, or Express — it is
// a pure Zod boundary layer (mirrors directory.schema.ts) — so, unlike
// every other test file in this suite, it is safe to import statically
// without starting the in-memory database first (design.md D10 only
// constrains modules that reach env.ts).

describe('event schemas (from/to, create, PATCH, id params)', () => {
  describe('eventPeriodQuerySchema', () => {
    it('accepts a Z-suffixed instant and a numeric-offset instant as the same moment', () => {
      const zResult = eventPeriodQuerySchema.safeParse({
        from: '2026-08-09T06:00:00Z',
        to: '2026-08-09T07:00:00Z',
      })
      const offsetResult = eventPeriodQuerySchema.safeParse({
        from: '2026-08-09T09:00:00+03:00',
        to: '2026-08-09T10:00:00+03:00',
      })

      assert.equal(zResult.success, true)
      assert.equal(offsetResult.success, true)
      assert.equal(zResult.success && offsetResult.success && zResult.data.from.getTime(), offsetResult.success && offsetResult.data.from.getTime())
    })

    it('rejects a date-only from/to value', () => {
      const result = eventPeriodQuerySchema.safeParse({ from: '2026-08-09', to: '2026-08-10' })

      assert.equal(result.success, false)
    })

    it('rejects a zone-less from/to value', () => {
      const result = eventPeriodQuerySchema.safeParse({
        from: '2026-08-09T09:00:00',
        to: '2026-08-09T10:00:00',
      })

      assert.equal(result.success, false)
    })

    it('rejects a request missing either boundary', () => {
      assert.equal(eventPeriodQuerySchema.safeParse({ to: '2026-08-09T10:00:00Z' }).success, false)
      assert.equal(eventPeriodQuerySchema.safeParse({ from: '2026-08-09T09:00:00Z' }).success, false)
    })

    it('rejects an inverted or zero-length period', () => {
      const inverted = eventPeriodQuerySchema.safeParse({
        from: '2026-08-09T10:00:00Z',
        to: '2026-08-09T09:00:00Z',
      })
      const zeroLength = eventPeriodQuerySchema.safeParse({
        from: '2026-08-09T09:00:00Z',
        to: '2026-08-09T09:00:00Z',
      })

      assert.equal(inverted.success, false)
      assert.equal(zeroLength.success, false)
    })

    it('rejects an undeclared query key', () => {
      const result = eventPeriodQuerySchema.safeParse({
        from: '2026-08-09T09:00:00Z',
        to: '2026-08-09T10:00:00Z',
        limit: '10',
      })

      assert.equal(result.success, false)
    })
  })

  describe('eventCreateSchema', () => {
    const validBody = {
      title: 'Parent-teacher meeting',
      startAt: '2026-08-09T09:00:00Z',
      endAt: '2026-08-09T10:00:00Z',
    }

    it('parses a valid body into Date instants and defaults both participant arrays to empty', () => {
      const result = eventCreateSchema.parse(validBody)

      assert.ok(result.startAt instanceof Date)
      assert.ok(result.endAt instanceof Date)
      assert.equal(result.startAt.toISOString(), '2026-08-09T09:00:00.000Z')
      assert.deepEqual(result.attendeeIds, [])
      assert.deepEqual(result.hostIds, [])
    })

    it('preserves supplied participant arrays as-is, including duplicates (de-duplication is the service concern)', () => {
      const result = eventCreateSchema.parse({
        ...validBody,
        attendeeIds: ['a', 'a', 'b'],
        hostIds: ['c'],
      })

      assert.deepEqual(result.attendeeIds, ['a', 'a', 'b'])
      assert.deepEqual(result.hostIds, ['c'])
    })

    it('trims a padded title', () => {
      const result = eventCreateSchema.parse({ ...validBody, title: '  Padded  ' })

      assert.equal(result.title, 'Padded')
    })

    it('rejects a whitespace-only title', () => {
      const result = eventCreateSchema.safeParse({ ...validBody, title: '   ' })

      assert.equal(result.success, false)
    })

    it('rejects a missing title, startAt, or endAt', () => {
      const { title, ...withoutTitle } = validBody
      const { startAt, ...withoutStartAt } = validBody
      const { endAt, ...withoutEndAt } = validBody

      assert.equal(eventCreateSchema.safeParse(withoutTitle).success, false)
      assert.equal(eventCreateSchema.safeParse(withoutStartAt).success, false)
      assert.equal(eventCreateSchema.safeParse(withoutEndAt).success, false)
    })

    it('rejects a date-only or zone-less startAt/endAt', () => {
      assert.equal(eventCreateSchema.safeParse({ ...validBody, startAt: '2026-08-09' }).success, false)
      assert.equal(
        eventCreateSchema.safeParse({ ...validBody, endAt: '2026-08-09T10:00:00' }).success,
        false,
      )
    })

    it('silently strips a forged createdByUserId/updatedByUserId and any other unknown key', () => {
      const result = eventCreateSchema.parse({
        ...validBody,
        createdByUserId: 'forged-audit-id',
        updatedByUserId: 'forged-audit-id',
        somethingElse: 'unexpected',
      })

      assert.deepEqual(Object.keys(result).sort(), ['attendeeIds', 'endAt', 'hostIds', 'startAt', 'title'])
    })
  })

  describe('eventPatchSchema', () => {
    it('accepts a single supplied field', () => {
      assert.equal(eventPatchSchema.safeParse({ title: 'New title' }).success, true)
    })

    it('accepts any combination of the five editable fields', () => {
      const result = eventPatchSchema.safeParse({
        startAt: '2026-08-09T09:00:00Z',
        endAt: '2026-08-09T10:00:00Z',
        attendeeIds: [],
      })

      assert.equal(result.success, true)
    })

    it('rejects an empty body', () => {
      const result = eventPatchSchema.safeParse({})

      assert.equal(result.success, false)
    })

    it('keeps an omitted participant array absent, distinct from a supplied empty array', () => {
      const omitted = eventPatchSchema.parse({ title: 'Only title' })
      const emptied = eventPatchSchema.parse({ hostIds: [] })

      assert.equal('hostIds' in omitted, false)
      assert.deepEqual(emptied.hostIds, [])
    })

    it('rejects a supplied whitespace-only title', () => {
      const result = eventPatchSchema.safeParse({ title: '   ' })

      assert.equal(result.success, false)
    })

    it('rejects a supplied date-only or zone-less instant', () => {
      assert.equal(eventPatchSchema.safeParse({ startAt: '2026-08-09' }).success, false)
      assert.equal(eventPatchSchema.safeParse({ endAt: '2026-08-09T10:00:00' }).success, false)
    })

    it('silently strips a forged createdByUserId/updatedByUserId', () => {
      const result = eventPatchSchema.parse({ title: 'Retitled', updatedByUserId: 'forged-audit-id' })

      assert.deepEqual(Object.keys(result), ['title'])
    })
  })

  describe('eventIdParamsSchema', () => {
    it('accepts a well-formed 24-character hex id in either case', () => {
      assert.equal(eventIdParamsSchema.safeParse({ id: '64f1b2c3d4e5f6a7b8c9d0e1' }).success, true)
      assert.equal(eventIdParamsSchema.safeParse({ id: '64F1B2C3D4E5F6A7B8C9D0E1' }).success, true)
    })

    it('rejects a malformed id', () => {
      assert.equal(eventIdParamsSchema.safeParse({ id: 'not-an-object-id' }).success, false)
      assert.equal(eventIdParamsSchema.safeParse({ id: '123' }).success, false)
    })

    it('rejects an undeclared key alongside id', () => {
      const result = eventIdParamsSchema.safeParse({ id: '64f1b2c3d4e5f6a7b8c9d0e1', extra: '1' })

      assert.equal(result.success, false)
    })
  })
})
