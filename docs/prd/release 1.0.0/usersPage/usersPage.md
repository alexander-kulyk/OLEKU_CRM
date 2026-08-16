# Users Page — Business Requirements

**Document ID:** BR-USERS
**Version:** 4.0
**Status:** Draft
**Date:** 2026-08-16
**Owner:** TBD
**Domain:** User Management

## Change Summary — v4.0

This version consolidates and clarifies:

- user personal information;
- phone and address support;
- status-based row styling;
- server-side pagination, search, filtering, and sorting;
- email uniqueness rules;
- archived-user behavior;
- soft deletion;
- concurrency protection;
- error contracts;
- partial update semantics;
- accessibility;
- audit requirements;
- privacy and permanent-erasure integration;
- API validation;
- responsive behavior.

---

# 1. Normative Language

The keywords **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** are used as normative requirement levels.

- **MUST / MUST NOT** — mandatory requirement.
- **SHOULD / SHOULD NOT** — recommended behavior that may be changed only for a documented reason.
- **MAY** — optional behavior.

---

# 2. Purpose

The **Users** page is used to view and manage registered CRM users.

A user record represents a person registered as a CRM user.

The page allows an operator to:

- view users;
- search users;
- filter users;
- sort users;
- navigate paginated results;
- edit personal information;
- change user status;
- archive users;
- view basic user activity information.

The **Users** page is separate from the **Clients** page.

Authentication, authorization, roles, permissions, login behavior, password management, and access-control configuration are defined separately.

---

# 3. Terminology

## Operator

The person currently using the CRM interface.

## User Record

The CRM user being displayed or modified.

## Active User Record

A non-archived user record.

It may have one of the operational statuses:

- `active`
- `inactive`
- `blocked`

## Archived User

A user record removed from normal operational use while remaining stored for historical integrity.

---

# 4. Logical User Model

## REQ-USR-001 — User Schema

Each user MUST have a unique immutable identifier.

Logical model:

```ts
User {
  id: string;

  firstName: string;
  lastName: string;

  email: string;
  emailNormalized: string;

  phone: string | null;
  phoneExtension: string | null;

  address: {
    country?: string | null;
    city?: string | null;
    street?: string | null;
    postalCode?: string | null;
  } | null;

  status: "active" | "inactive" | "blocked";

  lastLoginAt: Date | null;

  archivedAt: Date | null;

  createdAt: Date;
  updatedAt: Date;

  version: number;
}
```

---

# 5. Required Fields

## REQ-USR-002

The following fields MUST exist:

- `id`
- `firstName`
- `lastName`
- `email`
- `emailNormalized`
- `status`
- `createdAt`
- `updatedAt`
- `version`

The following MAY be null:

- `phone`
- `phoneExtension`
- `address`
- `lastLoginAt`
- `archivedAt`

---

# 6. User ID

## REQ-USR-003

The user ID MUST:

- uniquely identify the record;
- be immutable;
- never be editable through the UI;
- be used for API operations;
- be used by other CRM entities when referencing the user.

---

# 8. Email Uniqueness

## REQ-USR-005

Email uniqueness MUST be enforced globally across user records.

Conceptually:

```text
emailNormalized
```

must be unique.

MongoDB implementation SHOULD therefore enforce a unique index on the normalized email.

Example:

```text
anna@example.com ✅
ANNA@example.com ❌
```

---

# 9. Archived Users and Email Uniqueness

## REQ-USR-006

Archiving a user MUST NOT release their email address.

An archived user continues to reserve:

```text
emailNormalized
```

If an operation attempts to use an email belonging to an archived record, the backend MUST return:

```http
409 Conflict
```

with:

```json
{
  "error": {
    "code": "EMAIL_TAKEN_BY_ARCHIVED_USER",
    "message": "This email belongs to an archived user record.",
    "field": "email"
  }
}
```

The system SHOULD restore the existing record in the future rather than create another user representing the same account.

User restoration is outside the current scope.

---

# 10. Email Normalization

## REQ-USR-007

Email MUST be normalized before uniqueness comparison.

Example:

```text
email:
Anna.Smith@Example.com

emailNormalized:
anna.smith@example.com
```

Normalization MUST:

- trim leading whitespace;
- trim trailing whitespace;
- convert to lowercase.

Normalization MUST NOT:

- remove dots;
- remove `+suffix`;
- apply Gmail-specific alias logic.

---

# 11. User Status

## REQ-USR-008

Supported canonical API values are:

```text
active
inactive
blocked
```

API values MUST use lowercase.

UI labels MAY be localized.

`archived` MUST NOT be treated as an operational status.

Archival is represented by:

```ts
archivedAt: Date | null;
```

---

# 12. Archive Model

## REQ-USR-009

The standard Users page MUST NOT permanently delete users.

The standard removal operation is **Archive**.

Archiving sets:

```text
archivedAt = current UTC timestamp
```

The existing operational status MUST remain unchanged.

Example:

```json
{
  "status": "inactive",
  "archivedAt": "2026-08-16T12:00:00Z"
}
```

This allows restoration without guessing the previous status.

---

# 13. Historical References

## REQ-USR-010

Archived user records MUST remain available to preserve historical references.

Examples include:

- Event hosts;
- Tasks;
- Audit records;
- historical activity;
- other business history.

Archiving MUST NOT break references to previously created CRM entities.

---

# 14. Permanent Erasure

## REQ-USR-011

Archive MUST NOT be treated as permanent personal-data erasure.

Permanent deletion or anonymization required by privacy regulations MUST be handled by a separate administrative privacy process.

That process MUST be capable of removing or anonymizing personally identifiable information while preserving the minimum identifiers required for referential integrity where legally permitted.

The privacy process MUST also cover personal information stored in:

- audit records;
- historical snapshots;
- logs where applicable.

Retention policies are defined separately.

---

# 15. Users Table

## REQ-USR-012

The Users page MUST display users in a table.

Each row represents one non-archived user.

Columns:

| Column     | Description                  |
| ---------- | ---------------------------- |
| First Name | User first name              |
| Last Name  | User last name               |
| Email      | User email                   |
| Phone      | User phone                   |
| Address    | Formatted address            |
| Status     | Operational status           |
| Last Login | Most recent successful login |
| Actions    | Available actions            |

---

# 16. Actions Column

## REQ-USR-013

The initial Actions column contains one row-level action:

**Edit**

The action is represented by a pencil icon.

The button MUST have an accessible label.

Example:

```text
Edit Anna Smith
```

---

# 17. Status-Based Row Styling

## REQ-USR-014

Users with:

```text
status = inactive
```

or:

```text
status = blocked
```

MUST use a muted gray row appearance.

Active users MUST use standard table styling.

```text
active   → standard row
inactive → muted row
blocked  → muted row
```

Color MUST NOT be the only indicator.

The Status column MUST explicitly display:

- Active
- Inactive
- Blocked

Blocked users SHOULD additionally use a visually distinct status badge or icon so that `blocked` can be distinguished from `inactive` while scanning the table.

Text contrast MUST satisfy applicable accessibility contrast requirements.

---

# 18. Address Display

## REQ-USR-015

Address MUST be formatted as a human-readable string.

Default component order:

```text
street, city, postalCode, country
```

Missing components MUST be omitted.

Example full address:

```text
Shevchenka St. 15, Kyiv, 01001, Ukraine
```

Example partial address:

```text
Kyiv, Ukraine
```

Separators MUST NOT appear for missing values.

If no address exists:

```text
—
```

must be displayed.

Long addresses MAY be visually truncated in the table, but the complete value MUST remain accessible through an accessible tooltip or equivalent interaction.

---

# 19. Missing Phone

## REQ-USR-016

If no phone number exists, the Phone column MUST display:

```text
—
```

---

# 20. Responsive Table

## REQ-USR-017

The Users table MUST remain usable on supported viewport sizes.

At narrow widths:

- content MUST NOT overlap;
- important information MUST remain accessible;
- horizontal scrolling MAY be used;
- truncation MUST NOT permanently hide information;
- Actions MUST remain accessible.

A future alternative card representation MAY be introduced separately.

---

# 21. Default User List

## REQ-USR-018

Archived users MUST be excluded from the standard Users list.

The initial Users page does not expose archived records.

Archived-user browsing and restoration are reserved for future functionality.

---

# 22. Loading Users

## REQ-USR-019

The frontend MUST retrieve users through:

```http
GET /api/users
```

The endpoint MUST support:

- pagination;
- search;
- filtering;
- sorting.

Example:

```http
GET /api/users?page=1&pageSize=20&search=anna&status=active&sort=lastName:asc
```

---

# 23. Pagination

## REQ-USR-020

Pagination MUST be server-side.

Default:

```text
pageSize = 20
```

Supported page sizes:

```text
20
50
100
```

Maximum:

```text
100
```

Response:

```json
{
  "items": [],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 153,
    "totalPages": 8
  }
}
```

---

# 24. Pagination Query Validation

## REQ-USR-021

The backend MUST reject invalid pagination parameters.

Invalid examples:

```text
page = 0
page = -1
pageSize = 37
pageSize = 5000
```

Response:

```http
400 Bad Request
```

If `page` is syntactically valid but greater than `totalPages`, the endpoint MAY return:

```json
{
  "items": [],
  "pagination": {
    "page": 99,
    "pageSize": 20,
    "total": 153,
    "totalPages": 8
  }
}
```

The frontend MUST then navigate to the highest valid page.

---

# 25. Default Sorting

## REQ-USR-022

The default ordering MUST be deterministic:

```text
lastName ASC
firstName ASC
id ASC
```

`id` MUST act as the final tiebreaker.

---

# 26. Supported Sorting

## REQ-USR-023

Sorting MUST support:

- First Name;
- Last Name;
- Status;
- Last Login.

Unknown sort fields MUST return:

```http
400 Bad Request
```

---

# 27. Status Sorting

## REQ-USR-024

Ascending status order MUST be:

```text
active
inactive
blocked
```

Descending order MUST reverse this sequence.

---

# 28. Last Login Sorting

## REQ-USR-025

When sorting by Last Login:

```text
lastLoginAt = null
```

MUST appear after users who have logged in.

Semantic behavior:

```text
NULLS LAST
```

---

# 29. Name Collation

## REQ-USR-026

Name sorting MUST:

- support Unicode;
- correctly handle Cyrillic names;
- use a stable server-side collation;
- produce the same deterministic ordering for all operators.

The exact MongoDB collation configuration is defined in technical database design.

---

# 30. Search

## REQ-USR-027

Search MUST support:

- First Name;
- Last Name;
- Full Name;
- Email;
- Phone.

Search MUST be case-insensitive where applicable.

Example:

```text
anna smith
```

MUST match:

```text
firstName = Anna
lastName = Smith
```

---

# 31. Search Debounce

## REQ-USR-028

Search requests MUST use approximately:

```text
300 ms
```

debounce.

The minimum active search length MUST be:

```text
2 characters
```

If exactly one search character exists:

- a search request MUST NOT be sent;
- the current unfiltered list MUST remain available;
- the UI SHOULD indicate that at least two characters are required.

Clearing search MUST reload the unfiltered result set.

---

# 32. Search Request Races

## REQ-USR-029

Search MUST implement **latest-request-wins** behavior.

A slower response for an older query MUST NOT overwrite the results of a newer query.

Previous in-flight requests SHOULD be cancelled when technically possible.

Example:

```text
request 1 → "an"
request 2 → "anna"
```

If request 2 finishes first, request 1 MUST NOT replace its results later.

---

# 33. Phone Storage and Normalization

## REQ-USR-030

Phone numbers SHOULD be stored in normalized international form.

Preferred normalized format:

```text
E.164
```

Example:

```text
+380501234567
```

Phone parsing MUST support:

- international prefixes;
- spaces;
- brackets;
- hyphens in user input.

The system MUST normalize valid input before persistence.

A standards-based phone parser such as libphonenumber SHOULD be used in technical implementation.

---

# 34. Phone Region

## REQ-USR-031

If a phone number is entered without a country code, parsing MUST use the deployment's configured default region.

The system MUST NOT infer a region arbitrarily from the browser.

---

# 35. Phone Extension

## REQ-USR-032

Phone extensions MAY be stored separately:

```ts
phoneExtension: string | null;
```

Example:

```text
phone = +12025550123
extension = 456
```

Extensions MUST NOT be mixed into the normalized E.164 phone field.

---

# 36. Phone Search

## REQ-USR-033

Phone search MUST normalize both:

- stored phone value;
- search input.

Search MUST ignore common formatting characters.

For example:

```text
050 123 45 67
+38 (050) 123-45-67
0501234567
```

should match the same underlying number where configured-region normalization makes them equivalent.

---

# 37. Filtering

## REQ-USR-034

The Users page MUST support filtering by status.

Multiple status values MAY be provided.

Example:

```http
GET /api/users?status=active,blocked
```

Without an explicit status filter:

- all operational statuses are included;
- archived records remain excluded.

Unknown status values MUST return:

```http
400 Bad Request
```

---

# 38. URL State

## REQ-USR-035

The following state MUST be represented in the URL:

- page;
- search;
- status filters;
- sorting.

Example:

```text
/users?page=2&search=anna&status=active&sort=lastName:asc
```

This MUST support:

- refresh;
- browser Back;
- browser Forward;
- sharing the URL.

Search updates SHOULD replace the current history entry to avoid producing a history entry for every typed query.

Explicit pagination, filter, and sorting changes SHOULD create normal navigation history entries.

---

# 39. Invalid URL State

## REQ-USR-036

The frontend MUST validate URL query parameters before using them.

If a URL contains invalid values:

```text
page=-1
status=deleted
sort=unknown
```

the invalid parameter MUST be replaced with its supported default.

The corrected URL SHOULD replace the invalid URL in browser history.

The page MUST NOT crash because of malformed query parameters.

---

# 40. Empty Users State

## REQ-USR-037

If no user records are available to this page, the UI MUST display a true empty state.

Example:

> No users have been added yet.

User creation functionality is outside the current scope.

---

# 41. No Search Results State

## REQ-USR-038

If users exist but the current search or filters return zero results, the UI MUST display a separate no-results state.

Example:

> No users match the current search or filters.

The UI MUST provide:

**Clear filters**

when filters are active.

---

# 42. User List DTO

## REQ-USR-039

The list endpoint MUST use an explicit response whitelist.

```ts
UserListItemDto {
  id: string;

  firstName: string;
  lastName: string;

  email: string;
  phone: string | null;

  address: {
    country?: string | null;
    city?: string | null;
    street?: string | null;
    postalCode?: string | null;
  } | null;

  status: "active" | "inactive" | "blocked";

  lastLoginAt: string | null;
}
```

The list DTO MUST NOT expose `version`.

The current version MUST be retrieved from the detail endpoint before editing.

---

# 43. Date Wire Format

## REQ-USR-040

All API date/time values MUST use:

```text
ISO 8601
UTC
```

Example:

```text
2026-08-16T12:35:42Z
```

JavaScript `Date` objects are not an API wire format.

---

# 44. Last Login Display

## REQ-USR-041

`lastLoginAt` MUST be stored and transmitted in UTC.

The UI MUST display Last Login in UTC.

If the user has never logged in:

```text
Never
```

MUST be displayed.

The initial version SHOULD use an absolute localized date/time rather than only relative values such as `2 hours ago`.

---

# 45. Sensitive Data Whitelist

## REQ-USR-042

Users API endpoints MUST only return explicitly allowed DTO fields.

They MUST NOT expose:

- password hashes;
- access tokens;
- refresh tokens;
- password-reset tokens;
- authentication secrets;
- security metadata;
- `emailNormalized`.

---

# 46. Loading State

## REQ-USR-043

While data is loading:

- the page MUST display a loading state;
- incomplete data MUST NOT be represented as successfully loaded;
- loading feedback MUST be accessible to assistive technology.

---

# 47. Error State

## REQ-USR-044

If loading fails:

- the error MUST be shown;
- Retry MUST be available;
- current URL/search/filter/page state MUST be preserved.

---

# 48. Edit Action

## REQ-USR-045

Selecting the Edit action MUST:

1. identify the selected user ID;
2. request the latest user record;
3. open the Edit User dialog with the latest values.

---

# 49. User Details Endpoint

## REQ-USR-046

The latest record MUST be retrieved through:

```http
GET /api/users/:userId
```

before editing.

---

# 50. Archived User Details

## REQ-USR-047

The details endpoint MUST return an archived user when the ID exists.

Example:

```http
GET /api/users/:userId
→ 200 OK
```

with:

```json
{
  "archivedAt": "2026-08-16T12:00:00Z"
}
```

The standard Users list still excludes archived records.

If the Edit dialog requests a user that has already been archived, the UI MUST:

- not allow editing;
- close or avoid opening the Edit dialog;
- refresh the list;
- inform the operator that the user was archived.

A truly unknown user returns:

```http
404 Not Found
```

---

# 51. User Details DTO

## REQ-USR-048

```ts
UserDto {
  id: string;

  firstName: string;
  lastName: string;

  email: string;
  phone: string | null;
  phoneExtension: string | null;

  address: {
    country?: string | null;
    city?: string | null;
    street?: string | null;
    postalCode?: string | null;
  } | null;

  status: "active" | "inactive" | "blocked";

  lastLoginAt: string | null;

  archivedAt: string | null;

  createdAt: string;
  updatedAt: string;

  version: number;
}
```

---

# 52. Edit User Dialog

## REQ-USR-049

Editable fields:

- First Name;
- Last Name;
- Email;
- Phone;
- Phone Extension;
- Country;
- City;
- Street;
- Postal Code;
- Status.

Read-only information:

- User ID;
- Last Login;
- Created At.

Actions:

- Save;
- Archive;
- Close.

---

# 53. Name Validation

## REQ-USR-050

First Name and Last Name MUST:

- be required;
- be trimmed;
- not consist only of whitespace;
- contain no more than 100 characters;
- support Unicode;
- allow valid apostrophes and hyphens;
- reject control characters.

Valid examples:

```text
O'Connor
Марія-Анна
Jean-Luc
Łukasz
```

Values MUST use Unicode NFC normalization before persistence.

---

# 54. Email Validation

## REQ-USR-051

Email MUST:

- be required;
- be trimmed;
- have a valid email format;
- contain no more than 254 characters.

Email uniqueness MUST be enforced by the backend/database.

The frontend MUST NOT assume synchronous uniqueness validation.

---

# 55. Phone Validation

## REQ-USR-052

Phone is optional.

If present, the number MUST:

- parse successfully according to the configured region;
- support international numbers;
- be normalized before persistence.

Invalid phone numbers MUST produce a field-level error.

---

# 56. Address Validation

## REQ-USR-053

Address is optional.

Supported properties:

```ts
country;
city;
street;
postalCode;
```

Values MUST:

- be trimmed;
- support Unicode;
- not contain only whitespace.

---

# 57. Save Behavior

## REQ-USR-054

Save MUST remain available when the form is idle.

When Save is selected:

1. client-side validation runs;
2. invalid fields show inline errors;
3. no PATCH request is sent if local validation fails.

Save MUST be disabled only while an active Save request is running.

Duplicate Save requests MUST be prevented.

---

# 58. Update Endpoint

## REQ-USR-055

Updates MUST use:

```http
PATCH /api/users/:userId
```

The update MUST follow JSON Merge Patch semantics equivalent to RFC 7396.

The endpoint SHOULD use:

```text
Content-Type: application/merge-patch+json
```

---

# 59. PATCH Semantics

## REQ-USR-056

For mutable fields:

| Input                    | Meaning                                           |
| ------------------------ | ------------------------------------------------- |
| field omitted            | do not modify                                     |
| valid value              | replace/update value                              |
| `null` on nullable field | remove value                                      |
| empty string             | validation error where empty value is not allowed |

Example:

```json
{
  "phone": null,
  "version": 7
}
```

removes the phone.

---

# 60. Address Merge Semantics

## REQ-USR-057

Example:

```json
{
  "address": {
    "city": "Lviv"
  },
  "version": 7
}
```

updates only `city`.

Existing:

- country;
- street;
- postalCode

remain unchanged.

To clear only postal code:

```json
{
  "address": {
    "postalCode": null
  },
  "version": 7
}
```

To remove the full address:

```json
{
  "address": null,
  "version": 7
}
```

An empty object:

```json
{
  "address": {},
  "version": 7
}
```

is a no-op.

---

# 61. Empty PATCH

## REQ-USR-058

A PATCH request MUST contain at least one mutable field in addition to `version`.

This is invalid:

```json
{
  "version": 7
}
```

Response:

```http
400 Bad Request
```

with:

```text
NO_CHANGES_SUBMITTED
```

---

# 62. Unknown PATCH Fields

## REQ-USR-059

Unsupported fields MUST be rejected.

They MUST NOT be silently stripped.

Example:

```json
{
  "createdAt": "...",
  "version": 7
}
```

must return:

```http
400 Bad Request
```

with:

```text
UNKNOWN_FIELD
```

---

# 63. Optimistic Concurrency

## REQ-USR-060

Updates MUST protect against lost updates.

Each editable user has:

```text
version
```

Example:

```json
{
  "version": 7
}
```

A PATCH submitted with version `7` succeeds only if the persisted version is still `7`.

On success:

```text
version = 8
```

If the record was changed meanwhile:

```http
409 Conflict
```

with:

```text
USER_VERSION_CONFLICT
```

The newer data MUST NOT be overwritten.

---

# 64. Updating an Archived User

## REQ-USR-061

PATCH MUST NOT modify archived user records.

If the record becomes archived before Save:

```http
409 Conflict
```

with:

```text
USER_ARCHIVED
```

The UI MUST:

- keep unsaved values until the error is handled;
- inform the operator;
- close the Edit dialog after acknowledgement;
- refetch the Users list.

---

# 65. Duplicate Email

## REQ-USR-062

If another active user has the email:

```http
409 Conflict
```

```json
{
  "error": {
    "code": "EMAIL_ALREADY_EXISTS",
    "message": "A user with this email already exists.",
    "field": "email"
  }
}
```

The dialog MUST remain open.

The email error MUST be displayed inline.

---

# 66. Successful Update

## REQ-USR-063

After successful PATCH:

1. the Edit dialog closes;
2. the Users query is invalidated;
3. the current list is refetched.

The list SHOULD use server data as the source of truth rather than manually mutating a potentially stale paginated row.

---

# 67. Filtered Record After Update

## REQ-USR-064

If the modified user no longer satisfies the active filters after update, the row MUST disappear after refetch.

Example:

```text
filter = active

active → inactive

result:
row removed from current result
```

---

# 68. Pagination Repair After Any Mutation

## REQ-USR-065

After any refetch caused by:

- update;
- status change;
- archive;
- other future mutations;

if the current page no longer exists and:

```text
page > 1
```

the UI MUST navigate to the highest valid page.

This rule is not limited to Archive.

---

# 69. Archive Action

## REQ-USR-066

The Edit User dialog MUST provide an **Archive** action.

Selecting Archive MUST open confirmation.

Example:

> Are you sure you want to archive this user? The user will be removed from the Users list, but historical information will be preserved.

Actions:

- Archive;
- Cancel.

The confirmation MUST NOT claim that archival is irreversible.

---

# 70. Self-Archive Protection

## REQ-USR-067

An operator MUST NOT archive their own user record.

The Archive action SHOULD be disabled for the current operator with an explanation.

The backend MUST independently enforce the rule.

Attempt:

```http
DELETE /api/users/:currentOperatorId
```

returns:

```http
409 Conflict
```

with:

```text
CANNOT_ARCHIVE_SELF
```

---

# 71. Administrative Access Protection

## REQ-USR-068

The Archive endpoint MUST integrate with the system access-control policy and MUST reject an archive operation if it would leave the system without an account capable of administration.

The exact role/permission definition is maintained in the separate Access Control requirements.

Failure:

```http
409 Conflict
```

with:

```text
CANNOT_ARCHIVE_LAST_ADMINISTRATIVE_USER
```

The Users module MUST enforce the result of that policy even though role definitions are outside this document.

---

# 72. Archive Endpoint

## REQ-USR-069

Archive uses:

```http
DELETE /api/users/:userId
```

Internally:

```text
archivedAt = current UTC timestamp
```

The record MUST NOT be physically deleted.

Successful response:

```http
204 No Content
```

---

# 73. Archive Idempotency

## REQ-USR-070

Archive MUST be idempotent.

If the user is already archived:

```http
DELETE /api/users/:userId
```

returns:

```http
204 No Content
```

and MUST NOT generate duplicate side effects.

---

# 74. Archive and Version

## REQ-USR-071

Archive does **not** require the user `version`.

This is a deliberate design decision.

Archive takes precedence over an unsaved concurrent edit.

A subsequent PATCH against the archived record MUST fail with:

```text
USER_ARCHIVED
```

---

# 75. Error Contract

## REQ-USR-072

All Users API errors MUST use a consistent machine-readable structure.

Example field error:

```json
{
  "error": {
    "code": "EMAIL_ALREADY_EXISTS",
    "message": "A user with this email already exists.",
    "field": "email"
  }
}
```

Example global error:

```json
{
  "error": {
    "code": "USER_VERSION_CONFLICT",
    "message": "The user was modified by another operator."
  }
}
```

---

# 76. HTTP Error Semantics

## REQ-USR-073

| Status | Meaning                                     |
| ------ | ------------------------------------------- |
| `400`  | Invalid input/query/request                 |
| `401`  | Authentication required/expired             |
| `403`  | Authenticated but operation not permitted   |
| `404`  | User does not exist                         |
| `409`  | Business/concurrency conflict               |
| `429`  | Rate limit exceeded                         |
| `5xx`  | Unexpected server failure                   |

---

# 77. Expired Session During Editing

## REQ-USR-074

If a Users request returns:

```http
401 Unauthorized
```

while the Edit dialog contains unsaved changes:

- the Users module MUST NOT intentionally reset the form;
- the dialog MUST NOT be silently closed;
- the request MUST be delegated to the centralized authentication recovery flow.

If the application can recover authentication without page reload, the unsaved form MUST remain available.

The detailed re-authentication flow is defined separately.

---

# 78. Forbidden Operation

## REQ-USR-075

A:

```http
403 Forbidden
```

MUST be shown as an operation-level authorization error.

The frontend MUST NOT represent it as a validation error.

Existing unsaved form data MUST remain intact.

---

# 79. Dirty Form Detection

## REQ-USR-076

Dirty comparison MUST use normalized values.

Example:

```text
"Anna"
```

and:

```text
"Anna "
```

are equivalent after normalization.

Dirty comparison applies to:

- names;
- email;
- phone;
- address fields.

---

# 80. Closing the Edit Dialog

## REQ-USR-077

The dialog MUST support:

- close icon;
- click outside;
- Escape.

Escape is mandatory.

If no unsaved changes exist:

```text
close immediately
```

If unsaved changes exist:

```text
open discard confirmation
```

---

# 81. Discard Confirmation

## REQ-USR-078

Actions:

- Continue editing;
- Discard changes.

Continue editing:

- closes only confirmation;
- preserves the form.

Discard changes:

- closes confirmation;
- closes Edit dialog;
- discards local changes.

---

# 82. Dialog Stack

## REQ-USR-079

Only the topmost dialog MUST respond to Escape.

Example:

```text
Archive Confirmation
        ↑
Edit User Dialog
```

Escape closes Archive Confirmation only.

Focus MUST remain correctly managed.

---

# 83. Accessibility

## REQ-USR-080

The Users page MUST support keyboard and screen-reader usage.

Requirements include:

- semantic table markup;
- accessible table headers;
- keyboard-operable sorting;
- sorting state exposed to assistive technologies;
- accessible labels for icon-only actions;
- focus trap in dialogs;
- focus restored to the triggering element;
- invalid state exposed for invalid inputs;
- validation messages programmatically associated with fields;
- loading/error feedback exposed through an appropriate live/status mechanism.

Color MUST NOT be the only mechanism used to communicate status.

---

# 84. Audit Trail

## REQ-USR-081

Changes performed through the Users module MUST be auditable.

Events include:

- first name changed;
- last name changed;
- email changed;
- phone changed;
- address changed;
- status changed;
- user archived.

Audit metadata SHOULD identify:

- target user ID;
- operation;
- timestamp;
- operator ID;
- changed fields.

Whether raw previous/new PII values are retained MUST be governed by the separate Privacy and Audit Retention policy.

The Users module MUST NOT independently create indefinite copies of personal information in audit storage.

---

# 85. API Summary

Required:

```http
GET    /api/users
GET    /api/users/:userId
PATCH  /api/users/:userId
DELETE /api/users/:userId
```

Possible future endpoints:

```http
POST /api/users
POST /api/users/:userId/restore
```

Creating and restoring users are outside the current scope.

---

# 86. Performance

## REQ-USR-082

List and detail endpoints SHOULD target:

```text
< 500 ms server response time
```

under normal expected load, excluding material external network latency.

The final production SLA will be defined after expected scale is known.

---

# 87. Dataset Handling

## REQ-USR-083

The application MUST NOT assume that all users can be loaded into the browser.

The following MUST be server-side:

- pagination;
- filtering;
- search;
- sorting.

---

# 88. Rate Limiting

## REQ-USR-084

Users endpoints MUST support application-level or platform-level rate limiting.

Rate-limited requests MUST return:

```http
429 Too Many Requests
```

Exact thresholds are defined separately.

---

# 89. Acceptance Criteria

## AC-USR-002 — Load Users

**Given** non-archived users exist
**When** the operator opens the Users page
**Then** the current paginated result is displayed.

---

## AC-USR-003 — User Table Fields

**Given** a user exists
**When** the table is displayed
**Then** the row displays:

- First Name;
- Last Name;
- Email;
- Phone;
- Address;
- Status;
- Last Login;
- Actions.

---

## AC-USR-004 — Inactive Styling

**Given** a user has status `inactive`
**When** the table is displayed
**Then** the row uses muted styling
**And** the Status cell displays `Inactive`.

---

## AC-USR-005 — Blocked Styling

**Given** a user has status `blocked`
**When** the table is displayed
**Then** the row uses muted styling
**And** a visually distinct Blocked status indicator is present
**And** the Status cell identifies the user as `Blocked`.

---

## AC-USR-006 — Missing Values

**Given** phone and address are null
**When** the row is displayed
**Then** both fields display `—`.

---

## AC-USR-007 — Search Full Name

**Given** Anna Smith exists
**When** the operator searches for `anna smith`
**Then** Anna Smith appears in the results.

---

## AC-USR-008 — Phone Search

**Given** a stored phone is `+380501234567`
**When** the operator searches using an equivalent formatted number
**Then** the matching user appears.

---

## AC-USR-009 — Latest Search Wins

**Given** two search requests are in flight
**When** the newer search completes before the older search
**Then** the older response does not replace the newer results.

---

## AC-USR-010 — No Search Results

**Given** users exist
**And** filters return zero matches
**When** the request succeeds
**Then** a no-results state is shown
**And** Clear Filters is available when filters are active.

---

## AC-USR-011 — Stable Pagination Sort

**Given** multiple users have identical last and first names
**When** results are paginated
**Then** ID is used as the final sorting tiebreaker
**And** records are not duplicated or skipped because of ambiguous ordering.

---

## AC-USR-012 — Last Login Null Sorting

**Given** some users have never logged in
**When** sorting by Last Login
**Then** users with null Last Login appear after users with a value.

---

## AC-USR-013 — Sensitive Fields

**Given** a Users API response is returned
**Then** it does not contain:

- password hashes;
- tokens;
- authentication secrets;
- `emailNormalized`.

---

## AC-USR-014 — Open Edit

**Given** a table row exists
**When** Edit is selected
**Then** the latest user details are retrieved through `GET /api/users/:id`
**And** the Edit dialog uses those values.

---

## AC-USR-015 — Archived Detail Record

**Given** a user was archived by another operator
**When** their detail endpoint is requested
**Then** the API returns `200` with `archivedAt`
**And** the UI does not allow that record to be edited.

---

## AC-USR-016 — Required Name Validation

**Given** First Name is empty
**When** Save is selected
**Then** PATCH is not sent
**And** an inline validation error appears.

---

## AC-USR-017 — Name Normalization

**Given** First Name is entered as `Anna `
**When** the update is successfully persisted
**Then** the persisted value is `Anna`.

---

## AC-USR-018 — Duplicate Active Email

**Given** another active user already has the submitted email
**When** Save is submitted
**Then** the backend returns `409 EMAIL_ALREADY_EXISTS`
**And** the dialog remains open
**And** the Email field displays the error.

---

## AC-USR-019 — Archived Email Conflict

**Given** an archived user owns the submitted email
**When** another user is updated to that email
**Then** the API returns `409 EMAIL_TAKEN_BY_ARCHIVED_USER`.

---

## AC-USR-020 — Partial Address Update

**Given** an address contains country, city, street, and postalCode
**When** PATCH contains only:

```json
{
  "address": {
    "city": "Lviv"
  }
}
```

**Then** only city changes
**And** the other address fields remain unchanged.

---

## AC-USR-021 — Clear Address Property

**Given** postalCode has a value
**When** PATCH contains:

```json
{
  "address": {
    "postalCode": null
  }
}
```

**Then** postalCode is removed
**And** the remaining address fields are preserved.

---

## AC-USR-022 — Reject Version-Only PATCH

**Given** PATCH contains only `version`
**When** it is submitted
**Then** the API returns `400 NO_CHANGES_SUBMITTED`.

---

## AC-USR-023 — Reject Unknown PATCH Field

**Given** PATCH includes an unsupported property
**When** it is submitted
**Then** the API returns `400 UNKNOWN_FIELD`
**And** the unsupported value is not persisted.

---

## AC-USR-024 — Concurrent Update

**Given** two operators load version 7
**And** one successfully saves first
**When** the second submits version 7
**Then** the API returns `409 USER_VERSION_CONFLICT`
**And** the newer persisted update remains unchanged.

---

## AC-USR-025 — Update Changes Filter Membership

**Given** the current filter is `status=active`
**When** a user changes from active to inactive
**Then** the list is refetched
**And** the user disappears from the active-only result.

---

## AC-USR-026 — Self Archive

**Given** the operator opens their own user record
**Then** Archive is unavailable in the UI
**And** a direct archive API request returns `409 CANNOT_ARCHIVE_SELF`.

---

## AC-USR-027 — Archive Confirmation

**Given** another user is being edited
**When** Archive is selected
**Then** confirmation appears
**And** no archive request is made before confirmation.

---

## AC-USR-028 — Successful Archive

**Given** archive confirmation is accepted
**When** the request succeeds
**Then** `archivedAt` is set
**And** the database record remains
**And** the user disappears from the standard Users list.

---

## AC-USR-029 — Archive Idempotency

**Given** a user is already archived
**When** DELETE is repeated
**Then** the API returns `204`
**And** duplicate archive side effects are not produced.

---

## AC-USR-030 — Archive During Concurrent Edit

**Given** an operator has an Edit dialog open
**And** another operator archives that user
**When** the first operator attempts Save
**Then** PATCH returns `409 USER_ARCHIVED`
**And** the archived record is not modified.

---

## AC-USR-031 — Pagination Repair

**Given** a mutation causes the current page to become invalid
**When** the list is refetched
**Then** the UI navigates to the highest valid page.

---

## AC-USR-032 — Unsaved Changes Close

**Given** normalized form values differ from their original values
**When** the operator closes the Edit dialog
**Then** a discard confirmation appears.

---

## AC-USR-033 — Clean Form Escape

**Given** no unsaved changes exist
**When** Escape is pressed
**Then** the Edit dialog closes immediately.

---

## AC-USR-034 — Dirty Form Escape

**Given** unsaved changes exist
**When** Escape is pressed
**Then** the discard confirmation opens
**And** the Edit dialog remains underneath it.

---

## AC-USR-035 — Authentication Expiry

**Given** unsaved changes exist
**When** a Users API operation returns `401`
**Then** the Users module does not clear the form itself
**And** delegates authentication recovery to the central authentication flow.

---

## AC-USR-036 — Retry Loading

**Given** loading the Users list fails
**When** the error state appears
**Then** Retry is available
**And** the current search/filter/page state remains unchanged.

---

## AC-USR-037 — Accessibility of Edit Action

**Given** keyboard or screen-reader navigation is used
**When** focus reaches the Edit icon
**Then** the action has an accessible name identifying the target user.

---

## AC-USR-038 — Accessibility of Status

**Given** an inactive or blocked row uses gray styling
**Then** status remains identifiable without relying on color alone.

---

## AC-USR-039 — Rate Limiting

**Given** the request limit has been exceeded
**When** a Users API request is made
**Then** the API returns `429 Too Many Requests`.

---

# 90. Out of Scope

The following are defined separately:

- Authentication;
- Authorization;
- detailed role definitions;
- permission configuration;
- login/logout;
- password management;
- account recovery;
- user invitation;
- user creation;
- archived-user restoration;
- detailed administrative access policy;
- email verification flow;
- session invalidation rules;
- permanent privacy-erasure workflow implementation;
- audit storage architecture;

---

# 91. Remaining Open Decisions

The following do not block the basic Users Page domain model but still require separate definition:

1. Archived Users management UI.
2. Restore User workflow.
3. Exact permanent-erasure and data-retention policy.
4. Exact audit retention period.
5. Final expected production dataset size.
6. Final production performance SLA.
7. Exact supported responsive breakpoints.
8. Future bulk user operations.
9. User creation and invitation flows.

---

# 92. API Overview

```text
Users Page
   │
   ├── GET /api/users
   │      └── search / filters / sorting / pagination
   │
   ├── GET /api/users/:id
   │      └── latest user details
   │
   ├── PATCH /api/users/:id
   │      └── partial update + optimistic concurrency
   │
   └── DELETE /api/users/:id
          └── archive / soft delete
```

---

# 93. Core Business Behavior Summary

```text
Active
  → visible
  → standard styling

Inactive
  → visible
  → gray styling

Blocked
  → visible
  → gray styling + distinct status indicator

Archived
  → not visible in standard Users list
  → remains in database
  → historical relationships remain valid
  → email remains reserved
```
