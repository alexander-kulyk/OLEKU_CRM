import type { FC } from 'react'
import { Link } from 'react-router'

/**
 * Rendered inside the app shell for any path that matches no route
 * (specs/app-navigation/spec.md — "Unmatched paths are handled"). Offers a
 * way back to the calendar; the shell's menu stays mounted and usable
 * around it.
 */
export const NotFoundPage: FC = () => {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-md text-center">
      <h1 className="text-2xl font-semibold text-text">Page not found</h1>
      <p className="text-text-muted">
        The page you're looking for doesn't exist.
      </p>
      <Link
        to="/events"
        className="font-medium text-primary-600 hover:text-primary-700"
      >
        Back to Calendar
      </Link>
    </div>
  )
}
