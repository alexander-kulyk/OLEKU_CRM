## Purpose

Defines safe calendar rescheduling by drag and drop, including view-specific movement, duration preservation, optimistic feedback, concurrency recovery, and accessible alternatives.

## ADDED Requirements

### Requirement: Eligible events can be moved in every calendar view

An operator SHALL be able to drag an existing single-day timed event in Month, Week, and Day views. Month movement SHALL select a destination date while preserving the original local start time. Week movement SHALL select a destination date and time. Day movement SHALL select a destination time on the displayed date. Multi-day timed events and all-day events SHALL NOT be draggable.

#### Scenario: Month move changes the date

- **WHEN** an eligible event starting at 10:00 is dragged from one Month-view date cell to another
- **THEN** its proposed start uses the destination date at 10:00 in the calendar display zone

#### Scenario: Week move changes time, date, or both

- **WHEN** an eligible event is dragged vertically, horizontally, or diagonally in Week view
- **THEN** its proposed start uses respectively the destination time, date, or date and time

#### Scenario: Day move changes the time

- **WHEN** an eligible event is dragged upward or downward in Day view
- **THEN** its proposed start uses the destination time on the displayed date

#### Scenario: Ineligible span cannot be dragged

- **WHEN** an event is all-day or its start and end fall on different local calendar dates
- **THEN** the calendar does not offer drag rescheduling for that event

### Requirement: Every move preserves elapsed duration

The system SHALL define original duration as the elapsed milliseconds between the stored `startAt` and `endAt`. For every effective drop, the proposed `endAt` SHALL equal the proposed `startAt` plus that original duration. This elapsed-duration invariant SHALL take precedence over retaining the original wall-clock end time when a move crosses a time-zone offset transition.

#### Scenario: Ordinary move retains the span

- **WHEN** an event from 10:00 to 11:30 is moved to start at 14:00 without an offset transition
- **THEN** its proposed end is 15:30
- **AND** its duration remains 90 minutes

#### Scenario: Move crosses a daylight-saving transition

- **WHEN** a date move gives an event a new start whose UTC offset differs from its original start
- **THEN** the proposed end is computed from the new start plus the original elapsed duration
- **AND** any resulting change to the displayed wall-clock end does not change that duration

### Requirement: Timed movement uses an explicit snap interval

Week-view and Day-view destination times SHALL resolve to 30-minute boundaries in the calendar display zone. The calendar's resolved destination SHALL be the source of the proposed start; the application SHALL NOT derive time from pointer pixels independently.

#### Scenario: Timed drop snaps to a boundary

- **WHEN** an event is dropped between two timed-grid boundaries
- **THEN** its proposed start resolves to the calendar-selected 30-minute boundary

### Requirement: An effective drop persists one schedule update

An effective drop SHALL preserve the event identifier and issue exactly one `PATCH /api/events/:id` carrying the current `version`, proposed `startAt`, and duration-derived `endAt`. The drag request SHALL NOT carry title, color, attendee, or host changes.

#### Scenario: Effective move sends one request

- **WHEN** an eligible event is dropped at a different valid schedule position
- **THEN** exactly one PATCH targets that event's existing identifier
- **AND** the body contains `version`, `startAt`, and `endAt` and no other editable event field

#### Scenario: Identity survives a move

- **WHEN** the server accepts a drag update
- **THEN** the calendar continues to represent the event under its original identifier

### Requirement: Drag rescheduling is optimistic and event-scoped

Immediately after an effective drop, the calendar SHALL display the event at the proposed schedule and expose an event-level pending state. While that request is pending, another mutation of the same event SHALL be prevented, while interactions with other events SHALL remain available.

#### Scenario: Pending move is immediately visible

- **WHEN** an effective drop starts its PATCH request
- **THEN** the event is displayed at the proposed schedule before the response arrives
- **AND** that event is visibly and programmatically identifiable as pending

#### Scenario: Rapid repeated activation is suppressed

- **WHEN** the operator attempts to drag or edit the same event while its drag request is pending
- **THEN** no second mutation of that event starts

#### Scenario: Other events remain usable

- **WHEN** one event has a pending drag request
- **THEN** eligible interactions with a different event remain available

#### Scenario: Navigation during a pending move

- **WHEN** the operator changes the rendered period or view while a drag request is pending
- **THEN** completion of that request does not inject the event into an unrelated rendered period

### Requirement: Successful persistence adopts server truth

When a drag PATCH succeeds, the calendar SHALL reconcile the event from the returned event payload, including its normalized instants and incremented version, and SHALL clear the pending state. Success SHALL NOT depend on a follow-up period read.

#### Scenario: Successful drop is reconciled

- **WHEN** the server returns the updated event for a drag PATCH
- **THEN** the calendar adopts the returned schedule and version
- **AND** the event's pending state is cleared

#### Scenario: Older period data cannot restore stale values

- **WHEN** a period read started before a successful drag returns after the PATCH response
- **THEN** it does not overwrite the event's newer returned schedule or version

### Requirement: Failed persistence restores the original schedule

When a drag PATCH fails validation, fails unexpectedly, or cannot be completed because of a transport error, the calendar SHALL restore the event's exact pre-drag `startAt` and `endAt`, clear its pending state, preserve its identifier, and present an accessible non-technical error message whose category remains distinguishable to the client.

#### Scenario: Validation failure rolls back

- **WHEN** a drag PATCH returns `VALIDATION_ERROR`
- **THEN** the event returns to its exact pre-drag schedule
- **AND** an accessible validation message is presented

#### Scenario: Transport or server failure rolls back

- **WHEN** a drag PATCH fails in transport or returns `INTERNAL_ERROR`
- **THEN** the event returns to its exact pre-drag schedule
- **AND** an accessible retry-oriented message is presented

### Requirement: Stale or deleted events are refreshed after rollback

When a drag PATCH returns `EVENT_VERSION_CONFLICT` or `NOT_FOUND`, the calendar SHALL first restore the pre-drag schedule and then refresh the currently rendered period from the server. A conflict SHALL present a stale-data message and adopt the current server event. A missing event SHALL present an unavailable message and remove the event when the refresh confirms its deletion.

#### Scenario: Version conflict adopts current data

- **WHEN** a drag PATCH returns `409 EVENT_VERSION_CONFLICT`
- **THEN** the optimistic move is rolled back
- **AND** the rendered period is refreshed
- **AND** the latest returned server event replaces the stale version

#### Scenario: Event was deleted concurrently

- **WHEN** a drag PATCH returns `404 NOT_FOUND`
- **THEN** the optimistic move is rolled back and an unavailable message is presented
- **AND** a refresh removes the event if it is absent from the current server data

### Requirement: Non-moves never persist

Cancelled drags, drops outside a valid target, drops rejected by calendar constraints, drops resolving to the original `startAt` and `endAt`, and calendar view or period changes SHALL NOT start an event update or pending state.

#### Scenario: Same-position drop is a no-op

- **WHEN** a drop resolves to the event's original `startAt` and `endAt`
- **THEN** no PATCH is sent and no pending state is shown

#### Scenario: Cancelled or invalid drop is a no-op

- **WHEN** a drag is cancelled or ends outside a valid target
- **THEN** the event remains at its original schedule
- **AND** no PATCH is sent

#### Scenario: View navigation does not mutate events

- **WHEN** the operator changes calendar view or rendered period without dropping an event
- **THEN** no event update is sent

### Requirement: Dragging never resizes or replaces accessible editing

Drag interaction SHALL change schedule position only and SHALL NOT expose duration-resize controls. Selecting an event SHALL continue to open the Edit Event dialog, whose date and time controls SHALL remain a non-drag rescheduling path.

#### Scenario: Resize is unavailable

- **WHEN** an event is displayed in a draggable view
- **THEN** no drag handle or interaction can change only its duration

#### Scenario: Event dialog remains available

- **WHEN** an operator activates an existing event without dragging it
- **THEN** the Edit Event dialog opens with its date, start-time, and end-time controls
