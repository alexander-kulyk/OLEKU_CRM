import { describe, expect, it } from 'vitest'
import { getDirectoryErrorMessage } from './directory-error-messages'
import type { DirectoryOperation } from './directory-error-messages'
import { TRANSPORT_ERROR_CODE } from './error'

/**
 * Regression coverage for the existing `(operation, code)` copy table
 * (design.md D4): the Users error-code additions in `error.ts` must not
 * change a single existing directory mapping.
 */
describe('getDirectoryErrorMessage regression', () => {
  it('returns each operation default for a code with no override', () => {
    expect(getDirectoryErrorMessage('load-attendees', TRANSPORT_ERROR_CODE)).toBe(
      'Attendees could not be loaded. Please try again.',
    )
    expect(getDirectoryErrorMessage('load-hosts', TRANSPORT_ERROR_CODE)).toBe(
      'Hosts could not be loaded. Please try again.',
    )
  })

  it('returns each operation default for an existing shared code with no override', () => {
    expect(getDirectoryErrorMessage('load-attendees', 'VALIDATION_ERROR')).toBe(
      'Attendees could not be loaded. Please try again.',
    )
    expect(getDirectoryErrorMessage('load-hosts', 'INTERNAL_ERROR')).toBe(
      'Hosts could not be loaded. Please try again.',
    )
  })

  it('falls back to each operation default for a new Users-only code', () => {
    const operations: readonly DirectoryOperation[] = ['load-attendees', 'load-hosts']

    expect(getDirectoryErrorMessage(operations[0], 'EMAIL_ALREADY_EXISTS')).toBe(
      'Attendees could not be loaded. Please try again.',
    )
    expect(getDirectoryErrorMessage(operations[1], 'EMAIL_ALREADY_EXISTS')).toBe(
      'Hosts could not be loaded. Please try again.',
    )
  })
})
