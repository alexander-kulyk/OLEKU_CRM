## Purpose

Defines the server contract for managing registered CRM users: listing them with server-side pagination, search, filtering and deterministic ordering; reading one; updating one partially under optimistic concurrency; and archiving one as a reversible soft delete. Archived records remain stored so historical references stay valid.

## ADDED Requirements

### Requirement: The user list excludes archived records and is paginated server-side

`GET /api/users` SHALL return only non-archived users. The response SHALL be an object with an `items` array and a `pagination` object carrying `page`, `pageSize`, `total`, and `totalPages`. `total` SHALL be the count of records matching the active search and filters, not the size of the returned page. `pageSize` SHALL default to 20 and SHALL accept only 20, 50, or 100. Pagination, filtering, search, and sorting SHALL all be performed by the server; no endpoint SHALL require the client to hold the full record set.

#### Scenario: Default page

- **WHEN** `GET /api/users` is requested with no query parameters
- **THEN** the response status is 200
- **AND** `pagination.page` is 1 and `pagination.pageSize` is 20
- **AND** `items` contains at most 20 users
- **AND** no archived user appears in `items`

#### Scenario: Total reflects the filtered set

- **WHEN** a list request matches 153 non-archived users and returns page 1 at page size 20
- **THEN** `pagination.total` is 153
- **AND** `pagination.totalPages` is 8
- **AND** `items` contains 20 users

#### Scenario: Archived user is absent from the list

- **WHEN** a user's `archivedAt` is set
- **AND** a subsequent list request would otherwise match that user
- **THEN** the user does not appear in `items`
- **AND** the user is not counted in `pagination.total`

#### Scenario: Rejected page size

- **WHEN** a list request supplies `pageSize=37` or `pageSize=5000`
- **THEN** the response status is 400 with `error.code` of `VALIDATION_ERROR`
- **AND** no records are returned

#### Scenario: Rejected page number

- **WHEN** a list request supplies `page=0` or `page=-1`
- **THEN** the response status is 400
- **AND** no records are returned

#### Scenario: Page beyond the last page

- **WHEN** a list request supplies a syntactically valid `page` greater than `totalPages`
- **THEN** the response status is 200
- **AND** `items` is empty
- **AND** `pagination` reports the requested `page` together with the true `total` and `totalPages`

### Requirement: List ordering is deterministic and stable across pages

The list SHALL support ordering by first name, last name, status, or last login, in ascending or descending direction. The default ordering SHALL be last name ascending, then first name ascending. Every ordering SHALL end with the user identifier ascending as its final tiebreaker, so that paginating a set containing equal sort keys neither repeats nor skips a record. An unrecognized sort field or direction SHALL be rejected. Name ordering SHALL be Unicode-correct, SHALL order Cyrillic names correctly, and SHALL produce the same sequence for every caller.

#### Scenario: Default ordering

- **WHEN** a list request supplies no sort parameter
- **THEN** users are ordered by last name ascending, then first name ascending, then identifier ascending

#### Scenario: Identifier breaks ties

- **WHEN** several users share the same last name and first name
- **AND** the result set is read page by page
- **THEN** the relative order of those users is the ascending order of their identifiers
- **AND** no user appears on two pages and no user is omitted from all pages

#### Scenario: Status ascending order

- **WHEN** a list request sorts by status ascending
- **THEN** users appear in the order `active`, then `inactive`, then `blocked`

#### Scenario: Status descending order

- **WHEN** a list request sorts by status descending
- **THEN** users appear in the order `blocked`, then `inactive`, then `active`

#### Scenario: Last login nulls sort last ascending

- **WHEN** a list request sorts by last login ascending
- **AND** some users have never logged in
- **THEN** users with a last login value appear first, ordered oldest to newest
- **AND** users who have never logged in appear after all of them

#### Scenario: Last login nulls sort last descending

- **WHEN** a list request sorts by last login descending
- **THEN** users with a last login value appear first, ordered newest to oldest
- **AND** users who have never logged in appear after all of them

#### Scenario: Cyrillic name ordering

- **WHEN** a list request sorts by last name ascending over a set of Cyrillic surnames
- **THEN** the surnames are ordered by their alphabet, not by raw code point
- **AND** repeating the identical request returns the identical sequence

#### Scenario: Unknown sort field

- **WHEN** a list request supplies a sort field that is not first name, last name, status, or last login
- **THEN** the response status is 400
- **AND** no records are returned

### Requirement: Search matches names, full name, email, and phone

The list SHALL accept a search term matching against first name, last name, the full name formed by first and last name together, email, and phone. Matching SHALL be case-insensitive for Latin and non-Latin alphabets alike, including Cyrillic. A search term containing a space SHALL match a user whose first and last name together form that phrase, in either order. Phone matching SHALL normalize both the stored number and the search term so that the same number written with different spacing, brackets, hyphens, or an international prefix matches. The search term SHALL be treated as a literal string, never as a pattern, and its length SHALL be bounded.

#### Scenario: Full name phrase

- **WHEN** a user has first name `Anna` and last name `Smith`
- **AND** the search term is `anna smith`
- **THEN** that user appears in `items`

#### Scenario: Reversed full name phrase

- **WHEN** a user has first name `Anna` and last name `Smith`
- **AND** the search term is `smith anna`
- **THEN** that user appears in `items`

#### Scenario: Case-insensitive Cyrillic search

- **WHEN** a user has first name `Марія`
- **AND** the search term is `марія`
- **THEN** that user appears in `items`

#### Scenario: Email search

- **WHEN** a user's email is `Anna.Smith@Example.com`
- **AND** the search term is `anna.smith@example`
- **THEN** that user appears in `items`

#### Scenario: Phone search ignoring formatting

- **WHEN** a user's stored phone is `+380501234567`
- **AND** the search term is `+38 (050) 123-45-67` or `050 123 45 67` or `0501234567`
- **THEN** that user appears in `items`

#### Scenario: Search term is literal

- **WHEN** the search term contains regular-expression metacharacters such as `.*` or `(a+)+`
- **THEN** the term is matched literally
- **AND** the request completes without pattern-driven degradation

#### Scenario: Search combines with pagination and filters

- **WHEN** a search term and a status filter are supplied together
- **THEN** `items` contains only users matching both
- **AND** `pagination.total` counts only users matching both

### Requirement: The list filters by operational status

The list SHALL accept a status filter carrying one or more of `active`, `inactive`, and `blocked`, and SHALL return only users whose status is among them. With no status filter, all three operational statuses SHALL be included. Archived records SHALL remain excluded regardless of the status filter. A status value outside the three operational values — including `archived` — SHALL be rejected.

#### Scenario: Single status filter

- **WHEN** a list request filters by `status=active`
- **THEN** every returned user has status `active`

#### Scenario: Multiple status filter

- **WHEN** a list request filters by `status=active,blocked`
- **THEN** every returned user has status `active` or `blocked`
- **AND** no user with status `inactive` is returned

#### Scenario: No status filter

- **WHEN** a list request supplies no status filter
- **THEN** users of all three operational statuses may be returned
- **AND** no archived user is returned

#### Scenario: Unknown status value

- **WHEN** a list request filters by `status=deleted` or `status=archived`
- **THEN** the response status is 400
- **AND** no records are returned

### Requirement: Responses expose only whitelisted fields

Every users response SHALL contain only explicitly permitted fields. No response SHALL contain a password hash, an access token, a refresh token, a password-reset token, any authentication secret, any security metadata, any persistence metadata, or the normalized email. A list item SHALL carry identifier, first name, last name, email, phone, address, status, and last login, and SHALL NOT carry the version. A detail response SHALL carry those fields plus phone extension, archived-at, created-at, updated-at, and version.

#### Scenario: List item field set

- **WHEN** a list request succeeds
- **THEN** each item contains exactly identifier, first name, last name, email, phone, address, status, and last login
- **AND** no item contains a version member

#### Scenario: Detail field set

- **WHEN** a detail request succeeds
- **THEN** the body contains identifier, first name, last name, email, phone, phone extension, address, status, last login, archived-at, created-at, updated-at, and version

#### Scenario: No sensitive field leaks

- **WHEN** any users endpoint returns a successful response
- **THEN** the body contains no normalized email, credential, token, authentication secret, or persistence metadata
- **AND** this holds for list items and detail responses alike

#### Scenario: Date values on the wire

- **WHEN** a response carries last login, archived-at, created-at, or updated-at
- **THEN** the value is an ISO 8601 string in UTC
- **AND** a user who has never logged in has a last login of null

### Requirement: The detail endpoint returns archived users

`GET /api/users/:userId` SHALL return a user whether or not it is archived, so that a caller can distinguish an archived record from a missing one. An archived record SHALL carry a non-null archived-at value. A well-formed identifier that matches no record SHALL yield 404, and a malformed identifier SHALL be rejected before any persistence lookup.

#### Scenario: Archived user detail

- **WHEN** a detail request targets a user whose `archivedAt` is set
- **THEN** the response status is 200
- **AND** the body's archived-at member carries that timestamp

#### Scenario: Unknown user detail

- **WHEN** a detail request supplies a well-formed identifier matching no record
- **THEN** the response status is 404 with `error.code` of `NOT_FOUND`

#### Scenario: Malformed identifier

- **WHEN** a request supplies an identifier that is not a well-formed user identifier
- **THEN** the response status is 400
- **AND** no persistence lookup is performed

### Requirement: Update accepts a merge patch on an explicit field set

`PATCH /api/users/:userId` SHALL accept a request body with content type `application/json` or `application/merge-patch+json` and SHALL apply it with JSON Merge Patch semantics: an omitted member leaves its field unchanged, a member with a value replaces the field, and a member set to null on a nullable field removes the value. The mutable members SHALL be exactly first name, last name, email, phone, phone extension, address, and status. Any other member SHALL be rejected rather than ignored, and the request SHALL carry at least one mutable member in addition to the version.

#### Scenario: Merge-patch content type is accepted

- **WHEN** a valid update is sent with `Content-Type: application/merge-patch+json`
- **THEN** the body is parsed and applied
- **AND** the outcome is identical to sending the same body as `application/json`

#### Scenario: Omitted member is unchanged

- **WHEN** an update supplies only a first name and a version
- **THEN** the first name changes
- **AND** last name, email, phone, phone extension, address, and status are unchanged

#### Scenario: Null removes a nullable value

- **WHEN** an update supplies a phone of null and a version
- **THEN** the stored phone becomes null
- **AND** subsequent reads report a null phone

#### Scenario: Empty string on a required field is rejected

- **WHEN** an update supplies an empty string for first name
- **THEN** the response status is 400 with `error.code` of `VALIDATION_ERROR`
- **AND** the error identifies the offending field
- **AND** no field is modified

#### Scenario: Version-only patch is rejected

- **WHEN** an update body contains only a version
- **THEN** the response status is 400 with `error.code` of `NO_CHANGES_SUBMITTED`
- **AND** no field is modified

#### Scenario: Unknown member is rejected

- **WHEN** an update body contains a member that is not a mutable field or the version, such as created-at or identifier
- **THEN** the response status is 400 with `error.code` of `UNKNOWN_FIELD`
- **AND** the unsupported value is not persisted
- **AND** no other member of the request is applied

### Requirement: Address updates merge property by property

An address member in an update SHALL merge into the stored address rather than replace it: a supplied property is updated, an omitted property is left unchanged, a property set to null is removed, an empty address object changes nothing, and an address of null removes the whole address. The address properties SHALL be exactly country, city, street, and postal code, each trimmed, Unicode-capable, and non-blank when present.

#### Scenario: Partial address update

- **WHEN** a stored address has country, city, street, and postal code
- **AND** an update supplies an address containing only a city
- **THEN** only the city changes
- **AND** country, street, and postal code retain their previous values

#### Scenario: Clearing one address property

- **WHEN** an update supplies an address whose postal code is null
- **THEN** the postal code is removed
- **AND** the remaining address properties are preserved

#### Scenario: Removing the whole address

- **WHEN** an update supplies an address of null
- **THEN** the stored address becomes null

#### Scenario: Empty address object is a no-op

- **WHEN** an update supplies an empty address object together with another mutable field
- **THEN** the address is unchanged
- **AND** the other field is applied

#### Scenario: Blank address property is rejected

- **WHEN** an update supplies an address property consisting only of whitespace
- **THEN** the response status is 400
- **AND** the address is unchanged

### Requirement: Updates validate and normalize field values before persisting

First name and last name SHALL be required, trimmed, non-blank, at most 100 characters, Unicode-capable including apostrophes and hyphens, free of control characters, and stored in Unicode NFC form. Email SHALL be required, trimmed, at most 254 characters, and a valid email address. Phone SHALL be optional and, when present, SHALL parse against the configured default region, SHALL support international numbers, and SHALL be stored in E.164 form. A phone extension SHALL be stored separately and SHALL NOT be merged into the phone value. Status SHALL be one of the lowercase values `active`, `inactive`, or `blocked`. A validation failure SHALL identify the offending field and SHALL leave the record unmodified.

#### Scenario: Names are trimmed before persistence

- **WHEN** an update supplies a first name of `"Anna "`
- **THEN** the persisted first name is `Anna`
- **AND** a subsequent read returns `Anna`

#### Scenario: Unicode names are accepted

- **WHEN** an update supplies a name such as `O'Connor`, `Марія-Анна`, `Jean-Luc`, or `Łukasz`
- **THEN** the update succeeds
- **AND** the persisted value preserves the characters in NFC form

#### Scenario: Over-long name is rejected

- **WHEN** an update supplies a first name longer than 100 characters
- **THEN** the response status is 400
- **AND** the error identifies the first name field

#### Scenario: Phone is normalized to E.164

- **WHEN** an update supplies a phone written with spaces, brackets, or hyphens that parses against the configured default region
- **THEN** the persisted phone is its E.164 form
- **AND** the phone extension, if any, is stored separately and does not appear inside the phone value

#### Scenario: Unparseable phone is rejected

- **WHEN** an update supplies a phone that does not parse against the configured default region
- **THEN** the response status is 400
- **AND** the error identifies the phone field
- **AND** no field is modified

#### Scenario: Invalid status is rejected

- **WHEN** an update supplies a status outside `active`, `inactive`, and `blocked`
- **THEN** the response status is 400
- **AND** the status is unchanged

### Requirement: Email is globally unique across archived records

Email uniqueness SHALL be enforced by the datastore over normalized email. Normalization SHALL trim leading and trailing whitespace and convert to lowercase, and SHALL NOT remove dots, strip a plus-suffix, or apply provider-specific alias rules. An archived user SHALL continue to reserve its email. An update that would take an email held by another non-archived user SHALL fail as a conflict distinct from one that would take an email held by an archived user.

#### Scenario: Duplicate email held by an active user

- **WHEN** an update sets an email already held by another non-archived user
- **THEN** the response status is 409 with `error.code` of `EMAIL_ALREADY_EXISTS`
- **AND** `error.field` is `email`
- **AND** neither user record is modified

#### Scenario: Duplicate email held by an archived user

- **WHEN** an update sets an email already held by an archived user
- **THEN** the response status is 409 with `error.code` of `EMAIL_TAKEN_BY_ARCHIVED_USER`
- **AND** `error.field` is `email`
- **AND** neither user record is modified

#### Scenario: Case and whitespace differences collide

- **WHEN** an existing user holds `anna@example.com`
- **AND** an update sets ` ANNA@example.com `
- **THEN** the request is treated as a duplicate and returns 409

#### Scenario: Dots and plus-suffix are distinct addresses

- **WHEN** an existing user holds `anna.smith@example.com`
- **AND** an update sets `annasmith@example.com` or `anna.smith+crm@example.com`
- **THEN** the addresses are treated as distinct and no uniqueness conflict is raised

#### Scenario: Concurrent updates to the same email

- **WHEN** two concurrent updates both set the same previously unused email
- **THEN** exactly one succeeds
- **AND** the other returns 409 with `EMAIL_ALREADY_EXISTS`, never 500

### Requirement: Updates are guarded by an explicit version

Every update SHALL carry the version the caller last read, and SHALL be applied only if the stored version still matches. A successful update SHALL increment the version by one. A mismatched version SHALL fail as a conflict and SHALL NOT overwrite the newer stored data. The version SHALL be readable from the detail endpoint and SHALL NOT appear in list items.

#### Scenario: Update succeeds and increments the version

- **WHEN** an update carries the current version 7
- **THEN** the response reports success
- **AND** a subsequent detail read reports version 8

#### Scenario: Stale version is rejected

- **WHEN** two callers both read version 7
- **AND** the first update succeeds
- **AND** the second submits version 7
- **THEN** the second returns 409 with `error.code` of `USER_VERSION_CONFLICT`
- **AND** the first caller's persisted values are unchanged

#### Scenario: Missing version is rejected

- **WHEN** an update body omits the version
- **THEN** the response status is 400
- **AND** no field is modified

### Requirement: Archived users cannot be updated

An update targeting a record whose archived-at is set SHALL fail as a conflict and SHALL leave the record unmodified, regardless of whether the supplied version matches. This SHALL hold when the record was archived after the caller read it.

#### Scenario: Update of an already archived user

- **WHEN** an update targets a user whose `archivedAt` is set
- **THEN** the response status is 409 with `error.code` of `USER_ARCHIVED`
- **AND** no field of the archived record is modified

#### Scenario: Archive wins a concurrent edit

- **WHEN** a caller reads a user at version 7
- **AND** another caller archives that user
- **AND** the first caller then submits an update carrying version 7
- **THEN** the response status is 409 with `error.code` of `USER_ARCHIVED`
- **AND** the archived record is unmodified

### Requirement: Archive is a soft delete that is idempotent

`DELETE /api/users/:userId` SHALL archive a user by setting archived-at to the current UTC timestamp, SHALL leave the operational status unchanged, and SHALL NOT physically remove the record or break references held by other entities. It SHALL return 204 with no body. It SHALL NOT require a version: archiving deliberately takes precedence over an unsaved concurrent edit. Repeating the request on an already archived user SHALL return 204 without changing the stored archived-at and without producing duplicate side effects. A well-formed identifier matching no record SHALL yield 404.

#### Scenario: Successful archive

- **WHEN** a caller archives a non-archived user
- **THEN** the response status is 204 with no body
- **AND** the record's archived-at is set
- **AND** the record's status is the same value it had before
- **AND** the record is still readable through the detail endpoint

#### Scenario: Archived user leaves the list

- **WHEN** a user is archived
- **AND** the list is requested again with the same search, filters, and sort
- **THEN** that user is absent from `items`
- **AND** `pagination.total` has decreased by one

#### Scenario: Repeat archive is idempotent

- **WHEN** a user is already archived
- **AND** the archive request is repeated
- **THEN** the response status is 204
- **AND** the stored archived-at retains its original value

#### Scenario: Archive requires no version

- **WHEN** an archive request is sent with no version in the request
- **THEN** the request succeeds

#### Scenario: Archive of an unknown user

- **WHEN** an archive request supplies a well-formed identifier matching no record
- **THEN** the response status is 404

#### Scenario: References survive archival

- **WHEN** a user is archived
- **AND** another entity references that user
- **THEN** the reference still resolves to the stored record
