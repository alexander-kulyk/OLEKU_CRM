## Purpose

The lifecycle of a single event: the dialog a business user works in, the details an event carries, the rules those details must satisfy, and the create, update, and delete operations that commit them — including the confirmations that protect against accidental data loss.

## ADDED Requirements

### Requirement: Event dialog modes

The Event dialog SHALL operate in exactly one of two modes. Create mode represents a new event; Edit mode represents an event that already exists.

In Create mode the dialog SHALL offer a **Save** action and SHALL NOT offer Edit or Delete actions.

In Edit mode the dialog SHALL offer an **Edit** action, which commits changes to the existing event, and a **Delete** action, and SHALL NOT offer the Save action used for creation.

#### Scenario: Create mode actions

- **WHEN** the dialog is open in Create mode
- **THEN** a Save action is available
- **AND** no Edit action is present
- **AND** no Delete action is present

#### Scenario: Edit mode actions

- **WHEN** the dialog is open in Edit mode
- **THEN** an Edit action is available
- **AND** a Delete action is available
- **AND** the Save action used for creation is not present

#### Scenario: Existing values are populated

- **WHEN** the dialog opens in Edit mode for an existing event
- **THEN** the event name, date, start time, end time, assigned attendees, and assigned hosts are populated with that event's stored values

### Requirement: Event dialog structure

The Event dialog SHALL present the event details, the attendees section, the hosts section, and the dialog actions.

#### Scenario: Dialog sections are present

- **WHEN** the Event dialog is open in either mode
- **THEN** the event details fields, an attendees section, a hosts section, and the mode's actions are all present

### Requirement: Event name

An event SHALL have a name, entered as free text. The name is required and SHALL NOT be empty or consist only of whitespace.

#### Scenario: Entering a name

- **WHEN** the user types a descriptive name such as "Mathematics lesson"
- **THEN** the value is accepted and retained in the form

#### Scenario: Whitespace-only name is rejected

- **WHEN** the name field contains only whitespace
- **THEN** the field is reported as invalid
- **AND** the mode's commit action is disabled

#### Scenario: Missing name is rejected

- **WHEN** the name field is empty
- **THEN** the field is reported as invalid
- **AND** the mode's commit action is disabled

### Requirement: Event date

An event SHALL have a date, chosen through a date-selection control. The date is required.

#### Scenario: Choosing a date

- **WHEN** the user opens the date control and chooses a date
- **THEN** the chosen date is displayed in the field
- **AND** the chosen date becomes part of the event's schedule

#### Scenario: Missing date is rejected

- **WHEN** no date has been chosen
- **THEN** the field is reported as invalid
- **AND** the mode's commit action is disabled

### Requirement: Event start and end times

An event SHALL have a start time and an end time, each chosen through a time-selection control offering hour and minute, and each required. The end time SHALL be later than the start time.

#### Scenario: Choosing a start time

- **WHEN** the user opens the start time control and selects an hour and minute
- **THEN** the selected time is displayed in the start time field

#### Scenario: Choosing an end time

- **WHEN** the user opens the end time control and selects an hour and minute
- **THEN** the selected time is displayed in the end time field

#### Scenario: End time equal to start time is rejected

- **WHEN** the end time equals the start time
- **THEN** a validation error is displayed for the time range
- **AND** the mode's commit action is disabled

#### Scenario: End time earlier than start time is rejected

- **WHEN** the end time is earlier than the start time
- **THEN** a validation error is displayed for the time range
- **AND** the mode's commit action is disabled

#### Scenario: Missing time is rejected

- **WHEN** either the start time or the end time is empty
- **THEN** that field is reported as invalid
- **AND** the mode's commit action is disabled

### Requirement: Form validation gating

The system SHALL disable the commit action of the active mode — Save in Create mode, Edit in Edit mode — while any required field is missing or any validation rule is unsatisfied. Validation messages SHALL be displayed near the field they concern.

The required fields are the event name, the event date, the start time, and the end time. Attendees and hosts are optional.

#### Scenario: Commit blocked while the form is invalid

- **WHEN** any required field is missing or invalid
- **THEN** the active mode's commit action is disabled

#### Scenario: Commit enabled once the form is valid

- **WHEN** the name is non-blank, the date is set, both times are set, and the end time is later than the start time
- **THEN** the active mode's commit action is enabled

#### Scenario: Messages are placed with their fields

- **WHEN** a field fails validation
- **THEN** the message explaining the failure is displayed adjacent to that field

#### Scenario: Event with no participants is valid

- **WHEN** all required detail fields are valid and no attendees or hosts are assigned
- **THEN** the active mode's commit action is enabled

### Requirement: Creating an event

On Save in Create mode, the system SHALL validate the form, create the event with its detail fields and its assigned attendees and hosts, and close the dialog once the operation succeeds.

#### Scenario: Successful creation

- **WHEN** the user selects Save with a valid form
- **THEN** the event is created with the entered name, date, start time, and end time
- **AND** the selected attendees are assigned to it
- **AND** the selected hosts are assigned to it
- **AND** the dialog closes

#### Scenario: Failed creation preserves the form

- **WHEN** the create operation fails
- **THEN** the dialog remains open
- **AND** a user-facing error explaining that the event could not be created is displayed
- **AND** every entered value, including assigned attendees and hosts, is preserved
- **AND** the user can attempt the operation again

### Requirement: Updating an event

On Edit in Edit mode, the system SHALL validate the form, update the existing event's name, date, start time, end time, attendee assignments, and host assignments, and close the dialog once the operation succeeds.

#### Scenario: Successful update

- **WHEN** the user changes any of the event's fields or participants and selects Edit with a valid form
- **THEN** the stored event reflects the entered values
- **AND** the attendee and host assignments match the form's lists
- **AND** the dialog closes

#### Scenario: Failed update preserves the changes

- **WHEN** the update operation fails
- **THEN** the dialog remains open
- **AND** a user-facing error explaining that the event could not be updated is displayed
- **AND** the user's unsaved changes are preserved

### Requirement: Deleting an event

The Delete action SHALL be available only for an existing event, and SHALL require confirmation before the event is removed. The confirmation SHALL state that the event will be removed and that the action cannot be undone, and SHALL offer a cancel action and a confirm action.

#### Scenario: Confirmation is required

- **WHEN** the user selects Delete in Edit mode
- **THEN** a confirmation is displayed stating that the event will be removed and cannot be recovered
- **AND** it offers both a cancel action and a delete action
- **AND** the event is not yet deleted

#### Scenario: Cancelling the confirmation

- **WHEN** the user cancels the delete confirmation
- **THEN** the confirmation closes
- **AND** the event is unchanged
- **AND** the Event dialog remains open with its current values

#### Scenario: Confirming deletion

- **WHEN** the user confirms deletion
- **THEN** the event is deleted
- **AND** the confirmation closes
- **AND** the Event dialog closes

#### Scenario: Failed deletion

- **WHEN** the delete operation fails
- **THEN** the event remains
- **AND** a user-facing error explaining that the event could not be deleted is displayed
- **AND** the Event dialog remains open

### Requirement: Closing the Event dialog

The user SHALL be able to close the Event dialog through a close control in the dialog, by selecting outside the dialog, and by pressing Escape. All three routes SHALL behave identically with respect to unsaved changes.

#### Scenario: Closing with no unsaved changes

- **WHEN** the user closes the dialog through any of the three routes and no value has been changed since it opened
- **THEN** the dialog closes immediately without a confirmation

#### Scenario: Closing with unsaved changes prompts a confirmation

- **WHEN** the user closes the dialog through any of the three routes and any detail field or participant list has been changed since it opened
- **THEN** a discard confirmation is displayed offering to continue editing or to discard the changes
- **AND** the Event dialog stays open behind it

#### Scenario: Continuing to edit

- **WHEN** the user chooses to continue editing
- **THEN** the confirmation closes
- **AND** the Event dialog remains open
- **AND** every entered value is preserved

#### Scenario: Discarding changes

- **WHEN** the user chooses to discard the changes
- **THEN** the confirmation closes
- **AND** the Event dialog closes
- **AND** the unsaved changes are discarded
- **AND** no event is created or updated

#### Scenario: A removed participant counts as an unsaved change

- **WHEN** the only change made in Edit mode is the removal of an assigned attendee or host, and the user closes the dialog
- **THEN** the discard confirmation is displayed

### Requirement: Submission states

While a create, update, or delete operation is in progress, the system SHALL indicate the in-progress state on the triggering action, SHALL prevent the operation from being submitted again, and SHALL keep the dialog open until the operation succeeds.

#### Scenario: In-progress operation

- **WHEN** a create, update, or delete operation is in progress
- **THEN** the triggering action shows a loading state
- **AND** the form's commit actions are disabled
- **AND** the dialog stays open

#### Scenario: Repeated submission is prevented

- **WHEN** the user activates the commit action repeatedly while an operation is in progress
- **THEN** only one operation is performed

#### Scenario: Actions are restored after failure

- **WHEN** an in-progress operation fails
- **THEN** the loading state ends
- **AND** the actions become available again with the entered data intact

### Requirement: User-facing error reporting

The system SHALL report failures to load events, load selectable attendees, load selectable hosts, create an event, update an event, or delete an event in clear, non-technical language that names the operation that failed, and SHALL preserve unsaved form data when it does so.

#### Scenario: Error names the failed operation

- **WHEN** any of these operations fails
- **THEN** the message states which operation failed in user-facing language
- **AND** no stack trace, internal identifier, or database detail is shown

#### Scenario: Recoverable failures can be retried

- **WHEN** a failed operation can be attempted again
- **THEN** the user is offered a way to retry it
- **AND** unsaved form data is preserved
