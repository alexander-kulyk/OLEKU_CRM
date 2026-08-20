import type { FC } from 'react'
import { CloseSVG } from '../../../../assets'
import { IconButton, Modal } from '../../../shared/ui'
import { USER_FORM_COPY } from '../config/user-form-copy'
import { useEditUserForm } from '../model/use-edit-user-form'
import type { UserDetailDto } from '../model/user-dto'
import type { UserPatchPayload } from '../model/user-patch'
import { EditUserDialogActions } from './EditUserDialogActions'
import type { EditUserArchiveAction, EditUserFieldErrorProp, EditUserOperationError } from './EditUserDialog'
import { UserAddressFields } from './UserAddressFields'
import { UserContactFields } from './UserContactFields'
import { UserNameFields } from './UserNameFields'
import { UserReadOnlyFields } from './UserReadOnlyFields'
import { UserStatusField } from './UserStatusField'

export interface EditUserFormProps {
  readonly detail: UserDetailDto
  readonly defaultPhoneRegion: string | undefined
  readonly isSaving: boolean
  readonly onSave: (userId: string, patch: UserPatchPayload) => void
  readonly onRequestClose: (isDirty: boolean) => void
  readonly operationError: EditUserOperationError | null
  readonly fieldError: EditUserFieldErrorProp | null
  readonly onReloadLatestRequested: (isDirty: boolean) => void
  readonly archive: EditUserArchiveAction
  readonly titleId: string
}

/**
 * The Edit User form (task 5.3): all state and behavior come from
 * {@link useEditUserForm}; this component is markup only, mirroring
 * `event-dialog`'s `EventDialogForm`/`useEventDialogController` split.
 * Mounted keyed by `detail.id` from `EditUserDialog`, so a session's
 * react-hook-form instance and normalized starting snapshot are fresh
 * exactly once per edit session.
 *
 * Owns its own `Modal` (rather than sharing one hoisted into a parent) so
 * `handleRequestClose` — which reads the LIVE normalized-dirty state of
 * THIS session's form — is exactly what `Modal` calls for Escape and an
 * outside click, not a parent's guess (see `EditUserDialogLoading`'s doc
 * comment for the same reasoning while detail is still loading).
 */
export const EditUserForm: FC<EditUserFormProps> = ({
  detail,
  defaultPhoneRegion,
  isSaving,
  onSave,
  onRequestClose,
  operationError,
  fieldError,
  onReloadLatestRequested,
  archive,
  titleId,
}) => {
  const { register, control, errors, statusMessage, submitForm, handleRequestClose, checkIsDirty } = useEditUserForm({
    detail,
    defaultPhoneRegion,
    isSaving,
    onSave,
    onRequestClose,
    fieldError,
  })

  const handleReloadLatest = (): void => {
    onReloadLatestRequested(checkIsDirty())
  }

  const dialogTitle = `${USER_FORM_COPY.dialogTitlePrefix} ${detail.firstName} ${detail.lastName}`

  return (
    <Modal onRequestClose={handleRequestClose} labelledBy={titleId}>
      <form onSubmit={submitForm} noValidate className='flex flex-col gap-xl'>
        <div className='flex items-center justify-between gap-md'>
          <h2 id={titleId} className='text-dialog-title text-ink'>
            {dialogTitle}
          </h2>
          <IconButton
            variant='ghost'
            size='sm'
            label={USER_FORM_COPY.close}
            icon={<CloseSVG className='size-4' />}
            onClick={handleRequestClose}
          />
        </div>

        <UserReadOnlyFields detail={detail} />

        <UserNameFields register={register} errors={errors} isDisabled={isSaving} />
        <UserContactFields
          register={register}
          errors={errors}
          isDisabled={isSaving}
          defaultPhoneRegion={defaultPhoneRegion}
        />
        <UserAddressFields register={register} errors={errors} isDisabled={isSaving} />
        <UserStatusField control={control} isDisabled={isSaving} />

        <EditUserDialogActions
          isSaving={isSaving}
          statusMessage={statusMessage}
          operationError={operationError}
          onReloadLatest={handleReloadLatest}
          archive={archive}
          onCancel={handleRequestClose}
        />
      </form>
    </Modal>
  )
}
