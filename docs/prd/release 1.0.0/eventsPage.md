# Events Page — Product Requirements

## 1. Purpose

The Events page provides authorized business users with a calendar interface for creating, viewing, updating, and deleting scheduled events.

An event may represent a lesson, meeting, consultation, appointment, or another scheduled business activity.

The page must also allow users to assign attendees and hosts to an event.

User permissions and access rules for the Events page will be defined in a separate authorization and roles document.

---

## 2. Scope

The Events page includes:

- calendar navigation;
- day, week, and month calendar views;
- event creation;
- event editing;
- event deletion;
- attendee management;
- host management;
- required-field validation;
- confirmation before discarding unsaved changes;
- confirmation before deleting an event.

The following functionality is outside the scope of this document:

- role-based permissions;
- notifications;
- recurring events;
- event reminders;
- calendar integrations;
- video-meeting integrations;
- attendance tracking.

These capabilities may be described in separate requirements.

---

## 3. Events Page

When the user navigates to the Events page, the system must display an event calendar.

The calendar must support the following views:

- month;
- week;
- day.

The user must be able to switch between these views without leaving the page.

The calendar must display existing events in their corresponding dates and time ranges.

The calendar should initially display the current date period unless another navigation rule is defined later.

---

## 4. Calendar Navigation

The user must be able to:

- switch between month, week, and day views;
- navigate to the previous period;
- navigate to the next period;
- return to the current date;
- open an existing event;
- initiate event creation from a calendar date or time slot.

The meaning of the previous and next actions depends on the selected calendar view:

- in month view, navigate between months;
- in week view, navigate between weeks;
- in day view, navigate between days.

---

## 5. Creating an Event

### 5.1 Opening the event form

The user can start creating an event by selecting a date or time slot in the calendar.

After the selection, the system must open an **Event dialog**.

The dialog represents a new event and must initially be in **Create mode**.

Where the calendar provides a specific date or time through the selected slot, the system should prefill the corresponding date and start-time fields.

### 5.2 Create-mode actions

In Create mode, the dialog must display:

- **Save** button.

The following buttons must not be displayed:

- Edit;
- Delete.

### 5.3 Saving an event

The user can save the event only after completing all required fields.

After the user selects **Save**, the system must:

1. validate the form;
2. create the event;
3. assign the selected attendees;
4. assign the selected hosts;
5. display the event in the appropriate calendar date and time;
6. close the Event dialog after a successful operation.

If creation fails, the dialog must remain open and the system must display an error without losing the entered information.

---

## 6. Viewing and Editing an Existing Event

### 6.1 Opening an existing event

The user can select an existing event in the calendar.

The system must open the Event dialog in **Edit mode** and populate it with the current event information.

### 6.2 Edit-mode actions

In Edit mode, the dialog must display:

- **Edit** button;
- **Delete** button.

The **Save** button must not be displayed.

The label `Edit` represents the action of saving changes to an existing event. A more conventional UI label such as `Save changes` or `Update event` may be selected during UI design, while the underlying business action remains event updating.

### 6.3 Updating an event

The user can modify:

- event name;
- event date;
- start time;
- end time;
- attendee list;
- host list.

After selecting **Edit**, the system must:

1. validate the form;
2. update the existing event;
3. update attendee assignments;
4. update host assignments;
5. refresh the event representation in the calendar;
6. close the dialog after a successful operation.

If updating fails, the dialog must remain open and the system must preserve the entered changes.

---

## 7. Deleting an Event

The Delete action is available only for an existing event.

When the user selects **Delete**, the system must display a confirmation dialog before performing the deletion.

The confirmation should clearly explain that the event will be removed.

Example:

> Are you sure you want to delete this event? This action cannot be undone.

The confirmation dialog must provide:

- **Cancel**;
- **Delete**.

If the user selects Cancel:

- the confirmation dialog closes;
- the event remains unchanged;
- the Event dialog remains open.

If the user confirms deletion:

1. the system deletes the event;
2. the event is removed from the calendar;
3. the confirmation dialog closes;
4. the Event dialog closes.

If deletion fails:

- the event must remain in the calendar;
- the system must display an error;
- the Event dialog should remain open.

---

## 8. Event Form

The Event dialog must contain the following sections:

1. Event details;
2. Attendees;
3. Hosts;
4. Actions.

---

## 9. Event Details

### 9.1 Event name

**Control:** Text input
**Required:** Yes

The user must be able to enter a descriptive name for the event.

Examples:

- Mathematics lesson;
- Parent meeting;
- English consultation;
- Team planning session.

The value must not consist only of whitespace.

Any maximum length limitation should be defined as part of the data validation specification.

---

### 9.2 Event date

**Control:** Date picker
**Required:** Yes

When the user selects the field or its calendar icon, the system must open a date picker.

After the user selects a date:

- the date picker closes;
- the selected date is displayed in the field;
- the selected date becomes part of the event schedule.

The display format may depend on the user’s locale, while the system should store the date in a standardized format.

---

### 9.3 Start time

**Control:** Time picker
**Required:** Yes

When the user selects the field or its time icon, the system must open a time-selection interface.

The user must be able to select:

- hour;
- minute.

After the user selects both values and confirms the selection:

- the time picker closes;
- the selected time is displayed in the Start time field.

---

### 9.4 End time

**Control:** Time picker
**Required:** Yes

The End time field must follow the same interaction rules as the Start time field.

The user must be able to select:

- hour;
- minute.

After confirmation, the selected time must be displayed in the field.

The end time must be later than the start time.

If the end time is equal to or earlier than the start time, the form must display a validation error and must not allow the event to be saved or updated.

---

## 10. Attendees Section

The Attendees section allows the user to assign previously registered customers or other eligible participants to an event.

### 10.1 Attendee selector

The section must contain a searchable multi-select control.

The control must display attendees who are already registered in the system.

The user must be able to:

- open the attendee list;
- search for an attendee;
- select one attendee;
- select multiple attendees;
- clear an unconfirmed selection.

An attendee who is already assigned to the event must not be added twice.

### 10.2 Adding attendees

The section must contain an **Add** button.

After selecting one or more attendees and selecting Add:

- the selected attendees are added to the event attendee list;
- the selector is cleared;
- duplicate attendees are not created.

The Add button should be disabled when no attendee is selected.

### 10.3 Assigned attendee list

Each assigned attendee must be displayed as a separate list item, chip, or tag.

Each item must display:

- attendee name;
- remove icon.

Additional attendee information, such as email or avatar, may be displayed if required by the future UI design.

### 10.4 Removing an attendee

When the user selects the remove icon next to an attendee:

- the attendee is removed from the event’s attendee list in the form;
- the event itself remains open;
- other attendees remain unchanged.

For an existing event, this change becomes persistent only after the user saves the event update.

---

## 11. Hosts Section

The Hosts section allows the user to assign employees or other eligible business representatives responsible for the event.

The section must follow the same interaction model as the Attendees section.

### 11.1 Host selector

The section must contain a searchable multi-select control populated with previously registered eligible hosts.

The user must be able to:

- search for a host;
- select one host;
- select multiple hosts;
- add selected hosts to the event;
- remove assigned hosts.

A host who is already assigned to the event must not be added twice.

### 11.2 Adding hosts

The user selects one or more hosts and selects **Add**.

The system then:

- adds the selected hosts to the assigned host list;
- clears the selector;
- prevents duplicate assignments.

The Add button should be disabled when no host is selected.

### 11.3 Removing hosts

Each assigned host must have a remove icon.

Selecting the icon removes that host from the event form.

For an existing event, the removal becomes persistent only after the event update is successfully saved.

---

## 12. Form Validation

The following fields are required:

- Event name;
- Event date;
- Start time;
- End time.

The Save button in Create mode and the Edit button in Edit mode must be disabled while any required field is missing or invalid.

The form must also validate that:

- the event name is not empty or whitespace-only;
- the date contains a valid value;
- the start time contains a valid value;
- the end time contains a valid value;
- the end time is later than the start time;
- the same attendee is not assigned more than once;
- the same host is not assigned more than once.

Validation messages should be displayed near the corresponding fields.

Attendees and hosts are optional unless another business rule defines minimum participation requirements.

---

## 13. Closing the Event Dialog

The user must be able to close the Event dialog by:

- selecting the close icon in the upper-right corner;
- selecting an area outside the dialog;
- pressing the Escape key, where supported.

### 13.1 Closing without unsaved changes

If the form contains no unsaved changes, the dialog closes immediately.

### 13.2 Closing with unsaved changes

If the user has created or modified information that has not been saved, the system must display a discard confirmation.

Example:

> You have unsaved changes. Are you sure you want to discard them?

The confirmation must provide:

- **Continue editing**;
- **Discard changes**.

If the user selects Continue editing:

- the confirmation closes;
- the Event dialog remains open;
- all entered information is preserved.

If the user selects Discard changes:

- the confirmation closes;
- the Event dialog closes;
- unsaved changes are discarded;
- no data is created or updated.

This behavior applies to closing through:

- the close icon;
- outside click;
- Escape key.

---

## 14. Event Dialog States

The Event dialog has two primary states.

### Create mode

Conditions:

- no existing event is being edited;
- the form represents a new event.

Available primary action:

- Save.

Hidden actions:

- Edit;
- Delete.

### Edit mode

Conditions:

- an existing event has been opened;
- the form contains persisted event information.

Available actions:

- Edit or Save changes;
- Delete.

Hidden action:

- Save for new event creation.

---

## 15. Loading and Submission States

While an event is being created, updated, or deleted:

- the corresponding action button must display a loading state;
- repeated submission must be prevented;
- relevant form actions should be temporarily disabled;
- the dialog must not close until the operation succeeds.

The user’s entered data must remain available if the operation fails.

---

## 16. Error Handling

The system must handle failures for:

- loading events;
- loading available attendees;
- loading available hosts;
- creating an event;
- updating an event;
- deleting an event.

Errors should:

- use clear, user-friendly language;
- explain what operation failed;
- avoid exposing technical implementation details;
- allow the user to retry where appropriate;
- preserve unsaved form data.

---

## 17. Acceptance Criteria

### Calendar

- The Events page displays a calendar.
- The user can switch between month, week, and day views.
- The user can navigate to previous and next periods.
- Existing events appear on the correct dates and times.

### Event creation

- Selecting a calendar date or time slot opens the Event dialog in Create mode.
- The dialog displays Save and hides Edit and Delete.
- Save is disabled until all required fields are valid.
- A successfully created event appears in the calendar.
- The dialog closes after successful creation.
- A failed creation does not clear the form.

### Event editing

- Selecting an existing event opens it in Edit mode.
- Existing values are populated in the form.
- The dialog displays Edit and Delete and hides Save.
- Changes are reflected in the calendar after a successful update.
- The dialog closes after a successful update.
- A failed update does not remove entered changes.

### Event deletion

- Delete is available only for an existing event.
- Selecting Delete opens a confirmation dialog.
- Cancelling the confirmation preserves the event.
- Confirming deletion removes the event from the calendar.
- A failed deletion does not remove the event from the calendar.

### Attendees

- The user can search and select registered attendees.
- Multiple attendees can be selected.
- Selecting Add places them in the assigned attendee list.
- Duplicate attendees cannot be added.
- Each attendee can be removed.

### Hosts

- The user can search and select registered hosts.
- Multiple hosts can be selected.
- Selecting Add places them in the assigned host list.
- Duplicate hosts cannot be added.
- Each host can be removed.

### Closing behavior

- The user can close the dialog through the close icon, outside click, or Escape.
- The dialog closes immediately when there are no unsaved changes.
- A discard confirmation appears when there are unsaved changes.
- Continuing editing preserves the form.
- Confirming discard closes the dialog and removes unsaved changes.

---

## 18. Open Product Decisions

The following rules should be defined in separate requirements before implementation reaches the corresponding functionality:

- whether events may overlap for the same host;
- whether a customer may attend overlapping events;
- whether past events can be created or edited;
- whether one host is mandatory;
- whether multiple hosts are allowed for every event type;
- whether events may span multiple days;
- whether all-day events are supported;
- whether event duration has minimum or maximum limits;
- whether recurring events are supported;
- how time zones are handled;
- which event changes trigger customer notifications;
- whether attendee or host removal requires confirmation;
- whether users can drag and resize events directly in the calendar;
- whether event types such as lesson, meeting, and consultation require different fields.
