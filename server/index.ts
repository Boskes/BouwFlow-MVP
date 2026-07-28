import { buildApp } from './app.js'
import { migrate } from './db/migration.js'
import { createPool } from './db/pool.js'
import { seedDevelopmentData } from './db/seed.js'
import { readServerConfig } from './config.js'
import { LocalObjectStorage } from './storage.js'

const config = readServerConfig()
const pool = createPool(config.databaseUrl, { ssl: config.databaseSsl, applicationName: `bouwflow-api:${config.release}` })
const objectStorage = new LocalObjectStorage(config.uploadDir)

await migrate(pool)
if (config.authMode === 'development') await seedDevelopmentData(pool)

const app = await buildApp({ pool, authMode: config.authMode, logger: true, frontendOrigin: config.frontendOrigin, objectStorage, trustProxy: config.trustProxy, rateLimitMax: config.rateLimitMax, rateLimitWindowMs: config.rateLimitWindowMs, release: config.release, requireIdempotencyKey: config.production })
await app.listen({ port: config.port, host: config.host })

const shutdown = async () => {
  await app.close()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
