import type { BouwFlowState, CompanyUser, MailboxMessage, Page } from './domain'
import type { DossierType } from './routing'

export type WorkPriority = 'Kritiek' | 'Hoog' | 'Normaal' | 'Laag'
export type WorkStatus = 'Open' | 'Wacht op anderen' | 'Ter informatie' | 'Afgehandeld'
export type WorkAction =
  | 'complete-personal-task'
  | 'qualify-opportunity'
  | 'approve-quote'
  | 'sign-quote'
  | 'submit-daily-report'
  | 'sign-daily-report'
  | 'submit-document'
  | 'approve-document'
  | 'close-qhse-inspection'
  | 'submit-progress-statement'
  | 'approve-progress-statement'
  | 'approve-procurement-request'
  | 'submit-work-ticket'
  | 'sign-work-ticket'
  | 'submit-time-entry'
  | 'approve-time-entry'
  | 'reject-time-entry'
  | 'approve-absence'
  | 'reject-absence'
  | 'calculate-change-order'
  | 'submit-change-order'
  | 'approve-change-order'
  | 'execute-change-order'
  | 'submit-contract'
  | 'approve-contract'
  | 'complete-contract-obligation'
  | 'customer-sign-closeout'
  | 'close-qhse-event'
  | 'approve-project-claim'
  | 'submit-project-claim'
  | 'accept-project-claim'
  | 'reject-project-claim'

export interface WorkItem {
  id: string
  title: string
  description: string
  module: string
  sourceType: DossierType
  sourceId: string
  sourceLabel: string
  sourcePage?: Page
  projectId?: string
  projectName?: string
  dueDate?: string
  priority: WorkPriority
  status: WorkStatus
  ownerRoles: string[]
  ownerUserId?: string
  action?: WorkAction
  actionTargetId?: string
  actionLabel?: string
  secondaryAction?: WorkAction
  secondaryActionLabel?: string
  reason?: string
  responsibleName?: string
  substituteName?: string
  blockedBy?: string
  documentIds?: string[]
  documentLabels?: string[]
  comments?: WorkComment[]
  slaHours?: number
  createdAt?: string
  completedAt?: string
  safeBulk?: boolean
}

export interface WorkComment { id: string; author: string; text: string; createdAt: string }
export interface WorkAuditEntry { id: string; taskId: string; action: string; actor: string; detail: string; at: string }
export interface WorkTaskOverride {
  taskId: string
  priority?: WorkPriority
  responsibleUserId?: string
  substituteUserId?: string
  blockedBy?: string
  comments: WorkComment[]
}
export interface SavedWorkView { id: string; name: string; bucket: string; priority: string; module: string; search: string; view: 'list' | 'board' | 'calendar' | 'team' }
export interface CompletedWorkItem { item: WorkItem; completedAt: string; completedBy: string }

export interface PersonalWorkTask {
  id: string
  title: string
  description: string
  dueDate?: string
  priority: WorkPriority
  projectId?: string
  assigneeUserId: string
  createdBy: string
  createdAt: string
  completedAt?: string
  blockedBy?: string
  documentIds?: string[]
  comments?: WorkComment[]
}

export interface WorkDelegation {
  id: string
  delegateUserId: string
  from: string
  until: string
  includeApprovals: boolean
  active: boolean
}

export interface WorkCenterPreferences {
  personalTasks: PersonalWorkTask[]
  delegations: WorkDelegation[]
  snoozedUntil: Record<string, string>
  acknowledged: string[]
  reminders: { inApp: boolean; email: boolean; teams: boolean; dailyDigest: boolean }
  savedViews: SavedWorkView[]
  taskOverrides: WorkTaskOverride[]
  auditLog: WorkAuditEntry[]
  completedItems: CompletedWorkItem[]
  sla: { criticalHours: number; highHours: number; normalHours: number; lowHours: number }
}

export const defaultWorkCenterPreferences: WorkCenterPreferences = {
  personalTasks: [],
  delegations: [],
  snoozedUntil: {},
  acknowledged: [],
  reminders: { inApp: true, email: true, teams: false, dailyDigest: true },
  savedViews: [],
  taskOverrides: [],
  auditLog: [],
  completedItems: [],
  sla: { criticalHours: 4, highHours: 24, normalHours: 72, lowHours: 168 },
}

export const normalizeWorkCenterPreferences = (value?: Partial<WorkCenterPreferences>): WorkCenterPreferences => ({
  ...defaultWorkCenterPreferences,
  ...value,
  personalTasks: value?.personalTasks ?? [],
  delegations: value?.delegations ?? [],
  snoozedUntil: value?.snoozedUntil ?? {},
  acknowledged: value?.acknowledged ?? [],
  reminders: { ...defaultWorkCenterPreferences.reminders, ...value?.reminders },
  savedViews: value?.savedViews ?? [],
  taskOverrides: value?.taskOverrides ?? [],
  auditLog: value?.auditLog ?? [],
  completedItems: value?.completedItems ?? [],
  sla: { ...defaultWorkCenterPreferences.sla, ...value?.sla },
})

const internalManagement = ['Administrator', 'Directie']
const projectManagement = ['Administrator', 'Directie', 'Projectdirecteur', 'Projectmanager']
const siteRoles = ['Administrator', 'Projectmanager', 'Werkvoorbereider', 'Werfleider', 'Ploegbaas']
const commercialRoles = ['Administrator', 'Directie', 'Commercieel medewerker', 'Tender manager', 'Calculator', 'Projectdirecteur']
const financeRoles = ['Administrator', 'Directie', 'Projectdirecteur', 'Projectmanager', 'Financiële administratie']

const isoDay = (value?: string) => value?.slice(0, 10)
const daysFrom = (day: string | undefined, now: string) => day ? Math.ceil((new Date(`${day}T12:00:00`).getTime() - new Date(`${now}T12:00:00`).getTime()) / 86_400_000) : 9999
const priorityForDueDate = (dueDate: string | undefined, now: string, fallback: WorkPriority = 'Normaal'): WorkPriority => {
  const days = daysFrom(dueDate, now)
  if (days < 0) return 'Kritiek'
  if (days <= 2) return 'Hoog'
  return fallback
}

export const workBucket = (item: WorkItem, now: string) => {
  if (item.status === 'Afgehandeld') return 'Afgehandeld'
  if (item.status === 'Wacht op anderen') return 'Wacht op anderen'
  if (item.status === 'Ter informatie') return 'Ter informatie'
  const days = daysFrom(item.dueDate, now)
  if (days < 0) return 'Te laat'
  if (days === 0) return 'Vandaag'
  if (days <= 7) return 'Deze week'
  return 'Wacht op mij'
}

export const workSlaState = (item: WorkItem, now = new Date().toISOString()) => {
  if (!item.dueDate || item.status === 'Afgehandeld') return 'Binnen SLA' as const
  const remainingHours = (new Date(`${item.dueDate.slice(0, 10)}T17:00:00`).getTime() - new Date(now).getTime()) / 3_600_000
  if (remainingHours < 0) return 'SLA overschreden' as const
  if (remainingHours <= Math.max(4, (item.slaHours ?? 24) * .25)) return 'SLA kritiek' as const
  return 'Binnen SLA' as const
}

export function deriveAllWorkItems(state: BouwFlowState, now = new Date().toISOString().slice(0, 10), mailboxMessages: MailboxMessage[] = []): WorkItem[] {
  const projects = new Map(state.projects.map(item => [item.id, item]))
  const employeesById = new Map(state.employees.map(item => [item.id, item]))
  const usersByEmployee = new Map(state.companyUsers.filter(item => item.employeeId).map(item => [item.employeeId!, item.id]))
  const items: WorkItem[] = []
  const add = (item: WorkItem) => {
    const owner = item.ownerUserId ? state.companyUsers.find(user => user.id === item.ownerUserId) : undefined
    const relatedDocuments = item.projectId ? state.documents.filter(document => document.projectId === item.projectId).slice(0, 4) : []
    const safeBulkActions: WorkAction[] = ['submit-daily-report', 'submit-document', 'close-qhse-inspection', 'approve-time-entry', 'complete-contract-obligation', 'close-qhse-event']
    items.push({
      reason: owner ? `Rechtstreeks toegewezen aan ${owner.displayName}.` : `Toegewezen aan profiel ${item.ownerRoles.filter(role => role !== 'Administrator').join(', ') || 'Administrator'}.`,
      responsibleName: owner?.displayName ?? item.ownerRoles.find(role => role !== 'Administrator') ?? 'Nog toe te wijzen',
      documentIds: relatedDocuments.map(document => document.id),
      documentLabels: relatedDocuments.map(document => document.title),
      comments: [],
      slaHours: item.priority === 'Kritiek' ? 4 : item.priority === 'Hoog' ? 24 : item.priority === 'Normaal' ? 72 : 168,
      safeBulk: Boolean(item.action && safeBulkActions.includes(item.action)),
      ...item,
    })
  }
  const projectContext = (projectId?: string) => {
    const project = projectId ? projects.get(projectId) : undefined
    return { projectId, projectName: project?.name }
  }

  state.opportunities.filter(item => !['Gewonnen', 'Verloren'].includes(item.stage)).forEach(opportunity => {
    const ownerUserId = opportunity.tender?.submissionPlan?.ownerEmployeeId ? usersByEmployee.get(opportunity.tender.submissionPlan.ownerEmployeeId) : undefined
    add({
      id: `opportunity:${opportunity.id}`,
      title: opportunity.stage === 'Nieuw' ? `Kwalificeer ${opportunity.title}` : `Tender opvolgen: ${opportunity.title}`,
      description: opportunity.stage === 'Nieuw' ? 'Controleer klant, scope, waarde en haalbaarheid voordat de tenderflow start.' : `Bewaking van indiening, checklist en interne review voor ${opportunity.projectNumber}.`,
      module: 'Commercieel', sourceType: 'opportunity', sourceId: opportunity.id, sourceLabel: opportunity.projectNumber,
      dueDate: isoDay(opportunity.deadline), priority: priorityForDueDate(isoDay(opportunity.deadline), now, opportunity.estimatedValue > 2_000_000 ? 'Hoog' : 'Normaal'),
      status: 'Open', ownerRoles: commercialRoles, ownerUserId,
      action: opportunity.stage === 'Nieuw' ? 'qualify-opportunity' : undefined,
      actionLabel: opportunity.stage === 'Nieuw' ? 'Kwalificeren' : undefined,
    })
  })

  state.quotes.forEach(quote => {
    const status = quote.workflow?.status
    if (status === 'Concept') add({ id: `quote-approve:${quote.id}`, title: `Offerte ${quote.number} intern goedkeuren`, description: `${quote.snapshot.projectTitle} · ${quote.snapshot.clientName} · ${quote.total.toLocaleString('nl-BE', { style: 'currency', currency: 'EUR' })}`, module: 'Calculatie', sourceType: 'quote', sourceId: quote.id, sourceLabel: quote.number, dueDate: isoDay(quote.workflow?.validUntil), priority: 'Hoog', status: 'Open', ownerRoles: commercialRoles, action: 'approve-quote', actionLabel: 'Goedkeuren' })
    if (['Verzonden', 'Geopend'].includes(status ?? '')) add({ id: `quote-sign:${quote.id}`, title: `Offerte ${quote.number} ondertekenen`, description: `De offerte voor ${quote.snapshot.projectTitle} wacht op akkoord van de klant.`, module: 'Klantportaal', sourceType: 'quote', sourceId: quote.id, sourceLabel: quote.number, dueDate: isoDay(quote.workflow?.validUntil), priority: priorityForDueDate(isoDay(quote.workflow?.validUntil), now, 'Hoog'), status: 'Open', ownerRoles: ['Klant', ...internalManagement], action: 'sign-quote', actionLabel: 'Ondertekenen' })
  })

  state.projects.filter(project => project.status === 'Risico').forEach(project => add({ id: `project-risk:${project.id}`, title: `Risicoproject opvolgen: ${project.name}`, description: project.handover.risks[0] ?? 'Planning, budget en actuele risico’s opnieuw beoordelen.', module: 'Projectcontrole', sourceType: 'project', sourceId: project.id, sourceLabel: project.number, ...projectContext(project.id), priority: 'Kritiek', status: 'Open', ownerRoles: projectManagement }))

  state.dailyReports.forEach(report => {
    const project = projects.get(report.projectId)
    if (report.status === 'Concept') add({ id: `daily-submit:${report.id}`, title: `Dagrapport ${report.date} indienen`, description: `${project?.name ?? 'Project'} · controleer prestaties, materiaal, foto’s en opmerkingen.`, module: 'Werf', sourceType: 'daily-report', sourceId: report.id, sourceLabel: report.date, ...projectContext(report.projectId), dueDate: isoDay(report.date), priority: priorityForDueDate(isoDay(report.date), now, 'Hoog'), status: 'Open', ownerRoles: siteRoles, action: 'submit-daily-report', actionLabel: 'Indienen' })
    if (report.status === 'Ingediend') add({ id: `daily-sign:${report.id}`, title: `Dagrapport ${report.date} controleren`, description: `${project?.name ?? 'Project'} · inhoud en geregistreerde hoeveelheden valideren.`, module: 'Werf', sourceType: 'daily-report', sourceId: report.id, sourceLabel: report.date, ...projectContext(report.projectId), dueDate: isoDay(report.submittedAt ?? report.date), priority: 'Hoog', status: 'Open', ownerRoles: projectManagement, action: 'sign-daily-report', actionLabel: 'Ondertekenen' })
  })

  state.changeOrders.filter(change => !['Uitgevoerd', 'Klaar voor facturatie', 'Opgenomen in vorderingsstaat'].includes(change.status)).forEach(change => {
    const action = change.status === 'Vastgesteld' ? 'calculate-change-order' : change.status === 'Berekend' ? 'submit-change-order' : change.status === 'Ter goedkeuring' ? 'approve-change-order' : 'execute-change-order'
    const actionLabel = change.status === 'Vastgesteld' ? 'Berekenen' : change.status === 'Berekend' ? 'Indienen' : change.status === 'Ter goedkeuring' ? 'Goedkeuren' : 'Naar uitvoering'
    const ownerRoles = change.status === 'Ter goedkeuring' ? ['Klant', ...projectManagement] : siteRoles
    add({ id: `change:${change.id}:${change.status}`, title: `Meerwerk ${change.number}: ${actionLabel.toLowerCase()}`, description: `${change.description} · ${change.total.toLocaleString('nl-BE', { style: 'currency', currency: 'EUR' })} · ${change.scheduleImpactDays} dag(en) impact.`, module: 'Meerwerken', sourceType: 'change-order', sourceId: change.id, sourceLabel: change.number, ...projectContext(change.projectId), dueDate: isoDay(change.date), priority: change.status === 'Ter goedkeuring' ? 'Hoog' : priorityForDueDate(isoDay(change.date), now), status: 'Open', ownerRoles, action, actionLabel })
  })

  state.documents.forEach(document => {
    if (document.status === 'Concept') add({ id: `document-submit:${document.id}`, title: `Document indienen: ${document.title}`, description: `${document.category} · huidige revisie klaarzetten voor controle.`, module: 'Documenten', sourceType: 'document', sourceId: document.id, sourceLabel: document.title, ...projectContext(document.projectId), priority: 'Normaal', status: 'Open', ownerRoles: siteRoles, action: 'submit-document', actionLabel: 'Indienen' })
    if (document.status === 'Ter goedkeuring') add({ id: `document-approve:${document.id}`, title: `Document goedkeuren: ${document.title}`, description: `${document.category} · controleer inhoud, revisie en verspreidingslijst.`, module: 'Documenten', sourceType: 'document', sourceId: document.id, sourceLabel: document.title, ...projectContext(document.projectId), priority: 'Hoog', status: 'Open', ownerRoles: [...projectManagement, 'Kwaliteitsverantwoordelijke'], action: 'approve-document', actionLabel: 'Goedkeuren' })
  })

  state.qhseCertificates.forEach(certificate => {
    const days = daysFrom(isoDay(certificate.expiresOn), now)
    if (days <= 45) add({ id: `certificate:${certificate.id}`, title: `${days < 0 ? 'Vervallen' : 'Vervalt binnenkort'}: ${certificate.certificateType}`, description: `${certificate.holderName} · geldig tot ${certificate.expiresOn}. Nieuw bewijsstuk registreren.`, module: 'QHSE', sourceType: 'qhse-certificate', sourceId: certificate.id, sourceLabel: certificate.certificateNumber, ...projectContext(certificate.projectId), dueDate: isoDay(certificate.expiresOn), priority: days < 0 ? 'Kritiek' : 'Hoog', status: 'Open', ownerRoles: ['Administrator', 'Preventieadviseur', 'Kwaliteitsverantwoordelijke', 'Werfleider', 'Onderaannemer'] })
  })
  state.qhseInspections.filter(inspection => inspection.status === 'Open').forEach(inspection => {
    const openFindings = inspection.findings.filter(finding => !finding.resolvedAt)
    const dueDate = openFindings.map(item => item.dueDate).sort()[0] ?? inspection.inspectionDate
    add({ id: `inspection:${inspection.id}`, title: `${inspection.type} opvolgen`, description: `${inspection.location} · ${openFindings.length} open vaststelling(en).`, module: 'QHSE', sourceType: 'qhse-inspection', sourceId: inspection.id, sourceLabel: inspection.type, ...projectContext(inspection.projectId), dueDate: isoDay(dueDate), priority: priorityForDueDate(isoDay(dueDate), now, openFindings.some(item => item.severity === 'Hoog') ? 'Kritiek' : 'Hoog'), status: openFindings.length ? 'Open' : 'Open', ownerRoles: ['Administrator', 'Preventieadviseur', 'Kwaliteitsverantwoordelijke', 'Werfleider'], action: openFindings.length ? undefined : 'close-qhse-inspection', actionLabel: openFindings.length ? undefined : 'Inspectie sluiten' })
  })
  state.qhseEvents.filter(event => event.status !== 'Gesloten').forEach(event => add({ id: `qhse-event:${event.id}`, title: `${event.type} opvolgen: ${event.title}`, description: event.correctiveAction || event.description, module: 'QHSE', sourceType: 'qhse-event', sourceId: event.id, sourceLabel: event.type, ...projectContext(event.projectId), dueDate: isoDay(event.dueDate), priority: event.severity === 'Kritiek' ? 'Kritiek' : priorityForDueDate(isoDay(event.dueDate), now, event.severity === 'Hoog' ? 'Hoog' : 'Normaal'), status: 'Open', ownerRoles: ['Administrator', 'Preventieadviseur', 'Kwaliteitsverantwoordelijke', 'Werfleider'], action: event.status === 'In behandeling' ? 'close-qhse-event' : undefined, actionLabel: event.status === 'In behandeling' ? 'Afsluiten' : undefined }))

  state.progressStatements.forEach(statement => {
    if (statement.status === 'Concept') add({ id: `progress-submit:${statement.id}`, title: `Vordering ${statement.number} indienen`, description: 'Controleer meetbronnen, bewijsstukken, prijsherziening en inhoudingen.', module: 'Vorderingen', sourceType: 'progress-statement', sourceId: statement.id, sourceLabel: statement.number, ...projectContext(statement.projectId), dueDate: isoDay(statement.dueDate ?? statement.periodEnd), priority: priorityForDueDate(isoDay(statement.dueDate ?? statement.periodEnd), now, 'Hoog'), status: 'Open', ownerRoles: financeRoles, action: 'submit-progress-statement', actionLabel: 'Indienen' })
    if (statement.status === 'Ingediend') add({ id: `progress-approve:${statement.id}`, title: `Vordering ${statement.number} goedkeuren`, description: `${statement.netAmount.toLocaleString('nl-BE', { style: 'currency', currency: 'EUR' })} netto · controle door opdrachtgever.`, module: 'Vorderingen', sourceType: 'progress-statement', sourceId: statement.id, sourceLabel: statement.number, ...projectContext(statement.projectId), dueDate: isoDay(statement.dueDate), priority: priorityForDueDate(isoDay(statement.dueDate), now, 'Hoog'), status: 'Open', ownerRoles: ['Klant', ...projectManagement, 'Financiële administratie'], action: 'approve-progress-statement', actionLabel: 'Goedkeuren' })
  })
  state.salesInvoices.filter(invoice => invoice.status === 'Openstaand' && daysFrom(isoDay(invoice.dueDate), now) < 0).forEach(invoice => add({ id: `invoice-overdue:${invoice.id}`, title: `Achterstallige factuur ${invoice.number}`, description: `${invoice.total.toLocaleString('nl-BE', { style: 'currency', currency: 'EUR' })} · betaling en opvolging registreren.`, module: 'Cashflow', sourceType: 'sales-invoice', sourceId: invoice.id, sourceLabel: invoice.number, ...projectContext(invoice.projectId), dueDate: isoDay(invoice.dueDate), priority: 'Kritiek', status: 'Open', ownerRoles: ['Administrator', 'Directie', 'Financiële administratie'] }))

  state.procurementRequests.filter(request => request.approval?.status === 'Te beoordelen').forEach(request => add({ id: `procurement:${request.id}`, title: `Inkoopaanvraag ${request.number} goedkeuren`, description: `${request.description} · autorisatieniveau ${request.approval?.requiredRole}.`, module: 'Inkoop', sourceType: 'procurement-request', sourceId: request.id, sourceLabel: request.number, ...projectContext(request.projectId), dueDate: isoDay(request.neededBy), priority: priorityForDueDate(isoDay(request.neededBy), now, 'Hoog'), status: 'Open', ownerRoles: [request.approval!.requiredRole, ...internalManagement], action: 'approve-procurement-request', actionLabel: 'Goedkeuren' }))
  state.purchaseOrders.filter(order => !['Ontvangen', 'Factuur gecontroleerd', 'Betaald'].includes(order.status)).forEach(order => add({ id: `delivery:${order.id}`, title: `Levering ${order.number} opvolgen`, description: `${order.status} · verwacht op ${order.expectedDeliveryDate}.`, module: 'Inkoop', sourceType: 'purchase-order', sourceId: order.id, sourceLabel: order.number, ...projectContext(order.projectId), dueDate: isoDay(order.expectedDeliveryDate), priority: priorityForDueDate(isoDay(order.expectedDeliveryDate), now), status: 'Open', ownerRoles: ['Aankoper', 'Magazijnier', 'Leverancier', ...internalManagement] }))

  state.workTickets.forEach(ticket => {
    if (ticket.status === 'Concept') add({ id: `ticket-submit:${ticket.id}`, title: `Werkbon ${ticket.number} indienen`, description: `${ticket.description} · ${ticket.total.toLocaleString('nl-BE', { style: 'currency', currency: 'EUR' })}.`, module: 'Werf', sourceType: 'work-ticket', sourceId: ticket.id, sourceLabel: ticket.number, ...projectContext(ticket.projectId), dueDate: isoDay(ticket.date), priority: priorityForDueDate(isoDay(ticket.date), now), status: 'Open', ownerRoles: ['Onderaannemer', ...siteRoles], action: 'submit-work-ticket', actionLabel: 'Indienen' })
    if (ticket.status === 'Ter ondertekening') add({ id: `ticket-sign:${ticket.id}`, title: `Werkbon ${ticket.number} ondertekenen`, description: `${ticket.description} · uitgevoerde prestaties controleren.`, module: 'Werf', sourceType: 'work-ticket', sourceId: ticket.id, sourceLabel: ticket.number, ...projectContext(ticket.projectId), dueDate: isoDay(ticket.date), priority: 'Hoog', status: 'Open', ownerRoles: projectManagement, action: 'sign-work-ticket', actionLabel: 'Ondertekenen' })
  })

  state.timeEntries.filter(entry => entry.status === 'Concept').forEach(entry => {
    const ownerUserId = usersByEmployee.get(entry.employeeId)
    const employee = employeesById.get(entry.employeeId)
    add({ id: `time-submit:${entry.id}`, title: `Urenstaat ${entry.date} indienen`, description: `${employee ? `${employee.firstName} ${employee.lastName}` : 'Medewerker'} · ${entry.regularHours + entry.overtimeHours} uur.`, module: 'HR & tijd', sourceType: 'time-entry', sourceId: entry.id, sourceLabel: entry.date, ...projectContext(entry.projectId), dueDate: isoDay(entry.date), priority: priorityForDueDate(isoDay(entry.date), now), status: 'Open', ownerRoles: ['Arbeider', 'Ploegbaas', 'Werfleider'], ownerUserId, action: 'submit-time-entry', actionLabel: 'Indienen' })
  })
  state.timeEntries.filter(entry => entry.status === 'Ingediend').forEach(entry => add({ id: `time-approve:${entry.id}`, title: `Urenstaat ${entry.date} goedkeuren`, description: `${entry.regularHours + entry.overtimeHours} uur · bron ${entry.source}.`, module: 'HR & tijd', sourceType: 'time-entry', sourceId: entry.id, sourceLabel: entry.date, ...projectContext(entry.projectId), dueDate: isoDay(entry.date), priority: priorityForDueDate(isoDay(entry.date), now, 'Hoog'), status: 'Open', ownerRoles: ['Administrator', 'Projectmanager', 'Werfleider', 'HR'], action: 'approve-time-entry', actionLabel: 'Goedkeuren', secondaryAction: 'reject-time-entry', secondaryActionLabel: 'Weigeren' }))

  state.employeeAbsences.filter(absence => absence.status === 'Aangevraagd').forEach(absence => {
    const employee = employeesById.get(absence.employeeId)
    add({ id: `absence:${absence.id}`, title: `${absence.type} goedkeuren`, description: `${employee ? `${employee.firstName} ${employee.lastName}` : absence.requestedBy} · ${absence.startDate} t/m ${absence.endDate} · ${absence.hours} uur.`, module: 'HR & verlof', sourceType: 'employee-absence', sourceId: absence.id, sourceLabel: absence.type, dueDate: isoDay(absence.startDate), priority: priorityForDueDate(isoDay(absence.startDate), now, 'Normaal'), status: 'Open', ownerRoles: ['Administrator', 'HR', 'Projectmanager'], action: 'approve-absence', actionLabel: 'Goedkeuren', secondaryAction: 'reject-absence', secondaryActionLabel: 'Weigeren' })
  })

  state.projectContracts.forEach(contract => {
    if (contract.approvalStatus === 'Concept') add({ id: `contract-submit:${contract.id}`, title: `Contract indienen: ${contract.title}`, description: `${contract.contractNumber ?? 'Zonder contractnummer'} · controleer documenten, clausules en zekerheden.`, module: 'Contract', sourceType: 'contract', sourceId: contract.id, sourceLabel: contract.contractNumber ?? contract.title, ...projectContext(contract.projectId), dueDate: isoDay(contract.executionStart), priority: priorityForDueDate(isoDay(contract.executionStart), now, 'Hoog'), status: 'Open', ownerRoles: projectManagement, action: 'submit-contract', actionLabel: 'Indienen' })
    if (contract.approvalStatus === 'Ter goedkeuring') add({ id: `contract-approve:${contract.id}`, title: `Contract goedkeuren: ${contract.title}`, description: 'Controleer contractwaarde, prijsherziening, waarborgen en risico’s.', module: 'Contract', sourceType: 'contract', sourceId: contract.id, sourceLabel: contract.contractNumber ?? contract.title, ...projectContext(contract.projectId), dueDate: isoDay(contract.executionStart), priority: 'Hoog', status: 'Open', ownerRoles: ['Administrator', 'Directie', 'Projectdirecteur'], action: 'approve-contract', actionLabel: 'Goedkeuren' })
    contract.obligations.filter(obligation => obligation.status !== 'Voltooid').forEach(obligation => add({ id: `contract-obligation:${contract.id}:${obligation.id}`, title: obligation.title, description: `Contractuele verplichting · eigenaar ${obligation.owner}.`, module: 'Contract', sourceType: 'contract', sourceId: contract.id, sourceLabel: contract.contractNumber ?? contract.title, ...projectContext(contract.projectId), dueDate: isoDay(obligation.dueDate), priority: priorityForDueDate(isoDay(obligation.dueDate), now, 'Hoog'), status: 'Open', ownerRoles: projectManagement, action: 'complete-contract-obligation', actionTargetId: obligation.id, actionLabel: 'Voltooien' }))
  })
  state.projectCloseouts.forEach(closeout => {
    const openItems = closeout.items.filter(item => item.status !== 'Opgelost')
    openItems.forEach(item => add({ id: `closeout-item:${closeout.id}:${item.id}`, title: `Opleverpunt: ${item.description}`, description: `${item.location ?? 'Project'} · verantwoordelijke ${item.responsible}.`, module: 'Oplevering', sourceType: 'closeout', sourceId: closeout.id, sourceLabel: closeout.status, ...projectContext(closeout.projectId), dueDate: isoDay(item.dueDate), priority: priorityForDueDate(isoDay(item.dueDate), now, 'Hoog'), status: 'Open', ownerRoles: ['Administrator', 'Projectmanager', 'Werkvoorbereider', 'Werfleider', 'Kwaliteitsverantwoordelijke'] }))
    if (closeout.status !== 'Voorbereiding' && !closeout.customerSignedAt) add({ id: `closeout-sign:${closeout.id}`, title: 'Oplevering digitaal bevestigen', description: 'Controleer het proces-verbaal, de open punten en de aangeleverde documenten.', module: 'Klantportaal', sourceType: 'closeout', sourceId: closeout.id, sourceLabel: closeout.status, ...projectContext(closeout.projectId), dueDate: isoDay(closeout.provisionalAcceptanceOn ?? closeout.definitiveAcceptanceOn), priority: 'Hoog', status: 'Open', ownerRoles: ['Klant', 'Administrator'], action: 'customer-sign-closeout', actionLabel: 'Bevestigen' })
  })

  state.projectClaims.filter(claim => !['Aanvaard', 'Afgewezen'].includes(claim.status)).forEach(claim => {
    const action = claim.status === 'Concept' ? 'approve-project-claim' : claim.status === 'Intern goedgekeurd' ? 'submit-project-claim' : claim.status === 'Ingediend' ? 'accept-project-claim' : undefined
    const actionLabel = claim.status === 'Concept' ? 'Intern goedkeuren' : claim.status === 'Intern goedgekeurd' ? 'Indienen' : claim.status === 'Ingediend' ? 'Aanvaarden' : undefined
    add({ id: `claim:${claim.id}:${claim.status}`, title: `Claim ${claim.number} opvolgen`, description: `${claim.description} · ${claim.amount.toLocaleString('nl-BE', { style: 'currency', currency: 'EUR' })} · ${claim.extensionDays} dag(en).`, module: 'Claims', sourceType: 'project-claim', sourceId: claim.id, sourceLabel: claim.number, ...projectContext(claim.projectId), dueDate: isoDay(claim.createdAt), priority: 'Hoog', status: 'Open', ownerRoles: claim.status === 'Ingediend' ? ['Klant', ...projectManagement] : projectManagement, action, actionLabel, secondaryAction: claim.status === 'Ingediend' ? 'reject-project-claim' : undefined, secondaryActionLabel: claim.status === 'Ingediend' ? 'Afwijzen' : undefined })
  })

  state.checkinatworkRegistrations.filter(registration => ['Geweigerd', 'Gepland', 'Lokaal geregistreerd'].includes(registration.status)).forEach(registration => add({ id: `checkinatwork:${registration.id}`, title: `Checkinatwork: ${registration.status.toLowerCase()}`, description: registration.errorMessage ?? 'Controleer identiteit, werkplaatsnummer en verzending naar RSZ.', module: 'Checkinatwork', sourceType: 'project', sourceId: registration.projectId, sourceLabel: registration.status, ...projectContext(registration.projectId), dueDate: isoDay(registration.registrationDate), priority: registration.status === 'Geweigerd' ? 'Kritiek' : priorityForDueDate(isoDay(registration.registrationDate), now, 'Hoog'), status: 'Open', ownerRoles: ['Administrator', 'Werfleider', 'Preventieadviseur', 'HR'] }))

  ;(state.calculations ?? []).filter(calculation => calculation.status !== 'Offerte').forEach(calculation => {
    const opportunity = state.opportunities.find(item => item.id === calculation.opportunityId)
    add({ id: `calculation:${calculation.id}:${calculation.status}`, title: calculation.status === 'Review' ? `Calculatie ${calculation.number} controleren` : `Calculatie ${calculation.number} vervolledigen`, description: `${calculation.items?.length ?? 0} posten en ${calculation.chapters?.length ?? 0} hoofdstukken · status ${calculation.status}.`, module: 'Calculatie', sourceType: 'calculation', sourceId: calculation.id, sourceLabel: calculation.number, dueDate: isoDay(opportunity?.deadline), priority: priorityForDueDate(isoDay(opportunity?.deadline), now, calculation.status === 'Review' ? 'Hoog' : 'Normaal'), status: 'Open', ownerRoles: ['Administrator', 'Calculator', 'Tender manager', 'Projectdirecteur'], actionLabel: 'Open controle' })
    const hasBimOrLidar = (calculation.items ?? []).some(item => /\b(BIM|IFC|LiDAR|scan)\b/i.test(`${item.description} ${item.notes ?? ''}`))
    if (hasBimOrLidar) add({ id: `model-control:${calculation.id}`, title: `BIM- en LiDAR-meetvoorstel goedkeuren`, description: `Controleer modelkoppelingen, gemeten hoeveelheden, foto’s en voorgestelde calculatieposten voor ${calculation.number}.`, module: 'BIM & LiDAR', sourceType: 'calculation', sourceId: calculation.id, sourceLabel: calculation.number, dueDate: isoDay(opportunity?.deadline), priority: 'Hoog', status: 'Open', ownerRoles: ['Administrator', 'Calculator', 'Projectmanager', 'Werkvoorbereider'], blockedBy: calculation.items?.length ? undefined : 'Nog geen meetposten uit het model ontvangen.' })
  })

  state.projects.forEach(project => project.planning.activities.filter(activity => activity.progress < 100).forEach(activity => {
    const ownerUserId = activity.responsibleEmployeeId ? usersByEmployee.get(activity.responsibleEmployeeId) : undefined
    const isLate = activity.endDate < now
    if (isLate || activity.milestone || activity.startDate <= now) add({ id: `planning:${project.id}:${activity.id}`, title: activity.milestone ? `Mijlpaal opvolgen: ${activity.name}` : `Planningstaak: ${activity.name}`, description: `${activity.progress}% uitgevoerd · ${activity.startDate} tot ${activity.endDate} · verantwoordelijke ${activity.responsible || 'niet ingevuld'}.`, module: 'Planning', sourceType: 'project', sourceId: project.id, sourceLabel: activity.name, ...projectContext(project.id), dueDate: activity.endDate, priority: isLate ? 'Kritiek' : activity.milestone ? 'Hoog' : 'Normaal', status: 'Open', ownerRoles: ['Administrator', 'Projectmanager', 'Planner', 'Werfleider', 'Werkvoorbereider'], ownerUserId, blockedBy: activity.dependencies?.length && activity.progress === 0 ? `${activity.dependencies.length} voorganger(s) moeten eerst vrijgegeven zijn.` : undefined })
  }))

  state.procurementRequests.filter(request => ['Prijsaanvraag', 'Vergelijken'].includes(request.status)).forEach(request => add({ id: `procurement-flow:${request.id}:${request.status}`, title: request.status === 'Vergelijken' ? `Prijsaanvragen ${request.number} vergelijken` : `Wachten op leveranciers voor ${request.number}`, description: `${request.description} · ${request.quotes.length} ontvangen offerte(s) van ${request.invitedSupplierIds.length} leveranciers.`, module: 'Inkoop', sourceType: 'procurement-request', sourceId: request.id, sourceLabel: request.number, ...projectContext(request.projectId), dueDate: request.neededBy, priority: priorityForDueDate(request.neededBy, now, 'Hoog'), status: request.status === 'Prijsaanvraag' ? 'Wacht op anderen' : 'Open', ownerRoles: ['Administrator', 'Aankoper', 'Werkvoorbereider', 'Projectmanager'], blockedBy: request.status === 'Prijsaanvraag' ? 'Leveranciersoffertes nog niet volledig ontvangen.' : undefined }))

  ;(state.peppolAlerts ?? []).filter(alert => alert.status !== 'Opgelost').forEach(alert => {
    const invoice = state.salesInvoices.find(item => item.id === alert.invoiceId)
    add({ id: `peppol:${alert.id}`, title: `Peppol: ${alert.type}`, description: alert.message, module: 'Peppol', sourceType: 'sales-invoice', sourceId: alert.invoiceId, sourceLabel: invoice?.number ?? alert.invoiceId, ...projectContext(invoice?.projectId), dueDate: isoDay(alert.updatedAt), priority: alert.severity === 'Kritiek' ? 'Kritiek' : 'Hoog', status: 'Open', ownerRoles: ['Administrator', 'Financiële administratie'], blockedBy: alert.status === 'In behandeling' ? 'Technische of externe statuscontrole loopt.' : undefined })
  })

  ;(state.integrationJobs ?? []).filter(job => job.status === 'Mislukt').forEach(job => add({ id: `integration:${job.id}`, title: `${job.entityType} ${job.direction.toLowerCase()} herstellen`, description: `Integratietaak is na ${job.attempts} poging(en) mislukt. Volgende poging: ${job.nextAttemptAt}.`, module: 'Integraties', sourceType: 'project', sourceId: '', sourcePage: 'integrations', sourceLabel: job.entityId, dueDate: isoDay(job.nextAttemptAt), priority: job.attempts >= 3 ? 'Kritiek' : 'Hoog', status: 'Open', ownerRoles: ['Administrator', 'Financiële administratie'], blockedBy: (state.integrationConnections ?? []).find(connection => connection.id === job.connectionId)?.lastError }))

  mailboxMessages.filter(message => message.direction === 'Inkomend' && !message.isRead).forEach(message => {
    const sourceType: DossierType = message.projectId ? 'project' : message.opportunityId ? 'opportunity' : message.organizationId ? 'organization' : 'project'
    const sourceId = message.projectId ?? message.opportunityId ?? message.organizationId ?? ''
    add({ id: `email:${message.id}`, title: `E-mail beantwoorden: ${message.subject}`, description: `${message.fromName} <${message.fromAddress}> · ${message.bodyPreview}`, module: 'E-mail', sourceType, sourceId, sourcePage: sourceId ? undefined : 'mailbox', sourceLabel: message.fromName, ...projectContext(message.projectId), dueDate: isoDay(message.receivedAt), priority: priorityForDueDate(isoDay(message.receivedAt), now, 'Normaal'), status: 'Open', ownerRoles: ['Administrator', 'Commercieel medewerker', 'Tender manager', 'Projectmanager', 'Werkvoorbereider', 'Aankoper', 'Financiële administratie'], blockedBy: message.hasAttachments ? undefined : undefined })
  })

  return items.sort((left, right) => {
    const rank: Record<WorkPriority, number> = { Kritiek: 0, Hoog: 1, Normaal: 2, Laag: 3 }
    return rank[left.priority] - rank[right.priority] || (left.dueDate ?? '9999').localeCompare(right.dueDate ?? '9999')
  })
}

export function workItemsForUser(allItems: WorkItem[], state: BouwFlowState, user: CompanyUser | undefined, preferences: WorkCenterPreferences, now = new Date().toISOString().slice(0, 10)) {
  if (!user) return []
  const normalized = normalizeWorkCenterPreferences(preferences)
  const delegatedFrom = typeof localStorage === 'undefined' ? [] : state.companyUsers.filter(owner => owner.id !== user.id).filter(owner => {
    const key = `bouwflow-work-center-v1:${owner.id}`
    try {
      const stored = JSON.parse(localStorage.getItem(key) ?? '{}') as Partial<WorkCenterPreferences>
      return stored.delegations?.some(item => item.active && item.delegateUserId === user.id && item.from <= now && item.until >= now)
    } catch { return false }
  }).map(item => item.id)
  const userRoles = [...new Set([user.role, ...(user.roles ?? [])])]
  const management = userRoles.some(role => internalManagement.includes(role))
  const allowedProjects = user.allProjects === false ? new Set(user.projectIds ?? []) : undefined
  const automatic = allItems.map(item => {
    const override = normalized.taskOverrides.find(entry => entry.taskId === item.id)
    const responsible = override?.responsibleUserId ? state.companyUsers.find(entry => entry.id === override.responsibleUserId) : undefined
    const substitute = override?.substituteUserId ? state.companyUsers.find(entry => entry.id === override.substituteUserId) : undefined
    return { ...item, priority: override?.priority ?? item.priority, ownerUserId: override?.responsibleUserId ?? item.ownerUserId, responsibleName: responsible?.displayName ?? item.responsibleName, substituteName: substitute?.displayName ?? item.substituteName, blockedBy: override?.blockedBy ?? item.blockedBy, comments: [...(item.comments ?? []), ...(override?.comments ?? [])], reason: responsible ? `Handmatig toegewezen aan ${responsible.displayName}.` : item.reason }
  }).filter(item => {
    if (normalized.acknowledged.includes(item.id)) return false
    if (normalized.snoozedUntil[item.id] && normalized.snoozedUntil[item.id] > now) return false
    if (allowedProjects && item.projectId && !allowedProjects.has(item.projectId)) return false
    return management || item.ownerUserId === user.id || (item.ownerUserId && delegatedFrom.includes(item.ownerUserId)) || item.ownerRoles.some(role => userRoles.includes(role))
  })
  const manual: WorkItem[] = normalized.personalTasks
    .filter(item => management || item.assigneeUserId === user.id || delegatedFrom.includes(item.assigneeUserId))
    .map(item => {
      const responsible = state.companyUsers.find(entry => entry.id === item.assigneeUserId)
      return { id: `personal:${item.id}`, title: item.title, description: item.description, module: 'Persoonlijk', sourceType: 'project', sourceId: item.projectId ?? '', sourceLabel: 'Persoonlijke taak', projectId: item.projectId, projectName: state.projects.find(project => project.id === item.projectId)?.name, dueDate: item.dueDate, priority: item.completedAt ? item.priority : priorityForDueDate(item.dueDate, now, item.priority), status: item.completedAt ? 'Afgehandeld' : 'Open', ownerRoles: [], ownerUserId: item.assigneeUserId, responsibleName: responsible?.displayName, reason: `Manueel aangemaakt door ${state.companyUsers.find(entry => entry.id === item.createdBy)?.displayName ?? 'BouwFlow-gebruiker'}.`, blockedBy: item.blockedBy, documentIds: item.documentIds ?? [], documentLabels: (item.documentIds ?? []).map(id => state.documents.find(document => document.id === id)?.title ?? id), comments: item.comments ?? [], createdAt: item.createdAt, completedAt: item.completedAt, safeBulk: false, action: item.completedAt ? undefined : 'complete-personal-task', actionLabel: item.completedAt ? undefined : 'Afhandelen' }
    })
  const completed = normalized.completedItems.filter(entry => management || entry.item.ownerUserId === user.id || entry.item.ownerRoles.some(role => userRoles.includes(role))).map(entry => ({ ...entry.item, status: 'Afgehandeld' as const, completedAt: entry.completedAt }))
  return [...automatic, ...manual, ...completed].sort((left, right) => {
    const rank: Record<WorkPriority, number> = { Kritiek: 0, Hoog: 1, Normaal: 2, Laag: 3 }
    return rank[left.priority] - rank[right.priority] || (left.dueDate ?? '9999').localeCompare(right.dueDate ?? '9999')
  })
}

export const appendWorkAudit = (preferences: WorkCenterPreferences, entry: Omit<WorkAuditEntry, 'id' | 'at'>): WorkCenterPreferences => {
  const normalized = normalizeWorkCenterPreferences(preferences)
  return { ...normalized, auditLog: [{ ...entry, id: crypto.randomUUID(), at: new Date().toISOString() }, ...normalized.auditLog].slice(0, 500) }
}

export const dashboardContextsForUser = (user?: CompanyUser) => {
  if (!user) return []
  const roles = [...new Set([user.role, ...(user.roles ?? [])])]
  return roles.map(role => ({ id: role, label: role === 'Projectmanager' || role === 'Projectdirecteur' ? 'Projectmanagement' : role === 'Financiële administratie' ? 'Financieel' : role === 'Calculator' ? 'Calculatie' : role }))
}

export const roleDashboardCopy = (role?: string) => {
  const profiles: Record<string, { eyebrow: string; title: string; subtitle: string }> = {
    Administrator: { eyebrow: 'Organisatiebreed overzicht', title: 'Besturingsdashboard', subtitle: 'Werkvoorraad, uitzonderingen en prestaties over alle teams en portalen.' },
    Directie: { eyebrow: 'Portefeuilleoverzicht', title: 'Directiedashboard', subtitle: 'Commercieel, financieel en operationeel inzicht over alle actieve projecten.' },
    'Commercieel medewerker': { eyebrow: 'Commercieel', title: 'Mijn commercieel dashboard', subtitle: 'Relaties, opportuniteiten, offertes en afspraken die vandaag aandacht vragen.' },
    Calculator: { eyebrow: 'Calculatie', title: 'Mijn calculatiedashboard', subtitle: 'Lopende calculaties, deadlines, controles en offertes klaar voor review.' },
    'Tender manager': { eyebrow: 'Tenders', title: 'Mijn tenderdashboard', subtitle: 'Indieningen, ontbrekende stukken en interne reviews in één overzicht.' },
    Projectmanager: { eyebrow: 'Projectsturing', title: 'Mijn projectdashboard', subtitle: 'Planning, budget, risico’s, goedkeuringen en beslissingen voor jouw projecten.' },
    Projectdirecteur: { eyebrow: 'Projectportfolio', title: 'Mijn portfoliodashboard', subtitle: 'Projectprestaties, escalaties, cashflow en beslissingen over jouw portefeuille.' },
    Werkvoorbereider: { eyebrow: 'Werkvoorbereiding', title: 'Mijn voorbereidingsdashboard', subtitle: 'Documenten, werkpakketten, inkoop en vrijgaven voor de komende uitvoering.' },
    Planner: { eyebrow: 'Planning', title: 'Mijn planningsdashboard', subtitle: 'Capaciteit, conflicten, mijlpalen en wijzigingen die planning vereisen.' },
    Werfleider: { eyebrow: 'Werf', title: 'Mijn werfdashboard', subtitle: 'Dagrapporten, aanwezigheid, veiligheid, leveringen en acties op jouw werven.' },
    Ploegbaas: { eyebrow: 'Uitvoering', title: 'Mijn ploegdashboard', subtitle: 'Dagplanning, uren, werkbonnen en veiligheidsacties voor jouw ploeg.' },
    Arbeider: { eyebrow: 'Vandaag op de werf', title: 'Mijn werkdag', subtitle: 'Jouw planning, registraties, veiligheidsacties en open taken.' },
    Aankoper: { eyebrow: 'Inkoop', title: 'Mijn inkoopdashboard', subtitle: 'Aanvragen, prijsvergelijkingen, bestellingen, leveringen en afwijkingen.' },
    Magazijnier: { eyebrow: 'Logistiek', title: 'Mijn logistiek dashboard', subtitle: 'Ontvangsten, voorraadbewegingen, reservaties en materiaalacties.' },
    'Financiële administratie': { eyebrow: 'Financiën', title: 'Mijn financieel dashboard', subtitle: 'Vorderingen, facturen, vervaldagen, Peppol en afwijkingen.' },
    HR: { eyebrow: 'Mens & organisatie', title: 'Mijn HR-dashboard', subtitle: 'Afwezigheden, tijdregistratie, documenten en personeelsacties.' },
    Preventieadviseur: { eyebrow: 'Veiligheid', title: 'Mijn veiligheidsdashboard', subtitle: 'Inspecties, vaststellingen, attesten en kritieke werfrisico’s.' },
    Kwaliteitsverantwoordelijke: { eyebrow: 'Kwaliteit', title: 'Mijn kwaliteitsdashboard', subtitle: 'Documentreviews, inspecties, bewijsvoering en opleverdossiers.' },
    Klant: { eyebrow: 'Klantportaal', title: 'Mijn projecten', subtitle: 'Opvolging, documenten, vorderingen en goedkeuringen die op jou wachten.' },
    Onderaannemer: { eyebrow: 'Onderaannemersportaal', title: 'Mijn opdrachten', subtitle: 'Werkbonnen, planning, documenten, attesten en open acties.' },
    Leverancier: { eyebrow: 'Leveranciersportaal', title: 'Mijn leveringen', subtitle: 'Prijsaanvragen, bestellingen, leverdata en afwijkingen.' },
  }
  return profiles[role ?? ''] ?? { eyebrow: 'Persoonlijke werkruimte', title: 'Mijn dashboard', subtitle: 'Alles wat vandaag jouw aandacht vraagt.' }
}
