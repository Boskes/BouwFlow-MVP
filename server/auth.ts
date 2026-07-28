import { createRemoteJWKSet, jwtVerify } from 'jose'
import type { FastifyRequest } from 'fastify'
import { DEVELOPMENT_TENANT_ID, DEVELOPMENT_USER_ID, type RequestContext } from './context.js'

declare module 'fastify' {
  interface FastifyRequest {
    context: RequestContext
  }
}

export type AuthMode = 'development' | 'entra'

const header = (request: FastifyRequest, name: string) => {
  const value = request.headers[name]
  return Array.isArray(value) ? value[0] : value
}

export function createAuthenticator(mode: AuthMode) {
  if (mode === 'development') {
    return async (request: FastifyRequest) => {
      request.context = {
        tenantId: header(request, 'x-tenant-id') ?? DEVELOPMENT_TENANT_ID,
        userId: header(request, 'x-user-id') ?? DEVELOPMENT_USER_ID,
        displayName: header(request, 'x-user-name') ?? 'Lokale ontwikkelaar',
        email: header(request, 'x-user-email') ?? 'developer@localhost',
        roles: (header(request, 'x-user-roles') ?? 'Administrator').split(',').map(role => role.trim()),
      }
    }
  }

  const tenantId = requiredEnvironment('ENTRA_TENANT_ID')
  const audience = requiredEnvironment('ENTRA_CLIENT_ID')
  const issuer = `https://login.microsoftonline.com/${tenantId}/v2.0`
  const jwks = createRemoteJWKSet(new URL(`https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`))

  return async (request: FastifyRequest) => {
    const authorization = header(request, 'authorization')
    if (!authorization?.startsWith('Bearer ')) throw new AuthenticationError('Bearer-token ontbreekt')
    try {
      const { payload } = await jwtVerify(authorization.slice(7), jwks, { issuer, audience })
      if (typeof payload.tid !== 'string' || typeof payload.oid !== 'string') throw new AuthenticationError('Token bevat geen tenant- of gebruikersidentiteit')
      request.context = {
        tenantId: payload.tid,
        userId: payload.oid,
        displayName: typeof payload.name === 'string' ? payload.name : 'Microsoft-gebruiker',
        email: typeof payload.preferred_username === 'string' ? payload.preferred_username : `${payload.oid}@entra.local`,
        roles: Array.isArray(payload.roles) ? payload.roles.filter((role): role is string => typeof role === 'string') : [],
      }
    } catch (error) {
      if (error instanceof AuthenticationError) throw error
      throw new AuthenticationError('Ongeldig of verlopen toegangstoken')
    }
  }
}

export function requireRoles(...allowedRoles: string[]) {
  return async (request: FastifyRequest) => {
    if (!request.context.roles.some(role => allowedRoles.includes(role))) {
      throw new AuthorizationError('Je hebt onvoldoende rechten voor deze actie')
    }
  }
}

export async function requireAllLegalEntities(request: FastifyRequest) {
  if (request.context.allLegalEntities === false) throw new AuthorizationError('Alleen gebruikers met toegang tot alle entiteiten kunnen deze instelling beheren')
}

function requiredEnvironment(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is verplicht wanneer AUTH_MODE=entra`)
  return value
}

export class AuthenticationError extends Error {
  readonly statusCode = 401
}

export class AuthorizationError extends Error {
  readonly statusCode = 403
}
