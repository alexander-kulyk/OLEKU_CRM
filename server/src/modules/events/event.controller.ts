import type { RequestHandler } from 'express'
import { validate } from '../../shared/http/validate.ts'
import {
  eventCreateSchema,
  eventIdParamsSchema,
  eventPatchSchema,
  eventPeriodQuerySchema,
} from './event.schema.ts'
import { createEvent, deleteEvent, listEventsByPeriod, patchEvent } from './event.service.ts'

/**
 * specs/event-api/spec.md, "Calendar reads use an exact bounded route":
 * `GET /api/events?from&to` -> `{ events: [...] }`. `validate()` throws its
 * VALIDATION_ERROR `HttpError` for a missing, non-increasing, date-only, or
 * zone-less boundary before `listEventsByPeriod` ever reaches persistence
 * (design.md D2). Async and unwrapped — Express 5 forwards a rejected
 * promise straight to the shared error middleware (design.md D9).
 */
export const listEventsHandler: RequestHandler = async (req, res) => {
  const period = validate(eventPeriodQuerySchema, req.query)
  const events = await listEventsByPeriod(period)

  res.json({ events })
}

/**
 * specs/event-api/spec.md, "Events can be created": `POST /api/events`
 * returns the created event directly (no wrapper) with status 201.
 */
export const createEventHandler: RequestHandler = async (req, res) => {
  const input = validate(eventCreateSchema, req.body)
  const event = await createEvent(input)

  res.status(201).json(event)
}

/**
 * specs/event-api/spec.md, "PATCH updates only supplied fields":
 * `PATCH /api/events/:id` returns the updated event directly with status
 * 200. The id param is validated first so a malformed identifier is
 * rejected with VALIDATION_ERROR before the body is even parsed, and
 * `patchEvent` itself resolves an unknown-but-well-formed id to NOT_FOUND
 * (specs/event-api/spec.md, "Unknown event on update").
 */
export const patchEventHandler: RequestHandler = async (req, res) => {
  const { id } = validate(eventIdParamsSchema, req.params)
  const patch = validate(eventPatchSchema, req.body)
  const event = await patchEvent(id, patch)

  res.status(200).json(event)
}

/**
 * specs/event-api/spec.md, "Events can be deleted": `DELETE /api/events/:id`
 * returns status 204 with no response body on success. `deleteEvent`
 * throws NOT_FOUND for a well-formed id matching no event; a malformed id
 * is rejected here by `eventIdParamsSchema` before `deleteEvent` runs.
 */
export const deleteEventHandler: RequestHandler = async (req, res) => {
  const { id } = validate(eventIdParamsSchema, req.params)
  await deleteEvent(id)

  res.status(204).end()
}
