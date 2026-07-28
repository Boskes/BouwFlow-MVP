import type { PeppolDelivery } from '../../src/domain.js'
import type { PeppolAccessPoint } from './access-point.js'

export interface PeppolStatusRepository {
  stalePeppolDeliveries(staleBefore: string, limit?: number): Promise<Array<{ id: string; providerReference: string; status: PeppolDelivery['status'] }>>
  raiseStalePeppolAlert(deliveryId: string): Promise<unknown>
  applyPeppolProviderUpdate(deliveryId: string, result: Awaited<ReturnType<PeppolAccessPoint['status']>>, auditAction: 'background_status_check'): Promise<PeppolDelivery>
}

interface MonitorLogger { warn(details: unknown, message: string): void }

export class PeppolStatusMonitor {
  private timer?: ReturnType<typeof setInterval>
  private running = false

  constructor(
    private readonly repository: PeppolStatusRepository,
    private readonly accessPoint: PeppolAccessPoint,
    private readonly intervalMs: number,
    private readonly staleAfterMs = intervalMs,
    private readonly logger?: MonitorLogger,
  ) {}

  async runOnce() {
    if (this.running) return { checked: 0, failed: 0, skipped: true }
    this.running = true
    let checked = 0
    let failed = 0
    try {
      const staleBefore = new Date(Date.now() - Math.max(this.staleAfterMs, 1_000)).toISOString()
      const deliveries = await this.repository.stalePeppolDeliveries(staleBefore)
      for (const delivery of deliveries) {
        try {
          if (delivery.status === 'In wachtrij' || delivery.status === 'Geaccepteerd') await this.repository.raiseStalePeppolAlert(delivery.id)
          const result = await this.accessPoint.status(delivery.providerReference)
          await this.repository.applyPeppolProviderUpdate(delivery.id, result, 'background_status_check')
          checked += 1
        } catch (error) {
          failed += 1
          this.logger?.warn({ error, deliveryId: delivery.id }, 'Automatische Peppol-statuscontrole mislukt')
        }
      }
      return { checked, failed, skipped: false }
    } finally {
      this.running = false
    }
  }

  start() {
    if (this.intervalMs <= 0 || this.timer) return
    void this.runOnce()
    this.timer = setInterval(() => void this.runOnce(), this.intervalMs)
    this.timer.unref()
  }

  stop() {
    if (this.timer) clearInterval(this.timer)
    this.timer = undefined
  }
}
