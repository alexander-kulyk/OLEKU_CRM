/**
 * Static, centralized copy for the Edit User dialog (design.md D1 — "copy
 * stays in feature configuration"). Kept separate from `users-list-copy.ts`,
 * which is the list's own state copy.
 */
export const USER_FORM_COPY = {
  dialogTitlePrefix: 'Edit',
  loading: 'Loading user…',
  close: 'Close',
  firstNameLabel: 'First name',
  lastNameLabel: 'Last name',
  emailLabel: 'Email',
  phoneLabel: 'Phone',
  phoneHintWithRegion: 'Enter a national number, or an international number starting with +.',
  phoneHintWithoutRegion:
    'No deployment phone region is configured — enter the full international number starting with +.',
  phoneExtensionLabel: 'Phone extension',
  addressCountryLabel: 'Country',
  addressCityLabel: 'City',
  addressStreetLabel: 'Street',
  addressPostalCodeLabel: 'Postal code',
  statusLabel: 'Status',
  userIdLabel: 'User ID',
  lastLoginLabel: 'Last login',
  createdAtLabel: 'Created at',
  cancel: 'Cancel',
  save: 'Save changes',
  saving: 'Saving changes…',
  noChangesToSave: 'No changes to save.',
} as const
