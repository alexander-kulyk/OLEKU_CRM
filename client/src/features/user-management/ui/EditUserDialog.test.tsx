import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ModalStackProvider } from '../../../shared/context/ModalStack'
import type { EditUserDetailState } from '../model/edit-user-detail-state'
import type { UserDetailDto } from '../model/user-dto'
import type { UserPatchPayload } from '../model/user-patch'
import { EditUserDialog } from './EditUserDialog'

const DETAIL: UserDetailDto = {
  id: 'user-1',
  firstName: 'Anna',
  lastName: 'Smith',
  email: 'anna@example.com',
  phone: '+380501234567',
  address: { country: 'UA', city: 'Kyiv', street: 'Sichovykh Striltsiv St', postalCode: '01001' },
  status: 'active',
  lastLoginAt: '2026-01-10T08:00:00.000Z',
  phoneExtension: '204',
  archivedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-05T00:00:00.000Z',
  version: 7,
}

const LOADING_STATE: EditUserDetailState = { status: 'loading' }
const READY_STATE: EditUserDetailState = { status: 'ready', detail: DETAIL }

interface RenderEditUserDialogOptions {
  readonly detailState?: EditUserDetailState
  readonly defaultPhoneRegion?: string
  readonly isSaving?: boolean
}

function renderEditUserDialog(options: RenderEditUserDialogOptions = {}) {
  const onSave = vi.fn<(userId: string, patch: UserPatchPayload) => void>()
  const onRequestClose = vi.fn<(isDirty: boolean) => void>()
  // `'defaultPhoneRegion' in options`, not `options.defaultPhoneRegion ?? 'UA'` —
  // the latter would silently substitute 'UA' for a test that explicitly
  // passes `defaultPhoneRegion: undefined` to exercise the unavailable-region
  // behavior, since `undefined ?? 'UA'` is `'UA'`.
  const defaultPhoneRegion = 'defaultPhoneRegion' in options ? options.defaultPhoneRegion : 'UA'

  render(
    <ModalStackProvider>
      <EditUserDialog
        detailState={options.detailState ?? READY_STATE}
        defaultPhoneRegion={defaultPhoneRegion}
        isSaving={options.isSaving ?? false}
        onSave={onSave}
        onRequestClose={onRequestClose}
      />
    </ModalStackProvider>,
  )

  return { onSave, onRequestClose }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('EditUserDialog — detail-before-edit loading (task 5.3)', () => {
  it('renders a closable, accessibly-labelled loading placeholder while detail is not yet ready', () => {
    const { onRequestClose } = renderEditUserDialog({ detailState: LOADING_STATE })

    expect(screen.getByRole('dialog', { name: 'Edit user' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Loading user…')

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(onRequestClose).toHaveBeenCalledWith(false)
  })
})

describe('EditUserDialog — ready form (task 5.3)', () => {
  it("opens with the detail response's editable values, read-only metadata, and initial focus inside it", () => {
    renderEditUserDialog()

    expect(screen.getByRole('dialog', { name: 'Edit Anna Smith' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus()

    expect(screen.getByLabelText('First name')).toHaveValue('Anna')
    expect(screen.getByLabelText('Last name')).toHaveValue('Smith')
    expect(screen.getByLabelText('Email')).toHaveValue('anna@example.com')
    expect(screen.getByLabelText('Phone')).toHaveValue('+380501234567')
    expect(screen.getByLabelText('Phone extension')).toHaveValue('204')
    expect(screen.getByLabelText('City')).toHaveValue('Kyiv')

    expect(screen.getByText('user-1')).toBeInTheDocument()
  })

  it('exposes an inline, programmatically associated, keyboard-reachable error for an invalid field', async () => {
    const user = userEvent.setup()
    renderEditUserDialog()

    const emailInput = screen.getByLabelText('Email')
    await user.clear(emailInput)
    await user.type(emailInput, 'not-an-email')
    await user.tab()

    const error = await screen.findByText('Enter a valid email address.')
    expect(emailInput).toHaveAccessibleDescription('Enter a valid email address.')
    expect(error).toBeInTheDocument()
  })

  it('shows a region-aware phone hint when a default phone region is configured', () => {
    renderEditUserDialog({ defaultPhoneRegion: 'UA' })

    expect(screen.getByLabelText('Phone')).toHaveAccessibleDescription(
      'Enter a national number, or an international number starting with +.',
    )
  })

  it('shows an unavailable-region hint when no default phone region is configured', () => {
    renderEditUserDialog({ defaultPhoneRegion: undefined })

    expect(screen.getByLabelText('Phone')).toHaveAccessibleDescription(
      'No deployment phone region is configured — enter the full international number starting with +.',
    )
  })

  it('disables Save only during an active save request — never for validity alone (idle-only Save availability)', () => {
    const dialog = (isSaving: boolean) => (
      <ModalStackProvider>
        <EditUserDialog
          detailState={READY_STATE}
          defaultPhoneRegion='UA'
          isSaving={isSaving}
          onSave={vi.fn()}
          onRequestClose={vi.fn()}
        />
      </ModalStackProvider>
    )
    const { rerender } = render(dialog(false))

    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled()

    rerender(dialog(true))

    expect(screen.getByRole('button', { name: 'Saving changes…' })).toBeDisabled()
  })
})

describe('EditUserDialog — Save semantics (tasks 5.2/5.3)', () => {
  it('sends no callback and announces a non-error status for a normalized-clean Save', async () => {
    const user = userEvent.setup()
    const { onSave } = renderEditUserDialog()

    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(onSave).not.toHaveBeenCalled()
    expect(await screen.findByRole('status')).toHaveTextContent('No changes to save.')
  })

  it('treats a whitespace-only edit as clean (normalized equality)', async () => {
    const user = userEvent.setup()
    const { onSave } = renderEditUserDialog()

    const firstNameInput = screen.getByLabelText('First name')
    await user.type(firstNameInput, '  ')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(onSave).not.toHaveBeenCalled()
    expect(await screen.findByRole('status')).toHaveTextContent('No changes to save.')
  })

  it('sends a versioned patch with only the changed field, never an immutable one (version inclusion)', async () => {
    const user = userEvent.setup()
    const { onSave } = renderEditUserDialog()

    const lastNameInput = screen.getByLabelText('Last name')
    await user.clear(lastNameInput)
    await user.type(lastNameInput, 'Kovalenko')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith('user-1', { lastName: 'Kovalenko', version: 7 })

    const [, patch] = onSave.mock.calls[0] as [string, UserPatchPayload]
    expect(patch).not.toHaveProperty('id')
    expect(patch).not.toHaveProperty('createdAt')
  })

  it('clears a single address property without replacing the whole address', async () => {
    const user = userEvent.setup()
    const { onSave } = renderEditUserDialog()

    await user.clear(screen.getByLabelText('Postal code'))
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(onSave).toHaveBeenCalledWith('user-1', { address: { postalCode: null }, version: 7 })
  })

  it('sends address: null when every previously-populated address property is cleared (full removal)', async () => {
    const user = userEvent.setup()
    const { onSave } = renderEditUserDialog()

    await user.clear(screen.getByLabelText('Country'))
    await user.clear(screen.getByLabelText('City'))
    await user.clear(screen.getByLabelText('Street'))
    await user.clear(screen.getByLabelText('Postal code'))
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(onSave).toHaveBeenCalledWith('user-1', { address: null, version: 7 })
  })

  it('blocks a duplicate rapid Save activation (synchronous duplicate-submit guard)', async () => {
    const { onSave } = renderEditUserDialog()

    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Hanna' } })
    const saveButton = screen.getByRole('button', { name: 'Save changes' })

    // Dispatched back-to-back, before the async `handleSubmit` pipeline
    // resolves either one — the same-tick race the ref guard closes.
    fireEvent.click(saveButton)
    fireEvent.click(saveButton)

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
  })
})

describe('EditUserDialog — dismissal reports normalized-dirty state (task 5.3)', () => {
  it('reports isDirty=false for Close on a clean form', () => {
    const { onRequestClose } = renderEditUserDialog()

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(onRequestClose).toHaveBeenCalledWith(false)
  })

  it('reports isDirty=true for Close on a dirty form', () => {
    const { onRequestClose } = renderEditUserDialog()

    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Hanna' } })
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(onRequestClose).toHaveBeenCalledWith(true)
  })

  it('reports the same dirty state for the Cancel action', () => {
    const { onRequestClose } = renderEditUserDialog()

    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Hanna' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onRequestClose).toHaveBeenCalledWith(true)
  })
})
