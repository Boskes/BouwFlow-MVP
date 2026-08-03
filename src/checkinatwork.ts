import type {
  BouwFlowState,
  CheckinatworkDashboardAlert,
  CheckinatworkParticipant,
  CheckinatworkRegistration,
  CheckinatworkSite,
  Project,
} from './domain'

export const CHECKINATWORK_THRESHOLD = 500_000

export const checkinatworkRequirement = (project: Project, site?: CheckinatworkSite) => {
  if (site?.provisionalAcceptanceOn) return { applicability: 'Be\u00ebindigd' as const, reason: `Voorlopig opgeleverd op ${site.provisionalAcceptanceOn}` }
  if (site?.applicability === 'Niet verplicht') return { applicability: 'Niet verplicht' as const, reason: site.applicabilityReason || 'Handmatig beoordeeld' }
  const threshold = site?.thresholdAmount ?? CHECKINATWORK_THRESHOLD
  if (project.contractValue >= threshold) return { applicability: 'Verplicht' as const, reason: `Contractwaarde \u20ac ${Math.round(project.contractValue).toLocaleString('nl-BE')} bereikt de drempel van \u20ac ${threshold.toLocaleString('nl-BE')} excl. btw.` }
  return { applicability: 'Niet verplicht' as const, reason: `Contractwaarde blijft onder de drempel van \u20ac ${threshold.toLocaleString('nl-BE')} excl. btw.` }
}

const confirmed = (registration: CheckinatworkRegistration | undefined) => Boolean(registration && ['Officieel bevestigd', 'Extern geregistreerd'].includes(registration.status))

export function checkinatworkDashboard(
  state: Pick<BouwFlowState, 'projects' | 'dailyReports' | 'timeEntries' | 'checkinatworkSites' | 'checkinatworkParticipants' | 'checkinatworkRegistrations'>,
  projectId: string,
  registrationDate: string,
) {
  const project = state.projects.find(item => item.id === projectId)
  const site = state.checkinatworkSites.find(item => item.projectId === projectId && item.active)
  const participants = state.checkinatworkParticipants.filter(item => item.projectId === projectId && item.active)
  const registrations = state.checkinatworkRegistrations.filter(item => item.projectId === projectId && item.registrationDate === registrationDate)
  const latestByParticipant = new Map<string, CheckinatworkRegistration>()
  for (const registration of registrations) {
    const current = latestByParticipant.get(registration.participantId)
    if (!current || registration.createdAt > current.createdAt) latestByParticipant.set(registration.participantId, registration)
  }
  const alerts: CheckinatworkDashboardAlert[] = []
  if (project && site) {
    const requirement = checkinatworkRequirement(project, site)
    if (requirement.applicability === 'Verplicht' && (!site.declarationNumber || !site.workPlaceId)) alerts.push({ id: 'site-reference', severity: 'Blokkerend', title: 'RSZ-werkplaats niet volledig', detail: 'Vul de Aangifte van Werken en het officiële werkplaatsnummer in.' })
  }
  for (const participant of participants) {
    const registration = latestByParticipant.get(participant.id)
    if (!participant.identityVerified) alerts.push({ id: `identity-${participant.id}`, severity: 'Blokkerend', title: `${participant.displayName} heeft geen geverifieerde identiteit`, detail: 'Voorzie een INSZ- of Limosa-identiteit voordat deze persoon aan het werk gaat.', participantId: participant.id })
    if (participant.identifierType === 'Limosa' && participant.limosaExpiresOn && participant.limosaExpiresOn < registrationDate) alerts.push({ id: `limosa-${participant.id}`, severity: 'Blokkerend', title: `Limosa verlopen voor ${participant.displayName}`, detail: `Geldig tot ${participant.limosaExpiresOn}.`, participantId: participant.id })
    if (!confirmed(registration)) alerts.push({ id: `presence-${participant.id}`, severity: registration?.status === 'Geweigerd' ? 'Blokkerend' : 'Waarschuwing', title: `${participant.displayName} nog niet officieel bevestigd`, detail: registration?.errorMessage || registration?.status || 'Geen registratie voor deze werkdag.', participantId: participant.id, registrationId: registration?.id })
  }
  const employeeParticipant = new Map(participants.filter(item => item.employeeId).map(item => [item.employeeId!, item]))
  const reportedEmployeeNames = state.dailyReports.filter(item => item.projectId === projectId && item.date === registrationDate).flatMap(item => item.laborEntries.map(entry => entry.employeeName.toLocaleLowerCase()))
  for (const time of state.timeEntries.filter(item => item.projectId === projectId && item.date === registrationDate && item.status !== 'Geweigerd')) {
    const participant = employeeParticipant.get(time.employeeId)
    if (participant && !confirmed(latestByParticipant.get(participant.id))) alerts.push({ id: `time-${time.id}`, severity: 'Blokkerend', title: 'Uren zonder Checkinatwork-bevestiging', detail: `${participant.displayName} heeft uren op deze werf maar geen officieel ontvangstnummer.`, participantId: participant.id })
  }
  for (const participant of participants) {
    if (reportedEmployeeNames.includes(participant.displayName.toLocaleLowerCase()) && !confirmed(latestByParticipant.get(participant.id))) alerts.push({ id: `report-${participant.id}`, severity: 'Blokkerend', title: 'Dagrapport zonder Checkinatwork-bevestiging', detail: `${participant.displayName} staat in het dagrapport maar is niet officieel bevestigd.`, participantId: participant.id })
  }
  return {
    project,
    site,
    participants,
    registrations,
    latestByParticipant,
    expected: participants.length,
    confirmed: participants.filter(item => confirmed(latestByParticipant.get(item.id))).length,
    pending: participants.filter(item => ['Lokaal geregistreerd', 'Verzending bezig', 'Gepland'].includes(latestByParticipant.get(item.id)?.status ?? 'Gepland')).length,
    rejected: participants.filter(item => latestByParticipant.get(item.id)?.status === 'Geweigerd').length,
    alerts: [...new Map(alerts.map(item => [item.id, item])).values()],
  }
}

export const maskCheckinatworkIdentifier = (value: string) => {
  const normalized = value.replace(/\s/g, '')
  return normalized.slice(-4).padStart(4, '\u2022')
}

export const participantEmployer = (participant: CheckinatworkParticipant) => participant.employerName || 'Onbekende werkgever'
