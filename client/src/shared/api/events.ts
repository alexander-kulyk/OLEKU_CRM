import { httpClient } from './http-client'
import type {
  CreateEventInput,
  EventPeriod,
  EventRecord,
  UpdateEventInput,
} from './event-types'

/** Shape of `GET /api/events` — the only list response the server sends. */
interface EventListResponse {
  readonly events: readonly EventRecord[]
}

/**
 * Reads every event overlapping the given period (half-open: `startAt < to
 * AND endAt > from`). `from`/`to` are forwarded exactly as received
 * (design.md D3) — never reformatted, truncated, or supplemented.
 *
 * This is the ONLY place an event read's query is assembled, and it is a
 * two-key object literal built from named fields — never a spread of a
 * caller-supplied object — so nothing downstream can append a third
 * parameter and turn the request into a `VALIDATION_ERROR` (R-001).
 */
export async function readEventsForPeriod(
  period: EventPeriod,
): Promise<readonly EventRecord[]> {
  const response = await httpClient.get<EventListResponse>('/events', {
    params: { from: period.from, to: period.to },
  })

  return response.data.events
}

/** Creates an event. Omitted participant arrays default to `[]` server-side. */
export async function createEvent(
  input: CreateEventInput,
): Promise<EventRecord> {
  const response = await httpClient.post<EventRecord>('/events', input)

  return response.data
}

/**
 * Updates an event. `input` is forwarded verbatim: a key the caller did
 * not set stays `undefined` and is dropped by `JSON.stringify` on the way
 * out, while an explicit `[]` is sent as `[]`. Nothing in this function
 * defaults `attendeeIds`/`hostIds`, so the caller's "leave unchanged" vs.
 * "clear it" intent survives to the server untouched (research EVID-004).
 */
export async function updateEvent(
  id: string,
  input: UpdateEventInput,
): Promise<EventRecord> {
  const response = await httpClient.patch<EventRecord>(`/events/${id}`, input)

  return response.data
}

/** Deletes an event. The server returns `204` with no body. */
export async function deleteEvent(id: string): Promise<void> {
  await httpClient.delete(`/events/${id}`)
}
