import mongoose from 'mongoose'
import { env } from '../../config/env.ts'

mongoose.connection.on('error', (error) => {
  console.error('MongoDB connection error:', error.message)
})

mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB disconnected')
})

export async function connectToMongo(): Promise<void> {
  await mongoose.connect(env.mongoUri)

  console.log(`MongoDB connected to "${mongoose.connection.name}"`)
}

export async function disconnectFromMongo(): Promise<void> {
  await mongoose.disconnect()
}
