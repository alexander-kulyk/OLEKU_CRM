import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ModalStackProvider } from '../context/ModalStack'
import { Modal } from './Modal'

/**
 * Behavior coverage for the shared `Modal` primitive (design.md D5,
 * specs/user-management/spec.md — "Dialog dismissal protects dirty forms"):
 * initial focus, Tab/Shift+Tab containment, topmost-only Escape and
 * outside-click dismissal, and logical focus restoration — for one dialog
 * and for two stacked ones.
 */

function ThreeButtonModal({
  onRequestClose,
}: {
  readonly onRequestClose: () => void
}) {
  return (
    <ModalStackProvider>
      <Modal onRequestClose={onRequestClose} labelledBy='modal-title'>
        <h2 id='modal-title'>Title</h2>
        <button type='button'>First</button>
        <button type='button'>Second</button>
        <button type='button'>Last</button>
      </Modal>
    </ModalStackProvider>
  )
}

describe('Modal — one dialog', () => {
  it('moves initial focus to the first focusable descendant on open', () => {
    render(<ThreeButtonModal onRequestClose={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus()
  })

  it('focuses the panel itself when it has no focusable descendant', () => {
    render(
      <ModalStackProvider>
        <Modal onRequestClose={vi.fn()} labelledBy='modal-title'>
          <h2 id='modal-title'>Title</h2>
          <p>Nothing to focus.</p>
        </Modal>
      </ModalStackProvider>,
    )

    expect(screen.getByRole('dialog')).toHaveFocus()
  })

  it('wraps Shift+Tab from the first focusable element to the last', async () => {
    const user = userEvent.setup()
    render(<ThreeButtonModal onRequestClose={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus()
    await user.tab({ shift: true })

    expect(screen.getByRole('button', { name: 'Last' })).toHaveFocus()
  })

  it('wraps Tab from the last focusable element back to the first', async () => {
    const user = userEvent.setup()
    render(<ThreeButtonModal onRequestClose={vi.fn()} />)

    await user.tab() // First -> Second
    await user.tab() // Second -> Last
    expect(screen.getByRole('button', { name: 'Last' })).toHaveFocus()

    await user.tab() // Last -> wraps to First
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus()
  })

  it('calls onRequestClose on Escape', async () => {
    const user = userEvent.setup()
    const handleRequestClose = vi.fn()
    render(<ThreeButtonModal onRequestClose={handleRequestClose} />)

    await user.keyboard('{Escape}')

    expect(handleRequestClose).toHaveBeenCalledTimes(1)
  })

  it('calls onRequestClose only for a click that starts and ends on the backdrop', () => {
    const handleRequestClose = vi.fn()
    render(<ThreeButtonModal onRequestClose={handleRequestClose} />)

    fireEvent.mouseDown(screen.getByRole('button', { name: 'First' }))
    expect(handleRequestClose).not.toHaveBeenCalled()

    const backdrop = screen.getByRole('dialog').parentElement as HTMLElement
    fireEvent.mouseDown(backdrop)
    expect(handleRequestClose).toHaveBeenCalledTimes(1)
  })

  it('restores focus to the page-level trigger once the dialog unmounts', () => {
    function Page() {
      const [isOpen, setIsOpen] = useState(false)

      return (
        <ModalStackProvider>
          <button type='button' onClick={() => setIsOpen(true)}>
            Open
          </button>
          {isOpen && (
            <Modal onRequestClose={() => setIsOpen(false)} labelledBy='modal-title'>
              <h2 id='modal-title'>Title</h2>
              <button type='button'>Inside</button>
            </Modal>
          )}
        </ModalStackProvider>
      )
    }

    render(<Page />)
    const trigger = screen.getByRole('button', { name: 'Open' })
    trigger.focus()
    fireEvent.click(trigger)

    expect(screen.getByRole('button', { name: 'Inside' })).toHaveFocus()

    // Close the dialog through the same route a real dismissal uses —
    // Escape on the topmost (only) dialog, which calls `onRequestClose` and
    // unmounts it.
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })
})

describe('Modal — stacked dialogs', () => {
  function StackedModals({
    onOuterClose,
    onInnerClose,
  }: {
    readonly onOuterClose: () => void
    readonly onInnerClose: () => void
  }) {
    return (
      <ModalStackProvider>
        <Modal onRequestClose={onOuterClose} labelledBy='outer-title'>
          <h2 id='outer-title'>Outer</h2>
          <button type='button'>Outer action</button>
        </Modal>
        <Modal onRequestClose={onInnerClose} labelledBy='inner-title'>
          <h2 id='inner-title'>Inner</h2>
          <button type='button'>Inner action</button>
        </Modal>
      </ModalStackProvider>
    )
  }

  it('moves focus into the later-mounted (topmost) dialog', () => {
    render(<StackedModals onOuterClose={vi.fn()} onInnerClose={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Inner action' })).toHaveFocus()
  })

  it('routes Escape only to the topmost dialog', async () => {
    const user = userEvent.setup()
    const handleOuterClose = vi.fn()
    const handleInnerClose = vi.fn()
    render(<StackedModals onOuterClose={handleOuterClose} onInnerClose={handleInnerClose} />)

    await user.keyboard('{Escape}')

    expect(handleInnerClose).toHaveBeenCalledTimes(1)
    expect(handleOuterClose).not.toHaveBeenCalled()
  })

  it('routes an outside click only to the topmost dialog', () => {
    const handleOuterClose = vi.fn()
    const handleInnerClose = vi.fn()
    render(<StackedModals onOuterClose={handleOuterClose} onInnerClose={handleInnerClose} />)

    const outerBackdrop = screen.getByRole('dialog', { name: 'Outer' }).parentElement as HTMLElement
    fireEvent.mouseDown(outerBackdrop)
    expect(handleOuterClose).not.toHaveBeenCalled()

    const innerBackdrop = screen.getByRole('dialog', { name: 'Inner' }).parentElement as HTMLElement
    fireEvent.mouseDown(innerBackdrop)
    expect(handleInnerClose).toHaveBeenCalledTimes(1)
  })

  it('keeps Tab contained within the topmost dialog, never reaching the parent', async () => {
    const user = userEvent.setup()
    render(<StackedModals onOuterClose={vi.fn()} onInnerClose={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Inner action' })).toHaveFocus()
    await user.tab()

    expect(screen.getByRole('button', { name: 'Inner action' })).toHaveFocus()
  })

  it('restores focus within the still-open parent dialog once the stacked dialog closes', () => {
    function EditWithConfirmation() {
      const [isConfirmOpen, setIsConfirmOpen] = useState(false)

      return (
        <ModalStackProvider>
          <Modal onRequestClose={vi.fn()} labelledBy='edit-title'>
            <h2 id='edit-title'>Edit</h2>
            <button type='button'>Field A</button>
            <button type='button' onClick={() => setIsConfirmOpen(true)}>
              Discard
            </button>
          </Modal>
          {isConfirmOpen && (
            <Modal
              onRequestClose={() => setIsConfirmOpen(false)}
              labelledBy='confirm-title'
            >
              <h2 id='confirm-title'>Discard changes?</h2>
              <button type='button'>Continue editing</button>
            </Modal>
          )}
        </ModalStackProvider>
      )
    }

    render(<EditWithConfirmation />)
    const discardTrigger = screen.getByRole('button', { name: 'Discard' })
    discardTrigger.focus()
    fireEvent.click(discardTrigger)

    expect(screen.getByRole('button', { name: 'Continue editing' })).toHaveFocus()

    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Discard changes?' }), {
      key: 'Escape',
    })

    expect(screen.queryByRole('dialog', { name: 'Discard changes?' })).not.toBeInTheDocument()
    expect(discardTrigger).toHaveFocus()
  })
})
