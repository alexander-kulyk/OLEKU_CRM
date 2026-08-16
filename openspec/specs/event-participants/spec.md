# event-participants Specification

## Purpose

Defines how attendees and hosts are assigned to an event from within the Event dialog: where the selectable people come from, how they are searched and added, how assignments are displayed and removed, and when those changes become persistent.

## Requirements

### Requirement: Attendee and host selectors

The Event dialog SHALL provide a searchable multi-select control in the attendees section and another in the hosts section, each populated with people already registered in the system who are eligible for that role. The user SHALL be able to open the list, search it, select one or several people, and clear a selection that has not yet been added.

#### Scenario: Opening a selector

- **WHEN** the user opens the attendee selector
- **THEN** eligible people are listed for selection

#### Scenario: Selecting several people

- **WHEN** the user selects more than one person in a selector
- **THEN** all selected people are shown as pending selection

#### Scenario: Clearing a pending selection

- **WHEN** the user clears a selection that has not been added
- **THEN** the selector returns to empty and the event's assigned list is unchanged

### Requirement: Only eligible people are offered

The attendee selector SHALL offer active contacts. The host selector SHALL offer only active employees who are permitted to host events. The system SHALL apply the host eligibility filter when requesting host options, so that a person the server would reject is never presented as selectable.

#### Scenario: Host options are restricted

- **WHEN** the user opens the host selector
- **THEN** only active employees permitted to host events are offered

#### Scenario: Ineligible people are absent

- **WHEN** the directory contains an inactive person or an employee not permitted to host
- **THEN** that person does not appear among the offered options

### Requirement: Search is resolved by the directory service

Search text entered in a selector SHALL be sent to the directory service and the returned matches SHALL be offered. The system SHALL NOT filter a locally held subset instead, because the directory service returns a capped number of people and a match outside that cap would otherwise be unreachable.

#### Scenario: Searching by name

- **WHEN** the user types search text into a selector
- **THEN** the search text is sent to the directory service and the people it returns are offered

#### Scenario: A person beyond the default result cap

- **WHEN** the user searches for a person who is not among the options offered before searching
- **THEN** that person is offered, because the search was resolved by the directory service

#### Scenario: No matches

- **WHEN** a search returns no people
- **THEN** the selector indicates that no matching people were found, and no error is displayed

### Requirement: Explicit Add step

Each section SHALL provide an Add action that moves the current selection into the event's assigned list and then clears the selector. Add SHALL be disabled while nothing is selected. Selecting a person SHALL NOT assign them until Add is used.

#### Scenario: Adding selected people

- **WHEN** the user selects one or more people and activates Add
- **THEN** they are appended to the event's assigned list and the selector is cleared

#### Scenario: Add is disabled with nothing selected

- **WHEN** no person is selected in a section
- **THEN** that section's Add action is disabled

#### Scenario: Selection alone does not assign

- **WHEN** the user selects a person but does not activate Add
- **THEN** the event's assigned list is unchanged

### Requirement: No duplicate assignments

A person already assigned to the event in a given role SHALL NOT be assigned to that role a second time.

#### Scenario: Adding an already-assigned person

- **WHEN** the user adds a person who is already in the event's assigned list for that role
- **THEN** the assigned list is unchanged and the person appears in it exactly once

#### Scenario: Duplicates within one Add

- **WHEN** a single Add would introduce the same person more than once
- **THEN** the person appears in the assigned list exactly once

### Requirement: Assigned people are listed and removable

Each assigned person SHALL be displayed as a distinct item showing their name and a remove control. Activating the remove control SHALL remove that person from the form's assigned list, leaving the dialog open and the other assignments untouched.

#### Scenario: Assigned list display

- **WHEN** people are assigned to the event
- **THEN** each appears as a separate item showing their name and a remove control

#### Scenario: Removing one person

- **WHEN** the user activates the remove control on one assigned person
- **THEN** that person is removed from the form's assigned list, the dialog stays open, and the remaining assignments are unchanged

### Requirement: Participant changes persist only on save

For an existing event, adding or removing participants in the form SHALL take effect only when the event update is saved successfully. Abandoning the dialog SHALL leave the event's stored participants unchanged.

#### Scenario: Changes are pending until saved

- **WHEN** the user adds or removes participants on an existing event but does not save
- **THEN** the event's stored participants are unchanged

#### Scenario: Changes persist after saving

- **WHEN** the user adds or removes participants on an existing event and saves successfully
- **THEN** the event's stored participants match the form's assigned lists exactly

### Requirement: A save transmits the complete intended participant sets

When saving an existing event, the system SHALL transmit the complete intended set of attendees and the complete intended set of hosts, including an empty set when every participant of that role has been removed. The system SHALL NOT omit a role from the submission, because omission leaves the stored assignments untouched and a removal would silently fail to persist.

#### Scenario: Removing the last participant persists

- **WHEN** the user removes every attendee from an existing event and saves
- **THEN** the saved event has no attendees, and reopening it shows none

#### Scenario: Partial removal persists

- **WHEN** the user removes one of several hosts and saves
- **THEN** the saved event has exactly the remaining hosts, and reopening it shows exactly those

#### Scenario: Unchanged role is still transmitted

- **WHEN** the user changes only the attendees of an event and saves
- **THEN** the hosts are transmitted as well, and the saved event retains exactly the hosts shown in the form

### Requirement: An empty directory is a valid state

If no eligible people exist, the selectors SHALL present an empty state indicating there is nobody to assign. The system SHALL NOT report an error, block the dialog, or prevent an event from being created or updated without participants; attendees and hosts are optional.

#### Scenario: No people registered

- **WHEN** the directory contains no eligible people
- **THEN** the selector shows an empty state indicating nobody is available to assign, and no error is displayed

#### Scenario: Saving without participants

- **WHEN** the user saves an event with no attendees and no hosts
- **THEN** the event is saved successfully

### Requirement: Failure to load participant options is reported and recoverable

If the attendee or host options cannot be loaded, the system SHALL display a clear, non-technical message for that section and SHALL offer a way to retry. The rest of the dialog SHALL remain usable, and entered event details SHALL be preserved.

#### Scenario: Options fail to load

- **WHEN** loading attendee or host options fails
- **THEN** that section shows a plain-language message that the people could not be loaded and offers a retry, while the event detail fields remain usable and populated

#### Scenario: Retry succeeds

- **WHEN** the user retries after a failed load and the request succeeds
- **THEN** the options are offered and the section behaves normally
