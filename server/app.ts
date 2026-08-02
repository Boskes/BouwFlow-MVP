import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify'
import { createHash, timingSafeEqual } from 'node:crypto'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import { z, ZodError } from 'zod'
import type { Pool } from 'pg'
import { AuthenticationError, AuthorizationError, createAuthenticator, requireAllLegalEntities, requireRoles, type AuthMode } from './auth.js'
import { BouwFlowRepository, RepositoryError } from './db/repository.js'
import { ensureAuthenticatedIdentity, ensureExternalPortalIdentity, loadCompanyAccessScope } from './db/identity.js'
import { applyProductionDemoUser, ensureProductionDemoData } from './db/production-demo-seed.js'
import { enforceCompanyScope } from './company-access.js'
import { applyCostSchema, boqItemPatchSchema, boqItemSchema, bulkCostUpdateSchema, bulkPriceAdjustmentSchema, calculationPatchSchema, calculationScenarioPatchSchema, calculationScenarioSchema, calculationStructureSchema, calculationTemplateSchema, calculationVersionSchema, changeOrderApprovalSchema, changeOrderSchema, chapterSchema, commitmentSettlementSchema, companyBranchSchema, companyUserAccessSchema, companyUserProfileSchema, costLibraryItemPatchSchema, costLibraryItemSchema, costLibraryPatchSchema, costLibrarySchema, costLibraryVersionSchema, crmActivitySchema, dailyReportSchema, dailyReportSignSchema, documentApprovalSchema, documentDistributionSchema, documentMetadataSchema, documentRevisionSchema, documentUploadSchema, intercompanyChargeSchema, legalEntityFinancialSchema, legalEntitySchema, opportunityGoNoGoSchema, opportunitySchema, organizationBillingSchema, organizationRelationSchema, organizationSchema, paymentRegistrationSchema, peppolAcceptanceReleaseSchema, peppolNotificationSettingsSchema, peppolNotificationTestSchema, postCalculationFeedbackSchema, procurementRequestSchema, progressStatementApprovalSchema, progressStatementSchema, projectBaselineSchema, projectCompanyAssignmentSchema, projectCostSchema, projectDetailsSchema, projectForecastSchema, projectPlanningSchema, projectStartupSchema, purchaseDeviationApprovalSchema, purchaseInvoiceMatchSchema, purchaseReceiptSchema, qhseCertificateSchema, qhseFindingParams, qhseInspectionSchema, quoteApprovalSchema, quoteContentSchema, quoteLossSchema, quoteReminderSchema, quoteSendSchema, quoteSignatureSchema, salesInvoiceIssueSchema, salesInvoiceSchema, sitePhotoSchema, supplierFrameworkAgreementSchema, supplierQuoteSchema, supplierSchema, tenderDossierSchema, unitConversionSchema, unitPatchSchema, unitSchema, uuidParams, workflowCorrectionSchema, workflowDefinitionSchema } from './schemas.js'
import { assetOperationalSchema, assetSchema, documentRecordLinkSchema, inventoryCountSchema, inventoryItemSchema, stockMovementSchema, warehouseSchema } from './schemas.js'
import { aiAnalysisSchema, aiApprovalSchema, closeoutItemSchema, employeeAbsenceDecisionSchema, employeeAbsenceSchema, employeeCrewSchema, employeeSchema, jointVentureSchema, projectClaimSchema, projectClaimTransitionSchema, projectCloseoutSchema, projectContractSchema, projectContractUpdateSchema, qhseEventSchema, subcontractorOperationSchema, subcontractorProgressDecisionSchema, subcontractorSchema, timeEntryDecisionSchema, timeEntrySchema, workTicketSchema, workTicketSignatureSchema } from './schemas.js'
import { BoqFileError, parseBoqFile } from './import/boq-parser.js'
import { renderQuotePdf } from './pdf/quote-pdf.js'
import { renderPurchaseOrderPdf } from './pdf/purchase-order-pdf.js'
import { renderPeppolAcceptancePdf } from './pdf/peppol-acceptance-pdf.js'
import { LocalObjectStorage, type ObjectStorage } from './storage.js'
import { buildInvoiceUblDraft } from '../src/invoice-export.js'
import type { PeppolAcceptanceResult, PeppolAcceptanceStep, PeppolIntegrationCheck } from '../src/domain.js'
import { createPeppolValidator, type PeppolValidator } from './peppol/validator.js'
import { createPeppolAccessPoint, isKnownPeppolProviderStatus, peppolTransportResultFromProvider, type PeppolAccessPoint } from './peppol/access-point.js'
import { PeppolStatusMonitor } from './peppol/status-monitor.js'
import { HttpPeppolNotificationSender, PeppolNotificationDispatcher, peppolNotificationTargets, type PeppolNotificationSender, type PeppolNotificationTarget } from './peppol/notification.js'
import { createMicrosoft365PeppolNotificationSender, teamsWebhooksFromJson } from './peppol/microsoft365-notification.js'
import { ApiMetrics } from './metrics.js'
import { createAiGateway, createDocumentMailGateway, createIntegrationGateway, createQuoteMailGateway, EnterpriseGatewayError, type AiGateway, type DocumentMailGateway, type IntegrationGateway, type QuoteMailGateway } from './enterprise-gateways.js'
import { serviceRequestSchema } from './schemas.js'
import { HttpBelgianAddressSearch, type BelgianAddressSearch } from './belgian-address-search.js'
import { getBimProductionTestModel } from '../src/bim-test-models.js'
import { createMicrosoft365MailService, type CentralMailService } from './microsoft365-mail.js'

type BimTestModelFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

export interface BuildAppOptions {
  pool: Pool
  authMode?: AuthMode
  logger?: boolean
  frontendOrigin?: string
  objectStorage?: ObjectStorage
  peppolValidator?: PeppolValidator
  peppolAccessPoint?: PeppolAccessPoint
  peppolWebhookSecret?: string
  peppolWebhookPublicUrl?: string
  peppolStatusPollIntervalMs?: number
  peppolNotificationSender?: PeppolNotificationSender
  peppolNotificationTargets?: PeppolNotificationTarget[]
  peppolNotificationDispatchIntervalMs?: number
  peppolCriticalSlaMinutes?: number
  trustProxy?: boolean
  rateLimitMax?: number
  rateLimitWindowMs?: number
  release?: string
  requireIdempotencyKey?: boolean
  integrationGateway?: IntegrationGateway
  aiGateway?: AiGateway
  quoteMailGateway?: QuoteMailGateway
  documentMailGateway?: DocumentMailGateway
  centralMailService?: CentralMailService
  belgianAddressSearch?: BelgianAddressSearch
  bimTestModelFetch?: BimTestModelFetch
}

declare module 'fastify' {
  interface FastifyRequest {
    idempotencyKey?: string
    stateRevision?: number
  }
}

const peppolWebhookSchema = z.object({
  eventId: z.string().trim().min(1).max(200),
  trackingId: z.string().trim().min(1).max(200),
  status: z.string().trim().refine(isKnownPeppolProviderStatus, 'Onbekende Peppol-providerstatus'),
  provider: z.string().trim().min(1).max(200).optional(),
  message: z.string().trim().min(1).max(1_000).optional(),
}).strict()

const peppolAcceptanceSchema = z.object({ confirmNetworkSend: z.literal(true) }).strict()
const recordAuditParamsSchema = z.object({
  entityType: z.enum(['organization','opportunity','calculation','project','daily_report','change_order','work_ticket','time_entry','project_claim','document','project_cost','project_contract','project_closeout','progress_statement','procurement_request','purchase_order','employee','employee_absence','asset','inventory_item','subcontractor','qhse_event','sales_invoice','ai_analysis','quote','site_photo','qhse_certificate','qhse_inspection','supplier','warehouse','stock_movement','employee_crew','project_forecast','joint_venture','intercompany_charge']),
  entityId: z.uuid(),
}).strict()
const userPreferenceParamsSchema = z.object({ key: z.string().trim().min(1).max(300).regex(/^[a-zA-Z0-9:._-]+$/) }).strict()
const userPreferenceSchema = z.object({ value: z.record(z.string(), z.unknown()) }).strict()
const belgianAddressQuerySchema = z.object({
  q: z.string().trim().min(2).max(120),
  limit: z.coerce.number().int().min(1).max(20).default(10),
}).strict()
const mailboxComposeSchema = z.object({
  to:z.array(z.email()).min(1).max(50), cc:z.array(z.email()).max(50).optional(), subject:z.string().trim().min(1).max(250), body:z.string().trim().min(1).max(100_000),
  organizationId:z.uuid().optional(), opportunityId:z.uuid().optional(), projectId:z.uuid().optional(),
}).strict()
const mailboxLinkSchema = z.object({ organizationId:z.uuid().optional(), opportunityId:z.uuid().optional(), projectId:z.uuid().optional() }).strict()

function validWebhookAuthorization(authorization: string | undefined, secret: string) {
  const supplied = authorization?.match(/^Bearer\s+(.+)$/i)?.[1] ?? ''
  const suppliedBytes = Buffer.from(supplied)
  const expectedBytes = Buffer.from(secret)
  return suppliedBytes.length === expectedBytes.length && timingSafeEqual(suppliedBytes, expectedBytes)
}

function multipartField(fields: Record<string, unknown>, name: string) {
  const field = fields[name]
  const value = Array.isArray(field) ? field.at(-1) : field
  return value && typeof value === 'object' && 'value' in value ? String((value as { value: unknown }).value) : undefined
}

export async function buildApp({ pool, authMode = 'development', logger = false, frontendOrigin = 'http://localhost:5173', objectStorage = new LocalObjectStorage(), peppolValidator = createPeppolValidator(), peppolAccessPoint = createPeppolAccessPoint(), peppolWebhookSecret = process.env.PEPPOL_WEBHOOK_SECRET ?? '', peppolWebhookPublicUrl = process.env.PEPPOL_WEBHOOK_PUBLIC_URL ?? '', peppolStatusPollIntervalMs, peppolNotificationSender, peppolNotificationTargets: configuredNotificationTargets, peppolNotificationDispatchIntervalMs, peppolCriticalSlaMinutes = Number(process.env.PEPPOL_CRITICAL_SLA_MINUTES ?? 15), trustProxy = false, rateLimitMax = 5_000, rateLimitWindowMs = 60_000, release = 'development', requireIdempotencyKey = false, integrationGateway = createIntegrationGateway(requireIdempotencyKey), aiGateway = createAiGateway(requireIdempotencyKey), quoteMailGateway: configuredQuoteMailGateway, documentMailGateway: configuredDocumentMailGateway, centralMailService: configuredCentralMailService, belgianAddressSearch = new HttpBelgianAddressSearch(), bimTestModelFetch = fetch }: BuildAppOptions) {
  const app = Fastify({ logger, trustProxy, bodyLimit: 12 * 1024 * 1024, requestIdHeader: 'x-request-id', routerOptions: { maxParamLength: 1_024 } })
  const rateLimits = new Map<string, { count: number; resetAt: number }>()
  const metrics = new ApiMetrics()
  const requestStarted = new WeakMap<FastifyRequest, bigint>()
  const bimTestModelCache = new Map<string, Buffer>()
  const notificationTargets = configuredNotificationTargets ?? peppolNotificationTargets(process.env.PEPPOL_ALERT_EMAIL_TO, process.env.PEPPOL_ALERT_TEAMS_TARGETS)
  const centralMailService = configuredCentralMailService ?? createMicrosoft365MailService(process.env)
  const quoteMailGateway = configuredQuoteMailGateway ?? createQuoteMailGateway(requireIdempotencyKey,process.env,centralMailService)
  const documentMailGateway = configuredDocumentMailGateway ?? createDocumentMailGateway(requireIdempotencyKey,process.env,centralMailService)
  const notificationUrl = process.env.PEPPOL_NOTIFICATION_URL ?? ''
  const notificationSender = peppolNotificationSender ?? (notificationUrl
    ? new HttpPeppolNotificationSender(notificationUrl, process.env.PEPPOL_NOTIFICATION_TOKEN)
    : createMicrosoft365PeppolNotificationSender({
      tenantId: process.env.M365_MAIL_TENANT_ID ?? process.env.M365_NOTIFICATION_TENANT_ID,
      clientId: process.env.M365_MAIL_CLIENT_ID ?? process.env.M365_NOTIFICATION_CLIENT_ID,
      clientSecret: process.env.M365_MAIL_CLIENT_SECRET ?? process.env.M365_NOTIFICATION_CLIENT_SECRET,
      senderMailbox: process.env.M365_MAILBOX ?? process.env.M365_NOTIFICATION_SENDER,
      teamsWebhooks: teamsWebhooksFromJson(process.env.PEPPOL_TEAMS_WEBHOOKS_JSON),
    }))
  const criticalSlaMinutes = Number.isFinite(peppolCriticalSlaMinutes) ? Math.min(1440, Math.max(1, peppolCriticalSlaMinutes)) : 15
  const notificationProvider = peppolNotificationSender ? 'Aangepaste adapter' : notificationUrl ? 'Interne relay' : notificationSender ? 'Microsoft 365' : 'Niet geconfigureerd'
  const notificationChannels = notificationSender?.configuredChannels ?? (notificationSender ? ['E-mail', 'Teams'] as const : [])
  const webhookPath = '/api/integrations/peppol/webhook/'
  const configuredPollInterval = peppolStatusPollIntervalMs ?? Number(process.env.PEPPOL_STATUS_POLL_INTERVAL_MS ?? (process.env.PEPPOL_ACCESS_POINT_URL ? 60_000 : 0))
  const pollInterval = Number.isFinite(configuredPollInterval) && configuredPollInterval > 0 ? configuredPollInterval : 0
  const configuredNotificationInterval = peppolNotificationDispatchIntervalMs ?? Number(process.env.PEPPOL_NOTIFICATION_DISPATCH_INTERVAL_MS ?? (notificationSender ? 30_000 : 0))
  const notificationInterval = Number.isFinite(configuredNotificationInterval) && configuredNotificationInterval > 0 ? configuredNotificationInterval : 0
  const validatorReady = peppolValidator.networkReady ?? true
  const accessPointReady = peppolAccessPoint.configured ?? true
  const webhookReady = Boolean(peppolWebhookSecret && peppolWebhookPublicUrl)
  const integrationChecks: PeppolIntegrationCheck[] = [
    { id: 'validator', label: 'Externe Peppol-validatie', ready: validatorReady, detail: validatorReady ? 'Netwerkklare validatie is geconfigureerd.' : 'Alleen de lokale preflight is actief.' },
    { id: 'access-point', label: 'Peppol-accesspoint', ready: accessPointReady, detail: accessPointReady ? 'Een verzendadapter is actief.' : 'Configureer PEPPOL_ACCESS_POINT_URL.' },
    { id: 'webhook', label: 'Providerwebhook', ready: webhookReady, detail: webhookReady ? 'Callback-URL en ondertekeningsgeheim zijn ingesteld.' : 'Callback-URL of webhookgeheim ontbreekt.' },
    { id: 'status-monitor', label: 'Statusmonitor', ready: pollInterval > 0, detail: pollInterval > 0 ? `Polling is actief om de ${Math.round(pollInterval / 1_000)} seconden.` : 'Automatische statuspolling is uitgeschakeld.' },
    { id: 'notification-connector', label: 'Notificatieconnector', ready: Boolean(notificationSender), detail: notificationSender ? `${notificationProvider}: ${notificationChannels.join(' en ') || 'geen actief kanaal'}.` : 'Geen e-mail- of Teams-connector geconfigureerd.' },
    { id: 'notification-dispatcher', label: 'Notificatiedispatcher', ready: Boolean(notificationSender && notificationInterval), detail: notificationSender && notificationInterval ? `Outboxverwerking is actief om de ${Math.round(notificationInterval / 1_000)} seconden.` : 'Automatische outboxverwerking is uitgeschakeld.' },
  ]
  const repository = new BouwFlowRepository(pool, objectStorage, notificationTargets, criticalSlaMinutes, Boolean(notificationSender), notificationProvider, notificationChannels, integrationChecks, integrationGateway, aiGateway)
  const authenticate = createAuthenticator(authMode)
  const peppolStatusMonitor = new PeppolStatusMonitor(repository, peppolAccessPoint, pollInterval, pollInterval, app.log)
  const notificationDispatcher = notificationSender ? new PeppolNotificationDispatcher(repository, notificationSender, notificationInterval, app.log) : undefined

  await app.register(cors, { origin: frontendOrigin, credentials: false, methods: ['GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'], allowedHeaders: ['Authorization', 'Content-Type', 'X-Request-Id', 'Idempotency-Key', 'If-Match', 'X-BouwFlow-Demo-User'], exposedHeaders: ['X-Request-Id', 'RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset', 'ETag'] })
  await app.register(multipart, { limits: { files: 1, fileSize: 10 * 1024 * 1024 } })
  app.addHook('onRequest', async request => { requestStarted.set(request, process.hrtime.bigint()) })
  app.addHook('onResponse', async (request, reply) => {
    const started = requestStarted.get(request)
    const seconds = started ? Number(process.hrtime.bigint() - started) / 1_000_000_000 : 0
    metrics.observe(request.method, request.routeOptions.url ?? 'unknown', reply.statusCode, seconds)
  })
  app.addHook('onSend', async (request, reply, payload) => {
    reply.header('X-Request-Id', request.id)
    reply.header('X-Content-Type-Options', 'nosniff')
    reply.header('X-Frame-Options', 'DENY')
    reply.header('Referrer-Policy', 'no-referrer')
    reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
    reply.header('Cross-Origin-Resource-Policy', 'same-site')
    if (request.url.startsWith('/api/')) reply.header('Cache-Control', 'no-store')
    return payload
  })
  app.addHook('onSend', async (request, reply, payload) => {
    if (request.stateRevision != null) reply.header('ETag', `"${request.stateRevision}"`)
    return payload
  })
  app.addHook('onRequest', async (request, reply) => {
    if (request.url === '/health' || request.url.startsWith('/api/health') || request.url === '/internal/metrics') return
    const now = Date.now()
    const key = request.ip
    const current = rateLimits.get(key)
    const limit = !current || current.resetAt <= now ? { count: 1, resetAt: now + rateLimitWindowMs } : { count: current.count + 1, resetAt: current.resetAt }
    rateLimits.set(key, limit)
    reply.header('RateLimit-Limit', String(rateLimitMax))
    reply.header('RateLimit-Remaining', String(Math.max(0, rateLimitMax - limit.count)))
    reply.header('RateLimit-Reset', String(Math.ceil(limit.resetAt / 1_000)))
    request.raw.once('close', () => { if (rateLimits.size > 10_000) for (const [entryKey, entry] of rateLimits) if (entry.resetAt <= Date.now()) rateLimits.delete(entryKey) })
    if (limit.count > rateLimitMax) {
      const retryAfter = Math.max(1, Math.ceil((limit.resetAt - now) / 1_000))
      throw new RateLimitError(retryAfter)
    }
    if (request.url.startsWith(webhookPath)) return
    await authenticate(request)
    if (authMode === 'entra') await ensureAuthenticatedIdentity(pool, request.context, process.env.TENANT_NAME)
    else if (request.context.roles.length > 0 && request.context.roles.every(role => ['Klant', 'Onderaannemer', 'Leverancier'].includes(role))) await ensureExternalPortalIdentity(pool, request.context, process.env.TENANT_NAME)
    const requestedDemoUser = request.headers['x-bouwflow-demo-user']
    await applyProductionDemoUser(pool, request.context, Array.isArray(requestedDemoUser) ? requestedDemoUser[0] : requestedDemoUser)
    await loadCompanyAccessScope(pool, request.context)
  })
  app.addHook('preHandler', async request => {
    if (request.url.startsWith(webhookPath)) return
    await enforceCompanyScope(pool, request)
  })
  app.addHook('preHandler', async (request, reply) => {
    if (request.url.startsWith(webhookPath) || request.url === '/health' || request.url.startsWith('/api/health')) return
    if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(request.method)) return
    const rawKey = request.headers['idempotency-key']
    const key = Array.isArray(rawKey) ? rawKey[0] : rawKey
    if (!key) {
      if (requireIdempotencyKey) throw new RepositoryError('Idempotency-Key ontbreekt voor deze mutatie', 400)
      return
    }
    if (!z.uuid().safeParse(key).success) throw new RepositoryError('Idempotency-Key moet een geldige UUID zijn', 400)
    const route = request.routeOptions.url ?? request.url.split('?')[0]
    const inserted = await pool.query(`INSERT INTO api_idempotency (tenant_id,idempotency_key,method,route,status) VALUES ($1,$2,$3,$4,'processing') ON CONFLICT DO NOTHING RETURNING idempotency_key`, [request.context.tenantId, key, request.method, route])
    if (inserted.rowCount) {
      request.idempotencyKey = key
      return
    }
    const existing = await pool.query<{ method: string; route: string; status: string; response_status: number | null; response_body: unknown }>('SELECT method,route,status,response_status,response_body FROM api_idempotency WHERE tenant_id=$1 AND idempotency_key=$2', [request.context.tenantId, key])
    const record = existing.rows[0]
    if (!record || record.method !== request.method || record.route !== route) throw new RepositoryError('Idempotency-Key werd al voor een andere aanvraag gebruikt', 409)
    if (record.status === 'processing') throw new RepositoryError('Dezelfde aanvraag wordt nog verwerkt', 409)
    return reply.code(record.response_status ?? 200).send(record.response_body)
  })
  app.addHook('preHandler', async request => {
    if (request.url.startsWith(webhookPath) || !['POST', 'PATCH', 'PUT', 'DELETE'].includes(request.method)) return
    const raw = request.headers['if-match']
    const supplied = Array.isArray(raw) ? raw[0] : raw
    const expected = supplied?.replace(/^W\//, '').replace(/^"|"$/g, '')
    if (expected && !/^\d+$/.test(expected)) throw new RepositoryError('If-Match bevat geen geldige gegevensversie', 400)
    const result = expected
      ? await pool.query<{ data_revision: string }>('UPDATE tenants SET data_revision=data_revision+1 WHERE id=$1 AND data_revision=$2 RETURNING data_revision::text', [request.context.tenantId, expected])
      : await pool.query<{ data_revision: string }>('UPDATE tenants SET data_revision=data_revision+1 WHERE id=$1 RETURNING data_revision::text', [request.context.tenantId])
    if (!result.rowCount) throw new RepositoryError('Deze gegevens zijn intussen door een andere gebruiker gewijzigd. Herlaad het dossier en pas je wijziging opnieuw toe.', 409)
    request.stateRevision = Number(result.rows[0].data_revision)
  })
  app.addHook('onSend', async (request, reply, payload) => {
    if (!request.idempotencyKey) return payload
    if (reply.statusCode >= 500) {
      await pool.query('DELETE FROM api_idempotency WHERE tenant_id=$1 AND idempotency_key=$2', [request.context.tenantId, request.idempotencyKey])
      return payload
    }
    let responseBody: unknown = null
    if (typeof payload === 'string' && payload.length) {
      try { responseBody = JSON.parse(payload) } catch { responseBody = { message: payload } }
    }
    await pool.query(`UPDATE api_idempotency SET status='completed',response_status=$3,response_body=$4,completed_at=now() WHERE tenant_id=$1 AND idempotency_key=$2`, [request.context.tenantId, request.idempotencyKey, reply.statusCode, JSON.stringify(responseBody)])
    return payload
  })
  app.addHook('onReady', async () => { peppolStatusMonitor.start(); notificationDispatcher?.start() })
  app.addHook('onClose', async () => { peppolStatusMonitor.stop(); notificationDispatcher?.stop() })

  const readiness = async (reply: FastifyReply) => {
    try {
      await Promise.all([pool.query('SELECT 1'), objectStorage.healthcheck()])
      return { status: 'ready', service: 'bouwflow-api', release, checks: { database: 'ok', objectStorage: 'ok' } }
    } catch (error) {
      app.log.error({ error }, 'Readinesscheck mislukt')
      return reply.code(503).send({ status: 'not_ready', service: 'bouwflow-api', release })
    }
  }
  app.get('/health', async () => ({ status: 'ok', service: 'bouwflow-api' }))
  app.get('/internal/metrics', async (_request, reply) => reply.type('text/plain; version=0.0.4; charset=utf-8').send(metrics.render()))
  app.get('/api/health/live', async () => ({ status: 'ok', service: 'bouwflow-api', release }))
  app.get('/api/health', async (_request, reply) => readiness(reply))
  app.get('/api/health/ready', async (_request, reply) => readiness(reply))
  app.post('/api/integrations/peppol/webhook/:id', async (request, reply) => {
    if (!peppolWebhookSecret) return reply.code(503).send({ message: 'Peppol-webhook is niet geconfigureerd' })
    if (!validWebhookAuthorization(request.headers.authorization, peppolWebhookSecret)) return reply.code(401).send({ message: 'Ongeldige Peppol-webhookautorisatie' })
    const { id } = uuidParams.parse(request.params)
    const payload = peppolWebhookSchema.parse(request.body)
    const delivery = await repository.applyPeppolProviderUpdate(id, peppolTransportResultFromProvider({ ...payload, reference: payload.trackingId }), 'provider_webhook')
    return { accepted: true, deliveryId: delivery.id, status: delivery.status }
  })
  app.get('/api/bootstrap', async (request, reply) => {
    await ensureProductionDemoData(pool, request.context, objectStorage)
    const revision = await pool.query<{ data_revision: string }>('SELECT data_revision::text FROM tenants WHERE id=$1', [request.context.tenantId])
    if (revision.rowCount) reply.header('ETag', `"${revision.rows[0].data_revision}"`)
    return repository.bootstrap(request.context)
  })

  const mailboxRoles = ['Administrator','Directie','Commercieel medewerker','Tender manager','Calculator','Projectdirecteur','Projectmanager','Werkvoorbereider','Aankoper','Financiële administratie'] as const
  app.get('/api/mailbox', { preHandler:requireRoles(...mailboxRoles) }, async request => repository.mailboxOverview(request.context,Boolean(centralMailService),centralMailService?.mailbox??''))
  app.post('/api/mailbox/synchronize', { preHandler:requireRoles(...mailboxRoles) }, async request => {
    if(!centralMailService)throw new RepositoryError('De centrale Microsoft 365-mailbox is nog niet geconfigureerd',503)
    try{return await repository.synchronizeMailbox(request.context,centralMailService.mailbox??'',await centralMailService.synchronize())}
    catch(error){const message=error instanceof Error?error.message:'Mailboxsync mislukt';await repository.recordMailboxSyncError(request.context,centralMailService.mailbox??'',message);throw new RepositoryError(message,503)}
  })
  app.post('/api/mailbox/send', { preHandler:requireRoles(...mailboxRoles) }, async request => {
    if(!centralMailService)throw new RepositoryError('De centrale Microsoft 365-mailbox is nog niet geconfigureerd',503)
    const input=mailboxComposeSchema.parse(request.body);const correlationKey=`mailbox:${request.idempotencyKey??request.id}`
    try{const sent=await centralMailService.send({...input,idempotencyKey:correlationKey});return repository.recordOutgoingMailboxMessage(request.context,centralMailService.mailbox??'',sent.providerReference??`m365:${correlationKey}`,correlationKey,input)}
    catch(error){throw new RepositoryError(error instanceof Error?error.message:'E-mailverzending mislukt',503)}
  })
  app.patch('/api/mailbox/messages/:id/link', { preHandler:requireRoles(...mailboxRoles) }, async request => repository.linkMailboxMessage(request.context,uuidParams.parse(request.params).id,mailboxLinkSchema.parse(request.body)))

  app.get('/api/addresses/be/suggestions', { preHandler: requireRoles('Administrator', 'Directie', 'Commercieel medewerker', 'Tender manager', 'Financiële administratie') }, async request => {
    const input = belgianAddressQuerySchema.parse(request.query)
    try {
      return { suggestions: await belgianAddressSearch.search(input.q, input.limit) }
    } catch (error) {
      request.log.warn({ error }, 'Belgische adreszoekdienst niet beschikbaar')
      throw new RepositoryError('De Belgische adreszoekdienst is tijdelijk niet bereikbaar. Vul het adres handmatig in of probeer opnieuw.', 503)
    }
  })

  app.get('/api/bim/test-models/:id/file', async (request, reply) => {
    const { id } = z.object({ id: z.string().trim().min(1).max(80) }).parse(request.params)
    const model = getBimProductionTestModel(id)
    if (!model) throw new RepositoryError('IFC-proefmodel niet gevonden', 404)

    let data = bimTestModelCache.get(model.id)
    if (!data) {
      let upstream: Response
      try {
        upstream = await bimTestModelFetch(model.sourceUrl, {
          headers: { Accept: 'application/octet-stream,text/plain;q=0.9' },
          signal: AbortSignal.timeout(30_000),
        })
      } catch {
        throw new RepositoryError('IFC-proefmodel kon niet bij buildingSMART worden opgehaald', 502)
      }
      if (!upstream.ok) throw new RepositoryError(`IFC-proefmodel kon niet bij buildingSMART worden opgehaald (${upstream.status})`, 502)
      data = Buffer.from(await upstream.arrayBuffer())
      if (!data.length || data.length > 10 * 1024 * 1024 || !data.subarray(0, 256).toString('utf8').includes('ISO-10303-21')) {
        throw new RepositoryError('buildingSMART leverde geen geldig IFC-bestand', 502)
      }
      bimTestModelCache.set(model.id, data)
    }

    return reply
      .header('Content-Type', 'application/x-step')
      .header('Content-Disposition', `attachment; filename="${model.fileName}"`)
      .header('Content-Length', String(data.length))
      .header('Cache-Control', 'private, max-age=86400')
      .send(data)
  })
  app.patch('/api/settings/peppol-notifications', { preHandler: [requireRoles('Administrator', 'Directie', 'Financiële administratie'), requireAllLegalEntities] }, async request => repository.updatePeppolNotificationSettings(request.context, peppolNotificationSettingsSchema.parse(request.body)))
  app.post('/api/settings/peppol-notifications/test', { preHandler: [requireRoles('Administrator', 'Directie', 'Financiële administratie'), requireAllLegalEntities] }, async request => {
    if (!notificationSender) throw new RepositoryError('De Peppol-notificatieconnector is niet geconfigureerd', 409)
    const notification = await repository.preparePeppolNotificationTest(request.context, peppolNotificationTestSchema.parse(request.body))
    try {
      await notificationSender.send(notification)
      return await repository.completePeppolNotificationTest(request.context, notification)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Onbekende connectorfout'
      await repository.completePeppolNotificationTest(request.context, notification, message)
      throw new RepositoryError(`Testmelding kon niet worden afgeleverd: ${message}`, 502)
    }
  })
  app.get('/api/audit', { preHandler: [requireRoles('Administrator', 'Directie'), requireAllLegalEntities] }, async request => repository.auditEntries(request.context))
  app.get('/api/audit/:entityType/:entityId', async request => {
    const { entityType, entityId } = recordAuditParamsSchema.parse(request.params)
    return repository.recordAuditEntries(request.context, entityType, entityId)
  })
  app.get('/api/user-preferences/:key', async request => {
    const { key } = userPreferenceParamsSchema.parse(request.params)
    return { key, value: (await repository.userPreference(request.context, key)) ?? null }
  })
  app.patch('/api/user-preferences/:key', async request => {
    const { key } = userPreferenceParamsSchema.parse(request.params)
    return repository.saveUserPreference(request.context, key, userPreferenceSchema.parse(request.body).value)
  })

  app.post('/api/legal-entities', { preHandler: [requireRoles('Administrator', 'Directie', 'Financiële administratie'), requireAllLegalEntities] }, async (request, reply) => {
    return reply.code(201).send(await repository.createLegalEntity(request.context, legalEntitySchema.parse(request.body)))
  })

  app.post('/api/legal-entities/:id/branches', { preHandler: requireRoles('Administrator', 'Directie', 'Financiële administratie') }, async (request, reply) => {
    const { id } = uuidParams.parse(request.params)
    return reply.code(201).send(await repository.createCompanyBranch(request.context, id, companyBranchSchema.parse(request.body)))
  })

  app.patch('/api/legal-entities/:id/financial-settings', { preHandler: requireRoles('Administrator', 'Directie', 'Financiële administratie') }, async request => {
    const { id } = uuidParams.parse(request.params)
    return repository.updateLegalEntityFinancial(request.context, id, legalEntityFinancialSchema.parse(request.body))
  })

  app.patch('/api/organizations/:id/billing-profile', { preHandler: requireRoles('Administrator', 'Directie', 'Commercieel medewerker', 'Financiële administratie') }, async request => {
    const { id } = uuidParams.parse(request.params)
    return repository.updateOrganizationBilling(request.context, id, organizationBillingSchema.parse(request.body))
  })

  app.post('/api/organizations', { preHandler: requireRoles('Administrator', 'Directie', 'Commercieel medewerker') }, async (request, reply) => {
    return reply.code(201).send(await repository.createOrganization(request.context, organizationSchema.parse(request.body)))
  })

  app.patch('/api/organizations/:id', { preHandler: requireRoles('Administrator', 'Directie', 'Commercieel medewerker') }, async request => {
    const { id } = uuidParams.parse(request.params)
    return repository.updateOrganization(request.context, id, organizationSchema.parse(request.body))
  })
  app.post('/api/organizations/:id/activities', { preHandler: requireRoles('Administrator','Directie','Commercieel medewerker','Tender manager') }, async (request,reply) => {
    const { id } = uuidParams.parse(request.params)
    return reply.code(201).send(await repository.addCrmActivity(request.context,id,crmActivitySchema.parse(request.body)))
  })
  app.post('/api/organizations/:id/relations', { preHandler: requireRoles('Administrator','Directie','Commercieel medewerker') }, async (request,reply) => {
    const { id } = uuidParams.parse(request.params)
    return reply.code(201).send(await repository.addOrganizationRelation(request.context,id,organizationRelationSchema.parse(request.body)))
  })

  app.post('/api/intercompany-charges', { preHandler: [requireRoles('Administrator', 'Directie', 'Financiële administratie'), requireAllLegalEntities] }, async (request, reply) => reply.code(201).send(await repository.createIntercompanyCharge(request.context, intercompanyChargeSchema.parse(request.body))))
  app.post('/api/intercompany-charges/:id/approve', { preHandler: [requireRoles('Administrator', 'Directie', 'Financiële administratie'), requireAllLegalEntities] }, async request => repository.approveIntercompanyCharge(request.context, uuidParams.parse(request.params).id))
  app.post('/api/intercompany-charges/:id/post', { preHandler: [requireRoles('Administrator', 'Directie', 'Financiële administratie'), requireAllLegalEntities] }, async request => repository.postIntercompanyCharge(request.context, uuidParams.parse(request.params).id))

  app.patch('/api/users/:id/company-access', { preHandler: [requireRoles('Administrator', 'Directie'), requireAllLegalEntities] }, async request => {
    const { id } = uuidParams.parse(request.params)
    return repository.updateCompanyUserAccess(request.context, id, companyUserAccessSchema.parse(request.body))
  })
  app.post('/api/users',{preHandler:[requireRoles('Administrator','Directie'),requireAllLegalEntities]},async(request,reply)=>reply.code(201).send(await repository.inviteCompanyUser(request.context,companyUserProfileSchema.parse(request.body))))
  app.patch('/api/users/:id',{preHandler:[requireRoles('Administrator','Directie'),requireAllLegalEntities]},async request=>repository.updateCompanyUser(request.context,uuidParams.parse(request.params).id,companyUserProfileSchema.parse(request.body)))
  app.post('/api/settings/workflows',{preHandler:[requireRoles('Administrator','Directie'),requireAllLegalEntities]},async(request,reply)=>reply.code(201).send(await repository.createWorkflowDefinition(request.context,workflowDefinitionSchema.parse(request.body))))
  app.patch('/api/settings/workflows/:id',{preHandler:[requireRoles('Administrator','Directie'),requireAllLegalEntities]},async request=>repository.updateWorkflowDefinition(request.context,uuidParams.parse(request.params).id,workflowDefinitionSchema.parse(request.body)))
  app.post('/api/workflows/correct',{preHandler:requireRoles('Administrator','Directie','Projectdirecteur','Projectmanager','Tender manager','Financiële administratie','HR','Preventieadviseur','Kwaliteitsverantwoordelijke')},async request=>repository.correctWorkflow(request.context,workflowCorrectionSchema.parse(request.body)))

  app.patch('/api/projects/:id/company-assignment', { preHandler: requireRoles('Administrator', 'Directie', 'Projectdirecteur', 'Projectmanager') }, async request => {
    const { id } = uuidParams.parse(request.params)
    return repository.assignProjectCompany(request.context, id, projectCompanyAssignmentSchema.parse(request.body))
  })

  app.post('/api/cost-library', { preHandler: requireRoles('Administrator', 'Calculator', 'Aankoper') }, async (request, reply) => {
    return reply.code(201).send(await repository.createCostLibraryItem(request.context, costLibraryItemSchema.parse(request.body)))
  })

  app.patch('/api/cost-library/:id', { preHandler: requireRoles('Administrator', 'Calculator', 'Aankoper') }, async request => {
    const { id } = uuidParams.parse(request.params)
    return repository.updateCostLibraryItem(request.context, id, costLibraryItemPatchSchema.parse(request.body))
  })

  app.post('/api/cost-libraries', { preHandler: requireRoles('Administrator', 'Calculator', 'Aankoper') }, async (request, reply) => {
    return reply.code(201).send(await repository.createCostLibrary(request.context, costLibrarySchema.parse(request.body)))
  })

  app.patch('/api/cost-libraries/:id', { preHandler: requireRoles('Administrator', 'Calculator', 'Aankoper') }, async request => {
    const { id } = uuidParams.parse(request.params)
    return repository.updateCostLibrary(request.context, id, costLibraryPatchSchema.parse(request.body))
  })

  app.post('/api/units', { preHandler: requireRoles('Administrator', 'Calculator', 'Aankoper') }, async (request, reply) => reply.code(201).send(await repository.createUnit(request.context, unitSchema.parse(request.body))))
  app.patch('/api/units/:id', { preHandler: requireRoles('Administrator', 'Calculator', 'Aankoper') }, async request => { const { id } = uuidParams.parse(request.params); return repository.updateUnit(request.context, id, unitPatchSchema.parse(request.body)) })
  app.post('/api/unit-conversions', { preHandler: requireRoles('Administrator', 'Calculator', 'Aankoper') }, async (request, reply) => reply.code(201).send(await repository.createUnitConversion(request.context, unitConversionSchema.parse(request.body))))

  app.post('/api/calculations/:id/cost-library/bulk-update', { preHandler: requireRoles('Administrator', 'Calculator') }, async request => {
    const { id } = uuidParams.parse(request.params); const input = bulkCostUpdateSchema.parse(request.body)
    return repository.bulkUpdateBoqItemsFromLibrary(request.context, id, input.itemIds, input.libraryId)
  })

  app.post('/api/calculations/:id/price-adjustments/bulk-apply', { preHandler: requireRoles('Administrator', 'Calculator') }, async request => {
    const { id } = uuidParams.parse(request.params); const input = bulkPriceAdjustmentSchema.parse(request.body)
    return repository.bulkApplyBoqPriceAdjustment(request.context, id, input.itemIds, input.adjustment)
  })

  app.post('/api/cost-libraries/:id/versions', { preHandler: requireRoles('Administrator', 'Calculator', 'Aankoper') }, async (request, reply) => {
    const { id } = uuidParams.parse(request.params)
    return reply.code(201).send(await repository.createCostLibraryVersion(request.context, id, costLibraryVersionSchema.parse(request.body)))
  })

  app.post('/api/cost-library-versions/:id/publish', { preHandler: requireRoles('Administrator', 'Calculator', 'Aankoper') }, async request => {
    const { id } = uuidParams.parse(request.params)
    return repository.publishCostLibraryVersion(request.context, id)
  })

  app.post('/api/projects/:id/post-calculation/library', { preHandler: requireRoles('Administrator', 'Calculator', 'Projectmanager') }, async (request, reply) => {
    const { id } = uuidParams.parse(request.params)
    return reply.code(201).send(await repository.publishPostCalculationFeedback(request.context, id, postCalculationFeedbackSchema.parse(request.body)))
  })

  app.post('/api/opportunities', { preHandler: requireRoles('Administrator', 'Commercieel medewerker', 'Tender manager') }, async (request, reply) => {
    const input = opportunitySchema.parse(request.body)
    return reply.code(201).send(await repository.createOpportunity(request.context, input))
  })

  app.patch('/api/opportunities/:id', { preHandler: requireRoles('Administrator', 'Commercieel medewerker', 'Tender manager') }, async request => {
    const { id } = uuidParams.parse(request.params)
    return repository.updateOpportunity(request.context, id, opportunitySchema.parse(request.body))
  })
  app.put('/api/opportunities/:id/tender', { preHandler: requireRoles('Administrator','Directie','Commercieel medewerker','Tender manager') }, async request => {
    const { id } = uuidParams.parse(request.params)
    return repository.saveTenderDossier(request.context,id,tenderDossierSchema.parse(request.body))
  })

  app.post('/api/opportunities/:id/qualify', { preHandler: requireRoles('Administrator', 'Commercieel medewerker', 'Tender manager') }, async request => {
    const { id } = uuidParams.parse(request.params)
    return repository.qualifyOpportunity(request.context, id)
  })

  app.post('/api/opportunities/:id/go-no-go', { preHandler: requireRoles('Administrator', 'Directie', 'Commercieel medewerker', 'Tender manager', 'Calculator') }, async request => {
    const { id } = uuidParams.parse(request.params)
    return repository.assessOpportunity(request.context, id, opportunityGoNoGoSchema.parse(request.body))
  })

  app.post('/api/opportunities/:id/calculations', { preHandler: requireRoles('Administrator', 'Calculator', 'Tender manager') }, async (request, reply) => {
    const { id } = uuidParams.parse(request.params)
    return reply.code(201).send(await repository.startCalculation(request.context, id))
  })

  app.patch('/api/projects/:id', { preHandler: requireRoles('Administrator', 'Projectdirecteur', 'Projectmanager') }, async request => {
    const { id } = uuidParams.parse(request.params)
    return repository.updateProjectDetails(request.context, id, projectDetailsSchema.parse(request.body))
  })

  app.patch('/api/calculations/:id', { preHandler: requireRoles('Administrator', 'Calculator') }, async request => {
    const { id } = uuidParams.parse(request.params)
    return repository.updateCalculation(request.context, id, calculationPatchSchema.parse(request.body))
  })

  app.post('/api/calculations/:id/items', { preHandler: requireRoles('Administrator', 'Calculator') }, async (request, reply) => {
    const { id } = uuidParams.parse(request.params)
    return reply.code(201).send(await repository.addBoqItem(request.context, id, boqItemSchema.parse(request.body)))
  })

  app.patch('/api/calculations/:calculationId/items/:itemId', { preHandler: requireRoles('Administrator', 'Calculator') }, async request => {
    const { calculationId, itemId } = request.params as { calculationId: string; itemId: string }
    const { id: validCalculationId } = uuidParams.parse({ id: calculationId })
    const { id: validItemId } = uuidParams.parse({ id: itemId })
    return repository.updateBoqItem(request.context, validCalculationId, validItemId, boqItemPatchSchema.parse(request.body))
  })

  app.delete('/api/calculations/:calculationId/items/:itemId', { preHandler: requireRoles('Administrator', 'Calculator') }, async (request, reply) => {
    const { calculationId, itemId } = request.params as { calculationId: string; itemId: string }
    const { id: validCalculationId } = uuidParams.parse({ id: calculationId })
    const { id: validItemId } = uuidParams.parse({ id: itemId })
    await repository.removeBoqItem(request.context, validCalculationId, validItemId)
    return reply.code(204).send()
  })

  app.post('/api/calculations/:calculationId/items/:itemId/cost-library/:libraryItemId', { preHandler: requireRoles('Administrator', 'Calculator') }, async request => {
    const { calculationId, itemId, libraryItemId } = request.params as { calculationId: string; itemId: string; libraryItemId: string }
    const { id: validCalculationId } = uuidParams.parse({ id: calculationId })
    const { id: validItemId } = uuidParams.parse({ id: itemId })
    const { id: validLibraryItemId } = uuidParams.parse({ id: libraryItemId })
    const { factor } = applyCostSchema.parse(request.body)
    return repository.applyCostLibraryItem(request.context, validCalculationId, validItemId, validLibraryItemId, factor)
  })

  app.post('/api/calculations/:id/chapters', { preHandler: requireRoles('Administrator', 'Calculator') }, async (request, reply) => {
    const { id } = uuidParams.parse(request.params)
    return reply.code(201).send(await repository.addChapter(request.context, id, chapterSchema.parse(request.body)))
  })

  app.put('/api/calculations/:id/structure', { preHandler: requireRoles('Administrator', 'Calculator') }, async request => {
    const { id } = uuidParams.parse(request.params)
    return repository.updateCalculationStructure(request.context, id, calculationStructureSchema.parse(request.body))
  })

  app.post('/api/calculations/:id/templates', { preHandler: requireRoles('Administrator', 'Calculator') }, async request => {
    const { id } = uuidParams.parse(request.params)
    return repository.applyCalculationTemplate(request.context, id, calculationTemplateSchema.parse(request.body))
  })

  app.post('/api/calculations/:id/versions', { preHandler: requireRoles('Administrator', 'Calculator', 'Tender manager') }, async (request, reply) => {
    const { id } = uuidParams.parse(request.params)
    return reply.code(201).send(await repository.createCalculationVersion(request.context, id, calculationVersionSchema.parse(request.body)))
  })

  app.post('/api/calculations/:id/scenarios', { preHandler: requireRoles('Administrator', 'Calculator', 'Tender manager') }, async (request, reply) => {
    const { id } = uuidParams.parse(request.params)
    return reply.code(201).send(await repository.createCalculationScenario(request.context, id, calculationScenarioSchema.parse(request.body)))
  })

  app.post('/api/calculations/:id/scenarios/presets', { preHandler: requireRoles('Administrator', 'Calculator', 'Tender manager') }, async (request, reply) => {
    const { id } = uuidParams.parse(request.params)
    return reply.code(201).send(await repository.createPresetScenarios(request.context, id))
  })

  app.patch('/api/calculations/:calculationId/scenarios/:scenarioId', { preHandler: requireRoles('Administrator', 'Calculator', 'Tender manager') }, async request => {
    const { calculationId, scenarioId } = request.params as { calculationId: string; scenarioId: string }
    const { id: validCalculationId } = uuidParams.parse({ id: calculationId })
    const { id: validScenarioId } = uuidParams.parse({ id: scenarioId })
    return repository.updateCalculationScenario(request.context, validCalculationId, validScenarioId, calculationScenarioPatchSchema.parse(request.body))
  })

  app.post('/api/calculations/:calculationId/scenarios/:scenarioId/select', { preHandler: requireRoles('Administrator', 'Calculator', 'Tender manager') }, async request => {
    const { calculationId, scenarioId } = request.params as { calculationId: string; scenarioId: string }
    const { id: validCalculationId } = uuidParams.parse({ id: calculationId })
    const { id: validScenarioId } = uuidParams.parse({ id: scenarioId })
    return repository.selectCalculationScenario(request.context, validCalculationId, validScenarioId)
  })

  app.post('/api/calculations/:id/import/preview', { preHandler: requireRoles('Administrator', 'Calculator') }, async request => {
    uuidParams.parse(request.params)
    const file = await request.file()
    if (!file) throw new BoqFileError('Selecteer een Excel- of CSV-bestand')
    return parseBoqFile(await file.toBuffer(), file.filename)
  })

  app.post('/api/calculations/:id/import', { preHandler: requireRoles('Administrator', 'Calculator') }, async (request, reply) => {
    const { id } = uuidParams.parse(request.params)
    const file = await request.file()
    if (!file) throw new BoqFileError('Selecteer een Excel- of CSV-bestand')
    const preview = await parseBoqFile(await file.toBuffer(), file.filename)
    return reply.code(201).send(await repository.importBoq(request.context, id, preview))
  })

  app.post('/api/calculations/:id/quotes', { preHandler: requireRoles('Administrator', 'Calculator', 'Tender manager') }, async (request, reply) => {
    const { id } = uuidParams.parse(request.params)
    return reply.code(201).send(await repository.createQuote(request.context, id, quoteContentSchema.parse(request.body ?? {})))
  })

  app.get('/api/quotes/:id/pdf', async (request, reply) => {
    const { id } = uuidParams.parse(request.params)
    const quote = await repository.getQuote(request.context, id)
    const pdf = await renderQuotePdf(quote)
    return reply.header('Content-Type', 'application/pdf').header('Content-Disposition', `attachment; filename="${quote.number}.pdf"`).send(pdf)
  })
  app.post('/api/quotes/:id/approve', { preHandler: requireRoles('Administrator','Directie','Tender manager') }, async request => repository.approveQuote(request.context,uuidParams.parse(request.params).id,quoteApprovalSchema.parse(request.body).approvedBy))
  app.post('/api/quotes/:id/send', { preHandler: requireRoles('Administrator','Directie','Commercieel medewerker','Tender manager') }, async request => {
    const input = quoteSendSchema.parse(request.body)
    const id = uuidParams.parse(request.params).id
    const quote = await repository.getQuote(request.context, id)
    if (quote.workflow?.status !== 'Intern goedgekeurd') throw new RepositoryError('De offerte moet intern goedgekeurd zijn voor verzending', 409)
    let providerReference: string | undefined
    try {
      providerReference = (await quoteMailGateway.send({ quote, recipient: input.sentTo, sentBy: input.sentBy, pdf: await renderQuotePdf(quote), idempotencyKey: `quote:${quote.id}:v${quote.version}:${input.sentTo.toLowerCase()}` })).providerReference
    } catch (error) {
      if (error instanceof EnterpriseGatewayError) throw new RepositoryError(error.message, 503)
      throw error
    }
    return repository.sendQuote(request.context,id,input.sentTo,input.sentBy,providerReference)
  })
  app.post('/api/quotes/:id/remind', { preHandler: requireRoles('Administrator','Directie','Commercieel medewerker','Tender manager') }, async request => {
    const input = quoteReminderSchema.parse(request.body)
    const id = uuidParams.parse(request.params).id
    const quote = await repository.getQuote(request.context, id)
    const recipient = quote.workflow?.sentTo
    if (!recipient || !['Verzonden','Geopend'].includes(quote.workflow?.status ?? '')) throw new RepositoryError('Alleen een verzonden, nog niet ondertekende offerte kan worden herinnerd', 409)
    let providerReference: string | undefined
    try {
      providerReference = (await quoteMailGateway.send({ quote, recipient, sentBy: input.sentBy, pdf: await renderQuotePdf(quote), idempotencyKey: `quote-reminder:${quote.id}:v${quote.version}:${quote.workflow?.events.filter(event=>event.type==='Herinnerd').length ?? 0}:${recipient.toLowerCase()}` })).providerReference
    } catch (error) {
      if (error instanceof EnterpriseGatewayError) throw new RepositoryError(error.message, 503)
      throw error
    }
    return repository.remindQuote(request.context,id,input.sentBy,providerReference)
  })
  app.post('/api/quotes/:id/opened', { preHandler: requireRoles('Administrator','Directie','Commercieel medewerker','Tender manager','Klant') }, async request => repository.markQuoteOpened(request.context,uuidParams.parse(request.params).id))
  app.post('/api/quotes/:id/sign', { preHandler: requireRoles('Administrator','Directie','Commercieel medewerker','Tender manager','Klant') }, async request => repository.signQuote(request.context,uuidParams.parse(request.params).id,quoteSignatureSchema.parse(request.body).signedBy))
  app.post('/api/quotes/:id/lose', { preHandler: requireRoles('Administrator','Directie','Commercieel medewerker','Tender manager') }, async request => { const input=quoteLossSchema.parse(request.body); return repository.loseQuote(request.context,uuidParams.parse(request.params).id,input.reason,input.recordedBy) })

  app.post('/api/calculations/:id/award', { preHandler: requireRoles('Administrator', 'Tender manager', 'Projectdirecteur') }, async (request, reply) => {
    const { id } = uuidParams.parse(request.params)
    return reply.code(201).send(await repository.award(request.context, id))
  })

  app.patch('/api/projects/:id/startup', { preHandler: requireRoles('Administrator', 'Projectdirecteur', 'Projectmanager', 'Werkvoorbereider') }, async request => {
    const { id } = uuidParams.parse(request.params)
    return repository.updateProjectStartup(request.context, id, projectStartupSchema.parse(request.body))
  })

  app.post('/api/projects/:id/planning/generate', { preHandler: requireRoles('Administrator', 'Projectdirecteur', 'Projectmanager', 'Werkvoorbereider', 'Planner') }, async (request, reply) => {
    const { id } = uuidParams.parse(request.params)
    return reply.code(201).send(await repository.generateProjectPlanning(request.context, id))
  })

  app.patch('/api/projects/:id/planning', { preHandler: requireRoles('Administrator', 'Projectdirecteur', 'Projectmanager', 'Werkvoorbereider', 'Planner') }, async request => {
    const { id } = uuidParams.parse(request.params)
    return repository.updateProjectPlanning(request.context, id, projectPlanningSchema.parse(request.body))
  })

  app.post('/api/projects/:id/planning/baseline', { preHandler: requireRoles('Administrator', 'Projectdirecteur', 'Projectmanager', 'Planner') }, async (request, reply) => {
    const { id } = uuidParams.parse(request.params)
    return reply.code(201).send(await repository.baselineProjectPlanning(request.context, id, projectBaselineSchema.parse(request.body ?? {})))
  })

  app.post('/api/projects/:id/daily-reports', { preHandler: requireRoles('Administrator', 'Projectmanager', 'Werfleider', 'Ploegbaas') }, async (request, reply) => {
    const { id } = uuidParams.parse(request.params)
    return reply.code(201).send(await repository.createDailyReport(request.context, id, dailyReportSchema.parse(request.body)))
  })

  app.patch('/api/daily-reports/:id', { preHandler: requireRoles('Administrator', 'Projectmanager', 'Werfleider', 'Ploegbaas') }, async request => {
    const { id } = uuidParams.parse(request.params)
    return repository.updateDailyReport(request.context, id, dailyReportSchema.parse(request.body))
  })

  app.post('/api/daily-reports/:id/submit', { preHandler: requireRoles('Administrator', 'Projectmanager', 'Werfleider', 'Ploegbaas') }, async request => {
    const { id } = uuidParams.parse(request.params)
    return repository.submitDailyReport(request.context, id)
  })

  app.post('/api/daily-reports/:id/sign', { preHandler: requireRoles('Administrator', 'Projectmanager', 'Werfleider') }, async request => {
    const { id } = uuidParams.parse(request.params)
    return repository.signDailyReport(request.context, id, dailyReportSignSchema.parse(request.body).signedBy)
  })

  app.post('/api/daily-reports/:id/photos', { preHandler: requireRoles('Administrator', 'Projectmanager', 'Werfleider', 'Ploegbaas') }, async (request, reply) => {
    const { id } = uuidParams.parse(request.params)
    const upload = await request.file()
    if (!upload) throw new RepositoryError('Selecteer een werffoto', 400)
    const data = await upload.toBuffer()
    const fields = upload.fields as unknown as Record<string, unknown>
    const input = sitePhotoSchema.parse({ workPackageId: multipartField(fields, 'workPackageId') || undefined, caption: multipartField(fields, 'caption') ?? '', location: multipartField(fields, 'location') ?? '', takenAt: multipartField(fields, 'takenAt') })
    return reply.code(201).send(await repository.createSitePhoto(request.context, id, input, { fileName: upload.filename, mimeType: upload.mimetype, data }))
  })

  app.get('/api/site-photos/:id/file', async (request, reply) => {
    const { id } = uuidParams.parse(request.params)
    const { photo, data } = await repository.getSitePhotoFile(request.context, id)
    const safeName = photo.fileName.replace(/["\r\n]/g, '_')
    return reply.header('Content-Type', photo.mimeType).header('Content-Disposition', `inline; filename="${safeName}"`).header('Cache-Control', 'private, max-age=300').send(data)
  })

  app.delete('/api/site-photos/:id', { preHandler: requireRoles('Administrator', 'Projectmanager', 'Werfleider', 'Ploegbaas') }, async (request, reply) => {
    const { id } = uuidParams.parse(request.params)
    await repository.deleteSitePhoto(request.context, id)
    return reply.code(204).send()
  })

  app.post('/api/projects/:id/documents', { preHandler: requireRoles('Administrator', 'Projectmanager', 'Werkvoorbereider', 'Calculator', 'Onderaannemer') }, async (request, reply) => {
    const { id } = uuidParams.parse(request.params)
    const upload = await request.file()
    if (!upload) throw new RepositoryError('Selecteer een document', 400)
    const data = await upload.toBuffer()
    const fields = upload.fields as unknown as Record<string, unknown>
    const input = documentUploadSchema.parse({ title: multipartField(fields, 'title'), category: multipartField(fields, 'category'), notes: multipartField(fields, 'notes') ?? '', uploadedBy: multipartField(fields, 'uploadedBy') })
    return reply.code(201).send(await repository.createDocument(request.context, id, input, { fileName: upload.filename, mimeType: upload.mimetype, data }))
  })

  app.post('/api/documents/:id/revisions', { preHandler: requireRoles('Administrator', 'Projectmanager', 'Werkvoorbereider', 'Calculator') }, async (request, reply) => {
    const { id } = uuidParams.parse(request.params)
    const upload = await request.file()
    if (!upload) throw new RepositoryError('Selecteer een nieuwe documentrevisie', 400)
    const data = await upload.toBuffer()
    const fields = upload.fields as unknown as Record<string, unknown>
    const input = documentRevisionSchema.parse({ notes: multipartField(fields, 'notes') ?? '', uploadedBy: multipartField(fields, 'uploadedBy') })
    return reply.code(201).send(await repository.createDocumentRevision(request.context, id, input, { fileName: upload.filename, mimeType: upload.mimetype, data }))
  })

  app.patch('/api/documents/:id', { preHandler: requireRoles('Administrator', 'Projectmanager', 'Werkvoorbereider', 'Calculator', 'Kwaliteitsverantwoordelijke') }, async request => {
    const { id } = uuidParams.parse(request.params)
    return repository.updateDocumentMetadata(request.context, id, documentMetadataSchema.parse(request.body))
  })

  app.post('/api/documents/:id/record-links', { preHandler: requireRoles('Administrator', 'Projectmanager', 'Werkvoorbereider', 'Calculator', 'Werfleider', 'Kwaliteitsverantwoordelijke') }, async (request, reply) => {
    const { id } = uuidParams.parse(request.params)
    return reply.code(201).send(await repository.linkDocumentRecord(request.context, id, documentRecordLinkSchema.parse(request.body)))
  })

  app.delete('/api/documents/:id/record-links/:linkId', { preHandler: requireRoles('Administrator', 'Projectmanager', 'Werkvoorbereider', 'Kwaliteitsverantwoordelijke') }, async request => {
    const params = z.object({ id: z.uuid(), linkId: z.uuid() }).parse(request.params)
    return repository.unlinkDocumentRecord(request.context, params.id, params.linkId)
  })

  app.get('/api/document-versions/:id/file', async (request, reply) => {
    const { id } = uuidParams.parse(request.params)
    const { version, data } = await repository.getDocumentVersionFile(request.context, id)
    const safeName = version.fileName.replace(/["\r\n]/g, '_')
    return reply.header('Content-Type', version.mimeType).header('Content-Disposition', `attachment; filename="${safeName}"`).header('Cache-Control', 'private, max-age=300').send(data)
  })

  app.post('/api/document-versions/:id/verify-integrity', async request => {
    const { id } = uuidParams.parse(request.params)
    return repository.verifyDocumentVersionIntegrity(request.context, id)
  })

  app.post('/api/documents/:id/submit', { preHandler: requireRoles('Administrator', 'Projectmanager', 'Werkvoorbereider', 'Calculator') }, async request => {
    const { id } = uuidParams.parse(request.params)
    return repository.submitDocument(request.context, id)
  })

  app.post('/api/documents/:id/approve', { preHandler: requireRoles('Administrator', 'Projectmanager', 'Projectdirecteur', 'Kwaliteitsverantwoordelijke') }, async request => {
    const { id } = uuidParams.parse(request.params)
    return repository.approveDocument(request.context, id, documentApprovalSchema.parse(request.body).approvedBy)
  })

  app.post('/api/documents/:id/distribute', { preHandler: requireRoles('Administrator', 'Projectmanager', 'Werkvoorbereider') }, async request => {
    const { id } = uuidParams.parse(request.params)
    const input = documentDistributionSchema.parse(request.body)
    const document = await repository.getDocument(request.context, id)
    if (document.status !== 'Goedgekeurd') throw new RepositoryError('Alleen een goedgekeurd document kan worden verspreid', 409)
    const version = document.versions.find(item => item.id === document.currentVersionId)
    if (!version) throw new RepositoryError('De actuele documentrevisie ontbreekt', 409)
    const file = await repository.getDocumentVersionFile(request.context, version.id)
    const deliveryReferences: Record<string, string> = {}
    try {
      for (const recipient of input.recipients) {
        const result = await documentMailGateway.send({ document, version, recipient, data: file.data, idempotencyKey: `document:${document.id}:${version.id}:${recipient.email.toLowerCase()}` })
        if (result.providerReference) deliveryReferences[recipient.email.toLowerCase()] = result.providerReference
      }
    } catch (error) {
      if (error instanceof EnterpriseGatewayError) throw new RepositoryError(error.message, 503)
      throw error
    }
    return repository.distributeDocument(request.context, id, input, deliveryReferences)
  })

  app.post('/api/document-recipients/:id/read', async request => {
    const { id } = uuidParams.parse(request.params)
    return repository.markDocumentRead(request.context, id)
  })

  app.post('/api/projects/:id/qhse-certificates', { preHandler: requireRoles('Administrator', 'Projectmanager', 'Preventieadviseur', 'Kwaliteitsverantwoordelijke') }, async (request, reply) => {
    const { id } = uuidParams.parse(request.params)
    return reply.code(201).send(await repository.createQhseCertificate(request.context, id, qhseCertificateSchema.parse(request.body)))
  })

  app.post('/api/projects/:id/qhse-inspections', { preHandler: requireRoles('Administrator', 'Projectmanager', 'Werfleider', 'Preventieadviseur', 'Kwaliteitsverantwoordelijke') }, async (request, reply) => {
    const { id } = uuidParams.parse(request.params)
    return reply.code(201).send(await repository.createQhseInspection(request.context, id, qhseInspectionSchema.parse(request.body)))
  })

  app.post('/api/qhse-inspections/:id/findings/:findingId/resolve', { preHandler: requireRoles('Administrator', 'Projectmanager', 'Werfleider', 'Preventieadviseur') }, async request => {
    const { id, findingId } = qhseFindingParams.parse(request.params)
    return repository.resolveQhseFinding(request.context, id, findingId)
  })

  app.post('/api/qhse-inspections/:id/close', { preHandler: requireRoles('Administrator', 'Projectmanager', 'Werfleider', 'Preventieadviseur') }, async request => {
    const { id } = uuidParams.parse(request.params)
    return repository.closeQhseInspection(request.context, id)
  })

  app.post('/api/projects/:id/change-orders', { preHandler: requireRoles('Administrator', 'Projectmanager', 'Werfleider', 'Ploegbaas') }, async (request, reply) => {
    const { id } = uuidParams.parse(request.params)
    return reply.code(201).send(await repository.createChangeOrder(request.context, id, changeOrderSchema.parse(request.body)))
  })

  app.patch('/api/change-orders/:id', { preHandler: requireRoles('Administrator', 'Projectmanager', 'Werfleider') }, async request => {
    const { id } = uuidParams.parse(request.params)
    return repository.updateChangeOrder(request.context, id, changeOrderSchema.parse(request.body))
  })

  app.post('/api/change-orders/:id/calculate', { preHandler: requireRoles('Administrator', 'Projectmanager', 'Werfleider') }, async request => {
    const { id } = uuidParams.parse(request.params)
    return repository.calculateChangeOrder(request.context, id)
  })

  app.post('/api/change-orders/:id/submit', { preHandler: requireRoles('Administrator', 'Projectmanager', 'Werfleider') }, async request => {
    const { id } = uuidParams.parse(request.params)
    return repository.submitChangeOrder(request.context, id)
  })

  app.post('/api/change-orders/:id/approve', { preHandler: requireRoles('Administrator', 'Projectmanager', 'Projectdirecteur', 'Klant') }, async request => {
    const { id } = uuidParams.parse(request.params)
    return repository.approveChangeOrder(request.context, id, changeOrderApprovalSchema.parse(request.body).approvedBy)
  })

  app.post('/api/change-orders/:id/execute', { preHandler: requireRoles('Administrator', 'Projectmanager', 'Werfleider') }, async request => {
    const { id } = uuidParams.parse(request.params)
    return repository.executeChangeOrder(request.context, id)
  })

  app.post('/api/change-orders/:id/ready-for-invoice', { preHandler: requireRoles('Administrator', 'Projectmanager', 'Financiële administratie') }, async request => {
    const { id } = uuidParams.parse(request.params)
    return repository.readyChangeOrderForInvoice(request.context, id)
  })

  app.post('/api/projects/:id/progress-statements', { preHandler: requireRoles('Administrator', 'Projectmanager', 'Financiële administratie') }, async (request, reply) => {
    const { id } = uuidParams.parse(request.params)
    return reply.code(201).send(await repository.createProgressStatement(request.context, id, progressStatementSchema.parse(request.body)))
  })

  app.patch('/api/progress-statements/:id', { preHandler: requireRoles('Administrator', 'Projectmanager', 'Financiële administratie') }, async request => {
    const { id } = uuidParams.parse(request.params)
    return repository.updateProgressStatement(request.context, id, progressStatementSchema.parse(request.body))
  })

  app.post('/api/progress-statements/:id/submit', { preHandler: requireRoles('Administrator', 'Projectmanager', 'Financiële administratie') }, async request => {
    const { id } = uuidParams.parse(request.params)
    return repository.submitProgressStatement(request.context, id)
  })

  app.post('/api/progress-statements/:id/approve', { preHandler: requireRoles('Administrator', 'Projectmanager', 'Projectdirecteur', 'Financiële administratie', 'Klant') }, async request => {
    const { id } = uuidParams.parse(request.params)
    return repository.approveProgressStatement(request.context, id, progressStatementApprovalSchema.parse(request.body).approvedBy)
  })

  app.post('/api/progress-statements/:id/invoice', { preHandler: requireRoles('Administrator', 'Financiële administratie') }, async (request, reply) => {
    const { id } = uuidParams.parse(request.params)
    return reply.code(201).send(await repository.createSalesInvoice(request.context, id, salesInvoiceSchema.parse(request.body)))
  })

  app.post('/api/sales-invoices/:id/issue', { preHandler: requireRoles('Administrator', 'Financiële administratie') }, async request => {
    const { id } = uuidParams.parse(request.params)
    return repository.issueSalesInvoice(request.context, id, salesInvoiceIssueSchema.parse(request.body))
  })

  app.post('/api/sales-invoices/:id/peppol-validation', { preHandler: requireRoles('Administrator', 'Financiële administratie') }, async (request, reply) => {
    const { id } = uuidParams.parse(request.params)
    const exportContext = await repository.salesInvoiceExportContext(request.context, id)
    const xml = buildInvoiceUblDraft(exportContext)
    const result = await peppolValidator.validate(xml)
    return reply.code(201).send(await repository.recordPeppolValidation(request.context, id, result, createHash('sha256').update(xml).digest('hex')))
  })

  app.post('/api/sales-invoices/:id/peppol-delivery', { preHandler: requireRoles('Administrator', 'Financiële administratie') }, async (request, reply) => {
    const { id } = uuidParams.parse(request.params)
    const exportContext = await repository.salesInvoiceExportContext(request.context, id)
    if (exportContext.invoice.status === 'Concept') throw new RepositoryError('Geef de verkoopfactuur eerst uit voordat je ze via Peppol verzendt', 409)
    await repository.assertPeppolProductionReleased(request.context)
    const xml = buildInvoiceUblDraft(exportContext)
    const started = await repository.beginPeppolDelivery(request.context, id, createHash('sha256').update(xml).digest('hex'))
    if (!started.shouldSend) return started.delivery
    const result = await peppolAccessPoint.send({
      xml,
      senderEndpoint: `${exportContext.entity.peppolSchemeId}:${exportContext.entity.peppolEndpointId.replace(/\D/g, '')}`,
      recipientEndpoint: `${exportContext.customer.peppolSchemeId}:${exportContext.customer.peppolEndpointId.replace(/\D/g, '')}`,
      documentTypeId: 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2::Invoice##urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0::2.1',
      processId: 'urn:fdc:peppol.eu:2017:poacc:billing:01:1.0',
      idempotencyKey: started.delivery.idempotencyKey,
      callbackUrl: peppolWebhookPublicUrl ? `${peppolWebhookPublicUrl.replace(/\/$/, '')}/${started.delivery.id}` : undefined,
    })
    return reply.code(201).send(await repository.completePeppolDelivery(request.context, started.delivery.id, result))
  })

  app.post('/api/sales-invoices/:id/peppol-status', { preHandler: requireRoles('Administrator', 'Financiële administratie') }, async request => {
    const { id } = uuidParams.parse(request.params)
    const delivery = await repository.latestPeppolDelivery(request.context, id)
    if (!delivery.providerReference) throw new RepositoryError('Het accesspoint heeft nog geen providerreferentie toegekend', 409)
    return repository.completePeppolDelivery(request.context, delivery.id, await peppolAccessPoint.status(delivery.providerReference), false)
  })

  app.post('/api/sales-invoices/:id/peppol-acceptance', { preHandler: requireRoles('Administrator', 'Financiële administratie') }, async (request, reply) => {
    peppolAcceptanceSchema.parse(request.body)
    const unavailable = integrationChecks.filter(check => ['validator', 'access-point', 'webhook', 'status-monitor'].includes(check.id) && !check.ready)
    if (unavailable.length) throw new RepositoryError(`De acceptatietest kan niet starten: ${unavailable.map(check => check.label).join(', ')} niet gereed`, 409)
    const { id } = uuidParams.parse(request.params)
    const exportContext = await repository.salesInvoiceExportContext(request.context, id)
    const xml = buildInvoiceUblDraft(exportContext)
    const documentDigest = createHash('sha256').update(xml).digest('hex')
    const started = await repository.beginPeppolAcceptanceRun(request.context, id, documentDigest)
    if (!started.shouldExecute) return { run: started.run } satisfies PeppolAcceptanceResult
    let acceptanceSteps = [...started.run.steps]
    let acceptanceValidationReportId: string | undefined
    try {
      const validationInput = await peppolValidator.validate(xml)
      const validationReport = await repository.recordPeppolValidation(request.context, id, validationInput, documentDigest)
      acceptanceValidationReportId = validationReport.id
    const validationStep: PeppolAcceptanceStep = {
      id: 'validation', label: 'Externe validatie', status: validationReport.networkReady ? 'Geslaagd' : 'Mislukt',
      message: validationReport.networkReady ? `${validationReport.engine} bevestigt het Peppol-profiel.` : `${validationReport.engine}: ${validationReport.status}.`,
      at: validationReport.validatedAt, reference: validationReport.id,
    }
    acceptanceSteps = [...acceptanceSteps, validationStep]
    if (!validationReport.networkReady) {
      const run = await repository.updatePeppolAcceptanceRun(request.context, started.run.id, { status: 'Mislukt', steps: acceptanceSteps, validationReportId: validationReport.id })
      return { run, validationReport } satisfies PeppolAcceptanceResult
    }

    const deliveryStart = await repository.beginPeppolDelivery(request.context, id, documentDigest)
    const delivery = deliveryStart.shouldSend ? await repository.completePeppolDelivery(request.context, deliveryStart.delivery.id, await peppolAccessPoint.send({
      xml,
      senderEndpoint: `${exportContext.entity.peppolSchemeId}:${exportContext.entity.peppolEndpointId.replace(/\D/g, '')}`,
      recipientEndpoint: `${exportContext.customer.peppolSchemeId}:${exportContext.customer.peppolEndpointId.replace(/\D/g, '')}`,
      documentTypeId: 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2::Invoice##urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0::2.1',
      processId: 'urn:fdc:peppol.eu:2017:poacc:billing:01:1.0',
      idempotencyKey: deliveryStart.delivery.idempotencyKey,
      callbackUrl: `${peppolWebhookPublicUrl.replace(/\/$/, '')}/${deliveryStart.delivery.id}`,
    })) : deliveryStart.delivery
    const deliveryFailed = delivery.status === 'Fout' || delivery.status === 'Geweigerd'
    const delivered = delivery.status === 'Afgeleverd'
    const submissionStep: PeppolAcceptanceStep = {
      id: 'submission', label: 'Aanlevering accesspoint', status: deliveryFailed ? 'Mislukt' : 'Geslaagd', message: delivery.message,
      at: delivery.updatedAt, reference: delivery.providerReference ?? delivery.id,
    }
    const deliveryStep: PeppolAcceptanceStep = {
      id: 'delivery', label: 'Netwerkaflevering', status: delivered ? 'Geslaagd' : deliveryFailed ? 'Mislukt' : 'In afwachting',
      message: delivered ? delivery.message : deliveryFailed ? delivery.message : 'Wacht op de ondertekende providercallback of automatische statuscontrole.',
      at: delivery.updatedAt, reference: delivery.providerReference,
    }
    const run = await repository.updatePeppolAcceptanceRun(request.context, started.run.id, {
      status: delivered ? 'Geslaagd' : deliveryFailed ? 'Mislukt' : 'In opvolging',
      steps: [...acceptanceSteps, submissionStep, deliveryStep], validationReportId: validationReport.id, deliveryId: delivery.id,
    })
    return reply.code(201).send({ run, validationReport, delivery } satisfies PeppolAcceptanceResult)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Onbekende fout tijdens de acceptatietest'
      const failedAt = new Date().toISOString()
      const failureStep: PeppolAcceptanceStep = { id: acceptanceValidationReportId ? 'submission' : 'validation', label: acceptanceValidationReportId ? 'Aanlevering accesspoint' : 'Externe validatie', status: 'Mislukt', message, at: failedAt }
      const run = await repository.updatePeppolAcceptanceRun(request.context, started.run.id, { status: 'Mislukt', steps: [...acceptanceSteps.filter(step => step.id !== 'submission' && step.id !== 'delivery'), failureStep], validationReportId: acceptanceValidationReportId })
      return reply.code(200).send({ run } satisfies PeppolAcceptanceResult)
    }
  })

  app.post('/api/peppol-acceptance-runs/:id/release', { preHandler: requireRoles('Administrator', 'Directie') }, async request => {
    const { id } = uuidParams.parse(request.params)
    const run = await repository.releasePeppolAcceptanceRun(request.context, id, peppolAcceptanceReleaseSchema.parse(request.body))
    const context = await repository.salesInvoiceExportContext(request.context, run.invoiceId)
    const pdf = await renderPeppolAcceptancePdf({ run, invoiceNumber: context.invoice.number, projectNumber: context.project.number, projectName: context.project.name, senderName: context.entity.name, recipientName: context.customer.name })
    await repository.archivePeppolAcceptanceReport(request.context, run.id, pdf)
    return run
  })

  app.get('/api/peppol-acceptance-runs/:id/pdf', { preHandler: requireRoles('Administrator', 'Directie', 'Financiële administratie') }, async (request, reply) => {
    const { id } = uuidParams.parse(request.params)
    const run = await repository.getPeppolAcceptanceRun(request.context, id)
    const context = await repository.salesInvoiceExportContext(request.context, run.invoiceId)
    const pdf = await renderPeppolAcceptancePdf({ run, invoiceNumber: context.invoice.number, projectNumber: context.project.number, projectName: context.project.name, senderName: context.entity.name, recipientName: context.customer.name })
    return reply.header('Content-Type', 'application/pdf').header('Content-Disposition', `attachment; filename="Peppol-acceptatie-${context.invoice.number}.pdf"`).send(pdf)
  })

  app.post('/api/peppol-alerts/:id/acknowledge', { preHandler: requireRoles('Administrator', 'Financiële administratie') }, async request => {
    return repository.acknowledgePeppolAlert(request.context, uuidParams.parse(request.params).id)
  })

  app.post('/api/sales-invoices/:id/payment', { preHandler: requireRoles('Administrator', 'Financiële administratie') }, async request => {
    const { id } = uuidParams.parse(request.params)
    return repository.registerSalesPayment(request.context, id, paymentRegistrationSchema.parse(request.body))
  })

  app.post('/api/projects/:id/costs', { preHandler: requireRoles('Administrator', 'Projectmanager', 'Aankoper', 'Financiële administratie') }, async (request, reply) => {
    const { id } = uuidParams.parse(request.params)
    return reply.code(201).send(await repository.createProjectCost(request.context, id, projectCostSchema.parse(request.body)))
  })

  app.post('/api/project-costs/:id/settle', { preHandler: requireRoles('Administrator', 'Projectmanager', 'Financiële administratie') }, async (request, reply) => {
    const { id } = uuidParams.parse(request.params)
    return reply.code(201).send(await repository.settleCommitment(request.context, id, commitmentSettlementSchema.parse(request.body)))
  })

  app.post('/api/projects/:id/forecasts', { preHandler: requireRoles('Administrator', 'Projectdirecteur', 'Projectmanager', 'Financiële administratie') }, async (request, reply) => {
    const { id } = uuidParams.parse(request.params)
    return reply.code(201).send(await repository.createProjectForecast(request.context, id, projectForecastSchema.parse(request.body)))
  })
  app.post('/api/project-forecasts/:id/approve',{preHandler:requireRoles('Administrator','Directie','Projectdirecteur','Financiële administratie')},async request=>repository.approveProjectForecast(request.context,uuidParams.parse(request.params).id))

  app.post('/api/suppliers', { preHandler: requireRoles('Administrator', 'Aankoper') }, async (request, reply) => reply.code(201).send(await repository.createSupplier(request.context, supplierSchema.parse(request.body))))
  app.post('/api/assets', { preHandler: requireRoles('Administrator', 'Planner', 'Magazijnier', 'Projectmanager') }, async (request, reply) => reply.code(201).send(await repository.createAsset(request.context, assetSchema.parse(request.body))))
  app.post('/api/assets/:id/operations', { preHandler: requireRoles('Administrator','Planner','Magazijnier','Projectmanager','Werfleider') }, async request => repository.addAssetOperation(request.context,uuidParams.parse(request.params).id,assetOperationalSchema.parse(request.body)))
  app.post('/api/warehouses', { preHandler: requireRoles('Administrator', 'Magazijnier', 'Aankoper') }, async (request, reply) => reply.code(201).send(await repository.createWarehouse(request.context, warehouseSchema.parse(request.body))))
  app.post('/api/inventory-items', { preHandler: requireRoles('Administrator', 'Magazijnier', 'Aankoper') }, async (request, reply) => reply.code(201).send(await repository.createInventoryItem(request.context, inventoryItemSchema.parse(request.body))))
  app.post('/api/inventory-items/:id/count',{preHandler:requireRoles('Administrator','Magazijnier')},async request=>repository.countInventory(request.context,uuidParams.parse(request.params).id,inventoryCountSchema.parse(request.body)))
  app.post('/api/stock-movements', { preHandler: requireRoles('Administrator', 'Magazijnier', 'Werfleider', 'Aankoper') }, async (request, reply) => reply.code(201).send(await repository.registerStockMovement(request.context, stockMovementSchema.parse(request.body))))
  app.post('/api/employees', { preHandler: requireRoles('Administrator','Directie','HR') }, async (request, reply) => reply.code(201).send(await repository.createEmployee(request.context, employeeSchema.parse(request.body))))
  app.post('/api/employee-crews', { preHandler: requireRoles('Administrator','Directie','HR','Planner') }, async (request, reply) => reply.code(201).send(await repository.createEmployeeCrew(request.context, employeeCrewSchema.parse(request.body))))
  app.post('/api/employee-absences', { preHandler: requireRoles('Administrator','Directie','HR','Projectmanager','Planner','Werfleider','Arbeider') }, async (request, reply) => reply.code(201).send(await repository.createEmployeeAbsence(request.context, employeeAbsenceSchema.parse(request.body))))
  app.post('/api/employee-absences/:id/decision', { preHandler: requireRoles('Administrator','Directie','HR') }, async request => repository.decideEmployeeAbsence(request.context, uuidParams.parse(request.params).id, employeeAbsenceDecisionSchema.parse(request.body)))
  app.post('/api/subcontractors', { preHandler: requireRoles('Administrator','Aankoper','Projectmanager','Preventieadviseur') }, async (request, reply) => reply.code(201).send(await repository.createSubcontractor(request.context, subcontractorSchema.parse(request.body))))
  app.post('/api/subcontractors/:id/invite', { preHandler: requireRoles('Administrator','Aankoper','Projectmanager') }, async request => repository.inviteSubcontractor(request.context, uuidParams.parse(request.params).id))
  app.post('/api/subcontractors/:id/operations', { preHandler: requireRoles('Administrator','Aankoper','Projectmanager','Werfleider','Preventieadviseur','Onderaannemer') }, async request => repository.addSubcontractorOperation(request.context,uuidParams.parse(request.params).id,subcontractorOperationSchema.parse(request.body)))
  app.post('/api/subcontractors/:id/progress/:progressId/decision', { preHandler: requireRoles('Administrator','Projectdirecteur','Projectmanager','Financiële administratie') }, async request=>{const params=z.object({id:z.uuid(),progressId:z.uuid()}).parse(request.params);return repository.decideSubcontractorProgress(request.context,params.id,params.progressId,subcontractorProgressDecisionSchema.parse(request.body).status)})
  app.post('/api/qhse-events', { preHandler: requireRoles('Administrator','Projectmanager','Werfleider','Preventieadviseur','Kwaliteitsverantwoordelijke') }, async (request, reply) => reply.code(201).send(await repository.createQhseEvent(request.context, qhseEventSchema.parse(request.body))))
  app.post('/api/qhse-events/:id/close', { preHandler: requireRoles('Administrator','Projectmanager','Preventieadviseur') }, async request => repository.closeQhseEvent(request.context, uuidParams.parse(request.params).id))
  app.post('/api/work-tickets', { preHandler: requireRoles('Administrator','Projectmanager','Werfleider','Ploegbaas') }, async (request, reply) => reply.code(201).send(await repository.createWorkTicket(request.context, workTicketSchema.parse(request.body))))
  app.post('/api/work-tickets/:id/submit', { preHandler: requireRoles('Administrator','Projectmanager','Werfleider','Ploegbaas') }, async request => repository.submitWorkTicket(request.context, uuidParams.parse(request.params).id))
  app.post('/api/work-tickets/:id/sign', { preHandler: requireRoles('Administrator','Projectmanager','Werfleider','Klant','Onderaannemer') }, async request => repository.signWorkTicket(request.context, uuidParams.parse(request.params).id, workTicketSignatureSchema.parse(request.body).signedBy))
  app.post('/api/time-entries', { preHandler: requireRoles('Administrator','HR','Projectmanager','Werfleider','Ploegbaas','Arbeider') }, async (request, reply) => reply.code(201).send(await repository.createTimeEntry(request.context, timeEntrySchema.parse(request.body))))
  app.post('/api/time-entries/:id/submit', { preHandler: requireRoles('Administrator','HR','Projectmanager','Werfleider','Ploegbaas','Arbeider') }, async request => repository.submitTimeEntry(request.context, uuidParams.parse(request.params).id))
  app.post('/api/time-entries/:id/decision', { preHandler: requireRoles('Administrator','HR','Projectmanager','Werfleider') }, async request => { const input=timeEntryDecisionSchema.parse(request.body); return repository.decideTimeEntry(request.context,uuidParams.parse(request.params).id,input.decision,input.reason) })
  app.post('/api/project-claims', { preHandler: requireRoles('Administrator','Directie','Projectdirecteur','Projectmanager','Werfleider') }, async (request, reply) => reply.code(201).send(await repository.createProjectClaim(request.context, projectClaimSchema.parse(request.body))))
  app.post('/api/project-claims/:id/transition', { preHandler: requireRoles('Administrator','Directie','Projectdirecteur','Projectmanager','Klant') }, async request => { const input=projectClaimTransitionSchema.parse(request.body); return repository.transitionProjectClaim(request.context,uuidParams.parse(request.params).id,input.action,input.notes) })
  app.post('/api/joint-ventures', { preHandler: [requireRoles('Administrator','Directie','Financiële administratie'), requireAllLegalEntities] }, async (request, reply) => reply.code(201).send(await repository.createJointVenture(request.context, jointVentureSchema.parse(request.body))))
  const erpOnHold = async (_request:FastifyRequest,reply:FastifyReply)=>reply.code(423).send({message:'ERP-integraties staan expliciet on hold tot gezamenlijke vrijgave voor livegang.'})
  app.post('/api/integration-connections', { preHandler: requireRoles('Administrator','Financiële administratie') }, erpOnHold)
  app.post('/api/integration-connections/:id/test', { preHandler: requireRoles('Administrator','Financiële administratie') }, erpOnHold)
  app.post('/api/integration-jobs', { preHandler: requireRoles('Administrator','Financiële administratie') }, erpOnHold)
  app.post('/api/integration-jobs/:id/process', { preHandler: requireRoles('Administrator','Financiële administratie') }, erpOnHold)
  app.post('/api/projects/:id/ai-analyses', { preHandler: requireRoles('Administrator','Directie','Calculator','Projectmanager','Werkvoorbereider') }, async (request, reply) => reply.code(201).send(await repository.createAiAnalysis(request.context, uuidParams.parse(request.params).id, aiAnalysisSchema.parse(request.body))))
  app.post('/api/ai-analyses/:id/approve', { preHandler: requireRoles('Administrator','Directie','Projectmanager') }, async request => repository.approveAiAnalysis(request.context, uuidParams.parse(request.params).id, aiApprovalSchema.parse(request.body).approvedBy))
  app.post('/api/projects/:id/contracts', { preHandler: requireRoles('Administrator','Directie','Projectdirecteur','Projectmanager') }, async (request, reply) => reply.code(201).send(await repository.createProjectContract(request.context, uuidParams.parse(request.params).id, projectContractSchema.parse(request.body))))
  app.patch('/api/contracts/:id', { preHandler: requireRoles('Administrator','Directie','Projectdirecteur','Projectmanager') }, async request => repository.updateProjectContract(request.context, uuidParams.parse(request.params).id, projectContractUpdateSchema.parse(request.body)))
  app.post('/api/contracts/:id/submit', { preHandler: requireRoles('Administrator','Projectdirecteur','Projectmanager') }, async request => repository.submitProjectContract(request.context, uuidParams.parse(request.params).id))
  app.post('/api/contracts/:id/approve', { preHandler: requireRoles('Administrator','Directie','Projectdirecteur') }, async request => repository.approveProjectContract(request.context, uuidParams.parse(request.params).id))
  app.post('/api/contracts/:id/obligations/:obligationId/complete', { preHandler: requireRoles('Administrator','Projectdirecteur','Projectmanager','Werkvoorbereider') }, async request => { const params=z.object({id:z.uuid(),obligationId:z.uuid()}).parse(request.params); return repository.completeContractObligation(request.context, params.id, params.obligationId) })
  app.post('/api/projects/:id/closeouts', { preHandler: requireRoles('Administrator','Projectdirecteur','Projectmanager','Kwaliteitsverantwoordelijke') }, async (request, reply) => reply.code(201).send(await repository.createProjectCloseout(request.context, uuidParams.parse(request.params).id, projectCloseoutSchema.parse(request.body))))
  app.patch('/api/closeouts/:id', { preHandler: requireRoles('Administrator','Projectdirecteur','Projectmanager','Kwaliteitsverantwoordelijke') }, async request => repository.updateProjectCloseout(request.context, uuidParams.parse(request.params).id, projectCloseoutSchema.parse(request.body)))
  app.post('/api/closeouts/:id/customer-sign', { preHandler: requireRoles('Klant') }, async request => repository.customerSignProjectCloseout(request.context, uuidParams.parse(request.params).id))
  app.post('/api/closeouts/:id/items', { preHandler: requireRoles('Administrator','Projectmanager','Werfleider','Kwaliteitsverantwoordelijke') }, async (request, reply) => reply.code(201).send(await repository.addCloseoutItem(request.context, uuidParams.parse(request.params).id, closeoutItemSchema.parse(request.body))))
  app.post('/api/closeouts/:id/items/:itemId/resolve', { preHandler: requireRoles('Administrator','Projectmanager','Werfleider','Kwaliteitsverantwoordelijke') }, async request => { const params=z.object({id:z.uuid(),itemId:z.uuid()}).parse(request.params); return repository.resolveCloseoutItem(request.context, params.id, params.itemId) })
  app.post('/api/closeouts/:id/service-requests', { preHandler: requireRoles('Administrator','Projectmanager','Werfleider','Kwaliteitsverantwoordelijke') }, async (request, reply) => reply.code(201).send(await repository.addServiceRequest(request.context, uuidParams.parse(request.params).id, serviceRequestSchema.parse(request.body))))
  app.post('/api/closeouts/:id/service-requests/:requestId/resolve', { preHandler: requireRoles('Administrator','Projectmanager','Werfleider','Kwaliteitsverantwoordelijke') }, async request => { const params=z.object({id:z.uuid(),requestId:z.uuid()}).parse(request.params); return repository.resolveServiceRequest(request.context, params.id, params.requestId) })

  app.post('/api/projects/:id/procurement-requests', { preHandler: requireRoles('Administrator', 'Projectmanager', 'Werkvoorbereider', 'Aankoper') }, async (request, reply) => {
    const { id } = uuidParams.parse(request.params)
    return reply.code(201).send(await repository.createProcurementRequest(request.context, id, procurementRequestSchema.parse(request.body)))
  })

  app.post('/api/procurement-requests/:id/issue', { preHandler: requireRoles('Administrator', 'Aankoper') }, async request => {
    const { id } = uuidParams.parse(request.params)
    return repository.issuePriceRequest(request.context, id)
  })
  app.post('/api/suppliers/:id/framework-agreements', { preHandler: requireRoles('Administrator', 'Aankoper', 'Projectdirecteur') }, async (request, reply) => reply.code(201).send(await repository.createSupplierFrameworkAgreement(request.context, uuidParams.parse(request.params).id, supplierFrameworkAgreementSchema.parse(request.body))))
  app.post('/api/procurement-requests/:id/approve',{preHandler:requireRoles('Administrator','Directie','Projectdirecteur','Projectmanager')},async request=>repository.approveProcurementRequest(request.context,uuidParams.parse(request.params).id))

  app.post('/api/procurement-requests/:id/quotes', { preHandler: requireRoles('Administrator', 'Aankoper', 'Leverancier') }, async request => {
    const { id } = uuidParams.parse(request.params)
    return repository.addSupplierQuote(request.context, id, supplierQuoteSchema.parse(request.body))
  })

  app.post('/api/procurement-requests/:id/quotes/:quoteId/select', { preHandler: requireRoles('Administrator', 'Aankoper', 'Projectmanager') }, async (request, reply) => {
    const params = request.params as { id: string; quoteId: string }
    const { id } = uuidParams.parse({ id: params.id })
    const { id: quoteId } = uuidParams.parse({ id: params.quoteId })
    return reply.code(201).send(await repository.selectSupplierQuote(request.context, id, quoteId))
  })

  app.post('/api/purchase-orders/:id/receive', { preHandler: requireRoles('Administrator', 'Aankoper', 'Magazijnier', 'Werfleider') }, async request => {
    const { id } = uuidParams.parse(request.params)
    return repository.receivePurchaseOrder(request.context, id, purchaseReceiptSchema.parse(request.body))
  })

  app.get('/api/purchase-orders/:id/pdf', { preHandler: requireRoles('Administrator', 'Aankoper', 'Projectmanager', 'Financiële administratie', 'Leverancier') }, async (request, reply) => {
    const { id } = uuidParams.parse(request.params)
    const dossier = await repository.purchaseOrderDocument(request.context, id)
    const pdf = await renderPurchaseOrderPdf(dossier)
    return reply.header('Content-Type', 'application/pdf').header('Content-Disposition', `attachment; filename="${dossier.order.number}.pdf"`).send(pdf)
  })

  app.post('/api/purchase-orders/:id/match-invoice', { preHandler: requireRoles('Administrator', 'Aankoper', 'Financiële administratie') }, async request => {
    const { id } = uuidParams.parse(request.params)
    return repository.matchPurchaseInvoice(request.context, id, purchaseInvoiceMatchSchema.parse(request.body))
  })

  app.post('/api/purchase-orders/:id/approve-deviation', { preHandler: requireRoles('Administrator', 'Directie', 'Projectdirecteur', 'Financiële administratie') }, async request => {
    const { id } = uuidParams.parse(request.params)
    const { reason } = purchaseDeviationApprovalSchema.parse(request.body)
    return repository.approvePurchaseInvoiceDeviation(request.context, id, reason)
  })

  app.post('/api/purchase-orders/:id/payment', { preHandler: requireRoles('Administrator', 'Financiële administratie') }, async request => {
    const { id } = uuidParams.parse(request.params)
    return repository.registerPurchasePayment(request.context, id, paymentRegistrationSchema.parse(request.body))
  })

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) return reply.code(400).send({ error: 'validation_error', message: 'De invoer is ongeldig', details: error.issues })
    if (error instanceof RepositoryError || error instanceof AuthenticationError || error instanceof AuthorizationError || error instanceof BoqFileError) return reply.code(error.statusCode).send({ error: 'request_error', message: error.message })
    if (error instanceof RateLimitError) return reply.header('Retry-After', String(error.retryAfterSeconds)).code(429).send({ error: 'rate_limit', message: 'Te veel aanvragen. Probeer het later opnieuw.' })
    app.log.error({ error, requestId: _request.id }, 'Onverwachte API-fout')
    return reply.code(500).send({ error: 'internal_error', message: 'Er ging iets onverwacht mis', requestId: _request.id })
  })

  app.addHook('onClose', async () => pool.end())
  return app
}

class RateLimitError extends Error {
  readonly retryAfterSeconds: number
  constructor(retryAfterSeconds: number) { super('Rate limit overschreden'); this.retryAfterSeconds = retryAfterSeconds }
}
