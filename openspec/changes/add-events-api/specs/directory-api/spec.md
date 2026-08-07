## Purpose

Provides the read-only people directory that event participation depends on: the contacts a business serves and the employees who work for it, searchable and filtered down to those actually eligible to take part in an event. It is the minimum surface the attendee and host selectors need, deliberately stopping short of managing those records.

## ADDED Requirements

### Requirement: Contacts and employees are stored separately from authentication

Contact records SHALL be persisted in the `contacts` collection and employee records in the `employees` collection. The `users` collection SHALL NOT be read, written, or modelled by this capability — it is the authentication surface, not a people directory.

#### Scenario: Directory operations leave the authentication collection untouched

- **WHEN** every directory endpoint has been exercised and the seed has run
- **THEN** the `users` collection is unchanged and holds no contact or employee data

### Requirement: A contact carries an identity and a lifecycle status

A contact record SHALL carry a required first name, a required last name, an optional email address, and a status distinguishing an active contact from an inactive one. A contact SHALL be readable by a display name composed of its first and last name.

#### Scenario: A stored contact reads back with a composed display name

- **WHEN** a contact with first name "Anna" and last name "Kovalenko" is read
- **THEN** the response carries both name parts
- **AND** a display name of "Anna Kovalenko"

#### Scenario: A contact without both name parts is rejected

- **WHEN** a contact is written with a missing or blank first or last name
- **THEN** the write is rejected and no record is stored

### Requirement: An employee carries an identity, a role, and host eligibility

An employee record SHALL carry a required first name, a required last name, an optional email address, an optional position, an optional department, a boolean recording whether the employee may host events, and a status distinguishing an active employee from an inactive one. Host eligibility SHALL default to not eligible when unspecified, so an employee becomes a host only by explicit decision.

#### Scenario: An employee reads back with role and eligibility

- **WHEN** an employee with a position and department is read
- **THEN** the response carries the position, the department, the host-eligibility flag, and the status

#### Scenario: Host eligibility is opt-in

- **WHEN** an employee is stored without host eligibility specified
- **THEN** the stored record is not eligible to host

### Requirement: The directory is readable and searchable

The API SHALL expose a read endpoint for contacts and a read endpoint for employees. Each SHALL accept an optional search term matching case-insensitively against either name part, SHALL return results sorted by last name then first name, and SHALL cap the number of records returned so a large directory cannot produce an unbounded response.

#### Scenario: Search matches either name part

- **WHEN** the directory holds "Anna Kovalenko" and "Marco Rossi" and contacts are requested with the search term "ross"
- **THEN** only Marco Rossi is returned

#### Scenario: Search is case-insensitive

- **WHEN** contacts are requested with the search term "KOVAL"
- **THEN** Anna Kovalenko is returned

#### Scenario: Results are ordered by name

- **WHEN** the directory is requested without a search term
- **THEN** records are returned ordered by last name, then by first name

#### Scenario: The result count is bounded

- **WHEN** the directory holds more records than the result cap and no search term is given
- **THEN** the number of returned records does not exceed the cap

### Requirement: A search term is treated as literal text

A search term SHALL be matched as literal text. Characters that carry meaning to the underlying matching engine SHALL NOT be interpreted, and an over-long search term SHALL be rejected rather than executed.

#### Scenario: Pattern metacharacters do not act as patterns

- **WHEN** the directory is requested with a search term containing pattern metacharacters
- **THEN** the response either contains only records whose name literally includes those characters, or is empty
- **AND** the request does not fail with a server error

#### Scenario: An over-long search term is rejected

- **WHEN** the directory is requested with a search term longer than the permitted length
- **THEN** the response status is 400 in the shared error envelope

### Requirement: Only active people are offered by default

Both directory endpoints SHALL return only records whose status is active unless the request explicitly asks for another status. Inactive people SHALL NOT appear in the selectors that back event participation.

#### Scenario: An inactive contact is not offered

- **WHEN** a contact whose status is inactive exists and contacts are requested without a status filter
- **THEN** that contact is not in the response

#### Scenario: An inactive person can be requested deliberately

- **WHEN** the directory is requested with an explicit status filter naming the inactive status
- **THEN** records with that status are returned

### Requirement: Host candidates can be narrowed to eligible employees

The employee endpoint SHALL accept a filter restricting results to employees eligible to host events, so the host selector can offer only valid candidates.

#### Scenario: Ineligible employees are excluded when the filter is applied

- **WHEN** one employee is eligible to host and another is not, and employees are requested with the host-eligibility filter applied
- **THEN** only the eligible employee is returned

#### Scenario: All employees are returned when the filter is absent

- **WHEN** employees are requested without the host-eligibility filter
- **THEN** both eligible and ineligible active employees are returned

### Requirement: The directory is read-only

This capability SHALL expose no endpoint that creates, updates, or deletes a contact or an employee. Populating the directory SHALL be possible without an API write path, so the participation features can be exercised before record management exists.

#### Scenario: No write path is exposed

- **WHEN** a create, update, or delete request targets a contact or employee endpoint
- **THEN** the request is not served by a directory write handler

#### Scenario: The directory can be populated repeatedly without duplication

- **WHEN** the directory is populated with a fixed set of people and the same population runs a second time
- **THEN** the number of records is unchanged
- **AND** no person appears twice
