import type { PeppolNotification, PeppolNotificationChannel } from '../../src/domain.js'

export interface PeppolNotificationTarget {
  channel: PeppolNotificationChannel
  destination: string
}

export interface PeppolNotificationSender {
  readonly configuredChannels?: readonly PeppolNotificationChannel[]
  send(notification: PeppolNotification): Promise<void>
}

export interface PeppolNotificationRepository {
  enqueueCriticalPeppolEscalations(at?: string): Promise<number>
  duePeppolNotifications(limit?: number): Promise<PeppolNotification[]>
  markPeppolNotificationSent(id: string): Promise<void>
  markPeppolNotificationFailed(id: string, error: string): Promise<void>
}

interface NotificationLogger { warn(details: unknown, message: string): void }

export class HttpPeppolNotificationSender implements PeppolNotificationSender {
  readonly configuredChannels = ['E-mail', 'Teams'] as const
  constructor(private readonly url: string, private readonly token = '', private readonly fetcher: typeof fetch = fetch) {}

  async send(notification: PeppolNotification) {
    const response = await this.fetcher(this.url, {
      method: 'POST',
      signal: AbortSignal.timeout(20_000),
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}), 'Idempotency-Key': notification.id },
      body: JSON.stringify({ id: notification.id, channel: notification.channel, kind: notification.kind, destination: notification.destination, subject: notification.subject, message: notification.message }),
    })
    if (!response.ok) throw new Error(`Notificatieconnector antwoordde met HTTP ${response.status}: ${(await response.text()).slice(0, 500)}`)
  }
}

export function peppolNotificationTargets(emailTo = '', teamsTargets = ''): PeppolNotificationTarget[] {
  const parse = (value: string) => value.split(',').map(item => item.trim()).filter(Boolean)
  return [
    ...parse(emailTo).map(destination => ({ channel: 'E-mail' as const, destination })),
    ...parse(teamsTargets).map(destination => ({ channel: 'Teams' as const, destination })),
  ]
}

export class PeppolNotificationDispatcher {
  private timer?: ReturnType<typeof setInterval>
  private running = false

  constructor(
    private readonly repository: PeppolNotificationRepository,
    private readonly sender: PeppolNotificationSender,
    private readonly intervalMs: number,
    private readonly logger?: NotificationLogger,
  ) {}

  async runOnce() {
    if (this.running) return { queuedEscalations: 0, sent: 0, failed: 0, skipped: true }
    this.running = true
    let queuedEscalations = 0
    let sent = 0
    let failed = 0
    try {
      queuedEscalations = await this.repository.enqueueCriticalPeppolEscalations(new Date().toISOString())
      const notifications = await this.repository.duePeppolNotifications()
      for (const notification of notifications) {
        try {
          await this.sender.send(notification)
          await this.repository.markPeppolNotificationSent(notification.id)
          sent += 1
        } catch (error) {
          failed += 1
          const message = error instanceof Error ? error.message : 'Onbekende notificatiefout'
          await this.repository.markPeppolNotificationFailed(notification.id, message)
          this.logger?.warn({ error, notificationId: notification.id }, 'Peppol-notificatie kon niet worden afgeleverd')
        }
      }
      return { queuedEscalations, sent, failed, skipped: false }
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
