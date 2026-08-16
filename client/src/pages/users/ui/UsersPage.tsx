import type { FC } from 'react'

/**
 * Placeholder for the `/users` destination (specs/app-navigation/spec.md —
 * "Users is a reserved placeholder"). Issues no API request.
 */
export const UsersPage: FC = () => {
  return (
    <div className="flex h-full flex-col gap-sm">
      <h1 className="text-2xl font-semibold text-text">Users</h1>
      <p className="text-text-muted">Users is not yet available.</p>
    </div>
  )
}
