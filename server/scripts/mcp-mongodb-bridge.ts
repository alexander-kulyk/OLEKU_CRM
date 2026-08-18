import dotenv from 'dotenv'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(scriptDir, '..', '.env'), quiet: true })

const child = spawn('npx', ['-y', 'mongodb-mcp-server@latest'], {
  stdio: 'inherit',
  env: { ...process.env, MDB_MCP_CONNECTION_STRING: process.env.DB_HOST ?? '' },
})

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => child.kill(signal))
}

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }
  process.exit(code ?? 0)
})
