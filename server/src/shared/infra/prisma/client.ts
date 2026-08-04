import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../../generated/prisma/client.ts'
import { requiredEnv } from '../../config/env.ts'

const adapter = new PrismaPg({ connectionString: requiredEnv('DATABASE_URL') })

export const prisma = new PrismaClient({ adapter })
