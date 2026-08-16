import type React from 'react'
import { Link } from 'react-router'

/**
 * Rendered inside the app shell for any path that matches no route
 * (specs/app-navigation/spec.md — "Unmatched paths are handled"). Offers a
 * way back to the calendar; the shell's menu stays mounted and usable
 * around it.
 */
export const NotFoundPage: React.FC = () => {
  return (
    <div className='flex h-full flex-col items-center justify-center gap-md p-xl text-center'>
      <h1 className='text-page-title text-ink'>Page not found</h1>
      <p className='text-body text-ink-secondary'>
        The page you're looking for doesn't exist.
      </p>
      <Link
        to='/events'
        className='text-label text-accent transition-colors hover:text-accent-hover'
      >
        Back to Calendar
      </Link>
    </div>
  )
}
