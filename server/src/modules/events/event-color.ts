/**
 * The stored form of an event's color: a six-digit hex triplet in lowercase,
 * e.g. `#2563eb`. The API accepts any well-formed hex value rather than a
 * fixed enum — the selectable palette is a client presentation concern
 * (client/src/features/event-dialog/config/event-colors.ts), so widening or
 * restyling that palette must not require a server change.
 *
 * Shared by the three layers that each need it for a different reason:
 * event.schema.ts validates and normalizes request input against it,
 * event.model.ts declares the persistence default and backstop, and
 * event.service.ts falls back to the default for events stored before this
 * field existed.
 */
export const EVENT_COLOR_PATTERN = /^#[0-9a-f]{6}$/

/**
 * Applied when a create request omits `color`, and returned in place of a
 * missing stored value. Matches the client palette's first swatch.
 */
export const DEFAULT_EVENT_COLOR = '#2563eb'
