import { describe, expect, it } from 'vitest'
import { pageForDossier, workspacePath, workspaceRouteFromLocation, type DossierType } from './routing'

describe('permanente BouwFlow-routes', () => {
  it('vertaalt iedere module naar een stabiel pad', () => {
    expect(workspacePath({ page: 'dashboard' })).toBe('/')
    expect(workspacePath({ page: 'my-work' })).toBe('/my-work')
    expect(workspacePath({ page: 'dossiers' })).toBe('/dossiers')
    expect(workspacePath({ page: 'planning' })).toBe('/planning')
    expect(workspacePath({ page: 'client-portal' })).toBe('/portal/client')
    expect(workspacePath({ page: 'subcontractor-portal' })).toBe('/portal/subcontractor')
    expect(workspacePath({ page: 'supplier-portal' })).toBe('/portal/supplier')
    expect(workspaceRouteFromLocation({ pathname: '/project-control/' })).toEqual({ page: 'control' })
    expect(workspaceRouteFromLocation({ pathname: '/onbekend' })).toEqual({ page: 'dashboard' })
  })

  it('maakt dossiers rechtstreeks en na een refresh terug vindbaar', () => {
    const cases: Array<[DossierType, string, string]> = [
      ['organization', 'org 1', '/crm/organizations/org%201'],
      ['opportunity', 'opp-1', '/opportunities/opp-1'],
      ['project', 'project-1', '/projects/project-1'],
      ['daily-report', 'report-1', '/site/reports/report-1'],
      ['change-order', 'change-1', '/change-orders/change-1'],
      ['document', 'document-1', '/documents/document-1'],
      ['project-cost', 'cost-1', '/project-control/costs/cost-1'],
      ['contract', 'contract-1', '/contracts/contract-1'],
      ['closeout', 'closeout-1', '/closeouts/closeout-1'],
      ['work-ticket', 'ticket-1', '/site/work-tickets/ticket-1'],
      ['time-entry', 'time-1', '/hr/time-entries/time-1'],
      ['project-claim', 'claim-1', '/change-orders/claims/claim-1'],
      ['progress-statement', 'statement-1', '/progress-statements/statement-1'],
      ['procurement-request', 'request-1', '/procurement/requests/request-1'],
      ['purchase-order', 'order-1', '/procurement/orders/order-1'],
      ['employee', 'employee-1', '/hr/employees/employee-1'],
      ['asset', 'asset-1', '/resources/assets/asset-1'],
      ['subcontractor', 'subcontractor-1', '/subcontractors/subcontractor-1'],
      ['qhse-event', 'event-1', '/qhse/events/event-1'],
      ['sales-invoice', 'invoice-1', '/cashflow/invoices/invoice-1'],
      ['ai-analysis', 'analysis-1', '/ai/analyses/analysis-1'],
      ['quote', 'quote-1', '/quotes/quote-1'],
      ['site-photo', 'photo-1', '/site/photos/photo-1'],
      ['qhse-certificate', 'certificate-1', '/qhse/certificates/certificate-1'],
      ['qhse-inspection', 'inspection-1', '/qhse/inspections/inspection-1'],
      ['supplier', 'supplier-1', '/procurement/suppliers/supplier-1'],
      ['warehouse', 'warehouse-1', '/resources/warehouses/warehouse-1'],
      ['stock-movement', 'movement-1', '/resources/stock-movements/movement-1'],
      ['employee-crew', 'crew-1', '/hr/crews/crew-1'],
      ['project-forecast', 'forecast-1', '/project-control/forecasts/forecast-1'],
      ['joint-venture', 'joint-venture-1', '/consortia/joint-ventures/joint-venture-1'],
      ['intercompany-charge', 'charge-1', '/entity-finance/intercompany/charge-1'],
    ]

    for (const [type, id, expectedPath] of cases) {
      const page = pageForDossier(type)
      expect(workspacePath({ page, dossierType: type, dossierId: id })).toBe(expectedPath)
      expect(workspaceRouteFromLocation({ pathname: expectedPath })).toEqual({ page, dossierType: type, dossierId: id })
    }
  })
})
