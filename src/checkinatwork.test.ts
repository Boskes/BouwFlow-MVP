import { describe, expect, it } from 'vitest'
import type { CheckinatworkParticipant, CheckinatworkRegistration, CheckinatworkSite, Project } from './domain'
import { CHECKINATWORK_THRESHOLD, checkinatworkDashboard, checkinatworkRequirement, maskCheckinatworkIdentifier } from './checkinatwork'

const project = { id: 'project-1', number: 'P-001', name: 'Grote werf', contractValue: 2_400_000 } as Project
const site = { id: 'site-1', projectId: project.id, declarationNumber: 'AVW-1', workPlaceId: 'WP-1', thresholdAmount: CHECKINATWORK_THRESHOLD, applicability: 'Verplicht', environment: 'Simulatie', active: true } as CheckinatworkSite
const participant = { id: 'person-1', projectId: project.id, employeeId: 'employee-1', displayName: 'Jan Peeters', employerName: 'BouwFlow', participantType: 'Werknemer', identifierType: 'INSZ', identifierLast4: '1098', identityVerified: true, active: true, createdAt: '2026-08-03T05:00:00.000Z' } as CheckinatworkParticipant

describe('Checkinatwork-compliance', () => {
  it('maakt een werf vanaf 500.000 euro verplicht en stopt na voorlopige oplevering', () => {
    expect(checkinatworkRequirement(project, site).applicability).toBe('Verplicht')
    expect(checkinatworkRequirement(project, { ...site, provisionalAcceptanceOn: '2026-08-01' }).applicability).toBe('Beëindigd')
  })

  it('signaleert gepresteerde uren zonder officieel ontvangstnummer', () => {
    const dashboard = checkinatworkDashboard({
      projects: [project], checkinatworkSites: [site], checkinatworkParticipants: [participant], checkinatworkRegistrations: [], dailyReports: [],
      timeEntries: [{ id: 'time-1', projectId: project.id, employeeId: 'employee-1', date: '2026-08-03', status: 'Goedgekeurd' } as never],
    }, project.id, '2026-08-03')
    expect(dashboard.confirmed).toBe(0)
    expect(dashboard.alerts.some(alert => alert.id === 'time-time-1' && alert.severity === 'Blokkerend')).toBe(true)
  })

  it('telt alleen een officieel bevestigde registratie als aanwezig', () => {
    const registration = { id: 'reg-1', siteId: site.id, projectId: project.id, participantId: participant.id, registrationDate: '2026-08-03', source: 'QR', status: 'Officieel bevestigd', receiptNumber: 'CAW-123', clientReference: 'ref', simulation: true, createdBy: 'Test', createdAt: '2026-08-03T06:00:00.000Z' } as CheckinatworkRegistration
    const dashboard = checkinatworkDashboard({ projects: [project], checkinatworkSites: [site], checkinatworkParticipants: [participant], checkinatworkRegistrations: [registration], dailyReports: [], timeEntries: [] }, project.id, '2026-08-03')
    expect(dashboard.confirmed).toBe(1)
    expect(dashboard.alerts).toHaveLength(0)
  })

  it('toont alleen de laatste vier cijfers van een identificatie', () => {
    expect(maskCheckinatworkIdentifier('85 07 12 109 8')).toBe('1098')
  })
})
