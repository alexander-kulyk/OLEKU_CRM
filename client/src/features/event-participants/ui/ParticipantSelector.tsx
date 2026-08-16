import type React from 'react'
import type { ChangeEvent } from 'react'
import { AlertCircleSVG, SpinnerSVG } from '../../../../assets'
import type { EventParticipant } from '../../../shared/api'
import { Button, Input } from '../../../shared/ui'
import type { DirectoryLoadStatus } from '../model/use-directory-options'

interface IParticipantSelectorProps {
  /** Doubles as the field's visible label — "Attendees" / "Hosts". */
  readonly label: string
  readonly searchValue: string
  readonly onSearchChange: (value: string) => void
  readonly options: readonly EventParticipant[]
  readonly pendingSelectionIds: ReadonlySet<string>
  readonly onTogglePending: (personId: string) => void
  readonly status: DirectoryLoadStatus
  readonly errorMessage: string | null
  readonly onRetry: () => void
  readonly emptyMessage: string
  readonly isDisabled: boolean
}

const OPTION_LIST_CLASS_NAME = [
  'flex max-h-44 flex-col gap-xs overflow-y-auto rounded-md',
  'border border-line bg-surface p-xs shadow-rest',
].join(' ')
const OPTION_ROW_CLASS_NAME =
  'flex cursor-pointer items-center gap-sm rounded-sm px-sm py-xs text-body text-ink hover:bg-surface-muted'
const STATUS_TEXT_CLASS_NAME = 'flex items-center gap-sm text-label font-normal text-ink-muted'

interface IParticipantOptionRowProps {
  readonly person: EventParticipant
  readonly isChecked: boolean
  readonly onToggle: (personId: string) => void
  readonly isDisabled: boolean
}

const ParticipantOptionRow: React.FC<IParticipantOptionRowProps> = ({
  person,
  isChecked,
  onToggle,
  isDisabled,
}) => {
  const handleChange = (): void => {
    onToggle(person.id)
  }

  return (
    <li>
      <label className={OPTION_ROW_CLASS_NAME}>
        <input
          type='checkbox'
          checked={isChecked}
          onChange={handleChange}
          disabled={isDisabled}
          className='size-4 shrink-0 accent-accent'
        />
        {person.fullName}
      </label>
    </li>
  )
}

/**
 * The searchable multi-select control shared by the attendee and host
 * sections (specs/event-participants/spec.md — "Attendee and host
 * selectors"). Purely presentational: all state (search text, pending
 * selection, loaded options, load status) lives in
 * `useParticipantSection`/`useDirectoryOptions`; this component only renders
 * it and reports events up.
 *
 * The search field is the shared `Input` primitive, so this section is the
 * same labelled control as every other field in the dialog — the shape the
 * combobox-with-chips people picker (assets/ui_kit/fields.png) will take
 * over from.
 *
 * The loading, error+retry, empty/no-matches, and populated-list branches
 * are separate `status`-driven code paths — a load failure is never
 * conflated with "the directory has no one to offer".
 */
export const ParticipantSelector: React.FC<IParticipantSelectorProps> = ({
  label,
  searchValue,
  onSearchChange,
  options,
  pendingSelectionIds,
  onTogglePending,
  status,
  errorMessage,
  onRetry,
  emptyMessage,
  isDisabled,
}) => {
  const handleSearchInputChange = (event: ChangeEvent<HTMLInputElement>): void => {
    onSearchChange(event.target.value)
  }

  return (
    <div className='flex flex-col gap-sm'>
      <Input
        type='search'
        label={label}
        value={searchValue}
        onChange={handleSearchInputChange}
        placeholder='Search people…'
        disabled={isDisabled}
      />

      {status === 'error' && (
        <div className='flex flex-col items-start gap-sm'>
          <p role='alert' className='flex items-center gap-xs text-label font-normal text-danger'>
            <AlertCircleSVG className='size-4 shrink-0' />
            {errorMessage}
          </p>
          <Button size='sm' onClick={onRetry} disabled={isDisabled}>
            Retry
          </Button>
        </div>
      )}

      {status === 'loading' && (
        <p className={STATUS_TEXT_CLASS_NAME}>
          <SpinnerSVG className='size-4 animate-spin' />
          Loading…
        </p>
      )}

      {status === 'success' && options.length === 0 && (
        <p className={STATUS_TEXT_CLASS_NAME}>{emptyMessage}</p>
      )}

      {status === 'success' && options.length > 0 && (
        <ul className={OPTION_LIST_CLASS_NAME}>
          {options.map((option) => (
            <ParticipantOptionRow
              key={option.id}
              person={option}
              isChecked={pendingSelectionIds.has(option.id)}
              onToggle={onTogglePending}
              isDisabled={isDisabled}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
