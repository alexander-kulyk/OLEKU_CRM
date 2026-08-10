## Purpose

Defines the Event dialog and the lifecycle of an event through it: the Create and Edit modes, the detail fields and their validation, creating, updating and deleting an event, the confirmations that guard destructive and discarding actions, and how failures are surfaced without losing the user's work.

## ADDED Requirements

### Requirement: Event dialog structure

The Event dialog SHALL present four sections: event details, attendees, hosts, and actions. It SHALL be presented as a modal overlay above the calendar.

#### Scenario: Dialog sections

- **WHEN** the Event dialog is open in either mode
- **THEN** it presents the event details fields, an attendees section, a hosts section, and an actions area

### Requirement: Create and Edit modes offer different actions

The dialog SHALL operate in exactly one of two modes. In Create mode it SHALL offer a Save action and SHALL NOT offer Edit or Delete. In Edit mode it SHALL offer an action that saves changes to the existing event and a Delete action, and SHALL NOT offer the Create-mode Save action.

#### Scenario: Create mode actions

- **WHEN** the dialog opens for a new event
- **THEN** a Save action is offered and no Edit or Delete action is present

#### Scenario: Edit mode actions

- **WHEN** the dialog opens for an existing event
- **THEN** an action that saves changes and a Delete action are offered, and the Create-mode Save action is not present

#### Scenario: Edit mode is populated

- **WHEN** the dialog opens for an existing event
- **THEN** the name, date, start time, end time, assigned attendees, and assigned hosts fields hold that event's current values

### Requirement: Event detail fields

The event details section SHALL provide a text input for the event name, a date input for the event date, and time inputs for the start time and the end time. All four SHALL be required.

#### Scenario: Fields are present

- **WHEN** the Event dialog is open
- **THEN** the event name, event date, start time, and end time fields are present and marked as required

#### Scenario: Entering details

- **WHEN** the user enters a name, picks a date, and picks a start and end time
- **THEN** each field displays the entered value

### Requirement: Validation gates the primary action

The dialog's primary action SHALL remain disabled while any required field is missing or invalid. The system SHALL validate that the name is present and not only whitespace, that the date and both times hold valid values, and that the end time is strictly later than the start time. Validation messages SHALL be displayed next to the field they concern.

#### Scenario: Incomplete form blocks submission

- **WHEN** any of the name, date, start time, or end time is empty
- **THEN** the primary action is disabled and the event cannot be submitted

#### Scenario: Whitespace-only name is rejected

- **WHEN** the user enters a name consisting only of whitespace
- **THEN** the name is treated as missing, a message is shown next to the name field, and the primary action is disabled

#### Scenario: End time must be later than start time

- **WHEN** the user sets an end time equal to or earlier than the start time
- **THEN** a validation message is shown next to the end time field and the primary action is disabled

#### Scenario: Valid form enables submission

- **WHEN** the name is non-blank, the date and both times are valid, and the end time is later than the start time
- **THEN** the primary action is enabled

### Requirement: Creating an event

On Save in Create mode, the system SHALL validate the form, create the event with the entered details and the assigned attendees and hosts, display it on the calendar at its date and time, and close the dialog. The stored schedule SHALL be an absolute instant derived from the entered date and time interpreted in the user's own time zone.

#### Scenario: Successful creation

- **WHEN** the user completes a valid form and selects Save
- **THEN** the event is created, the dialog closes, and the event appears on the calendar at its date and time

#### Scenario: Creation with participants

- **WHEN** the user assigns attendees and hosts before selecting Save
- **THEN** the created event carries exactly those attendees and hosts

### Requirement: Updating an event

In Edit mode the user SHALL be able to change the event name, date, start time, end time, attendee list, and host list. On confirming the change, the system SHALL validate the form, update the event, refresh its representation on the calendar, and close the dialog.

#### Scenario: Successful update

- **WHEN** the user changes one or more fields of an existing event and confirms
- **THEN** the event is updated, the dialog closes, and the calendar shows the updated representation

#### Scenario: Rescheduling moves the event

- **WHEN** the user changes an existing event's date or times and confirms
- **THEN** the event is displayed at its new date and time on the calendar and no longer at the old one

### Requirement: Deleting an event requires confirmation

Delete SHALL be offered only for an existing event and SHALL always present a confirmation that explains the event will be removed and that the action cannot be undone. The confirmation SHALL offer Cancel and Delete.

#### Scenario: Confirmation is shown

- **WHEN** the user selects Delete in Edit mode
- **THEN** a confirmation is displayed explaining that the event will be removed and cannot be recovered, offering Cancel and Delete

#### Scenario: Cancelling deletion

- **WHEN** the user selects Cancel in the delete confirmation
- **THEN** the confirmation closes, the event is unchanged, and the Event dialog remains open

#### Scenario: Confirming deletion

- **WHEN** the user confirms deletion
- **THEN** the event is deleted, it is removed from the calendar, and both the confirmation and the Event dialog close

#### Scenario: Failed deletion

- **WHEN** deletion fails
- **THEN** the event remains on the calendar, an error is displayed, and the Event dialog remains open

### Requirement: Calendar reflects a mutation without a reload

After a successful create, update, or delete, the system SHALL bring the calendar's displayed events for the currently rendered period back into agreement with the server, without requiring the user to reload the page or navigate away and back.

#### Scenario: Created event appears immediately

- **WHEN** an event is created for a date inside the rendered period
- **THEN** it is displayed on the calendar without any further user action

#### Scenario: Updated event is not stale

- **WHEN** an existing event is updated
- **THEN** the calendar shows the updated values and never the pre-update values

#### Scenario: Deleted event disappears immediately

- **WHEN** an event is deleted
- **THEN** it is no longer displayed on the calendar without any further user action

### Requirement: Submission states prevent double submission

While a create, update, or delete is in progress, the corresponding action SHALL display a loading state, further submissions SHALL be prevented, related form actions SHALL be disabled, and the dialog SHALL remain open until the operation succeeds.

#### Scenario: Loading state during submission

- **WHEN** a create, update, or delete is in progress
- **THEN** the triggering action shows a loading state and the dialog's actions are disabled

#### Scenario: Repeated activation is ignored

- **WHEN** the user activates the primary action repeatedly while a submission is in flight
- **THEN** only one operation is performed

#### Scenario: Dialog stays open until success

- **WHEN** a submission is in flight
- **THEN** the dialog remains open and closes only after the operation succeeds

### Requirement: Failures preserve entered data

When creating or updating fails, the dialog SHALL remain open with every entered value — including assigned attendees and hosts — intact, and SHALL display an error. The system SHALL NOT clear, reset, or close the form on failure.

#### Scenario: Failed creation keeps the form

- **WHEN** creating an event fails
- **THEN** the dialog remains open, an error is displayed, and all entered details and assigned participants are still present

#### Scenario: Failed update keeps the changes

- **WHEN** updating an event fails
- **THEN** the dialog remains open, an error is displayed, and the user's unsaved changes are preserved

#### Scenario: Retrying after a failure

- **WHEN** the user resubmits after a failed attempt
- **THEN** the operation is attempted again with the preserved data

### Requirement: Errors are user-facing, not technical

Every failure — loading events, loading attendee or host options, creating, updating, or deleting — SHALL be reported in clear, non-technical language that names the operation that failed. The system SHALL NOT display raw server messages, error codes, status codes, or stack traces. Because a not-found result is indistinguishable between operations at the protocol level, the message SHALL be chosen according to the operation the user performed.

#### Scenario: Non-technical message

- **WHEN** any event operation fails
- **THEN** the displayed message describes the failed operation in plain language and contains no server text, code, or status number

#### Scenario: Deleting an event that no longer exists

- **WHEN** the user deletes an event that has already been removed elsewhere
- **THEN** the message explains that the event could no longer be found, rather than reporting a generic or technical not-found condition

#### Scenario: Rejected participant

- **WHEN** a save fails because an assigned participant is not eligible
- **THEN** the message explains in plain language that a selected participant cannot be assigned, and the entered data is preserved

### Requirement: Closing the dialog protects unsaved work

The dialog SHALL be closable via a close control, an outside click, and the Escape key. If the form holds no unsaved changes, it SHALL close immediately. If it holds unsaved changes, the system SHALL present a discard confirmation offering Continue editing and Discard changes, for all three closing routes alike.

#### Scenario: Clean form closes immediately

- **WHEN** the user closes a dialog with no unsaved changes by any route
- **THEN** the dialog closes without a confirmation and nothing is created or updated

#### Scenario: Dirty form prompts on close control

- **WHEN** the user selects the close control while the form holds unsaved changes
- **THEN** a discard confirmation is displayed offering Continue editing and Discard changes

#### Scenario: Dirty form prompts on outside click

- **WHEN** the user clicks outside the dialog while the form holds unsaved changes
- **THEN** the same discard confirmation is displayed

#### Scenario: Dirty form prompts on Escape

- **WHEN** the user presses Escape while the form holds unsaved changes
- **THEN** the same discard confirmation is displayed

#### Scenario: Continue editing

- **WHEN** the user selects Continue editing
- **THEN** the confirmation closes, the dialog remains open, and every entered value is preserved

#### Scenario: Discard changes

- **WHEN** the user selects Discard changes
- **THEN** the confirmation closes, the dialog closes, the changes are discarded, and nothing is created or updated

### Requirement: An open event that disappears is handled

If the event open in Edit mode is no longer present after the calendar's events are refreshed — for example because it was deleted elsewhere or moved out of the rendered period — the system SHALL keep the dialog open with the user's entered values intact and SHALL NOT close it, blank it, or silently switch it to Create mode.

#### Scenario: Underlying event vanishes

- **WHEN** the events for the rendered period are refreshed and the event open in Edit mode is absent from the result
- **THEN** the dialog stays open in Edit mode with the user's entered values unchanged

#### Scenario: Saving an event that no longer exists

- **WHEN** the user confirms changes to an event that has since been deleted
- **THEN** the save fails, a plain-language message explains the event could no longer be found, and the entered data is preserved
