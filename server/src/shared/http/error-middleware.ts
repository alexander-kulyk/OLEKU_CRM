import type { ErrorRequestHandler } from 'express'
import { HttpError } from './error-envelope.ts'

const INTERNAL_ERROR_MESSAGE =
  'An unexpected error occurred. Please try again later.'

/**
 * The single terminal error handler for the whole app. A validation failure
 * raised by `validate()`, a typed domain failure such as `NOT_FOUND` or
 * `INVALID_PARTICIPANT`, and any other unexpected failure all arrive here —
 * either thrown synchronously or forwarded by Express 5 from a rejected
 * async controller.
 *
 * The underlying error is always logged server-side so it stays
 * diagnosable. The response never repeats it: a known `HttpError` returns
 * its own safe status/code/message, and anything else — including a raw
 * exception with a stack, a request URL, or MongoDB driver text in its
 * message — collapses to the generic `INTERNAL_ERROR` envelope. This holds
 * in every environment; there is no development-only stack trace.
 */
export const errorMiddleware: ErrorRequestHandler = (
  error,
  _req,
  res,
  _next,
) => {
  console.error('Unhandled request error:', error)

  if (error instanceof HttpError) {
    res.status(error.status).json(error.toEnvelope())
    return
  }

  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: INTERNAL_ERROR_MESSAGE },
  })
}
