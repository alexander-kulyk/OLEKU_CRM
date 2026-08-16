/**
 * The color swatches the Event dialog offers. The API accepts any six-digit
 * hex value (server/src/modules/events/event-color.ts), so this table is the
 * only thing deciding what a user can actually pick — extending the palette
 * is a change here alone.
 *
 * Every value is dark enough to carry FullCalendar's white event text, since
 * the chosen color becomes the event block's background on the calendar
 * (`map-events.ts`).
 */
export interface EventColorOption {
  /** Six-digit lowercase hex triplet — the exact value sent to the API. */
  readonly value: string
  /** The swatch's accessible name; the swatch itself is decorative. */
  readonly label: string
}

export const EVENT_COLOR_OPTIONS: readonly EventColorOption[] = [
  { value: '#2563eb', label: 'Blue' },
  { value: '#059669', label: 'Green' },
  { value: '#0d9488', label: 'Teal' },
  { value: '#7c3aed', label: 'Purple' },
  { value: '#db2777', label: 'Pink' },
  { value: '#dc2626', label: 'Red' },
  { value: '#d97706', label: 'Amber' },
  { value: '#475569', label: 'Slate' },
]

/**
 * Preselected in a Create dialog. Deliberately the same value the server
 * defaults to for a create request that omits `color`, so a client-picked
 * default and a server-applied one are never different colors.
 */
export const DEFAULT_EVENT_COLOR = '#2563eb'
