import type { FC } from 'react'
import type { EventParticipant } from '../../../shared/api'

interface ParticipantChipListProps {
  readonly people: readonly EventParticipant[]
  readonly onRemove: (personId: string) => void
  readonly isDisabled: boolean
}

const CHIP_CLASS_NAME =
  'flex items-center gap-xs rounded-full bg-surface-muted px-sm py-xs text-sm text-text'
const REMOVE_BUTTON_CLASS_NAME =
  'rounded-full px-xs leading-none text-text-muted hover:text-text disabled:cursor-not-allowed disabled:opacity-60'

interface ParticipantChipProps {
  readonly person: EventParticipant
  readonly onRemove: (personId: string) => void
  readonly isDisabled: boolean
}

const ParticipantChip: FC<ParticipantChipProps> = ({ person, onRemove, isDisabled }) => {
  const handleRemoveClick = (): void => {
    onRemove(person.id)
  }

  return (
    <li className={CHIP_CLASS_NAME}>
      <span>{person.fullName}</span>
      <button
        type="button"
        onClick={handleRemoveClick}
        disabled={isDisabled}
        aria-label={`Remove ${person.fullName}`}
        className={REMOVE_BUTTON_CLASS_NAME}
      >
        <span aria-hidden="true">×</span>
      </button>
    </li>
  )
}

/**
 * Renders each assigned person as a chip with their name and a remove
 * control (specs/event-participants/spec.md — "Assigned people are listed
 * and removable"). Activating a chip's remove control reports only that
 * person's id up — the caller filters its own assigned list, so the other
 * assignments and the rest of the (still-open) dialog are untouched.
 */
export const ParticipantChipList: FC<ParticipantChipListProps> = ({
  people,
  onRemove,
  isDisabled,
}) => {
  if (people.length === 0) {
    return null
  }

  return (
    <ul className="flex flex-wrap gap-xs">
      {people.map((person) => (
        <ParticipantChip key={person.id} person={person} onRemove={onRemove} isDisabled={isDisabled} />
      ))}
    </ul>
  )
}
