import type { FC } from 'react'
import { Button } from '../../../shared/ui'
import { USER_FORM_COPY } from '../config/user-form-copy'

export interface EditUserDialogActionsProps {
  readonly isSaving: boolean
  readonly statusMessage: string | null
  readonly onCancel: () => void
}

/**
 * The dialog's actions area: the non-error "No changes to save" status
 * (specs/user-management/spec.md — "Save sends a normalized versioned
 * merge patch": "For a normalized-clean form, Save SHALL … announce `No
 * changes to save` as a non-error status") plus Cancel/Save. Save is a
 * plain `type='submit'` button — the same `<form onSubmit>` pipeline
 * `useEditUserForm.submitForm` already guards — and is disabled ONLY while
 * `isSaving`, never by form validity (specs/user-management/spec.md —
 * "Save SHALL remain available whenever the form is idle and SHALL be
 * disabled only during the active save request").
 */
export const EditUserDialogActions: FC<EditUserDialogActionsProps> = ({ isSaving, statusMessage, onCancel }) => (
  <div className='flex flex-col gap-md border-t border-line pt-lg'>
    {statusMessage && (
      <p role='status' aria-live='polite' className='text-label font-normal text-ink-secondary'>
        {statusMessage}
      </p>
    )}

    <div className='flex items-center justify-end gap-sm'>
      <Button variant='secondary' onClick={onCancel} disabled={isSaving}>
        {USER_FORM_COPY.cancel}
      </Button>

      <Button type='submit' variant='primary' disabled={isSaving} isLoading={isSaving} loadingLabel={USER_FORM_COPY.saving}>
        {USER_FORM_COPY.save}
      </Button>
    </div>
  </div>
)
