import type { RequestHandler } from 'express'
import { HttpError } from './error-envelope.ts'

/**
 * The terminal handler for any request that reaches the end of the router
 * stack unmatched. Always responds with the exact `NOT_FOUND` envelope and
 * never reflects `req.originalUrl`, the query string, or any other part of
 * the request back to the caller.
 *
 * Mount this after every feature router and immediately before
 * `errorMiddleware` — both terminal handlers must stay last.
 */
export const notFoundHandler: RequestHandler = (_req, res) => {
  const notFound = new HttpError(
    'NOT_FOUND',
    'The requested resource does not exist.',
  )

  res.status(notFound.status).json(notFound.toEnvelope())
}
