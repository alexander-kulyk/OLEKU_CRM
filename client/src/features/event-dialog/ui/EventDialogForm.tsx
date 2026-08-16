import type React from 'react'
import { AlertCircleSVG, CloseSVG } from '../../../../assets'
import { ConfirmDialog, IconButton, Modal } from '../../../shared/ui'
import { ParticipantSection } from '../../event-participants'
import { useEventDialogController } from '../model/use-event-dialog-controller'
import type { OpenDialogTarget } from '../lib/event-dialog-schema'
import { EventDetailsFields } from './EventDetailsFields'
import { EventDialogActions } from './EventDialogActions'

interface IEventDialogFormProps {
  readonly target: OpenDialogTarget
}

const DIALOG_TITLE_ID = 'event-dialog-title'

/**
 * The Event dialog's Create/Edit form (specs/event-management/spec.md).
 * Mounted keyed by dialog target from `EventDialog` (design.md D2), so this
 * component — and every `useState` inside `useEventDialogController` —
 * initializes fresh exactly once per dialog target and is never reset by
 * later store/event-list churn. All state and behavior live in
 * {@link useEventDialogController}; this component is markup only.
 */
export const EventDialogForm: React.FC<IEventDialogFormProps> = ({ target }) => {
  const { values, handlers } = useEventDialogController({ target })

  const dialogTitle = values.mode === 'edit' ? 'Edit event' : 'Create event'

  return (
    <>
      <Modal onRequestClose={handlers.handleCloseAttempt} labelledBy={DIALOG_TITLE_ID}>
        <form onSubmit={handlers.submitForm} noValidate className='flex flex-col gap-xl'>
          <div className='flex items-center justify-between gap-md'>
            <h2 id={DIALOG_TITLE_ID} className='text-dialog-title text-ink'>
              {dialogTitle}
            </h2>
            <IconButton
              variant='ghost'
              size='sm'
              label='Close'
              icon={<CloseSVG className='size-4' />}
              onClick={handlers.handleCloseAttempt}
            />
          </div>

          <EventDetailsFields
            register={values.register}
            errors={values.errors}
            isDisabled={values.isPending}
          />

          <div className='flex flex-col gap-lg'>
            <ParticipantSection
              role='attendee'
              assigned={values.attendees}
              onAssignedChange={handlers.handleAttendeesChange}
              isDisabled={values.isPending}
            />
            <ParticipantSection
              role='host'
              assigned={values.hosts}
              onAssignedChange={handlers.handleHostsChange}
              isDisabled={values.isPending}
            />
          </div>

          {values.error && (
            <p
              role='alert'
              className='flex items-start gap-sm rounded-md border border-danger/25 bg-danger-tint p-md text-body text-danger'
            >
              <AlertCircleSVG className='mt-px size-4 shrink-0' />
              {values.error}
            </p>
          )}

          <EventDialogActions
            mode={values.mode}
            isPrimaryDisabled={!values.isFormValid || values.isPending}
            isSaving={values.isPending}
            onCancel={handlers.handleCloseAttempt}
            onDeleteRequested={handlers.handleDeleteRequested}
            isDeleteDisabled={values.isPending}
          />
        </form>
      </Modal>

      {values.isDeleteConfirmOpen && (
        <ConfirmDialog
          title='Delete this event?'
          message='This event will be permanently removed and cannot be recovered.'
          confirmLabel='Delete event'
          cancelLabel='Cancel'
          isDangerous
          isConfirming={values.isPending}
          onConfirm={handlers.handleDeleteConfirmed}
          onCancel={handlers.handleDeleteCancelled}
        />
      )}

      {values.isDiscardConfirmOpen && (
        <ConfirmDialog
          title='Discard changes?'
          message='Your unsaved changes will be lost.'
          confirmLabel='Discard changes'
          cancelLabel='Continue editing'
          onConfirm={handlers.handleDiscardConfirmed}
          onCancel={handlers.handleContinueEditing}
        />
      )}
    </>
  )
}
