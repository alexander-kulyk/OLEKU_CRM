import express, { type ErrorRequestHandler } from 'express'
import helmet from 'helmet'
import cors from 'cors'
import morgan from 'morgan'
import { env } from './shared/config/env.ts'

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

  app.use((req, res) => {
    res.status(404).json({
      error: 'Not Found',
      message: `Route ${req.originalUrl} not found`,
    })
  })

  const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    console.error('Server error:', error)

    const status = typeof error.status === 'number' ? error.status : 500
    const message = error instanceof Error ? error.message : 'Internal Server Error'

    res.status(status).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString(),
      ...(env.isProduction || !(error instanceof Error) ? {} : { stack: error.stack }),
    })
  }

  app.use(errorHandler)

  return app
}
