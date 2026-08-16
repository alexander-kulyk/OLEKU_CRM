# directory-api Specification

## Purpose

Defines the read-only contact and employee directory used by the event attendee and host selectors, including exact routes, payloads, filters, search semantics, ordering, and bounds.

## Requirements

### Requirement: Contacts are read from the contact directory

`GET /api/contacts` SHALL return `{ "contacts": [...] }`. Each contact SHALL carry `id`, `firstName`, `lastName`, `fullName`, `email`, and `status`, and SHALL NOT expose persistence metadata.

#### Scenario: Listing contacts

- **WHEN** a client requests `GET /api/contacts`
- **THEN** the response status is 200
- **AND** the body contains the named `contacts` array
- **AND** every contact has only the declared public fields

### Requirement: Employees are read from the employee directory

`GET /api/employees` SHALL return `{ "employees": [...] }`. Each employee SHALL carry the contact fields plus `position`, `department`, and `canHostEvents`, and SHALL NOT expose persistence metadata.

#### Scenario: Listing employees

- **WHEN** a client requests `GET /api/employees`
- **THEN** the response status is 200
- **AND** the body contains the named `employees` array
- **AND** every employee has only the declared public fields

### Requirement: Status is a closed lifecycle filter

Contact and employee status SHALL be either `active` or `inactive`, defaulting to `active` when absent in storage. Both directory endpoints SHALL accept the optional `status=active|inactive` query parameter and SHALL return active people by default. Any other status value SHALL be rejected with status 400.

#### Scenario: Default read excludes inactive people

- **WHEN** a directory endpoint is requested without `status`
- **THEN** only active people are returned

#### Scenario: Explicit inactive read

- **WHEN** a directory endpoint is requested with `status=inactive`
- **THEN** only inactive people are returned

#### Scenario: Unknown status value

- **WHEN** a directory endpoint is requested with a status other than `active` or `inactive`
- **THEN** the response status is 400 with `VALIDATION_ERROR`

### Requirement: Employee reads support host eligibility

`GET /api/employees` SHALL accept the optional `canHostEvents=true|false` query parameter. The filter SHALL apply only to employees; supplying it to `GET /api/contacts` SHALL be rejected with status 400.

#### Scenario: Eligible hosts only

- **WHEN** employees are requested with `canHostEvents=true`
- **THEN** every returned employee is active unless another status was explicitly requested
- **AND** every returned employee has `canHostEvents` equal to true

#### Scenario: Eligibility filter absent

- **WHEN** employees are requested without `canHostEvents`
- **THEN** both eligible and ineligible employees may be returned

#### Scenario: Eligibility filter on contacts

- **WHEN** contacts are requested with `canHostEvents`
- **THEN** the response status is 400 with `VALIDATION_ERROR`

### Requirement: Name search is literal and bounded

Both directory endpoints SHALL accept the optional `search` query parameter. It SHALL match case-insensitively when its literal text occurs in either name part. Pattern metacharacters SHALL have no special meaning. A search term longer than 100 characters SHALL be rejected with status 400.

#### Scenario: Search matches either name part

- **WHEN** `search` occurs in a person's first or last name using any letter case
- **THEN** that person is included in the response if the other filters also match

#### Scenario: Pattern characters are literal

- **WHEN** `search` contains regular-expression or wildcard metacharacters
- **THEN** only names containing those literal characters match
- **AND** the request does not fail

#### Scenario: Search term is too long

- **WHEN** `search` contains more than 100 characters
- **THEN** the response status is 400 with `VALIDATION_ERROR`

### Requirement: Directory results are deterministic and capped

Both directory endpoints SHALL sort by `lastName`, then `firstName`, then `id`, and SHALL return at most 50 people. The API SHALL expose no caller-controlled result-size parameter.

#### Scenario: Stable ordering

- **WHEN** the same directory request is repeated against unchanged data
- **THEN** the same people are returned in the same order

#### Scenario: More than fifty people match

- **WHEN** more than 50 people match a directory request
- **THEN** exactly the first 50 in the declared ordering are returned

#### Scenario: Caller attempts to set a result size

- **WHEN** a caller supplies an undeclared result-size query parameter
- **THEN** the response status is 400 with `VALIDATION_ERROR`

### Requirement: The directory is read-only

This capability SHALL expose no route that creates, modifies, or deletes a contact or employee.

#### Scenario: Write attempt against a directory route

- **WHEN** a client sends POST, PATCH, PUT, or DELETE to a contact or employee directory path
- **THEN** the response status is 404 with `NOT_FOUND`
- **AND** no person is created, modified, or deleted
