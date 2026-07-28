import { describe, expect, it, vi } from 'vitest'
import type { PeppolNotification } from '../../src/domain.js'
import { HttpPeppolNotificationSender, PeppolNotificationDispatcher, peppolNotificationTargets } from './notification.js'

const notification: PeppolNotification = { id: 'notification-1', alertId: 'alert-1', channel: 'E-mail', kind: 'Nieuwe waarschuwing', destination: 'finance@example.be', subject: 'Peppol-waarschuwing', message: 'Transportfout', status: 'In wachtrij', attempts: 0, nextAttemptAt: '2027-01-01T00:00:00.000Z', createdAt: '2027-01-01T00:00:00.000Z', updatedAt: '2027-01-01T00:00:00.000Z' }

describe('Peppol-notificatieconnector', () => {
  it('normaliseert e-mail- en Teams-doelen', () => {
    expect(peppolNotificationTargets('finance@example.be, directie@example.be', 'Finance kanaal')).toEqual([
      { channel: 'E-mail', destination: 'finance@example.be' },
      { channel: 'E-mail', destination: 'directie@example.be' },
      { channel: 'Teams', destination: 'Finance kanaal' },
    ])
  })

  it('verstuurt een genormaliseerde, idempotente connectoraanvraag', async () => {
    const fetcher = vi.fn(async () => new Response('', { status: 202 })) as unknown as typeof fetch
    const sender = new HttpPeppolNotificationSender('https://notify.example.test/send', 'secret', fetcher)
    expect(sender.configuredChannels).toEqual(['E-mail', 'Teams'])
    await sender.send(notification)
    expect(fetcher).toHaveBeenCalledWith('https://notify.example.test/send', expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ Authorization: 'Bearer secret', 'Idempotency-Key': 'notification-1' }), body: expect.stringContaining('finance@example.be') }))
  })
})

describe('Peppol-notificatiedispatcher', () => {
  it('wachtrijt SLA-escalaties en isoleert afleverfouten', async () => {
    const repository = {
      enqueueCriticalPeppolEscalations: vi.fn(async () => 1),
      duePeppolNotifications: vi.fn(async () => [notification, { ...notification, id: 'notification-2', channel: 'Teams' as const }]),
      markPeppolNotificationSent: vi.fn(async () => undefined),
      markPeppolNotificationFailed: vi.fn(async () => undefined),
    }
    const sender = { send: vi.fn(async (item: PeppolNotification) => { if (item.id === 'notification-2') throw new Error('connector offline') }) }
    const result = await new PeppolNotificationDispatcher(repository, sender, 30_000).runOnce()
    expect(result).toEqual({ queuedEscalations: 1, sent: 1, failed: 1, skipped: false })
    expect(repository.markPeppolNotificationSent).toHaveBeenCalledWith('notification-1')
    expect(repository.markPeppolNotificationFailed).toHaveBeenCalledWith('notification-2', 'connector offline')
  })
})
