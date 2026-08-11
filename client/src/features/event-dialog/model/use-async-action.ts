import { useCallback, useRef, useState } from 'react'

export interface UseAsyncActionResult {
  readonly isPending: boolean
  readonly error: string | null
  /** Runs `action`, ignored while already in flight. Resolves to whether it succeeded. */
  readonly run: (action: () => Promise<void>) => Promise<boolean>
}

const GENERIC_ERROR_MESSAGE = 'The operation could not be completed. Please try again.'

/**
 * Runs one async operation at a time for the Event dialog's create/update/
 * delete flows, guarding re-entrancy with a ref rather than only state —
 * state updates are not guaranteed to have re-rendered (and so disabled the
 * triggering button) before a second, near-simultaneous activation reaches
 * this hook, but the ref is set synchronously on the first call
 * (specs/event-management/spec.md — "Repeated activation is ignored").
 *
 * The caller decides what "success" means (e.g. closing the dialog) from
 * this function's boolean return — this hook only tracks the loading state
 * and turns a thrown error into the message shown next to the dialog's
 * actions. The store's mutations already throw an `Error` whose `message`
 * is already the mapped, user-facing copy (design.md D4); it is used
 * as-is, never re-wrapped or replaced.
 */
export function useAsyncAction(): UseAsyncActionResult {
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isRunningRef = useRef(false)

  const run = useCallback(async (action: () => Promise<void>): Promise<boolean> => {
    if (isRunningRef.current) {
      return false
    }

    isRunningRef.current = true
    setIsPending(true)
    setError(null)

    try {
      await action()
      return true
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown.message : GENERIC_ERROR_MESSAGE)
      return false
    } finally {
      isRunningRef.current = false
      setIsPending(false)
    }
  }, [])

  return { isPending, error, run }
}
