## MODIFIED Requirements

### Requirement: Returned events use the domain payload

Every returned event SHALL carry exactly `id`, `title`, `startAt`, `endAt`, `attendees`, `hosts`, and `version`. `id` SHALL be a string. `version` SHALL be a positive integer representing the persisted event revision. Each instant SHALL include a time component and explicit zone designator. Each participant SHALL be a resolved `{ id, firstName, lastName, fullName }` object rather than a bare identifier.

#### Scenario: Event response shape

- **WHEN** an event is returned by any event endpoint
- **THEN** it has the declared domain fields and no audit fields
- **AND** its `version` is a positive integer
- **AND** its participants are resolved person summaries
- **AND** its instants cannot be interpreted as date-only values

### Requirement: PATCH updates only supplied fields

`PATCH /api/events/:id` SHALL require `version` plus any non-empty subset of `title`, `startAt`, `endAt`, `attendeeIds`, and `hostIds`. `version` is a write precondition and SHALL NOT itself be treated as an editable event value. Omitted editable fields SHALL retain their stored values. A supplied participant array SHALL replace that role's entire set; an empty array SHALL clear it. A successful update SHALL return status 200 and the updated event directly.

#### Scenario: Title-only update

- **WHEN** PATCH supplies the current `version` and only `title` as an editable field
- **THEN** the title changes
- **AND** the stored instants and participant assignments remain unchanged

#### Scenario: Participant set replacement

- **WHEN** PATCH supplies the current `version` and `attendeeIds` containing B and C for an event currently assigned A and B
- **THEN** the stored attendee set becomes exactly B and C

#### Scenario: Empty participant array

- **WHEN** PATCH supplies the current `version` and an empty `hostIds` array
- **THEN** every host assignment is removed

#### Scenario: Empty update body

- **WHEN** PATCH supplies no editable field in addition to `version`
- **THEN** the response status is 400 with the request-shape error defined by the shared API contract

#### Scenario: Missing version

- **WHEN** PATCH supplies an editable field without `version`
- **THEN** the response status is 400 with `VALIDATION_ERROR`
- **AND** the stored event is unchanged

#### Scenario: Unknown event on update

- **WHEN** PATCH targets a well-formed identifier matching no event
- **THEN** the response status is 404 with `NOT_FOUND`

## ADDED Requirements

### Requirement: Event updates use optimistic concurrency

Every event PATCH SHALL compare the supplied `version` with the stored revision as part of the same atomic write that applies the update. A successful PATCH SHALL increment `version` exactly once. A stale PATCH SHALL return status 409 with `EVENT_VERSION_CONFLICT` and SHALL NOT modify the stored event.

#### Scenario: Current version updates atomically

- **WHEN** PATCH supplies the stored event's current `version` and valid editable fields
- **THEN** the update succeeds with status 200
- **AND** the returned and stored `version` is exactly one greater than the supplied version

#### Scenario: Stale version is rejected

- **WHEN** PATCH supplies a `version` lower than the stored event's current version
- **THEN** the response status is 409 with `EVENT_VERSION_CONFLICT`
- **AND** no supplied field is applied
- **AND** the stored version is unchanged

#### Scenario: Competing updates cannot both use one version

- **WHEN** two valid PATCH requests target the same event with the same current `version`
- **THEN** at most one request succeeds
- **AND** every losing request receives `EVENT_VERSION_CONFLICT`
