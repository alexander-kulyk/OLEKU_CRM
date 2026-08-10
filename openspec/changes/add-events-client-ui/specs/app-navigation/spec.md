## Purpose

Defines the application shell that surrounds every page: the persistent vertical navigation menu, how a route resolves to a page, and how the application responds to the root path and to paths that match no page.

## ADDED Requirements

### Requirement: Persistent vertical navigation

The application SHALL present a navigation menu, positioned along the left edge and laid out vertically, that remains visible on every page. The menu SHALL contain exactly three destinations, in this order: Calendar, Analytics, and Users.

#### Scenario: Menu is present on every page

- **WHEN** the user is on any page of the application
- **THEN** the left vertical menu is visible with the Calendar, Analytics, and Users entries in that order

#### Scenario: Menu entry leads to its page

- **WHEN** the user activates a menu entry
- **THEN** the application navigates to that entry's page and the main content area renders that page

### Requirement: Active destination is indicated

The navigation menu SHALL visually distinguish the entry matching the current location from the other entries.

#### Scenario: Current page is highlighted

- **WHEN** the calendar page is displayed
- **THEN** the Calendar entry is shown in its active state and the Analytics and Users entries are not

#### Scenario: Indication follows navigation

- **WHEN** the user navigates from the calendar page to the Analytics page
- **THEN** the Analytics entry becomes active and the Calendar entry ceases to be active

### Requirement: Navigation replaces content without reloading

Moving between destinations SHALL swap the rendered page within the persistent shell. The application SHALL NOT perform a full document reload, and the navigation menu SHALL NOT be re-created or lose its position.

#### Scenario: Switching pages preserves the shell

- **WHEN** the user navigates between any two destinations
- **THEN** the main content area renders the new page while the surrounding shell and menu remain mounted, with no full page reload

#### Scenario: Browser history works

- **WHEN** the user navigates to a second page and then triggers the browser's Back action
- **THEN** the application returns to the previous page and the active menu indication updates to match

### Requirement: Calendar is the main destination

The calendar SHALL be served at the path `/events`. The root path `/` SHALL resolve to the calendar rather than rendering its own content.

#### Scenario: Root resolves to the calendar

- **WHEN** the user opens the application at `/`
- **THEN** the calendar page is displayed and the address resolves to `/events`

#### Scenario: Calendar path opens directly

- **WHEN** the user opens `/events` directly
- **THEN** the calendar page is displayed with the Calendar menu entry active

### Requirement: Unmatched paths are handled

A path matching no defined page SHALL render a "not found" page inside the application shell, offering a way back to the calendar. The application SHALL NOT render a blank page, crash, or silently redirect.

#### Scenario: Unknown path renders the not-found page

- **WHEN** the user opens a path that matches no destination, such as `/nonexistent`
- **THEN** a not-found page is displayed inside the shell, the navigation menu remains visible and usable, and no menu entry is shown as active

#### Scenario: Recovery from the not-found page

- **WHEN** the user activates the recovery link on the not-found page
- **THEN** the application navigates to the calendar

### Requirement: Analytics and Users are reserved placeholders

The Analytics and Users destinations SHALL each render a placeholder page identifying itself and indicating that its content is not yet available. Neither page SHALL request data from the API.

#### Scenario: Analytics placeholder

- **WHEN** the user navigates to Analytics
- **THEN** a placeholder page is displayed identifying the Analytics area, and no API request is issued

#### Scenario: Users placeholder

- **WHEN** the user navigates to Users
- **THEN** a placeholder page is displayed identifying the Users area, and no API request is issued
