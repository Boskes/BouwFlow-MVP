import { describe, expect, it } from 'vitest'
import { readServerConfig } from './config.js'

const productionEnvironment = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://bouwflow:secret@127.0.0.1:5432/bouwflow',
  AUTH_MODE: 'entra',
  ENTRA_TENANT_ID: 'tenant-id',
  ENTRA_CLIENT_ID: 'client-id',
  FRONTEND_ORIGIN: 'https://bouwflow.example',
  UPLOAD_DIR: '/var/lib/bouwflow/uploads',
  API_HOST: '127.0.0.1',
} satisfies NodeJS.ProcessEnv

describe('serverconfiguratie', () => {
  it('leest een fail-closed productieconfiguratie', () => {
    expect(readServerConfig(productionEnvironment)).toMatchObject({ production: true, authMode: 'entra', trustProxy: true, frontendOrigin: 'https://bouwflow.example', rateLimitMax: 300 })
  })

  it('weigert development-authenticatie en HTTP in productie', () => {
    expect(() => readServerConfig({ ...productionEnvironment, AUTH_MODE: 'development' })).toThrow('AUTH_MODE=entra')
    expect(() => readServerConfig({ ...productionEnvironment, FRONTEND_ORIGIN: 'http://bouwflow.example' })).toThrow('HTTPS')
  })

  it('weigert relatieve opslag en een publieke API-binding zonder expliciete toestemming', () => {
    expect(() => readServerConfig({ ...productionEnvironment, UPLOAD_DIR: '.data/uploads' })).toThrow('absoluut pad')
    expect(() => readServerConfig({ ...productionEnvironment, API_HOST: '0.0.0.0' })).toThrow('API_HOST')
    expect(readServerConfig({ ...productionEnvironment, API_HOST: '0.0.0.0', ALLOW_PUBLIC_API_BIND: 'true' }).host).toBe('0.0.0.0')
  })

  it('valideert numerieke grenzen en de frontend-origin', () => {
    expect(() => readServerConfig({ ...productionEnvironment, API_PORT: '70000' })).toThrow('API_PORT')
    expect(() => readServerConfig({ ...productionEnvironment, FRONTEND_ORIGIN: 'https://bouwflow.example/app' })).toThrow('geen pad')
  })
})
