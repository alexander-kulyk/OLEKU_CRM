import { Router } from 'express'
import { listUsersHandler } from './user.controller.ts'

export const userRouter = Router()

userRouter.get('/users', listUsersHandler)
