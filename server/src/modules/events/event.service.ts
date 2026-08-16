import mongoose, { Types } from 'mongoose'
import { HttpError } from '../../shared/http/error-envelope.ts'
import { ContactModel } from '../directory/contact.model.ts'
import { EmployeeModel } from '../directory/employee.model.ts'
import { DEFAULT_EVENT_COLOR } from './event-color.ts'
import { EventModel, type EventAttributes } from './event.model.ts'
import type { CreateEventInput, EventPeriodQuery, PatchEventInput } from './event.schema.ts'

/** A resolved participant projection embedded in an event response. */
export interface ParticipantSummary {
  id: string
  firstName: string
  lastName: string
  fullName: string
}

/**
 * specs/event-api/spec.md, "Returned events use the domain payload": every
 * event endpoint returns exactly these fields — no audit or persistence
 * metadata, and participants are resolved person summaries rather than bare
 * ids.
 */
export interface EventPayload {
  id: string
  title: string
  startAt: string
  endAt: string
  /** Six-digit lowercase hex triplet — always present (see {@link toEventPayloads}). */
  color: string
  attendees: ParticipantSummary[]
  hosts: ParticipantSummary[]
}

type ParticipantRole = 'attendee' | 'host'

/**
 * The shape event.service.ts needs from a stored event to map it to an
 * `EventPayload` — satisfied by both a hydrated Mongoose document (the
 * create/PATCH write paths, after `save()`) and a `.lean()` query result (a
 * future period-bounded read), matching the `LeanContact` / `LeanEmployee`
 * pattern in directory.service.ts.
 */
type EventLike = Pick<EventAttributes, 'title' | 'startAt' | 'endAt' | 'attendeeIds' | 'hostIds'> & {
  _id: unknown
  // Optional here, unlike on `EventAttributes`: an event stored before the
  // color field existed has no value on the document at all, and the
  // model's `default` does not apply retroactively on read.
  color?: string | null
}

/**
 * design.md D5: the single shared function evaluating the primary
 * `endAt > startAt` invariant. Both createEvent and patchEvent call this
 * with the complete candidate state — the full merged view, not just the
 * supplied patch — before either write path reaches persistence.
 */
function assertValidSpan(startAt: Date, endAt: Date): void {
  if (!(endAt.getTime() > startAt.getTime())) {
    throw new HttpError('VALIDATION_ERROR', 'endAt must be strictly later than startAt.')
  }
}

/**
 * De-duplicates a submitted participant id array (specs/event-api/spec.md,
 * "Duplicate assignments collapse within a role"). Every well-formed
 * ObjectId string is canonicalized to its lowercase hex form first, so two
 * differently-cased spellings of the same id collapse to one assignment;
 * order of first occurrence is preserved. An id that is not a well-formed
 * ObjectId can never resolve to a stored contact or employee, so it is kept
 * as-is — it will fail existence resolution like any other unknown id.
 */
function normalizeParticipantIds(ids: readonly string[]): string[] {
  const seen = new Set<string>()
  const normalized: string[] = []

  for (const id of ids) {
    const canonical = mongoose.isValidObjectId(id) ? new Types.ObjectId(id).toHexString() : id

    if (!seen.has(canonical)) {
      seen.add(canonical)
      normalized.push(canonical)
    }
  }

  return normalized
}

/**
 * design.md D6: ids present in `submitted` but not in `stored` are newly
 * assigned and must be validated; ids already in `stored` are retained and
 * are never re-checked, even if they would no longer pass validation today.
 */
function diffNewIds(submitted: readonly string[], stored: readonly string[]): string[] {
  const storedSet = new Set(stored)
  return submitted.filter((id) => !storedSet.has(id))
}

/**
 * Validates every id in `newIds` against the contact directory: each must
 * exist and have `status=active` (specs/event-api/spec.md, "New participant
 * assignments must be valid"). Issues exactly one batched query
 * (tasks.md 5.5) and throws on the first violation without querying
 * anything else, leaving the caller free to complete this before mutating
 * any loaded event (tasks.md 5.6).
 */
async function assertNewAttendeesAreValid(newIds: readonly string[]): Promise<void> {
  if (newIds.length === 0) {
    return
  }

  const candidateIds = newIds.filter((id) => mongoose.isValidObjectId(id))
  const found = await ContactModel.find({ _id: { $in: candidateIds } })
    .select('status')
    .lean()
  const foundById = new Map(found.map((contact) => [String(contact._id), contact]))

  for (const id of newIds) {
    const contact = foundById.get(id)

    if (!contact) {
      throw new HttpError('INVALID_PARTICIPANT', `Attendee ${id} does not exist.`)
    }

    if (contact.status !== 'active') {
      throw new HttpError('INVALID_PARTICIPANT', `Attendee ${id} is not active.`)
    }
  }
}

/**
 * Validates every id in `newIds` against the employee directory: each must
 * exist, have `status=active`, and have `canHostEvents=true`
 * (specs/event-api/spec.md, "New participant assignments must be valid").
 * Mirrors {@link assertNewAttendeesAreValid} with the additional
 * eligibility check hosts require.
 */
async function assertNewHostsAreValid(newIds: readonly string[]): Promise<void> {
  if (newIds.length === 0) {
    return
  }

  const candidateIds = newIds.filter((id) => mongoose.isValidObjectId(id))
  const found = await EmployeeModel.find({ _id: { $in: candidateIds } })
    .select('status canHostEvents')
    .lean()
  const foundById = new Map(found.map((employee) => [String(employee._id), employee]))

  for (const id of newIds) {
    const employee = foundById.get(id)

    if (!employee) {
      throw new HttpError('INVALID_PARTICIPANT', `Host ${id} does not exist.`)
    }

    if (employee.status !== 'active') {
      throw new HttpError('INVALID_PARTICIPANT', `Host ${id} is not active.`)
    }

    if (!employee.canHostEvents) {
      throw new HttpError('INVALID_PARTICIPANT', `Host ${id} is not eligible to host events.`)
    }
  }
}

function toParticipantSummary(person: { _id: unknown; firstName: string; lastName: string }): ParticipantSummary {
  return {
    id: String(person._id),
    firstName: person.firstName,
    lastName: person.lastName,
    fullName: `${person.firstName} ${person.lastName}`.trim(),
  }
}

async function loadParticipantSummaries(
  role: ParticipantRole,
  ids: readonly string[],
): Promise<Map<string, ParticipantSummary>> {
  if (ids.length === 0) {
    return new Map()
  }

  // Branched per role (rather than holding ContactModel/EmployeeModel in one
  // union-typed variable) so each call resolves against its own concrete
  // Model type instead of an incompatible union of Query signatures.
  const found =
    role === 'attendee'
      ? await ContactModel.find({ _id: { $in: ids } })
          .select('firstName lastName')
          .lean()
      : await EmployeeModel.find({ _id: { $in: ids } })
          .select('firstName lastName')
          .lean()

  return new Map(found.map((person) => [String(person._id), toParticipantSummary(person)]))
}

function resolveRole(
  ids: readonly Types.ObjectId[],
  summaries: ReadonlyMap<string, ParticipantSummary>,
): ParticipantSummary[] {
  const resolved: ParticipantSummary[] = []

  for (const id of ids) {
    const summary = summaries.get(String(id))

    // specs/event-api/spec.md, "Dangling participant references do not
    // break reads": a reference that no longer resolves is silently
    // omitted rather than failing the event.
    if (summary) {
      resolved.push(summary)
    }
  }

  return resolved
}

/**
 * Maps stored events to the domain payload every event endpoint returns
 * (specs/event-api/spec.md, "Returned events use the domain payload"),
 * batch-resolving attendee and host projections across the whole input set
 * — one query per role regardless of how many events are supplied
 * (tasks.md 5.7) — rather than one query per event.
 */
export async function toEventPayloads(events: readonly EventLike[]): Promise<EventPayload[]> {
  const attendeeIds = [...new Set(events.flatMap((event) => event.attendeeIds.map(String)))]
  const hostIds = [...new Set(events.flatMap((event) => event.hostIds.map(String)))]

  const [attendeeSummaries, hostSummaries] = await Promise.all([
    loadParticipantSummaries('attendee', attendeeIds),
    loadParticipantSummaries('host', hostIds),
  ])

  return events.map((event) => ({
    id: String(event._id),
    title: event.title,
    startAt: event.startAt.toISOString(),
    endAt: event.endAt.toISOString(),
    // Events stored before the color field existed have none — every
    // response still carries one, so no consumer has to handle its absence.
    color: event.color ?? DEFAULT_EVENT_COLOR,
    attendees: resolveRole(event.attendeeIds, attendeeSummaries),
    hosts: resolveRole(event.hostIds, hostSummaries),
  }))
}

/**
 * `GET /api/events?from&to` (specs/event-api/spec.md, "Calendar reads use
 * an exact bounded route"). An event overlaps the requested half-open
 * period exactly when `startAt < to AND endAt > from` — the filter below
 * mirrors that condition directly, so a boundary-touching event (`startAt
 * === to` or `endAt === from`) is excluded rather than included.
 * `eventPeriodQuerySchema` (validated in event.controller.ts, Stage 6) has
 * already rejected a missing or non-increasing from/to pair before this
 * function is ever called, so there is no persistence access for an
 * invalid period.
 */
export async function listEventsByPeriod(period: EventPeriodQuery): Promise<EventPayload[]> {
  const events = await EventModel.find({
    startAt: { $lt: period.to },
    endAt: { $gt: period.from },
  })
    .select('title startAt endAt color attendeeIds hostIds')
    .lean()

  return toEventPayloads(events)
}

/**
 * `POST /api/events` (specs/event-api/spec.md, "Events can be created").
 * Constructs and saves a new document (design.md D4) after the shared span
 * check and full participant validation both pass — create treats every
 * submitted id as newly assigned (design.md D6). Both audit fields are
 * always written as null; `CreateEventInput` carries no audit fields for a
 * caller to supply in the first place (design.md D2).
 */
export async function createEvent(input: CreateEventInput): Promise<EventPayload> {
  assertValidSpan(input.startAt, input.endAt)

  const attendeeIds = normalizeParticipantIds(input.attendeeIds)
  const hostIds = normalizeParticipantIds(input.hostIds)

  await assertNewAttendeesAreValid(attendeeIds)
  await assertNewHostsAreValid(hostIds)

  const event = new EventModel({
    title: input.title,
    startAt: input.startAt,
    endAt: input.endAt,
    color: input.color,
    attendeeIds: attendeeIds.map((id) => new Types.ObjectId(id)),
    hostIds: hostIds.map((id) => new Types.ObjectId(id)),
    createdByUserId: null,
    updatedByUserId: null,
  })

  await event.save()

  const [payload] = await toEventPayloads([event])
  return payload
}

/**
 * `PATCH /api/events/:id` (specs/event-api/spec.md, "PATCH updates only
 * supplied fields"). Loads the stored document, validates the merged
 * candidate — the shared span check against the full merged boundaries, and
 * participant validation restricted to ids newly added relative to the
 * stored role (design.md D6) — and only then assigns the supplied fields
 * and saves (design.md D4). Completing every check before the first
 * assignment means a rejected write never touches the loaded document, so
 * storage is left exactly as it was (tasks.md 5.6;
 * specs/event-api/spec.md, "Failed writes are atomic").
 *
 * `id` is assumed to already be a well-formed identifier — the "Malformed
 * event identifier" 400 case is `eventIdParamsSchema`'s responsibility at
 * the HTTP boundary (Stage 6), not this function's.
 */
export async function patchEvent(id: string, patch: PatchEventInput): Promise<EventPayload> {
  const event = await EventModel.findById(id)

  if (!event) {
    throw new HttpError('NOT_FOUND', 'Event not found.')
  }

  const nextStartAt = patch.startAt ?? event.startAt
  const nextEndAt = patch.endAt ?? event.endAt
  assertValidSpan(nextStartAt, nextEndAt)

  let nextAttendeeIds: Types.ObjectId[] | undefined
  if (patch.attendeeIds !== undefined) {
    const submitted = normalizeParticipantIds(patch.attendeeIds)
    const stored = event.attendeeIds.map((objectId) => objectId.toHexString())
    await assertNewAttendeesAreValid(diffNewIds(submitted, stored))
    nextAttendeeIds = submitted.map((idValue) => new Types.ObjectId(idValue))
  }

  let nextHostIds: Types.ObjectId[] | undefined
  if (patch.hostIds !== undefined) {
    const submitted = normalizeParticipantIds(patch.hostIds)
    const stored = event.hostIds.map((objectId) => objectId.toHexString())
    await assertNewHostsAreValid(diffNewIds(submitted, stored))
    nextHostIds = submitted.map((idValue) => new Types.ObjectId(idValue))
  }

  // Every check above has passed — only now is the loaded document mutated.
  if (patch.title !== undefined) {
    event.title = patch.title
  }
  if (patch.startAt !== undefined) {
    event.startAt = patch.startAt
  }
  if (patch.endAt !== undefined) {
    event.endAt = patch.endAt
  }
  if (patch.color !== undefined) {
    event.color = patch.color
  }
  if (nextAttendeeIds !== undefined) {
    event.attendeeIds = nextAttendeeIds
  }
  if (nextHostIds !== undefined) {
    event.hostIds = nextHostIds
  }

  await event.save()

  const [payload] = await toEventPayloads([event])
  return payload
}

/**
 * `DELETE /api/events/:id` (specs/event-api/spec.md, "Events can be
 * deleted"). A plain existence-checked delete: unlike create/PATCH, a
 * delete carries no span or participant invariant to enforce, so there is
 * no document round-trip to make here — design.md D4's load-merge-save
 * requirement constrains the invariant-bearing write paths, not this one.
 *
 * `id` is assumed to already be a well-formed identifier — the "Malformed
 * event identifier" 400 case is `eventIdParamsSchema`'s responsibility at
 * the HTTP boundary (Stage 6), mirroring patchEvent's contract above.
 */
export async function deleteEvent(id: string): Promise<void> {
  const deleted = await EventModel.findByIdAndDelete(id)

  if (!deleted) {
    throw new HttpError('NOT_FOUND', 'Event not found.')
  }
}
