import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type React from 'react'
import { useForm } from 'react-hook-form'
import type { Control, FieldErrors, FieldPath, UseFormRegister } from 'react-hook-form'
import { createZodResolver } from '../../../shared/lib'
import { USER_FORM_COPY } from '../config/user-form-copy'
import { buildUserPatch } from '../lib/user-form/build-user-patch'
import { isUserFormNormalizedDirty } from '../lib/user-form/diff-user-form-fields'
import { mapUserDetailToFormValues } from '../lib/user-form/map-user-detail-to-form-values'
import { normalizeUserFormValues } from '../lib/user-form/normalize-user-form-values'
import { createUserFormSchema } from '../lib/user-form/user-form-schema'
import type { UserFormValues } from '../lib/user-form/user-form-schema'
import type { UserDetailDto } from './user-dto'
import type { UserPatchPayload } from './user-patch'

/** A server field-level failure to attach inline (Stage 6's recovery matrix, design.md D7). */
export interface EditUserFieldError {
  readonly field: string
  readonly message: string
}

export interface UseEditUserFormParams {
  readonly detail: UserDetailDto
  readonly defaultPhoneRegion: string | undefined
  /** Whether the caller's actual `PATCH` request is currently in flight (Stage 6 owns issuing it). */
  readonly isSaving: boolean
  /** Called with a real, non-null patch — never for a normalized-clean submission. */
  readonly onSave: (userId: string, patch: UserPatchPayload) => void
  /**
   * Called on every dismissal attempt (Close, outside click, Escape —
   * all funnelled through `Modal`'s single `onRequestClose`), with whether
   * the form is normalized-dirty at that instant. The caller decides what
   * a dirty attempt means (e.g. Stage 6's discard confirmation); this
   * stage only ever reports the fact, never the confirmation UI itself.
   */
  readonly onRequestClose: (isDirty: boolean) => void
  /**
   * A failed Save's field-level server error, attached inline via
   * `setError` whenever a new one arrives (e.g. a duplicate-email
   * conflict). React-hook-form's own revalidation naturally supersedes a
   * stale one on the next edit — this hook never clears it itself.
   */
  readonly fieldError?: EditUserFieldError | null
}

export interface UseEditUserFormResult {
  readonly register: UseFormRegister<UserFormValues>
  readonly control: Control<UserFormValues>
  readonly errors: FieldErrors<UserFormValues>
  /** Non-error, transient "No changes to save" feedback — `null` otherwise. */
  readonly statusMessage: string | null
  readonly submitForm: (event?: React.BaseSyntheticEvent) => Promise<void>
  readonly handleRequestClose: () => void
  /** The form's live normalized-dirty state, computed on demand (e.g. before a guarded "Reload latest"). */
  readonly checkIsDirty: () => boolean
}

/**
 * All state and behavior for one open Edit User form session (task 5.3):
 * react-hook-form setup with the region-aware zod resolver, the
 * normalized-dirty/patch pipeline (task 5.2), idle-only Save availability,
 * a synchronous duplicate-submit guard, and non-error "No changes to save"
 * feedback. Does not fetch detail, call `updateUser`, or own any
 * conflict/archive/discard-confirmation phase — those stay in Stage 6's
 * controller (openspec/changes/add-users-client-ui/tasks.md task 6.1),
 * which supplies `onSave`/`onRequestClose` and decides what their results
 * mean.
 *
 * Mounted keyed by `detail.id` from `EditUserDialog` (mirroring
 * `event-dialog`'s "hydrate once" rule, design.md D2), so `useState`
 * initializers below run fresh exactly once per edit session and are never
 * re-derived from a later detail re-read.
 */
export function useEditUserForm({
  detail,
  defaultPhoneRegion,
  isSaving,
  onSave,
  onRequestClose,
  fieldError,
}: UseEditUserFormParams): UseEditUserFormResult {
  const [initialFormValues] = useState(() => mapUserDetailToFormValues(detail))
  const [originalNormalizedValues] = useState(() => normalizeUserFormValues(initialFormValues, defaultPhoneRegion))

  const schema = useMemo(() => createUserFormSchema(defaultPhoneRegion), [defaultPhoneRegion])

  const {
    register,
    handleSubmit,
    control,
    getValues,
    setError,
    formState: { errors },
  } = useForm<UserFormValues>({
    resolver: createZodResolver(schema),
    defaultValues: initialFormValues,
    // 'all': re-validates on both change and blur, so tabbing past a
    // field with an invalid value (e.g. a whitespace-only address
    // property) surfaces that field's error without requiring Save first.
    mode: 'all',
  })

  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const isSaveInFlightRef = useRef(false)

  // Releases the synchronous guard once the caller's own mutation attempt
  // has finished, whatever the outcome — this component never learns the
  // outcome itself, only that `isSaving` went back to false.
  useEffect(() => {
    if (!isSaving) {
      isSaveInFlightRef.current = false
    }
  }, [isSaving])

  const handleValidSubmit = handleSubmit(
    (formValues) => {
      const currentNormalizedValues = normalizeUserFormValues(formValues, defaultPhoneRegion)
      const patch = buildUserPatch(currentNormalizedValues, originalNormalizedValues, detail.version)

      if (patch === null) {
        // A local no-op, not a pending request — release the guard
        // immediately so Save stays available right away
        // (specs/user-management/spec.md — "Save … SHALL remain available
        // whenever the form is idle").
        isSaveInFlightRef.current = false
        setStatusMessage(USER_FORM_COPY.noChangesToSave)
        return
      }

      setStatusMessage(null)
      // Deliberately NOT released here: it stays latched until `isSaving`
      // (owned by the caller's real mutation, once Stage 6 wires it) cycles
      // back to `false` above.
      onSave(detail.id, patch)
    },
    () => {
      // Invalid submission — nothing pending, release immediately.
      isSaveInFlightRef.current = false
    },
  )

  const submitForm = useCallback(
    (event?: React.BaseSyntheticEvent) => {
      // Set BEFORE the (internally async) validation/submit pipeline runs,
      // not inside its callback — react-hook-form's `handleSubmit` awaits
      // the resolver even when it is synchronous, so a second activation
      // dispatched before that first microtask resolves would otherwise
      // still observe a stale, unset guard. Setting the ref synchronously,
      // on the very first line, is what makes even a same-tick duplicate
      // activation a no-op (specs/user-management/spec.md — "Save … SHALL
      // prevent duplicate save requests").
      if (isSaveInFlightRef.current) {
        event?.preventDefault()
        return Promise.resolve()
      }

      isSaveInFlightRef.current = true

      return handleValidSubmit(event)
    },
    [handleValidSubmit],
  )

  const checkIsDirty = useCallback((): boolean => {
    const currentNormalizedValues = normalizeUserFormValues(getValues(), defaultPhoneRegion)

    return isUserFormNormalizedDirty(currentNormalizedValues, originalNormalizedValues)
  }, [getValues, defaultPhoneRegion, originalNormalizedValues])

  const handleRequestClose = useCallback(() => {
    onRequestClose(checkIsDirty())
  }, [checkIsDirty, onRequestClose])

  // Attaches a failed Save's field-level server error (e.g. a duplicate
  // email) the same way a client-side validation failure would — through
  // react-hook-form's own `errors`, so `UserContactFields`'s existing
  // `error={errors.email?.message}` wiring needs no change at all. Runs
  // per new `fieldError` instance (a fresh object each failed attempt, even
  // for a repeated identical failure) rather than per field/message text,
  // so re-submitting into the same conflict re-shows the message even if
  // react-hook-form's own revalidation had already cleared it.
  useEffect(() => {
    if (!fieldError) {
      return
    }

    setError(fieldError.field as FieldPath<UserFormValues>, { type: 'server', message: fieldError.message })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldError, setError])

  return { register, control, errors, statusMessage, submitForm, handleRequestClose, checkIsDirty }
}
