import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import morgan from 'morgan'
import { env } from './shared/config/env.ts'
import { notFoundHandler } from './shared/http/not-found-handler.ts'
import { errorMiddleware } from './shared/http/error-middleware.ts'
import { directoryRouter } from './modules/directory/directory.routes.ts'

export function createApp() {
  const app = express()

  app.use(helmet())
  app.use(cors({ origin: env.corsOrigin }))
  app.use(morgan(env.isProduction ? 'combined' : 'dev'))
  app.use(express.json({ limit: '1mb' }))
  app.use(express.urlencoded({ extended: true }))

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' })
  })

  app.use('/api', directoryRouter)

  // Both terminal handlers stay last: mount every feature router above
  // this point (see specs/api-foundation/spec.md, "Defined routes precede
  // terminal handlers").
  app.use(notFoundHandler)
  app.use(errorMiddleware)

  return app
}
