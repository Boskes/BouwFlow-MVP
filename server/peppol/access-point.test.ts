import { describe, expect, it, vi } from 'vitest'
import { HttpPeppolAccessPoint } from './access-point'

describe('Peppol-accesspointadapter', () => {
  it('verstuurt UBL met adressering, profiel en idempotentiesleutel', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ accepted: true, trackingId: 'AP-7788', provider: 'Test AP' }), { status: 202 })) as unknown as typeof fetch
    const accessPoint = new HttpPeppolAccessPoint('https://accesspoint.example.test/documents', 'secret', fetcher)
    expect(accessPoint.configured).toBe(true)

    const result = await accessPoint.send({ xml: '<Invoice />', senderEndpoint: '0208:0123456749', recipientEndpoint: '0208:0200000043', documentTypeId: 'invoice-document-type', processId: 'billing-process', idempotencyKey: 'peppol:tenant:invoice', callbackUrl: 'https://bouwflow.example/api/integrations/peppol/webhook/delivery-1' })

    expect(result).toMatchObject({ status: 'Geaccepteerd', provider: 'Test AP', providerReference: 'AP-7788' })
    expect(fetcher).toHaveBeenCalledWith('https://accesspoint.example.test/documents', expect.objectContaining({ method: 'POST', body: '<Invoice />', headers: expect.objectContaining({ Authorization: 'Bearer secret', 'Idempotency-Key': 'peppol:tenant:invoice', 'X-Peppol-Sender': '0208:0123456749', 'X-Peppol-Recipient': '0208:0200000043', 'X-Peppol-Webhook': 'https://bouwflow.example/api/integrations/peppol/webhook/delivery-1' }) }))
  })

  it('vertaalt een providerstatus naar een afgeleverde verzending', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ status: 'delivered', message: 'AS4 acknowledgement ontvangen' }), { status: 200 })) as unknown as typeof fetch
    const result = await new HttpPeppolAccessPoint('https://accesspoint.example.test/documents', '', fetcher).status('AP-7788')

    expect(result).toMatchObject({ status: 'Afgeleverd', providerReference: 'AP-7788', message: 'AS4 acknowledgement ontvangen' })
    expect(fetcher).toHaveBeenCalledWith('https://accesspoint.example.test/documents/AP-7788', expect.any(Object))
  })
})
