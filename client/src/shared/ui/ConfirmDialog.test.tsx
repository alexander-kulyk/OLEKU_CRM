import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ModalStackProvider } from '../context/ModalStack'
import { ConfirmDialog } from './ConfirmDialog'
import type { IConfirmDialogProps } from './ConfirmDialog'

/**
 * Behavior coverage for `ConfirmDialog` composing the shared `Modal`
 * primitive (design.md D5, task 2.3): data-driven tone presentation, the
 * pending-action guard, unique ARIA labelling, and explicit dismissal
 * routed separately from Cancel/Confirm — including while stacked.
 */

function renderConfirmDialog(overrides: Partial<IConfirmDialogProps> = {}) {
  const onConfirm = overrides.onConfirm ?? vi.fn()
  const onCancel = overrides.onCancel ?? vi.fn()
  const onDismiss = overrides.onDismiss ?? vi.fn()

  render(
    <ModalStackProvider>
      <ConfirmDialog
        title='Delete this event?'
        message='This event will be permanently removed and cannot be recovered.'
        confirmLabel='Delete event'
        cancelLabel='Cancel'
        {...overrides}
        onConfirm={onConfirm}
        onCancel={onCancel}
        onDismiss={onDismiss}
      />
    </ModalStackProvider>,
  )

  return { onConfirm, onCancel, onDismiss }
}

describe('ConfirmDialog', () => {
  it('renders as an alertdialog labelled and described by its own title/message', () => {
    renderConfirmDialog()

    const dialog = screen.getByRole('alertdialog', { name: 'Delete this event?' })
    expect(dialog).toHaveAccessibleDescription(
      'This event will be permanently removed and cannot be recovered.',
    )
  })

  it('renders the dangerous tone as the destructive confirm variant', () => {
    renderConfirmDialog({ isDangerous: true })

    expect(screen.getByRole('button', { name: 'Delete event' }).className).toContain('bg-danger')
  })

  it('renders the default (accent) tone as the primary confirm variant', () => {
    renderConfirmDialog({ isDangerous: false })

    expect(screen.getByRole('button', { name: 'Delete event' }).className).toContain('bg-accent')
  })

  it('disables both actions and shows the busy label while confirming', () => {
    renderConfirmDialog({ isConfirming: true })

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Working…' })).toBeDisabled()
  })

  it('keeps Escape and an outside click inert while isConfirming is true', async () => {
    const user = userEvent.setup()
    const { onDismiss } = renderConfirmDialog({ isConfirming: true })

    await user.keyboard('{Escape}')
    expect(onDismiss).not.toHaveBeenCalled()

    const backdrop = screen.getByRole('alertdialog').parentElement as HTMLElement
    fireEvent.mouseDown(backdrop)
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('calls onConfirm/onCancel only from their own buttons, never from dismissal', async () => {
    const user = userEvent.setup()
    const { onConfirm, onCancel, onDismiss } = renderConfirmDialog()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('routes Escape and an outside click to onDismiss, not onCancel or onConfirm', async () => {
    const user = userEvent.setup()
    const { onConfirm, onCancel, onDismiss } = renderConfirmDialog()

    await user.keyboard('{Escape}')

    expect(onDismiss).toHaveBeenCalledTimes(1)
    expect(onCancel).not.toHaveBeenCalled()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('generates unique ARIA ids so two stacked confirmations never collide', () => {
    const handleOuterDismiss = vi.fn()
    const handleInnerDismiss = vi.fn()

    render(
      <ModalStackProvider>
        <ConfirmDialog
          title='Discard changes?'
          message='Your unsaved changes will be lost.'
          confirmLabel='Discard changes'
          cancelLabel='Continue editing'
          onConfirm={vi.fn()}
          onCancel={handleOuterDismiss}
          onDismiss={handleOuterDismiss}
        />
        <ConfirmDialog
          title='Delete this event?'
          message='This event will be permanently removed and cannot be recovered.'
          confirmLabel='Delete event'
          cancelLabel='Cancel'
          isDangerous
          onConfirm={vi.fn()}
          onCancel={handleInnerDismiss}
          onDismiss={handleInnerDismiss}
        />
      </ModalStackProvider>,
    )

    const outerDialog = screen.getByRole('alertdialog', { name: 'Discard changes?' })
    const innerDialog = screen.getByRole('alertdialog', { name: 'Delete this event?' })

    expect(outerDialog.getAttribute('aria-labelledby')).not.toBe(
      innerDialog.getAttribute('aria-labelledby'),
    )
    expect(outerDialog.getAttribute('aria-describedby')).not.toBe(
      innerDialog.getAttribute('aria-describedby'),
    )
  })

  it('only the topmost of two stacked confirmations responds to Escape', async () => {
    const user = userEvent.setup()
    const handleOuterDismiss = vi.fn()
    const handleInnerDismiss = vi.fn()

    render(
      <ModalStackProvider>
        <ConfirmDialog
          title='Discard changes?'
          message='Your unsaved changes will be lost.'
          confirmLabel='Discard changes'
          cancelLabel='Continue editing'
          onConfirm={vi.fn()}
          onCancel={handleOuterDismiss}
          onDismiss={handleOuterDismiss}
        />
        <ConfirmDialog
          title='Delete this event?'
          message='This event will be permanently removed and cannot be recovered.'
          confirmLabel='Delete event'
          cancelLabel='Cancel'
          isDangerous
          onConfirm={vi.fn()}
          onCancel={handleInnerDismiss}
          onDismiss={handleInnerDismiss}
        />
      </ModalStackProvider>,
    )

    await user.keyboard('{Escape}')

    expect(handleInnerDismiss).toHaveBeenCalledTimes(1)
    expect(handleOuterDismiss).not.toHaveBeenCalled()
  })
})
