import type { Page } from './domain'

export type DossierType =
  | 'organization'
  | 'opportunity'
  | 'calculation'
  | 'project'
  | 'daily-report'
  | 'change-order'
  | 'document'
  | 'project-cost'
  | 'contract'
  | 'closeout'
  | 'progress-statement'
  | 'procurement-request'
  | 'purchase-order'
  | 'employee'
  | 'employee-absence'
  | 'asset'
  | 'inventory-item'
  | 'subcontractor'
  | 'qhse-event'
  | 'sales-invoice'
  | 'ai-analysis'
  | 'quote'
  | 'site-photo'
  | 'qhse-certificate'
  | 'qhse-inspection'
  | 'supplier'
  | 'warehouse'
  | 'stock-movement'
  | 'employee-crew'
  | 'project-forecast'
  | 'joint-venture'
  | 'intercompany-charge'
  | 'work-ticket'
  | 'time-entry'
  | 'project-claim'

export interface WorkspaceRoute {
  page: Page
  dossierType?: DossierType
  dossierId?: string
}

const pagePaths: Record<Page, string> = {
  dashboard: '/', dossiers: '/dossiers', crm: '/crm', opportunities: '/opportunities', calculations: '/calculations',
  'cost-library': '/cost-library', projects: '/projects', planning: '/planning', hr: '/hr',
  resources: '/resources', site: '/site', changes: '/change-orders', financial: '/progress-statements',
  control: '/project-control', procurement: '/procurement', cashflow: '/cashflow',
  'post-calculation': '/post-calculation', documents: '/documents', qhse: '/qhse',
  subcontractors: '/subcontractors', consortia: '/consortia', integrations: '/integrations', ai: '/ai',
  closeout: '/contract-closeout', company: '/company', access: '/settings',
  'client-portal':'/portal/client', 'subcontractor-portal':'/portal/subcontractor', 'supplier-portal':'/portal/supplier',
  'entity-finance': '/entity-finance', 'notification-settings': '/notification-settings',
}

const dossierPaths: Record<DossierType, { prefix: string; page: Page }> = {
  organization: { prefix: '/crm/organizations', page: 'crm' },
  opportunity: { prefix: '/opportunities', page: 'opportunities' },
  calculation: { prefix: '/calculations', page: 'calculations' },
  project: { prefix: '/projects', page: 'projects' },
  'daily-report': { prefix: '/site/reports', page: 'site' },
  'change-order': { prefix: '/change-orders', page: 'changes' },
  document: { prefix: '/documents', page: 'documents' },
  'project-cost': { prefix: '/project-control/costs', page: 'control' },
  contract: { prefix: '/contracts', page: 'closeout' },
  closeout: { prefix: '/closeouts', page: 'closeout' },
  'progress-statement': { prefix: '/progress-statements', page: 'financial' },
  'procurement-request': { prefix: '/procurement/requests', page: 'procurement' },
  'purchase-order': { prefix: '/procurement/orders', page: 'procurement' },
  employee: { prefix: '/hr/employees', page: 'hr' },
  'employee-absence': { prefix: '/hr/absences', page: 'hr' },
  asset: { prefix: '/resources/assets', page: 'resources' },
  'inventory-item': { prefix: '/resources/inventory', page: 'resources' },
  subcontractor: { prefix: '/subcontractors', page: 'subcontractors' },
  'qhse-event': { prefix: '/qhse/events', page: 'qhse' },
  'sales-invoice': { prefix: '/cashflow/invoices', page: 'cashflow' },
  'ai-analysis': { prefix: '/ai/analyses', page: 'ai' },
  quote: { prefix: '/quotes', page: 'calculations' },
  'site-photo': { prefix: '/site/photos', page: 'site' },
  'qhse-certificate': { prefix: '/qhse/certificates', page: 'qhse' },
  'qhse-inspection': { prefix: '/qhse/inspections', page: 'qhse' },
  supplier: { prefix: '/procurement/suppliers', page: 'procurement' },
  warehouse: { prefix: '/resources/warehouses', page: 'resources' },
  'stock-movement': { prefix: '/resources/stock-movements', page: 'resources' },
  'employee-crew': { prefix: '/hr/crews', page: 'hr' },
  'project-forecast': { prefix: '/project-control/forecasts', page: 'control' },
  'joint-venture': { prefix: '/consortia/joint-ventures', page: 'consortia' },
  'intercompany-charge': { prefix: '/entity-finance/intercompany', page: 'entity-finance' },
  'work-ticket': { prefix: '/site/work-tickets', page: 'site' },
  'time-entry': { prefix: '/hr/time-entries', page: 'hr' },
  'project-claim': { prefix: '/change-orders/claims', page: 'changes' },
}

const normalizePath = (value: string) => {
  const decoded = decodeURI(value || '/')
  return decoded.length > 1 ? decoded.replace(/\/+$/, '') : decoded
}

export const workspaceRouteFromLocation = (location: Pick<Location, 'pathname'>): WorkspaceRoute => {
  const pathname = normalizePath(location.pathname)
  if(pathname==='/access')return {page:'access'}
  const dossierDefinitions = (Object.entries(dossierPaths) as Array<[DossierType, (typeof dossierPaths)[DossierType]]>)
    .sort((left, right) => right[1].prefix.length - left[1].prefix.length)
  for (const [dossierType, definition] of dossierDefinitions) {
    if (!pathname.startsWith(`${definition.prefix}/`)) continue
    const dossierId = pathname.slice(definition.prefix.length + 1).split('/')[0]
    if (dossierId) return { page: definition.page, dossierType, dossierId: decodeURIComponent(dossierId) }
  }
  const page = (Object.entries(pagePaths) as Array<[Page, string]>).find(([, path]) => path === pathname)?.[0]
  return { page: page ?? 'dashboard' }
}

export const workspacePath = (route: WorkspaceRoute) => {
  if (route.dossierType && route.dossierId) {
    const definition = dossierPaths[route.dossierType]
    return `${definition.prefix}/${encodeURIComponent(route.dossierId)}`
  }
  return pagePaths[route.page]
}

const preservedSearch = () => {
  const input = new URLSearchParams(window.location.search)
  const output = new URLSearchParams()
  for (const key of ['mode', 'units']) {
    const value = input.get(key)
    if (value) output.set(key, value)
  }
  const query = output.toString()
  return query ? `?${query}` : ''
}

export const writeWorkspaceRoute = (route: WorkspaceRoute, replace = false) => {
  const url = `${workspacePath(route)}${preservedSearch()}`
  window.history[replace ? 'replaceState' : 'pushState']({ bouwFlowRoute: route }, '', url)
  return route
}

export const pageForDossier = (dossierType: DossierType) => dossierPaths[dossierType].page
