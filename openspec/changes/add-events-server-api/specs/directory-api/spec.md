## Purpose

Defines read access to the people who can take part in an event — contacts as attendees and employees as hosts — so the event form's selectors have a searchable, bounded source of candidates. It covers reading only; creating and managing people belongs to a later capability.

## ADDED Requirements

### Requirement: Contact directory read

The system SHALL expose a read that returns contacts for the attendee selector. Each returned person MUST carry a stable identifier, both name parts, and an email address.

#### Scenario: Listing contacts

- **WHEN** a client requests the contact list without filters
- **THEN** the response contains contacts with identifier, first name, last name, email, and status
- **AND** the response status is 200

### Requirement: Employee directory read

The system SHALL expose a read that returns employees for the host selector, carrying the same person fields as contacts plus position, department, and whether the employee may host events.

#### Scenario: Listing employees

- **WHEN** a client requests the employee list without filters
- **THEN** the response contains employees with identifier, first name, last name, email, position, department, host eligibility, and status

### Requirement: Host eligibility filtering

The employee read SHALL support restricting results to employees eligible to host events, so the host selector can offer only assignable people.

#### Scenario: Requesting eligible hosts only

- **WHEN** a client requests employees restricted to those eligible to host
- **THEN** every returned employee is marked as able to host events
- **AND** employees not marked as able to host are absent

#### Scenario: Eligibility filter absent

- **WHEN** a client requests employees without the eligibility restriction
- **THEN** employees are returned regardless of host eligibility
- **AND** each carries its host eligibility so the caller can distinguish them

### Requirement: Active people only by default

Directory reads SHALL return only people with active status unless the caller explicitly asks for other statuses, so selectors do not offer people who are no longer assignable.

#### Scenario: Inactive person excluded by default

- **WHEN** a client requests a directory list without specifying a status
- **AND** a stored person has a status other than active
- **THEN** that person is absent from the response

#### Scenario: Explicitly requesting inactive people

- **WHEN** a client requests a directory list explicitly including non-active people
- **THEN** people of the requested statuses are returned
- **AND** each carries its status

### Requirement: Name search treated as literal text

Directory reads SHALL support a search term matched case-insensitively against either name part. The term MUST be treated as literal text rather than as a pattern, and its length MUST be bounded, so that a caller cannot alter match semantics or force pathological matching.

#### Scenario: Matching either name part

- **WHEN** a client searches with a term that appears in a person's first name or last name in any letter case
- **THEN** that person is returned

#### Scenario: Pattern characters are literal

- **WHEN** a search term contains regular-expression or wildcard characters
- **THEN** results match only people whose name contains those characters literally
- **AND** the request does not fail

#### Scenario: Over-long search term rejected

- **WHEN** a search term exceeds the permitted length
- **THEN** the response status is 400
- **AND** no unbounded scan is performed

### Requirement: Bounded and deterministic results

Directory reads SHALL return a bounded number of records with a stable ordering, so a selector never receives an unbounded list and repeated identical requests return results in the same order.

#### Scenario: Result count is capped

- **WHEN** more people match a directory read than the permitted maximum
- **THEN** at most the permitted maximum is returned

#### Scenario: Caller-requested size is bounded

- **WHEN** a client requests more records than the permitted maximum
- **THEN** the response contains at most the permitted maximum
- **AND** the request does not fail

#### Scenario: Ordering is stable

- **WHEN** the same directory read is issued twice against unchanged data
- **THEN** both responses list people in the same order

### Requirement: Directory reads are read-only

This capability SHALL expose no operation that creates, modifies, or deletes a contact or an employee.

#### Scenario: Write attempt against the directory

- **WHEN** a client attempts a write operation against a directory path
- **THEN** no person record is created, modified, or deleted
