## Purpose

Defines the exact server contract for reading events over a calendar period and creating, partially updating, and deleting events with validated participants and unambiguous instants.

## ADDED Requirements

### Requirement: Calendar reads use an exact bounded route

`GET /api/events` SHALL require `from` and `to` query parameters and SHALL return `{ "events": [...] }`. An event overlaps the requested half-open period when `startAt < to` and `endAt > from`. There SHALL be no unbounded event read.

#### Scenario: Overlapping events are returned

- **WHEN** `GET /api/events?from=<from>&to=<to>` names a valid period
- **THEN** every event starting before `to` and ending after `from` is returned
- **AND** the response status is 200

#### Scenario: Touching boundaries do not overlap

- **WHEN** one event ends exactly at `from` and another starts exactly at `to`
- **THEN** neither event is returned

#### Scenario: Missing period boundary

- **WHEN** `from` or `to` is absent
- **THEN** the response status is 400 with `VALIDATION_ERROR`
- **AND** no persistence query is performed

#### Scenario: Inverted period

- **WHEN** `to` is not later than `from`
- **THEN** the response status is 400 with `VALIDATION_ERROR`

### Requirement: Accepted instants are zone-explicit absolute moments

Every instant accepted in `from`, `to`, `startAt`, or `endAt` SHALL be an ISO 8601 date-time carrying either `Z` or a numeric UTC offset in `+HH:MM` or `-HH:MM` form. It SHALL be interpreted as the absolute moment it denotes. Date-only and zone-less values SHALL be rejected.

#### Scenario: Numeric offset is accepted

- **WHEN** a request supplies `2026-08-09T09:00:00+03:00`
- **THEN** it is accepted as the same moment as `2026-08-09T06:00:00Z`

#### Scenario: Equivalent periods select the same events

- **WHEN** two calendar reads express the same boundaries using `Z` and numeric offsets
- **THEN** both return the same event identifiers

#### Scenario: Ambiguous instant is rejected

- **WHEN** an instant is date-only or has no zone designator
- **THEN** the response status is 400 with `VALIDATION_ERROR`

### Requirement: Returned events use the domain payload

Every returned event SHALL carry exactly `id`, `title`, `startAt`, `endAt`, `attendees`, and `hosts`. `id` SHALL be a string. Each instant SHALL include a time component and explicit zone designator. Each participant SHALL be a resolved `{ id, firstName, lastName, fullName }` object rather than a bare identifier.

#### Scenario: Event response shape

- **WHEN** an event is returned by any event endpoint
- **THEN** it has the declared domain fields and no audit fields
- **AND** its participants are resolved person summaries
- **AND** its instants cannot be interpreted as date-only values

### Requirement: Events can be created

`POST /api/events` SHALL accept `title`, `startAt`, `endAt`, and optional `attendeeIds` and `hostIds`. Omitted participant arrays SHALL default to empty arrays. A successful create SHALL return status 201 and the created event directly.

#### Scenario: Valid event creation

- **WHEN** a valid create body is submitted
- **THEN** the response status is 201
- **AND** the body is the created event with its assigned identifier
- **AND** a covering calendar read returns it

#### Scenario: Creation without participants

- **WHEN** a valid create body omits both participant arrays
- **THEN** the created event has empty attendee and host arrays

### Requirement: Event titles are meaningful

An event title SHALL be required on create, SHALL be trimmed before storage, and SHALL NOT be empty or whitespace-only. A supplied title on update SHALL follow the same rules.

#### Scenario: Whitespace-only title

- **WHEN** create or update supplies a whitespace-only title
- **THEN** the response status is 400 with `VALIDATION_ERROR`
- **AND** no event is created or modified

#### Scenario: Padded title

- **WHEN** a valid title has leading or trailing whitespace
- **THEN** the stored and returned title is trimmed

### Requirement: End is strictly later than start

Every create or update SHALL be rejected when its resulting `endAt` is not strictly later than its resulting `startAt`. This invariant SHALL hold on every event write path.

#### Scenario: Invalid span on create

- **WHEN** create supplies an end equal to or earlier than its start
- **THEN** the response status is 400 with `VALIDATION_ERROR`
- **AND** no event is created

#### Scenario: Partial update would invert the span

- **WHEN** PATCH changes one or both boundaries and the merged event would have an end not later than its start
- **THEN** the response status is 400 with `VALIDATION_ERROR`
- **AND** the stored event is unchanged

### Requirement: PATCH updates only supplied fields

`PATCH /api/events/:id` SHALL accept any non-empty subset of `title`, `startAt`, `endAt`, `attendeeIds`, and `hostIds`. Omitted fields SHALL retain their stored values. A supplied participant array SHALL replace that role's entire set; an empty array SHALL clear it. A successful update SHALL return status 200 and the updated event directly.

#### Scenario: Title-only update

- **WHEN** PATCH supplies only `title`
- **THEN** the title changes
- **AND** the stored instants and participant assignments remain unchanged

#### Scenario: Participant set replacement

- **WHEN** PATCH supplies `attendeeIds` containing B and C for an event currently assigned A and B
- **THEN** the stored attendee set becomes exactly B and C

#### Scenario: Empty participant array

- **WHEN** PATCH supplies an empty `hostIds` array
- **THEN** every host assignment is removed

#### Scenario: Empty update body

- **WHEN** PATCH supplies none of the editable fields
- **THEN** the response status is 400 with `VALIDATION_ERROR`

#### Scenario: Unknown event on update

- **WHEN** PATCH targets a well-formed identifier matching no event
- **THEN** the response status is 404 with `NOT_FOUND`

### Requirement: New participant assignments must be valid

Attendees SHALL reference contacts and hosts SHALL reference employees. Every participant newly assigned by create or update SHALL exist and have `status=active`; every newly assigned host SHALL additionally have `canHostEvents=true`. A failed participant check SHALL leave the event unchanged.

#### Scenario: Unknown or wrong-role participant

- **WHEN** a write newly assigns an unknown id, an employee as attendee, or a contact as host
- **THEN** the response status is 400 with `INVALID_PARTICIPANT`
- **AND** the event is not created or modified

#### Scenario: Inactive person is newly assigned

- **WHEN** a write newly assigns a contact or employee whose status is inactive
- **THEN** the response status is 400 with `INVALID_PARTICIPANT`

#### Scenario: Ineligible host is newly assigned

- **WHEN** a write newly assigns an employee whose `canHostEvents` is false as a host
- **THEN** the response status is 400 with `INVALID_PARTICIPANT`

#### Scenario: Existing assignment is retained

- **WHEN** an assigned person later becomes inactive or an assigned host becomes ineligible
- **AND** PATCH either omits that role's array or supplies an array retaining the same identifier
- **THEN** the update may succeed and the existing assignment remains

### Requirement: Duplicate assignments collapse within a role

The same participant identifier SHALL appear at most once in each stored attendee or host set. Duplicate ids in a submitted set SHALL collapse to one assignment rather than creating duplicates.

#### Scenario: Repeated identifier

- **WHEN** a write submits the same identifier more than once in one participant array
- **THEN** the write succeeds if the assignment is otherwise valid
- **AND** the returned event contains that person once in that role

### Requirement: Dangling participant references do not break reads

When an event contains a participant reference that no longer resolves, the event SHALL still be returned. The missing participant SHALL be omitted from the resolved collection without affecting other events or participants.

#### Scenario: Missing participant on calendar read

- **WHEN** a matching event contains one unresolvable participant reference
- **THEN** the calendar read succeeds
- **AND** the event and its resolvable participants are returned
- **AND** the unresolvable participant is omitted

### Requirement: Audit fields are server-controlled

Stored events SHALL carry nullable `createdByUserId` and `updatedByUserId`, both written as null until authentication exists. A client-supplied audit value SHALL be ignored and SHALL NOT be persisted. Audit fields SHALL NOT appear in event responses.

#### Scenario: Client supplies audit fields

- **WHEN** create or update includes a creating or updating user identifier
- **THEN** the supplied value is not persisted
- **AND** both stored audit fields remain null
- **AND** neither audit field appears in the response

### Requirement: Failed writes are atomic

A failed create, update, or delete SHALL leave stored event data unchanged and SHALL NOT produce a partial participant or span update.

#### Scenario: Participant validation fails during update

- **WHEN** PATCH contains a valid title and an invalid new participant assignment
- **THEN** the response status is 400
- **AND** the original title and participant sets remain stored

### Requirement: Events can be deleted

`DELETE /api/events/:id` SHALL return status 204 with no body after deleting an existing event. A well-formed identifier matching no event SHALL receive 404. A malformed identifier SHALL receive 400.

#### Scenario: Successful deletion

- **WHEN** DELETE targets an existing event
- **THEN** the response status is 204 with no body
- **AND** subsequent calendar reads do not return the event

#### Scenario: Unknown event deletion

- **WHEN** DELETE targets a well-formed identifier matching no event
- **THEN** the response status is 404 with `NOT_FOUND`

#### Scenario: Malformed event identifier

- **WHEN** PATCH or DELETE targets a malformed event identifier
- **THEN** the response status is 400 with `VALIDATION_ERROR`
