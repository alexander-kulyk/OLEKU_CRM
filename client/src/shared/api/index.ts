export { httpClient } from './http-client'
export {
  getApiErrorCode,
  isApiError,
  toApiError,
  TRANSPORT_ERROR_CODE,
} from './error'
export type { ApiError, ApiErrorCode, ServerErrorCode } from './error'

export {
  createEvent,
  deleteEvent,
  readEventsForPeriod,
  updateEvent,
} from './events'
export type {
  CreateEventInput,
  EventParticipant,
  EventPeriod,
  EventRecord,
  UpdateEventInput,
} from './event-types'

export { getEventErrorMessage } from './event-error-messages'
export type { EventOperation } from './event-error-messages'
