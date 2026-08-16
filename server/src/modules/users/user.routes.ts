import { Router } from 'express'
import {
  archiveUserHandler,
  getUserHandler,
  listUsersHandler,
  updateUserHandler,
} from './user.controller.ts'

export const userRouter = Router()

userRouter.get('/users', listUsersHandler)
userRouter.get('/users/:userId', getUserHandler)
userRouter.patch('/users/:userId', updateUserHandler)
userRouter.delete('/users/:userId', archiveUserHandler)
