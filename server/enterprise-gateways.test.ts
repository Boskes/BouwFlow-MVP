import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAiGateway, createDocumentMailGateway, createIntegrationGateway, createQuoteMailGateway, DisabledAiGateway, DisabledDocumentMailGateway, DisabledIntegrationGateway, DisabledQuoteMailGateway, HttpAiGateway, HttpDocumentMailGateway, HttpIntegrationGateway, HttpQuoteMailGateway } from './enterprise-gateways.js'
import type { IntegrationConnection, IntegrationJob, Quote } from '../src/domain.js'

const connection: IntegrationConnection = { id: 'connection-1', name: 'ERP', provider: 'Generieke REST', legalEntityId: 'entity-1', endpoint: 'https://erp.example.test/bouwflow', status: 'Actief', createdAt: '2026-01-01T00:00:00.000Z' }
const job: IntegrationJob = { id: 'job-1', connectionId: connection.id, entityType: 'Project', entityId: 'project-1', direction: 'Export', status: 'Bezig', attempts: 1, payloadDigest: 'digest', nextAttemptAt: '2026-01-01T00:00:00.000Z', createdAt: '2026-01-01T00:00:00.000Z' }

afterEach(() => vi.unstubAllGlobals())

describe('enterprise gateways', () => {
  it('blijft in productie uitgeschakeld zonder expliciete configuratie', () => {
    expect(createIntegrationGateway(true, {})).toBeInstanceOf(DisabledIntegrationGateway)
    expect(createAiGateway(true, {})).toBeInstanceOf(DisabledAiGateway)
    expect(createQuoteMailGateway(true, {})).toBeInstanceOf(DisabledQuoteMailGateway)
    expect(createDocumentMailGateway(true, {})).toBeInstanceOf(DisabledDocumentMailGateway)
  })

  it('weigert integratie-endpoints buiten de HTTPS-allowlist', async () => {
    const gateway = new HttpIntegrationGateway(['https://allowed.example.test'])
    await expect(gateway.test(connection)).rejects.toThrow('allowlist')
  })

  it('stuurt jobs idempotent naar een allowlisted gateway', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)
    const gateway = new HttpIntegrationGateway(['https://erp.example.test'], '{"https://erp.example.test":"secret"}')
    await gateway.dispatch(connection, job)
    expect(fetchMock).toHaveBeenCalledWith(connection.endpoint, expect.objectContaining({ method: 'POST', redirect: 'error' }))
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect((init.headers as Record<string, string>)['idempotency-key']).toBe(job.id)
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer secret')
  })

  it('weigert AI-bronnen die niet in het dossier zitten', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ answer: 'Analyse', sourceIds: ['unknown'] }), { status: 200, headers: { 'content-type': 'application/json' } })))
    const gateway = new HttpAiGateway('https://ai.example.test/analyze', 'token')
    await expect(gateway.analyze({ project: { id: 'project-1' } as never, request: { type: 'Projectvraag', question: 'Status?', createdBy: 'tester' }, sources: [{ documentId: 'doc-1', title: 'Contract', excerpt: '...' }] })).rejects.toThrow('onbekende bron')
  })

  it('verzendt een offerte met idempotentiesleutel en PDF-bijlage', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ providerReference: 'mail-42' }), { status: 200, headers: { 'content-type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)
    const gateway = new HttpQuoteMailGateway('https://mail.example.test/quote', 'secret')
    const quote = { id: 'quote-1', number: 'OFF-2026-001', version: 2, content: { subject: 'Offerte werf', introduction: 'In bijlage.' } } as Quote
    const result = await gateway.send({ quote, recipient: 'klant@example.be', sentBy: 'Sofie', pdf: Buffer.from('%PDF-test'), idempotencyKey: 'quote:quote-1:v2:klant@example.be' })
    expect(result.providerReference).toBe('mail-42')
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect((init.headers as Record<string, string>)['idempotency-key']).toBe('quote:quote-1:v2:klant@example.be')
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer secret')
    expect(JSON.parse(String(init.body))).toMatchObject({ to: 'klant@example.be', attachment: { fileName: 'OFF-2026-001.pdf', contentType: 'application/pdf' } })
  })

  it('verspreidt de werkelijke documentrevisie met een stabiele idempotentiesleutel', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ providerReference: 'document-mail-9' }), { status: 200, headers: { 'content-type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)
    const gateway = new HttpDocumentMailGateway('https://mail.example.test/document', 'secret')
    const document = { id:'document-1',title:'Uitvoeringsplan' } as never
    const version = { id:'version-2',revisionLabel:'B',fileName:'plan-b.pdf',mimeType:'application/pdf' } as never
    await gateway.send({ document, version, recipient:{name:'Peter',email:'peter@example.be'}, data:Buffer.from('%PDF-b'), idempotencyKey:'document:document-1:version-2:peter@example.be' })
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect((init.headers as Record<string,string>)['idempotency-key']).toBe('document:document-1:version-2:peter@example.be')
    expect(JSON.parse(String(init.body))).toMatchObject({to:'peter@example.be',attachment:{fileName:'plan-b.pdf',contentType:'application/pdf'},metadata:{versionId:'version-2',revision:'B'}})
  })
})
