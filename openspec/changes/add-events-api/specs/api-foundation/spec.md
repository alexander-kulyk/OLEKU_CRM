## Purpose

Defines the contract every HTTP endpoint in the CRM API honours: how request input is validated at the boundary, what a failure response looks like, and what a client is guaranteed never to receive. It exists so that a client can render a failure without parsing prose, and so no internal detail can leak through an error path.

## ADDED Requirements

### Requirement: Request input is validated at the boundary

Every request body, query string, and path parameter accepted by an API endpoint SHALL be validated against a declared schema before any database access occurs. A request that fails validation SHALL receive HTTP 400 and SHALL NOT reach persistence.

#### Scenario: Malformed input is rejected before persistence

- **WHEN** a request carries a query parameter, path parameter, or body that fails the endpoint's declared schema
- **THEN** the response status is 400
- **AND** the response body is the shared error envelope
- **AND** no read or write is performed against the database

#### Scenario: Unknown body properties are not persisted

- **WHEN** a create or update request body carries a property the endpoint does not declare
- **THEN** that property is not written to storage
- **AND** it is not reflected in the response

### Requirement: Failures use a single error envelope

Every failure response from the API SHALL have the body shape `{ error: { code, message } }`, where `code` is a stable machine-readable identifier and `message` is a human-readable sentence. Clients SHALL be able to key user-facing copy off `code` without inspecting `message`.

#### Scenario: A validation failure carries a stable code

- **WHEN** a request fails boundary validation
- **THEN** the body is exactly `{ error: { code, message } }`
- **AND** `code` is the same value for every validation failure, regardless of which field failed

#### Scenario: A missing resource carries a distinct code

- **WHEN** an operation targets a resource that does not exist
- **THEN** the response status is 404
- **AND** `code` differs from the validation-failure code

#### Scenario: An unexpected failure still uses the envelope

- **WHEN** an unhandled error occurs inside a request handler
- **THEN** the response status is 500
- **AND** the body is the same `{ error: { code, message } }` shape as any other failure

### Requirement: Error responses expose no internal detail

An error response SHALL NOT contain a stack trace, a database driver or ORM message, a connection string or any fragment of one, a file path, or an internal identifier. This SHALL hold in every environment, not only in production.

#### Scenario: No stack trace reaches the client

- **WHEN** an unhandled error occurs while the server runs outside production
- **THEN** the response body contains no `stack` property and no stack-trace text

#### Scenario: No storage-layer text reaches the client

- **WHEN** the database rejects an operation and the error propagates to the error handler
- **THEN** the response `message` is a sentence written for a user
- **AND** it contains no driver text, no schema path, and no connection-string fragment

### Requirement: Storage-layer rejections map to client errors

When a request reaches persistence with a value the storage layer rejects — a malformed identifier, or a value violating a declared schema constraint — the API SHALL respond with HTTP 400 rather than HTTP 500, because the fault is in the request.

#### Scenario: A malformed identifier is a client error

- **WHEN** a request supplies an identifier that is not a well-formed resource id
- **THEN** the response status is 400 and not 500

### Requirement: Successful responses carry the resource directly

A successful response SHALL carry the requested or affected resource, or a named collection of them, without a wrapping success flag, status string, or timestamp. Collection responses SHALL be an object with a single named array property rather than a bare top-level array.

#### Scenario: A collection response is a named array

- **WHEN** a list endpoint succeeds
- **THEN** the body is an object holding one array property named for the resource
- **AND** it carries no `success` or `status` property

#### Scenario: A delete confirms without a body payload

- **WHEN** a delete succeeds
- **THEN** the response status indicates success with no content
- **AND** no error envelope is present

### Requirement: The existing health endpoint and unknown-route behavior are preserved

Adding endpoints SHALL NOT change the behavior of `GET /api/health`. A request to a route the API does not define SHALL receive HTTP 404 in the shared error envelope.

#### Scenario: Health continues to answer

- **WHEN** `GET /api/health` is called
- **THEN** the response status is 200 with the body `{ "status": "ok" }`

#### Scenario: An unknown route answers in the envelope

- **WHEN** a request targets a path the API does not define
- **THEN** the response status is 404
- **AND** the body is `{ error: { code, message } }`
- **AND** the message does not echo the requested path back verbatim
