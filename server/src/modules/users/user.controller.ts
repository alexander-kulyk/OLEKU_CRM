import type { RequestHandler } from 'express'
import { validate } from '../../shared/http/validate.ts'
import { userIdParamsSchema, userListQuerySchema } from './user.schema.ts'
import { getUser, listUsers } from './user.service.ts'

export const listUsersHandler: RequestHandler = async (req, res) => {
  const query = validate(userListQuerySchema, req.query)
  const result = await listUsers(query)

  res.json(result)
}

export const getUserHandler: RequestHandler = async (req, res) => {
  const { userId } = validate(userIdParamsSchema, req.params)
  const user = await getUser(userId)

  res.json(user)
}
