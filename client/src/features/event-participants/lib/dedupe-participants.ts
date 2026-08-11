import type { EventParticipant } from '../../../shared/api'

/**
 * Removes duplicate people by `id`, keeping the first occurrence — the
 * mechanical guard behind "Duplicates within one Add"
 * (specs/event-participants/spec.md). The directory service already
 * returns unique people and a `Set` of pending ids can't hold a duplicate
 * either, so this mostly documents and independently verifies the
 * guarantee rather than being reachable through the current UI.
 */
export function dedupeById(people: readonly EventParticipant[]): readonly EventParticipant[] {
  const seenIds = new Set<string>()
  const deduped: EventParticipant[] = []

  for (const person of people) {
    if (seenIds.has(person.id)) {
      continue
    }

    seenIds.add(person.id)
    deduped.push(person)
  }

  return deduped
}
