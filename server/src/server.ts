import { createApp } from './app.ts'
import { env } from './shared/config/env.ts'
import { connectToMongo, disconnectFromMongo } from './shared/infra/mongoose/client.ts'

export async function runServer(): Promise<void> {
  await connectToMongo()

  const app = createApp()
  const server = app.listen(env.port, () => {
    console.log(`Server listening on http://localhost:${env.port} [${env.nodeEnv}]`)
  })

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
      server.close(async () => {
        await disconnectFromMongo()
        process.exit(0)
      })
    })
  }
}
