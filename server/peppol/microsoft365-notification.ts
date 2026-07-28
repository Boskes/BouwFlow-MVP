import type { PeppolNotification, PeppolNotificationChannel } from '../../src/domain.js'
import type { PeppolNotificationSender } from './notification.js'

interface TokenResponse { access_token?: string; expires_in?: number; error?: string; error_description?: string }

export interface Microsoft365NotificationConfig {
  tenantId?: string
  clientId?: string
  clientSecret?: string
  senderMailbox?: string
  teamsWebhooks?: Record<string, string>
}

export class MicrosoftGraphTokenProvider {
  private cached?: { token: string; expiresAt: number }

  constructor(
    private readonly tenantId: string,
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  invalidate() { this.cached = undefined }

  async accessToken() {
    if (this.cached && this.cached.expiresAt > Date.now() + 60_000) return this.cached.token
    const response = await this.fetcher(`https://login.microsoftonline.com/${encodeURIComponent(this.tenantId)}/oauth2/v2.0/token`, {
      method: 'POST', signal: AbortSignal.timeout(20_000), headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({ client_id: this.clientId, client_secret: this.clientSecret, scope: 'https://graph.microsoft.com/.default', grant_type: 'client_credentials' }),
    })
    const payload = await response.json() as TokenResponse
    if (!response.ok || !payload.access_token) throw new Error(`Microsoft Graph-tokenaanvraag mislukt: ${payload.error_description ?? payload.error ?? `HTTP ${response.status}`}`)
    const expiresIn = Math.max(60, Number(payload.expires_in ?? 3600))
    this.cached = { token: payload.access_token, expiresAt: Date.now() + expiresIn * 1000 }
    return payload.access_token
  }
}

function normalizedTeamsWebhooks(webhooks: Record<string, string>) {
  return new Map(Object.entries(webhooks).map(([target, value]) => {
    const destination = target.trim()
    const url = new URL(value)
    if (!destination) throw new Error('Een Teams-webhookdoel mag niet leeg zijn')
    if (url.protocol !== 'https:') throw new Error(`Teams-webhook voor ${destination} moet HTTPS gebruiken`)
    return [destination, url.toString()] as const
  }))
}

export class Microsoft365PeppolNotificationSender implements PeppolNotificationSender {
  private readonly teamsWebhooks: Map<string, string>
  readonly configuredChannels: readonly PeppolNotificationChannel[]

  constructor(
    private readonly senderMailbox: string | undefined,
    private readonly tokenProvider: MicrosoftGraphTokenProvider | undefined,
    teamsWebhooks: Record<string, string> = {},
    private readonly fetcher: typeof fetch = fetch,
  ) {
    this.teamsWebhooks = normalizedTeamsWebhooks(teamsWebhooks)
    this.configuredChannels = [...(senderMailbox && tokenProvider ? ['E-mail' as const] : []), ...(this.teamsWebhooks.size ? ['Teams' as const] : [])]
  }

  async send(notification: PeppolNotification) {
    if (notification.channel === 'E-mail') return this.sendEmail(notification)
    return this.sendTeams(notification)
  }

  private async graphSendMail(notification: PeppolNotification, token: string) {
    return this.fetcher(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(this.senderMailbox!)}/sendMail`, {
      method: 'POST', signal: AbortSignal.timeout(20_000), headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        message: {
          subject: notification.subject,
          body: { contentType: 'Text', content: notification.message },
          toRecipients: [{ emailAddress: { address: notification.destination } }],
          internetMessageHeaders: [{ name: 'x-bouwflow-notification-id', value: notification.id }],
        },
        saveToSentItems: true,
      }),
    })
  }

  private async sendEmail(notification: PeppolNotification) {
    if (!this.senderMailbox || !this.tokenProvider) throw new Error('Microsoft 365 e-mailnotificaties zijn niet volledig geconfigureerd')
    let response = await this.graphSendMail(notification, await this.tokenProvider.accessToken())
    if (response.status === 401) {
      this.tokenProvider.invalidate()
      response = await this.graphSendMail(notification, await this.tokenProvider.accessToken())
    }
    if (!response.ok) throw new Error(`Microsoft Graph sendMail antwoordde met HTTP ${response.status}: ${(await response.text()).slice(0, 500)}`)
  }

  private async sendTeams(notification: PeppolNotification) {
    const webhookUrl = this.teamsWebhooks.get(notification.destination)
    if (!webhookUrl) throw new Error(`Geen Teams Workflow-webhook geconfigureerd voor ${notification.destination}`)
    const response = await this.fetcher(webhookUrl, {
      method: 'POST', signal: AbortSignal.timeout(20_000), headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        type: 'message',
        attachments: [{
          contentType: 'application/vnd.microsoft.card.adaptive', contentUrl: null,
          content: {
            $schema: 'http://adaptivecards.io/schemas/adaptive-card.json', type: 'AdaptiveCard', version: '1.2',
            body: [
              { type: 'TextBlock', size: 'Medium', weight: 'Bolder', text: notification.subject, wrap: true },
              { type: 'TextBlock', text: notification.message, wrap: true },
              { type: 'FactSet', facts: [{ title: 'Type', value: notification.kind }, { title: 'BouwFlow-ID', value: notification.id }] },
            ],
          },
        }],
      }),
    })
    if (!response.ok) throw new Error(`Teams Workflow-webhook antwoordde met HTTP ${response.status}: ${(await response.text()).slice(0, 500)}`)
  }
}

export function createMicrosoft365PeppolNotificationSender(config: Microsoft365NotificationConfig, fetcher: typeof fetch = fetch): Microsoft365PeppolNotificationSender | undefined {
  const mailValues = [config.tenantId, config.clientId, config.clientSecret, config.senderMailbox]
  const hasSomeMailConfig = mailValues.some(Boolean)
  const hasCompleteMailConfig = mailValues.every(Boolean)
  if (hasSomeMailConfig && !hasCompleteMailConfig) throw new Error('Microsoft 365 e-mailconfiguratie is onvolledig; tenant, client, secret en afzender zijn alle vier vereist')
  const teamsWebhooks = config.teamsWebhooks ?? {}
  if (!hasCompleteMailConfig && !Object.keys(teamsWebhooks).length) return undefined
  const tokenProvider = hasCompleteMailConfig ? new MicrosoftGraphTokenProvider(config.tenantId!, config.clientId!, config.clientSecret!, fetcher) : undefined
  return new Microsoft365PeppolNotificationSender(config.senderMailbox, tokenProvider, teamsWebhooks, fetcher)
}

export function teamsWebhooksFromJson(value = ''): Record<string, string> {
  if (!value.trim()) return {}
  const parsed = JSON.parse(value) as unknown
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || Object.values(parsed).some(url => typeof url !== 'string')) throw new Error('PEPPOL_TEAMS_WEBHOOKS_JSON moet een JSON-object met tekenreekswaarden zijn')
  return parsed as Record<string, string>
}
