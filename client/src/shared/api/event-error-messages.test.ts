import { describe, expect, it } from 'vitest'
import { getEventErrorMessage } from './event-error-messages'
import type { EventOperation } from './event-error-messages'
import { TRANSPORT_ERROR_CODE } from './error'

/**
 * Regression coverage for the existing `(operation, code)` copy table
 * (design.md D4): the Users error-code additions in `error.ts` must not
 * change a single existing event mapping.
 */
describe('getEventErrorMessage regression', () => {
  it('returns each operation default for a code with no override', () => {
    expect(getEventErrorMessage('load-events', TRANSPORT_ERROR_CODE)).toBe(
      'Events could not be loaded. Please try again.',
    )
    expect(getEventErrorMessage('create-event', TRANSPORT_ERROR_CODE)).toBe(
      'The event could not be created. Please try again.',
    )
    expect(getEventErrorMessage('update-event', TRANSPORT_ERROR_CODE)).toBe(
      'The event could not be updated. Please try again.',
    )
    expect(getEventErrorMessage('delete-event', TRANSPORT_ERROR_CODE)).toBe(
      'The event could not be deleted. Please try again.',
    )
  })

  it('overrides NOT_FOUND per write operation', () => {
    expect(getEventErrorMessage('update-event', 'NOT_FOUND')).toBe(
      'This event could no longer be found.',
    )
    expect(getEventErrorMessage('delete-event', 'NOT_FOUND')).toBe(
      'This event could no longer be found.',
    )
  })

  it('falls back to the load-events default for NOT_FOUND, which has no override there', () => {
    expect(getEventErrorMessage('load-events', 'NOT_FOUND')).toBe(
      'Events could not be loaded. Please try again.',
    )
  })

  it('overrides INVALID_PARTICIPANT on create and update', () => {
    const expected = "One of the selected participants can't be assigned to this event."

    expect(getEventErrorMessage('create-event', 'INVALID_PARTICIPANT')).toBe(expected)
    expect(getEventErrorMessage('update-event', 'INVALID_PARTICIPANT')).toBe(expected)
  })

  it('falls back to each operation default for a new Users-only code', () => {
    const usersOnlyOperations: readonly EventOperation[] = [
      'load-events',
      'create-event',
      'update-event',
      'delete-event',
    ]

    for (const operation of usersOnlyOperations) {
      expect(getEventErrorMessage(operation, 'USER_VERSION_CONFLICT')).not.toBe('')
    }

    expect(getEventErrorMessage('update-event', 'USER_VERSION_CONFLICT')).toBe(
      'The event could not be updated. Please try again.',
    )
  })
})
