import type { AiAnalysis, AiAnalysisInput, DocumentRecipient, DocumentVersion, IntegrationConnection, IntegrationJob, Project, ProjectDocument, Quote } from '../src/domain.js'

export interface IntegrationGateway {
  test(connection: IntegrationConnection): Promise<void>
  dispatch(connection: IntegrationConnection, job: IntegrationJob): Promise<void>
}

export interface AiGatewayInput {
  project: Project
  request: AiAnalysisInput
  sources: AiAnalysis['sources']
}

export interface AiGateway {
  analyze(input: AiGatewayInput): Promise<{ answer: string; sourceIds: string[] }>
}

export interface QuoteMailInput {
  quote: Quote
  recipient: string
  sentBy: string
  pdf: Buffer
  idempotencyKey: string
}

export interface QuoteMailGateway {
  send(input: QuoteMailInput): Promise<{ providerReference?: string }>
}

export interface DocumentMailInput {
  document: ProjectDocument
  version: DocumentVersion
  recipient: Pick<DocumentRecipient, 'name' | 'email'>
  data: Buffer
  idempotencyKey: string
}

export interface DocumentMailGateway {
  send(input: DocumentMailInput): Promise<{ providerReference?: string }>
}

export class EnterpriseGatewayError extends Error {}

const fetchJson = async (url: string, init: RequestInit, timeoutMs: number) => {
  const response = await fetch(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(timeoutMs) })
  if (!response.ok) throw new EnterpriseGatewayError(`Adapter antwoordde met HTTP ${response.status}`)
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.toLocaleLowerCase().includes('application/json')) throw new EnterpriseGatewayError('Adapter moet JSON antwoorden')
  return response.json() as Promise<unknown>
}

const parseTokenMap = (raw: string | undefined) => {
  if (!raw?.trim()) return new Map<string, string>()
  const parsed = JSON.parse(raw) as unknown
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new EnterpriseGatewayError('INTEGRATION_TOKENS_JSON moet een JSON-object zijn')
  return new Map(Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
}

export class HttpIntegrationGateway implements IntegrationGateway {
  private readonly allowedOrigins: Set<string>
  private readonly tokens: Map<string, string>

  constructor(allowedOrigins: readonly string[], tokensJson?: string, private readonly timeoutMs = 15_000) {
    this.allowedOrigins = new Set(allowedOrigins.map(value => new URL(value).origin))
    this.tokens = parseTokenMap(tokensJson)
  }

  private target(connection: IntegrationConnection) {
    let url: URL
    try { url = new URL(connection.endpoint) } catch { throw new EnterpriseGatewayError('Connectorendpoint is geen geldige absolute URL') }
    if (url.protocol !== 'https:') throw new EnterpriseGatewayError('Connectorendpoint moet HTTPS gebruiken')
    if (!this.allowedOrigins.has(url.origin)) throw new EnterpriseGatewayError('Connectorendpoint staat niet op de productie-allowlist')
    return url
  }

  private headers(url: URL, idempotencyKey: string) {
    const token = this.tokens.get(url.origin)
    return { 'content-type': 'application/json', 'idempotency-key': idempotencyKey, ...(token ? { authorization: `Bearer ${token}` } : {}) }
  }

  async test(connection: IntegrationConnection) {
    const url = this.target(connection)
    await fetchJson(url.href, { method: 'POST', headers: this.headers(url, connection.id), body: JSON.stringify({ operation: 'test', provider: connection.provider, connectionId: connection.id }) }, this.timeoutMs)
  }

  async dispatch(connection: IntegrationConnection, job: IntegrationJob) {
    const url = this.target(connection)
    await fetchJson(url.href, { method: 'POST', headers: this.headers(url, job.id), body: JSON.stringify({ operation: 'process', provider: connection.provider, job: { id: job.id, entityType: job.entityType, entityId: job.entityId, direction: job.direction, payloadDigest: job.payloadDigest, createdAt: job.createdAt } }) }, this.timeoutMs)
  }
}

export class DevelopmentIntegrationGateway implements IntegrationGateway {
  async test(connection: IntegrationConnection) {
    if (!connection.endpoint.trim()) throw new EnterpriseGatewayError('Endpoint ontbreekt')
  }
  async dispatch() {}
}

export class DisabledIntegrationGateway implements IntegrationGateway {
  async test() { throw new EnterpriseGatewayError('Geen productie-integratiegateway geconfigureerd') }
  async dispatch() { throw new EnterpriseGatewayError('Geen productie-integratiegateway geconfigureerd') }
}

export class HttpAiGateway implements AiGateway {
  constructor(private readonly url: string, private readonly token: string, private readonly timeoutMs = 30_000) {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') throw new EnterpriseGatewayError('AI_GATEWAY_URL moet HTTPS gebruiken')
  }

  async analyze(input: AiGatewayInput) {
    const result = await fetchJson(this.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.token}` },
      body: JSON.stringify({ project: { id: input.project.id, number: input.project.number, name: input.project.name }, request: input.request, sources: input.sources }),
    }, this.timeoutMs)
    if (!result || typeof result !== 'object') throw new EnterpriseGatewayError('AI-gateway gaf geen geldig antwoord')
    const answer = 'answer' in result && typeof result.answer === 'string' ? result.answer.trim() : ''
    const sourceIds = 'sourceIds' in result && Array.isArray(result.sourceIds) ? result.sourceIds.filter((value): value is string => typeof value === 'string') : []
    if (!answer || !sourceIds.length) throw new EnterpriseGatewayError('AI-antwoord moet tekst en minstens één bron-ID bevatten')
    const allowed = new Set(input.sources.map(source => source.documentId).filter(Boolean))
    if (sourceIds.some(id => !allowed.has(id))) throw new EnterpriseGatewayError('AI-antwoord verwijst naar een onbekende bron')
    return { answer, sourceIds }
  }
}

export class DevelopmentAiGateway implements AiGateway {
  async analyze({ project, request, sources }: AiGatewayInput) {
    const answer = request.type === 'Ontbrekende documenten'
      ? `Controleer voor ${project.name} minstens contract, goedgekeurde plannen, vergunningen, veiligheidsdocumenten en as-built-verplichtingen.`
      : request.type === 'Contractrisico'
        ? `Verifieer voor ${project.name} termijnen, boetes, prijsherziening en bewijsvereisten in de geciteerde bronnen.`
        : `Analyse voor ${project.name}: ${request.question}. Controleer de geciteerde bronnen vóór gebruik.`
    return { answer, sourceIds: sources.map(source => source.documentId).filter((id): id is string => Boolean(id)) }
  }
}

export class DisabledAiGateway implements AiGateway {
  async analyze(): Promise<never> { throw new EnterpriseGatewayError('Geen productie-AI-gateway geconfigureerd') }
}

export class HttpQuoteMailGateway implements QuoteMailGateway {
  private readonly endpoint: URL

  constructor(url: string, private readonly token: string, private readonly timeoutMs = 30_000) {
    this.endpoint = new URL(url)
    if (this.endpoint.protocol !== 'https:') throw new EnterpriseGatewayError('QUOTE_MAIL_GATEWAY_URL moet HTTPS gebruiken')
  }

  async send(input: QuoteMailInput) {
    const result = await fetchJson(this.endpoint.href, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.token}`, 'idempotency-key': input.idempotencyKey },
      body: JSON.stringify({
        to: input.recipient,
        subject: input.quote.content.subject,
        body: input.quote.content.introduction,
        sentBy: input.sentBy,
        attachment: { fileName: `${input.quote.number}.pdf`, contentType: 'application/pdf', base64: input.pdf.toString('base64') },
        metadata: { quoteId: input.quote.id, quoteNumber: input.quote.number, version: input.quote.version },
      }),
    }, this.timeoutMs)
    const providerReference = result && typeof result === 'object' && 'providerReference' in result && typeof result.providerReference === 'string' ? result.providerReference : undefined
    return { providerReference }
  }
}

export class DevelopmentQuoteMailGateway implements QuoteMailGateway {
  async send(input: QuoteMailInput) { return { providerReference: `development:${input.quote.id}` } }
}

export class DisabledQuoteMailGateway implements QuoteMailGateway {
  async send(): Promise<never> { throw new EnterpriseGatewayError('Geen productie-offertemailgateway geconfigureerd') }
}

export class HttpDocumentMailGateway implements DocumentMailGateway {
  private readonly endpoint: URL

  constructor(url: string, private readonly token: string, private readonly timeoutMs = 30_000) {
    this.endpoint = new URL(url)
    if (this.endpoint.protocol !== 'https:') throw new EnterpriseGatewayError('DOCUMENT_MAIL_GATEWAY_URL moet HTTPS gebruiken')
  }

  async send(input: DocumentMailInput) {
    const result = await fetchJson(this.endpoint.href, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.token}`, 'idempotency-key': input.idempotencyKey },
      body: JSON.stringify({
        to: input.recipient.email,
        recipientName: input.recipient.name,
        subject: `${input.document.title} · revisie ${input.version.revisionLabel}`,
        body: `U ontvangt de goedgekeurde revisie ${input.version.revisionLabel} van ${input.document.title}.`,
        attachment: { fileName: input.version.fileName, contentType: input.version.mimeType, base64: input.data.toString('base64') },
        metadata: { documentId: input.document.id, versionId: input.version.id, revision: input.version.revisionLabel },
      }),
    }, this.timeoutMs)
    const providerReference = result && typeof result === 'object' && 'providerReference' in result && typeof result.providerReference === 'string' ? result.providerReference : undefined
    return { providerReference }
  }
}

export class DevelopmentDocumentMailGateway implements DocumentMailGateway {
  async send(input: DocumentMailInput) { return { providerReference: `development:${input.version.id}:${input.recipient.email}` } }
}

export class DisabledDocumentMailGateway implements DocumentMailGateway {
  async send(): Promise<never> { throw new EnterpriseGatewayError('Geen productie-documentmailgateway geconfigureerd') }
}

export const createIntegrationGateway = (production: boolean, environment: NodeJS.ProcessEnv = process.env): IntegrationGateway => {
  const origins = (environment.INTEGRATION_ALLOWED_ORIGINS ?? '').split(',').map(value => value.trim()).filter(Boolean)
  return origins.length ? new HttpIntegrationGateway(origins, environment.INTEGRATION_TOKENS_JSON) : production ? new DisabledIntegrationGateway() : new DevelopmentIntegrationGateway()
}

export const createAiGateway = (production: boolean, environment: NodeJS.ProcessEnv = process.env): AiGateway => {
  const url = environment.AI_GATEWAY_URL?.trim()
  const token = environment.AI_GATEWAY_TOKEN?.trim()
  if (url && token) return new HttpAiGateway(url, token)
  return production ? new DisabledAiGateway() : new DevelopmentAiGateway()
}

export const createQuoteMailGateway = (production: boolean, environment: NodeJS.ProcessEnv = process.env): QuoteMailGateway => {
  const url = environment.QUOTE_MAIL_GATEWAY_URL?.trim()
  const token = environment.QUOTE_MAIL_GATEWAY_TOKEN?.trim()
  if (url && token) return new HttpQuoteMailGateway(url, token)
  return production ? new DisabledQuoteMailGateway() : new DevelopmentQuoteMailGateway()
}

export const createDocumentMailGateway = (production: boolean, environment: NodeJS.ProcessEnv = process.env): DocumentMailGateway => {
  const url = environment.DOCUMENT_MAIL_GATEWAY_URL?.trim() || environment.QUOTE_MAIL_GATEWAY_URL?.trim()
  const token = environment.DOCUMENT_MAIL_GATEWAY_TOKEN?.trim() || environment.QUOTE_MAIL_GATEWAY_TOKEN?.trim()
  if (url && token) return new HttpDocumentMailGateway(url, token)
  return production ? new DisabledDocumentMailGateway() : new DevelopmentDocumentMailGateway()
}
