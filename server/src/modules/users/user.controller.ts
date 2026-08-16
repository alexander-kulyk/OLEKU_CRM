import type { RequestHandler } from 'express'
import { validate } from '../../shared/http/validate.ts'
import {
  userIdParamsSchema,
  userListQuerySchema,
  userPatchSchema,
} from './user.schema.ts'
import { getUser, listUsers, updateUser } from './user.service.ts'

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

export const updateUserHandler: RequestHandler = async (req, res) => {
  const { userId } = validate(userIdParamsSchema, req.params)
  const patch = validate(userPatchSchema, req.body)
  const user = await updateUser(userId, patch)

  res.json(user)
}
