## Purpose

The calendar surface of the Events page: it shows scheduled events on a month, week, or day grid, lets a business user move between time periods, and provides the entry points that open an event for creation or editing.

## ADDED Requirements

### Requirement: Events page displays a calendar

The system SHALL provide an Events page that displays a calendar of scheduled events. The calendar SHALL open on the period containing the current date.

#### Scenario: Opening the Events page

- **WHEN** a user navigates to the Events page
- **THEN** a calendar is displayed
- **AND** the visible period contains the current date
- **AND** the current date is visually distinguishable from other dates

#### Scenario: Events load for the visible period

- **WHEN** the calendar displays a period
- **THEN** every event that overlaps that period is requested and rendered

### Requirement: Calendar view switching

The calendar SHALL support month, week, and day views, and the user SHALL be able to switch between them without leaving the page.

#### Scenario: Switching to week view

- **WHEN** the user selects the week view
- **THEN** the calendar renders a week grid covering the week containing the currently focused date
- **AND** the page is not reloaded or navigated away from

#### Scenario: Switching to day view

- **WHEN** the user selects the day view
- **THEN** the calendar renders a single-day grid for the currently focused date

#### Scenario: Switching to month view

- **WHEN** the user selects the month view
- **THEN** the calendar renders a month grid for the month containing the currently focused date

#### Scenario: Focused date is preserved across views

- **WHEN** the user navigates to a period other than the current one and then switches view
- **THEN** the new view shows the period containing the previously focused date, not the current date

### Requirement: Event rendering

The calendar SHALL render each existing event on the date it occurs, and in time-based views SHALL position it according to its start and end times.

#### Scenario: Event shown in a time-based view

- **WHEN** an event starting at 14:00 and ending at 15:30 is displayed in week or day view
- **THEN** the event is rendered on its date spanning the 14:00–15:30 range

#### Scenario: Event shown in month view

- **WHEN** an event is displayed in month view
- **THEN** the event appears on its date and its name is visible

#### Scenario: Period with no events

- **WHEN** the visible period contains no events
- **THEN** the calendar renders the empty period without error

### Requirement: Period navigation

The user SHALL be able to navigate to the previous period, the next period, and back to the current date. The size of a period step SHALL follow the active view: months in month view, weeks in week view, and days in day view.

#### Scenario: Navigating to the next period in month view

- **WHEN** the calendar is in month view and the user selects next
- **THEN** the calendar displays the following month
- **AND** the events for that month are displayed

#### Scenario: Navigating to the previous period in week view

- **WHEN** the calendar is in week view and the user selects previous
- **THEN** the calendar displays the preceding week

#### Scenario: Navigating in day view

- **WHEN** the calendar is in day view and the user selects next or previous
- **THEN** the calendar moves forward or backward by one day

#### Scenario: Returning to the current date

- **WHEN** the user selects the action that returns to today
- **THEN** the calendar displays the period containing the current date in the active view

### Requirement: Opening an event from the calendar

Selecting an existing event in the calendar SHALL open the Event dialog for that event in Edit mode.

#### Scenario: Selecting an existing event

- **WHEN** the user selects an event rendered in the calendar
- **THEN** the Event dialog opens in Edit mode for that event

### Requirement: Starting event creation from the calendar

Selecting an empty date or time slot in the calendar SHALL open the Event dialog in Create mode, prefilled with the date and, where the selection identifies a time, the start time implied by the selection.

#### Scenario: Selecting a time slot in a time-based view

- **WHEN** the user selects an empty slot beginning at 10:00 on a given date in week or day view
- **THEN** the Event dialog opens in Create mode
- **AND** the event date is prefilled with the selected date
- **AND** the start time is prefilled with 10:00

#### Scenario: Selecting a date in month view

- **WHEN** the user selects an empty date cell in month view
- **THEN** the Event dialog opens in Create mode
- **AND** the event date is prefilled with the selected date

### Requirement: Calendar reflects committed event changes

After an event is successfully created, updated, or deleted, the calendar SHALL reflect the change without requiring a page reload.

#### Scenario: Created event appears

- **WHEN** an event is created successfully for a date inside the visible period
- **THEN** the event appears in the calendar at its date and time range

#### Scenario: Updated event moves

- **WHEN** an existing event's date or times are changed successfully
- **THEN** the event is rendered at its new position and no longer at the old one

#### Scenario: Deleted event disappears

- **WHEN** an event is deleted successfully
- **THEN** the event is removed from the calendar

### Requirement: Calendar loading and failure states

The calendar SHALL indicate when events are being loaded and SHALL report a failure to load events in user-facing language, without exposing technical detail, and SHALL offer a way to retry.

#### Scenario: Events are loading

- **WHEN** events for the visible period are being requested
- **THEN** the calendar indicates that loading is in progress

#### Scenario: Loading events fails

- **WHEN** the request for the visible period's events fails
- **THEN** a user-facing message explains that events could not be loaded
- **AND** no technical or internal error detail is shown
- **AND** the user is offered a retry action
