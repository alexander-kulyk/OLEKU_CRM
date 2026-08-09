## Purpose

Defines the request-handling contract every server endpoint shares: how invalid requests are rejected, what an error response looks like, and what a caller never sees in one. It exists so that error behavior is a single decided contract rather than something each feature re-invents.

## ADDED Requirements

### Requirement: Single error envelope

Every failing API response SHALL carry a machine-readable code and a human-readable message in one consistent envelope shape, so that a client can branch on the code and display the message without parsing prose.

#### Scenario: Failure response shape

- **WHEN** any API request fails for any reason
- **THEN** the response body contains a single error object with a stable string code and a message
- **AND** the HTTP status reflects the failure class

#### Scenario: Success responses carry no error envelope

- **WHEN** an API request succeeds
- **THEN** the response body contains only the requested resource or collection
- **AND** no error object is present

### Requirement: Error responses expose no internal detail

Error responses SHALL NOT expose implementation internals. Stack traces, database driver text, raw exception messages, and the caller's own request URL MUST NOT appear in any response body, in any environment.

#### Scenario: Unexpected server failure

- **WHEN** an unexpected failure occurs while handling a request
- **THEN** the response status is 500
- **AND** the body carries a generic message that does not include a stack trace, an exception message, or database driver text

#### Scenario: Unknown route

- **WHEN** a request targets a path no route handles
- **THEN** the response status is 404
- **AND** the body carries the standard error envelope
- **AND** the body does not reflect the requested URL back to the caller

### Requirement: Requests are validated before any persistence

The system SHALL validate request path parameters, query parameters, and bodies before performing any read or write against stored data. A request that fails validation MUST be rejected with status 400 and MUST NOT cause any state change.

#### Scenario: Malformed body rejected

- **WHEN** a write request carries a body that violates the endpoint's declared shape
- **THEN** the response status is 400
- **AND** the error identifies that the request was invalid
- **AND** no record is created, modified, or deleted

#### Scenario: Unparseable identifier rejected

- **WHEN** a request supplies a resource identifier that is not a well-formed identifier
- **THEN** the response status is 400
- **AND** no lookup result is disclosed

### Requirement: API routes resolve ahead of terminal handlers

Defined API routes SHALL be reachable, taking precedence over the not-found handler, and the existing health endpoint MUST keep its current behavior.

#### Scenario: Defined route is not swallowed

- **WHEN** a request targets a defined API route
- **THEN** the route's own handler produces the response
- **AND** the not-found response is not returned

#### Scenario: Health endpoint preserved

- **WHEN** a client requests the health endpoint
- **THEN** it responds successfully as it does today
