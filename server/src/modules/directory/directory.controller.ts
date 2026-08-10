import type { RequestHandler } from 'express'
import { validate } from '../../shared/http/validate.ts'
import { contactListQuerySchema, employeeListQuerySchema } from './directory.schema.ts'
import { listContacts, listEmployees } from './directory.service.ts'

/**
 * specs/directory-api/spec.md, "Contacts are read from the contact
 * directory": `GET /api/contacts` -> `{ contacts: [...] }`. Async and
 * unwrapped — Express 5 forwards a rejected promise (including the
 * VALIDATION_ERROR `HttpError` `validate()` throws) straight to the shared
 * error middleware (design.md D9).
 */
export const listContactsHandler: RequestHandler = async (req, res) => {
  const query = validate(contactListQuerySchema, req.query)
  const contacts = await listContacts(query)

  res.json({ contacts })
}

/**
 * specs/directory-api/spec.md, "Employees are read from the employee
 * directory": `GET /api/employees` -> `{ employees: [...] }`.
 */
export const listEmployeesHandler: RequestHandler = async (req, res) => {
  const query = validate(employeeListQuerySchema, req.query)
  const employees = await listEmployees(query)

  res.json({ employees })
}
