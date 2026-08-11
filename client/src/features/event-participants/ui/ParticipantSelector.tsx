import type { ChangeEvent, FC } from 'react'
import type { EventParticipant } from '../../../shared/api'
import type { DirectoryLoadStatus } from '../model/use-directory-options'

interface ParticipantSelectorProps {
  readonly ariaLabel: string
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

const SEARCH_INPUT_CLASS_NAME =
  'rounded-md border border-border bg-surface px-md py-sm text-sm text-text disabled:cursor-not-allowed disabled:opacity-60'
const OPTION_LIST_CLASS_NAME =
  'flex max-h-40 flex-col gap-xs overflow-y-auto rounded-md border border-border p-sm'
const RETRY_BUTTON_CLASS_NAME =
  'self-start rounded-md border border-border px-sm py-xs text-xs font-medium text-text hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60'

interface ParticipantOptionRowProps {
  readonly person: EventParticipant
  readonly isChecked: boolean
  readonly onToggle: (personId: string) => void
  readonly isDisabled: boolean
}

const ParticipantOptionRow: FC<ParticipantOptionRowProps> = ({
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
      <label className="flex items-center gap-sm text-sm text-text">
        <input type="checkbox" checked={isChecked} onChange={handleChange} disabled={isDisabled} />
        {person.fullName}
      </label>
    </li>
  )
}

/**
 * The searchable multi-select control shared by the attendee and host
 * sections (specs/event-participants/spec.md — "Attendee and host
 * selectors"; task 6.2). Purely presentational: all state (search text,
 * pending selection, loaded options, load status) lives in
 * `useParticipantSection`/`useDirectoryOptions`; this component only
 * renders it and reports events up.
 *
 * The loading, error+retry, empty/no-matches, and populated-list branches
 * are separate `status`-driven code paths — a load failure is never
 * conflated with "the directory has no one to offer" (task 6.7, 6.8).
 */
export const ParticipantSelector: FC<ParticipantSelectorProps> = ({
  ariaLabel,
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
    <div className="flex flex-col gap-xs">
      <input
        type="search"
        value={searchValue}
        onChange={handleSearchInputChange}
        placeholder={`Search ${ariaLabel.toLowerCase()}…`}
        aria-label={`Search ${ariaLabel}`}
        disabled={isDisabled}
        className={SEARCH_INPUT_CLASS_NAME}
      />

      {status === 'error' && (
        <div className="flex flex-col items-start gap-xs">
          <p role="alert" className="text-sm text-danger">
            {errorMessage}
          </p>
          <button
            type="button"
            onClick={onRetry}
            disabled={isDisabled}
            className={RETRY_BUTTON_CLASS_NAME}
          >
            Retry
          </button>
        </div>
      )}

      {status === 'loading' && <p className="text-sm text-text-muted">Loading…</p>}

      {status === 'success' && options.length === 0 && (
        <p className="text-sm text-text-muted">{emptyMessage}</p>
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
