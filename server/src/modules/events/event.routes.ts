import { Router } from 'express'
import {
  createEventHandler,
  deleteEventHandler,
  listEventsHandler,
  patchEventHandler,
} from './event.controller.ts'

/**
 * Mounted under `/api` in app.ts, above the terminal handlers (design.md
 * D1). Declares exactly the four event routes specs/event-api/spec.md
 * requires: the bounded period read, create, partial update, and delete.
 * Any other method or path under `/api/events` (e.g. `PUT`, or `GET` with
 * an `:id`) falls through this router to the shared `notFoundHandler`.
 */
export const eventRouter = Router()

eventRouter.get('/events', listEventsHandler)
eventRouter.post('/events', createEventHandler)
eventRouter.patch('/events/:id', patchEventHandler)
eventRouter.delete('/events/:id', deleteEventHandler)
