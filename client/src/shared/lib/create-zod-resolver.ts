import type { FieldError, FieldErrors, FieldValues, Resolver } from 'react-hook-form'
import type { ZodType } from 'zod'

/**
 * A minimal react-hook-form resolver bridging a zod schema, standing in for
 * `@hookform/resolvers/zod` — which is deliberately NOT a dependency here
 * (proposal.md Impact: "No other runtime dependency changes" beyond
 * `zustand`, added in Stage 1). `react-hook-form`'s `resolver` option is
 * just a function of shape `(values, context, options) => { values, errors
 * }`, so this calls `schema.safeParse(values)` directly and maps
 * `ZodError.issues` into react-hook-form's `FieldErrors` shape, keyed by
 * each issue's dotted field path — the same approach the real package
 * takes, without the extra dependency.
 */
export function createZodResolver<TFieldValues extends FieldValues>(
  schema: ZodType<TFieldValues>,
): Resolver<TFieldValues> {
  return (values) => {
    const result = schema.safeParse(values)

    if (result.success) {
      return { values: result.data, errors: {} }
    }

    const fieldErrors: Record<string, FieldError> = {}

    for (const issue of result.error.issues) {
      const fieldName = issue.path.join('.')

      // Keep the first message seen for a field — later issues on the same
      // path (e.g. a format check after a required check) add no value.
      if (fieldName.length === 0 || fieldName in fieldErrors) {
        continue
      }

      fieldErrors[fieldName] = { type: issue.code, message: issue.message }
    }

    return { values: {}, errors: fieldErrors as FieldErrors<TFieldValues> }
  }
}
