## Purpose

Defines how scheduled events are stored, read for a calendar period, created, replaced, and deleted, including the participant rules and the time-instant contract the calendar depends on. It is the behavioral contract behind the Events page's calendar and its event dialog.

## ADDED Requirements

### Requirement: Period-bounded calendar read

The system SHALL return events by requested period only. Both period boundaries MUST be supplied; there is no unbounded read of all events. An event is in the period when it overlaps it — its start is before the period end and its end is after the period start.

#### Scenario: Overlapping events returned

- **WHEN** a client requests events for a period
- **AND** a stored event's time span overlaps that period at any point, including events that begin before it or end after it
- **THEN** the event is included in the response

#### Scenario: Non-overlapping events excluded

- **WHEN** a client requests events for a period
- **AND** a stored event lies entirely before or entirely after that period
- **THEN** the event is absent from the response

#### Scenario: Touching boundaries do not overlap

- **WHEN** a stored event ends exactly at the requested period start, or begins exactly at the requested period end
- **THEN** the event is absent from the response

#### Scenario: Missing period rejected

- **WHEN** a client requests events without both period boundaries
- **THEN** the response status is 400
- **AND** no events are returned

#### Scenario: Inverted period rejected

- **WHEN** a client requests events whose period end is not later than its period start
- **THEN** the response status is 400

### Requirement: Instants accept a numeric UTC offset

Every time instant accepted by this capability — in period boundaries and in event bodies — SHALL be an ISO 8601 instant carrying either a `Z` designator or a numeric `+HH:MM` / `-HH:MM` offset. A calendar client formats boundaries using the browser's local offset, so rejecting the numeric-offset form would make the calendar appear empty rather than report an error.

#### Scenario: Offset-bearing instant accepted

- **WHEN** a request supplies an instant such as `2026-08-09T09:00:00+03:00`
- **THEN** the request is accepted
- **AND** the instant is interpreted as the same moment as its UTC equivalent

#### Scenario: UTC instant accepted

- **WHEN** a request supplies an instant ending in `Z`
- **THEN** the request is accepted

#### Scenario: Zone-less instant rejected

- **WHEN** a request supplies a date-only value, or a date and time with no zone designator or offset
- **THEN** the response status is 400
- **AND** the error identifies the offending field

#### Scenario: Equivalent instants select the same events

- **WHEN** two calendar reads request the same moments, one expressed with `Z` and one with a numeric offset
- **THEN** both return the same set of events

### Requirement: Returned instants are time-bearing and zone-explicit

Every instant the system returns SHALL include a time component and an explicit zone designator. A date-only value would cause a calendar client to reinterpret a timed event as an all-day event.

#### Scenario: Event instants in a response

- **WHEN** an event is returned by any endpoint of this capability
- **THEN** its start and end are ISO 8601 instants that include a time component and a zone designator

### Requirement: Event payload shape

An event returned by the system SHALL carry a stable identifier, its title, its start and end instants, and its assigned attendees and hosts as resolved person records rather than bare identifiers, so a client can render participant names without a second request.

#### Scenario: Reading an event

- **WHEN** an event is returned
- **THEN** it carries an identifier, a title, a start instant, an end instant, an attendee collection, and a host collection
- **AND** each participant entry carries at least an identifier and both name parts

### Requirement: Event creation

The system SHALL create an event from a title, a start instant, an end instant, and optional attendee and host assignments, and return the created event.

#### Scenario: Valid creation

- **WHEN** a client submits a valid new event
- **THEN** the response status is 201
- **AND** the response carries the created event including its new identifier
- **AND** a subsequent calendar read covering that period includes the event

#### Scenario: Blank title rejected

- **WHEN** a client submits an event whose title is empty or consists only of whitespace
- **THEN** the response status is 400
- **AND** no event is created

#### Scenario: Over-long title rejected

- **WHEN** a client submits an event whose title exceeds the permitted length
- **THEN** the response status is 400
- **AND** no event is created

#### Scenario: Creation without participants

- **WHEN** a client submits a valid event with no attendees and no hosts
- **THEN** the event is created with empty attendee and host collections

### Requirement: End must be strictly later than start

The system SHALL reject any create or update whose end instant is not strictly later than its start instant, and MUST enforce this on every write path. A calendar client silently discards an end that is not after the start and substitutes a default duration, so an unenforced span renders as a plausible but wrong block instead of an error.

#### Scenario: Equal instants rejected on creation

- **WHEN** a client submits an event whose end equals its start
- **THEN** the response status is 400
- **AND** no event is created

#### Scenario: Inverted span rejected on creation

- **WHEN** a client submits an event whose end is earlier than its start
- **THEN** the response status is 400
- **AND** no event is created

#### Scenario: Inverted span rejected on update

- **WHEN** a client updates an existing event so that its end is not later than its start
- **THEN** the response status is 400
- **AND** the stored event is unchanged

### Requirement: Update replaces the whole event

An update SHALL carry the complete event. Every updatable field, including both participant collections, is replaced by the submitted value; an omitted participant collection means the event has no participants of that kind. There is no partial-merge update that leaves unsent fields untouched.

#### Scenario: Successful update

- **WHEN** a client updates an existing event with valid values
- **THEN** the response status is 200
- **AND** the response carries the updated event
- **AND** a subsequent read reflects every submitted value

#### Scenario: Omitted participants clear assignments

- **WHEN** a client updates an existing event that has assigned attendees and hosts
- **AND** the request omits both participant collections
- **THEN** the stored event afterwards has no attendees and no hosts

#### Scenario: Updating a nonexistent event

- **WHEN** a client updates an event identifier that does not exist
- **THEN** the response status is 404
- **AND** nothing is created

### Requirement: Event deletion

The system SHALL delete an existing event and remove it from subsequent calendar reads.

#### Scenario: Deleting an existing event

- **WHEN** a client deletes an existing event
- **THEN** the deletion succeeds
- **AND** a subsequent calendar read covering that period does not include the event

#### Scenario: Deleting a nonexistent event

- **WHEN** a client deletes an event identifier that does not exist
- **THEN** the response status is 404

### Requirement: Participants must exist and be assignable

The system SHALL reject an assignment naming a person who does not exist, a person whose status is not active, or an employee not eligible to host when assigned as a host. Eligibility is enforced on write, not merely filtered out of directory reads.

#### Scenario: Unknown participant rejected

- **WHEN** a client assigns an attendee or host identifier that matches no stored person
- **THEN** the response status is 400
- **AND** the event is neither created nor modified

#### Scenario: Ineligible host rejected

- **WHEN** a client assigns as host an employee not marked as able to host events
- **THEN** the response status is 400
- **AND** the event is neither created nor modified

#### Scenario: Non-active person rejected

- **WHEN** a client assigns a person whose status is not active
- **THEN** the response status is 400
- **AND** the event is neither created nor modified

#### Scenario: Attendees come from contacts and hosts from employees

- **WHEN** a client assigns an employee identifier as an attendee, or a contact identifier as a host
- **THEN** the response status is 400
- **AND** the event is neither created nor modified

### Requirement: No duplicate assignment

The system SHALL NOT assign the same person to an event twice in the same role.

#### Scenario: Repeated identifier in one request

- **WHEN** a client submits the same person identifier more than once in the same participant collection
- **THEN** the person is assigned exactly once
- **AND** the response reflects a single assignment

#### Scenario: Same person in both roles

- **WHEN** a person is eligible in both roles and is assigned once as attendee and once as host
- **THEN** both assignments are retained, since they are different roles

### Requirement: Unresolvable participant references do not break a read

If an assigned participant can no longer be resolved to a person, the event SHALL still be returned with its remaining participants, so one dangling reference cannot make a whole calendar period unreadable.

#### Scenario: Event referencing a missing person

- **WHEN** a calendar read includes an event whose assigned participant no longer resolves to a stored person
- **THEN** the event is returned
- **AND** the unresolvable participant is omitted from the returned participant collection
- **AND** the remaining participants are present

### Requirement: Audit fields are server-controlled

The event record SHALL carry a creating actor and an updating actor, and these values MUST NOT be accepted from the request. Until authentication exists there is no trustworthy actor, so they are recorded as absent.

#### Scenario: Client supplies an actor identifier

- **WHEN** a client submits an event body containing a creating or updating actor identifier
- **THEN** the submitted value is ignored
- **AND** the stored event's actor fields remain absent

### Requirement: Event storage carries the declared field set

Stored events SHALL persist title, start instant, end instant, attendee assignments, host assignments, and the two actor fields, and MUST be queryable by time period without scanning every event.

#### Scenario: Round-tripping an event

- **WHEN** an event is created and then read back
- **THEN** every stored field is returned unchanged apart from server-controlled values

#### Scenario: Period query is index-supported

- **WHEN** a calendar read is issued for a period
- **THEN** the query is satisfied using a declared index on the event time fields
