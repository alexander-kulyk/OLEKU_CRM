import mongoose, { Schema, Types } from 'mongoose'
import { DEFAULT_EVENT_COLOR, EVENT_COLOR_PATTERN } from './event-color.ts'

/**
 * A calendar event. `events` is a domain collection distinct from `users`
 * (authentication-only — see server/CLAUDE.md).
 *
 * `attendeeIds` resolve to `contacts` and `hostIds` resolve to `employees`
 * (design.md D6) — this model only stores the bare ids. Role separation is
 * enforced by event.service.ts querying the role-specific directory
 * collection during participant validation, not by a Mongoose `ref` here.
 */
export interface EventAttributes {
  title: string
  startAt: Date
  endAt: Date
  color: string
  attendeeIds: Types.ObjectId[]
  hostIds: Types.ObjectId[]
  createdByUserId: Types.ObjectId | null
  updatedByUserId: Types.ObjectId | null
}

const eventSchema = new Schema<EventAttributes>(
  {
    title: { type: String, required: true, trim: true },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    // The event's display color (event-color.ts). `default` covers a write
    // path that omits it; `match` is the persistence backstop for the hex
    // shape that event.schema.ts enforces at the boundary, in the same
    // defense-in-depth spirit as the span hook below. Documents written
    // before this field existed carry no value at all — event.service.ts
    // substitutes the default when mapping them to a payload, since a
    // Mongoose `default` only ever applies to newly created documents.
    color: {
      type: String,
      required: true,
      default: DEFAULT_EVENT_COLOR,
      trim: true,
      lowercase: true,
      match: EVENT_COLOR_PATTERN,
    },
    attendeeIds: { type: [Schema.Types.ObjectId], default: [] },
    hostIds: { type: [Schema.Types.ObjectId], default: [] },
    // Nullable and server-controlled (specs/event-api/spec.md, "Audit
    // fields are server-controlled") — no authentication exists yet, so no
    // client-supplied value is ever trustworthy. event.schema.ts never
    // accepts these fields from a request body in the first place, and
    // event.service.ts additionally always writes both as null itself
    // rather than relying only on that stripping (design.md D2).
    createdByUserId: { type: Schema.Types.ObjectId, default: null },
    updatedByUserId: { type: Schema.Types.ObjectId, default: null },
  },
  {
    // Bind explicitly rather than relying on Mongoose's pluralization of
    // the model name (design.md D8), matching contact.model.ts /
    // employee.model.ts.
    collection: 'events',
    // No persistence metadata beyond what's declared above — mirrors the
    // directory models; see contact.model.ts for the rationale.
    versionKey: false,
  },
)

// design.md D8: the one declared event index, serving the period-overlap
// read query `startAt < to AND endAt > from` that Stage 6 adds.
eventSchema.index({ startAt: 1, endAt: 1 })

// design.md D5: the persistence backstop for the primary `endAt > startAt`
// invariant. event.service.ts's shared span check is the primary
// enforcement and runs before either write path ever reaches save() — this
// hook is defense in depth for any write path that might bypass it. It
// matters specifically because `validate` is Mongoose document middleware:
// it fires on `save()` but never on a bare query update (research.md
// F-009), which is exactly why every event write in this change goes
// through load-merge-save rather than `updateOne`/`findOneAndUpdate`
// (design.md D4).
eventSchema.pre('validate', function () {
  if (
    this.startAt instanceof Date &&
    this.endAt instanceof Date &&
    this.endAt.getTime() <= this.startAt.getTime()
  ) {
    this.invalidate('endAt', 'endAt must be strictly later than startAt.')
  }
})

export const EventModel = mongoose.model<EventAttributes>('Event', eventSchema)
