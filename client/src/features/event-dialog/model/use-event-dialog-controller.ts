import { useCallback, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { createZodResolver, localDateTimeToIsoInstant } from '../../../shared/lib'
import { useEventStore } from '../../../shared/model'
import { buildEventDialogInitialData } from '../lib/build-event-dialog-initial-data'
import { eventDialogFormSchema } from '../lib/event-dialog-schema'
import type { EventDialogFormValues, OpenDialogTarget } from '../lib/event-dialog-schema'
import { useAsyncAction } from './use-async-action'

export interface UseEventDialogControllerParams {
  readonly target: OpenDialogTarget
}

/**
 * All state and behavior for one open Event dialog session: form setup with
 * the zod resolver, the primary action's validity gate, the single
 * create/update/delete submission pipeline, and the two confirmations
 * (delete, discard). `EventDialogForm` (and the component this hook is
 * called from) is keyed by the dialog target at the call site, so this hook
 * — and the `useState` initializers inside it — run fresh exactly once per
 * dialog target (design.md D2).
 */
export function useEventDialogController({ target }: UseEventDialogControllerParams) {
  const closeDialog = useEventStore((state) => state.closeDialog)
  const createEvent = useEventStore((state) => state.createEvent)
  const updateEvent = useEventStore((state) => state.updateEvent)
  const deleteEvent = useEventStore((state) => state.deleteEvent)

  // A one-time snapshot via `getState()`, not a subscribed selector — this
  // hook must never re-derive the form's starting values from the live
  // `events` array after mount (design.md D2; specs/event-management/spec.md
  // — "An open event that disappears is handled").
  const [initialData] = useState(() =>
    buildEventDialogInitialData(target, useEventStore.getState().events),
  )

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isDirty },
  } = useForm<EventDialogFormValues>({
    resolver: createZodResolver(eventDialogFormSchema),
    defaultValues: initialData.formValues,
    // 'all': re-validates the whole form on both change and blur, so
    // tabbing through fields and leaving one blank surfaces that field's
    // message without requiring the user to type into it first
    // (specs/event-management/spec.md — "Leave each required field empty").
    mode: 'all',
  })

  // Gates the primary action independently of react-hook-form's own
  // `formState.isValid` timing — computed directly from the live values on
  // every render via the same schema the resolver uses, so it is correct
  // from the very first render (e.g. a blank Create form) without waiting
  // for a first interaction to warm up.
  const watchedValues = useWatch({ control })
  const isFormValid = useMemo(
    () => eventDialogFormSchema.safeParse(watchedValues).success,
    [watchedValues],
  )

  const mutation = useAsyncAction()

  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [isDiscardConfirmOpen, setIsDiscardConfirmOpen] = useState(false)

  const handleCloseAttempt = useCallback(() => {
    if (mutation.isPending || isDeleteConfirmOpen || isDiscardConfirmOpen) {
      // A submission is in flight, or a `ConfirmDialog` (delete/discard) is
      // stacked on top — `Modal`'s Escape listener stays mounted for the
      // whole lifetime of this form and isn't blocked by DOM stacking the
      // way the overlay click and close-icon routes are, so it must be
      // guarded explicitly here. While a confirmation is up, Escape is a
      // no-op: `ConfirmDialog` deliberately doesn't wire Escape to either of
      // its own buttons (see its doc comment), so falling through here would
      // introduce a third implicit close outcome — or, if a dirty edit's
      // delete confirmation is open, stack the discard confirmation on top
      // of it as well.
      return
    }

    if (isDirty) {
      setIsDiscardConfirmOpen(true)
      return
    }

    closeDialog()
  }, [mutation.isPending, isDeleteConfirmOpen, isDiscardConfirmOpen, isDirty, closeDialog])

  const handleContinueEditing = useCallback(() => {
    setIsDiscardConfirmOpen(false)
  }, [])

  const handleDiscardConfirmed = useCallback(() => {
    setIsDiscardConfirmOpen(false)
    closeDialog()
  }, [closeDialog])

  const submitForm = handleSubmit(async (values) => {
    const startAt = localDateTimeToIsoInstant(values.date, values.startTime)
    const endAt = localDateTimeToIsoInstant(values.date, values.endTime)
    const title = values.name.trim()

    // Never sends `attendeeIds`/`hostIds` — this dialog has no way to
    // change participants yet (Stage 6). Omitted means "default to []" on
    // create and "leave unchanged" on update (research EVID-004), which is
    // exactly correct since nothing here ever touches them.
    const succeeded = await mutation.run(() =>
      target.type === 'edit'
        ? updateEvent(target.eventId, { title, startAt, endAt })
        : createEvent({ title, startAt, endAt }),
    )

    if (succeeded) {
      closeDialog()
    }
  })

  const handleDeleteRequested = useCallback(() => {
    setIsDeleteConfirmOpen(true)
  }, [])

  const handleDeleteCancelled = useCallback(() => {
    setIsDeleteConfirmOpen(false)
  }, [])

  const handleDeleteConfirmed = useCallback(async () => {
    if (target.type !== 'edit') {
      return
    }

    const succeeded = await mutation.run(() => deleteEvent(target.eventId))
    // Either outcome closes the confirmation: on success the whole dialog
    // closes right after; on failure the error surfaces in the Event
    // dialog underneath, which stays open (specs/event-management/spec.md
    // — "Failed deletion").
    setIsDeleteConfirmOpen(false)

    if (succeeded) {
      closeDialog()
    }
  }, [target, mutation, deleteEvent, closeDialog])

  return {
    values: {
      mode: target.type,
      sourceEvent: initialData.sourceEvent,
      register,
      errors,
      isFormValid,
      isPending: mutation.isPending,
      error: mutation.error,
      isDeleteConfirmOpen,
      isDiscardConfirmOpen,
    },
    handlers: {
      submitForm,
      handleCloseAttempt,
      handleContinueEditing,
      handleDiscardConfirmed,
      handleDeleteRequested,
      handleDeleteCancelled,
      handleDeleteConfirmed,
    },
  }
}
