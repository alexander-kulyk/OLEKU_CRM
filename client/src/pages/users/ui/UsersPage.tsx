import type React from 'react'

/**
 * Placeholder for the `/users` destination (specs/app-navigation/spec.md —
 * "Users is a reserved placeholder"). Issues no API request.
 */
export const UsersPage: React.FC = () => {
  return (
    <div className='flex h-full flex-col gap-sm p-xl'>
      <h1 className='text-page-title text-ink'>Users</h1>
      <p className='text-body text-ink-muted'>Users is not yet available.</p>
    </div>
  )
}
