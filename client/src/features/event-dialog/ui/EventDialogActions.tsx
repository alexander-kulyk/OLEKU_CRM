import type { FC } from 'react'

interface EventDialogActionsProps {
  readonly mode: 'create' | 'edit'
  readonly isPrimaryDisabled: boolean
  readonly isSaving: boolean
  readonly onDeleteRequested: () => void
  readonly isDeleteDisabled: boolean
}

const PRIMARY_BUTTON_CLASS_NAME =
  'rounded-md bg-primary-600 px-lg py-sm text-sm font-medium text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60'
const DELETE_BUTTON_CLASS_NAME =
  'rounded-md border border-danger px-md py-sm text-sm font-medium text-danger hover:bg-danger-muted disabled:cursor-not-allowed disabled:opacity-60'

/**
 * The dialog's actions area (specs/event-management/spec.md — "Create and
 * Edit modes offer different actions"): Create mode offers only Save; Edit
 * mode offers Save changes and Delete, never Create's Save action alongside
 * them.
 */
export const EventDialogActions: FC<EventDialogActionsProps> = ({
  mode,
  isPrimaryDisabled,
  isSaving,
  onDeleteRequested,
  isDeleteDisabled,
}) => {
  const isEditMode = mode === 'edit'
  const primaryLabel = isEditMode ? 'Save changes' : 'Save'
  const primaryBusyLabel = isEditMode ? 'Saving changes…' : 'Saving…'

  return (
    <div className="flex items-center justify-between gap-md">
      <div>
        {isEditMode && (
          <button
            type="button"
            onClick={onDeleteRequested}
            disabled={isDeleteDisabled}
            className={DELETE_BUTTON_CLASS_NAME}
          >
            Delete
          </button>
        )}
      </div>

      <button type="submit" disabled={isPrimaryDisabled} className={PRIMARY_BUTTON_CLASS_NAME}>
        {isSaving ? primaryBusyLabel : primaryLabel}
      </button>
    </div>
  )
}
