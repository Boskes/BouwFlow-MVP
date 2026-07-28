import { describe, expect, it, vi } from 'vitest'
import type { PeppolDelivery } from '../../src/domain.js'
import { PeppolStatusMonitor } from './status-monitor.js'

describe('Peppol-statusmonitor', () => {
  it('controleert openstaande leveringen en verwerkt fouten per levering afzonderlijk', async () => {
    const repository = {
      stalePeppolDeliveries: vi.fn(async () => [{ id: 'delivery-1', providerReference: 'AP-1', status: 'Geaccepteerd' as const }, { id: 'delivery-2', providerReference: 'AP-2', status: 'Fout' as const }]),
      raiseStalePeppolAlert: vi.fn(async () => undefined),
      applyPeppolProviderUpdate: vi.fn(async (id: string) => {
        if (id === 'delivery-2') throw new Error('tijdelijke databasefout')
        return { id } as PeppolDelivery
      }),
    }
    const accessPoint = { send: vi.fn(), status: vi.fn(async reference => ({ status: 'Afgeleverd' as const, provider: 'Test AP', providerReference: reference, message: 'Ontvangen' })) }
    const logger = { warn: vi.fn() }
    const result = await new PeppolStatusMonitor(repository, accessPoint, 60_000, 60_000, logger).runOnce()

    expect(result).toEqual({ checked: 1, failed: 1, skipped: false })
    expect(accessPoint.status).toHaveBeenCalledTimes(2)
    expect(repository.raiseStalePeppolAlert).toHaveBeenCalledTimes(1)
    expect(repository.applyPeppolProviderUpdate).toHaveBeenCalledWith('delivery-1', expect.objectContaining({ status: 'Afgeleverd' }), 'background_status_check')
    expect(logger.warn).toHaveBeenCalledOnce()
  })

  it('voorkomt overlappende controles', async () => {
    let release!: () => void
    const waiting = new Promise<void>(resolve => { release = resolve })
    const repository = {
      stalePeppolDeliveries: vi.fn(async () => { await waiting; return [] }),
      raiseStalePeppolAlert: vi.fn(),
      applyPeppolProviderUpdate: vi.fn(),
    }
    const monitor = new PeppolStatusMonitor(repository, { send: vi.fn(), status: vi.fn() }, 60_000)
    const first = monitor.runOnce()
    expect(await monitor.runOnce()).toEqual({ checked: 0, failed: 0, skipped: true })
    release()
    await first
  })
})
