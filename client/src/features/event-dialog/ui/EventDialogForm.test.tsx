import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EventRecord } from '../../../shared/api'
import { ModalStackProvider } from '../../../shared/context/ModalStack'
import { useEventStore } from '../../../shared/model'
import { EventDialogForm } from './EventDialogForm'

// The dialog mounts `event-participants`, which fetches directory options
// immediately on mount (design.md D8 — API functions are mocked at the
// feature boundary; no real endpoint is used in tests).
vi.mock('../../../shared/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../shared/api')>()

  return {
    ...actual,
    readContacts: vi.fn().mockResolvedValue([]),
    readHostEligibleEmployees: vi.fn().mockResolvedValue([]),
  }
})

/**
 * Regression coverage for the Event dialog — the shared dialog stack's only
 * existing consumer (design.md D5 risk R-007) — proving it still renders,
 * gains initial focus, and correctly stacks its discard confirmation on top
 * of itself through the refactored `Modal`/`ConfirmDialog` primitives
 * (task 2.4).
 */
async function renderCreateDialog(): Promise<void> {
  render(
    <ModalStackProvider>
      <EventDialogForm
        target={{ type: 'create', prefill: { date: new Date('2026-01-15T00:00:00Z') } }}
      />
    </ModalStackProvider>,
  )

  // Lets both mocked directory reads (attendees, hosts) settle before
  // assertions/interactions run, by waiting for their resolved empty state
  // rather than an arbitrary tick.
  await screen.findByText('No contacts are available to assign yet.')
  await screen.findByText('No employees are available to host yet.')
}

const FAKE_EVENT: EventRecord = {
  id: 'event-1',
  title: 'Algebra I',
  startAt: '2026-01-15T10:00:00Z',
  endAt: '2026-01-15T11:00:00Z',
  color: '#2563eb',
  attendees: [],
  hosts: [],
}

beforeEach(() => {
  useEventStore.setState({ dialogTarget: { type: 'closed' }, events: [] })
})

describe('EventDialogForm (regression — shared dialog stack)', () => {
  it('renders the Create event dialog with initial focus inside it', async () => {
    await renderCreateDialog()

    expect(screen.getByRole('dialog', { name: 'Create event' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus()
  })

  it('stacks a discard confirmation above a dirty form and gives topmost Escape only to it', async () => {
    const user = userEvent.setup()
    await renderCreateDialog()

    await user.type(screen.getByLabelText('Event name'), 'Algebra I')
    await user.keyboard('{Escape}')

    expect(screen.getByRole('alertdialog', { name: 'Discard changes?' })).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Create event' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue editing' })).toHaveFocus()

    // The confirmation is topmost now — Escape dismisses only it, leaving
    // the Create dialog open with its unsaved value intact, and returns
    // focus into that still-open parent dialog.
    await user.keyboard('{Escape}')

    expect(
      screen.queryByRole('alertdialog', { name: 'Discard changes?' }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Create event' })).toBeInTheDocument()
    expect(screen.getByLabelText('Event name')).toHaveFocus()
    expect(screen.getByLabelText('Event name')).toHaveValue('Algebra I')
  })

  it('keeps the delete confirmation open on Escape while the delete is still in flight', async () => {
    const user = userEvent.setup()
    let resolveDelete: () => void = () => {}
    const pendingDelete = new Promise<void>((resolve) => {
      resolveDelete = resolve
    })

    // Overrides only the store's `deleteEvent` action with a deferred,
    // caller-controlled promise, so the real request/refetch pipeline is
    // never exercised — `mutation.isPending` just needs to stay `true` for
    // as long as this test needs it to.
    useEventStore.setState({
      events: [FAKE_EVENT],
      deleteEvent: vi.fn(() => pendingDelete),
    })

    render(
      <ModalStackProvider>
        <EventDialogForm target={{ type: 'edit', eventId: FAKE_EVENT.id }} />
      </ModalStackProvider>,
    )
    await screen.findByText('No contacts are available to assign yet.')
    await screen.findByText('No employees are available to host yet.')

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await user.click(screen.getByRole('button', { name: 'Delete event' }))

    const confirmDialog = await screen.findByRole('alertdialog', { name: 'Delete this event?' })
    expect(within(confirmDialog).getByRole('button', { name: 'Cancel' })).toBeDisabled()
    expect(within(confirmDialog).getByRole('button', { name: 'Working…' })).toBeDisabled()

    // Before this fix, ConfirmDialog passed `onRequestClose={onDismiss}`
    // into `Modal` unconditionally, so Escape reached `handleDeleteCancelled`
    // (which does not check `mutation.isPending`) even mid-delete — closing
    // the confirmation while the mutation kept running in the background.
    await user.keyboard('{Escape}')
    expect(confirmDialog).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Edit event' })).toBeInTheDocument()

    const backdrop = confirmDialog.parentElement as HTMLElement
    fireEvent.mouseDown(backdrop)
    expect(confirmDialog).toBeInTheDocument()

    // Let the deferred delete resolve so no pending state leaks past this
    // test — the assertions above are already made.
    resolveDelete()
    await pendingDelete
  })
})
