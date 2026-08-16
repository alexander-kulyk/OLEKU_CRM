# event-calendar Specification

## Purpose

Defines the calendar surface on the Events page: the month, week, and day views, how the user moves between periods, how events for the visible period are loaded and rendered, and the interactions that open the Event dialog.

## Requirements

### Requirement: Calendar opens on the current period

On first display, the calendar SHALL show the period containing the current date, in month view.

#### Scenario: Initial display

- **WHEN** the user opens the calendar page
- **THEN** the month containing today is displayed, its dates are laid out, and the period title names that month and year

#### Scenario: Today is distinguishable

- **WHEN** the displayed period contains the current date
- **THEN** the cell for the current date is visually distinguished from the other cells

### Requirement: Three calendar views

The calendar SHALL provide month, week, and day views, and the user SHALL be able to switch between them without leaving the page. The control SHALL indicate which view is active.

#### Scenario: Switching to week view

- **WHEN** the user selects the Week view while a date is in focus
- **THEN** the calendar displays the week containing that date and the Week option is indicated as active

#### Scenario: Switching to day view

- **WHEN** the user selects the Day view while a date is in focus
- **THEN** the calendar displays that single day and the Day option is indicated as active

#### Scenario: Focused date survives a view change

- **WHEN** the user navigates to a period other than the current one and then changes the view
- **THEN** the new view displays the period containing the date that was in focus, not the period containing today

### Requirement: Period navigation

The calendar SHALL provide previous, next, and Today actions. The step taken by previous and next SHALL match the active view: one month in month view, one week in week view, and one day in day view. Today SHALL return the calendar to the period containing the current date without changing the active view.

#### Scenario: Next in month view

- **WHEN** the user selects Next in month view
- **THEN** the calendar displays the following month and the period title updates to name it

#### Scenario: Previous in week view

- **WHEN** the user selects Previous in week view
- **THEN** the calendar displays the preceding week

#### Scenario: Next in day view

- **WHEN** the user selects Next in day view
- **THEN** the calendar displays the following day

#### Scenario: Returning to today

- **WHEN** the user has navigated away from the current period and selects Today
- **THEN** the calendar displays the period containing the current date and the active view is unchanged

### Requirement: Events are loaded for the rendered period

Whenever the rendered period changes — through previous, next, Today, a view change, or first display — the system SHALL request events for the period actually rendered, not the nominal calendar period. In month view the rendered period includes the leading and trailing days of adjacent months that occupy the grid.

The request SHALL carry exactly two parameters, a period start and a period end, each an unambiguous instant that states its time zone. The system SHALL NOT send any additional parameter: the API rejects unrecognised parameters outright, which would surface to the user as an empty calendar rather than as an error.

#### Scenario: Loading on first display

- **WHEN** the calendar is first displayed
- **THEN** one request for events is issued whose period covers the rendered grid, and the returned events are displayed

#### Scenario: Loading on period navigation

- **WHEN** the user navigates to another period
- **THEN** a request is issued for the newly rendered period and the calendar displays the events it returns

#### Scenario: Adjacent-month days are populated

- **WHEN** month view renders leading or trailing days belonging to the neighbouring months
- **THEN** events falling on those days are displayed, because the requested period covers the whole rendered grid

#### Scenario: No extraneous parameters

- **WHEN** any event request is issued
- **THEN** it carries only the period start and period end, and the API accepts it

### Requirement: All events in the period are displayed

The system SHALL display every event the API returns for the rendered period. No event lifecycle or status filter SHALL be applied, and no status parameter SHALL be sent, because events carry no such attribute.

#### Scenario: Every returned event appears

- **WHEN** the API returns events for the rendered period
- **THEN** each one is displayed at its own date and time, with none omitted

### Requirement: Events render appropriately per view

An event SHALL be rendered in each view in a form suited to that view: in month view as a compact entry within its day cell showing at least its start time and name; in week and day views positioned against a time axis so that its placement and extent express its start and end times.

#### Scenario: Month view rendering

- **WHEN** an event falls within the displayed month
- **THEN** it appears inside the cell for its date as a compact entry showing its start time and name

#### Scenario: Week view rendering

- **WHEN** an event falls within the displayed week
- **THEN** it appears in the column for its day, positioned against the time axis so that its start and end times are conveyed by its placement and extent

#### Scenario: Day view rendering

- **WHEN** an event falls on the displayed day
- **THEN** it appears against that day's time axis, positioned by its start time and extending to its end time

### Requirement: Loading and failure states for the period read

While events for a period are being loaded, the system SHALL indicate that loading is in progress. If the read fails, the system SHALL display a clear, non-technical message explaining that events could not be loaded and SHALL offer a way to retry. The system SHALL NOT display a raw server message and SHALL NOT present a failed load as an empty period.

#### Scenario: Loading indication

- **WHEN** a request for a period's events is in flight
- **THEN** the calendar indicates that events are loading

#### Scenario: Failed load

- **WHEN** the request for a period's events fails
- **THEN** a user-facing message states that events could not be loaded, a retry action is offered, and no technical detail from the server is shown

#### Scenario: Retry after failure

- **WHEN** the user selects retry after a failed load
- **THEN** the request for the same period is issued again and, on success, the events are displayed

### Requirement: Selecting an empty slot starts event creation

Selecting a date cell or time slot that is not occupied by an existing event SHALL open the Event dialog in Create mode, prefilled from the selection: the selected date in every view, and additionally the selected start time in week and day views.

#### Scenario: Empty cell in month view

- **WHEN** the user selects an empty day cell in month view
- **THEN** the Event dialog opens in Create mode with the event date prefilled to that date

#### Scenario: Empty slot in week view

- **WHEN** the user selects an empty time slot in week view
- **THEN** the Event dialog opens in Create mode with the event date prefilled to that day and the start time prefilled to that slot's time

#### Scenario: Empty slot in day view

- **WHEN** the user selects an empty time slot in day view
- **THEN** the Event dialog opens in Create mode with the event date prefilled to the displayed day and the start time prefilled to that slot's time

### Requirement: Selecting an existing event opens it

Selecting an event already displayed on the calendar SHALL open the Event dialog in Edit mode, populated with that event's current details, in any view. Selecting an event SHALL NOT start creation of a new one.

#### Scenario: Opening an event

- **WHEN** the user selects an event displayed on the calendar
- **THEN** the Event dialog opens in Edit mode populated with that event's name, date, start time, end time, attendees, and hosts

#### Scenario: Selecting an event does not create one

- **WHEN** the user selects an existing event in any view
- **THEN** the dialog does not open in Create mode and no empty-slot selection is registered
