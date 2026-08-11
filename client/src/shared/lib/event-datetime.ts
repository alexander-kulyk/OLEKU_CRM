/**
 * The date/time conversion boundary (design.md D5): native `<input
 * type="date">` / `<input type="time">` hold LOCAL date and time strings,
 * while the server speaks zone-explicit ISO instants (`startAt`/`endAt`).
 * Every place that crosses that boundary goes through these functions —
 * nothing else in the client constructs or formats a date/time string.
 *
 * Composing `${dateValue}T${timeValue}` with no `Z`/offset suffix is
 * interpreted by the `Date` constructor as local time in every browser,
 * which is exactly the intended behavior: an event entered at 09:00 is
 * stored as the instant that is 09:00 in the browser's own time zone. This
 * is the working default the design defers a real time-zone policy to
 * (research R-010, PRD §18).
 */

function pad(value: number): string {
  return value.toString().padStart(2, '0')
}

/** `YYYY-MM-DD` in the browser's own time zone — what `<input type="date">` needs. */
export function toLocalDateInputValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** `HH:MM` in the browser's own time zone — what `<input type="time">` needs. */
export function toLocalTimeInputValue(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * The outgoing half of the boundary: a local date string plus a local time
 * string — both entered against native inputs — composed into the
 * zone-explicit ISO instant the server expects for `startAt`/`endAt`.
 */
export function localDateTimeToIsoInstant(dateValue: string, timeValue: string): string {
  return new Date(`${dateValue}T${timeValue}`).toISOString()
}

/**
 * The incoming half of the boundary: an ISO instant (as `EventRecord`
 * carries it) back to the local date string a native date input holds, for
 * Edit-mode hydration.
 */
export function isoInstantToLocalDateInputValue(isoInstant: string): string {
  return toLocalDateInputValue(new Date(isoInstant))
}

/** As {@link isoInstantToLocalDateInputValue}, for the time inputs. */
export function isoInstantToLocalTimeInputValue(isoInstant: string): string {
  return toLocalTimeInputValue(new Date(isoInstant))
}
