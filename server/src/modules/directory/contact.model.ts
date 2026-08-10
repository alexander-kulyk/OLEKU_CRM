import mongoose, { Schema } from 'mongoose'
import { DEFAULT_DIRECTORY_STATUS, DIRECTORY_STATUSES, type DirectoryStatus } from './status.ts'

/**
 * A contact is a client-side person (e.g. a guardian) an event can invite
 * as an attendee. `contacts` is a domain people collection, distinct from
 * `users` (authentication-only — see server/CLAUDE.md).
 */
export interface ContactAttributes {
  firstName: string
  lastName: string
  email: string
  status: DirectoryStatus
}

const contactSchema = new Schema<ContactAttributes>(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: DIRECTORY_STATUSES,
      default: DEFAULT_DIRECTORY_STATUS,
    },
  },
  {
    // Bind explicitly rather than relying on Mongoose's pluralization of
    // the model name (design.md D8) — the collection name stays correct
    // even if the model name above ever changes.
    collection: 'contacts',
    // No persistence metadata beyond what's declared above; a bare
    // Mongoose version key isn't part of the contract in
    // specs/directory-api/spec.md ("SHALL NOT expose persistence
    // metadata") and would otherwise be a spurious diff between two seed
    // runs of the same logical record.
    versionKey: false,
  },
)

// design.md D8: directory collections declare exactly this compound index
// and no unique index on email — U-001 has not ruled out existing
// duplicate values.
contactSchema.index({ status: 1, lastName: 1, firstName: 1, _id: 1 })

export const ContactModel = mongoose.model<ContactAttributes>('Contact', contactSchema)
