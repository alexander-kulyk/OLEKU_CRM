## Purpose

Defines the Event dialog through which business users create, update, and delete scheduled events, including the event detail fields, their validation rules, and the confirmations that protect against accidental deletion or loss of unsaved work.

## ADDED Requirements

### Requirement: Event dialog modes

The Event dialog SHALL operate in exactly one of two modes. Create mode represents a new event and MUST display the Save action while hiding the Edit and Delete actions. Edit mode represents an existing persisted event and MUST display the Edit and Delete actions while hiding the Save action.

The Edit action label denotes saving changes to an existing event; the visible wording MAY differ, but the underlying action MUST remain event updating.

#### Scenario: Create mode actions

- **WHEN** the Event dialog is open in Create mode
- **THEN** the Save action is displayed
- **AND** the Edit action is not displayed
- **AND** the Delete action is not displayed

#### Scenario: Edit mode actions

- **WHEN** the Event dialog is open in Edit mode
- **THEN** the Edit action is displayed
- **AND** the Delete action is displayed
- **AND** the Save action is not displayed

### Requirement: Event dialog sections

The Event dialog SHALL present the event details, attendees, hosts, and actions sections.

#### Scenario: Dialog structure

- **WHEN** the Event dialog is open in either mode
- **THEN** the dialog presents an event details section, an attendees section, a hosts section, and an actions section

### Requirement: Event detail fields

The event details section SHALL provide four required fields: event name as a text input, event date as a date picker, start time as a time picker, and end time as a time picker. The date and time controls MUST let the user pick a date and pick an hour and a minute respectively, and MUST display the chosen value in the field once selected.

Dates and times MAY be displayed in the user's locale format, and MUST be stored in a standardized format.

#### Scenario: Entering an event name

- **WHEN** the user types into the event name field
- **THEN** the entered text is displayed in the field

#### Scenario: Selecting an event date

- **WHEN** the user opens the date field's picker and selects a date
- **THEN** the picker closes
- **AND** the selected date is displayed in the field

#### Scenario: Selecting a start time

- **WHEN** the user opens the start time field's picker and selects an hour and a minute
- **THEN** the picker closes
- **AND** the selected time is displayed in the start time field

#### Scenario: Selecting an end time

- **WHEN** the user opens the end time field's picker and selects an hour and a minute
- **THEN** the picker closes
- **AND** the selected time is displayed in the end time field

### Requirement: Required field validation

The system SHALL treat event name, event date, start time, and end time as required. The event name MUST NOT be empty or consist only of whitespace, and the date, start time, and end time MUST each contain a valid value. The dialog's primary action — Save in Create mode, Edit in Edit mode — MUST be disabled while any required field is missing or invalid. Validation messages MUST be displayed adjacent to the field they concern.

#### Scenario: Primary action disabled while a field is missing

- **WHEN** any of event name, event date, start time, or end time is empty
- **THEN** the dialog's primary action is disabled

#### Scenario: Whitespace-only name is rejected

- **WHEN** the event name contains only whitespace characters
- **THEN** the name field displays a validation message
- **AND** the dialog's primary action is disabled

#### Scenario: Primary action enabled once all required fields are valid

- **WHEN** all four required fields hold valid values
- **THEN** the dialog's primary action is enabled

#### Scenario: Validation message placement

- **WHEN** a field fails validation
- **THEN** the corresponding message is displayed next to that field

### Requirement: End time must follow start time

The system SHALL require the end time to be later than the start time. If the end time equals or precedes the start time, the form MUST display a validation error and MUST NOT allow the event to be created or updated.

#### Scenario: End time earlier than start time

- **WHEN** the end time is earlier than the start time
- **THEN** a validation message is displayed
- **AND** the dialog's primary action is disabled

#### Scenario: End time equal to start time

- **WHEN** the end time equals the start time
- **THEN** a validation message is displayed
- **AND** the dialog's primary action is disabled

#### Scenario: End time later than start time

- **WHEN** the end time is later than the start time
- **THEN** no end-time validation message is displayed

### Requirement: Creating an event

When the user confirms Save in Create mode, the system SHALL validate the form, create the event, assign the selected attendees and hosts, display the event in the calendar at its scheduled date and time, and close the dialog once the operation succeeds.

#### Scenario: Successful creation

- **WHEN** the user selects Save with a valid form in Create mode
- **THEN** the event is created with the entered name, date, start time, and end time
- **AND** the selected attendees and hosts are assigned to it
- **AND** the event is displayed in the calendar at its scheduled date and time
- **AND** the Event dialog closes

#### Scenario: Failed creation preserves the form

- **WHEN** creating the event fails
- **THEN** the Event dialog remains open
- **AND** an error message is displayed
- **AND** every entered value, including selected attendees and hosts, is preserved

### Requirement: Updating an event

When the user confirms Edit in Edit mode, the system SHALL validate the form, update the existing event, update its attendee and host assignments, refresh the event's representation in the calendar, and close the dialog once the operation succeeds. The user MUST be able to modify the event name, date, start time, end time, attendee list, and host list.

#### Scenario: Existing values are populated

- **WHEN** the Event dialog opens in Edit mode
- **THEN** the name, date, start time, end time, assigned attendees, and assigned hosts are populated from the stored event

#### Scenario: Successful update

- **WHEN** the user selects Edit with a valid form in Edit mode
- **THEN** the event is updated with the current form values
- **AND** its attendee and host assignments are updated to match the form
- **AND** the calendar reflects the updated event
- **AND** the Event dialog closes

#### Scenario: Failed update preserves the changes

- **WHEN** updating the event fails
- **THEN** the Event dialog remains open
- **AND** an error message is displayed
- **AND** the user's modified values are preserved

### Requirement: Deleting an event requires confirmation

The Delete action SHALL be available only for an existing event. Selecting Delete MUST open a confirmation dialog that states the event will be removed and that the action cannot be undone, offering a Cancel action and a Delete action.

#### Scenario: Delete opens a confirmation

- **WHEN** the user selects Delete in Edit mode
- **THEN** a confirmation dialog opens explaining that the event will be removed and cannot be recovered
- **AND** the confirmation offers a Cancel action and a Delete action

#### Scenario: Delete is unavailable for a new event

- **WHEN** the Event dialog is open in Create mode
- **THEN** no Delete action is available

#### Scenario: Cancelling the confirmation

- **WHEN** the user selects Cancel in the delete confirmation
- **THEN** the confirmation dialog closes
- **AND** the event is unchanged
- **AND** the Event dialog remains open

#### Scenario: Confirming deletion

- **WHEN** the user selects Delete in the confirmation dialog
- **THEN** the event is deleted
- **AND** the event is removed from the calendar
- **AND** the confirmation dialog closes
- **AND** the Event dialog closes

#### Scenario: Failed deletion

- **WHEN** deleting the event fails
- **THEN** the event remains in the calendar
- **AND** an error message is displayed
- **AND** the Event dialog remains open

### Requirement: Closing the Event dialog

The user SHALL be able to close the Event dialog by selecting the close icon, selecting outside the dialog, or pressing Escape. When the form holds no unsaved changes, the dialog MUST close immediately.

#### Scenario: Closing via the close icon with no changes

- **WHEN** the user selects the close icon and the form has no unsaved changes
- **THEN** the Event dialog closes immediately

#### Scenario: Closing via outside click with no changes

- **WHEN** the user selects an area outside the dialog and the form has no unsaved changes
- **THEN** the Event dialog closes immediately

#### Scenario: Closing via Escape with no changes

- **WHEN** the user presses Escape and the form has no unsaved changes
- **THEN** the Event dialog closes immediately

### Requirement: Unsaved changes are protected on close

When the user attempts to close the Event dialog while it holds unsaved changes, the system SHALL display a discard confirmation offering Continue editing and Discard changes. This MUST apply to closing via the close icon, an outside click, and Escape.

#### Scenario: Discard confirmation appears

- **WHEN** the user attempts to close the dialog after entering or modifying information that has not been saved
- **THEN** a discard confirmation is displayed
- **AND** the confirmation offers a Continue editing action and a Discard changes action

#### Scenario: Continue editing

- **WHEN** the user selects Continue editing
- **THEN** the confirmation closes
- **AND** the Event dialog remains open
- **AND** all entered information is preserved

#### Scenario: Discard changes

- **WHEN** the user selects Discard changes
- **THEN** the confirmation closes
- **AND** the Event dialog closes
- **AND** the unsaved changes are discarded
- **AND** no event is created or updated

#### Scenario: Protection applies to every close route

- **WHEN** the user attempts to close a dialog with unsaved changes via the close icon, an outside click, or Escape
- **THEN** the discard confirmation is displayed in each case

### Requirement: Submission states

While an event is being created, updated, or deleted, the system SHALL display a loading state on the corresponding action, prevent repeated submission of the same operation, disable the dialog's other actions, and keep the dialog open until the operation succeeds.

#### Scenario: Loading state during submission

- **WHEN** a create, update, or delete operation is in progress
- **THEN** the corresponding action displays a loading state
- **AND** the dialog's other actions are disabled

#### Scenario: Repeated submission is prevented

- **WHEN** the user activates the primary action again while a submission is in progress
- **THEN** no additional request is issued

#### Scenario: Dialog stays open until success

- **WHEN** an operation is in progress
- **THEN** the Event dialog remains open

#### Scenario: Data survives a failed submission

- **WHEN** an in-progress operation fails
- **THEN** the loading state ends
- **AND** the user's entered data remains available in the form

### Requirement: User-facing error messages

The system SHALL handle failures when loading events, loading available attendees, loading available hosts, and creating, updating, or deleting an event. Every resulting message MUST use clear non-technical language, state which operation failed, omit technical implementation detail, allow the user to retry where the operation is retryable, and leave unsaved form data intact.

#### Scenario: Error identifies the failed operation

- **WHEN** any of these operations fails
- **THEN** the displayed message states which operation failed in plain language

#### Scenario: Errors omit technical detail

- **WHEN** an error message is displayed
- **THEN** it contains no stack trace, exception name, status code, or raw server payload

#### Scenario: Retry is offered

- **WHEN** a failed operation can be retried
- **THEN** the user is offered a way to retry it

#### Scenario: Form data survives an error

- **WHEN** an error is displayed while the Event dialog is open
- **THEN** the unsaved form data remains intact
