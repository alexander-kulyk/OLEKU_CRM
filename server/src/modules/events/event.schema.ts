import { z } from 'zod'

/**
 * Every instant accepted by the event API — `from`/`to` on the calendar
 * read and `startAt`/`endAt` on writes — must be a full ISO 8601 instant
 * carrying either `Z` or a numeric UTC offset (specs/event-api/spec.md,
 * "Accepted instants are zone-explicit absolute moments"). Zod's default
 * `datetime()` accepts only `Z`; `{ offset: true }` additionally accepts
 * `+HH:MM` / `-HH:MM` (research.md F-005), and both a date-only value and a
 * zone-less value are rejected either way. Parsed straight into an absolute
 * `Date` (design.md D3) so every downstream consumer works with a real
 * instant rather than re-parsing a string.
 */
const instantField = z.iso.datetime({ offset: true }).transform((value) => new Date(value))

/**
 * specs/event-api/spec.md, "Event titles are meaningful": required,
 * trimmed before storage, and rejected when empty or whitespace-only.
 * `.trim()` runs before `.min()` sees the value, so a whitespace-only title
 * is caught here rather than reaching the service.
 */
const titleField = z.string().trim().min(1, 'Title is required.')

/**
 * Bare participant id arrays. De-duplication and existence/role/eligibility
 * checks happen in event.service.ts (design.md D6) — this layer only
 * shapes the wire format.
 */
const participantIdsField = z.array(z.string())

/**
 * `GET /api/events?from&to` (design.md D1). The route itself is wired in
 * Stage 6; the schema is declared here alongside the write schemas per
 * tasks.md 5.2. Both boundaries are required and `to` must be strictly
 * later than `from` (specs/event-api/spec.md, "Calendar reads use an exact
 * bounded route" — "Missing period boundary", "Inverted period").
 * `z.strictObject` rejects any query key beyond the two declared here.
 */
export const eventPeriodQuerySchema = z
  .strictObject({
    from: instantField,
    to: instantField,
  })
  .refine(
    (query) => {
      // Zod runs an object's `.refine()` even when one of its own fields
      // already failed to parse (that field's original, pre-transform
      // value — not a Date — is still what reaches here). Skip the
      // ordering check in that case rather than throw: the per-field issue
      // already reported is the one that matters.
      if (!(query.from instanceof Date) || !(query.to instanceof Date)) {
        return true
      }

      return query.to.getTime() > query.from.getTime()
    },
    {
      message: 'to must be later than from.',
      path: ['to'],
    },
  )

/**
 * `POST /api/events` body (specs/event-api/spec.md, "Events can be
 * created"). Omitted `attendeeIds` / `hostIds` default to an empty array
 * rather than staying `undefined` — create treats every submitted id as
 * newly assigned (design.md D6), so there is no "leave unchanged" state to
 * preserve the way PATCH has.
 *
 * A plain `z.object`, not `z.strictObject`: any other supplied key —
 * including a forged `createdByUserId` / `updatedByUserId` — is silently
 * stripped rather than rejected (design.md D2; specs/event-api/spec.md,
 * "Audit fields are server-controlled").
 */
export const eventCreateSchema = z.object({
  title: titleField,
  startAt: instantField,
  endAt: instantField,
  attendeeIds: participantIdsField.default([]),
  hostIds: participantIdsField.default([]),
})

/**
 * `PATCH /api/events/:id` body (specs/event-api/spec.md, "PATCH updates
 * only supplied fields"). Every field is optional so the caller may supply
 * any non-empty subset. An omitted `attendeeIds` / `hostIds` stays
 * `undefined` — distinct from a supplied empty array — so event.service.ts
 * can tell "leave this role unchanged" apart from "clear this role". The
 * `refine` rejects a body that supplies none of the five editable fields
 * ("Empty update body").
 */
export const eventPatchSchema = z
  .object({
    title: titleField.optional(),
    startAt: instantField.optional(),
    endAt: instantField.optional(),
    attendeeIds: participantIdsField.optional(),
    hostIds: participantIdsField.optional(),
  })
  .refine((patch) => Object.keys(patch).length > 0, {
    message: 'At least one of title, startAt, endAt, attendeeIds, or hostIds must be supplied.',
  })

const OBJECT_ID_PATTERN = /^[0-9a-f]{24}$/i

/**
 * The `:id` route param shared by PATCH and DELETE (specs/event-api/spec.md,
 * "Malformed event identifier"). A plain hex-shape check rather than a
 * Mongoose import keeps this module a pure boundary-validation layer with
 * no persistence dependency, matching directory.schema.ts.
 */
export const eventIdParamsSchema = z.strictObject({
  id: z.string().regex(OBJECT_ID_PATTERN, 'id must be a valid identifier.'),
})

export type EventPeriodQuery = z.infer<typeof eventPeriodQuerySchema>
export type CreateEventInput = z.infer<typeof eventCreateSchema>
export type PatchEventInput = z.infer<typeof eventPatchSchema>
export type EventIdParams = z.infer<typeof eventIdParamsSchema>
