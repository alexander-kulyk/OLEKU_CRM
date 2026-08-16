import { z } from 'zod'
import { HttpError } from './error-envelope.ts'

/**
 * Parses `data` — a caller-supplied `req.params`, `req.query`, or
 * `req.body` — against `schema` and returns the parsed value.
 *
 * This never reads or assigns any Express request property itself: the
 * caller passes in exactly the piece it wants validated, and gets back a
 * plain parsed value. That keeps it safe to call against `req.query`, which
 * Express 5 exposes as a getter with no setter — there is nothing here that
 * could attempt `req.query = ...` or mutate any other request property.
 *
 * Throws a `VALIDATION_ERROR` `HttpError` with a safe, human-readable
 * message on failure. Controllers and services see only the returned
 * parsed value or the thrown error; they never see a raw `ZodError`.
 */
export function validate<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data)

  if (!result.success) {
    const { issues } = result.error
    const hasOnlyUnrecognizedKeys = issues.every(
      (issue) => issue.code === 'unrecognized_keys',
    )
    const hasNoChangesIssue =
      issues.length === 1 &&
      issues[0].code === 'custom' &&
      issues[0].params?.errorCode === 'NO_CHANGES_SUBMITTED'
    const code = hasOnlyUnrecognizedKeys
      ? 'UNKNOWN_FIELD'
      : hasNoChangesIssue
        ? 'NO_CHANGES_SUBMITTED'
        : 'VALIDATION_ERROR'
    const unrecognizedKeys = hasOnlyUnrecognizedKeys
      ? issues.flatMap((issue) =>
          issue.code === 'unrecognized_keys' ? issue.keys : [],
        )
      : []
    const field = hasOnlyUnrecognizedKeys
      ? unrecognizedKeys.length === 1
        ? unrecognizedKeys[0]
        : undefined
      : issues.length === 1 &&
          issues[0].path.length === 1 &&
          typeof issues[0].path[0] === 'string'
        ? issues[0].path[0]
        : undefined

    throw new HttpError(code, z.prettifyError(result.error), field)
  }

  return result.data
}
