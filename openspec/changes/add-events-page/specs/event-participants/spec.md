## Purpose

How people are attached to an event: the directory of registered contacts and employees that backs the selectors, the search-and-add interaction that assigns them as attendees or hosts, and the rules governing duplicates, removal, and when assignments become persistent.

## ADDED Requirements

### Requirement: Eligible participant directory

The system SHALL provide the set of people who may be assigned to an event: registered contacts — the people the business serves — who are eligible as attendees, and registered employees, who are eligible as hosts. Each entry SHALL carry a stable identifier and a display name composed of the person's first and last name.

#### Scenario: Attendee options come from registered contacts

- **WHEN** the attendee selector is opened
- **THEN** it offers registered contacts
- **AND** each option displays that person's first and last name

#### Scenario: Host options come from registered employees

- **WHEN** the host selector is opened
- **THEN** it offers registered employees
- **AND** each option displays that person's first and last name

#### Scenario: Login accounts are not participants

- **WHEN** either selector is opened
- **THEN** it offers only contacts or only employees respectively
- **AND** authentication accounts are never offered as assignable people

#### Scenario: Directory unavailable

- **WHEN** the eligible attendees or eligible hosts cannot be loaded
- **THEN** a user-facing message explains that the participant list could not be loaded
- **AND** the rest of the Event dialog remains usable

### Requirement: Participant search and multi-select

Each participant section SHALL provide a searchable selector that allows one or several people to be selected before they are assigned, and allows an un-assigned selection to be cleared.

#### Scenario: Searching for a person

- **WHEN** the user types text into the selector
- **THEN** the options are narrowed to those whose first or last name matches the text

#### Scenario: Selecting a single person

- **WHEN** the user selects one option
- **THEN** that person is held as a pending selection and is not yet assigned to the event

#### Scenario: Selecting several people

- **WHEN** the user selects several options
- **THEN** all of them are held as pending selections

#### Scenario: Clearing a pending selection

- **WHEN** the user clears the selector before assigning
- **THEN** the pending selections are discarded
- **AND** the event's assigned participants are unchanged

#### Scenario: Already-assigned people are not offered

- **WHEN** a person is already assigned to the event
- **THEN** the selector does not offer that person as a selectable option

### Requirement: Assigning selected participants

Each participant section SHALL provide an **Add** action that moves the pending selections into the event's assigned list and clears the selector. The Add action SHALL be disabled while nothing is selected, and assigning SHALL NOT produce a duplicate.

#### Scenario: Adding selected people

- **WHEN** the user has one or more pending selections and activates Add
- **THEN** each selected person appears in the section's assigned list
- **AND** the selector is cleared
- **AND** no pending selections remain

#### Scenario: Add is disabled with an empty selection

- **WHEN** no person is selected in the section's selector
- **THEN** the Add action is disabled

#### Scenario: A person cannot be assigned twice

- **WHEN** an attempt is made to assign a person who is already in the section's assigned list
- **THEN** the assigned list still contains exactly one entry for that person

### Requirement: Assigned participant list

Each participant section SHALL display every assigned person as a distinct item showing that person's display name and a control that removes them.

#### Scenario: Assigned people are listed

- **WHEN** an event has assigned attendees or hosts
- **THEN** each of them is displayed as a separate item showing their name
- **AND** each item offers a remove control

#### Scenario: No one is assigned

- **WHEN** a participant section has no assigned people
- **THEN** the section renders an empty assigned list without error

### Requirement: Removing an assigned participant

Activating an assigned person's remove control SHALL remove only that person from that section's list in the form, leaving the Event dialog open and the other assignments untouched.

#### Scenario: Removing one person

- **WHEN** the user activates the remove control on an assigned person
- **THEN** that person is removed from the section's assigned list
- **AND** the other assigned people in the section are unchanged
- **AND** the Event dialog remains open

#### Scenario: Sections are independent

- **WHEN** an attendee is removed
- **THEN** the assigned host list is unchanged

#### Scenario: A removed person becomes selectable again

- **WHEN** an assigned person is removed
- **THEN** that person is offered by the section's selector again

### Requirement: Participant assignments persist only on commit

Adding and removing participants SHALL change only the form until the event is committed. Assignments SHALL become persistent when a create or update operation succeeds, and SHALL be discarded if the user discards the changes or the operation fails.

#### Scenario: Assignments are stored on successful creation

- **WHEN** an event is created with assigned attendees and hosts
- **THEN** the stored event has exactly those attendees and hosts

#### Scenario: Assignments are stored on successful update

- **WHEN** an existing event is updated after attendees or hosts were added and removed
- **THEN** the stored assignments match the form's lists exactly, with the removed people no longer assigned and the added people assigned

#### Scenario: Discarded changes leave assignments untouched

- **WHEN** the user changes an existing event's participants and then discards the changes
- **THEN** the event's stored assignments are unchanged

#### Scenario: Failed commit leaves assignments untouched

- **WHEN** a create or update operation fails after participants were changed
- **THEN** no assignment change is persisted
- **AND** the form still shows the user's intended participants

### Requirement: Assignments reference existing people

A commit SHALL be rejected when it assigns a person who does not exist in the corresponding directory, and a stored reference that can no longer be resolved SHALL NOT prevent an event from being displayed.

#### Scenario: Unknown person is rejected

- **WHEN** a create or update request assigns an identifier that matches no contact or no employee
- **THEN** the operation is rejected with a user-facing error
- **AND** no event is created or modified

#### Scenario: Unresolvable reference does not break the calendar

- **WHEN** an event holds a participant reference that no longer resolves to a person
- **THEN** the event is still returned and rendered
- **AND** the unresolvable participant is omitted from the displayed lists

### Requirement: Duplicate assignments are rejected on commit

A commit SHALL NOT result in the same person being assigned to the same event more than once in the same role, regardless of what the request contains.

#### Scenario: Duplicated identifiers in a commit

- **WHEN** a create or update request assigns the same person twice in the same role
- **THEN** the stored event contains exactly one assignment for that person in that role

#### Scenario: Same person in both roles

- **WHEN** a person is eligible as both an attendee and a host and is assigned in both roles
- **THEN** both assignments are stored, because they are separate roles
