# api-foundation Specification

## Purpose

Defines the request and response contract shared by every server endpoint, including validation, stable error handling, success payloads, and preservation of the health route.

## Requirements

### Requirement: Every failure uses the exact shared envelope

Every failing API response SHALL have the JSON shape `{ "error": { "code": <string>, "message": <string> } }` with no other top-level member. `code` SHALL be stable and machine-readable; `message` SHALL be safe for an end user.

#### Scenario: Validation failure envelope

- **WHEN** a request fails boundary validation
- **THEN** the response status is 400
- **AND** the body is exactly the shared error envelope
- **AND** `error.code` is `VALIDATION_ERROR`

#### Scenario: Missing resource envelope

- **WHEN** an operation targets a resource that does not exist
- **THEN** the response status is 404
- **AND** `error.code` is `NOT_FOUND`

#### Scenario: Invalid participant envelope

- **WHEN** an event write contains a participant assignment that violates the event contract
- **THEN** the response status is 400
- **AND** `error.code` is `INVALID_PARTICIPANT`

#### Scenario: Unexpected failure envelope

- **WHEN** an unexpected internal failure occurs
- **THEN** the response status is 500
- **AND** `error.code` is `INTERNAL_ERROR`

### Requirement: Error responses expose no internal detail

An error response SHALL NOT contain a stack trace, raw exception text, database or driver text, a connection string, a file path, or the caller's requested URL. This SHALL hold in every environment. The underlying error SHALL be logged server-side.

#### Scenario: Failure outside production

- **WHEN** an unexpected failure occurs while the server is not in production
- **THEN** the caller receives the generic shared envelope
- **AND** the response contains neither a stack trace nor the underlying error message

#### Scenario: Unknown route does not reflect input

- **WHEN** a request targets a path no route handles
- **THEN** the response status is 404 with the shared envelope
- **AND** the response body does not contain the requested path or query string

### Requirement: Input is validated before persistence access

The API SHALL validate every accepted path parameter, query parameter, and request body before reading or writing persistence. Invalid input SHALL receive status 400 and SHALL NOT cause a persistence read or state change.

#### Scenario: Malformed request body

- **WHEN** a create or update body violates its endpoint contract
- **THEN** the response status is 400 with `VALIDATION_ERROR`
- **AND** no record is created, modified, or deleted

#### Scenario: Malformed resource identifier

- **WHEN** a request supplies an identifier that is not a well-formed resource id
- **THEN** the response status is 400 with `VALIDATION_ERROR`
- **AND** no persistence lookup is performed

### Requirement: Success responses use endpoint payloads directly

A successful collection read SHALL return an object with one named array: `{ "events": [...] }`, `{ "contacts": [...] }`, or `{ "employees": [...] }`. A successful create or update SHALL return the event object directly. A successful delete SHALL return status 204 with no body. No successful response SHALL contain an `error`, `success`, or `timestamp` member added by a shared wrapper.

#### Scenario: Successful collection read

- **WHEN** a collection endpoint succeeds
- **THEN** its body contains exactly the endpoint's named collection
- **AND** no shared success wrapper is present

#### Scenario: Successful event write

- **WHEN** event creation or update succeeds
- **THEN** the body is the affected event directly
- **AND** the body contains no `error` member

#### Scenario: Successful deletion

- **WHEN** deletion succeeds
- **THEN** the response status is 204
- **AND** the response has no body

### Requirement: Defined routes precede terminal handlers

Feature routes SHALL be handled before the not-found and error handlers. `GET /api/health` SHALL retain its existing behavior.

#### Scenario: Feature route remains reachable

- **WHEN** a request targets a defined events or directory route
- **THEN** that route handles the request
- **AND** the not-found handler is not reached

#### Scenario: Health endpoint is unchanged

- **WHEN** a client requests `GET /api/health`
- **THEN** the response status is 200
- **AND** the body is `{ "status": "ok" }`
