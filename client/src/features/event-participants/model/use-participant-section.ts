import { useCallback, useMemo, useState } from 'react'
import type { EventParticipant } from '../../../shared/api'
import { dedupeById } from '../lib/dedupe-participants'
import { getParticipantRoleConfig } from './participant-role-config'
import type { ParticipantRole } from './participant-role-config'
import { useDirectoryOptions } from './use-directory-options'
import type { DirectoryLoadStatus } from './use-directory-options'

export interface UseParticipantSectionParams {
  readonly role: ParticipantRole
  readonly assigned: readonly EventParticipant[]
  readonly onAssignedChange: (people: readonly EventParticipant[]) => void
}

export interface UseParticipantSectionResult {
  readonly title: string
  readonly search: string
  readonly availableOptions: readonly EventParticipant[]
  readonly pendingSelectionIds: ReadonlySet<string>
  readonly status: DirectoryLoadStatus
  readonly errorMessage: string | null
  readonly emptyMessage: string
  readonly isAddDisabled: boolean
  readonly handlers: {
    readonly handleSearchChange: (value: string) => void
    readonly handleTogglePending: (personId: string) => void
    readonly handleAdd: () => void
    readonly handleRemove: (personId: string) => void
    readonly retry: () => void
  }
}

/**
 * All state and behavior for one participant section — attendee or host —
 * (specs/event-participants/spec.md). `assigned`/`onAssignedChange` are
 * controlled by the caller (`event-dialog`'s form state), because the
 * assigned list must survive into the save payload (R-006); everything
 * else — search text, the directory load, and the pending selection before
 * Add — is local to this hook.
 */
export function useParticipantSection({
  role,
  assigned,
  onAssignedChange,
}: UseParticipantSectionParams): UseParticipantSectionResult {
  const config = getParticipantRoleConfig(role)
  const [search, setSearch] = useState('')
  const [pendingSelectionIds, setPendingSelectionIds] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  )

  const { options, status, error, retry } = useDirectoryOptions(role, search)

  const assignedIds = useMemo(() => new Set(assigned.map((person) => person.id)), [assigned])

  // Already-assigned people are never offered again — the selector itself
  // enforces "No duplicate assignments" rather than relying only on the
  // Add step's own check below (specs/event-participants/spec.md).
  const availableOptions = useMemo(
    () => options.filter((option) => !assignedIds.has(option.id)),
    [options, assignedIds],
  )

  const emptyMessage = search.trim() === '' ? config.emptyStateMessage : config.noMatchesMessage

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value)
    // A new search presents a different option set — a selection made
    // against the previous set is no longer visible, so it is cleared
    // rather than silently held and possibly dropped on the next Add.
    setPendingSelectionIds(new Set())
  }, [])

  const handleTogglePending = useCallback((personId: string) => {
    setPendingSelectionIds((current) => {
      const next = new Set(current)

      if (next.has(personId)) {
        next.delete(personId)
      } else {
        next.add(personId)
      }

      return next
    })
  }, [])

  const handleAdd = useCallback(() => {
    if (pendingSelectionIds.size === 0) {
      return
    }

    const selectedPeople = availableOptions.filter((option) => pendingSelectionIds.has(option.id))
    // Defense in depth: re-checked against the assigned list here too, and
    // deduped by id, even though `availableOptions` already excludes
    // assigned people and `pendingSelectionIds` is a `Set` that cannot
    // hold a duplicate id (specs/event-participants/spec.md — "No
    // duplicate assignments").
    const newPeople = dedupeById(selectedPeople.filter((person) => !assignedIds.has(person.id)))

    if (newPeople.length > 0) {
      onAssignedChange([...assigned, ...newPeople])
    }

    setPendingSelectionIds(new Set())
  }, [pendingSelectionIds, availableOptions, assignedIds, assigned, onAssignedChange])

  const handleRemove = useCallback(
    (personId: string) => {
      onAssignedChange(assigned.filter((person) => person.id !== personId))
    },
    [assigned, onAssignedChange],
  )

  return {
    title: config.title,
    search,
    availableOptions,
    pendingSelectionIds,
    status,
    errorMessage: error,
    emptyMessage,
    isAddDisabled: pendingSelectionIds.size === 0,
    handlers: { handleSearchChange, handleTogglePending, handleAdd, handleRemove, retry },
  }
}
