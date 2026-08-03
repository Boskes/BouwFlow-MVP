import { createHash } from 'node:crypto'
import type { CheckinatworkCancellationReason, CheckinatworkParticipant, CheckinatworkParticipantInput, CheckinatworkSite } from '../src/domain.js'

export interface CheckinatworkRegistrationGatewayInput {
  site: CheckinatworkSite
  participant: CheckinatworkParticipant
  registrationDate: string
  clientReference: string
}

export interface CheckinatworkGatewayResult {
  providerRegistrationId: string
  receiptNumber: string
  confirmedAt: string
}

export interface CheckinatworkGateway {
  readonly provider: string
  readonly productionConfigured: boolean
  readonly productionEnabled: boolean
  provisionIdentity(input: CheckinatworkParticipantInput): Promise<{ secureIdentityReference: string; identifierLast4: string }>
  register(input: CheckinatworkRegistrationGatewayInput): Promise<CheckinatworkGatewayResult>
  cancel(input: { site: CheckinatworkSite; registrationId: string; providerRegistrationId: string; reason: CheckinatworkCancellationReason }): Promise<{ cancelledAt: string }>
}

export class CheckinatworkGatewayError extends Error {
  constructor(message: string, readonly code = 'CAW_GATEWAY_ERROR') { super(message) }
}

const digest = (value: string) => createHash('sha256').update(value).digest('hex')
const identifierLast4 = (value: string) => value.replace(/\D/g, '').slice(-4).padStart(4, '\u2022')

export class SimulationCheckinatworkGateway implements CheckinatworkGateway {
  readonly provider = 'BouwFlow RSZ-simulator'
  readonly productionConfigured = false
  readonly productionEnabled = false

  async provisionIdentity(input: CheckinatworkParticipantInput) {
    const normalized = input.identifier.replace(/\D/g, '')
    if (input.identifierType === 'INSZ' && normalized.length !== 11) throw new CheckinatworkGatewayError('Een INSZ moet 11 cijfers bevatten', 'INVALID_INSS')
    if (input.identifierType === 'Limosa' && normalized.length !== 17) throw new CheckinatworkGatewayError('Een Limosa-ID moet 17 cijfers bevatten', 'INVALID_LIMOSA')
    return { secureIdentityReference: `sim:${digest(`${input.identifierType}:${normalized}`).slice(0, 32)}`, identifierLast4: identifierLast4(normalized) }
  }

  async register(input: CheckinatworkRegistrationGatewayInput) {
    if (!input.site.workPlaceId.trim()) throw new CheckinatworkGatewayError('Het RSZ-werkplaatsnummer ontbreekt', 'INVALID_WORKPLACE')
    if (!input.participant.secureIdentityReference) throw new CheckinatworkGatewayError('De identiteit is niet veilig geprovisioneerd', 'IDENTITY_MISSING')
    const token = digest(`${input.site.workPlaceId}:${input.participant.secureIdentityReference}:${input.registrationDate}:${input.clientReference}`).toUpperCase()
    return { providerRegistrationId: `SIM-${token.slice(0, 12)}`, receiptNumber: `CAW-SIM-${token.slice(12, 24)}`, confirmedAt: new Date().toISOString() }
  }

  async cancel(input: { registrationId: string }) {
    if (!input.registrationId) throw new CheckinatworkGatewayError('Registratie ontbreekt', 'REGISTRATION_MISSING')
    return { cancelledAt: new Date().toISOString() }
  }
}

type AdapterResponse = { secureIdentityReference?: string; identifierLast4?: string; providerRegistrationId?: string; receiptNumber?: string; confirmedAt?: string; cancelledAt?: string; errorCode?: string; message?: string }

export class HttpCheckinatworkGateway implements CheckinatworkGateway {
  readonly provider = 'RSZ PresenceRegistration v1.11 adapter'
  readonly productionConfigured = true
  readonly productionEnabled: boolean
  private readonly endpoint: URL

  constructor(url: string, private readonly token: string, productionEnabled: boolean, private readonly timeoutMs = 30_000) {
    this.endpoint = new URL(url)
    if (this.endpoint.protocol !== 'https:') throw new CheckinatworkGatewayError('De Checkinatwork-adapter moet HTTPS gebruiken', 'INSECURE_ENDPOINT')
    this.productionEnabled = productionEnabled
  }

  private async request(operation: string, payload: unknown, idempotencyKey: string) {
    const response = await fetch(this.endpoint, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(this.timeoutMs), headers: { 'content-type': 'application/json', authorization: `Bearer ${this.token}`, 'idempotency-key': idempotencyKey }, body: JSON.stringify({ operation, protocol: 'PresenceRegistration-v1.11-SAML-HOK-SHA256', payload }) })
    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.toLocaleLowerCase().includes('application/json')) throw new CheckinatworkGatewayError(`Adapter antwoordde met HTTP ${response.status} zonder JSON`, 'INVALID_ADAPTER_RESPONSE')
    const result = await response.json() as AdapterResponse
    if (!response.ok || result.errorCode) throw new CheckinatworkGatewayError(result.message || `Adapter antwoordde met HTTP ${response.status}`, result.errorCode || 'ADAPTER_REJECTED')
    return result
  }

  async provisionIdentity(input: CheckinatworkParticipantInput) {
    const result = await this.request('provisionIdentity', { identifierType: input.identifierType, identifier: input.identifier, displayName: input.displayName }, `identity:${digest(`${input.projectId}:${input.identifierType}:${input.identifier}`)}`)
    if (!result.secureIdentityReference) throw new CheckinatworkGatewayError('Adapter gaf geen veilige identiteitsreferentie terug', 'IDENTITY_REFERENCE_MISSING')
    return { secureIdentityReference: result.secureIdentityReference, identifierLast4: result.identifierLast4 || identifierLast4(input.identifier) }
  }

  async register(input: CheckinatworkRegistrationGatewayInput) {
    if (!this.productionEnabled) throw new CheckinatworkGatewayError('Productieregistraties zijn administratief nog niet vrijgegeven', 'PRODUCTION_DISABLED')
    const result = await this.request('registerPresences', { registrationDate: input.registrationDate, workPlaceId: input.site.workPlaceId, companyId: input.participant.employerCompanyNumber, secureIdentityReference: input.participant.secureIdentityReference, clientPresenceRegistrationReference: input.clientReference }, input.clientReference)
    if (!result.providerRegistrationId || !result.receiptNumber) throw new CheckinatworkGatewayError('RSZ-adapter gaf geen registratie-ID en ontvangstnummer terug', 'RECEIPT_MISSING')
    return { providerRegistrationId: result.providerRegistrationId, receiptNumber: result.receiptNumber, confirmedAt: result.confirmedAt || new Date().toISOString() }
  }

  async cancel(input: { site: CheckinatworkSite; registrationId: string; providerRegistrationId: string; reason: CheckinatworkCancellationReason }) {
    if (!this.productionEnabled) throw new CheckinatworkGatewayError('Productieannuleringen zijn administratief nog niet vrijgegeven', 'PRODUCTION_DISABLED')
    const result = await this.request('cancelPresences', { presenceRegistrationId: input.providerRegistrationId, cancellationReason: input.reason, workPlaceId: input.site.workPlaceId }, `cancel:${input.registrationId}`)
    return { cancelledAt: result.cancelledAt || new Date().toISOString() }
  }
}

export const createCheckinatworkGateway = (environment: NodeJS.ProcessEnv = process.env): CheckinatworkGateway => {
  const url = environment.CHECKINATWORK_ADAPTER_URL?.trim()
  const token = environment.CHECKINATWORK_ADAPTER_TOKEN?.trim()
  const enabled = ['1', 'true', 'yes', 'ja'].includes(environment.CHECKINATWORK_PRODUCTION_ENABLED?.trim().toLocaleLowerCase() ?? '')
  return url && token ? new HttpCheckinatworkGateway(url, token, enabled) : new SimulationCheckinatworkGateway()
}
