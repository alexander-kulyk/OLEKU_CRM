import type { RequestHandler } from 'express'
import { validate } from '../../shared/http/validate.ts'
import { userListQuerySchema } from './user.schema.ts'
import { listUsers } from './user.service.ts'

export const listUsersHandler: RequestHandler = async (req, res) => {
  const query = validate(userListQuerySchema, req.query)
  const result = await listUsers(query)

  res.json(result)
}
