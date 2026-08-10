import { Router } from 'express'
import { listContactsHandler, listEmployeesHandler } from './directory.controller.ts'

/**
 * Mounted under `/api` in app.ts, above the terminal handlers (design.md
 * D1). Declares exactly the two read routes specs/directory-api/spec.md
 * requires. No write route exists for either resource: an undeclared
 * method or path under `/api/contacts` or `/api/employees` falls through
 * this router to the shared `notFoundHandler`, satisfying "The directory is
 * read-only" without any extra code here.
 */
export const directoryRouter = Router()

directoryRouter.get('/contacts', listContactsHandler)
directoryRouter.get('/employees', listEmployeesHandler)
