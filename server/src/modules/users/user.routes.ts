import { Router } from 'express'
import { getUserHandler, listUsersHandler } from './user.controller.ts'

export const userRouter = Router()

userRouter.get('/users', listUsersHandler)
userRouter.get('/users/:userId', getUserHandler)
