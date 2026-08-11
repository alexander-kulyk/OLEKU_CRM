import type { FC } from 'react'
import { ConfirmDialog, Modal } from '../../../shared/ui'
import { ParticipantSection } from '../../event-participants'
import { useEventDialogController } from '../model/use-event-dialog-controller'
import type { OpenDialogTarget } from '../lib/event-dialog-schema'
import { EventDetailsFields } from './EventDetailsFields'
import { EventDialogActions } from './EventDialogActions'

interface EventDialogFormProps {
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
export const EventDialogForm: FC<EventDialogFormProps> = ({ target }) => {
  const { values, handlers } = useEventDialogController({ target })

  const dialogTitle = values.mode === 'edit' ? 'Edit event' : 'Create event'

  return (
    <>
      <Modal onRequestClose={handlers.handleCloseAttempt} labelledBy={DIALOG_TITLE_ID}>
        <form onSubmit={handlers.submitForm} noValidate className="flex flex-col gap-lg">
          <div className="flex items-center justify-between">
            <h2 id={DIALOG_TITLE_ID} className="text-lg font-semibold text-text">
              {dialogTitle}
            </h2>
            <button
              type="button"
              onClick={handlers.handleCloseAttempt}
              aria-label="Close"
              className="rounded-md p-xs text-lg leading-none text-text-muted hover:bg-surface-muted hover:text-text"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>

          <EventDetailsFields
            register={values.register}
            errors={values.errors}
            isDisabled={values.isPending}
          />

          <ParticipantSection
            role="attendee"
            assigned={values.attendees}
            onAssignedChange={handlers.handleAttendeesChange}
            isDisabled={values.isPending}
          />
          <ParticipantSection
            role="host"
            assigned={values.hosts}
            onAssignedChange={handlers.handleHostsChange}
            isDisabled={values.isPending}
          />

          {values.error && (
            <p role="alert" className="text-sm text-danger">
              {values.error}
            </p>
          )}

          <EventDialogActions
            mode={values.mode}
            isPrimaryDisabled={!values.isFormValid || values.isPending}
            isSaving={values.isPending}
            onDeleteRequested={handlers.handleDeleteRequested}
            isDeleteDisabled={values.isPending}
          />
        </form>
      </Modal>

      {values.isDeleteConfirmOpen && (
        <ConfirmDialog
          title="Delete this event?"
          message="This event will be permanently removed and cannot be recovered."
          confirmLabel="Delete"
          cancelLabel="Cancel"
          isDangerous
          isConfirming={values.isPending}
          onConfirm={handlers.handleDeleteConfirmed}
          onCancel={handlers.handleDeleteCancelled}
        />
      )}

      {values.isDiscardConfirmOpen && (
        <ConfirmDialog
          title="Discard changes?"
          message="Your unsaved changes will be lost."
          confirmLabel="Discard changes"
          cancelLabel="Continue editing"
          onConfirm={handlers.handleDiscardConfirmed}
          onCancel={handlers.handleContinueEditing}
        />
      )}
    </>
  )
}
