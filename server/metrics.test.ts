import { describe, expect, it } from 'vitest'
import { ApiMetrics } from './metrics.js'

describe('API-metrics', () => {
  it('aggregeert routes zonder tenant- of recordlabels met hoge cardinaliteit', () => {
    const metrics = new ApiMetrics()
    metrics.observe('GET', '/api/bootstrap', 200, 0.125)
    metrics.observe('GET', '/api/bootstrap', 200, 0.075)
    metrics.observe('POST', '/api/projects/:id/planning', 400, 0.01)
    const output = metrics.render()
    expect(output).toContain('bouwflow_http_requests_total{method="GET",route="/api/bootstrap",status_class="2xx"} 2')
    expect(output).toContain('bouwflow_http_request_duration_seconds_sum{method="GET",route="/api/bootstrap",status_class="2xx"} 0.200000')
    expect(output).not.toContain('tenant')
  })
})
