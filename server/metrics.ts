export class ApiMetrics {
  private readonly requests = new Map<string, number>()
  private readonly durations = new Map<string, { count: number; seconds: number }>()

  observe(method: string, route: string, statusCode: number, durationSeconds: number) {
    const normalizedRoute = route.startsWith('/') ? route : 'unknown'
    const statusClass = `${Math.floor(statusCode / 100)}xx`
    const key = `${method}|${normalizedRoute}|${statusClass}`
    this.requests.set(key, (this.requests.get(key) ?? 0) + 1)
    const duration = this.durations.get(key) ?? { count: 0, seconds: 0 }
    duration.count += 1
    duration.seconds += durationSeconds
    this.durations.set(key, duration)
  }

  render() {
    const lines = [
      '# HELP bouwflow_process_uptime_seconds Process uptime in seconds.',
      '# TYPE bouwflow_process_uptime_seconds gauge',
      `bouwflow_process_uptime_seconds ${process.uptime().toFixed(3)}`,
      '# HELP bouwflow_process_resident_memory_bytes Resident memory size in bytes.',
      '# TYPE bouwflow_process_resident_memory_bytes gauge',
      `bouwflow_process_resident_memory_bytes ${process.memoryUsage().rss}`,
      '# HELP bouwflow_http_requests_total Total HTTP requests.',
      '# TYPE bouwflow_http_requests_total counter',
    ]
    for (const [key, count] of [...this.requests].sort(([left], [right]) => left.localeCompare(right))) {
      const [method, route, statusClass] = key.split('|')
      lines.push(`bouwflow_http_requests_total{method="${method}",route="${escapeLabel(route)}",status_class="${statusClass}"} ${count}`)
    }
    lines.push('# HELP bouwflow_http_request_duration_seconds_sum Total request duration in seconds.', '# TYPE bouwflow_http_request_duration_seconds_sum counter')
    for (const [key, duration] of [...this.durations].sort(([left], [right]) => left.localeCompare(right))) {
      const [method, route, statusClass] = key.split('|')
      const labels = `method="${method}",route="${escapeLabel(route)}",status_class="${statusClass}"`
      lines.push(`bouwflow_http_request_duration_seconds_sum{${labels}} ${duration.seconds.toFixed(6)}`)
      lines.push(`bouwflow_http_request_duration_seconds_count{${labels}} ${duration.count}`)
    }
    return `${lines.join('\n')}\n`
  }
}

const escapeLabel = (value: string) => value.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', '\\n')
