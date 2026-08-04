import dotenv from 'dotenv';

dotenv.config({ quiet: true });

export function requiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

const nodeEnv = process.env.NODE_ENV ?? 'development';

export const env = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  port: Number(process.env.PORT ?? 3000),
  mongoUri: requiredEnv('DB_HOST'),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
};
