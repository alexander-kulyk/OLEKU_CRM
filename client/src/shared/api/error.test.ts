import axios from 'axios'
import type { AxiosResponse } from 'axios'
import { describe, expect, it } from 'vitest'
import {
  CANCELLED_ERROR_CODE,
  getApiErrorCode,
  isApiError,
  isCancelledError,
  toApiError,
  TRANSPORT_ERROR_CODE,
} from './error'
import type { ApiError, ServerErrorCode } from './error'

/**
 * Builds a fake `AxiosError` carrying the shared envelope, per EVID-004.
 * Only the fields `toApiError` actually reads are populated; the rest of
 * `AxiosResponse` is irrelevant to a fixture, so the object is narrowed
 * through `unknown` rather than typed loosely with `any`.
 */
function buildAxiosError(options: { status: number; data?: unknown }): unknown {
  const response = {
    status: options.status,
    data: options.data,
    statusText: '',
    headers: {},
  } as unknown as AxiosResponse

  return new axios.AxiosError(
    'Request failed',
    axios.AxiosError.ERR_BAD_REQUEST,
    undefined,
    undefined,
    response,
  )
}

/** Builds a fake `AxiosError` with no response at all — a transport failure. */
function buildTransportAxiosError(): unknown {
  return new axios.AxiosError(
    'Network Error',
    axios.AxiosError.ERR_NETWORK,
  )
}

describe('toApiError', () => {
  describe('recognised envelopes', () => {
    const recognisedCases: ReadonlyArray<{
      readonly code: ServerErrorCode
      readonly status: number
    }> = [
      { code: 'VALIDATION_ERROR', status: 400 },
      { code: 'NOT_FOUND', status: 404 },
      { code: 'INVALID_PARTICIPANT', status: 400 },
      { code: 'INTERNAL_ERROR', status: 500 },
      { code: 'EMAIL_ALREADY_EXISTS', status: 409 },
      { code: 'EMAIL_TAKEN_BY_ARCHIVED_USER', status: 409 },
      { code: 'USER_VERSION_CONFLICT', status: 409 },
      { code: 'USER_ARCHIVED', status: 409 },
      { code: 'NO_CHANGES_SUBMITTED', status: 400 },
      { code: 'UNKNOWN_FIELD', status: 400 },
      { code: 'CANNOT_ARCHIVE_SELF', status: 409 },
      { code: 'CANNOT_ARCHIVE_LAST_ADMINISTRATIVE_USER', status: 409 },
    ]

    it.each(recognisedCases)(
      'preserves $code at status $status',
      ({ code, status }) => {
        const error = buildAxiosError({
          status,
          data: { error: { code, message: 'server copy, never surfaced' } },
        })

        expect(toApiError(error)).toEqual<ApiError>({ code, status })
      },
    )

    it('preserves the optional field alongside a recognised code and status', () => {
      const error = buildAxiosError({
        status: 409,
        data: {
          error: {
            code: 'EMAIL_ALREADY_EXISTS',
            message: 'server copy, never surfaced',
            field: 'email',
          },
        },
      })

      expect(toApiError(error)).toEqual<ApiError>({
        code: 'EMAIL_ALREADY_EXISTS',
        field: 'email',
        status: 409,
      })
    })

    it('never carries a field when the envelope does not name one', () => {
      const error = buildAxiosError({
        status: 409,
        data: { error: { code: 'USER_VERSION_CONFLICT', message: 'stale' } },
      })

      const result = toApiError(error)

      expect(result).toEqual<ApiError>({ code: 'USER_VERSION_CONFLICT', status: 409 })
      expect('field' in result).toBe(false)
    })
  })

  describe('unknown envelopes', () => {
    it('collapses an unrecognised code to TRANSPORT_ERROR_CODE while preserving status', () => {
      const error = buildAxiosError({
        status: 400,
        data: { error: { code: 'SOMETHING_NEW', message: 'unrecognised' } },
      })

      expect(toApiError(error)).toEqual<ApiError>({
        code: TRANSPORT_ERROR_CODE,
        status: 400,
      })
    })

    it('collapses a non-envelope response body to TRANSPORT_ERROR_CODE', () => {
      const error = buildAxiosError({ status: 502, data: 'Bad Gateway' })

      expect(toApiError(error)).toEqual<ApiError>({
        code: TRANSPORT_ERROR_CODE,
        status: 502,
      })
    })

    it('collapses a missing response body to TRANSPORT_ERROR_CODE', () => {
      const error = buildAxiosError({ status: 500, data: undefined })

      expect(toApiError(error)).toEqual<ApiError>({
        code: TRANSPORT_ERROR_CODE,
        status: 500,
      })
    })
  })

  describe('cancellation', () => {
    it('normalises axios cancellation to CANCELLED_ERROR_CODE, not a transport failure', () => {
      const error = new axios.CanceledError('canceled')

      expect(toApiError(error)).toEqual<ApiError>({ code: CANCELLED_ERROR_CODE })
    })

    it('is distinguishable from a visible failure via isCancelledError', () => {
      const cancelled = toApiError(new axios.CanceledError('canceled'))
      const failed = toApiError(buildTransportAxiosError())

      expect(isCancelledError(cancelled)).toBe(true)
      expect(isCancelledError(failed)).toBe(false)
    })
  })

  describe('transport failures', () => {
    it('normalises a network failure with no response to TRANSPORT_ERROR_CODE with no status', () => {
      const result = toApiError(buildTransportAxiosError())

      expect(result).toEqual<ApiError>({ code: TRANSPORT_ERROR_CODE })
      expect('status' in result).toBe(false)
    })

    it('normalises a non-axios thrown value to TRANSPORT_ERROR_CODE', () => {
      expect(toApiError(new Error('boom'))).toEqual<ApiError>({
        code: TRANSPORT_ERROR_CODE,
      })
      expect(toApiError('boom')).toEqual<ApiError>({ code: TRANSPORT_ERROR_CODE })
      expect(toApiError(undefined)).toEqual<ApiError>({ code: TRANSPORT_ERROR_CODE })
    })
  })
})

describe('isApiError', () => {
  it('recognises a normalised ApiError', () => {
    expect(isApiError({ code: 'NOT_FOUND' })).toBe(true)
    expect(isApiError({ code: 'USER_VERSION_CONFLICT', status: 409 })).toBe(true)
  })

  it('rejects values without a string code', () => {
    expect(isApiError(null)).toBe(false)
    expect(isApiError(undefined)).toBe(false)
    expect(isApiError({})).toBe(false)
    expect(isApiError({ code: 404 })).toBe(false)
  })
})

describe('getApiErrorCode', () => {
  it('reads the code off an already-normalised ApiError', () => {
    expect(getApiErrorCode({ code: 'USER_ARCHIVED' })).toBe('USER_ARCHIVED')
  })

  it('falls back to TRANSPORT_ERROR_CODE for anything unrecognised', () => {
    expect(getApiErrorCode(new Error('boom'))).toBe(TRANSPORT_ERROR_CODE)
    expect(getApiErrorCode(null)).toBe(TRANSPORT_ERROR_CODE)
  })
})

describe('isCancelledError regression', () => {
  it('returns false for every existing recognised event/directory code', () => {
    const existingCodes: readonly ServerErrorCode[] = [
      'VALIDATION_ERROR',
      'NOT_FOUND',
      'INVALID_PARTICIPANT',
      'INTERNAL_ERROR',
    ]

    for (const code of existingCodes) {
      expect(isCancelledError({ code })).toBe(false)
    }
  })
})
