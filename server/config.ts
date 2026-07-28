import { isAbsolute } from 'node:path'
import type { AuthMode } from './auth.js'

export interface ServerConfig {
  production: boolean
  port: number
  host: string
  authMode: AuthMode
  frontendOrigin: string
  databaseUrl: string
  databaseSsl: boolean
  uploadDir: string
  trustProxy: boolean
  rateLimitMax: number
  rateLimitWindowMs: number
  release: string
}

const required = (environment: NodeJS.ProcessEnv, name: string) => {
  const value = environment[name]?.trim()
  if (!value) throw new Error(`${name} is verplicht`)
  return value
}

const integer = (environment: NodeJS.ProcessEnv, name: string, fallback: number, minimum: number, maximum: number) => {
  const raw = environment[name]?.trim()
  const value = raw ? Number(raw) : fallback
  if (!Number.isInteger(value) || value < minimum || value > maximum) throw new Error(`${name} moet een geheel getal tussen ${minimum} en ${maximum} zijn`)
  return value
}

const boolean = (value: string | undefined, fallback = false) => value == null ? fallback : ['1', 'true', 'yes', 'ja'].includes(value.trim().toLocaleLowerCase())

export function readServerConfig(environment: NodeJS.ProcessEnv = process.env): ServerConfig {
  const production = environment.NODE_ENV === 'production'
  const authMode: AuthMode = environment.AUTH_MODE === 'entra' ? 'entra' : 'development'
  const frontendOrigin = environment.FRONTEND_ORIGIN?.trim() || 'http://localhost:5173'
  const host = environment.API_HOST?.trim() || '127.0.0.1'
  const uploadDir = environment.UPLOAD_DIR?.trim() || '.data/uploads'
  const databaseUrl = required(environment, 'DATABASE_URL')

  let origin: URL
  try { origin = new URL(frontendOrigin) } catch { throw new Error('FRONTEND_ORIGIN moet een geldige absolute URL zijn') }
  if (origin.origin !== frontendOrigin.replace(/\/$/, '')) throw new Error('FRONTEND_ORIGIN mag geen pad, query of fragment bevatten')

  if (production) {
    if (authMode !== 'entra') throw new Error('AUTH_MODE=entra is verplicht in productie')
    required(environment, 'ENTRA_TENANT_ID')
    required(environment, 'ENTRA_CLIENT_ID')
    if (origin.protocol !== 'https:') throw new Error('FRONTEND_ORIGIN moet HTTPS gebruiken in productie')
    if (!isAbsolute(uploadDir)) throw new Error('UPLOAD_DIR moet in productie een absoluut pad zijn')
    if (!['127.0.0.1', '::1', 'localhost'].includes(host) && !boolean(environment.ALLOW_PUBLIC_API_BIND)) throw new Error('API_HOST moet in productie lokaal gebonden zijn; zet ALLOW_PUBLIC_API_BIND alleen voor een bewust beveiligde netwerkopstelling')
  }

  return {
    production,
    port: integer(environment, 'API_PORT', 3001, 1, 65_535),
    host,
    authMode,
    frontendOrigin: origin.origin,
    databaseUrl,
    databaseSsl: boolean(environment.DATABASE_SSL),
    uploadDir,
    trustProxy: production || boolean(environment.TRUST_PROXY),
    rateLimitMax: integer(environment, 'RATE_LIMIT_MAX', production ? 300 : 5_000, 10, 100_000),
    rateLimitWindowMs: integer(environment, 'RATE_LIMIT_WINDOW_MS', 60_000, 1_000, 3_600_000),
    release: environment.BUILD_SHA?.trim() || (production ? 'unknown' : 'development'),
  }
}
