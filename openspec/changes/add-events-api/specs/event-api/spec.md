## Purpose

Persists scheduled events — lessons, meetings, consultations — and exposes the reads and writes a calendar interface needs: everything happening in a visible period, plus creating, updating, and deleting a single event with its attendees and hosts. It owns the scheduling invariants that the storage layer cannot enforce on its own.

## ADDED Requirements

### Requirement: An event is a titled span with attendees and hosts

An event record SHALL carry a title, a start instant, an end instant, a set of attendee references into the contact directory, and a set of host references into the employee directory. Attendees and hosts SHALL be optional; an event with neither is valid.

#### Scenario: An event stores its span and participants

- **WHEN** an event is created with a title, a start, an end, two attendees, and one host
- **THEN** the stored event carries all of them
- **AND** it is returned with the same title, span, and participants

#### Scenario: An event without participants is valid

- **WHEN** an event is created with no attendees and no hosts
- **THEN** the event is created successfully
- **AND** it is returned with empty attendee and host collections

### Requirement: An event title must carry meaning

An event title SHALL be required and SHALL NOT be empty or consist only of whitespace. Surrounding whitespace SHALL be trimmed before storage, and the trimmed value SHALL be what is stored and returned.

#### Scenario: A whitespace-only title is rejected

- **WHEN** an event is created or updated with a title consisting only of spaces
- **THEN** the response status is 400 in the shared error envelope
- **AND** no event is created or modified

#### Scenario: A padded title is stored trimmed

- **WHEN** an event is created with a title surrounded by whitespace
- **THEN** the stored and returned title has no leading or trailing whitespace

### Requirement: An event must end after it starts

The end instant SHALL be strictly later than the start instant. This SHALL be rejected at the request boundary, and SHALL also be rejected by the persistence layer, so a write that does not pass through an endpoint cannot store an inverted or zero-length span.

#### Scenario: An end before the start is rejected

- **WHEN** an event is created with an end earlier than its start
- **THEN** the response status is 400 in the shared error envelope
- **AND** no event is stored

#### Scenario: An end equal to the start is rejected

- **WHEN** an event is created with an end exactly equal to its start
- **THEN** the response status is 400 in the shared error envelope

#### Scenario: An inverted span cannot bypass the endpoint

- **WHEN** an event with an end not later than its start is written directly to persistence
- **THEN** the write is rejected
- **AND** no such record exists in storage

#### Scenario: An update cannot invert an existing span

- **WHEN** an existing event is updated with only a new end that is earlier than its stored start
- **THEN** the response status is 400
- **AND** the stored event is unchanged

### Requirement: The calendar reads events by overlapping period

The API SHALL expose a read returning every event that overlaps a requested period, where an event overlaps when it starts before the period ends and ends after the period begins. Events touching the period only at a boundary SHALL NOT be returned.

#### Scenario: An event fully inside the period is returned

- **WHEN** events are requested for a period and an event starts and ends within it
- **THEN** the event is in the response

#### Scenario: An event straddling either boundary is returned

- **WHEN** an event starts before the period and ends inside it, and another starts inside the period and ends after it
- **THEN** both events are in the response

#### Scenario: An event spanning the whole period is returned

- **WHEN** an event starts before the period begins and ends after it ends
- **THEN** the event is in the response

#### Scenario: An event entirely outside the period is excluded

- **WHEN** an event ends before the period begins, or begins after the period ends
- **THEN** the event is not in the response

#### Scenario: An event abutting a boundary is excluded

- **WHEN** an event ends at exactly the instant the period begins
- **THEN** the event is not in the response

### Requirement: The calendar read is always bounded

The period boundaries SHALL be required — there SHALL be no read that returns every event. Both boundaries SHALL be well-formed instants, the end SHALL be later than the start, and a period longer than a documented maximum span of 366 days SHALL be rejected.

#### Scenario: A missing boundary is rejected

- **WHEN** events are requested without one or both period boundaries
- **THEN** the response status is 400 in the shared error envelope
- **AND** no query is executed

#### Scenario: An inverted period is rejected

- **WHEN** events are requested for a period whose end is not later than its start
- **THEN** the response status is 400

#### Scenario: An excessive period is rejected

- **WHEN** events are requested for a period spanning more than 366 days
- **THEN** the response status is 400

### Requirement: Instants are exchanged with an explicit zone and stored as absolute time

Instants SHALL be accepted in ISO 8601 form carrying either a `Z` designator or a numeric UTC offset, and SHALL be stored as absolute instants without server-side reinterpretation of any local zone. Instants SHALL be returned in ISO 8601 form that always includes a time component and an explicit zone designator, so a consumer can never read a returned instant as a date without a time.

#### Scenario: An offset-bearing instant is accepted

- **WHEN** an event is created with a start expressed with a numeric UTC offset such as `+03:00`
- **THEN** the request succeeds
- **AND** the returned start denotes the same absolute instant

#### Scenario: The same absolute instant is equal regardless of how it was expressed

- **WHEN** two events are created, one with a start expressed with a `Z` designator and one expressing the identical instant with a numeric offset
- **THEN** both stored starts denote the same absolute instant

#### Scenario: An instant without a zone is rejected

- **WHEN** an event is created with a start that carries no zone designator and no offset
- **THEN** the response status is 400

#### Scenario: A returned instant is never zone-ambiguous or time-less

- **WHEN** any event is returned
- **THEN** its start and end each carry a time component and an explicit zone designator

### Requirement: The read payload drives a calendar without further lookups

Each returned event SHALL carry a string identifier, its title, both boundary instants, and its attendees and hosts resolved to displayable people rather than bare references. A consumer SHALL be able to render an event and its assigned participants from the calendar read alone, without fetching the directory.

#### Scenario: Participants are returned resolved

- **WHEN** an event with assigned attendees and hosts is read
- **THEN** each attendee and host carries an identifier, both name parts, and a display name
- **AND** no bare reference identifier is returned in their place

#### Scenario: The identifier is a string

- **WHEN** any event is returned
- **THEN** its identifier is a JSON string

### Requirement: An unresolvable participant reference does not break a read

Storage enforces no referential integrity, so an assigned person may cease to exist. A read SHALL drop a participant reference that no longer resolves and SHALL still return the event and its remaining participants, rather than failing or returning a placeholder.

#### Scenario: A dangling reference is omitted, not fatal

- **WHEN** an event holds two attendee references and one of them no longer resolves to a contact
- **THEN** the event is returned
- **AND** its attendee collection contains only the resolvable person

### Requirement: An event can be created, updated, and deleted

The API SHALL expose creating a single event, updating an existing event, and deleting an existing event. An update SHALL accept any subset of the event's fields and SHALL leave unspecified fields unchanged. Create and update SHALL return the affected event in the same shape the calendar read returns.

#### Scenario: A created event is returned in read shape

- **WHEN** an event is created
- **THEN** the response status is 201
- **AND** the body is the created event with resolved participants

#### Scenario: An update changes only what it names

- **WHEN** an existing event with a title and participants is updated with a new title only
- **THEN** the returned event carries the new title
- **AND** its participants are unchanged

#### Scenario: A deleted event is gone from the calendar

- **WHEN** an existing event is deleted and the period containing it is then read
- **THEN** the deletion reports success
- **AND** the event is not in the read

#### Scenario: Operating on a non-existent event reports not found

- **WHEN** an update or delete targets an identifier no event carries
- **THEN** the response status is 404 in the shared error envelope

#### Scenario: A malformed identifier is a client error

- **WHEN** an update or delete targets an identifier that is not a well-formed event id
- **THEN** the response status is 400

### Requirement: Participant assignment is a whole-set replacement

Create and update SHALL accept the complete intended set of attendees and the complete intended set of hosts. When a set is supplied, the stored set SHALL become exactly that set. There SHALL be no endpoint that adds or removes a single participant, so no participant change is ever persisted before the event is saved.

#### Scenario: A supplied set replaces the stored set wholesale

- **WHEN** an event assigned attendees A and B is updated with a set naming B and C
- **THEN** the stored attendees are exactly B and C
- **AND** A is no longer assigned

#### Scenario: An empty set clears assignments

- **WHEN** an event with assigned hosts is updated with an empty host set
- **THEN** the event has no assigned hosts

#### Scenario: An omitted set is left alone

- **WHEN** an event with assigned attendees and hosts is updated without naming either set
- **THEN** both stored sets are unchanged

#### Scenario: No single-participant endpoint exists

- **WHEN** a request attempts to add or remove one participant of an existing event
- **THEN** no endpoint serves it

### Requirement: A person is assigned to an event at most once

Duplicate references within a submitted attendee or host set SHALL collapse to a single assignment. A duplicate SHALL NOT be an error, and a duplicate SHALL never be stored.

#### Scenario: A repeated reference produces one assignment

- **WHEN** an event is created with the same attendee named three times
- **THEN** the event is created successfully
- **AND** the person is assigned exactly once

#### Scenario: Duplicates cannot reach storage

- **WHEN** an attendee set containing a repeated reference is written directly to persistence
- **THEN** the stored set contains that person exactly once

### Requirement: Only real, eligible, active people can be assigned

Every submitted attendee SHALL resolve to an existing contact and every submitted host SHALL resolve to an existing employee. A submitted person whose status is not active SHALL be rejected, and a submitted host who is not eligible to host events SHALL be rejected. A rejection SHALL identify which role failed without exposing storage detail, and SHALL leave the event unchanged.

#### Scenario: An unknown reference is rejected

- **WHEN** an event is created naming an attendee identifier that matches no contact
- **THEN** the response status is 400 in the shared error envelope
- **AND** no event is created

#### Scenario: A host must be an employee, not a contact

- **WHEN** an event is created naming a contact's identifier as a host
- **THEN** the response status is 400
- **AND** no event is created

#### Scenario: An ineligible host is rejected

- **WHEN** an event is created naming an employee who is not eligible to host events
- **THEN** the response status is 400
- **AND** no event is created

#### Scenario: An inactive person is rejected

- **WHEN** an event is created naming a contact or employee whose status is not active
- **THEN** the response status is 400

#### Scenario: A failed update leaves the event untouched

- **WHEN** an existing event is updated with a valid new title and an unknown host reference
- **THEN** the response status is 400
- **AND** the stored event retains its original title and participants

#### Scenario: A person already assigned may stay assigned

- **WHEN** an event holds an assigned person who has since become inactive, and the event is read
- **THEN** the event and that person are still returned

### Requirement: Authorship is recorded by the server, never by the client

An event SHALL carry a reference to the user who created it and a reference to the user who last updated it. Until authentication exists, both SHALL be recorded as absent. Neither SHALL ever be accepted from a request, and neither SHALL appear in a response.

#### Scenario: A submitted authorship reference is ignored

- **WHEN** an event is created with a body naming a creating user
- **THEN** the event is created
- **AND** the stored creating-user reference is absent, not the submitted value

#### Scenario: Authorship is not exposed

- **WHEN** any event is returned by any endpoint
- **THEN** the body carries no creating-user or updating-user property
