import 'fake-indexeddb/auto'
import { describe, expect, it, vi } from 'vitest'
import { ApiError, BouwFlowApi, OfflineMutationQueuedError } from './api'

describe('BouwFlowApi', () => {
  it('behoudt de browsercontext bij native fetch-aanroepen', async () => {
    const receiverSensitiveFetcher = vi.fn(function (this: typeof globalThis) {
      if (this !== globalThis) throw new TypeError('Illegal invocation')
      return Promise.resolve(new Response(JSON.stringify({ organizations: [], opportunities: [], calculations: [], quotes: [], projects: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    })
    const api = new BouwFlowApi('https://api.example.test', receiverSensitiveFetcher)

    await expect(api.bootstrap()).resolves.toMatchObject({ projects: [] })
  })

  it('bouwt getypeerde API-aanvragen met bearer-token', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ organizations: [], opportunities: [], calculations: [], quotes: [], projects: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    const api = new BouwFlowApi('https://api.example.test/', fetcher, async () => 'access-token')

    const state = await api.bootstrap()

    expect(state.projects).toEqual([])
    expect(fetcher).toHaveBeenCalledWith('https://api.example.test/api/bootstrap', expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer access-token' }) }))
  })

  it('scheidt offline gegevens per Entra-tenant en gebruiker', async () => {
    const claims = globalThis.btoa(JSON.stringify({ tid: 'tenant-a', oid: 'user-a' })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
    const api = new BouwFlowApi('https://api.example.test/', vi.fn(), async () => `header.${claims}.signature`)
    await expect(api.offlineScope()).resolves.toBe('https://api.example.test|tenant-a|user-a')
  })

  it('stuurt de gekozen demogebruiker mee en isoleert diens offline gegevens', async () => {
    const claims = globalThis.btoa(JSON.stringify({ tid: 'tenant-a', oid: 'admin-a' })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ organizations: [], opportunities: [], calculations: [], quotes: [], projects: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    const api = new BouwFlowApi('https://api.example.test/', fetcher, async () => `header.${claims}.signature`)

    api.setDemoUser('demo-client')
    await api.bootstrap()

    expect(fetcher).toHaveBeenCalledWith(
      'https://api.example.test/api/bootstrap',
      expect.objectContaining({ headers: expect.objectContaining({ 'X-BouwFlow-Demo-User': 'demo-client' }) }),
    )
    await expect(api.offlineScope()).resolves.toBe('https://api.example.test|tenant-a|admin-a|demo:demo-client')

    api.setDemoUser()
    await expect(api.offlineScope()).resolves.toBe('https://api.example.test|tenant-a|admin-a')
  })

  it('vertaalt API-fouten naar een bruikbare fout', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ message: 'Calculatie niet gevonden' }), { status: 404, headers: { 'Content-Type': 'application/json' } }))
    const api = new BouwFlowApi('https://api.example.test', fetcher)

    await expect(api.updateCalculation('00000000-0000-4000-8000-000000000001', { marginPct: 12 })).rejects.toBeInstanceOf(ApiError)
    await expect(api.updateCalculation('00000000-0000-4000-8000-000000000001', { marginPct: 12 })).rejects.toMatchObject({ message: 'Calculatie niet gevonden', status: 404 })
  })

  it('ondersteunt lege 204-antwoorden bij verwijderen', async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 204 }))
    const api = new BouwFlowApi('https://api.example.test', fetcher)

    await expect(api.removeBoqItem('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002')).resolves.toBeUndefined()
  })

  it('verstuurt een bulkprijsaanpassing als één centrale calculatiemutatie', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ calculation: { id: 'calc-1' }, affectedItems: 2, skippedItems: 0 }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    const api = new BouwFlowApi('https://api.example.test', fetcher)
    const calculationId = '00000000-0000-4000-8000-000000000001'
    const itemIds = ['00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003']
    const adjustment = { id: '00000000-0000-4000-8000-000000000004', label: 'Projectrisico', type: 'Markup' as const, basis: 'Directe kost' as const, percentage: 4, active: true }

    await expect(api.bulkApplyBoqPriceAdjustment(calculationId, itemIds, adjustment)).resolves.toMatchObject({ affectedItems: 2 })
    expect(fetcher).toHaveBeenCalledWith(
      `https://api.example.test/api/calculations/${calculationId}/price-adjustments/bulk-apply`,
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ itemIds, adjustment }) }),
    )
  })

  it('downloadt een offerte-PDF met authenticatie', async () => {
    const fetcher = vi.fn(async () => new Response(new Blob(['%PDF-test'], { type: 'application/pdf' }), { status: 200, headers: { 'Content-Type': 'application/pdf' } }))
    const api = new BouwFlowApi('https://api.example.test', fetcher, async () => 'pdf-token')

    const blob = await api.downloadQuotePdf('offerte/1')

    expect(blob.type).toBe('application/pdf')
    expect(fetcher).toHaveBeenCalledWith('https://api.example.test/api/quotes/offerte%2F1/pdf', { headers: { Accept: 'application/pdf', Authorization: 'Bearer pdf-token' } })
  })

  it('downloadt een Peppol-acceptatierapport met authenticatie', async () => {
    const fetcher = vi.fn(async () => new Response(new Blob(['%PDF-acceptatie'], { type: 'application/pdf' }), { status: 200, headers: { 'Content-Type': 'application/pdf' } }))
    const api = new BouwFlowApi('https://api.example.test', fetcher, async () => 'acceptance-token')

    const blob = await api.downloadPeppolAcceptancePdf('run/1')

    expect(blob.type).toBe('application/pdf')
    expect(fetcher).toHaveBeenCalledWith('https://api.example.test/api/peppol-acceptance-runs/run%2F1/pdf', { headers: { Accept: 'application/pdf', Authorization: 'Bearer acceptance-token' } })
  })

  it('bewaart een werfmutatie bij netwerkuitval en speelt die exact eenmaal opnieuw af', async () => {
    const claims = globalThis.btoa(JSON.stringify({ tid: `tenant-${crypto.randomUUID()}`, oid: `user-${crypto.randomUUID()}` })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
    const fetcher = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'org-1' }), { status: 201, headers: { 'Content-Type': 'application/json', ETag: '"8"' } }))
    const api = new BouwFlowApi('https://api.offline.test', fetcher, async () => `header.${claims}.signature`)

    await expect(api.createOrganization({ name: 'Offline werfpartner', type: 'Privaat', contactName: 'Werf Contact', email: 'werf@example.be', vatNumber: 'BE0123456789', addressLine: 'Werfstraat 1', postalCode: '3500', city: 'Hasselt', countryCode: 'BE', peppolEndpointId: '', peppolSchemeId: '0208' })).rejects.toBeInstanceOf(OfflineMutationQueuedError)
    await expect(api.offlineQueueSize()).resolves.toBe(1)
    await expect(api.flushOfflineQueue()).resolves.toEqual({ completed: 1, pending: 0, blocked: 0 })
    await expect(api.offlineQueueSize()).resolves.toBe(0)
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(fetcher.mock.calls[1][1]).toMatchObject({ method: 'POST', headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String), Authorization: expect.stringContaining('Bearer ') }) })
  })

  it('bewaart een offline bestand en herstelt de multipart-upload bij synchronisatie', async () => {
    const claims = globalThis.btoa(JSON.stringify({ tid: `tenant-${crypto.randomUUID()}`, oid: `user-${crypto.randomUUID()}` })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
    const fetcher = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'version-1' }), { status: 201, headers: { 'Content-Type': 'application/json' } }))
    const api = new BouwFlowApi('https://api.offline.test', fetcher, async () => `header.${claims}.signature`)
    const file = new File(['werfbeeld'], 'werfbeeld.jpg', { type: 'image/jpeg' })

    await expect(api.uploadDocumentRevision('document-1', file, { notes: 'Offline revisie', uploadedBy: 'Werfleider' })).rejects.toBeInstanceOf(OfflineMutationQueuedError)
    await expect(api.flushOfflineQueue()).resolves.toEqual({ completed: 1, pending: 0, blocked: 0 })
    const replay = fetcher.mock.calls[1][1] as RequestInit
    expect(replay.body).toBeInstanceOf(FormData)
    const replayedFile = (replay.body as FormData).get('file') as File
    expect(replayedFile.name).toBe('werfbeeld.jpg')
    expect(await replayedFile.text()).toBe('werfbeeld')
    expect(new Headers(replay.headers).has('Content-Type')).toBe(false)
  })
})
