/**
 * Client-side event and participant types, matching the shipped server
 * response shape exactly (research.md EVID-004, EVID-007, EVID-002). These
 * are not re-derived — they mirror the wire contract as observed on
 * `feat/add-events-server-api`.
 */

/**
 * A person already resolved by the server onto an event — an attendee or a
 * host. The list/create/update responses carry these directly, so the
 * Event dialog never needs a second request to render a name (F-001).
 */
export interface EventParticipant {
  readonly id: string
  readonly firstName: string
  readonly lastName: string
  readonly fullName: string
}

/** An event exactly as every event endpoint (list, create, update) returns it. */
export interface EventRecord {
  readonly id: string
  readonly title: string
  /** Zone-explicit ISO instant. */
  readonly startAt: string
  /** Zone-explicit ISO instant. */
  readonly endAt: string
  readonly attendees: readonly EventParticipant[]
  readonly hosts: readonly EventParticipant[]
}

/**
 * The exact `from`/`to` window sent on a period read — zone-explicit ISO
 * instants, passed through unmodified from FullCalendar's `datesSet`
 * (design.md D3). `to` must be strictly greater than `from`.
 */
export interface EventPeriod {
  readonly from: string
  readonly to: string
}

/**
 * Body for `POST /api/events`. Omitted participant arrays default to `[]`
 * server-side.
 */
export interface CreateEventInput {
  readonly title: string
  readonly startAt: string
  readonly endAt: string
  readonly attendeeIds?: readonly string[]
  readonly hostIds?: readonly string[]
}

/**
 * Body for `PATCH /api/events/:id`. Every field is optional, but an
 * OMITTED `attendeeIds`/`hostIds` key means "leave unchanged" while an
 * explicit `[]` means "clear it" (research EVID-004). This type — and the
 * function that sends it — must never collapse that distinction by
 * defaulting a missing key to `[]`; callers that intend to touch
 * participants are responsible for passing the complete intended set
 * (Stage 5/6).
 */
export interface UpdateEventInput {
  readonly title?: string
  readonly startAt?: string
  readonly endAt?: string
  readonly attendeeIds?: readonly string[]
  readonly hostIds?: readonly string[]
}
