# Calendar Drag & Drop — Business Requirements

**Document ID:** BR-CALENDAR-DND
**Version:** 1.0
**Status:** Draft
**Domain:** Calendar / Events

---

# 1. Purpose

The Calendar Drag & Drop functionality allows an operator to reschedule an already existing event directly from the calendar without opening the Edit Event dialog.

Depending on the current calendar view, dragging an event may update:

- the event date;
- the event start and end time;
- both the date and time.

Drag & Drop MUST NOT change the event duration.

After an event is dropped into a new calendar position, the frontend MUST update the event through the Event Update API.

---

# 2. Scope

Drag & Drop applies only to already existing events displayed on the calendar.

The functionality supports:

- Month view;
- Week view;
- Day view.

The functionality does not create a new event.

The functionality does not resize an event or modify its duration.

---

# 3. Event Duration Preservation

## REQ-CAL-DND-001

Dragging an event MUST preserve its original duration.

Example:

```text
Original:
10:00 → 11:00
Duration: 1 hour

Dragged to:
11:00

Result:
11:00 → 12:00
Duration: 1 hour
```

Another example:

```text
Original:
14:30 → 16:00
Duration: 1 hour 30 minutes

Dragged to:
09:00

Result:
09:00 → 10:30
```

Drag & Drop MUST NOT independently change `endAt` in a way that changes the original event duration.

---

# 4. Month View

## REQ-CAL-DND-002

In **Month view**, the operator can drag an existing event from one calendar date cell to another.

Example:

```text
Original date:
August 5

Dragged to:
August 8
```

Result:

```text
Event date:
August 8
```

Only the event date changes.

The event start and end time MUST remain unchanged.

---

# 5. Month View — Date Calculation

## REQ-CAL-DND-003

When an event is dropped into another Month-view date cell:

```text
old date → new date
```

the system MUST apply the destination cell date to the event.

Example:

```text
Before:
2026-08-05
10:00 → 11:00

After drag to August 8:
2026-08-08
10:00 → 11:00
```

Both start and end timestamps MUST be moved to the new date while preserving their original time values and duration.

---

# 6. Month View — Same Date

## REQ-CAL-DND-004

If the operator drops the event back into its original date and no effective date change occurred:

- no event update MUST be persisted;
- an unnecessary Update Event request SHOULD NOT be sent.

---

# 7. Week View

## REQ-CAL-DND-005

In **Week view**, events can be moved:

1. vertically within the same date column;
2. horizontally between date columns;
3. diagonally between both date and time positions.

The resulting update depends on what changed.

---

# 8. Week View — Vertical Drag

## REQ-CAL-DND-006

If the event is moved vertically but remains within the same date column:

```text
date unchanged
time changed
```

only the event time MUST change.

Example:

```text
Original:
August 5
10:00 → 11:00

Dragged down:
August 5
11:00 → 12:00
```

The event date remains:

```text
August 5
```

The original duration MUST be preserved.

---

# 9. Week View — Drag Up

## REQ-CAL-DND-007

Vertical dragging MUST work in both directions.

Example:

```text
Original:
14:00 → 15:00

Dragged upward to:
12:00

Result:
12:00 → 13:00
```

---

# 10. Week View — Horizontal Drag

## REQ-CAL-DND-008

If an event is moved to another date column while remaining at the same time position:

```text
date changed
time unchanged
```

only the event date MUST change.

Example:

```text
Before:
August 5
10:00 → 11:00

Dragged from August 5 column
to August 6 column

After:
August 6
10:00 → 11:00
```

---

# 11. Week View — Diagonal Drag

## REQ-CAL-DND-009

If an event is moved to:

- another date column;
- and another time position;

both the event date and time MUST be updated.

Example:

```text
Before:
August 5
10:00 → 11:00
```

Operator drags the event:

```text
one column right
+
two time cells down
```

Result:

```text
August 6
12:00 → 13:00
```

The original duration MUST remain unchanged.

---

# 12. Day View

## REQ-CAL-DND-010

In **Day view**, the operator can drag an event vertically to another time position.

Because Day view represents a single date:

- the date MUST remain unchanged;
- only start and end time MUST change.

Example:

```text
Before:
10:00 → 11:00

Dragged down to:
11:00

After:
11:00 → 12:00
```

---

# 13. Day View — Upward Drag

## REQ-CAL-DND-011

Day-view dragging MUST support both:

- upward movement;
- downward movement.

Example:

```text
Before:
15:00 → 16:00

Dragged upward:
13:00

After:
13:00 → 14:00
```

---

# 14. Event Update Request

## REQ-CAL-DND-012

After an event is dropped into a valid new position, the frontend MUST update the existing event using its ID.

Example endpoint:

```http
PATCH /api/events/:eventId
```

The request MUST contain only the event scheduling fields that changed, together with any concurrency field required by the Event API.

---

# 15. Month View Update Payload

## REQ-CAL-DND-013

For Month view, the request contains the new event date/time timestamps.

Example:

```json
{
  "startAt": "2026-08-08T10:00:00Z",
  "endAt": "2026-08-08T11:00:00Z"
}
```

The time portion remains equivalent to the previous event time.

---

# 16. Week View — Time-Only Update

## REQ-CAL-DND-014

If only the time changed:

```json
{
  "startAt": "2026-08-05T11:00:00Z",
  "endAt": "2026-08-05T12:00:00Z"
}
```

The date portion remains unchanged.

---

# 17. Week View — Date-Only Update

## REQ-CAL-DND-015

If only the date changed:

```json
{
  "startAt": "2026-08-06T10:00:00Z",
  "endAt": "2026-08-06T11:00:00Z"
}
```

The time remains unchanged.

---

# 18. Week View — Date and Time Update

## REQ-CAL-DND-016

If both date and time changed:

```json
{
  "startAt": "2026-08-06T12:00:00Z",
  "endAt": "2026-08-06T13:00:00Z"
}
```

both values MUST be persisted in one Event Update operation.

The application MUST NOT perform separate date and time update requests for a single drag operation.

---

# 19. Immediate Visual Update

## REQ-CAL-DND-017

When the event is dropped into a valid target position, the calendar MUST immediately display the event in the new position.

The operator MUST NOT need to wait for the server response before seeing the new position.

Conceptually:

```text
Drop Event
    ↓
Move Event in UI immediately
    ↓
Send update request
    ↓
Success → keep new position
Failure → restore previous position
```

This is an optimistic UI update.

---

# 20. Update Loading State

## REQ-CAL-DND-018

While the Event Update request is in progress, the moved event MUST have a loading/pending state.

The loading state SHOULD be visible on the affected event itself rather than blocking the entire Calendar page.

While the event update is pending:

- another drag operation for the same event MUST NOT be started;
- repeated update requests for the same drag action MUST be prevented.

Other unaffected calendar events SHOULD remain usable.

---

# 21. Successful Drag & Drop Update

## REQ-CAL-DND-019

If the Event Update request succeeds:

- the event remains in the new position;
- the new date/time becomes the persisted event state;
- the loading state is removed.

The calendar MUST use the server response as the final source of truth.

---

# 22. Failed Drag & Drop Update

## REQ-CAL-DND-020

If the Event Update request fails:

1. the event MUST return to its exact previous calendar position;
2. the original date MUST be restored;
3. the original start time MUST be restored;
4. the original end time MUST be restored;
5. the loading state MUST end;
6. an error message MUST be displayed.

Example:

```text
Original:
August 5
10:00 → 11:00

Dragged:
August 6
12:00 → 13:00

API fails

Result:
August 5
10:00 → 11:00
```

The failed optimistic position MUST NOT remain visible as if the update succeeded.

---

# 23. Original Event Snapshot

## REQ-CAL-DND-021

Before applying an optimistic drag update, the frontend MUST preserve the event's original scheduling information.

At minimum:

```text
eventId
originalStartAt
originalEndAt
```

This state is required to reliably restore the event if the Update Event request fails.

---

# 24. Event ID

## REQ-CAL-DND-022

Drag & Drop MUST update the existing event.

A drag operation MUST NOT:

- create a new Event ID;
- duplicate the event;
- delete and recreate the event.

The existing event ID remains unchanged.

---

# 25. No Effective Change

## REQ-CAL-DND-023

If the operator drags an event but drops it into a position that produces the same:

```text
startAt
endAt
```

as before, the operation MUST be treated as no change.

The frontend SHOULD NOT send an Update Event request.

---

# 26. Drag Cancellation

## REQ-CAL-DND-024

If the operator starts dragging an event but cancels the interaction or releases it outside a valid calendar target:

- the event MUST return to its original position;
- no Event Update request MUST be sent.

---

# 27. Invalid Drop Target

## REQ-CAL-DND-025

The calendar MUST NOT persist an event if it is dropped into a target that the Calendar does not recognize as a valid date/time position.

The event MUST return to its previous position.

No Update Event request MUST be sent.

---

# 28. Date and Time Calculation

## REQ-CAL-DND-026

The target scheduling values MUST be derived from the destination calendar position.

The frontend MUST NOT calculate a new time or date based on arbitrary pixel offsets independently of the calendar's configured time/date slots.

The Calendar component's resolved destination date/time MUST be used.

---

# 29. Time Slot Precision

## REQ-CAL-DND-027

Dragging MUST respect the configured Calendar time-slot granularity.

For example, if the Calendar uses:

```text
30-minute slots
```

an event may be moved:

```text
10:00 → 10:30
10:30 → 11:00
11:00 → 11:30
```

according to the configured slot system.

The exact Calendar slot interval is defined in the Calendar configuration requirements.

---

# 30. Dragging Across Views

## REQ-CAL-DND-028

Changing Calendar view itself MUST NOT modify any event.

Only an explicit event drag and successful drop may initiate a Drag & Drop update.

For example:

```text
Month → Week
```

does not trigger:

```http
PATCH /api/events/:eventId
```

---

# 31. Concurrent Event Update

## REQ-CAL-DND-029

Drag & Drop MUST follow the same optimistic-concurrency rules as other Event updates.

If the event was modified by another operator after the Calendar loaded it, the update MUST NOT silently overwrite the newer server version.

The Event API should return the appropriate concurrency conflict.

The UI MUST:

- rollback the dragged event;
- display a conflict message;
- refresh the affected event or Calendar data.

---

# 32. Archived / Deleted Event During Drag

## REQ-CAL-DND-030

If another operator removes the event before the Drag & Drop update is persisted:

- the update MUST fail;
- the event MUST NOT remain in the new optimistic position;
- the Calendar MUST refresh;
- the operator MUST be informed that the event is no longer available.

---

# 33. Error Handling

## REQ-CAL-DND-031

Drag & Drop errors MUST use the common Event API error contract.

Examples:

```text
EVENT_NOT_FOUND
EVENT_VERSION_CONFLICT
INVALID_EVENT_DATE
INVALID_EVENT_TIME
EVENT_UPDATE_FAILED
```

The Calendar MUST distinguish business errors from temporary server/network failures.

---

# 34. Network Failure

## REQ-CAL-DND-032

If the request fails because of a network or server error:

```text
Drop
↓
optimistic movement
↓
request fails
↓
rollback
```

The operator MUST be informed that the change was not saved.

Example:

> The event could not be moved. Its previous date and time have been restored.

---

# 35. Accessibility

## REQ-CAL-DND-033

Drag & Drop MUST NOT be the only mechanism for changing an event's date or time.

The operator MUST still be able to modify the same scheduling information through the Edit Event dialog.

This ensures that users who cannot perform pointer-based drag operations can still reschedule events.

---

# 36. Out of Scope

The following functionality is outside this Drag & Drop document:

- creating events;
- editing event name;
- changing attendees;
- changing hosts;
- changing event color;
- event resizing;
- changing event duration through drag;
- recurring-event behavior;
- authorization rules determining who may move an event;
- notifications triggered by rescheduling;
- business rules for conflicting events;
- restrictions on past events.

These must be defined in their corresponding requirements.

---

# 37. Acceptance Criteria

## AC-CAL-DND-001 — Month Date Change

**Given** an event exists on August 5 from 10:00 to 11:00
**And** Month view is active
**When** the operator drags the event to August 8
**Then** the event becomes August 8 from 10:00 to 11:00
**And** the event duration remains unchanged
**And** the existing event ID is updated.

---

## AC-CAL-DND-002 — Month View Does Not Change Time

**Given** an event exists from 10:00 to 11:00
**When** it is dragged to another date in Month view
**Then** only its date changes
**And** its start and end time remain 10:00 and 11:00.

---

## AC-CAL-DND-003 — Week Vertical Drag Down

**Given** an event exists on August 5 from 10:00 to 11:00
**And** Week view is active
**When** it is dragged down to the 11:00 position in the same column
**Then** it becomes 11:00 to 12:00 on August 5.

---

## AC-CAL-DND-004 — Week Vertical Drag Up

**Given** an event exists from 14:00 to 15:00
**When** it is dragged upward to 12:00 in the same date column
**Then** it becomes 12:00 to 13:00
**And** the date remains unchanged.

---

## AC-CAL-DND-005 — Week Horizontal Drag

**Given** an event exists on August 5 from 10:00 to 11:00
**When** the operator moves it horizontally to the August 6 column at the same time
**Then** the event becomes August 6 from 10:00 to 11:00.

---

## AC-CAL-DND-006 — Week Diagonal Drag

**Given** an event exists on August 5 from 10:00 to 11:00
**When** the operator moves it to August 6 at 12:00
**Then** the event becomes August 6 from 12:00 to 13:00
**And** date and time are saved in one update operation.

---

## AC-CAL-DND-007 — Day Drag

**Given** Day view is active
**And** an event exists from 10:00 to 11:00
**When** the event is dragged to 11:00
**Then** the event becomes 11:00 to 12:00
**And** its date remains unchanged.

---

## AC-CAL-DND-008 — Preserve Duration

**Given** an event duration is 90 minutes
**When** the event is moved to another valid position
**Then** its duration remains 90 minutes.

---

## AC-CAL-DND-009 — Optimistic UI

**Given** an event is dropped into a valid new position
**When** the update begins
**Then** the event immediately appears in the destination position
**And** displays a pending/loading state.

---

## AC-CAL-DND-010 — Successful Update

**Given** an event was optimistically moved
**When** the Event Update request succeeds
**Then** the event remains in the new position
**And** the loading state disappears.

---

## AC-CAL-DND-011 — Failed Update Rollback

**Given** an event was originally on August 5 from 10:00 to 11:00
**And** it was dragged to August 6 from 12:00 to 13:00
**When** the Event Update request fails
**Then** the event returns to August 5 from 10:00 to 11:00
**And** an error is displayed.

---

## AC-CAL-DND-012 — Prevent Duplicate Drag

**Given** an Event Update request caused by Drag & Drop is still pending
**When** the operator attempts to drag the same event again
**Then** another drag update for that event is not started.

---

## AC-CAL-DND-013 — No Effective Change

**Given** an event is dragged
**When** it is dropped at a position resolving to the same start and end date/time
**Then** no Event Update request is sent.

---

## AC-CAL-DND-014 — Invalid Drop

**Given** an event is being dragged
**When** it is released outside a valid Calendar target
**Then** the event returns to its original position
**And** no Event Update request is sent.

---

## AC-CAL-DND-015 — Concurrent Update Conflict

**Given** another operator modified the event after Calendar data was loaded
**When** the operator attempts to move the stale event
**Then** the update is rejected
**And** the dragged event is rolled back
**And** current event data is refreshed.

---

# 38. Behavior Summary

```text
MONTH
Event → another date
      → DATE changes
      → TIME unchanged
      → duration unchanged


WEEK
Event → up/down in same column
      → TIME changes

Event → left/right at same time
      → DATE changes

Event → left/right + up/down
      → DATE + TIME change

All cases:
duration unchanged


DAY
Event → up/down
      → TIME changes
      → DATE unchanged
      → duration unchanged
```

Update flow:

```text
Drag
  ↓
Drop on valid target
  ↓
Calculate new startAt/endAt
  ↓
Immediately move event in UI
  ↓
Show event-level loading state
  ↓
PATCH /api/events/:eventId
  ↓
 ┌───────────────┐
 │               │
Success        Failure
 │               │
Keep           Rollback
position       old position
 │               │
Remove         Show error
loading
```
