import pg from 'pg'

const { Pool } = pg

export interface PoolOptions {
  ssl?: boolean
  applicationName?: string
}

export function createPool(connectionString = process.env.DATABASE_URL, options: PoolOptions = {}) {
  if (!connectionString) throw new Error('DATABASE_URL is verplicht')
  return new Pool({
    connectionString,
    max: 10,
    min: 1,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 30_000,
    query_timeout: 35_000,
    application_name: options.applicationName ?? 'bouwflow-api',
    ...(options.ssl ? { ssl: { rejectUnauthorized: true } } : {}),
  })
}
