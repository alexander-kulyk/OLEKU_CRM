import type React from 'react'
import type { EventParticipant } from '../../../shared/api'
import { Button } from '../../../shared/ui'
import type { ParticipantRole } from '../model/participant-role-config'
import { useParticipantSection } from '../model/use-participant-section'
import { ParticipantChipList } from './ParticipantChipList'
import { ParticipantSelector } from './ParticipantSelector'

interface IParticipantSectionProps {
  readonly role: ParticipantRole
  /** The event's currently assigned people for this role — form state owned by the caller (R-006). */
  readonly assigned: readonly EventParticipant[]
  readonly onAssignedChange: (people: readonly EventParticipant[]) => void
  readonly isDisabled?: boolean
}

/**
 * The Attendees / Hosts section of the Event dialog
 * (specs/event-participants/spec.md), used once per role by `event-dialog`.
 * Composes the shared selector, the explicit Add step, and the assigned
 * chip list — every behavior lives in `useParticipantSection`, this
 * component is markup only.
 *
 * The role name is the search field's own label rather than a separate
 * heading above it, so the section reads as one labelled control in the
 * dialog's field rhythm — the shape the people picker will replace.
 *
 * `assigned`/`onAssignedChange` are controlled by the caller rather than
 * owned here, because the assigned list must survive into `event-dialog`'s
 * save payload (specs/event-participants/spec.md — "A save transmits the
 * complete intended participant sets"); this feature never persists
 * anything itself.
 */
export const ParticipantSection: React.FC<IParticipantSectionProps> = ({
  role,
  assigned,
  onAssignedChange,
  isDisabled = false,
}) => {
  const {
    title,
    search,
    availableOptions,
    pendingSelectionIds,
    status,
    errorMessage,
    emptyMessage,
    isAddDisabled,
    handlers,
  } = useParticipantSection({ role, assigned, onAssignedChange })

  return (
    <section className='flex flex-col gap-sm'>
      <ParticipantSelector
        label={title}
        searchValue={search}
        onSearchChange={handlers.handleSearchChange}
        options={availableOptions}
        pendingSelectionIds={pendingSelectionIds}
        onTogglePending={handlers.handleTogglePending}
        status={status}
        errorMessage={errorMessage}
        onRetry={handlers.retry}
        emptyMessage={emptyMessage}
        isDisabled={isDisabled}
      />

      <Button
        size='sm'
        onClick={handlers.handleAdd}
        disabled={isAddDisabled || isDisabled}
        className='self-start'
      >
        Add
      </Button>

      <ParticipantChipList
        people={assigned}
        onRemove={handlers.handleRemove}
        isDisabled={isDisabled}
      />
    </section>
  )
}
