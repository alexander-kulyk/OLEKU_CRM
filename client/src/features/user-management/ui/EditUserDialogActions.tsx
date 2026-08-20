import type { FC } from 'react'
import { AlertCircleSVG } from '../../../../assets'
import { Button } from '../../../shared/ui'
import { USER_FORM_COPY } from '../config/user-form-copy'
import type { EditUserArchiveAction, EditUserOperationError } from './EditUserDialog'

export interface EditUserDialogActionsProps {
  readonly isSaving: boolean
  readonly statusMessage: string | null
  /** An operation-level failure to show above the actions (Stage 6's recovery matrix, design.md D7). */
  readonly operationError: EditUserOperationError | null
  /** Activated only for a `'version-conflict'` `operationError`, guarded upstream by discard confirmation. */
  readonly onReloadLatest: () => void
  readonly archive: EditUserArchiveAction
  readonly onCancel: () => void
}

/**
 * The dialog's actions area: an operation-level failure banner (with a
 * guarded Reload latest for a version conflict), the non-error "No changes
 * to save" status (specs/user-management/spec.md — "Save sends a
 * normalized versioned merge patch": "For a normalized-clean form, Save
 * SHALL … announce `No changes to save` as a non-error status"), Archive,
 * and Cancel/Save. Save is a plain `type='submit'` button — the same
 * `<form onSubmit>` pipeline `useEditUserForm.submitForm` already guards —
 * and is disabled ONLY while `isSaving`, never by form validity
 * (specs/user-management/spec.md — "Save SHALL remain available whenever
 * the form is idle and SHALL be disabled only during the active save
 * request").
 */
export const EditUserDialogActions: FC<EditUserDialogActionsProps> = ({
  isSaving,
  statusMessage,
  operationError,
  onReloadLatest,
  archive,
  onCancel,
}) => (
  <div className='flex flex-col gap-md border-t border-line pt-lg'>
    {operationError && (
      <div
        role='alert'
        className='flex flex-col items-start gap-sm rounded-md border border-danger/25 bg-danger-tint p-md text-body text-danger'
      >
        <span className='flex items-center gap-sm'>
          <AlertCircleSVG className='size-4 shrink-0' />
          {operationError.message}
        </span>
        {operationError.kind === 'version-conflict' && (
          <Button size='sm' variant='secondary' onClick={onReloadLatest}>
            {USER_FORM_COPY.reloadLatest}
          </Button>
        )}
      </div>
    )}

    {statusMessage && (
      <p role='status' aria-live='polite' className='text-label font-normal text-ink-secondary'>
        {statusMessage}
      </p>
    )}

    <div className='flex flex-wrap items-center justify-between gap-md'>
      <div className='flex flex-col gap-xs'>
        <Button variant='danger' size='sm' onClick={archive.onRequest} disabled={archive.isDisabled}>
          {USER_FORM_COPY.archiveButton}
        </Button>
        {archive.disabledReason && (
          <span className='text-label font-normal text-ink-muted'>{archive.disabledReason}</span>
        )}
      </div>

      <div className='flex items-center gap-sm'>
        <Button variant='secondary' onClick={onCancel} disabled={isSaving}>
          {USER_FORM_COPY.cancel}
        </Button>

        <Button
          type='submit'
          variant='primary'
          disabled={isSaving}
          isLoading={isSaving}
          loadingLabel={USER_FORM_COPY.saving}
        >
          {USER_FORM_COPY.save}
        </Button>
      </div>
    </div>
  </div>
)
