import mongoose, { Schema } from 'mongoose'
import { USER_STATUSES, type UserStatus } from './user-status.ts'

export interface UserAddress {
  country?: string
  city?: string
  street?: string
  postalCode?: string
}

export interface UserAttributes {
  firstName: string
  lastName: string
  email: string
  emailNormalized: string
  phone: string | null
  phoneExtension: string | null
  address: UserAddress | null
  status: UserStatus
  lastLoginAt: Date | null
  archivedAt: Date | null
  version: number
  firstNameFolded: string
  lastNameFolded: string
  fullNameFolded: string
  fullNameReversedFolded: string
  phoneDigits: string
  statusRank: number
  lastLoginRank: number
  createdAt: Date
  updatedAt: Date
}

const addressSchema = new Schema<UserAddress>(
  {
    country: { type: String },
    city: { type: String },
    street: { type: String },
    postalCode: { type: String },
  },
  { _id: false },
)

const userSchema = new Schema<UserAttributes>(
  {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true },
    emailNormalized: { type: String, required: true },
    phone: { type: String, default: null },
    phoneExtension: { type: String, default: null },
    address: { type: addressSchema, default: null },
    status: { type: String, enum: USER_STATUSES, required: true },
    lastLoginAt: { type: Date, default: null },
    archivedAt: { type: Date, default: null },
    version: { type: Number, required: true },
    firstNameFolded: { type: String, required: true },
    lastNameFolded: { type: String, required: true },
    fullNameFolded: { type: String, required: true },
    fullNameReversedFolded: { type: String, required: true },
    phoneDigits: { type: String, required: true },
    statusRank: { type: Number, required: true },
    lastLoginRank: { type: Number, required: true },
  },
  {
    // Indexes are provisioned explicitly only after Stage 9 verifies the
    // target database contains no duplicate normalized emails.
    autoIndex: false,
    collection: 'users',
    timestamps: true,
    versionKey: false,
  },
)

userSchema.index(
  { emailNormalized: 1 },
  { unique: true, name: 'users_email_normalized_unique' },
)
userSchema.index(
  { archivedAt: 1, lastName: 1, firstName: 1, _id: 1 },
  {
    collation: { locale: 'uk', strength: 2 },
    name: 'users_name_order',
  },
)
userSchema.index(
  { archivedAt: 1, lastName: -1, firstName: -1, _id: 1 },
  {
    collation: { locale: 'uk', strength: 2 },
    name: 'users_last_name_desc_order',
  },
)
userSchema.index(
  { archivedAt: 1, firstName: 1, lastName: 1, _id: 1 },
  {
    collation: { locale: 'uk', strength: 2 },
    name: 'users_first_name_asc_order',
  },
)
userSchema.index(
  { archivedAt: 1, firstName: -1, lastName: -1, _id: 1 },
  {
    collation: { locale: 'uk', strength: 2 },
    name: 'users_first_name_desc_order',
  },
)
userSchema.index(
  { archivedAt: 1, statusRank: 1, _id: 1 },
  { name: 'users_status_asc_order' },
)
userSchema.index(
  { archivedAt: 1, statusRank: -1, _id: 1 },
  { name: 'users_status_desc_order' },
)
userSchema.index(
  { archivedAt: 1, lastLoginRank: 1, lastLoginAt: 1, _id: 1 },
  { name: 'users_last_login_asc_order' },
)
userSchema.index(
  { archivedAt: 1, lastLoginRank: 1, lastLoginAt: -1, _id: 1 },
  { name: 'users_last_login_desc_order' },
)

for (const key of [
  'firstNameFolded',
  'lastNameFolded',
  'fullNameFolded',
  'fullNameReversedFolded',
  'emailNormalized',
  'phoneDigits',
] as const) {
  userSchema.index(
    { archivedAt: 1, [key]: 1, _id: 1 },
    { name: `users_${key}_search` },
  )
}

export const UserModel = mongoose.model<UserAttributes>('User', userSchema)
