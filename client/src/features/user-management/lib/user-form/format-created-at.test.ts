import { describe, expect, it } from 'vitest'
import { formatCreatedAt } from './format-created-at'

describe('formatCreatedAt', () => {
  it('formats an ISO instant in UTC, never the local timezone', () => {
    expect(formatCreatedAt('2026-01-15T23:30:00.000Z')).toBe('Jan 15, 2026, 11:30 PM UTC')
  })
})
