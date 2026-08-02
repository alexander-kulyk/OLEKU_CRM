## Purpose

Gives business users a calendar view of everything scheduled — lessons, meetings, consultations, and other events — with month, week, and day perspectives, period navigation, and the entry points for opening or creating an event.

## ADDED Requirements

### Requirement: Events page displays a calendar

The Events page SHALL display an event calendar. On first render the calendar MUST show the period containing the current date.

#### Scenario: Opening the Events page

- **WHEN** a user navigates to the Events page
- **THEN** a calendar is displayed
- **AND** the visible period contains the current date

### Requirement: Calendar view switching

The calendar SHALL support month, week, and day views. The user MUST be able to switch between them without leaving the Events page, and the newly selected view MUST remain anchored to the currently displayed date.

#### Scenario: Switching to week view

- **WHEN** the user selects the week view while a date is displayed in month view
- **THEN** the calendar renders the week containing that date
- **AND** the user remains on the Events page

#### Scenario: Switching to day view

- **WHEN** the user selects the day view
- **THEN** the calendar renders a single day containing the currently displayed date

#### Scenario: Switching to month view

- **WHEN** the user selects the month view
- **THEN** the calendar renders the month containing the currently displayed date

### Requirement: Period navigation

The calendar SHALL provide previous, next, and today navigation. The step size of previous and next MUST match the active view: months in month view, weeks in week view, and days in day view.

#### Scenario: Navigating to the previous period in month view

- **WHEN** the user selects previous while month view is active
- **THEN** the calendar displays the preceding month

#### Scenario: Navigating to the next period in week view

- **WHEN** the user selects next while week view is active
- **THEN** the calendar displays the following week

#### Scenario: Navigating to the next period in day view

- **WHEN** the user selects next while day view is active
- **THEN** the calendar displays the following day

#### Scenario: Returning to the current date

- **WHEN** the user selects today after navigating away from the current period
- **THEN** the calendar displays the period containing the current date

### Requirement: Existing events are rendered in the calendar

The calendar SHALL display the events that fall within the visible period, each positioned on its own date and, in week and day views, within its start-to-end time range. Each rendered event MUST show its name.

#### Scenario: Event appears on its scheduled date

- **WHEN** an event exists on a date inside the visible period
- **THEN** the calendar renders that event on that date
- **AND** the rendered event shows the event name

#### Scenario: Event occupies its time range

- **WHEN** an event is displayed in week or day view
- **THEN** the event occupies the region between its start time and end time

#### Scenario: Navigating loads events for the new period

- **WHEN** the user navigates to a period that has not been displayed yet
- **THEN** the calendar displays the events scheduled within that period

#### Scenario: Period with no events

- **WHEN** the visible period contains no events
- **THEN** the calendar renders without any events and without an error

### Requirement: Opening an existing event from the calendar

Selecting an event in the calendar SHALL open the Event dialog in Edit mode for that event.

#### Scenario: Selecting a calendar event

- **WHEN** the user selects an event displayed in the calendar
- **THEN** the Event dialog opens in Edit mode
- **AND** the dialog is populated with that event's stored information

### Requirement: Initiating event creation from the calendar

Selecting an empty date or time slot in the calendar SHALL open the Event dialog in Create mode. Where the selected slot identifies a date, the date field MUST be prefilled with it; where the slot also identifies a time, the start time field MUST be prefilled with it.

#### Scenario: Selecting a date in month view

- **WHEN** the user selects an empty date in month view
- **THEN** the Event dialog opens in Create mode
- **AND** the event date field is prefilled with the selected date

#### Scenario: Selecting a time slot in week or day view

- **WHEN** the user selects an empty time slot in week or day view
- **THEN** the Event dialog opens in Create mode
- **AND** the event date field is prefilled with the slot's date
- **AND** the start time field is prefilled with the slot's time

### Requirement: Calendar reflects completed event operations

After an event is successfully created, updated, or deleted, the calendar SHALL reflect the result without requiring a page reload.

#### Scenario: Created event appears

- **WHEN** an event is successfully created for a date inside the visible period
- **THEN** the calendar displays the new event at its scheduled date and time

#### Scenario: Updated event moves

- **WHEN** an existing event's date or time is successfully changed
- **THEN** the calendar displays the event at its new position
- **AND** the event no longer appears at its previous position

#### Scenario: Deleted event disappears

- **WHEN** an event is successfully deleted
- **THEN** the calendar no longer displays that event

### Requirement: Event loading failure is surfaced

When loading the events for the visible period fails, the system SHALL display a user-facing error that identifies the failed operation without exposing technical details, and MUST offer the user a way to retry.

#### Scenario: Loading events fails

- **WHEN** the request for the visible period's events fails
- **THEN** the page displays an error message describing that events could not be loaded
- **AND** the message contains no stack trace, status code, or other technical detail
- **AND** a retry action is available

#### Scenario: Retrying after a load failure

- **WHEN** the user selects the retry action and the request then succeeds
- **THEN** the error message is dismissed
- **AND** the calendar displays the events for the visible period
