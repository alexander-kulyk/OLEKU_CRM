## MODIFIED Requirements

### Requirement: Every failure uses the exact shared envelope

Every failing API response SHALL have the JSON shape `{ "error": { "code": <string>, "message": <string> } }`, optionally carrying a third member `field` inside `error`, and no other top-level member. `code` SHALL be stable and machine-readable; `message` SHALL be safe for an end user. `field` SHALL be present only when the failure is attributable to a single named request field, and SHALL name that field so a client can attach the message to it. Each `code` SHALL map to exactly one HTTP status, and the map SHALL be extensible without changing the envelope shape.

#### Scenario: Validation failure envelope

- **WHEN** a request fails boundary validation
- **THEN** the response status is 400
- **AND** the body is exactly the shared error envelope
- **AND** `error.code` is `VALIDATION_ERROR`

#### Scenario: Field-attributable failure envelope

- **WHEN** a failure is attributable to one named request field
- **THEN** `error.field` names that field
- **AND** `error.code` and `error.message` are present as usual
- **AND** the body carries no member outside `error`

#### Scenario: Failure with no single responsible field

- **WHEN** a failure is not attributable to one named request field
- **THEN** the body is exactly `{ "error": { "code": ..., "message": ... } }`
- **AND** no `field` member is present

#### Scenario: Missing resource envelope

- **WHEN** an operation targets a resource that does not exist
- **THEN** the response status is 404
- **AND** `error.code` is `NOT_FOUND`

#### Scenario: Invalid participant envelope

- **WHEN** an event write contains a participant assignment that violates the event contract
- **THEN** the response status is 400
- **AND** `error.code` is `INVALID_PARTICIPANT`

#### Scenario: Request-shape failure codes

- **WHEN** an update request carries a member the endpoint does not accept
- **THEN** the response status is 400 and `error.code` is `UNKNOWN_FIELD`
- **AND** **WHEN** an update request carries no field to change
- **THEN** the response status is 400 and `error.code` is `NO_CHANGES_SUBMITTED`

#### Scenario: Business and concurrency conflict codes

- **WHEN** a write conflicts with the stored state rather than with its own syntax
- **THEN** the response status is 409
- **AND** `error.code` is one of `EMAIL_ALREADY_EXISTS`, `EMAIL_TAKEN_BY_ARCHIVED_USER`, `USER_VERSION_CONFLICT`, `USER_ARCHIVED`, or `EVENT_VERSION_CONFLICT`

#### Scenario: Event version conflict has no field attribution

- **WHEN** an event PATCH supplies a stale version
- **THEN** the response status is 409 and `error.code` is `EVENT_VERSION_CONFLICT`
- **AND** no `field` member is present

#### Scenario: Unexpected failure envelope

- **WHEN** an unexpected internal failure occurs
- **THEN** the response status is 500
- **AND** `error.code` is `INTERNAL_ERROR`

#### Scenario: Datastore constraint violation is never surfaced as 500

- **WHEN** a write loses a race against a datastore uniqueness constraint
- **THEN** the response carries the business conflict code for that constraint at status 409
- **AND** the response is not `INTERNAL_ERROR`
