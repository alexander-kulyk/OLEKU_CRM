import mongoose, { Schema } from 'mongoose'
import { DEFAULT_DIRECTORY_STATUS, DIRECTORY_STATUSES, type DirectoryStatus } from './status.ts'

/**
 * An employee is a staff-side person an event can invite as a host.
 * `employees` is a domain people collection, distinct from `users`
 * (authentication-only — see server/CLAUDE.md); no model is declared for
 * `users` here or anywhere in this change.
 */
export interface EmployeeAttributes {
  firstName: string
  lastName: string
  email: string
  status: DirectoryStatus
  position: string
  department: string
  canHostEvents: boolean
}

const employeeSchema = new Schema<EmployeeAttributes>(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: DIRECTORY_STATUSES,
      default: DEFAULT_DIRECTORY_STATUS,
    },
    position: { type: String, required: true, trim: true },
    department: { type: String, required: true, trim: true },
    canHostEvents: { type: Boolean, default: false },
  },
  {
    // Bind explicitly rather than relying on Mongoose's pluralization of
    // the model name (design.md D8).
    collection: 'employees',
    versionKey: false,
  },
)

// design.md D8: directory collections declare exactly this compound index
// and no unique index on email — U-001 has not ruled out existing
// duplicate values.
employeeSchema.index({ status: 1, lastName: 1, firstName: 1, _id: 1 })

export const EmployeeModel = mongoose.model<EmployeeAttributes>('Employee', employeeSchema)
