import type { FC } from 'react'
import type { EventParticipant } from '../../../shared/api'

interface EventParticipantsSectionProps {
  readonly title: string
  readonly people?: readonly EventParticipant[]
}

/**
 * The Attendees / Hosts sections of the Event dialog structure
 * (specs/event-management/spec.md — "Event dialog structure" requires both
 * sections to be present in every open dialog). Selection, search, and the
 * Add step are Stage 6's job — this renders only a minimal placeholder, plus
 * a read-only list of the event's current people when editing (context, not
 * required by this stage).
 */
export const EventParticipantsSection: FC<EventParticipantsSectionProps> = ({
  title,
  people,
}) => {
  const hasPeople = people !== undefined && people.length > 0

  return (
    <section className="flex flex-col gap-xs rounded-md border border-border p-md">
      <h3 className="text-sm font-semibold text-text">{title}</h3>
      {hasPeople && (
        <p className="text-sm text-text-muted">
          {people.map((person) => person.fullName).join(', ')}
        </p>
      )}
      <p className="text-xs text-text-muted">
        {title} assignment is added in a later stage.
      </p>
    </section>
  )
}
