## Purpose

Covers assigning people to an event — customers attending it and employees hosting it — including the directory the selectors draw from, the search and multi-select interaction, duplicate prevention, and when participant edits become persistent.

## ADDED Requirements

### Requirement: Eligible participant directory

The system SHALL expose the customers registered as eligible attendees and the employees registered as eligible hosts, so the Event dialog's selectors can be populated. Each participant MUST be identifiable by a displayable name and a stable identifier.

Creating, editing, and removing customers and employees is out of scope for this capability; the directory is read-only here.

#### Scenario: Attendee directory is available

- **WHEN** the attendee selector requests eligible participants
- **THEN** the registered customers are returned, each with a stable identifier and a displayable name

#### Scenario: Host directory is available

- **WHEN** the host selector requests eligible participants
- **THEN** the registered employees are returned, each with a stable identifier and a displayable name

#### Scenario: Empty directory

- **WHEN** no customers or employees are registered
- **THEN** the corresponding selector reports that no participants are available
- **AND** no error is displayed

#### Scenario: Directory load failure

- **WHEN** loading the available attendees or the available hosts fails
- **THEN** a user-facing message states that the participant list could not be loaded
- **AND** the rest of the Event dialog remains usable

### Requirement: Attendee selection

The attendees section SHALL provide a searchable multi-select control listing eligible attendees from the directory. The user MUST be able to open the list, search it, select one or more attendees, and clear a selection that has not yet been added.

#### Scenario: Searching for an attendee

- **WHEN** the user types a search term into the attendee selector
- **THEN** the list is narrowed to eligible attendees matching the term

#### Scenario: Selecting a single attendee

- **WHEN** the user selects one attendee in the selector
- **THEN** that attendee is held as the selector's pending selection

#### Scenario: Selecting multiple attendees

- **WHEN** the user selects several attendees in the selector
- **THEN** all of them are held as the selector's pending selection

#### Scenario: Clearing an unconfirmed selection

- **WHEN** the user clears the selector before adding
- **THEN** the pending selection is emptied
- **AND** the event's assigned attendee list is unchanged

### Requirement: Adding attendees to the event

The attendees section SHALL provide an Add action that moves the pending selection into the event's assigned attendee list and then clears the selector. The Add action MUST be disabled while nothing is selected.

#### Scenario: Adding selected attendees

- **WHEN** the user has selected one or more attendees and activates Add
- **THEN** the selected attendees appear in the event's assigned attendee list
- **AND** the selector is cleared

#### Scenario: Add is disabled without a selection

- **WHEN** no attendee is selected in the selector
- **THEN** the Add action is disabled

### Requirement: Assigned attendee list

Each assigned attendee SHALL be displayed as its own list item, chip, or tag showing the attendee's name and a remove control.

#### Scenario: Assigned attendee is displayed

- **WHEN** an attendee is assigned to the event
- **THEN** a distinct item for that attendee is displayed showing the attendee's name and a remove control

### Requirement: Removing an assigned attendee

Activating the remove control on an assigned attendee SHALL remove that attendee from the form's attendee list, leaving the Event dialog open and the other assigned attendees untouched.

#### Scenario: Removing one attendee

- **WHEN** the user activates the remove control on an assigned attendee
- **THEN** that attendee is removed from the form's attendee list
- **AND** the Event dialog remains open
- **AND** the other assigned attendees remain assigned

### Requirement: Host selection and assignment

The hosts section SHALL follow the same interaction model as the attendees section: a searchable multi-select control populated from the eligible host directory, an Add action that is disabled while nothing is selected, an assigned host list with a remove control per host, and support for selecting one or several hosts at a time.

#### Scenario: Searching for a host

- **WHEN** the user types a search term into the host selector
- **THEN** the list is narrowed to eligible hosts matching the term

#### Scenario: Adding selected hosts

- **WHEN** the user has selected one or more hosts and activates Add
- **THEN** the selected hosts appear in the event's assigned host list
- **AND** the selector is cleared

#### Scenario: Add is disabled without a host selection

- **WHEN** no host is selected in the selector
- **THEN** the Add action is disabled

#### Scenario: Removing an assigned host

- **WHEN** the user activates the remove control on an assigned host
- **THEN** that host is removed from the form's host list
- **AND** the other assigned hosts remain assigned

### Requirement: Duplicate participants are prevented

The system SHALL NOT assign the same attendee to an event more than once, nor the same host more than once. An attendee or host already assigned to the event MUST NOT be added a second time, and the stored event MUST hold at most one assignment per person per role.

#### Scenario: Adding an already-assigned attendee

- **WHEN** the user adds an attendee who is already in the event's assigned attendee list
- **THEN** the assigned attendee list still contains exactly one entry for that attendee

#### Scenario: Adding an already-assigned host

- **WHEN** the user adds a host who is already in the event's assigned host list
- **THEN** the assigned host list still contains exactly one entry for that host

#### Scenario: Duplicate assignment is rejected on save

- **WHEN** a save request would assign the same person to an event twice in the same role
- **THEN** the assignment is rejected
- **AND** the event retains at most one assignment for that person in that role

### Requirement: Participants are optional

The system SHALL allow an event to be created and updated with no attendees and no hosts. Attendee and host selection MUST NOT block the dialog's primary action.

#### Scenario: Saving an event without participants

- **WHEN** the user saves a valid event with no attendees and no hosts assigned
- **THEN** the event is created
- **AND** no validation message about participants is displayed

### Requirement: Participant edits persist only on save

For an existing event, adding or removing attendees and hosts in the form SHALL change the stored assignments only after the event update is saved successfully. Discarding the dialog MUST leave the stored assignments unchanged.

#### Scenario: Removal persists after a successful update

- **WHEN** the user removes an assigned attendee from an existing event and the update succeeds
- **THEN** the stored event no longer has that attendee assigned

#### Scenario: Removal is not persisted before saving

- **WHEN** the user removes an assigned attendee from an existing event and closes the dialog by discarding changes
- **THEN** the stored event still has that attendee assigned

#### Scenario: Addition is not persisted before saving

- **WHEN** the user adds a host to an existing event and closes the dialog by discarding changes
- **THEN** the stored event does not have that host assigned

#### Scenario: Failed update leaves assignments untouched

- **WHEN** the user changes the attendee or host list and the update fails
- **THEN** the stored assignments are unchanged
- **AND** the form still shows the user's intended attendee and host lists
