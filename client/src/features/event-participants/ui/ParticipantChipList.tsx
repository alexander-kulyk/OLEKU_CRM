import type React from 'react'
import { CloseSVG } from '../../../../assets'
import type { EventParticipant } from '../../../shared/api'

interface IParticipantChipListProps {
  readonly people: readonly EventParticipant[]
  readonly onRemove: (personId: string) => void
  readonly isDisabled: boolean
}

const CHIP_CLASS_NAME = [
  'flex items-center gap-sm rounded-full border border-line bg-surface-muted',
  'py-xs pl-md pr-sm text-label font-normal text-ink',
].join(' ')
const REMOVE_BUTTON_CLASS_NAME = [
  'flex size-4 items-center justify-center rounded-full text-ink-muted transition-colors',
  'hover:bg-surface-sunken hover:text-ink',
  'disabled:cursor-not-allowed disabled:opacity-60',
].join(' ')

interface IParticipantChipProps {
  readonly person: EventParticipant
  readonly onRemove: (personId: string) => void
  readonly isDisabled: boolean
}

const ParticipantChip: React.FC<IParticipantChipProps> = ({
  person,
  onRemove,
  isDisabled,
}) => {
  const handleRemoveClick = (): void => {
    onRemove(person.id)
  }

  return (
    <li className={CHIP_CLASS_NAME}>
      <span>{person.fullName}</span>
      <button
        type='button'
        onClick={handleRemoveClick}
        disabled={isDisabled}
        aria-label={`Remove ${person.fullName}`}
        className={REMOVE_BUTTON_CLASS_NAME}
      >
        <CloseSVG className='size-3' />
      </button>
    </li>
  )
}

/**
 * Renders each assigned person as a chip with their name and a remove
 * control (specs/event-participants/spec.md — "Assigned people are listed
 * and removable"), in the pill shape the kit uses for people
 * (assets/ui_kit/fields.png). Activating a chip's remove control reports only
 * that person's id up — the caller filters its own assigned list, so the
 * other assignments and the rest of the (still-open) dialog are untouched.
 */
export const ParticipantChipList: React.FC<IParticipantChipListProps> = ({
  people,
  onRemove,
  isDisabled,
}) => {
  if (people.length === 0) {
    return null
  }

  return (
    <ul className='flex flex-wrap gap-sm'>
      {people.map((person) => (
        <ParticipantChip
          key={person.id}
          person={person}
          onRemove={onRemove}
          isDisabled={isDisabled}
        />
      ))}
    </ul>
  )
}
