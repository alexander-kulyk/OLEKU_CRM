import type { FC } from 'react'
import type { EventParticipant } from '../../../shared/api'
import type { ParticipantRole } from '../model/participant-role-config'
import { useParticipantSection } from '../model/use-participant-section'
import { ParticipantChipList } from './ParticipantChipList'
import { ParticipantSelector } from './ParticipantSelector'

interface ParticipantSectionProps {
  readonly role: ParticipantRole
  /** The event's currently assigned people for this role — form state owned by the caller (R-006). */
  readonly assigned: readonly EventParticipant[]
  readonly onAssignedChange: (people: readonly EventParticipant[]) => void
  readonly isDisabled?: boolean
}

const ADD_BUTTON_CLASS_NAME =
  'self-start rounded-md bg-primary-600 px-md py-xs text-sm font-medium text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60'

/**
 * The Attendees / Hosts section of the Event dialog
 * (specs/event-participants/spec.md), used once per role by `event-dialog`.
 * Composes the shared selector, the explicit Add step, and the assigned
 * chip list — every behavior lives in `useParticipantSection`, this
 * component is markup only.
 *
 * `assigned`/`onAssignedChange` are controlled by the caller rather than
 * owned here, because the assigned list must survive into `event-dialog`'s
 * save payload (specs/event-participants/spec.md — "A save transmits the
 * complete intended participant sets"); this feature never persists
 * anything itself.
 */
export const ParticipantSection: FC<ParticipantSectionProps> = ({
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
    <section className="flex flex-col gap-sm rounded-md border border-border p-md">
      <h3 className="text-sm font-semibold text-text">{title}</h3>

      <ParticipantSelector
        ariaLabel={title}
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

      <button
        type="button"
        onClick={handlers.handleAdd}
        disabled={isAddDisabled || isDisabled}
        className={ADD_BUTTON_CLASS_NAME}
      >
        Add
      </button>

      <ParticipantChipList people={assigned} onRemove={handlers.handleRemove} isDisabled={isDisabled} />
    </section>
  )
}
