import type { FC } from 'react'
import { useEventStore } from '../../../shared/model'
import { EventDialogForm } from './EventDialogForm'

/**
 * The Event dialog's entry point (design.md D1): reads `dialogTarget`
 * straight from the shared store — `event-calendar` opens it, this feature
 * renders it, neither owns the other. Renders nothing while closed.
 *
 * `EventDialogForm` is keyed by the target so that opening a different
 * event (or opening Create) always remounts it — the mechanism behind
 * design.md D2's "hydrate once" rule: a fresh mount means a fresh
 * `useState` initializer inside the form's controller hook, computed once
 * from the store's data at that instant and never re-derived afterwards.
 */
export const EventDialog: FC = () => {
  const dialogTarget = useEventStore((state) => state.dialogTarget)

  if (dialogTarget.type === 'closed') {
    return null
  }

  return (
    <EventDialogForm
      key={dialogTarget.type === 'edit' ? dialogTarget.eventId : 'create'}
      target={dialogTarget}
    />
  )
}
