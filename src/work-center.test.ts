import { describe, expect, it } from 'vitest'
import type { BouwFlowState, CompanyUser, DailyReport, Project } from './domain'
import { defaultWorkCenterPreferences, deriveAllWorkItems, roleDashboardCopy, workBucket, workItemsForUser } from './work-center'

const project = {
  id: 'project-1', number: 'P-001', name: 'Testwerf', organizationId: 'org-1', sourceCalculationId: 'calc-1', contractValue: 1_000_000,
  costBudget: 850_000, marginPct: 15, progress: 30, status: 'Op schema', handover: { risks: [] }, planning: { activities: [] }, workPackages: [],
} as unknown as Project

const report = {
  id: 'report-1', projectId: project.id, date: '2026-08-04', status: 'Concept', activities: 'Ruwbouw', laborEntries: [], subcontractors: [], materials: [], machines: [], deliveries: '', delays: '', problems: '', visitors: '', notes: '', createdAt: '2026-08-04',
} as unknown as DailyReport

const users: CompanyUser[] = [
  { id: 'admin', displayName: 'Admin', email: 'admin@example.be', role: 'Administrator', allLegalEntities: true, legalEntityIds: [] },
  { id: 'site', displayName: 'Werf Leider', email: 'werf@example.be', role: 'Werfleider', allLegalEntities: true, legalEntityIds: [] },
  { id: 'client', displayName: 'Klant', email: 'klant@example.be', role: 'Klant', allLegalEntities: true, legalEntityIds: [] },
]

const state = {
  currentUserId: 'site', companyUsers: users, employees: [], projects: [project], opportunities: [], quotes: [], dailyReports: [report], changeOrders: [], documents: [], qhseCertificates: [], qhseInspections: [], qhseEvents: [], progressStatements: [], salesInvoices: [], procurementRequests: [], purchaseOrders: [], workTickets: [], timeEntries: [], employeeAbsences: [], projectContracts: [], projectCloseouts: [], projectClaims: [], checkinatworkRegistrations: [],
} as unknown as BouwFlowState

describe('centraal werkcentrum', () => {
  it('maakt een concrete werftaak met deep link en directe actie', () => {
    const items = deriveAllWorkItems(state, '2026-08-05')
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ sourceType: 'daily-report', sourceId: 'report-1', action: 'submit-daily-report', priority: 'Kritiek' })
    expect(workBucket(items[0], '2026-08-05')).toBe('Te laat')
  })

  it('toont rollen alleen hun eigen werk en management het volledige overzicht', () => {
    const all = deriveAllWorkItems(state, '2026-08-05')
    expect(workItemsForUser(all, state, users[1], defaultWorkCenterPreferences, '2026-08-05')).toHaveLength(1)
    expect(workItemsForUser(all, state, users[2], defaultWorkCenterPreferences, '2026-08-05')).toHaveLength(0)
    expect(workItemsForUser(all, state, users[0], defaultWorkCenterPreferences, '2026-08-05')).toHaveLength(1)
  })

  it('levert een eigen dashboardtekst voor interne en externe profielen', () => {
    expect(roleDashboardCopy('Werfleider').title).toBe('Mijn werfdashboard')
    expect(roleDashboardCopy('Klant').title).toBe('Mijn projecten')
    expect(roleDashboardCopy('Leverancier').title).toBe('Mijn leveringen')
  })
})
