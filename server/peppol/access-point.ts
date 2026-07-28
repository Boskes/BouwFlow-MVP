import type { PeppolDeliveryStatus } from '../../src/domain.js'

export interface PeppolSendRequest {
  xml: string
  senderEndpoint: string
  recipientEndpoint: string
  documentTypeId: string
  processId: string
  idempotencyKey: string
  callbackUrl?: string
}

export interface PeppolTransportResult {
  status: PeppolDeliveryStatus
  provider: string
  providerReference?: string
  message: string
  eventId?: string
}

export interface PeppolAccessPoint {
  readonly configured?: boolean
  send(request: PeppolSendRequest): Promise<PeppolTransportResult>
  status(providerReference: string): Promise<PeppolTransportResult>
}

export interface PeppolProviderResponse {
  accepted?: boolean
  status?: string
  reference?: string
  trackingId?: string
  provider?: string
  message?: string
  eventId?: string
}

const statusMap: Record<string, PeppolDeliveryStatus> = {
  queued: 'In wachtrij', pending: 'In wachtrij', accepted: 'Geaccepteerd', submitted: 'Geaccepteerd',
  delivered: 'Afgeleverd', completed: 'Afgeleverd', rejected: 'Geweigerd', failed: 'Fout', error: 'Fout',
}

export function isKnownPeppolProviderStatus(status: string) {
  return Boolean(statusMap[status.trim().toLowerCase()])
}

export function peppolTransportResultFromProvider(parsed: PeppolProviderResponse, fallbackProvider = 'Peppol-accesspoint'): PeppolTransportResult {
  const normalized = parsed.status?.trim().toLowerCase()
  const status = normalized && statusMap[normalized] ? statusMap[normalized] : parsed.accepted ? 'Geaccepteerd' : 'Fout'
  return { status, provider: parsed.provider ?? fallbackProvider, providerReference: parsed.reference ?? parsed.trackingId, message: parsed.message ?? (status === 'Geaccepteerd' ? 'Document door accesspoint geaccepteerd' : `Providerstatus: ${parsed.status ?? 'onbekend'}`), eventId: parsed.eventId }
}

function parseProviderResponse(body: string, fallbackProvider: string): PeppolTransportResult {
  return peppolTransportResultFromProvider(JSON.parse(body) as PeppolProviderResponse, fallbackProvider)
}

export class HttpPeppolAccessPoint implements PeppolAccessPoint {
  readonly configured = true

  constructor(private readonly url: string, private readonly token = '', private readonly fetcher: typeof fetch = fetch) {}

  private headers(extra: Record<string, string> = {}) {
    return { Accept: 'application/json', ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}), ...extra }
  }

  async send(request: PeppolSendRequest): Promise<PeppolTransportResult> {
    try {
      const response = await this.fetcher(this.url, {
        method: 'POST', body: request.xml, signal: AbortSignal.timeout(30_000),
        headers: this.headers({ 'Content-Type': 'application/xml; charset=utf-8', 'Idempotency-Key': request.idempotencyKey, 'X-Peppol-Sender': request.senderEndpoint, 'X-Peppol-Recipient': request.recipientEndpoint, 'X-Peppol-Document-Type': request.documentTypeId, 'X-Peppol-Process': request.processId, ...(request.callbackUrl ? { 'X-Peppol-Webhook': request.callbackUrl } : {}) }),
      })
      const body = await response.text()
      if (!response.ok) return { status: response.status >= 400 && response.status < 500 ? 'Geweigerd' : 'Fout', provider: 'Peppol-accesspoint', message: `Accesspoint antwoordde met HTTP ${response.status}: ${body.slice(0, 500)}` }
      return parseProviderResponse(body, 'Peppol-accesspoint')
    } catch (error) {
      return { status: 'Fout', provider: 'Peppol-accesspoint', message: error instanceof Error ? error.message : 'Het accesspoint is niet bereikbaar' }
    }
  }

  async status(providerReference: string): Promise<PeppolTransportResult> {
    try {
      const response = await this.fetcher(`${this.url.replace(/\/$/, '')}/${encodeURIComponent(providerReference)}`, { headers: this.headers(), signal: AbortSignal.timeout(20_000) })
      const body = await response.text()
      if (!response.ok) return { status: 'Fout', provider: 'Peppol-accesspoint', providerReference, message: `Statuscontrole antwoordde met HTTP ${response.status}: ${body.slice(0, 500)}` }
      return { ...parseProviderResponse(body, 'Peppol-accesspoint'), providerReference }
    } catch (error) {
      return { status: 'Fout', provider: 'Peppol-accesspoint', providerReference, message: error instanceof Error ? error.message : 'De accesspointstatus is niet bereikbaar' }
    }
  }
}

export class UnconfiguredPeppolAccessPoint implements PeppolAccessPoint {
  readonly configured = false

  async send(): Promise<PeppolTransportResult> { return { status: 'Fout', provider: 'Niet geconfigureerd', message: 'PEPPOL_ACCESS_POINT_URL is niet ingesteld' } }
  async status(providerReference: string): Promise<PeppolTransportResult> { return { status: 'Fout', provider: 'Niet geconfigureerd', providerReference, message: 'PEPPOL_ACCESS_POINT_URL is niet ingesteld' } }
}

export function createPeppolAccessPoint(url = process.env.PEPPOL_ACCESS_POINT_URL, token = process.env.PEPPOL_ACCESS_POINT_TOKEN): PeppolAccessPoint {
  return url ? new HttpPeppolAccessPoint(url, token) : new UnconfiguredPeppolAccessPoint()
}
