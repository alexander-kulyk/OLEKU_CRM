import type { FC } from 'react'

/**
 * Placeholder for the `/analytics` destination (specs/app-navigation/spec.md
 * — "Analytics and Users are reserved placeholders"). Issues no API
 * request.
 */
export const AnalyticsPage: FC = () => {
  return (
    <div className="flex h-full flex-col gap-sm">
      <h1 className="text-2xl font-semibold text-text">Analytics</h1>
      <p className="text-text-muted">
        Analytics is not yet available.
      </p>
    </div>
  )
}
