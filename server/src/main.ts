import { createApp } from './app.ts'
import { env } from './shared/config/env.ts'

const app = createApp()

app.listen(env.port, () => {
  console.log(`Server listening on port ${env.port}`)
})
