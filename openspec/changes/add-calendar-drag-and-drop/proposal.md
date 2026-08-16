## Why

Operators currently have to open the Event dialog for every reschedule even though the calendar already renders the destination dates and times. Drag and drop can make rescheduling immediate, but it must preserve duration and must not let stale operators silently overwrite newer event data.

## What Changes

- Allow existing single-day timed events to be moved in Month, Week, and Day views, using the calendar's resolved destination and an explicit 30-minute timed-grid snap interval.
- Preserve the event identifier and original elapsed duration. The destination determines the new start; the new end is derived as `newStart + originalDuration`, so elapsed-duration preservation takes precedence over retaining both wall-clock endpoints across a daylight-saving offset transition.
- Keep multi-day timed events and all-day events non-draggable until their calendar semantics are specified. Creation and duration resizing remain out of scope.
- Apply an optimistic event-scoped move in the existing event store, show that event as pending, prevent another mutation of the same event, keep other events usable, and reconcile success from the returned server event.
- Roll back the exact original schedule and show an accessible error when persistence fails. Refresh current server data after a version conflict or concurrent deletion without restoring stale same-period responses.
- Suppress requests for cancelled, invalid, unchanged, or view-only movement and send exactly one schedule PATCH for an effective drop.
- **BREAKING**: Add a required explicit domain `version` to every event payload, require the current `version` on every event PATCH, atomically increment it on success, and return `409 EVENT_VERSION_CONFLICT` when the supplied version is stale. Existing stored events receive a defined initial version before version-guarded writes are enabled.
- Retain the shared generic `NOT_FOUND`, `VALIDATION_ERROR`, and `INTERNAL_ERROR` codes for the corresponding drag failures; the PRD's event-specific alternatives remain illustrative. Add only the missing event conflict code, composing with the active `add-users-server-api` error-envelope delta.
- Preserve the Edit Event dialog as the keyboard/non-drag rescheduling path and make its existing update flow version-aware.

## Capabilities

### New Capabilities

- `calendar-drag-and-drop`: View-specific event movement, duration preservation, eligibility, optimistic pending/rollback behavior, no-op suppression, failure recovery, snapping, and the accessible non-drag fallback.

### Modified Capabilities

- `event-api`: Event reads expose a domain version, and PATCH becomes a version-guarded atomic update that reports stale writes without modifying the stored event.
- `api-foundation`: The stable shared error contract adds `EVENT_VERSION_CONFLICT` as an HTTP 409 business/concurrency conflict while preserving the pending envelope extensions from `add-users-server-api`.

## Impact

- **Client:** FullCalendar configuration and drop handling, event DTO/update types, the sanctioned Zustand event store, pending/error presentation, Edit-dialog PATCH payloads, and protection against stale same-period reads.
- **Server:** Event model/DTO/schema/service/controller behavior, atomic version-guarded updates, legacy event-version initialization, shared error codes/status mapping, and event API/service/schema tests.
- **API:** `PATCH /api/events/:id` requires `version`; every event returned by reads, creates, and updates includes `version`; stale writes return the shared error envelope with `EVENT_VERSION_CONFLICT` at 409.
- **Dependencies:** No new runtime dependency; the installed FullCalendar interaction plugin supplies the required drop and revert primitives.
- **Data:** Existing event documents need a safe version initialization/default policy before strict version matching is enabled. Deployed collection contents remain unknown and must be assessed before rollout.
- **Documentation/spec coordination:** The change deliberately revises the archived last-write-wins/refetch-only design and overlaps the active `add-users-server-api` delta for `api-foundation`.
