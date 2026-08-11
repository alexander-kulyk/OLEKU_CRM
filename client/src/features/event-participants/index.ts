// Public API for the `event-participants` feature slice — attendee and
// host assignment (specs/event-participants/spec.md). A separate slice
// from `event-dialog` (design.md D1): `event-dialog` consumes this
// component through this file; this feature never imports from
// `event-dialog`.
export { ParticipantSection } from './ui/ParticipantSection'
export type { ParticipantRole } from './model/participant-role-config'
