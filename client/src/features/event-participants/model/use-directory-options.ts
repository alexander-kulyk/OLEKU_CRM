import { useCallback, useEffect, useRef, useState } from 'react'
import { getApiErrorCode, getDirectoryErrorMessage } from '../../../shared/api'
import type { EventParticipant } from '../../../shared/api'
import { getParticipantRoleConfig } from './participant-role-config'
import type { ParticipantRole } from './participant-role-config'

export type DirectoryLoadStatus = 'loading' | 'success' | 'error'

export interface UseDirectoryOptionsResult {
  readonly options: readonly EventParticipant[]
  readonly status: DirectoryLoadStatus
  readonly error: string | null
  readonly retry: () => void
}

/**
 * Loads one role's directory options and re-runs whenever `search`
 * changes — search text is always sent to the directory service, never
 * used to filter a held list (specs/event-participants/spec.md — "Search
 * is resolved by the directory service"; R-008). Errors are mapped through
 * the same `(operation, code)` pattern design.md D4 applies to event
 * operations; the server's `message` is never read.
 *
 * A monotonically increasing request id discards a response for a search
 * that is no longer current — the same stale-response principle the
 * calendar's period read uses (design.md D2) — so a slow response for an
 * earlier keystroke can never overwrite a newer one.
 */
export function useDirectoryOptions(role: ParticipantRole, search: string): UseDirectoryOptionsResult {
  const [options, setOptions] = useState<readonly EventParticipant[]>([])
  const [status, setStatus] = useState<DirectoryLoadStatus>('loading')
  const [error, setError] = useState<string | null>(null)
  const [retryToken, setRetryToken] = useState(0)
  const latestRequestIdRef = useRef(0)

  useEffect(() => {
    const config = getParticipantRoleConfig(role)
    const requestId = latestRequestIdRef.current + 1
    latestRequestIdRef.current = requestId

    const trimmedSearch = search.trim()

    setStatus('loading')
    setError(null)

    config
      .fetchOptions(trimmedSearch === '' ? undefined : trimmedSearch)
      .then((result) => {
        if (latestRequestIdRef.current !== requestId) {
          // A newer search or retry superseded this response — discard it
          // rather than render options for a term the user already moved
          // past.
          return
        }

        setOptions(result)
        setStatus('success')
      })
      .catch((thrown: unknown) => {
        if (latestRequestIdRef.current !== requestId) {
          return
        }

        setOptions([])
        setStatus('error')
        setError(getDirectoryErrorMessage(config.loadOperation, getApiErrorCode(thrown)))
      })
  }, [role, search, retryToken])

  const retry = useCallback(() => {
    setRetryToken((token) => token + 1)
  }, [])

  return { options, status, error, retry }
}
