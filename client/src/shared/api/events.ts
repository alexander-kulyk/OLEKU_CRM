import { httpClient } from './http-client';
import type {
  CreateEventInput,
  EventPeriod,
  EventRecord,
  UpdateEventInput,
} from './event-types';

/** Shape of `GET /api/events` — the only list response the server sends. */
interface EventListResponse {
  readonly events: readonly EventRecord[];
}

export async function readEventsForPeriod(
  period: EventPeriod,
): Promise<readonly EventRecord[]> {
  const response = await httpClient.get<EventListResponse>('/events', {
    params: { from: period.from, to: period.to },
  });

  return response.data.events;
}

export async function createEvent(
  input: CreateEventInput,
): Promise<EventRecord> {
  const response = await httpClient.post<EventRecord>('/events', input);

  return response.data;
}

export async function updateEvent(
  id: string,
  input: UpdateEventInput,
): Promise<EventRecord> {
  const response = await httpClient.patch<EventRecord>(`/events/${id}`, input);

  return response.data;
}

/** Deletes an event. The server returns `204` with no body. */
export async function deleteEvent(id: string): Promise<void> {
  await httpClient.delete(`/events/${id}`);
}
