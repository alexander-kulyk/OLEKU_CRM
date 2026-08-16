## Purpose

Defines the client-visible Users workspace for finding, reviewing, editing, and archiving operational CRM user records through the server Users API.

## ADDED Requirements

### Requirement: Users table presents operational records

The Users page SHALL render one semantic table row per non-archived user returned by the server. The table SHALL contain First Name, Last Name, Email, Phone, Address, Status, Last Login, and Actions columns. Missing phone or address values SHALL render as `—`, missing address components SHALL not produce empty separators, and a missing Last Login SHALL render as `Never`.

Inactive and blocked rows SHALL have a muted appearance while active rows use the standard appearance. The Status cell SHALL also contain the explicit text `Active`, `Inactive`, or `Blocked`, and blocked SHALL remain distinguishable from inactive without relying on color alone.

#### Scenario: Complete and partial records render

- **WHEN** the server returns active, inactive, and blocked list records containing complete, partial, and absent contact data
- **THEN** the page renders all eight columns, formats address components in street-city-postal code-country order without empty separators, uses the required missing-value labels, and communicates every status in text as well as styling

#### Scenario: Archived records are absent

- **WHEN** the standard Users list is displayed
- **THEN** it contains only the non-archived records returned by `GET /api/users` and provides no archived-record browsing or restoration control

### Requirement: Users collection is server-driven

The page SHALL request `GET /api/users` and SHALL delegate pagination, search, status filtering, and sorting to the server. It SHALL support page sizes 20, 50, and 100 with 20 as the default, and SHALL never require the complete user collection to be loaded into the browser.

Supported interactive sorts SHALL be First Name, Last Name, Status, and Last Login in both directions. The initial ordering SHALL use the server default of last name ascending, first name ascending, and ID ascending as the final deterministic tiebreaker. The page SHALL submit multiple selected statuses as the Users API's comma-separated status query.

#### Scenario: Initial collection request

- **WHEN** the operator opens `/users` without query parameters
- **THEN** the page requests page 1 with page size 20, no search or status restriction, and the server's deterministic default ordering

#### Scenario: Operator changes collection controls

- **WHEN** the operator selects a supported page, page size, status combination, or sort
- **THEN** the page requests only that server-side result window and does not filter, sort, or paginate a previously loaded full dataset in the browser

### Requirement: List query state is canonical in the URL

The `/users` URL SHALL canonically represent `page`, `pageSize`, `search`, status filters, and sorting. Refresh, shared URLs, and browser Back and Forward SHALL restore the same canonical controls and result request.

Invalid page, page-size, status, search encoding, or sort values SHALL be replaced with supported defaults in one idempotent URL correction that replaces the invalid history entry. Explicit page, page-size, status, and sort actions SHALL create normal history entries; typed search updates SHALL replace the current entry.

#### Scenario: Shared URL restores a query

- **WHEN** an operator opens a valid Users URL containing page, page size, search, multiple statuses, and sort
- **THEN** the controls reflect those values and the page issues the corresponding Users API request

#### Scenario: Invalid URL is repaired

- **WHEN** a Users URL contains an invalid value such as a negative page, unsupported page size, unknown status, or unknown sort
- **THEN** the page replaces it with one canonical supported URL, issues at most the canonical request, and does not crash or enter a navigation/request loop

#### Scenario: Browser history restores explicit changes

- **WHEN** the operator changes a filter or page and then uses browser Back or Forward
- **THEN** both the controls and requested result return to the state represented by the restored URL

### Requirement: Search is debounced and latest-request-wins

An eligible search SHALL be trimmed, SHALL contain at least two characters, and SHALL be requested after approximately 300 milliseconds without another search edit. Exactly one search character SHALL remain visible and represented in the URL but SHALL not be sent to the server; non-search controls SHALL remain applied and the page SHALL explain the two-character minimum.

The page SHALL cancel superseded list requests when possible and SHALL independently prevent any older completion from replacing data, loading state, or errors belonging to the latest canonical query. Expected internal cancellation SHALL not be presented as a transport failure.

#### Scenario: One-character search is not requested

- **WHEN** the search value contains exactly one non-whitespace character while a status filter and sort are active
- **THEN** no request includes that search, the result for the active non-search controls remains available, and the page communicates that at least two characters are required

#### Scenario: Search is debounced

- **WHEN** the operator types multiple eligible values within the debounce interval
- **THEN** the page requests only the final settled value after approximately 300 milliseconds

#### Scenario: Older response finishes last

- **WHEN** an older list request completes after a newer canonical query has completed
- **THEN** the older response cannot replace the newer items, pagination, loading state, or error state

### Requirement: Collection states are distinct and recoverable

The page SHALL distinguish initial/loading state, load failure, an empty user collection, and zero results caused by search or status filters. Loading and error feedback SHALL be exposed through an appropriate status or live region. A failed request SHALL offer Retry without changing the canonical URL or controls.

The no-results state SHALL offer Clear filters whenever search or statuses narrow the result. Clear filters SHALL remove search and status filters, reset page to 1, preserve the selected page size and sort, and request the resulting unfiltered collection.

#### Scenario: User collection is empty

- **WHEN** the unsearched and unfiltered page 1 response reports zero total records
- **THEN** the page displays a true empty-users message and does not present it as a search failure

#### Scenario: Query has no matches

- **WHEN** search or status controls are active and the response contains no items
- **THEN** the page displays a no-results message and a Clear filters action

#### Scenario: Retry after failure

- **WHEN** a list request fails and the operator activates Retry
- **THEN** the page repeats the current canonical query without clearing controls or changing browser history

### Requirement: Out-of-range pages are repaired

When a syntactically valid requested page is above the highest page reported by the server, the page SHALL navigate to the highest valid page and request it. If total pages is zero, the canonical page SHALL be 1. The same repair SHALL run after update or archive refetches, and SHALL be idempotent.

#### Scenario: Direct URL exceeds the result range

- **WHEN** the server returns page 99 with `totalPages` 8
- **THEN** the client replaces the URL page with 8 and requests page 8 once

#### Scenario: Mutation removes the last row on a page

- **WHEN** a post-mutation refetch reports that the current page no longer exists
- **THEN** the page navigates to the highest valid page and displays the server result for that repaired query

#### Scenario: Empty result has no pages

- **WHEN** a refetch reports `totalPages` 0
- **THEN** the canonical URL uses page 1 and the page displays the applicable empty state without a correction loop

### Requirement: Editing starts from current detail data

Activating a row's icon-only Edit action SHALL identify the user in its accessible label and request `GET /api/users/:userId` before opening an editable form. The form SHALL be initialized from the detail response, including its version; list-row data SHALL not substitute for detail data.

If the detail response is archived, the page SHALL not permit editing, SHALL inform the operator, and SHALL refetch the list. If the detail request returns not found, the page SHALL not open the form, SHALL inform the operator that the record is unavailable, and SHALL refetch the list.

#### Scenario: Current details open for editing

- **WHEN** the operator activates `Edit Anna Smith` and the current non-archived detail request succeeds
- **THEN** the Edit User dialog opens with that response's editable values, read-only metadata, and version

#### Scenario: Selected row was archived elsewhere

- **WHEN** the detail request succeeds with a non-null archive timestamp
- **THEN** editing remains unavailable, the operator is notified, and the Users list is refreshed

#### Scenario: Selected row no longer exists

- **WHEN** the detail request returns not found
- **THEN** no editable dialog opens, the operator sees an unavailable-record message, and the current list is refreshed

### Requirement: Edit form exposes and validates the supported fields

The Edit User dialog SHALL expose editable First Name, Last Name, Email, Phone, Phone Extension, Country, City, Street, Postal Code, and Status fields, and read-only User ID, Last Login, and Created At values. Names SHALL be trimmed, Unicode-NFC normalized, required, at most 100 characters, and free of control characters while allowing valid apostrophes and hyphens. Email SHALL be trimmed, required, syntactically valid, and at most 254 characters.

Phone and phone extension SHALL be optional; a present phone SHALL be validated using the deployment-wide configured phone region while continuing to accept valid international numbers. Address fields SHALL be optional, trimmed, Unicode-capable, and invalid when non-empty input contains only whitespace. Invalid fields SHALL have inline, programmatically associated errors and SHALL prevent a save request.

#### Scenario: Invalid editable values are submitted

- **WHEN** the operator selects Save with invalid names, email, phone, or address values
- **THEN** each invalid field exposes an associated inline error, focus can reach the errors by keyboard, and no PATCH request is sent

#### Scenario: Valid international profile values are submitted

- **WHEN** the form contains valid Unicode names, a valid email, an international phone, optional extension, partial address, and supported status
- **THEN** client validation accepts the values and the save workflow may continue

### Requirement: Save sends a normalized versioned merge patch

Save SHALL remain available whenever the form is idle and SHALL be disabled only during the active save request. The page SHALL prevent duplicate save requests. Dirty comparison and patch construction SHALL use the same normalized values.

For a dirty valid form, the page SHALL send `PATCH /api/users/:userId` with the last-read version and only changed mutable members. Omitted members SHALL mean unchanged; nullable phone, extension, address, and individual address properties SHALL use `null` to clear; a partial address object SHALL preserve omitted address properties. Immutable and read-only members SHALL never be sent.

For a normalized-clean form, Save SHALL send no PATCH, SHALL keep the dialog open, and SHALL announce `No changes to save` as a non-error status.

#### Scenario: Whitespace-only difference is clean

- **WHEN** the operator adds only normalization-equivalent surrounding whitespace and selects Save
- **THEN** no PATCH is sent, the dialog remains open, and the page announces that there are no changes to save

#### Scenario: One address member is cleared

- **WHEN** the operator clears postal code but leaves the other address values unchanged
- **THEN** the patch contains the version and `address.postalCode: null`, omits the other address members, and does not replace the whole address

#### Scenario: Full address is removed

- **WHEN** the operator explicitly clears every address component from a previously populated address and saves
- **THEN** the patch represents removal of the full address with `address: null`

### Requirement: Save outcomes preserve server truth and unsaved work

After a successful PATCH, the page SHALL close the Edit dialog and refetch the current canonical collection instead of mutating a paginated row locally. If the updated user no longer matches active filters, it SHALL disappear according to the refetched server result.

Field-specific duplicate-email errors SHALL keep the dialog open and attach the server message to Email. Validation and unknown-field errors SHALL remain form-level or field-level according to the server's `field` value. Forbidden, rate-limit, and unexpected failures SHALL be operation-level errors and SHALL preserve the current form.

A version conflict SHALL preserve the form, SHALL not retry or overwrite automatically, and SHALL offer an explicit reload-latest action. Reloading latest data while the form is dirty SHALL require discard confirmation. A `USER_ARCHIVED` result SHALL preserve values until acknowledgement, then close the edit flow and refetch the list.

#### Scenario: Update succeeds under an active filter

- **WHEN** a valid PATCH succeeds and the updated record no longer matches the active status filter
- **THEN** the dialog closes, the canonical query is refetched, and the row disappears according to the server response

#### Scenario: Duplicate email is rejected

- **WHEN** Save returns `EMAIL_ALREADY_EXISTS` or `EMAIL_TAKEN_BY_ARCHIVED_USER` with field `email`
- **THEN** the dialog and unsaved values remain, and the server message is associated with the Email field

#### Scenario: Version conflict occurs

- **WHEN** Save returns `USER_VERSION_CONFLICT`
- **THEN** the page keeps the unsaved form open, does not retry or overwrite automatically, and offers an explicit guarded way to load the latest detail

#### Scenario: User becomes archived during edit

- **WHEN** Save returns `USER_ARCHIVED`
- **THEN** the page preserves the form until the operator acknowledges the message, then closes the edit flow and refetches the current list

### Requirement: Archive is confirmed and server-authoritative

The Edit User dialog SHALL provide Archive for an eligible user. Activating it SHALL open a confirmation explaining that the user leaves the Users list while historical information is preserved; the message SHALL not call archival irreversible. Confirming SHALL call `DELETE /api/users/:userId` without a version, prevent duplicate submissions, and treat a 204 response as success.

After success, the page SHALL close the archive and edit dialogs and refetch the canonical collection with pagination repair. A self-archive or last-administrator conflict SHALL keep the edit dialog and form intact and SHALL present an operation-level explanation without claiming success.

#### Scenario: Archive succeeds

- **WHEN** an eligible user's archive is confirmed and the server returns 204
- **THEN** both dialogs close and the current canonical Users query is refetched and repaired if necessary

#### Scenario: Archive conflicts with access protection

- **WHEN** the server returns `CANNOT_ARCHIVE_SELF` or `CANNOT_ARCHIVE_LAST_ADMINISTRATIVE_USER`
- **THEN** the confirmation closes, the edit form remains intact, and an operation-level explanation is displayed

### Requirement: Operator context and deployment phone configuration are explicit inputs

The page SHALL consume current-operator identity for self-archive presentation, centralized authentication recovery for 401 responses, and the deployment-wide default phone region for phone validation. It SHALL display Last Login in UTC and SHALL not derive operator identity or phone-region configuration from browser locale, browser timezone, URL data, or editable user data.

When current-operator identity is available and matches the edited user, Archive SHALL be disabled with an explanation. When any required context is unavailable, the affected behavior SHALL expose a configuration-unavailable state and SHALL not silently substitute a browser-derived value. A 401 during editing SHALL be delegated to the centralized recovery flow without intentionally closing or resetting a dirty form; a 403 SHALL remain an operation-level error.

#### Scenario: Operator edits their own record

- **WHEN** current-operator identity matches the edited user ID
- **THEN** Archive is disabled with an accessible explanation while server-side protection remains authoritative

#### Scenario: Last Login uses UTC

- **WHEN** a record has a non-null Last Login value
- **THEN** the page displays it in UTC rather than the browser timezone

#### Scenario: Session expires with unsaved work

- **WHEN** a Users request returns 401 while the form is dirty
- **THEN** the page delegates recovery without intentionally closing the dialog or resetting its values

### Requirement: Dialog dismissal protects dirty forms

The Edit User dialog SHALL support Close, outside click, and Escape. If the normalized form is clean, those actions SHALL close immediately. If it is dirty, they SHALL open a confirmation with Continue editing and Discard changes; Continue editing SHALL close only the confirmation, while Discard changes SHALL close both and discard local edits.

Only the topmost dialog SHALL respond to Escape or outside interaction. Opening a dialog SHALL move focus to an appropriate control, Tab and Shift+Tab SHALL remain within the topmost dialog, closing it SHALL restore focus to its logical trigger, and stacked confirmations SHALL restore focus within the still-open parent dialog.

#### Scenario: Dirty edit receives Escape

- **WHEN** the dirty Edit User dialog is topmost and the operator presses Escape
- **THEN** the edit dialog remains open and a discard confirmation opens with focus inside it

#### Scenario: Escape closes only the topmost confirmation

- **WHEN** an archive or discard confirmation is open above Edit User and the operator presses Escape
- **THEN** only that confirmation closes and focus returns to an appropriate control inside Edit User

#### Scenario: Clean edit is dismissed

- **WHEN** the normalized form is clean and the operator uses Close, outside click, or Escape
- **THEN** Edit User closes immediately and focus returns to the Edit action that opened it when that trigger still exists

### Requirement: Users interactions and feedback are accessible and responsive

Sortable table headers SHALL be keyboard operable and expose their current direction to assistive technology. Icon-only actions SHALL have record-specific accessible labels. Loading, errors, validation, and non-error statuses SHALL be programmatically announced as appropriate, and status SHALL never be communicated by color alone.

At narrow supported widths, content SHALL not overlap, every column and action SHALL remain reachable through horizontal access, and visually truncated values SHALL have a keyboard- and screen-reader-accessible way to obtain the full value.

#### Scenario: Keyboard-only operator uses the Users page

- **WHEN** the operator navigates, sorts, edits, validates, confirms, and dismisses using only the keyboard
- **THEN** every action is reachable, focus remains visible and deterministic, sort/error/status information is announced, and no required information depends only on color or pointer hover

#### Scenario: Narrow viewport displays long values

- **WHEN** the Users table is viewed at a narrow supported width with long contact data
- **THEN** content does not overlap, the table and Actions remain reachable, and the complete truncated values remain accessible

### Requirement: Search data receives no additional client persistence

The page SHALL use the URL for the query state required for refresh, history, and sharing, but SHALL not additionally persist Users search terms or returned user records in client storage or client telemetry as part of this capability.

#### Scenario: Search session ends

- **WHEN** an operator searches by name, email, or phone and later leaves the page
- **THEN** this capability has created no additional local-storage, session-storage, or telemetry copy of the search term or returned records
