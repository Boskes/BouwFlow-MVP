import { describe, expect, it, vi } from 'vitest'
import type { PeppolNotification } from '../../src/domain.js'
import { createMicrosoft365PeppolNotificationSender, Microsoft365PeppolNotificationSender, MicrosoftGraphTokenProvider, teamsWebhooksFromJson } from './microsoft365-notification.js'

const notification: PeppolNotification = {
  id: 'notification-42', alertId: 'alert-1', channel: 'E-mail', kind: 'Testmelding', destination: 'finance@example.be',
  subject: 'BouwFlow Peppol-testmelding', message: 'De connector werkt.', status: 'In wachtrij', attempts: 0,
  nextAttemptAt: '2027-01-01T00:00:00.000Z', createdAt: '2027-01-01T00:00:00.000Z', updatedAt: '2027-01-01T00:00:00.000Z',
}

describe('Microsoft 365 Peppol-notificaties', () => {
  it('vraagt een client-credentialstoken met Graph .default en hergebruikt dit', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ access_token: 'graph-token', expires_in: 3600 }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    const fetcher = fetchMock as unknown as typeof fetch
    const provider = new MicrosoftGraphTokenProvider('tenant-id', 'client-id', 'client-secret', fetcher)

    await expect(provider.accessToken()).resolves.toBe('graph-token')
    await expect(provider.accessToken()).resolves.toBe('graph-token')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0][1]?.body)).toContain('scope=https%3A%2F%2Fgraph.microsoft.com%2F.default')
  })

  it('verstuurt e-mail via Graph vanuit de geconfigureerde mailbox', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => String(input).includes('/token')
      ? new Response(JSON.stringify({ access_token: 'graph-token', expires_in: 3600 }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      : new Response('', { status: 202 }))
    const fetcher = fetchMock as unknown as typeof fetch
    const provider = new MicrosoftGraphTokenProvider('tenant-id', 'client-id', 'client-secret', fetcher)
    const sender = new Microsoft365PeppolNotificationSender('bouwflow@example.be', provider, {}, fetcher)
    expect(sender.configuredChannels).toEqual(['E-mail'])

    await sender.send(notification)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1][0]).toBe('https://graph.microsoft.com/v1.0/users/bouwflow%40example.be/sendMail')
    expect(fetchMock.mock.calls[1][1]).toEqual(expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer graph-token' }), body: expect.stringContaining('x-bouwflow-notification-id') }))
  })

  it('vernieuwt een geweigerd Graph-token eenmaal', async () => {
    let tokenNumber = 0
    let graphNumber = 0
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      if (String(input).includes('/token')) return new Response(JSON.stringify({ access_token: `token-${++tokenNumber}`, expires_in: 3600 }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      graphNumber += 1
      return new Response(graphNumber === 1 ? 'expired' : '', { status: graphNumber === 1 ? 401 : 202 })
    }) as unknown as typeof fetch
    const provider = new MicrosoftGraphTokenProvider('tenant-id', 'client-id', 'client-secret', fetcher)

    await new Microsoft365PeppolNotificationSender('bouwflow@example.be', provider, {}, fetcher).send(notification)

    expect(tokenNumber).toBe(2)
    expect(graphNumber).toBe(2)
  })

  it('verstuurt een Adaptive Card via de opgeslagen Teams Workflow-webhook', async () => {
    const fetchMock = vi.fn(async () => new Response('', { status: 202 }))
    const fetcher = fetchMock as unknown as typeof fetch
    const sender = new Microsoft365PeppolNotificationSender(undefined, undefined, { Directie: 'https://example.logic.azure.com/workflows/secret' }, fetcher)
    expect(sender.configuredChannels).toEqual(['Teams'])

    await sender.send({ ...notification, channel: 'Teams', destination: 'Directie' })

    expect(fetchMock).toHaveBeenCalledWith('https://example.logic.azure.com/workflows/secret', expect.objectContaining({ method: 'POST', body: expect.stringContaining('application/vnd.microsoft.card.adaptive') }))
    await expect(sender.send({ ...notification, channel: 'Teams', destination: 'Onbekend' })).rejects.toThrow('Geen Teams Workflow-webhook')
  })

  it('valideert providerconfiguratie en Teams-doelmapping', () => {
    expect(createMicrosoft365PeppolNotificationSender({})).toBeUndefined()
    expect(() => createMicrosoft365PeppolNotificationSender({ tenantId: 'tenant' })).toThrow('onvolledig')
    expect(teamsWebhooksFromJson('{"Directie":"https://example.logic.azure.com/hook"}')).toEqual({ Directie: 'https://example.logic.azure.com/hook' })
    expect(() => teamsWebhooksFromJson('[]')).toThrow('JSON-object')
  })
})
