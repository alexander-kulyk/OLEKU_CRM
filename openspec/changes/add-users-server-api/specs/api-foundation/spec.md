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
- **AND** `error.code` is one of `EMAIL_ALREADY_EXISTS`, `EMAIL_TAKEN_BY_ARCHIVED_USER`, `USER_VERSION_CONFLICT`, or `USER_ARCHIVED`

#### Scenario: Unexpected failure envelope

- **WHEN** an unexpected internal failure occurs
- **THEN** the response status is 500
- **AND** `error.code` is `INTERNAL_ERROR`

#### Scenario: Datastore constraint violation is never surfaced as 500

- **WHEN** a write loses a race against a datastore uniqueness constraint
- **THEN** the response carries the business conflict code for that constraint at status 409
- **AND** the response is not `INTERNAL_ERROR`

### Requirement: Input is validated before persistence access

The API SHALL validate every accepted path parameter, query parameter, and request body before reading or writing persistence. Invalid input SHALL receive status 400 and SHALL NOT cause a persistence read or state change. A body carrying a member the endpoint does not accept SHALL be rejected rather than silently stripped, and SHALL be distinguishable by its `code` from a body whose accepted members hold invalid values.

#### Scenario: Malformed request body

- **WHEN** a create or update body violates its endpoint contract
- **THEN** the response status is 400 with `VALIDATION_ERROR`
- **AND** no record is created, modified, or deleted

#### Scenario: Unaccepted body member

- **WHEN** a request body carries a member the endpoint does not accept
- **THEN** the response status is 400 with `UNKNOWN_FIELD`
- **AND** the unaccepted value is not persisted
- **AND** no accepted member of the same request is applied

#### Scenario: Malformed resource identifier

- **WHEN** a request supplies an identifier that is not a well-formed resource id
- **THEN** the response status is 400 with `VALIDATION_ERROR`
- **AND** no persistence lookup is performed

### Requirement: Success responses use endpoint payloads directly

A successful non-paginated collection read SHALL return an object with one named array: `{ "events": [...] }`, `{ "contacts": [...] }`, or `{ "employees": [...] }`. A successful paginated collection read SHALL return an object with exactly two members, `items` and `pagination`, where `pagination` carries `page`, `pageSize`, `total`, and `totalPages`; `total` SHALL count every record matching the request's filters rather than the returned page. A successful create or update SHALL return the affected object directly. A successful delete SHALL return status 204 with no body. No successful response SHALL contain an `error`, `success`, or `timestamp` member added by a shared wrapper.

#### Scenario: Successful collection read

- **WHEN** a non-paginated collection endpoint succeeds
- **THEN** its body contains exactly the endpoint's named collection
- **AND** no shared success wrapper is present

#### Scenario: Successful paginated collection read

- **WHEN** a paginated collection endpoint succeeds
- **THEN** its body contains exactly `items` and `pagination`
- **AND** `pagination` carries `page`, `pageSize`, `total`, and `totalPages`
- **AND** no shared success wrapper is present

#### Scenario: Successful event write

- **WHEN** event creation or update succeeds
- **THEN** the body is the affected event directly
- **AND** the body contains no `error` member

#### Scenario: Successful deletion

- **WHEN** deletion succeeds
- **THEN** the response status is 204
- **AND** the response has no body

## ADDED Requirements

### Requirement: Request bodies are accepted by declared content type

The API SHALL parse a request body whose content type the endpoint declares, and SHALL treat an endpoint that documents a media type as obliged to parse it. An endpoint applying merge-patch semantics SHALL accept both `application/json` and `application/merge-patch+json` and SHALL behave identically for the same body under either. A body sent with a content type the endpoint does not accept SHALL be rejected with an explicit failure rather than silently reaching the handler as an absent body.

#### Scenario: Declared merge-patch media type is parsed

- **WHEN** a merge-patch endpoint receives a valid body with `Content-Type: application/merge-patch+json`
- **THEN** the body is parsed and applied
- **AND** the outcome matches sending the same body as `application/json`

#### Scenario: Unaccepted content type is rejected explicitly

- **WHEN** a request body is sent with a content type the endpoint does not accept
- **THEN** the response is a shared error envelope identifying the request as unacceptable
- **AND** the handler does not observe the request as one carrying no body
