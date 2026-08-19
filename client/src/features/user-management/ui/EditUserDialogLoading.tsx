import type { FC } from 'react'
import { CloseSVG, SpinnerSVG } from '../../../../assets'
import { IconButton, Modal } from '../../../shared/ui'
import { USER_FORM_COPY } from '../config/user-form-copy'

export interface EditUserDialogLoadingProps {
  readonly titleId: string
  readonly onRequestClose: () => void
}

/**
 * The detail-before-edit loading placeholder (task 5.3): rendered while
 * `EditUserDialog`'s `detailState.status` is `'loading'`, before the actual
 * `GET /api/users/:userId` response (owned by Stage 6) is available to
 * build the form from. Still a real, closable, accessibly-labelled dialog
 * — Close, outside click, and topmost Escape all still work while loading
 * (routed straight to `onRequestClose`; there is no form yet, so there is
 * nothing to report as dirty).
 *
 * Owns its own `Modal` — rather than sharing one hoisted into
 * `EditUserDialog` — so each rendered phase (this one, or `EditUserForm`)
 * supplies `Modal`'s `onRequestClose` from its own accurate source instead
 * of a parent guessing which phase is live (mirrors `event-dialog`'s
 * `EventDialogForm`, which owns its own `Modal` for the same reason).
 */
export const EditUserDialogLoading: FC<EditUserDialogLoadingProps> = ({ titleId, onRequestClose }) => (
  <Modal onRequestClose={onRequestClose} labelledBy={titleId}>
    <div className='flex items-center justify-between gap-md'>
      <h2 id={titleId} className='text-dialog-title text-ink'>
        {USER_FORM_COPY.dialogTitlePrefix} user
      </h2>
      <IconButton
        variant='ghost'
        size='sm'
        label={USER_FORM_COPY.close}
        icon={<CloseSVG className='size-4' />}
        onClick={onRequestClose}
      />
    </div>

    <p role='status' aria-live='polite' className='flex items-center gap-sm py-xl text-label font-normal text-ink-muted'>
      <SpinnerSVG className='size-4 animate-spin' />
      {USER_FORM_COPY.loading}
    </p>
  </Modal>
)
