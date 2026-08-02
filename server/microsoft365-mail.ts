import { MicrosoftGraphTokenProvider } from './peppol/microsoft365-notification.js'

export interface CentralMailAttachment { fileName: string; contentType: string; data: Buffer }
export interface CentralMailInput { to: string[]; cc?: string[]; subject: string; body: string; contentType?: 'Text' | 'HTML'; attachments?: CentralMailAttachment[]; idempotencyKey: string }
export interface CentralMailMessage {
  providerMessageId: string
  internetMessageId?: string
  conversationId?: string
  correlationKey?: string
  direction: 'Inkomend' | 'Uitgaand'
  fromName: string
  fromAddress: string
  toRecipients: Array<{ name: string; address: string }>
  ccRecipients: Array<{ name: string; address: string }>
  subject: string
  bodyPreview: string
  receivedAt?: string
  sentAt?: string
  isRead: boolean
  hasAttachments: boolean
  webLink?: string
}
export interface CentralMailService {
  readonly configured: boolean
  readonly mailbox?: string
  send(input: CentralMailInput): Promise<{ providerReference?: string }>
  synchronize(): Promise<CentralMailMessage[]>
}

interface GraphAddress { emailAddress?: { name?: string; address?: string } }
interface GraphMessage { id?: string; internetMessageId?: string; conversationId?: string; subject?: string; bodyPreview?: string; from?: GraphAddress; toRecipients?: GraphAddress[]; ccRecipients?: GraphAddress[]; receivedDateTime?: string; sentDateTime?: string; isRead?: boolean; hasAttachments?: boolean; webLink?: string; internetMessageHeaders?: Array<{ name?: string; value?: string }> }
interface GraphMessagePage { value?: GraphMessage[]; '@odata.nextLink'?: string }
const address = (value: GraphAddress | undefined) => ({ name: value?.emailAddress?.name?.trim() ?? '', address: value?.emailAddress?.address?.trim().toLowerCase() ?? '' })

export class Microsoft365MailService implements CentralMailService {
  readonly configured = true
  constructor(readonly mailbox: string, private readonly tokenProvider: MicrosoftGraphTokenProvider, private readonly fetcher: typeof fetch = fetch) {}

  private async request(url: string, init: RequestInit) {
    let response = await this.fetcher(url, { ...init, signal: AbortSignal.timeout(30_000), headers: { Authorization: `Bearer ${await this.tokenProvider.accessToken()}`, Accept: 'application/json', ...init.headers } })
    if (response.status === 401) {
      this.tokenProvider.invalidate()
      response = await this.fetcher(url, { ...init, signal: AbortSignal.timeout(30_000), headers: { Authorization: `Bearer ${await this.tokenProvider.accessToken()}`, Accept: 'application/json', ...init.headers } })
    }
    return response
  }

  async send(input: CentralMailInput) {
    const response = await this.request(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(this.mailbox)}/sendMail`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: {
        subject: input.subject, body: { contentType: input.contentType ?? 'Text', content: input.body },
        toRecipients: input.to.map(item => ({ emailAddress: { address: item } })), ccRecipients: (input.cc ?? []).map(item => ({ emailAddress: { address: item } })),
        internetMessageHeaders: [{ name: 'x-bouwflow-idempotency-key', value: input.idempotencyKey }],
        attachments: (input.attachments ?? []).map(item => ({ '@odata.type': '#microsoft.graph.fileAttachment', name: item.fileName, contentType: item.contentType, contentBytes: item.data.toString('base64') })),
      }, saveToSentItems: true }),
    })
    if (!response.ok) throw new Error(`Microsoft Graph sendMail antwoordde met HTTP ${response.status}: ${(await response.text()).slice(0, 500)}`)
    return { providerReference: `m365:${input.idempotencyKey}` }
  }

  private async folderMessages(folder: 'inbox' | 'sentitems', direction: CentralMailMessage['direction']) {
    const orderField = folder === 'inbox' ? 'receivedDateTime' : 'sentDateTime'
    const fields = 'id,internetMessageId,conversationId,subject,bodyPreview,from,toRecipients,ccRecipients,receivedDateTime,sentDateTime,isRead,hasAttachments,webLink,internetMessageHeaders'
    let url: string | undefined = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(this.mailbox)}/mailFolders/${folder}/messages?$select=${fields}&$orderby=${orderField}%20desc&$top=100`
    const messages: CentralMailMessage[] = []
    for (let page = 0; url && page < 2; page += 1) {
      const response = await this.request(url, { method: 'GET' })
      if (!response.ok) throw new Error(`Microsoft Graph mailboxsync antwoordde met HTTP ${response.status}: ${(await response.text()).slice(0, 500)}`)
      const payload = await response.json() as GraphMessagePage
      for (const item of payload.value ?? []) {
        if (!item.id) continue
        const from = address(item.from)
        const correlationKey = item.internetMessageHeaders?.find(header => header.name?.toLowerCase() === 'x-bouwflow-idempotency-key')?.value
        messages.push({ providerMessageId: item.id, internetMessageId: item.internetMessageId, conversationId: item.conversationId, correlationKey, direction, fromName: from.name, fromAddress: from.address,
          toRecipients: (item.toRecipients ?? []).map(address).filter(item => item.address), ccRecipients: (item.ccRecipients ?? []).map(address).filter(item => item.address), subject: item.subject?.trim() || '(zonder onderwerp)', bodyPreview: item.bodyPreview?.trim() ?? '', receivedAt: item.receivedDateTime, sentAt: item.sentDateTime, isRead: Boolean(item.isRead), hasAttachments: Boolean(item.hasAttachments), webLink: item.webLink })
      }
      url = payload['@odata.nextLink']
    }
    return messages
  }

  async synchronize() {
    const [incoming, outgoing] = await Promise.all([this.folderMessages('inbox', 'Inkomend'), this.folderMessages('sentitems', 'Uitgaand')])
    return [...incoming, ...outgoing]
  }
}

export function createMicrosoft365MailService(environment: NodeJS.ProcessEnv = process.env, fetcher: typeof fetch = fetch): CentralMailService | undefined {
  const tenantId = environment.M365_MAIL_TENANT_ID?.trim() || environment.M365_NOTIFICATION_TENANT_ID?.trim()
  const clientId = environment.M365_MAIL_CLIENT_ID?.trim() || environment.M365_NOTIFICATION_CLIENT_ID?.trim()
  const clientSecret = environment.M365_MAIL_CLIENT_SECRET?.trim() || environment.M365_NOTIFICATION_CLIENT_SECRET?.trim()
  const mailbox = environment.M365_MAILBOX?.trim() || environment.M365_NOTIFICATION_SENDER?.trim()
  const values = [tenantId, clientId, clientSecret, mailbox]
  if (values.some(Boolean) && !values.every(Boolean)) throw new Error('Microsoft 365 mailboxconfiguratie is onvolledig; tenant, client, secret en mailbox zijn vereist')
  if (!values.every(Boolean)) return undefined
  return new Microsoft365MailService(mailbox!, new MicrosoftGraphTokenProvider(tenantId!, clientId!, clientSecret!, fetcher), fetcher)
}
