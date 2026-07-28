import type { FastifyRequest } from 'fastify'
import type { Pool } from 'pg'
import { AuthorizationError } from './auth.js'

const childResources: Record<string, { table: string; idParam?: string }> = {
  '/api/daily-reports/:id': { table: 'daily_reports' },
  '/api/daily-reports/:id/submit': { table: 'daily_reports' },
  '/api/daily-reports/:id/sign': { table: 'daily_reports' },
  '/api/daily-reports/:id/photos': { table: 'daily_reports' },
  '/api/site-photos/:id': { table: 'site_photos' },
  '/api/documents/:id': { table: 'documents' },
  '/api/documents/:id/revisions': { table: 'documents' },
  '/api/documents/:id/submit': { table: 'documents' },
  '/api/documents/:id/approve': { table: 'documents' },
  '/api/documents/:id/distribute': { table: 'documents' },
  '/api/qhse-inspections/:id/findings/:findingId/resolve': { table: 'qhse_inspections' },
  '/api/qhse-inspections/:id/close': { table: 'qhse_inspections' },
  '/api/change-orders/:id': { table: 'change_orders' },
  '/api/change-orders/:id/calculate': { table: 'change_orders' },
  '/api/change-orders/:id/submit': { table: 'change_orders' },
  '/api/change-orders/:id/approve': { table: 'change_orders' },
  '/api/change-orders/:id/execute': { table: 'change_orders' },
  '/api/change-orders/:id/ready-for-invoice': { table: 'change_orders' },
  '/api/progress-statements/:id': { table: 'progress_statements' },
  '/api/progress-statements/:id/submit': { table: 'progress_statements' },
  '/api/progress-statements/:id/approve': { table: 'progress_statements' },
  '/api/progress-statements/:id/invoice': { table: 'progress_statements' },
  '/api/sales-invoices/:id/issue': { table: 'sales_invoices' },
  '/api/sales-invoices/:id/peppol-validation': { table: 'sales_invoices' },
  '/api/sales-invoices/:id/peppol-delivery': { table: 'sales_invoices' },
  '/api/sales-invoices/:id/peppol-status': { table: 'sales_invoices' },
  '/api/sales-invoices/:id/payment': { table: 'sales_invoices' },
  '/api/project-costs/:id/settle': { table: 'project_costs' },
  '/api/procurement-requests/:id/issue': { table: 'procurement_requests' },
  '/api/procurement-requests/:id/quotes': { table: 'procurement_requests' },
  '/api/procurement-requests/:id/quotes/:quoteId/select': { table: 'procurement_requests' },
  '/api/purchase-orders/:id/receive': { table: 'purchase_orders' },
  '/api/purchase-orders/:id/match-invoice': { table: 'purchase_orders' },
  '/api/purchase-orders/:id/payment': { table: 'purchase_orders' },
}

export async function enforceCompanyScope(pool: Pick<Pool, 'query'>, request: FastifyRequest) {
  if (request.routeOptions.url === '/health' || request.routeOptions.url === '/internal/metrics' || request.routeOptions.url?.startsWith('/api/health')) return
  const route = request.routeOptions.url ?? ''
  const externalOnly = request.context.roles.length > 0 && request.context.roles.every(role => ['Klant', 'Onderaannemer', 'Leverancier'].includes(role))
  const repositoryScopedExternalRoute = route === '/api/document-versions/:id/file'
    || route === '/api/document-versions/:id/verify-integrity'
    || (route === '/api/projects/:id/documents' && request.context.roles.length === 1 && request.context.roles[0] === 'Onderaannemer')
  // These routes perform a stricter relationship check (customer, supplier or subcontractor) in the repository.
  if (externalOnly && repositoryScopedExternalRoute) return
  if (request.context.allLegalEntities !== false && request.context.allProjects !== false) return
  const params = request.params as Record<string, string>
  const allowed = request.context.legalEntityIds ?? []

  if (route === '/api/legal-entities/:id/branches') {
    if (request.context.allLegalEntities===false&&!allowed.includes(params.id)) throw new AuthorizationError('Je hebt geen toegang tot deze juridische entiteit')
    return
  }

  let projectId: string | undefined
  if (route.startsWith('/api/projects/:id/')) projectId = params.id
  const resource = childResources[route]
  if (resource) {
    const result = await pool.query<{ project_id: string }>(`SELECT project_id FROM ${resource.table} WHERE tenant_id=$1 AND id=$2`, [request.context.tenantId, params[resource.idParam ?? 'id']])
    projectId = result.rows[0]?.project_id
  }
  if (route === '/api/document-recipients/:id/read') {
    const result = await pool.query<{ project_id: string }>(`SELECT d.project_id FROM document_recipients r JOIN documents d ON d.tenant_id=r.tenant_id AND d.id=r.document_id WHERE r.tenant_id=$1 AND r.id=$2`, [request.context.tenantId, params.id])
    projectId = result.rows[0]?.project_id
  }
  if (route === '/api/document-versions/:id/file' || route === '/api/document-versions/:id/verify-integrity') {
    const result = await pool.query<{ project_id: string }>('SELECT d.project_id FROM document_versions v JOIN documents d ON d.tenant_id=v.tenant_id AND d.id=v.document_id WHERE v.tenant_id=$1 AND v.id=$2', [request.context.tenantId, params.id])
    projectId = result.rows[0]?.project_id
  }
  if (route === '/api/peppol-alerts/:id/acknowledge') {
    const result = await pool.query<{ project_id: string }>('SELECT s.project_id FROM peppol_alerts a JOIN sales_invoices s ON s.tenant_id=a.tenant_id AND s.id=a.invoice_id WHERE a.tenant_id=$1 AND a.id=$2', [request.context.tenantId, params.id])
    projectId = result.rows[0]?.project_id
  }
  if (!projectId) return
  if(request.context.allProjects===false&&!(request.context.projectIds??[]).includes(projectId))throw new AuthorizationError('Dit project is niet aan jouw account toegewezen')
  if(request.context.allLegalEntities!==false)return
  const project = await pool.query<{ legal_entity_id: string | null }>('SELECT legal_entity_id FROM projects WHERE tenant_id=$1 AND id=$2', [request.context.tenantId, projectId])
  const legalEntityId = project.rows[0]?.legal_entity_id
  if (!legalEntityId || !allowed.includes(legalEntityId)) throw new AuthorizationError('Je hebt geen toegang tot dit project')
}
