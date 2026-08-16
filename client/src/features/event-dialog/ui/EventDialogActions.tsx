import type React from 'react'
import { TrashSVG } from '../../../../assets'
import { Button } from '../../../shared/ui'

interface IEventDialogActionsProps {
  readonly mode: 'create' | 'edit'
  readonly isPrimaryDisabled: boolean
  readonly isSaving: boolean
  readonly onCancel: () => void
  readonly onDeleteRequested: () => void
  readonly isDeleteDisabled: boolean
}

/**
 * The dialog's actions area (specs/event-management/spec.md — "Create and
 * Edit modes offer different actions"): Create mode offers only Save; Edit
 * mode offers Save changes and Delete, never Create's Save action alongside
 * them.
 *
 * Laid out as the kit specifies (assets/ui_kit/buttons.png): the destructive
 * action separated at the far left, the single primary action at the far
 * right with Cancel beside it, and the primary swapping to a spinner label
 * while the request is in flight.
 */
export const EventDialogActions: React.FC<IEventDialogActionsProps> = ({
  mode,
  isPrimaryDisabled,
  isSaving,
  onCancel,
  onDeleteRequested,
  isDeleteDisabled,
}) => {
  const isEditMode = mode === 'edit'
  const primaryLabel = isEditMode ? 'Save changes' : 'Save event'
  const primaryBusyLabel = isEditMode ? 'Saving changes…' : 'Saving…'

  return (
    <div className='flex flex-wrap items-center justify-between gap-md border-t border-line pt-lg'>
      <div>
        {isEditMode && (
          <Button
            variant='danger'
            onClick={onDeleteRequested}
            disabled={isDeleteDisabled}
            leadingIcon={<TrashSVG className='size-4' />}
          >
            Delete
          </Button>
        )}
      </div>

      <div className='flex items-center gap-sm'>
        <Button variant='secondary' onClick={onCancel} disabled={isSaving}>
          Cancel
        </Button>

        <Button
          type='submit'
          variant='primary'
          disabled={isPrimaryDisabled}
          isLoading={isSaving}
          loadingLabel={primaryBusyLabel}
        >
          {primaryLabel}
        </Button>
      </div>
    </div>
  )
}
