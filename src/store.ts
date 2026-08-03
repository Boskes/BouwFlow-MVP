import { useCallback, useEffect, useMemo, useState } from 'react'
import { BouwFlowApi, OfflineMutationQueuedError } from './api'
import {
  bulkBoqPriceAdjustmentPreview, changeOrderTotal, createId, directCost, postCalculationAnalysis, projectControlMetrics, scenarioDirectCost, scenarioSellingTotal, sellingTotal, todayIso,
  DEFAULT_COST_LIBRARY_ID, DEFAULT_COST_LIBRARY_VERSION_ID, class8CalculationTemplates, unitConversionFactor,
  type BoqChapter, type BoqImportPreview, type BoqItem, type BoqPriceAdjustment, type BouwFlowState, type BulkCostUpdateResult, type BulkPriceAdjustmentResult, type Calculation, type CalculationScenario, type ChangeOrder, type ChangeOrderInput, type CommitmentSettlementInput, type CompanyBranch, type CompanyBranchInput, type CompanyUserAccessInput, type CompanyUserProfileInput, type CostLibrary, type CostLibraryItem, type CostLibraryVersion, type DailyReport, type DailyReportInput, type DocumentDistributionInput, type DocumentMetadataInput, type DocumentRevisionInput, type DocumentUploadInput, type DocumentVersion, type IntercompanyCharge, type IntercompanyChargeInput, type LegalEntity, type LegalEntityFinancialInput, type LegalEntityInput, type Opportunity, type OpportunityDetailsInput, type OpportunityGoNoGoInput, type OrganizationBillingInput, type PaymentRegistrationInput, type PeppolAcceptanceReleaseInput, type PeppolDelivery, type PeppolNotificationSettingsInput, type PeppolNotificationTestInput, type PeppolValidationReport, type PlanningActivity, type PostCalculationFeedbackInput, type ProcurementRequest, type ProcurementRequestInput, type ProgressStatement, type ProgressStatementInput, type Project, type ProjectBaselineInput, type ProjectCompanyAssignmentInput, type ProjectCost, type ProjectCostInput, type ProjectDetailsInput, type ProjectDocument, type ProjectForecast, type ProjectForecastInput, type ProjectHandover, type ProjectPlanning, type ProjectPlanningInput, type ProjectStartupInput, type ProjectWorkPackage, type PurchaseInvoiceMatchInput, type PurchaseOrder, type PurchaseReceiptInput, type QhseCertificate, type QhseCertificateInput, type QhseInspection, type QhseInspectionInput, type QuoteContent, type SalesInvoiceInput, type SalesInvoiceIssueInput, type SitePhotoInput, type Supplier, type SupplierInput, type SupplierQuoteInput, type UnitConversion, type UnitDefinition, type WorkflowDefinitionInput,
} from './domain'
import { defaultWorkflowDefinitions } from './administration'
import { invoiceExportReadiness } from './invoice-readiness'
import type { CrmActivity, DocumentRecordLinkInput, Organization, OrganizationInput, OrganizationRelation, Quote, TenderDossier } from './domain'
import type { AuditTrailEntry } from './domain'
import type { MailboxComposeInput, MailboxLinkInput, MailboxOverview, MailboxReplyInput } from './domain'
import type { WorkflowCorrection, WorkflowCorrectionInput } from './domain'
import type { CloseoutItem, ProjectCloseoutUpdateInput, ServiceRequestInput } from './domain'
import type { Asset, AssetInput, AssetOperationalInput, InventoryCountInput, InventoryItem, InventoryItemInput, StockMovement, StockMovementInput, Warehouse, WarehouseInput } from './domain'
import type { AiAnalysis, AiAnalysisInput, CheckinatworkCancellationReason, CheckinatworkParticipant, CheckinatworkParticipantInput, CheckinatworkRegistration, CheckinatworkRegistrationInput, CheckinatworkSite, CheckinatworkSiteInput, Employee, EmployeeAbsence, EmployeeAbsenceDecisionInput, EmployeeAbsenceInput, EmployeeCrew, EmployeeCrewInput, EmployeeInput, IntegrationConnection, IntegrationConnectionInput, IntegrationJob, IntegrationJobInput, JointVenture, JointVentureInput, ProjectClaim, ProjectClaimInput, ProjectCloseout, ProjectCloseoutInput, ProjectContract, ProjectContractInput, ProjectContractUpdateInput, QhseEvent, QhseEventInput, Subcontractor, SubcontractorInput, SubcontractorOperationInput, TimeEntry, TimeEntryInput, WorkTicket, WorkTicketInput } from './domain'
import { readOfflineSnapshot, saveOfflineSnapshot } from './offline-queue'
import { parseBoqFileLocally } from './boq-import'
import { searchBelgianAddressesOnline } from './belgian-addresses'
import { buildOosterweelClass8DemoCalculation } from './class8-demo-calculation'
import { buildFamilyHomeBimCalculation, buildFamilyHomeBimProgressStatement, buildFamilyHomeBimProject } from './family-home-bim'
import { buildBosmansTaverniersCalculation, buildBosmansTaverniersProgressStatement, buildBosmansTaverniersProject } from './bosmans-taverniers-bim'
import { getBimProductionTestModel } from './bim-test-models'
import { buildDailyReportEvidence, buildMeetstaatEvidence } from './progress-measurements'
import { calculateContractPriceRevision, demoPriceIndexCatalogue } from './price-revision'
import { CHECKINATWORK_THRESHOLD, maskCheckinatworkIdentifier } from './checkinatwork'
import type { LidarArtifact, LidarBcfTopic, LidarControlPoint, LidarElementObservation, LidarScanInput } from './lidar-bim'

const STORAGE_KEY = 'bouwflow.mvp.v1'
const DEMO_DATA_VERSION_KEY = 'bouwflow.demo.version'
const DEMO_DATA_VERSION = '2026-08-enterprise-workspace-v16-bosmans-taverniers-bim'
const FORCE_DEMO_MODE = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('mode') === 'demo'
const API_URL = FORCE_DEMO_MODE ? undefined : import.meta.env.VITE_API_URL?.trim() as string | undefined

const demoDocumentBlob = (version: DocumentVersion) => {
  const safe = `${version.revisionLabel} - ${version.fileName}\n\n${version.notes || 'BouwFlow demonstratiedocument'}\n\nGeupload door ${version.uploadedBy}`.replace(/[^\x20-\x7e\n]/g, ' ')
  const lines = safe.split('\n').slice(0, 18).map((line, index) => `BT /F1 ${index === 0 ? 18 : 11} Tf 60 ${760 - index * 28} Td (${line.replace(/[()\\]/g, '\\$&')}) Tj ET`).join('\n')
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${lines.length} >>\nstream\n${lines}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((object, index) => { offsets.push(pdf.length); pdf += `${index + 1} 0 obj\n${object}\nendobj\n` })
  const xref = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return new Blob([pdf], { type: 'application/pdf' })
}

const demoActivity = (
  id: string,
  workPackageId: string | undefined,
  name: string,
  startDate: string,
  endDate: string,
  progress: number,
  predecessorIds: string[] = [],
  overrides: Partial<PlanningActivity> = {},
): PlanningActivity => ({
  id,
  workPackageId,
  name,
  startDate,
  endDate,
  progress,
  predecessorIds,
  dependencies: predecessorIds.map(predecessorId => ({ predecessorId, type: 'FS', lagDays: 0 })),
  milestone: false,
  responsible: 'Sofie Janssens',
  responsibleEmployeeId: 'employee-demo-sofie',
  crewSize: 5,
  weatherSensitive: false,
  resourceAssignments: [],
  baselineStartDate: startDate,
  baselineEndDate: endDate,
  ...overrides,
})

const demoEmployeeIdsByName: Record<string, string> = {
  'Sofie Janssens': 'employee-demo-sofie',
  'Lars Willems': 'employee-demo-lars',
  'Pieter Mertens': 'employee-demo-pieter',
  'Jan Peeters': 'employee-demo-jan',
}

const acceptedHandover = (manager: string, plannedStart: string, plannedEnd: string, risks: string[] = []): ProjectHandover => ({
  status: 'Aanvaard', projectManager: manager, projectManagerEmployeeId: demoEmployeeIdsByName[manager], plannedStart, plannedEnd, notes: 'Projectoverdracht afgerond; uitvoeringsteam en budget vrijgegeven.', risks,
  checklist: { scopeReviewed: true, budgetReviewed: true, contractReviewed: true, documentsTransferred: true, risksReviewed: true, kickoffPlanned: true },
  acceptedAt: '2026-06-12T09:00:00.000Z',
})

const demoProjects: Project[] = [
  {
    id: 'project-n72', number: 'PRJ-2026-001', name: 'Herinrichting N72 – fase 2', organizationId: 'org-awv', legalEntityId: 'entity-bouwflow', branchId: 'branch-hasselt', sourceCalculationId: 'calc-n72', contractValue: 4_100_000, costBudget: 3_650_000, marginPct: 11, progress: 62, status: 'Risico',
    handover: acceptedHandover('Sofie Janssens', '2026-07-20', '2027-01-31', ['Nutsleidingen in conflictzone', 'Verkeersfasering tijdens schoolperiode', 'Prijsrisico bitumen']),
    workPackages: [
      { id: 'wp-n72-1', code: '1', name: 'Voorbereiding & ontwerp', budget: 220_000, plannedHours: 2_150, status: 'Klaar voor planning' },
      { id: 'wp-n72-2', code: '2', name: 'Nutswerken', budget: 540_000, plannedHours: 4_300, status: 'Klaar voor planning' },
      { id: 'wp-n72-3', code: '3', name: 'Grondwerken', budget: 780_000, plannedHours: 8_400, status: 'Klaar voor planning' },
      { id: 'wp-n72-4', code: '4', name: 'Verhardingswerken', budget: 1_210_000, plannedHours: 9_100, status: 'Klaar voor planning' },
      { id: 'wp-n72-5', code: '5', name: 'Randafwerking & signalisatie', budget: 510_000, plannedHours: 4_250, status: 'Klaar voor planning' },
      { id: 'wp-n72-6', code: '6', name: 'Oplevering & nazorg', budget: 390_000, plannedHours: 2_300, status: 'Klaar voor planning' },
    ],
    planning: { status: 'Baseline', baselineVersion: 3, updatedAt: '2026-07-20T15:30:00.000Z', activities: [
      demoActivity('act-n72-11','wp-n72-1','Opstart & projectbriefing','2026-07-20','2026-07-24',100,[],{resourceAssignments:[{id:'ass-n72-sofie',employeeId:'employee-demo-sofie',resourceType:'Medewerker',resourceName:'Sofie Janssens',allocationPct:80}]}),
      demoActivity('act-n72-12','wp-n72-1','Inmeting & terreinonderzoek','2026-07-25','2026-08-07',100,['act-n72-11'],{responsible:'Lars Willems',responsibleEmployeeId:'employee-demo-lars'}),
      demoActivity('act-n72-21','wp-n72-2','Coördinatie nutsmaatschappijen','2026-08-08','2026-08-21',85,['act-n72-12']),
      demoActivity('act-n72-22','wp-n72-2','Verlegging kabels & leidingen','2026-08-22','2026-09-18',55,['act-n72-21'],{resourceAssignments:[{id:'ass-n72-utility',resourceType:'Onderaannemer',resourceName:'InfraLink Utilities',allocationPct:100,certificateExpiresOn:'2027-04-30'}]}),
      demoActivity('act-n72-31','wp-n72-3','Opbraak bestaande verharding','2026-09-19','2026-10-02',72,['act-n72-22'],{responsible:'Pieter Mertens',responsibleEmployeeId:'employee-demo-pieter',weatherSensitive:true,resourceAssignments:[{id:'ass-n72-crew1',crewId:'crew-ground-1',resourceType:'Ploeg',resourceName:'Grondwerken ploeg 1',allocationPct:100},{id:'ass-n72-crane',resourceType:'Materieel',resourceName:'Rupskraan 25 ton',allocationPct:100,certificateExpiresOn:'2027-03-31'}]}),
      demoActivity('act-n72-32','wp-n72-3','Uitgraving & grondverzet','2026-10-03','2026-10-30',48,['act-n72-31'],{responsible:'Pieter Mertens',responsibleEmployeeId:'employee-demo-pieter',weatherSensitive:true,resourceAssignments:[{id:'ass-n72-crew2',crewId:'crew-ground-1',resourceType:'Ploeg',resourceName:'Grondwerken ploeg 1',allocationPct:100},{id:'ass-n72-crane2',resourceType:'Materieel',resourceName:'Rupskraan 25 ton',allocationPct:100,certificateExpiresOn:'2027-03-31'}]}),
      demoActivity('act-n72-33','wp-n72-3','Aanleg fundering steenslag','2026-10-31','2026-11-20',25,['act-n72-32'],{weatherSensitive:true}),
      demoActivity('act-n72-41','wp-n72-4','Onderfundering en boordstenen','2026-11-21','2026-12-11',10,['act-n72-33'],{weatherSensitive:true}),
      demoActivity('act-n72-42','wp-n72-4','Asfaltlagen en aansluitingen','2026-12-12','2027-01-08',0,['act-n72-41'],{weatherSensitive:true,resourceAssignments:[{id:'ass-n72-asphalt',crewId:'crew-asphalt',resourceType:'Ploeg',resourceName:'Asfaltploeg',allocationPct:100}]}),
      demoActivity('act-n72-51','wp-n72-5','Markeringen & signalisatie','2027-01-09','2027-01-20',0,['act-n72-42']),
      demoActivity('act-n72-61','wp-n72-6','Vooroplevering en as-built','2027-01-21','2027-01-30',0,['act-n72-51']),
      demoActivity('act-n72-m1',undefined,'Mijlpaal · definitieve openstelling','2027-01-31','2027-01-31',0,['act-n72-61'],{milestone:true,crewSize:0}),
    ] },
  },
  {
    id: 'project-brightland', number: 'PRJ-2026-014', name: 'Brightland Logistics Park', organizationId: 'org-northgate', legalEntityId: 'entity-bouwflow', branchId: 'branch-genk-construct', sourceCalculationId: 'calc-brightland', contractValue: 18_700_000, costBudget: 17_100_000, marginPct: 8.6, progress: 56, status: 'Op schema',
    handover: acceptedHandover('Lars Willems','2026-04-06','2027-05-28',['Gefaseerde ingebruikname magazijnen']),
    workPackages: [{id:'wp-br-1',code:'1',name:'Grond- en rioleringswerken',budget:5_200_000,plannedHours:31_000,status:'Klaar voor planning'},{id:'wp-br-2',code:'2',name:'Industrievloeren & wegenis',budget:7_400_000,plannedHours:39_500,status:'Klaar voor planning'},{id:'wp-br-3',code:'3',name:'Omgevingsaanleg',budget:4_500_000,plannedHours:20_400,status:'Klaar voor planning'}],
    planning:{status:'Baseline',baselineVersion:2,updatedAt:'2026-07-19T11:00:00.000Z',activities:[demoActivity('act-br-1','wp-br-1','Hoofdriolering en bufferbekken','2026-04-06','2026-08-14',88,[],{responsible:'Lars Willems',responsibleEmployeeId:'employee-demo-lars'}),demoActivity('act-br-2','wp-br-2','Industrievloeren zone A–C','2026-08-17','2026-12-18',42,['act-br-1'],{responsible:'Lars Willems',responsibleEmployeeId:'employee-demo-lars'}),demoActivity('act-br-3','wp-br-2','Wegenis en laadkades','2026-11-02','2027-03-19',20,['act-br-1'],{weatherSensitive:true}),demoActivity('act-br-4','wp-br-3','Groenzones en oplevering','2027-03-22','2027-05-28',0,['act-br-2','act-br-3'])]},
  },
  {
    id:'project-kanaalkom',number:'PRJ-2026-018',name:'Kanaalkom Beringen',organizationId:'org-waterweg',legalEntityId:'entity-bouwflow',branchId:'branch-hasselt',sourceCalculationId:'calc-kanaalkom',contractValue:23_900_000,costBudget:22_850_000,marginPct:4.4,progress:15,status:'Risico',handover:acceptedHandover('Sofie Janssens','2026-06-01','2028-02-25',['Complexe grondwaterverlaging','Vergunningsvoorwaarde PFAS']),workPackages:[{id:'wp-ka-1',code:'1',name:'Bouwkuip en grondwerken',budget:9_800_000,plannedHours:58_000,status:'Klaar voor planning'},{id:'wp-ka-2',code:'2',name:'Kademuren',budget:8_250_000,plannedHours:41_000,status:'Klaar voor planning'},{id:'wp-ka-3',code:'3',name:'Publieke ruimte',budget:4_800_000,plannedHours:25_000,status:'Klaar voor planning'}],planning:{status:'Gewijzigd',baselineVersion:1,updatedAt:'2026-07-18T10:00:00.000Z',activities:[demoActivity('act-ka-1','wp-ka-1','Bemaling en bouwkuip','2026-06-01','2026-10-30',35,[],{responsible:'Sofie Janssens',responsibleEmployeeId:'employee-demo-sofie'}),demoActivity('act-ka-2','wp-ka-2','Diepwanden en verankering','2026-10-05','2027-05-28',8,['act-ka-1']),demoActivity('act-ka-3','wp-ka-2','Kademuur en deksteen','2027-05-31','2027-11-26',0,['act-ka-2']),demoActivity('act-ka-4','wp-ka-3','Publieke ruimte en groen','2027-11-29','2028-02-25',0,['act-ka-3'])]}},
  {
    id:'project-zna',number:'PRJ-2025-027',name:'ZNA Cadix – omgevingsaanleg',organizationId:'org-zna',legalEntityId:'entity-bouwflow',branchId:'branch-antwerpen',sourceCalculationId:'calc-zna',contractValue:26_300_000,costBudget:24_600_000,marginPct:6.5,progress:72,status:'Op schema',handover:acceptedHandover('Lars Willems','2025-09-01','2026-12-18'),workPackages:[{id:'wp-zna-1',code:'1',name:'Ondergrondse infrastructuur',budget:8_500_000,plannedHours:44_000,status:'Klaar voor planning'},{id:'wp-zna-2',code:'2',name:'Wegenis en pleinen',budget:10_600_000,plannedHours:53_000,status:'Klaar voor planning'},{id:'wp-zna-3',code:'3',name:'Groen en afwerking',budget:5_500_000,plannedHours:29_000,status:'Klaar voor planning'}],planning:{status:'Baseline',baselineVersion:4,updatedAt:'2026-07-17T16:00:00.000Z',activities:[demoActivity('act-zna-1','wp-zna-1','Ondergrondse infrastructuur','2025-09-01','2026-02-27',100),demoActivity('act-zna-2','wp-zna-2','Pleinen en toegangswegen','2026-03-02','2026-09-25',76,['act-zna-1']),demoActivity('act-zna-3','wp-zna-3','Groenaanleg en meubilair','2026-09-28','2026-12-18',10,['act-zna-2'])]}},
  {
    id:'project-wind',number:'PRJ-2025-031',name:'Windmolenpark Noordzee – civiele werken',organizationId:'org-northsea',legalEntityId:'entity-bouwflow',branchId:'branch-gent',sourceCalculationId:'calc-wind',contractValue:42_600_000,costBudget:39_100_000,marginPct:8.2,progress:61,status:'Op schema',handover:acceptedHandover('Lars Willems','2025-10-06','2027-03-26'),workPackages:[{id:'wp-wi-1',code:'1',name:'Onshore kabeltracé',budget:15_400_000,plannedHours:74_000,status:'Klaar voor planning'},{id:'wp-wi-2',code:'2',name:'Funderingen hoogspanningspost',budget:14_200_000,plannedHours:60_000,status:'Klaar voor planning'},{id:'wp-wi-3',code:'3',name:'Herstel en oplevering',budget:9_500_000,plannedHours:38_000,status:'Klaar voor planning'}],planning:{status:'Baseline',baselineVersion:2,updatedAt:'2026-07-16T08:30:00.000Z',activities:[demoActivity('act-wi-1','wp-wi-1','Gestuurde boringen kabeltracé','2025-10-06','2026-08-28',68,[],{weatherSensitive:true}),demoActivity('act-wi-2','wp-wi-2','Funderingen hoogspanningspost','2026-03-02','2026-11-27',55,[]),demoActivity('act-wi-3','wp-wi-3','Herstel tracé en oplevering','2026-11-30','2027-03-26',0,['act-wi-1','act-wi-2'])]}},
  {
    id:'project-student',number:'PRJ-2026-021',name:'Studententoren Leuven – buitenaanleg',organizationId:'org-leuven',legalEntityId:'entity-bouwflow',branchId:'branch-gent',sourceCalculationId:'calc-student',contractValue:17_600_000,costBudget:16_380_000,marginPct:6.9,progress:10,status:'Opstart',handover:acceptedHandover('Sofie Janssens','2026-07-06','2027-08-27'),workPackages:[{id:'wp-st-1',code:'1',name:'Riolerings- en grondwerken',budget:6_200_000,plannedHours:34_000,status:'Klaar voor planning'},{id:'wp-st-2',code:'2',name:'Buitenverhardingen',budget:6_900_000,plannedHours:36_000,status:'Klaar voor planning'},{id:'wp-st-3',code:'3',name:'Landschapsaanleg',budget:3_280_000,plannedHours:19_000,status:'Klaar voor planning'}],planning:{status:'Baseline',baselineVersion:1,updatedAt:'2026-07-15T13:00:00.000Z',activities:[demoActivity('act-st-1','wp-st-1','Bouwput en riolering','2026-07-06','2026-12-18',22),demoActivity('act-st-2','wp-st-2','Buitenverhardingen','2027-01-04','2027-05-28',0,['act-st-1']),demoActivity('act-st-3','wp-st-3','Groenaanleg en oplevering','2027-05-31','2027-08-27',0,['act-st-2'])]}},
  buildFamilyHomeBimProject(),
  buildBosmansTaverniersProject(),
]

const demoTenderChecklist = (completed: number, actor = 'Tenderteam') => [
  'Selectievoorwaarden gecontroleerd',
  'Verplichte documenten gekoppeld',
  'Open vragen beantwoord',
  'Calculatie intern goedgekeurd',
  'Offertedocument ondertekend',
  'Digitaal indieningskanaal getest',
].map((label, index) => ({
  id: `tender-check-${index + 1}`,
  label,
  required: true,
  completed: index < completed,
  ...(index < completed ? { completedAt: `2026-07-${String(18 + index).padStart(2, '0')}T09:00:00.000Z`, completedBy: actor } : {}),
}))

const demoTender = ({
  deadline,
  recognition,
  documents,
  completed = 0,
  status = 'Niet gestart',
  ownerEmployeeId,
  reviewerEmployeeId,
  submissionReference,
  questions = [],
  approved = false,
}: {
  deadline: string
  recognition: string
  documents: string[]
  completed?: number
  status?: NonNullable<TenderDossier['submissionPlan']>['status']
  ownerEmployeeId?: string
  reviewerEmployeeId?: string
  submissionReference?: string
  questions?: TenderDossier['questions']
  approved?: boolean
}): TenderDossier => ({
  procedureType: 'Openbaar',
  publicationDate: '2026-07-01',
  submissionDeadline: `${deadline}T10:00:00.000Z`,
  executionPeriod: 'Volgens bestek en goedgekeurde detailplanning',
  recognitionClass: 'Klasse 8',
  recognitionCategory: recognition,
  selectionConditions: [
    'Erkenning in de vereiste klasse en categorie',
    'VCA** en ISO 9001 geldig op indieningsdatum',
    'Minstens drie vergelijkbare referenties uit de voorbije vijf jaar',
    'Financiële draagkracht conform de selectieleidraad',
  ],
  awardCriteria: [
    { id: `award-${deadline}-price`, criterion: 'Prijs', weightPct: 55 },
    { id: `award-${deadline}-quality`, criterion: 'Plan van aanpak, fasering en hinderbeperking', weightPct: 35 },
    { id: `award-${deadline}-sustainability`, criterion: 'Duurzaamheid en circulariteit', weightPct: 10 },
  ],
  requiredDocumentIds: documents,
  questions,
  siteVisits: [{
    id: `visit-${deadline}`,
    scheduledAt: '2026-08-18T07:30:00.000Z',
    location: 'Projectsite en werfkeet opdrachtgever',
    mandatory: true,
    attendees: ['Sofie Janssens', 'Lars Willems'],
    notes: 'Aanmelden met identiteitskaart en PBM; aanwezigheidsattest opladen.',
  }],
  competitors: ['InfraBuild Group', 'RoadWorks Belgium', 'Civiel Partners'],
  deadlineWarningDays: [30, 14, 7, 2, 1],
  ...(approved ? { approvedBy: 'Tenderdirecteur', approvedAt: '2026-07-24T15:30:00.000Z' } : {}),
  submissionPlan: {
    ownerEmployeeId,
    reviewerEmployeeId,
    internalReviewAt: status === 'Niet gestart' ? undefined : '2026-08-18T09:00:00.000Z',
    finalizationAt: status === 'Niet gestart' ? undefined : '2026-08-24T12:00:00.000Z',
    submissionAt: status === 'Niet gestart' ? undefined : `${deadline}T08:30:00.000Z`,
    reminderDays: [30, 14, 7, 2, 1],
    status,
    checklist: demoTenderChecklist(completed),
    notes: status === 'Niet gestart' ? 'Stel de indieningsplanning op en wijs een eigenaar en reviewer toe.' : 'Dagelijkse stand-up in de laatste vijf werkdagen voor indiening.',
    submissionReference,
    ...(status === 'Ingediend' ? { submittedAt: `${deadline}T08:32:00.000Z`, submittedBy: 'Sofie Janssens' } : {}),
    updatedAt: '2026-07-27T08:00:00.000Z',
  },
  updatedAt: '2026-07-27T08:00:00.000Z',
})

const demoOpportunityDocument = (
  id: string,
  opportunityId: string,
  title: string,
  category: ProjectDocument['category'],
  fileName: string,
  status: ProjectDocument['status'] = 'Goedgekeurd',
): ProjectDocument => ({
  id,
  projectId: '',
  legalEntityId: 'entity-bouwflow',
  title,
  category,
  status,
  currentVersionId: `${id}-v1`,
  versions: [{
    id: `${id}-v1`,
    documentId: id,
    revision: 1,
    revisionLabel: 'R1',
    fileName,
    mimeType: 'application/pdf',
    sizeBytes: 1_840_000,
    notes: `Officieel tenderdocument gekoppeld aan ${opportunityId}.`,
    uploadedBy: 'Lotte De Clercq',
    createdAt: '2026-07-22T09:00:00.000Z',
  }],
  recipients: [],
  links: [{
    id: `link-${id}-${opportunityId}`,
    documentId: id,
    type: 'Opportuniteit',
    recordId: opportunityId,
    label: 'Tenderdossier',
    createdBy: 'Lotte De Clercq',
    createdAt: '2026-07-22T09:05:00.000Z',
  }],
  ...(status === 'Goedgekeurd' ? { approvedBy: 'Sofie Janssens', approvedAt: '2026-07-23T14:00:00.000Z' } : {}),
  createdAt: '2026-07-22T09:00:00.000Z',
})

const seed: BouwFlowState = {
  currentUserId: 'user-jurgen',
  companyUsers: [
    { id: 'user-jurgen', displayName: 'Jurgen Bosmans', email: 'jurgen@example.be', role: 'Administrator', status:'Actief', allLegalEntities: true, legalEntityIds: [], allProjects:true, projectIds:[] },
    { id: 'user-sofie', displayName: 'Sofie Janssens', email: 'sofie.janssens@example.be', role: 'Projectmanager', status:'Actief', employeeId:'employee-demo-sofie', allLegalEntities: false, legalEntityIds: ['entity-bouwflow'], allProjects:true, projectIds:[] },
    { id: 'user-elias', displayName: 'Elias Jacobs', email: 'elias@example.be', role: 'Financiële administratie', status:'Actief', allLegalEntities: false, legalEntityIds: ['entity-bouwflow'], allProjects:true, projectIds:[] },
    { id:'user-pieter-site',displayName:'Pieter Mertens',email:'pieter.mertens@example.be',role:'Werfleider',status:'Actief',employeeId:'employee-demo-pieter',allLegalEntities:false,legalEntityIds:['entity-bouwflow'],allProjects:false,projectIds:['project-n72','project-brightland'] },
    { id:'user-client-awv',displayName:'Peter Vrancken',email:'peter.vrancken@example.be',role:'Klant',status:'Uitgenodigd',organizationId:'org-awv',allLegalEntities:false,legalEntityIds:['entity-bouwflow'],allProjects:false,projectIds:['project-n72'] },
    { id:'user-sub-infralink',displayName:'Bart Jacobs',email:'bart.jacobs@infralink.example',role:'Onderaannemer',status:'Uitgenodigd',subcontractorId:'subcontractor-infralink',allLegalEntities:false,legalEntityIds:['entity-bouwflow'],allProjects:false,projectIds:['project-n72'] },
    { id:'user-supplier-asphalt',displayName:'Sven Maes',email:'sven.maes@asphaltco.example',role:'Leverancier',status:'Uitgenodigd',supplierId:'supplier-asphaltco',allLegalEntities:false,legalEntityIds:['entity-bouwflow'],allProjects:false,projectIds:['project-n72'] },
  ],
  workflowDefinitions: defaultWorkflowDefinitions,
  workflowCorrections: [],
  legalEntities: [
    { id: 'entity-bouwflow', name: 'BouwFlow Construct NV', vatNumber: 'BE0123456749', country: 'België', currency: 'EUR', active: true, invoicePrefix: 'BFC', nextInvoiceNumber: 1, defaultVatPct: 21, iban: 'BE68 5390 0754 7034', bic: 'KREDBEBB', paymentTermsDays: 30, addressLine: 'Industrieweg 42', postalCode: '3500', city: 'Hasselt', countryCode: 'BE', peppolEndpointId: '0123456749', peppolSchemeId: '0208', createdAt: todayIso() },
    { id: 'entity-services', name: 'BouwFlow Services NV', vatNumber: 'BE0555666775', country: 'België', currency: 'EUR', active: true, invoicePrefix: 'BFS', nextInvoiceNumber: 1, defaultVatPct: 21, iban: 'BE25 0012 3456 7890', bic: 'GEBABEBB', paymentTermsDays: 30, addressLine: 'Havenlaan 18', postalCode: '3600', city: 'Genk', countryCode: 'BE', peppolEndpointId: '0555666775', peppolSchemeId: '0208', createdAt: todayIso() },
  ],
  companyBranches: [
    { id: 'branch-hasselt', legalEntityId: 'entity-bouwflow', name: 'Hasselt', address: 'Industrieweg 42, 3500 Hasselt', country: 'België', createdAt: todayIso() },
    { id: 'branch-genk-construct', legalEntityId: 'entity-bouwflow', name: 'Genk', address: 'Logistieklaan 8, 3600 Genk', country: 'België', createdAt: todayIso() },
    { id: 'branch-antwerpen', legalEntityId: 'entity-bouwflow', name: 'Antwerpen', address: 'Noorderlaan 125, 2030 Antwerpen', country: 'België', createdAt: todayIso() },
    { id: 'branch-gent', legalEntityId: 'entity-bouwflow', name: 'Gent', address: 'Industriepark 31, 9052 Gent', country: 'België', createdAt: todayIso() },
    { id: 'branch-genk', legalEntityId: 'entity-services', name: 'Genk', address: 'Havenlaan 18, 3600 Genk', country: 'België', createdAt: todayIso() },
  ],
  organizations: [
    { id: 'org-awv', name: 'Agentschap Wegen en Verkeer', type: 'Overheid', contactName: 'Peter Vrancken', email: 'peter.vrancken@example.be', vatNumber: 'BE0200000043', addressLine: 'Koning Albert II-laan 20', postalCode: '1000', city: 'Brussel', countryCode: 'BE', peppolEndpointId: '0200000043', peppolSchemeId: '0208', activities:[{id:'crm-awv-1',type:'Afspraak',subject:'Tenderoverleg R1',startsAt:'2026-07-24T08:30:00.000Z',contactId:undefined,ownerEmployeeId:'employee-demo-sofie',status:'Gepland',notes:'Selectievoorwaarden en fasering bespreken.',createdBy:'Sofie Janssens',createdAt:'2026-07-18T09:00:00.000Z'},{id:'crm-awv-2',type:'E-mail',subject:'Nota verkeersfasering ontvangen',startsAt:'2026-07-18T13:10:00.000Z',status:'Voltooid',notes:'Aan tenderdossier gekoppeld.',createdBy:'Tenderteam',createdAt:'2026-07-18T13:15:00.000Z'}],relations:[{id:'org-rel-awv-urban',relatedOrganizationId:'org-urbanstudies',type:'Studiebureau',notes:'Ontwerppartner voor lopende infrastructuurdossiers.',createdAt:'2026-07-15T10:00:00.000Z'}] },
    { id: 'org-lantis', name: 'Lantis', type: 'Overheid', contactName: 'Projectteam Oosterweel (demo)', email: 'oosterweel@example.be', vatNumber: '', addressLine: 'Sint-Pietersvliet 7', postalCode: '2000', city: 'Antwerpen', countryCode: 'BE', peppolEndpointId: '', peppolSchemeId: '0208', roles: ['Klant','Opdrachtgever'], contacts: [{ id:'contact-lantis-demo',firstName:'Projectteam',lastName:'Oosterweel',jobTitle:'Demo-contact',department:'Rechteroever',email:'oosterweel@example.be',phone:'',mobile:'',isPrimary:true,active:true }] },
    { id: 'org-fluvius', name: 'Fluvius', type: 'Nutsbedrijf', contactName: 'Annelies Vermeulen', email: 'annelies.vermeulen@example.be', vatNumber: 'BE0200000142', addressLine: 'Brusselsesteenweg 199', postalCode: '9090', city: 'Melle', countryCode: 'BE', peppolEndpointId: '0200000142', peppolSchemeId: '0208' },
    { id: 'org-northgate', name: 'Northgate Logistics', type: 'Privaat', contactName: 'Marc De Smet', email: 'marc.desmet@example.be', vatNumber: 'BE0200000241', addressLine: 'Logistieklaan 12', postalCode: '3600', city: 'Genk', countryCode: 'BE', peppolEndpointId: '0200000241', peppolSchemeId: '0208' },
    { id: 'org-hasselt', name: 'Stad Hasselt', type: 'Overheid', contactName: 'Evelien Claes', email: 'evelien.claes@example.be', vatNumber: 'BE0200000340', addressLine: 'Limburgplein 1', postalCode: '3500', city: 'Hasselt', countryCode: 'BE', peppolEndpointId: '0200000340', peppolSchemeId: '0208' },
    { id: 'org-waterweg', name: 'De Vlaamse Waterweg', type: 'Overheid', contactName: 'Thomas Vervoort', email: 'thomas.vervoort@example.be', vatNumber: 'BE0216173309', addressLine: 'Havenstraat 44', postalCode: '3500', city: 'Hasselt', countryCode: 'BE', peppolEndpointId: '0216173309', peppolSchemeId: '0208' },
    { id: 'org-zna', name: 'Ziekenhuis aan de Stroom', type: 'Privaat', contactName: 'Leen Vermeiren', email: 'leen.vermeiren@example.be', vatNumber: 'BE0862382656', addressLine: 'Kempenstraat 100', postalCode: '2030', city: 'Antwerpen', countryCode: 'BE', peppolEndpointId: '0862382656', peppolSchemeId: '0208' },
    { id: 'org-northsea', name: 'NorthSea Energy Partners', type: 'Privaat', contactName: 'Koen Van Damme', email: 'koen.vandamme@example.be', vatNumber: 'BE0745678123', addressLine: 'Havenlaan 70', postalCode: '9000', city: 'Gent', countryCode: 'BE', peppolEndpointId: '0745678123', peppolSchemeId: '0208' },
    { id: 'org-leuven', name: 'KU Leuven Vastgoed', type: 'Privaat', contactName: 'Nele Goossens', email: 'nele.goossens@example.be', vatNumber: 'BE0419052173', addressLine: 'Oude Markt 13', postalCode: '3000', city: 'Leuven', countryCode: 'BE', peppolEndpointId: '0419052173', peppolSchemeId: '0208' },
    { id: 'org-asphaltco', name: 'AsphaltCo NV', type: 'Privaat', contactName: 'Sven Maes', email: 'sven.maes@asphaltco.example', vatNumber: 'BE0478123456', addressLine: 'Industriezone 18', postalCode: '3580', city: 'Beringen', countryCode: 'BE', peppolEndpointId: '0478123456', peppolSchemeId: '0208', roles: ['Leverancier'], contacts: [{ id:'contact-asphaltco-sven',firstName:'Sven',lastName:'Maes',jobTitle:'Key accountmanager',department:'Verkoop',email:'sven.maes@asphaltco.example',phone:'+32 11 55 40 20',mobile:'+32 475 44 18 02',isPrimary:true,active:true },{ id:'contact-asphaltco-sarah',firstName:'Sarah',lastName:'Lambrechts',jobTitle:'Planningcoördinator',department:'Logistiek',email:'sarah.lambrechts@asphaltco.example',phone:'+32 11 55 40 25',mobile:'',isPrimary:false,active:true }] },
    { id: 'org-infralink', name: 'InfraLink Utilities BV', type: 'Privaat', contactName: 'Bart Jacobs', email: 'bart.jacobs@infralink.example', vatNumber: 'BE0678456123', addressLine: 'Nutslaan 7', postalCode: '3600', city: 'Genk', countryCode: 'BE', peppolEndpointId: '0678456123', peppolSchemeId: '0208', roles: ['Onderaannemer','Partner'], contacts: [{ id:'contact-infralink-bart',firstName:'Bart',lastName:'Jacobs',jobTitle:'Projectdirecteur',department:'Uitvoering',email:'bart.jacobs@infralink.example',phone:'+32 89 22 14 60',mobile:'+32 476 88 10 41',isPrimary:true,active:true },{ id:'contact-infralink-nora',firstName:'Nora',lastName:'El Amrani',jobTitle:'Document controller',department:'QHSE',email:'nora.elamrani@infralink.example',phone:'+32 89 22 14 64',mobile:'',isPrimary:false,active:true }] },
    { id: 'org-urbanstudies', name: 'Urban Studies & Architecture', type: 'Privaat', contactName: 'Laura Peeters', email: 'laura.peeters@urbanstudies.example', vatNumber: 'BE0532123498', addressLine: 'Kunstlaan 31', postalCode: '1000', city: 'Brussel', countryCode: 'BE', peppolEndpointId: '0532123498', peppolSchemeId: '0208', roles: ['Architect','Studiebureau','Consultant'], contacts: [{ id:'contact-urban-laura',firstName:'Laura',lastName:'Peeters',jobTitle:'Projectarchitect',department:'Infrastructuur',email:'laura.peeters@urbanstudies.example',phone:'+32 2 410 18 90',mobile:'+32 471 24 09 18',isPrimary:true,active:true }] },
    { id: 'org-drainpro', name: 'DrainPro BV', type: 'Privaat', contactName: 'Kim Hermans', email: 'kim.hermans@drainpro.example', vatNumber: 'BE0723456198', addressLine: 'Rioleringstraat 12', postalCode: '3550', city: 'Heusden-Zolder', countryCode: 'BE', peppolEndpointId: '0723456198', peppolSchemeId: '0208', roles: ['Leverancier'], contacts: [{ id:'contact-drainpro-kim',firstName:'Kim',lastName:'Hermans',jobTitle:'Accountmanager',department:'Verkoop',email:'kim.hermans@drainpro.example',phone:'+32 11 61 22 90',mobile:'+32 474 70 11 25',isPrimary:true,active:true }] },
    { id: 'org-aquageo', name: 'AquaGeo NV', type: 'Privaat', contactName: 'Tine Verbeeck', email: 'tine.verbeeck@aquageo.example', vatNumber: 'BE0698765412', addressLine: 'Waterbouwlaan 9', postalCode: '2200', city: 'Herentals', countryCode: 'BE', peppolEndpointId: '0698765412', peppolSchemeId: '0208', roles: ['Onderaannemer','Studiebureau'], contacts: [{ id:'contact-aquageo-tine',firstName:'Tine',lastName:'Verbeeck',jobTitle:'Projectmanager bemaling',department:'Uitvoering',email:'tine.verbeeck@aquageo.example',phone:'+32 14 54 21 80',mobile:'+32 476 22 35 91',isPrimary:true,active:true }] },
    { id:'org-family-home-client', name:'Familie Vermeiren', type:'Privaat', contactName:'Tom en Sarah Vermeiren', email:'familie.vermeiren@demo.aifestival.be', vatNumber:'', addressLine:'Bosveldlaan 18', postalCode:'3550', city:'Heusden-Zolder', countryCode:'BE', peppolEndpointId:'', peppolSchemeId:'0208', roles:['Klant','Opdrachtgever'], contacts:[{id:'contact-family-home',firstName:'Tom en Sarah',lastName:'Vermeiren',jobTitle:'Bouwheer',department:'',email:'familie.vermeiren@demo.aifestival.be',phone:'',mobile:'+32 470 12 34 56',isPrimary:true,active:true}] },
    { id:'org-bosmans-taverniers', name:'Familie Bosmans-Taverniers', type:'Privaat', contactName:'Jurgen Bosmans', email:'jurgen.bosmans@bosis.be', vatNumber:'', addressLine:'', postalCode:'3550', city:'Heusden-Zolder', countryCode:'BE', peppolEndpointId:'', peppolSchemeId:'0208', roles:['Klant','Opdrachtgever'], contacts:[{id:'contact-bosmans-taverniers',firstName:'Jurgen',lastName:'Bosmans',jobTitle:'Bouwheer',department:'',email:'jurgen.bosmans@bosis.be',phone:'',mobile:'+32 478 73 01 51',isPrimary:true,active:true}] },
  ],
  opportunities: [
    { id: 'opp-n72', projectNumber: 'OPP-2026-041', title: 'Herinrichting N72 – fase 2', organizationId: 'org-awv', location: 'Limburg', deadline: '2026-07-24', estimatedValue: 4_100_000, probability: 100, stage: 'Gewonnen', recognition: 'C5', tender: demoTender({ deadline:'2026-07-24', recognition:'C5', documents:['document-n72-contract'], completed:6, status:'Ingediend', ownerEmployeeId:'employee-demo-sofie', reviewerEmployeeId:'employee-demo-lars', submissionReference:'E-PROC-2026-041-78421', approved:true }) },
    { id: 'opp-genk', projectNumber: 'OPP-2026-039', title: 'Nieuw distributiecentrum Genk-Zuid', organizationId: 'org-northgate', location: 'Genk', deadline: '2026-08-14', estimatedValue: 28_700_000, probability: 70, stage: 'Offerte verstuurd', recognition: 'D7', tender: demoTender({ deadline:'2026-08-14', recognition:'D7', documents:['document-genk-bestek'], completed:6, status:'Ingediend', ownerEmployeeId:'employee-demo-lars', reviewerEmployeeId:'employee-demo-sofie', submissionReference:'NG-DCG-2026-RFP-118', approved:true }) },
    { id: 'opp-beringen', projectNumber: 'OPP-2026-042', title: 'Rioleringsprogramma Beringen 2027', organizationId: 'org-fluvius', location: 'Beringen', deadline: '2026-08-28', estimatedValue: 14_900_000, probability: 35, stage: 'Go/No-Go', recognition: 'C1', tender: demoTender({ deadline:'2026-08-28', recognition:'C1', documents:['document-beringen-bestek'], completed:4, status:'Gepland', ownerEmployeeId:'employee-demo-sofie', reviewerEmployeeId:'employee-demo-lars' }) },
    { id: 'opp-ring', projectNumber: 'OWV-RO-DEMO', title: 'Oosterweelverbinding – Rechteroever (publiek project, demo-calculatie)', organizationId: 'org-lantis', location: 'Antwerpen – Rechteroever', deadline: '2026-09-18', estimatedValue: 875_000_000, probability: 45, stage: 'Calculatie', recognition: 'C – Klasse 8', tender: demoTender({ deadline:'2026-09-18', recognition:'C – Klasse 8', documents:['document-ring-selectie'], completed:3, status:'Gepland', ownerEmployeeId:'employee-demo-lars', reviewerEmployeeId:'employee-demo-sofie', questions:[{id:'question-ring-1',question:'Worden nachtvensters afzonderlijk vergoed?',askedOn:'2026-07-14',status:'Open'}], approved:true }) },
    { id: 'opp-waterfront', projectNumber: 'OPP-2026-049', title: 'Waterfront Hasselt – infrastructuur', organizationId: 'org-waterweg', location: 'Hasselt', deadline: '2026-10-02', estimatedValue: 34_900_000, probability: 60, stage: 'Gekwalificeerd', recognition: 'C', tender: demoTender({ deadline:'2026-10-02', recognition:'C', documents:['document-waterfront-leidraad'], completed:2, status:'Gepland', ownerEmployeeId:'employee-demo-sofie' }) },
    { id: 'opp-campus', projectNumber: 'OPP-2026-052', title: 'Campus Gasthuisberg mobiliteitslus', organizationId: 'org-leuven', location: 'Leuven', deadline: '2026-10-30', estimatedValue: 39_400_000, probability: 25, stage: 'Nieuw', recognition: 'C5', tender: demoTender({ deadline:'2026-10-30', recognition:'C5', documents:['document-campus-selectieleidraad','document-campus-meetstaat','document-campus-plannen'], completed:1, status:'Niet gestart', questions:[{id:'question-campus-1',question:'Welke fasen moeten tijdens de examenperiode volledig verkeersvrij blijven?',askedOn:'2026-07-24',status:'Open'}] }) },
    { id:'opp-family-home-bim', projectNumber:'OPP-WONING-BIM-001', title:'Gezinswoning Bosveld · BIM 3D/4D/5D', organizationId:'org-family-home-client', legalEntityId:'entity-bouwflow', branchId:'branch-hasselt', location:'Heusden-Zolder', deadline:'2026-08-21', estimatedValue:535_000, probability:100, stage:'Gewonnen', recognition:'Private woningbouw', tender:demoTender({deadline:'2026-08-21',recognition:'Private woningbouw',documents:[],completed:6,status:'Ingediend',ownerEmployeeId:'employee-demo-sofie',reviewerEmployeeId:'employee-demo-lars',submissionReference:'WON-BIM-2026-001',approved:true}) },
    { id:'opp-bosmans-taverniers', projectNumber:'OPP-BT-BA-001', title:'Woning Bosmans-Taverniers · DWG + meetstaat', organizationId:'org-bosmans-taverniers', legalEntityId:'entity-bouwflow', branchId:'branch-hasselt', location:'Bolderberg, Heusden-Zolder', deadline:'2026-08-31', estimatedValue:313_890.6276, probability:100, stage:'Gewonnen', recognition:'Private woningbouw', tender:demoTender({deadline:'2026-08-31',recognition:'Private woningbouw',documents:[],completed:4,status:'Gepland',ownerEmployeeId:'employee-demo-sofie',reviewerEmployeeId:'employee-demo-lars'}) },
  ],
  calculations: [
    buildOosterweelClass8DemoCalculation(),
    buildFamilyHomeBimCalculation(),
    buildBosmansTaverniersCalculation(),
    {
      id: 'calc-n72', number: 'CAL-2026-041', opportunityId: 'opp-n72', status: 'In opmaak', overheadPct: 8, riskPct: 3, marginPct: 10, updatedAt: todayIso(),
      chapters: [
        { id: 'chapter-01', code: '01', name: 'Opbraakwerken', sortOrder: 0 },
        { id: 'chapter-02', code: '02', name: 'Funderingen', sortOrder: 1 },
        { id: 'chapter-03', code: '03', name: 'Verhardingen', sortOrder: 2 },
      ],
      items: [
        { id: 'item-1', chapterId: 'chapter-01', code: '01.01', description: 'Opbraak bestaande verharding', quantity: 4200, unit: 'm²', labor: 2.8, material: 0, equipment: 3.4, subcontracting: 0 },
        { id: 'item-2', chapterId: 'chapter-02', code: '02.01', description: 'Fundering in steenslag', quantity: 3900, unit: 'm²', labor: 2.1, material: 12.6, equipment: 2.9, subcontracting: 0 },
        { id: 'item-3', chapterId: 'chapter-03', code: '03.01', description: 'Asfaltverharding tweelaags', quantity: 3650, unit: 'm²', labor: 1.8, material: 26.4, equipment: 4.2, subcontracting: 3.5 },
      ],
    },
    {
      id: 'calc-genk', number: 'CAL-2026-039', opportunityId: 'opp-genk', status: 'Offerte', overheadPct: 7.5, riskPct: 4, marginPct: 9.5, siteOverheadPct: 3, escalationPct: 1.5, discountPct: 0.5, updatedAt: '2026-07-25T15:20:00.000Z',
      chapters: [
        { id: 'chapter-genk-01', code: '01', name: 'Grond- en funderingswerken', sortOrder: 0 },
        { id: 'chapter-genk-02', code: '02', name: 'Riolering en afwatering', sortOrder: 1 },
        { id: 'chapter-genk-03', code: '03', name: 'Buitenverhardingen', sortOrder: 2 },
      ],
      items: [
        { id: 'item-genk-1', chapterId: 'chapter-genk-01', code: '01.01', description: 'Bouwrijp maken en grondverzet', quantity: 48500, unit: 'm³', labor: 1.15, material: 0.6, equipment: 2.85, subcontracting: 0, quantityType: 'Verrekenbaar' },
        { id: 'item-genk-2', chapterId: 'chapter-genk-01', code: '01.02', description: 'Fundering in gebroken steenslag type II', quantity: 31200, unit: 'm²', labor: 1.9, material: 13.1, equipment: 3.05, subcontracting: 0 },
        { id: 'item-genk-3', chapterId: 'chapter-genk-02', code: '02.01', description: 'RWA-leiding gewapend beton DN 800', quantity: 1280, unit: 'm', labor: 34, material: 112, equipment: 28, subcontracting: 9.5 },
        { id: 'item-genk-4', chapterId: 'chapter-genk-03', code: '03.01', description: 'Asfaltverharding logistieke rijwegen', quantity: 28600, unit: 'm²', labor: 1.7, material: 27.8, equipment: 4.1, subcontracting: 3.2 },
        { id: 'item-genk-5', chapterId: 'chapter-genk-03', code: '03.02', description: 'Betonverharding laadkades', quantity: 9400, unit: 'm²', labor: 8.4, material: 47.5, equipment: 6.3, subcontracting: 4.2 },
      ],
    },
    {
      id: 'calc-beringen', number: 'CAL-2026-042', opportunityId: 'opp-beringen', status: 'Review', overheadPct: 8.5, riskPct: 6, marginPct: 10, siteOverheadPct: 4, escalationPct: 2, discountPct: 0, updatedAt: '2026-07-26T10:45:00.000Z',
      chapters: [
        { id: 'chapter-beringen-01', code: '01', name: 'Voorbereiding en opbraak', sortOrder: 0 },
        { id: 'chapter-beringen-02', code: '02', name: 'Riolering', sortOrder: 1 },
        { id: 'chapter-beringen-03', code: '03', name: 'Wegenis en herstel', sortOrder: 2 },
      ],
      items: [
        { id: 'item-beringen-1', chapterId: 'chapter-beringen-01', code: '01.01', description: 'Opbraak bestaande verharding', quantity: 21800, unit: 'm²', labor: 3.05, material: 0, equipment: 3.75, subcontracting: 0 },
        { id: 'item-beringen-2', chapterId: 'chapter-beringen-02', code: '02.01', description: 'Riolering gres DN 400 inclusief sleuf', quantity: 6400, unit: 'm', labor: 41, material: 76, equipment: 24, subcontracting: 6.5, quantityType: 'Verrekenbaar' },
        { id: 'item-beringen-3', chapterId: 'chapter-beringen-02', code: '02.02', description: 'Inspectieput prefab beton Ø1200', quantity: 94, unit: 'st', labor: 185, material: 980, equipment: 240, subcontracting: 0 },
        { id: 'item-beringen-4', chapterId: 'chapter-beringen-03', code: '03.01', description: 'Asfaltverharding tweelaags', quantity: 19750, unit: 'm²', labor: 1.95, material: 27.1, equipment: 4.35, subcontracting: 3.65 },
      ],
    },
  ],
  calculationVersions: [],
  calculationScenarios: [
    { id: 'scenario-expected', calculationId: 'calc-n72', name: 'Verwacht', description: 'Meest waarschijnlijke uitvoering op basis van de huidige calculatie.', laborAdjustmentPct: 0, materialAdjustmentPct: 0, equipmentAdjustmentPct: 0, subcontractingAdjustmentPct: 0, overheadPct: 8, riskPct: 3, marginPct: 10, isSelected: true, updatedAt: todayIso() },
    { id: 'scenario-conservative', calculationId: 'calc-n72', name: 'Conservatief', description: 'Extra buffer voor productiviteit, marktprijzen en uitvoeringsrisico.', laborAdjustmentPct: 8, materialAdjustmentPct: 6, equipmentAdjustmentPct: 10, subcontractingAdjustmentPct: 5, overheadPct: 8, riskPct: 7, marginPct: 10, isSelected: false, updatedAt: todayIso() },
    { id: 'scenario-optimistic', calculationId: 'calc-n72', name: 'Optimistisch', description: 'Gunstige productiviteit, inkoop en materieelinzet.', laborAdjustmentPct: -5, materialAdjustmentPct: -3, equipmentAdjustmentPct: -5, subcontractingAdjustmentPct: 0, overheadPct: 7, riskPct: 1, marginPct: 10, isSelected: false, updatedAt: todayIso() },
  ],
  costLibraries: [
    { id: DEFAULT_COST_LIBRARY_ID, name: 'Centrale kostendatabank', description: 'Gevalideerde normen, leveranciersprijzen en historische kostprijzen voor de hele groep.', active: true, createdAt: todayIso() },
    { id: 'cost-library-roads', name: 'Wegenbouw en asfalt', description: 'Productienormen en marktprijzen voor wegenisprojecten.', active: true, legalEntityId: 'entity-bouwflow', createdAt: '2026-03-01T09:00:00.000Z' },
    { id: 'cost-library-antwerp', name: 'Regioprijzen Antwerpen', description: 'Leveranciers- en onderaannemersprijzen voor de vestiging Antwerpen.', active: true, legalEntityId: 'entity-bouwflow', branchId: 'branch-antwerpen', createdAt: '2026-05-12T09:00:00.000Z' },
  ],
  costLibraryVersions: [
    { id: 'cost-version-central-2025', libraryId: DEFAULT_COST_LIBRARY_ID, version: 1, label: 'Prijsniveau 2025', status: 'Gearchiveerd', effectiveFrom: '2025-01-01', createdAt: '2025-01-05T09:00:00.000Z' },
    { id: DEFAULT_COST_LIBRARY_VERSION_ID, libraryId: DEFAULT_COST_LIBRARY_ID, version: 2, label: 'Basisprijzen 2026', status: 'Gepubliceerd', effectiveFrom: '2026-01-01', createdAt: todayIso() },
    { id: 'cost-version-central-2027', libraryId: DEFAULT_COST_LIBRARY_ID, version: 3, label: 'Budgetprijzen 2027', status: 'Concept', effectiveFrom: '2027-01-01', createdAt: '2026-07-24T09:00:00.000Z' },
    { id: 'cost-version-roads-2026', libraryId: 'cost-library-roads', version: 1, label: 'Wegenbouw Q3 2026', status: 'Gepubliceerd', effectiveFrom: '2026-07-01', createdAt: '2026-07-01T09:00:00.000Z' },
    { id: 'cost-version-antwerp-2026', libraryId: 'cost-library-antwerp', version: 1, label: 'Regio Antwerpen juli 2026', status: 'Gepubliceerd', effectiveFrom: '2026-07-01', createdAt: '2026-07-03T09:00:00.000Z' },
  ],
  costLibrary: [
    { id: 'cost-labor-1', libraryVersionId: DEFAULT_COST_LIBRARY_VERSION_ID, code: 'ARB-001', name: 'Grondwerker', category: 'labor', unit: 'uur', unitCost: 46, source: 'Interne uurkost 2026', updatedAt: todayIso() },
    { id: 'cost-labor-2', libraryVersionId: DEFAULT_COST_LIBRARY_VERSION_ID, code: 'ARB-002', name: 'Ploegbaas', category: 'labor', unit: 'uur', unitCost: 58, source: 'Interne uurkost 2026', updatedAt: todayIso() },
    { id: 'cost-material-1', libraryVersionId: DEFAULT_COST_LIBRARY_VERSION_ID, code: 'MAT-001', name: 'Steenslag type II', category: 'material', unit: 'ton', unitCost: 24.5, source: 'Raamcontract groeve', updatedAt: todayIso() },
    { id: 'cost-material-2', libraryVersionId: DEFAULT_COST_LIBRARY_VERSION_ID, code: 'MAT-002', name: 'Asfalt AB-4C', category: 'material', unit: 'ton', unitCost: 91, source: 'Leveranciersprijs juli 2026', updatedAt: todayIso() },
    { id: 'cost-equipment-1', libraryVersionId: DEFAULT_COST_LIBRARY_VERSION_ID, code: 'MCH-001', name: 'Rupskraan 25 ton', category: 'equipment', unit: 'uur', unitCost: 84, source: 'Intern materieeltarief', updatedAt: todayIso() },
    { id: 'cost-subcontracting-1', libraryVersionId: DEFAULT_COST_LIBRARY_VERSION_ID, code: 'OND-001', name: 'Markeringen', category: 'subcontracting', unit: 'm²', unitCost: 7.5, source: 'Historische onderaannemersprijs', updatedAt: todayIso() },
    { id: 'cost-central-draft-1', libraryVersionId: 'cost-version-central-2027', code: 'ARB-001', name: 'Grondwerker', category: 'labor', unit: 'uur', unitCost: 48.5, source: 'HR-budget 2027', updatedAt: '2026-07-24T09:00:00.000Z' },
    { id: 'cost-central-draft-2', libraryVersionId: 'cost-version-central-2027', code: 'MAT-002', name: 'Asfalt AB-4C', category: 'material', unit: 'ton', unitCost: 95.25, source: 'Indexprognose 2027', updatedAt: '2026-07-24T09:00:00.000Z' },
    { id: 'cost-roads-1', libraryVersionId: 'cost-version-roads-2026', code: 'WEG-001', name: 'Asfaltploeg finisher 8 meter', category: 'labor', unit: 'uur', unitCost: 486, source: 'Interne productienorm Q3', updatedAt: '2026-07-21T08:00:00.000Z' },
    { id: 'cost-roads-2', libraryVersionId: 'cost-version-roads-2026', code: 'WEG-002', name: 'Asfalt AB-4C geleverd op werf', category: 'material', unit: 'ton', unitCost: 94.8, source: 'Raamcontract AsphaltCo', updatedAt: '2026-07-22T08:00:00.000Z' },
    { id: 'cost-roads-3', libraryVersionId: 'cost-version-roads-2026', code: 'WMC-004', name: 'Asfaltafwerkmachine 8 meter', category: 'equipment', unit: 'uur', unitCost: 214, source: 'BouwFlow Services tarief', updatedAt: '2026-07-21T08:00:00.000Z' },
    { id: 'cost-antwerp-1', libraryVersionId: 'cost-version-antwerp-2026', code: 'ANT-MAT-01', name: 'Steenslag type II Antwerpen', category: 'material', unit: 'ton', unitCost: 26.15, source: 'Groeve Noord · offerte 26-071', updatedAt: '2026-07-18T08:00:00.000Z' },
    { id: 'cost-antwerp-2', libraryVersionId: 'cost-version-antwerp-2026', code: 'ANT-OND-03', name: 'Nachtmarkeringen autosnelweg', category: 'subcontracting', unit: 'm²', unitCost: 11.85, source: 'RoadMark NV · tenderprijs', updatedAt: '2026-07-20T08:00:00.000Z' },
  ],
  units: [
    { id: 'unit-st', code: 'st', name: 'Stuk', category: 'Aantal', active: true, createdAt: todayIso() },
    { id: 'unit-gp', code: 'GP', name: 'Globale prijs', category: 'Globaal', active: true, createdAt: todayIso() },
    { id: 'unit-m', code: 'm', name: 'Meter', category: 'Lengte', active: true, createdAt: todayIso() },
    { id: 'unit-km', code: 'km', name: 'Kilometer', category: 'Lengte', active: true, createdAt: todayIso() },
    { id: 'unit-m2', code: 'm²', name: 'Vierkante meter', category: 'Oppervlakte', active: true, createdAt: todayIso() },
    { id: 'unit-m3', code: 'm³', name: 'Kubieke meter', category: 'Volume', active: true, createdAt: todayIso() },
    { id: 'unit-kg', code: 'kg', name: 'Kilogram', category: 'Massa', active: true, createdAt: todayIso() },
    { id: 'unit-ton', code: 'ton', name: 'Ton', category: 'Massa', active: true, createdAt: todayIso() },
    { id: 'unit-uur', code: 'uur', name: 'Uur', category: 'Tijd', active: true, createdAt: todayIso() },
    { id: 'unit-dag', code: 'dag', name: 'Dag', category: 'Tijd', active: true, createdAt: todayIso() },
  ],
  unitConversions: [
    { id: 'conversion-km-m', fromUnitId: 'unit-km', toUnitId: 'unit-m', factor: 1000, createdAt: todayIso() },
    { id: 'conversion-ton-kg', fromUnitId: 'unit-ton', toUnitId: 'unit-kg', factor: 1000, createdAt: todayIso() },
    { id: 'conversion-dag-uur', fromUnitId: 'unit-dag', toUnitId: 'unit-uur', factor: 8, createdAt: todayIso() },
  ],
  quotes: [],
  projects: demoProjects,
  dailyReports: [
    { id:'report-n72-1',projectId:'project-n72',date:'2026-07-20',workPackageId:'wp-n72-1',weather:'Droog',temperature:23,activities:'Projectopstart, werfinrichting en veiligheidsbriefing.',laborEntries:[{id:'labor-r1-1',employeeId:'employee-demo-sofie',employeeName:'Sofie Janssens',role:'Projectmanager',hours:8,overtimeHours:0},{id:'labor-r1-2',employeeId:'employee-demo-pieter',employeeName:'Pieter Mertens',role:'Werfleider',hours:8,overtimeHours:0}],subcontractors:[],materials:[{id:'mat-r1-1',description:'Signalisatiemateriaal',quantity:1,unit:'lot'}],machines:[{id:'mch-r1-1',description:'Bestelwagen werfleiding',quantity:1,unit:'dag'}],deliveries:'Werfkeet en signalisatie geleverd.',delays:'',problems:'Conflictpunt met bestaande telecomleiding vastgesteld.',visitors:'Opdrachtgever AWV en veiligheidscoördinator.',notes:'Startvergadering positief verlopen.',status:'Ondertekend',createdAt:'2026-07-20T17:15:00.000Z',submittedAt:'2026-07-20T17:30:00.000Z',signedBy:'Peter Vrancken',signedAt:'2026-07-21T08:10:00.000Z' },
    { id:'report-n72-2',projectId:'project-n72',date:'2026-07-21',workPackageId:'wp-n72-1',weather:'Wisselvallig',temperature:19,activities:'Inmeting segment B en controle referentiepunten.',laborEntries:[{id:'labor-r2-1',employeeId:'employee-demo-lars',employeeName:'Lars Willems',role:'Landmeter',hours:8,overtimeHours:0},{id:'labor-r2-2',employeeId:'employee-demo-jan',employeeName:'Jan Peeters',role:'Grondwerker',hours:8,overtimeHours:1}],subcontractors:['GeoMetrics NV'],materials:[{id:'mat-r2-1',description:'Meetnagels',quantity:24,unit:'st'}],machines:[{id:'mch-r2-1',description:'Totaalstation',quantity:1,unit:'dag'}],deliveries:'Geen.',delays:'45 minuten door regenbui.',problems:'Twee referentiepunten wijken af van plan.',visitors:'Studiebureau Arcadis.',notes:'Nieuwe coördinaten ter goedkeuring doorgestuurd.',status:'Ingediend',createdAt:'2026-07-21T16:55:00.000Z',submittedAt:'2026-07-21T17:05:00.000Z' },
    { id:'report-br-1',projectId:'project-brightland',date:'2026-07-21',workPackageId:'wp-br-1',weather:'Droog',temperature:24,activities:'Plaatsing inspectieputten en aanvulling sleuf.',laborEntries:[{id:'labor-br-1',employeeId:'employee-demo-pieter',employeeName:'Pieter Mertens',role:'Werfleider',hours:9,overtimeHours:1}],subcontractors:['DrainPro BV'],materials:[{id:'mat-br-1',description:'Inspectieput Ø1200',quantity:3,unit:'st'}],machines:[{id:'mch-br-1',description:'Rupskraan 25 ton',quantity:9,unit:'uur'}],deliveries:'Drie inspectieputten ontvangen en gecontroleerd.',delays:'',problems:'',visitors:'Kwaliteitscontrole opdrachtgever.',notes:'Productie volgens dagplanning.',status:'Ondertekend',createdAt:'2026-07-21T17:00:00.000Z',submittedAt:'2026-07-21T17:10:00.000Z',signedBy:'Marc De Smet',signedAt:'2026-07-22T07:45:00.000Z' },
  ],
  sitePhotos: [
    {id:'photo-n72-1',projectId:'project-n72',dailyReportId:'report-n72-1',workPackageId:'wp-n72-1',fileName:'werfopstart-n72.jpg',mimeType:'image/jpeg',sizeBytes:842000,caption:'Werfinrichting en signalisatie fase 2',location:'N72 kmpt 14.2',takenAt:'2026-07-20T10:15:00.000Z',createdAt:'2026-07-20T10:20:00.000Z'},
    {id:'photo-n72-2',projectId:'project-n72',dailyReportId:'report-n72-2',workPackageId:'wp-n72-1',fileName:'inmeting-segment-b.jpg',mimeType:'image/jpeg',sizeBytes:760000,caption:'Inmeting referentiepunten segment B',location:'N72 segment B',takenAt:'2026-07-21T09:42:00.000Z',createdAt:'2026-07-21T09:48:00.000Z'},
    {id:'photo-n72-3',projectId:'project-n72',dailyReportId:'report-n72-2',workPackageId:'wp-n72-1',fileName:'telecom-conflict.jpg',mimeType:'image/jpeg',sizeBytes:915000,caption:'Bestaande telecomleiding in conflictzone',location:'N72 kruispunt 3',takenAt:'2026-07-21T13:05:00.000Z',createdAt:'2026-07-21T13:10:00.000Z'},
    {id:'photo-br-1',projectId:'project-brightland',dailyReportId:'report-br-1',workPackageId:'wp-br-1',fileName:'inspectieputten-zone-c.jpg',mimeType:'image/jpeg',sizeBytes:990000,caption:'Plaatsing inspectieputten zone C',location:'Brightland zone C',takenAt:'2026-07-21T11:47:00.000Z',createdAt:'2026-07-21T11:52:00.000Z'},
  ],
  changeOrders: [
    {id:'change-n72-1',number:'MW-015',projectId:'project-n72',dailyReportId:'report-n72-1',workPackageId:'wp-n72-2',date:'2026-07-20',cause:'Onvoorziene bestaande toestand',description:'Aanpassing kolkaansluitingen door afwijkende nutsdata',initiator:'Werfleiding',responsibleParty:'Opdrachtgever',scheduleImpactDays:2,costs:{labor:6200,material:8400,equipment:2250,transport:600,subcontracting:1000,other:0},total:18450,photoIds:['photo-n72-3'],status:'Ter goedkeuring',createdAt:'2026-07-20T14:00:00.000Z',calculatedAt:'2026-07-21T09:00:00.000Z',submittedAt:'2026-07-21T15:00:00.000Z'},
    {id:'change-n72-2',number:'MW-014',projectId:'project-n72',workPackageId:'wp-n72-3',date:'2026-07-16',cause:'Technische optimalisatie',description:'Extra funderingslaag thv km 12.400',initiator:'Studiebureau',responsibleParty:'Opdrachtgever',scheduleImpactDays:1,costs:{labor:4860,material:16200,equipment:5100,transport:1700,subcontracting:0,other:0},total:27860,photoIds:[],status:'Goedgekeurd',createdAt:'2026-07-16T10:00:00.000Z',calculatedAt:'2026-07-17T10:00:00.000Z',submittedAt:'2026-07-17T14:00:00.000Z',approvedBy:'Peter Vrancken',approvedAt:'2026-07-19T09:00:00.000Z'},
    {id:'change-n72-3',number:'MW-013',projectId:'project-n72',workPackageId:'wp-n72-5',date:'2026-07-12',cause:'Wijziging opdrachtgever',description:'Verplaatsen lichtmast LM-23',initiator:'Opdrachtgever',responsibleParty:'Opdrachtgever',scheduleImpactDays:0,costs:{labor:1250,material:1800,equipment:900,transport:300,subcontracting:700,other:0},total:4950,photoIds:[],status:'Goedgekeurd',createdAt:'2026-07-12T10:00:00.000Z',approvedBy:'Peter Vrancken',approvedAt:'2026-07-13T12:00:00.000Z'},
    {id:'change-ka-1',number:'MW-004',projectId:'project-kanaalkom',workPackageId:'wp-ka-1',date:'2026-07-10',cause:'Onvoorziene bodemgesteldheid',description:'Aanvullende waterzuivering bemalingswater',initiator:'Werfleiding',responsibleParty:'In onderzoek',scheduleImpactDays:15,costs:{labor:32000,material:74000,equipment:91000,transport:12000,subcontracting:165000,other:18000},total:392000,photoIds:[],status:'Ter goedkeuring',createdAt:'2026-07-10T09:00:00.000Z',calculatedAt:'2026-07-14T11:00:00.000Z',submittedAt:'2026-07-15T16:00:00.000Z'},
  ],
  progressStatements: [buildBosmansTaverniersProgressStatement(), buildFamilyHomeBimProgressStatement(), {
    id:'progress-n72-2026-07',number:'VS-2026-07-001',projectId:'project-n72',periodStart:'2026-07-01',periodEnd:'2026-07-31',
    lines:[
      {workPackageId:'wp-n72-1',workPackageCode:'1',workPackageName:'Voorbereiding & ontwerp',cumulativeProgressPct:100,contractValue:247123,previousCumulative:0,currentPeriod:247123,cumulativeValue:247123},
      {workPackageId:'wp-n72-2',workPackageCode:'2',workPackageName:'Nutswerken',cumulativeProgressPct:85,contractValue:606575,previousCumulative:0,currentPeriod:515589,cumulativeValue:515589},
      {workPackageId:'wp-n72-3',workPackageCode:'3',workPackageName:'Grondwerken',cumulativeProgressPct:72,contractValue:876164,previousCumulative:0,currentPeriod:630838,cumulativeValue:630838,measurementMethod:'BIM',measuredQuantity:22320,unit:'m³',comment:'24 grondwerkzones gecontroleerd tegen IFC4.3 en terreinmeting.',bimEvidence:{modelId:'road-junction',modelName:'Knoop-E314-IFC43.ifc',modelVersion:'ROAD-AFC-21 · 2026-07-31',discipline:'Infrastructuur',elementIds:Array.from({length:24},(_,index)=>`earth-${String(index+1).padStart(3,'0')}`),elementCount:24,measuredQuantity:31000,verifiedQuantity:22320,unit:'m³',completionPct:72,measuredAt:'2026-07-31T08:15:00.000Z',measuredBy:'Lotte De Clercq',status:'Gecontroleerd',clashFree:true,notes:'Alignments, terreinsurvey en hoeveelheden gevalideerd in CDE.'}},
      {workPackageId:'wp-n72-4',workPackageCode:'4',workPackageName:'Verhardingswerken',cumulativeProgressPct:10,contractValue:1359178,previousCumulative:0,currentPeriod:135918,cumulativeValue:135918,measurementMethod:'BIM',measuredQuantity:1780,unit:'m²',comment:'4 verhardingsvakken visueel en landmeetkundig bevestigd.',bimEvidence:{modelId:'road-junction',modelName:'Knoop-E314-IFC43.ifc',modelVersion:'ROAD-AFC-21 · 2026-07-31',discipline:'Infrastructuur',elementIds:['pave-001','pave-002','pave-003','pave-004'],elementCount:4,measuredQuantity:17800,verifiedQuantity:1780,unit:'m²',completionPct:10,measuredAt:'2026-07-31T08:45:00.000Z',measuredBy:'Lotte De Clercq',status:'Gecontroleerd',clashFree:true,notes:'Vakken gekoppeld aan as-built terreinmeting.'}},
      {workPackageId:'wp-n72-5',workPackageCode:'5',workPackageName:'Randafwerking & signalisatie',cumulativeProgressPct:0,contractValue:572877,previousCumulative:0,currentPeriod:0,cumulativeValue:0},
      {workPackageId:'wp-n72-6',workPackageCode:'6',workPackageName:'Oplevering & nazorg',cumulativeProgressPct:0,contractValue:438083,previousCumulative:0,currentPeriod:0,cumulativeValue:0},
    ],
    changeOrderIds:['change-n72-2'],workAmount:1529468,changeOrderAmount:27860,priceRevisionAmount:21500,grossAmount:1578828,retentionPct:5,retentionAmount:78941.4,netAmount:1499886.6,status:'Factuurconcept',notes:'Eerste cumulatieve vorderingsstaat; meetbladen, BIM-meetbewijzen en goedgekeurd meerwerk MW-014 toegevoegd.',valuationDate:'2026-07-31',dueDate:'2026-09-01',certificateReference:'CERT-AWV-LIM-2026-07-01',preparedBy:'Sofie Janssens',revisionFormula:'Formule I-2021 · lonen, materialen en brandstoffen · index juli 2026',advancePaymentAmount:0,advanceRecoveryAmount:0,otherDeductionsAmount:0,evidenceDocumentIds:['document-n72-report'],qualityChecklist:{measurementsVerified:true,evidenceComplete:true,changesApproved:true,bimModelValidated:true},createdAt:'2026-07-31T09:00:00.000Z',submittedAt:'2026-07-31T10:00:00.000Z',approvedBy:'Peter Vrancken',approvedAt:'2026-08-02T09:15:00.000Z',invoiceId:'invoice-n72-2026-07'
  }],
  salesInvoices: [{
    id:'invoice-n72-2026-07',number:'BFC-2026-0001',legalEntityId:'entity-bouwflow',projectId:'project-n72',progressStatementId:'progress-n72-2026-07',invoiceDate:'2026-08-02',dueDate:'2026-09-01',subtotal:1499886.6,vatPct:21,vatAmount:314976.19,total:1814862.79,status:'Openstaand',issuedAt:'2026-08-02T10:00:00.000Z',issuedBy:'Elias Jacobs',createdAt:'2026-08-02T09:45:00.000Z'
  }],
  peppolValidationReports: [],
  peppolDeliveries: [],
  peppolAlerts: [],
  peppolNotifications: [],
  peppolAcceptanceRuns: [],
  peppolNotificationSettings: { emailRecipients: [], teamsTargets: [], criticalSlaMinutes: 15, connectorConfigured: false, connectorProvider: 'Niet geconfigureerd', connectorChannels: [], integrationChecks: [], productionGate: { released: false } },
  intercompanyCharges: [{ id: 'ic-demo-1', number: 'IC-2026-0001', fromLegalEntityId: 'entity-services', toLegalEntityId: 'entity-bouwflow', description: 'Machine- en werkplaatsdiensten juni', baseAmount: 4200, markupPct: 5, totalAmount: 4410, status: 'Concept', createdAt: todayIso() }],
  projectCosts: [
    {id:'cost-n72-1',projectId:'project-n72',workPackageId:'wp-n72-1',date:'2026-07-20',type:'Werkelijke kost',category:'labor',description:'Projectleiding en werfopstart',supplier:'Interne uren',amount:146000,reference:'UREN-2026-07',status:'Geboekt',createdAt:'2026-07-20T18:00:00.000Z'},
    {id:'cost-n72-2',projectId:'project-n72',workPackageId:'wp-n72-2',date:'2026-07-20',type:'Werkelijke kost',category:'subcontracting',description:'Voorbereidende nutscoördinatie',supplier:'InfraLink Utilities',amount:312000,reference:'OND-IL-014',status:'Geboekt',createdAt:'2026-07-20T18:00:00.000Z'},
    {id:'cost-n72-3',projectId:'project-n72',workPackageId:'wp-n72-3',date:'2026-07-20',type:'Werkelijke kost',category:'equipment',description:'Materieelinzet grondwerken',supplier:'BouwFlow Services NV',amount:268500,reference:'IC-2026-071',status:'Geboekt',createdAt:'2026-07-20T18:00:00.000Z'},
    {id:'cost-n72-4',projectId:'project-n72',workPackageId:'wp-n72-4',date:'2026-07-21',type:'Verplichting',category:'material',description:'Asfalt raamcontract fase 2',supplier:'AsphaltCo NV',amount:742000,reference:'PO-2026-0184',status:'Open',createdAt:'2026-07-21T10:00:00.000Z'},
    {id:'cost-br-1',projectId:'project-brightland',workPackageId:'wp-br-1',date:'2026-07-21',type:'Werkelijke kost',category:'material',description:'Rioleringsmaterialen en putten',supplier:'DrainPro BV',amount:3_250_000,reference:'KST-BR-Q2',status:'Geboekt',createdAt:'2026-07-21T12:00:00.000Z'},
    {id:'cost-br-2',projectId:'project-brightland',workPackageId:'wp-br-2',date:'2026-07-21',type:'Werkelijke kost',category:'labor',description:'Eigen uitvoering wegenis',supplier:'Interne uren',amount:2_180_000,reference:'UREN-BR-Q2',status:'Geboekt',createdAt:'2026-07-21T12:00:00.000Z'},
    {id:'cost-ka-1',projectId:'project-kanaalkom',workPackageId:'wp-ka-1',date:'2026-07-21',type:'Werkelijke kost',category:'subcontracting',description:'Bemaling en waterzuivering',supplier:'AquaGeo NV',amount:2_940_000,reference:'KST-KA-Q2',status:'Geboekt',createdAt:'2026-07-21T12:00:00.000Z'},
  ],
  projectForecasts: [],
  suppliers: [{ id:'supplier-asphaltco',organizationId:'org-asphaltco',name:'AsphaltCo NV',vatNumber:'BE0478123456',contactName:'Sven Maes',email:'sven.maes@asphaltco.example',paymentTerms:'30 dagen einde maand',rating:4.6,createdAt:todayIso() }],
  procurementRequests: [{id:'procurement-demo-1',number:'INK-2026-0042',projectId:'project-n72',workPackageId:'wp-n72-4',invitedSupplierIds:['supplier-asphaltco'],category:'material',requestedBy:'Sofie Janssens',neededBy:'2026-08-12',description:'Asfaltmengsels fase 2 en voegvulling',items:[{id:'proc-item-1',description:'AB-4C asfalt toplaag',quantity:1850,unit:'ton',targetUnitPrice:94},{id:'proc-item-2',description:'Bitumineuze voegvulling',quantity:420,unit:'m',targetUnitPrice:12.5}],status:'Prijsaanvraag',quotes:[],createdAt:'2026-07-20T09:00:00.000Z'}],
  purchaseOrders: [{id:'order-demo-1',number:'PO-2026-0184',procurementRequestId:'procurement-legacy-1',projectId:'project-n72',supplierId:'supplier-asphaltco',orderDate:'2026-07-14',expectedDeliveryDate:'2026-08-03',amount:742000,status:'Besteld',commitmentCostId:'cost-n72-4',createdAt:'2026-07-14T10:00:00.000Z'}],
  documents: [
    demoOpportunityDocument('document-campus-selectieleidraad','opp-campus','Selectieleidraad mobiliteitslus Gasthuisberg','Bestek','OPP-2026-052-selectieleidraad.pdf'),
    demoOpportunityDocument('document-campus-meetstaat','opp-campus','Meetstaat mobiliteitslus Gasthuisberg','Meetstaat','OPP-2026-052-meetstaat.pdf','Ter goedkeuring'),
    demoOpportunityDocument('document-campus-plannen','opp-campus','Faseringsplannen campus en toegangswegen','Plan','OPP-2026-052-faseringsplannen.pdf'),
    demoOpportunityDocument('document-genk-bestek','opp-genk','RFP distributiecentrum Genk-Zuid','Bestek','OPP-2026-039-RFP.pdf'),
    demoOpportunityDocument('document-beringen-bestek','opp-beringen','Bestek rioleringsprogramma Beringen 2027','Bestek','OPP-2026-042-bestek.pdf'),
    demoOpportunityDocument('document-ring-selectie','opp-ring','Selectieleidraad Oosterweel R1','Bestek','OPP-2026-047-selectieleidraad.pdf'),
    demoOpportunityDocument('document-waterfront-leidraad','opp-waterfront','Aanbestedingsleidraad Waterfront Hasselt','Bestek','OPP-2026-049-leidraad.pdf'),
    {
      id:'document-n72-plan',projectId:'project-n72',legalEntityId:'entity-bouwflow',title:'Uitvoeringsplan wegenis segment B',category:'Plan',status:'Goedgekeurd',currentVersionId:'document-n72-plan-v2',approvedBy:'Sofie Janssens',approvedAt:'2026-07-18T14:30:00.000Z',createdAt:'2026-07-10T09:00:00.000Z',
      versions:[
        {id:'document-n72-plan-v2',documentId:'document-n72-plan',revision:2,revisionLabel:'R2',fileName:'N72-uitvoeringsplan-segment-B-R2.pdf',mimeType:'application/pdf',sizeBytes:4_860_000,notes:'Nutscoordinaten en referentiepunten verwerkt.',uploadedBy:'Lotte De Clercq',createdAt:'2026-07-18T11:15:00.000Z'},
        {id:'document-n72-plan-v1',documentId:'document-n72-plan',revision:1,revisionLabel:'R1',fileName:'N72-uitvoeringsplan-segment-B-R1.pdf',mimeType:'application/pdf',sizeBytes:4_420_000,notes:'Eerste uitvoeringsversie.',uploadedBy:'Lotte De Clercq',createdAt:'2026-07-10T09:00:00.000Z',supersededAt:'2026-07-18T11:15:00.000Z'},
      ],
      recipients:[
        {id:'recipient-n72-plan-1',documentId:'document-n72-plan',versionId:'document-n72-plan-v2',name:'Peter Vrancken',email:'peter.vrancken@awv.example',deliveredAt:'2026-07-18T15:00:00.000Z',readAt:'2026-07-18T15:42:00.000Z'},
        {id:'recipient-n72-plan-2',documentId:'document-n72-plan',versionId:'document-n72-plan-v2',name:'Arcadis projectteam',email:'n72@arcadis.example',deliveredAt:'2026-07-18T15:00:00.000Z'},
      ],
    },
    {
      id:'document-n72-contract',projectId:'project-n72',legalEntityId:'entity-bouwflow',title:'Getekende aannemingsovereenkomst N72 fase 2',category:'Contract',status:'Goedgekeurd',currentVersionId:'document-n72-contract-v1',approvedBy:'Directie BouwFlow',approvedAt:'2026-06-20T10:00:00.000Z',createdAt:'2026-06-20T09:15:00.000Z',
      versions:[{id:'document-n72-contract-v1',documentId:'document-n72-contract',revision:1,revisionLabel:'R1',fileName:'Contract-N72-fase-2-ondertekend.pdf',mimeType:'application/pdf',sizeBytes:2_780_000,notes:'Door beide partijen ondertekend contract.',uploadedBy:'Financiele administratie',createdAt:'2026-06-20T09:15:00.000Z'}],
      recipients:[{id:'recipient-n72-contract-1',documentId:'document-n72-contract',versionId:'document-n72-contract-v1',name:'Projectteam N72',email:'project-n72@bouwflow.example',deliveredAt:'2026-06-20T10:30:00.000Z',readAt:'2026-06-20T11:05:00.000Z'}],
    },
    {
      id:'document-n72-report',projectId:'project-n72',legalEntityId:'entity-bouwflow',title:'Verslag coordinatie nutsmaatschappijen',category:'Verslag',status:'Ter goedkeuring',currentVersionId:'document-n72-report-v1',createdAt:'2026-07-21T13:20:00.000Z',
      versions:[{id:'document-n72-report-v1',documentId:'document-n72-report',revision:1,revisionLabel:'R1',fileName:'Verslag-nutscoordinatie-2026-07-21.pdf',mimeType:'application/pdf',sizeBytes:780_000,notes:'Besluiten en openstaande acties van het coordinatieoverleg.',uploadedBy:'Sofie Janssens',createdAt:'2026-07-21T13:20:00.000Z'}],
      recipients:[],
    },
  ],
  qhseCertificates: [],
  qhseInspections: [],
  assets: [
    { id:'asset-demo-1',code:'MCH-001',name:'Rupskraan 25 ton',category:'Machine',status:'Ingezet',location:'N72 segment B',projectId:'project-n72',hourlyRate:84,inspectionExpiresOn:'2027-03-31',maintenanceDueOn:'2026-09-15',mileage:0,operatingHours:2840 },
    { id:'asset-demo-2',code:'MCH-014',name:'Wiellader 18 ton',category:'Machine',status:'Ingezet',location:'Brightland zone C',projectId:'project-brightland',hourlyRate:78,inspectionExpiresOn:'2026-11-30',maintenanceDueOn:'2026-08-18',mileage:0,operatingHours:4120 },
    { id:'asset-demo-3',code:'MCH-022',name:'Wals 12 ton',category:'Machine',status:'Beschikbaar',location:'Magazijn Hasselt',hourlyRate:69,inspectionExpiresOn:'2027-01-15',maintenanceDueOn:'2026-10-02',mileage:0,operatingHours:1960 },
    { id:'asset-demo-4',code:'VRT-031',name:'Kipper 6x4',category:'Vrachtwagen',status:'Ingezet',location:'Kanaalkom Beringen',projectId:'project-kanaalkom',hourlyRate:96,inspectionExpiresOn:'2026-09-12',maintenanceDueOn:'2026-08-05',mileage:186400,operatingHours:0 },
    { id:'asset-demo-5',code:'VRT-044',name:'Dieplader 45 ton',category:'Vrachtwagen',status:'Beschikbaar',location:'Vestiging Genk',hourlyRate:118,inspectionExpiresOn:'2027-05-20',maintenanceDueOn:'2026-11-10',mileage:142800,operatingHours:0 },
    { id:'asset-demo-6',code:'MET-008',name:'Totaalstation Leica',category:'Meetapparatuur',status:'Ingezet',location:'N72 fase 2',projectId:'project-n72',hourlyRate:28,inspectionExpiresOn:'2026-12-31',maintenanceDueOn:'2026-12-01',mileage:0,operatingHours:680 },
  ],
  warehouses: [{ id: 'warehouse-demo-1', name: 'Centraal magazijn', location: 'Hasselt' }],
  inventoryItems: [{ id: 'inventory-demo-1', sku: 'MAT-001', name: 'Steenslag type II', unit: 'ton', minimumStock: 20, maximumStock: 200, stocks: [{ warehouseId: 'warehouse-demo-1', quantity: 48, reserved: 12 }] }],
  stockMovements: [],
  subcontractors: [{ id:'subcontractor-infralink',organizationId:'org-infralink',name:'InfraLink Utilities BV',vatNumber:'BE0678456123',contactName:'Bart Jacobs',email:'bart.jacobs@infralink.example',status:'Goedgekeurd',insuranceExpiresOn:'2027-03-31',vcaExpiresOn:'2027-05-15',hourlyRate:68,projectIds:['project-n72'],documentsComplete:true,employees:[],portalInvitedAt:'2026-07-01T08:00:00.000Z',createdAt:'2026-06-12T09:00:00.000Z' }],
  qhseEvents: [],
  jointVentures: [],
  integrationConnections: [],
  integrationJobs: [],
  aiAnalyses: [],
  projectContracts: [{
    id:'contract-n72',projectId:'project-n72',title:'Aannemingsovereenkomst herinrichting N72 – fase 2',signedOn:'2026-06-18',executionStart:'2026-07-20',executionEnd:'2027-01-31',paymentTerms:'Maandelijkse vorderingsstaat, betaling binnen 30 kalenderdagen',retentionPct:5,penaltyPerDay:12500,priceRevision:'Formule I-2021 op basis van lonen, materialen en brandstoffen',contractNumber:'AWV-LIM-2026-041',contractType:'Openbare opdracht',clientOrganizationId:'org-awv',contractValue:4100000,currency:'EUR',documentIds:['document-n72-contract'],securities:[{id:'security-n72-1',type:'Bankgarantie',reference:'BG-2026-8841',issuer:'KBC Bank',amount:205000,expiresOn:'2028-01-31',status:'Actief'}],correspondence:[{id:'corr-n72-1',date:'2026-07-21',type:'Verslag',subject:'Startvergadering en bevel van aanvang',sender:'AWV',recipient:'BouwFlow Construct',documentId:'document-n72-report'}],claims:[],versions:[{id:'contract-n72-v1',version:1,changeSummary:'Getekende contractversie',createdBy:'Sofie Janssens',createdAt:'2026-06-20T09:15:00.000Z'}],approvalStatus:'Goedgekeurd',submittedBy:'Sofie Janssens',submittedAt:'2026-06-20T09:30:00.000Z',approvedBy:'Projectdirectie',approvedAt:'2026-06-20T10:00:00.000Z',status:'Actief',obligations:[{id:'obligation-n72-1',title:'Verzekeringsattest alle bouwplaatsrisico’s vernieuwen',dueDate:'2026-08-15',owner:'Sofie Janssens',sourceDocumentId:'document-n72-contract',status:'Open'},{id:'obligation-n72-2',title:'Bankgarantie bezorgen aan opdrachtgever',dueDate:'2026-07-10',owner:'Financiële administratie',sourceDocumentId:'document-n72-contract',status:'Voltooid',completedAt:'2026-07-08T10:00:00.000Z'}],risks:[{id:'risk-contract-n72-1',description:'Dagboete bij overschrijding contractuele einddatum',impact:'Hoog',mitigation:'Kritieke pad wekelijks opvolgen en termijnmeldingen binnen vijf werkdagen versturen',owner:'Sofie Janssens',status:'Beheerst'}],createdAt:'2026-06-20T09:15:00.000Z'
  }],
  projectCloseouts: [{
    id:'closeout-n72',projectId:'project-n72',status:'Voorbereiding',bondReleaseStatus:'Niet aangevraagd',asBuiltComplete:false,maintenanceFileComplete:false,acceptanceDocumentIds:[],asBuiltDocumentIds:[],maintenanceDocumentIds:[],guaranteeDocumentIds:[],bondAmount:205000,bondReleasedAmount:0,items:[{id:'closeout-item-n72-1',description:'As-builtplan nutsleidingen segment B voorbereiden',responsible:'Lotte De Clercq',dueDate:'2027-01-20',status:'Open',location:'Segment B',workPackageId:'wp-n72-6',photoIds:[]}],serviceRequests:[],createdAt:'2026-07-20T09:00:00.000Z'
  }],
  employees: [
    { id:'employee-demo-jan',employeeNumber:'MW-001',firstName:'Jan',lastName:'Peeters',email:'jan.peeters@example.be',role:'Grondwerker',legalEntityId:'entity-bouwflow',branchId:'branch-hasselt',employmentPct:100,weeklyHours:40,annualLeaveHours:160,hireDate:'2021-03-01',skills:['VCA Basis','Grondwerken'],active:true,createdAt:todayIso() },
    { id:'employee-demo-sofie',employeeNumber:'MW-002',firstName:'Sofie',lastName:'Janssens',email:'sofie.janssens@example.be',role:'Projectmanager',legalEntityId:'entity-bouwflow',branchId:'branch-hasselt',employmentPct:80,weeklyHours:32,annualLeaveHours:128,hireDate:'2020-09-01',skills:['Projectleiding','VCA VOL'],active:true,createdAt:todayIso() },
    { id:'employee-demo-pieter',employeeNumber:'MW-003',firstName:'Pieter',lastName:'Mertens',email:'pieter.mertens@example.be',role:'Werfleider',legalEntityId:'entity-bouwflow',branchId:'branch-hasselt',employmentPct:100,weeklyHours:40,annualLeaveHours:160,hireDate:'2018-05-14',skills:['VCA VOL','Werfleiding','Riolering'],active:true,createdAt:todayIso() },
    { id:'employee-demo-lars',employeeNumber:'MW-004',firstName:'Lars',lastName:'Willems',email:'lars.willems@example.be',role:'Projectleider',legalEntityId:'entity-bouwflow',branchId:'branch-genk-construct',employmentPct:100,weeklyHours:40,annualLeaveHours:160,hireDate:'2019-02-01',skills:['Projectleiding','Landmeten','VCA VOL'],active:true,createdAt:todayIso() },
    { id:'employee-demo-amine',employeeNumber:'MW-005',firstName:'Amine',lastName:'El Idrissi',email:'amine.elidrissi@example.be',role:'Ploegbaas',legalEntityId:'entity-bouwflow',branchId:'branch-hasselt',employmentPct:100,weeklyHours:40,annualLeaveHours:160,hireDate:'2017-08-21',skills:['VCA VOL','Grondwerken','Kraanbestuurder'],active:true,createdAt:todayIso() },
    { id:'employee-demo-lotte',employeeNumber:'MW-006',firstName:'Lotte',lastName:'De Clercq',email:'lotte.declercq@example.be',role:'Werkvoorbereider',legalEntityId:'entity-bouwflow',branchId:'branch-antwerpen',employmentPct:100,weeklyHours:40,annualLeaveHours:160,hireDate:'2022-01-10',skills:['Planning','BIM','VCA VOL'],active:true,createdAt:todayIso() },
    { id:'employee-demo-joris',employeeNumber:'MW-007',firstName:'Joris',lastName:'Vandewalle',email:'joris.vandewalle@example.be',role:'Asfaltwerker',legalEntityId:'entity-bouwflow',branchId:'branch-gent',employmentPct:100,weeklyHours:40,annualLeaveHours:160,hireDate:'2020-06-15',skills:['VCA Basis','Asfaltwerken'],active:true,createdAt:todayIso() },
    { id:'employee-demo-ines',employeeNumber:'MW-008',firstName:'Ines',lastName:'Maes',email:'ines.maes@example.be',role:'Preventieadviseur',legalEntityId:'entity-bouwflow',branchId:'branch-hasselt',employmentPct:80,weeklyHours:32,annualLeaveHours:128,hireDate:'2021-09-01',skills:['Preventie niveau II','VCA VOL'],active:true,createdAt:todayIso() },
  ],
  employeeAbsences: [
    {id:'absence-pieter',employeeId:'employee-demo-pieter',type:'Verlof',startDate:'2026-10-12',endDate:'2026-10-16',hours:40,reason:'Jaarlijks verlof',status:'Goedgekeurd',requestedBy:'Pieter Mertens',requestedAt:'2026-06-10T09:00:00.000Z',decidedBy:'HR',decidedAt:'2026-06-11T10:00:00.000Z'},
    {id:'absence-jan',employeeId:'employee-demo-jan',type:'Opleiding',startDate:'2026-09-24',endDate:'2026-09-25',hours:16,reason:'Bijscholing veilig werken langs de weg',status:'Goedgekeurd',requestedBy:'Jan Peeters',requestedAt:'2026-07-01T09:00:00.000Z',decidedBy:'HR',decidedAt:'2026-07-02T10:00:00.000Z'},
    {id:'absence-lotte',employeeId:'employee-demo-lotte',type:'Verlof',startDate:'2026-08-10',endDate:'2026-08-14',hours:40,reason:'Jaarlijks verlof',status:'Goedgekeurd',requestedBy:'Lotte De Clercq',requestedAt:'2026-04-10T09:00:00.000Z',decidedBy:'HR',decidedAt:'2026-04-11T10:00:00.000Z'},
  ],
  employeeCrews: [
    {id:'crew-ground-1',name:'Grondwerken ploeg 1',legalEntityId:'entity-bouwflow',branchId:'branch-hasselt',leaderEmployeeId:'employee-demo-amine',memberEmployeeIds:['employee-demo-amine','employee-demo-jan','employee-demo-pieter'],active:true,createdAt:todayIso()},
    {id:'crew-asphalt',name:'Asfaltploeg',legalEntityId:'entity-bouwflow',branchId:'branch-gent',leaderEmployeeId:'employee-demo-joris',memberEmployeeIds:['employee-demo-joris'],active:true,createdAt:todayIso()},
    {id:'crew-preparation',name:'Werkvoorbereiding Noord',legalEntityId:'entity-bouwflow',branchId:'branch-antwerpen',leaderEmployeeId:'employee-demo-lotte',memberEmployeeIds:['employee-demo-lotte'],active:true,createdAt:todayIso()},
  ],
  workTickets: [{id:'ticket-n72-001',number:'WB-2026-0001',projectId:'project-n72',dailyReportId:'daily-n72-20260721',type:'Regiewerk',date:'2026-07-21',description:'Vrijmaken onverwachte nutsleiding in werkzone B',lines:[{id:'ticket-line-1',category:'Arbeid',description:'Ploeg grondwerken',quantity:12,unit:'u',unitPrice:54},{id:'ticket-line-2',category:'Materieel',description:'Rupskraan 25 ton',quantity:4,unit:'u',unitPrice:84}],total:984,status:'Ter ondertekening',createdBy:'Pieter Mertens',createdAt:'2026-07-21T16:10:00.000Z',submittedAt:'2026-07-21T16:15:00.000Z'}],
  timeEntries: [{id:'time-n72-jan-20260721',employeeId:'employee-demo-jan',projectId:'project-n72',date:'2026-07-21',startTime:'06:30',endTime:'16:00',breakMinutes:30,regularHours:8,overtimeHours:1,travelHours:0.5,nightHours:0,weekendHours:0,source:'Mobiel',status:'Ingediend',createdAt:'2026-07-21T16:05:00.000Z'}],
  checkinatworkSites: [{id:'caw-site-n72',projectId:'project-n72',declarationNumber:'30BIS-2026-N72-041',workPlaceId:'1Y1000N72DEMO',declarantCompanyNumber:'0502635588',applicability:'Verplicht',applicabilityReason:'Contractwaarde overschrijdt \u20ac 500.000 excl. btw.',thresholdAmount:CHECKINATWORK_THRESHOLD,startDate:'2026-07-20',plannedEndDate:'2027-01-31',address:'N72 segment B, Heusden-Zolder',latitude:50.9877,longitude:5.2941,geofenceRadiusMeters:350,environment:'Simulatie',active:true,createdAt:'2026-07-01T09:00:00.000Z',updatedAt:'2026-08-03T06:00:00.000Z'}],
  checkinatworkParticipants: [
    {id:'caw-participant-jan',projectId:'project-n72',employeeId:'employee-demo-jan',displayName:'Jan Peeters',employerName:'BouwFlow Construct NV',employerCompanyNumber:'0502635588',participantType:'Werknemer',identifierType:'INSZ',identifierLast4:'1098',secureIdentityReference:'sim:jan-peeters',identityVerified:true,active:true,createdAt:'2026-07-15T09:00:00.000Z'},
    {id:'caw-participant-pieter',projectId:'project-n72',employeeId:'employee-demo-pieter',displayName:'Pieter Mertens',employerName:'BouwFlow Construct NV',employerCompanyNumber:'0502635588',participantType:'Werknemer',identifierType:'INSZ',identifierLast4:'4421',secureIdentityReference:'sim:pieter-mertens',identityVerified:true,active:true,createdAt:'2026-07-15T09:00:00.000Z'},
    {id:'caw-participant-bart',projectId:'project-n72',subcontractorId:'subcontractor-infralink',displayName:'Bart Jacobs',employerName:'InfraLink Utilities BV',employerCompanyNumber:'0678456123',participantType:'Onderaannemer',identifierType:'INSZ',identifierLast4:'7732',secureIdentityReference:'sim:bart-jacobs',identityVerified:true,active:true,createdAt:'2026-07-15T09:00:00.000Z'},
  ],
  checkinatworkRegistrations: [
    {id:'caw-reg-jan-20260803',siteId:'caw-site-n72',projectId:'project-n72',participantId:'caw-participant-jan',registrationDate:'2026-08-03',source:'QR',status:'Officieel bevestigd',clientReference:'bouwflow:caw-site-n72:caw-participant-jan:2026-08-03',providerRegistrationId:'SIM-CAW-10001',receiptNumber:'CAW-SIM-20260803-001',submittedAt:'2026-08-03T05:56:00.000Z',confirmedAt:'2026-08-03T05:56:01.000Z',simulation:true,createdBy:'Jan Peeters',createdAt:'2026-08-03T05:56:00.000Z'},
    {id:'caw-reg-bart-20260803',siteId:'caw-site-n72',projectId:'project-n72',participantId:'caw-participant-bart',registrationDate:'2026-08-03',source:'Kiosk',status:'Officieel bevestigd',clientReference:'bouwflow:caw-site-n72:caw-participant-bart:2026-08-03',providerRegistrationId:'SIM-CAW-10002',receiptNumber:'CAW-SIM-20260803-002',submittedAt:'2026-08-03T06:02:00.000Z',confirmedAt:'2026-08-03T06:02:01.000Z',simulation:true,createdBy:'Bart Jacobs',createdAt:'2026-08-03T06:02:00.000Z'},
  ],
  checkinatworkAuditEvents: [{id:'caw-audit-demo-1',projectId:'project-n72',siteId:'caw-site-n72',registrationId:'caw-reg-jan-20260803',participantId:'caw-participant-jan',action:'REGISTRATION_CONFIRMED',detail:'Ontvangstnummer CAW-SIM-20260803-001',actor:'BouwFlow RSZ-simulator',at:'2026-08-03T05:56:01.000Z'}],
  checkinatworkIntegrationStatus:{simulationAvailable:true,productionConfigured:false,productionEnabled:false,provider:'BouwFlow RSZ-simulator',protocol:'RSZ PresenceRegistration v1.11 \u00b7 SAML Holder-of-Key SHA-256',lastCheckedAt:'2026-08-03T06:00:00.000Z'},
  projectClaims: [{id:'claim-n72-001',number:'CL-2026-0001',projectId:'project-n72',changeOrderId:'change-n72-cables',type:'Termijnverlenging',cause:'Onvoorziene nutsleidingen',description:'Termijnverlenging wegens bijkomende lokalisatie en omlegging van niet-gekarteerde leidingen.',amount:18450,extensionDays:8,responsibleParty:'Opdrachtgever',documentIds:['document-n72-report'],status:'Intern goedgekeurd',createdBy:'Sofie Janssens',createdAt:'2026-07-21T14:00:00.000Z'}],
}

const signedN72Report = seed.dailyReports.find(report => report.id === 'report-n72-1')
if (signedN72Report) {
  signedN72Report.productionEntries = [{ id: 'production-n72-signed-1', workPackageId: 'wp-n72-1', boqItemId: 'item-1', description: 'Opbraak bestaande verharding', quantity: 1050, unit: 'm²' }]
}
const submittedN72Report = seed.dailyReports.find(report => report.id === 'report-n72-2')
if (submittedN72Report) {
  submittedN72Report.productionEntries = [{ id: 'production-n72-submitted-1', workPackageId: 'wp-n72-1', boqItemId: 'item-1', description: 'Opbraak bestaande verharding', quantity: 600, unit: 'm²' }]
}
const n72Contract=seed.projectContracts.find(contract=>contract.id==='contract-n72')
if(n72Contract&&!n72Contract.priceRevisionClause){
  n72Contract.priceRevision='p = P × [0,40 × (s/S) + 0,40 × (i-2021/I-2021) + 0,20]'
  n72Contract.priceRevisionClause={enabled:true,formulaType:'I-2021 en S',laborWeightPct:40,materialWeightPct:40,fixedWeightPct:20,laborCategory:'A',employerSize:'Meer dan 20',baseDate:'2026-06-18',baseMaterialPeriod:'2026-04',valuationDateRule:'Waarderingsdatum',availabilityPolicy:'Voorlopig met correctie',applicationBase:'Werken en meerwerken',sourceClauseReference:'Bestek AWV-LIM-2026-041 · art. 14.2'}
}

const emptyState: BouwFlowState = { currentUserId: '', companyUsers: [], workflowDefinitions: [], workflowCorrections: [], legalEntities: [], companyBranches: [], organizations: [], opportunities: [], calculations: [], calculationVersions: [], calculationScenarios: [], costLibraries: [], costLibraryVersions: [], costLibrary: [], units: [], unitConversions: [], quotes: [], projects: [], dailyReports: [], sitePhotos: [], changeOrders: [], progressStatements: [], salesInvoices: [], peppolValidationReports: [], peppolDeliveries: [], peppolAcceptanceRuns: [], peppolAlerts: [], peppolNotifications: [], peppolNotificationSettings: { emailRecipients: [], teamsTargets: [], criticalSlaMinutes: 15, connectorConfigured: false, connectorProvider: 'Niet geconfigureerd', connectorChannels: [], integrationChecks: [], productionGate: { released: false } }, intercompanyCharges: [], projectCosts: [], projectForecasts: [], suppliers: [], procurementRequests: [], purchaseOrders: [], documents: [], qhseCertificates: [], qhseInspections: [], assets: [], warehouses: [], inventoryItems: [], stockMovements: [], subcontractors: [], qhseEvents: [], jointVentures: [], integrationConnections: [], integrationJobs: [], aiAnalyses: [], projectContracts: [], projectCloseouts: [], employees: [], employeeAbsences: [], employeeCrews: [], workTickets: [], timeEntries: [], checkinatworkSites: [], checkinatworkParticipants: [], checkinatworkRegistrations: [], checkinatworkAuditEvents: [], checkinatworkIntegrationStatus:{simulationAvailable:true,productionConfigured:false,productionEnabled:false,provider:'Niet geconfigureerd',protocol:'RSZ PresenceRegistration v1.11 \u00b7 SAML Holder-of-Key SHA-256'}, projectClaims: [] }

const emptyHandover = (): ProjectHandover => ({ status: 'Concept', projectManager: '', plannedStart: '', plannedEnd: '', notes: '', risks: [], checklist: { scopeReviewed: false, budgetReviewed: false, contractReviewed: false, documentsTransferred: false, risksReviewed: false, kickoffPlanned: false } })
const emptyPlanning = (): ProjectPlanning => ({ status: 'Concept', baselineVersion: 0, activities: [], updatedAt: new Date(0).toISOString() })
const addDays = (date: string, days: number) => { const value = new Date(`${date}T00:00:00.000Z`); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10) }

function normalizeProject(project: Project): Project {
  const planning = { ...emptyPlanning(), ...project.planning }
  return { ...project, handover: { ...emptyHandover(), ...project.handover, checklist: { ...emptyHandover().checklist, ...project.handover?.checklist } }, workPackages: project.workPackages ?? [], planning: { ...planning, baselineHistory: planning.baselineHistory ?? [], scenarios: planning.scenarios ?? [], activities: planning.activities.map(activity => ({ ...activity, responsible: activity.responsible ?? '', crewSize: activity.crewSize ?? 0, weatherSensitive: activity.weatherSensitive ?? false, resourceAssignments: activity.resourceAssignments ?? [] })) } }
}

const roundCents = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

function calculateLocalProgressStatement(state: BouwFlowState, project: Project, input: ProgressStatementInput, statementId: string) {
  const previous = state.progressStatements.filter(item => item.projectId === project.id && item.id !== statementId && item.status !== 'Concept').sort((a, b) => b.periodEnd.localeCompare(a.periodEnd))[0]
  const previousLines = new Map(previous?.lines.map(line => [line.workPackageId, line]) ?? [])
  const totalBudget = project.workPackages.reduce((sum, item) => sum + item.budget, 0)
  let allocated = 0
  const lines = project.workPackages.map((workPackage, index) => {
    let lineInput = input.lines.find(line => line.workPackageId === workPackage.id) ?? { workPackageId: workPackage.id, cumulativeProgressPct: 0 }
    const calculation = state.calculations.find(item => item.id === project.sourceCalculationId)
    if (lineInput.measurementMethod === 'Meetstaat' && lineInput.meetstaatEvidence && calculation) {
      const evidence = buildMeetstaatEvidence(calculation, workPackage, lineInput.meetstaatEvidence.measurements, lineInput.meetstaatEvidence.measuredBy, lineInput.meetstaatEvidence.measuredAt)
      lineInput = { ...lineInput, cumulativeProgressPct:evidence.completionPct, meetstaatEvidence:evidence }
    }
    if (lineInput.measurementMethod === 'Dagrapporten' && calculation) {
      const evidence = buildDailyReportEvidence(calculation, project, workPackage, state.dailyReports, input.periodEnd)
      lineInput = { ...lineInput, cumulativeProgressPct:evidence.completionPct, dailyReportEvidence:evidence }
    }
    const contractValue = index === project.workPackages.length - 1 ? roundCents(project.contractValue - allocated) : roundCents(project.contractValue * (totalBudget > 0 ? workPackage.budget / totalBudget : 1 / project.workPackages.length))
    allocated = roundCents(allocated + contractValue)
    const previousCumulative = previousLines.get(workPackage.id)?.cumulativeValue ?? 0
    const cumulativeValue = roundCents(contractValue * lineInput.cumulativeProgressPct / 100)
    return { ...lineInput, workPackageCode: workPackage.code, workPackageName: workPackage.name, contractValue, previousCumulative, currentPeriod: roundCents(cumulativeValue - previousCumulative), cumulativeValue }
  })
  const workAmount = roundCents(lines.reduce((sum, line) => sum + line.currentPeriod, 0))
  const changeOrderAmount = roundCents(state.changeOrders.filter(item => input.changeOrderIds.includes(item.id)).reduce((sum, item) => sum + item.total, 0))
  const contract=state.projectContracts.find(item=>item.projectId===project.id&&item.status==='Actief'&&item.approvalStatus==='Goedgekeurd'&&item.priceRevisionClause)
  const valuationDate=contract?.priceRevisionClause?.valuationDateRule==='Einde vorderingsperiode'?input.periodEnd:(input.valuationDate??input.periodEnd)
  const priceRevisionCalculation=contract?.priceRevisionClause?calculateContractPriceRevision({clause:contract.priceRevisionClause,catalogue:demoPriceIndexCatalogue,workAmount,changeOrderAmount,valuationDate}):input.priceRevisionCalculation
  const priceRevisionAmount=priceRevisionCalculation?.revisionAmount??input.priceRevisionAmount
  const revisionFormula=priceRevisionCalculation?.formula??input.revisionFormula
  const grossAmount = roundCents(workAmount + changeOrderAmount + priceRevisionAmount + (input.advancePaymentAmount ?? 0) - (input.advanceRecoveryAmount ?? 0) - (input.otherDeductionsAmount ?? 0))
  const retentionAmount = roundCents(grossAmount * input.retentionPct / 100)
  return { lines, workAmount, changeOrderAmount,priceRevisionAmount,priceRevisionCalculation,revisionFormula,grossAmount, retentionAmount, netAmount: roundCents(grossAmount - retentionAmount) }
}

function patchBoqItem(item: BoqItem, patch: Partial<BoqItem>): BoqItem {
  const costApplications = { ...item.costApplications }
  for (const category of ['labor', 'material', 'equipment', 'subcontracting'] as const) {
    if (category in patch) delete costApplications[category]
  }
  return { ...item, ...patch, costApplications }
}

function refreshBoqItemFromLibrary(item: BoqItem, libraryItems: CostLibraryItem[], allItems: CostLibraryItem[], units: UnitDefinition[], conversions: UnitConversion[]) {
  let updatedApplications = 0
  const next = { ...structuredClone(item), costApplications: { ...(item.costApplications ?? {}) } }
  const categories = ['labor', 'material', 'equipment', 'subcontracting'] as const
  for (const category of categories) {
    const currentApplication = item.costApplications?.[category]
    const currentSource = currentApplication ? allItems.find(source => source.id === currentApplication.libraryItemId) : undefined
    const source = currentSource
      ? libraryItems.find(candidate => candidate.category === category && candidate.code === currentSource.code)
      : libraryItems.find(candidate => candidate.category === category && candidate.code === item.code)
    if (!source) continue
    const factor = currentSource && currentApplication
      ? currentApplication.factor * (unitConversionFactor(currentSource.unit, source.unit, units, conversions) ?? (currentSource.unit === source.unit ? 1 : 0))
      : unitConversionFactor(item.unit, source.unit, units, conversions) ?? (item.unit === source.unit ? 1 : 0)
    if (!(factor > 0)) continue
    const appliedUnitCost = Number((source.unitCost * factor).toFixed(4))
    next[category] = appliedUnitCost
    next.costApplications[category] = { libraryItemId: source.id, factor, appliedUnitCost }
    updatedApplications++
  }
  return { item: next, updatedApplications }
}

function loadState(): BouwFlowState {
  if (API_URL) return emptyState
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    const demoVersion = localStorage.getItem(DEMO_DATA_VERSION_KEY)
    if (!stored || demoVersion !== DEMO_DATA_VERSION) {
      localStorage.setItem(DEMO_DATA_VERSION_KEY, DEMO_DATA_VERSION)
      return seed
    }
    const parsed = JSON.parse(stored) as BouwFlowState
    parsed.legalEntities = [...(parsed.legalEntities ?? []), ...seed.legalEntities.filter(entity => !(parsed.legalEntities ?? []).some(item => item.id === entity.id))]
    parsed.companyBranches = [...(parsed.companyBranches ?? []), ...seed.companyBranches.filter(branch => !(parsed.companyBranches ?? []).some(item => item.id === branch.id))]
    parsed.legalEntities = parsed.legalEntities.map(entity => { const defaults = seed.legalEntities.find(item => item.id === entity.id); return defaults && (!entity.iban && (!entity.invoicePrefix || entity.invoicePrefix === 'VF') && (!entity.nextInvoiceNumber || entity.nextInvoiceNumber === 1)) ? { ...entity, invoicePrefix: defaults.invoicePrefix, nextInvoiceNumber: defaults.nextInvoiceNumber, defaultVatPct: defaults.defaultVatPct, iban: defaults.iban, bic: defaults.bic, paymentTermsDays: defaults.paymentTermsDays } : entity })
    parsed.legalEntities = parsed.legalEntities.map(entity => entity.nextInvoiceNumber > 999 && seed.legalEntities.some(item => item.id === entity.id) ? { ...entity, nextInvoiceNumber: seed.legalEntities.find(item => item.id === entity.id)!.nextInvoiceNumber } : entity)
    parsed.organizations = (parsed.organizations ?? seed.organizations).map(organization => { const defaults = seed.organizations.find(item => item.id === organization.id); return { ...organization, vatNumber: organization.vatNumber ?? defaults?.vatNumber ?? '', addressLine: organization.addressLine ?? defaults?.addressLine ?? '', postalCode: organization.postalCode ?? defaults?.postalCode ?? '', city: organization.city ?? defaults?.city ?? '', countryCode: organization.countryCode ?? defaults?.countryCode ?? 'BE', peppolEndpointId: organization.peppolEndpointId ?? defaults?.peppolEndpointId ?? '', peppolSchemeId: organization.peppolSchemeId ?? defaults?.peppolSchemeId ?? '0208', roles: organization.roles?.length ? organization.roles : defaults?.roles?.length ? defaults.roles : ['Klant','Opdrachtgever'], contacts: organization.contacts?.length ? organization.contacts : defaults?.contacts?.length ? defaults.contacts : [{ id:`legacy-${organization.id}`, firstName:organization.contactName, lastName:'', jobTitle:'', department:'', email:organization.email, phone:'', mobile:'', isPrimary:true, active:true }], addresses: organization.addresses?.length ? organization.addresses : defaults?.addresses ?? [] } })
    parsed.assets = parsed.assets ?? seed.assets
    parsed.warehouses = parsed.warehouses ?? seed.warehouses
    parsed.inventoryItems = parsed.inventoryItems ?? seed.inventoryItems
    parsed.stockMovements = parsed.stockMovements ?? []
    parsed.subcontractors = parsed.subcontractors ?? []
    parsed.qhseEvents = parsed.qhseEvents ?? []
    parsed.jointVentures = parsed.jointVentures ?? []
    parsed.integrationConnections = parsed.integrationConnections ?? []
    parsed.integrationJobs = parsed.integrationJobs ?? []
    parsed.aiAnalyses = parsed.aiAnalyses ?? []
    parsed.projectContracts = (parsed.projectContracts ?? []).map(item => ({ ...item, approvalStatus:item.approvalStatus ?? 'Concept' }))
    parsed.projectCloseouts = parsed.projectCloseouts ?? []
    parsed.employees = parsed.employees ?? seed.employees
    parsed.employeeAbsences = parsed.employeeAbsences ?? []
    parsed.employeeCrews = parsed.employeeCrews ?? []
    parsed.workTickets = parsed.workTickets ?? []
    parsed.timeEntries = parsed.timeEntries ?? []
    parsed.checkinatworkSites = parsed.checkinatworkSites ?? seed.checkinatworkSites
    parsed.checkinatworkParticipants = parsed.checkinatworkParticipants ?? seed.checkinatworkParticipants
    parsed.checkinatworkRegistrations = parsed.checkinatworkRegistrations ?? seed.checkinatworkRegistrations
    parsed.checkinatworkAuditEvents = parsed.checkinatworkAuditEvents ?? seed.checkinatworkAuditEvents
    parsed.checkinatworkIntegrationStatus = parsed.checkinatworkIntegrationStatus ?? seed.checkinatworkIntegrationStatus
    parsed.projectClaims = parsed.projectClaims ?? []
    parsed.documents = [...(parsed.documents ?? []), ...seed.documents.filter(document => !(parsed.documents ?? []).some(item => item.id === document.id))]
    parsed.costLibraries = (parsed.costLibraries?.length ? parsed.costLibraries : seed.costLibraries).map(library => ({ ...library, active: library.active ?? true, legalEntityId: library.legalEntityId || undefined, branchId: library.branchId || undefined }))
    parsed.units = parsed.units?.length ? parsed.units : seed.units
    parsed.unitConversions = parsed.unitConversions ?? seed.unitConversions
    parsed.companyUsers = [...(parsed.companyUsers ?? []), ...seed.companyUsers.filter(user => !(parsed.companyUsers ?? []).some(item => item.id === user.id))].map(user => {
      const defaults = seed.companyUsers.find(item => item.id === user.id)
      return { ...defaults, ...user, status: user.status ?? defaults?.status ?? 'Actief', allProjects: user.allProjects ?? user.allLegalEntities, projectIds: user.projectIds ?? defaults?.projectIds ?? [] }
    })
    parsed.calculations = (parsed.calculations ?? []).map(calculation => ({ ...calculation, items: calculation.items.map(item => ({ ...item, postType:item.postType??'Meetstaatpost', variables:item.variables??[], formulas:item.formulas??{}, priceAdjustments:item.priceAdjustments??[] })) }))
    parsed.workflowDefinitions = parsed.workflowDefinitions?.length ? parsed.workflowDefinitions : seed.workflowDefinitions
    parsed.workflowCorrections = parsed.workflowCorrections ?? []
    return { ...parsed, currentUserId: parsed.currentUserId ?? seed.currentUserId, companyUsers: parsed.companyUsers ?? seed.companyUsers, legalEntities: (parsed.legalEntities ?? seed.legalEntities).map(entity => { const defaults = seed.legalEntities.find(item => item.id === entity.id); return { ...entity, vatNumber: defaults && ['BE0123456789', 'BE0555666777'].includes(entity.vatNumber) ? defaults.vatNumber : entity.vatNumber, invoicePrefix: entity.invoicePrefix ?? 'VF', nextInvoiceNumber: entity.nextInvoiceNumber ?? 1, defaultVatPct: entity.defaultVatPct ?? 21, iban: entity.iban ?? '', bic: entity.bic ?? '', paymentTermsDays: entity.paymentTermsDays ?? 30, addressLine: entity.addressLine ?? defaults?.addressLine ?? '', postalCode: entity.postalCode ?? defaults?.postalCode ?? '', city: entity.city ?? defaults?.city ?? '', countryCode: entity.countryCode ?? defaults?.countryCode ?? 'BE', peppolEndpointId: entity.peppolEndpointId ?? defaults?.peppolEndpointId ?? '', peppolSchemeId: entity.peppolSchemeId ?? defaults?.peppolSchemeId ?? '0208' } }), companyBranches: parsed.companyBranches ?? seed.companyBranches, calculationVersions: parsed.calculationVersions ?? [], calculationScenarios: parsed.calculationScenarios ?? seed.calculationScenarios, costLibraries: parsed.costLibraries?.length ? parsed.costLibraries : seed.costLibraries, costLibraryVersions: parsed.costLibraryVersions?.length ? parsed.costLibraryVersions : seed.costLibraryVersions, costLibrary: (parsed.costLibrary ?? seed.costLibrary).map(item => ({ ...item, libraryVersionId: item.libraryVersionId ?? DEFAULT_COST_LIBRARY_VERSION_ID })), calculations: parsed.calculations.map(calculation => ({ ...calculation, siteOverheadPct: calculation.siteOverheadPct ?? 0, escalationPct: calculation.escalationPct ?? 0, discountPct: calculation.discountPct ?? 0, roundingStep: calculation.roundingStep ?? 0, chapters: calculation.chapters ?? [], items: calculation.items.map((item, index) => ({ ...item, sortOrder: item.sortOrder ?? index, quantityType: item.quantityType ?? 'Vermoedelijk', wastePct: item.wastePct ?? 0, itemRiskPct: item.itemRiskPct ?? 0, markupPct: item.markupPct ?? 0, notes: item.notes ?? '', costApplications: item.costApplications ?? {} })) })), projects: (parsed.projects ?? []).map(normalizeProject), dailyReports: parsed.dailyReports ?? [], sitePhotos: parsed.sitePhotos ?? [], changeOrders: parsed.changeOrders ?? [], progressStatements: parsed.progressStatements ?? [], salesInvoices: parsed.salesInvoices ?? [], peppolValidationReports: parsed.peppolValidationReports ?? [], peppolDeliveries: parsed.peppolDeliveries ?? [], peppolAcceptanceRuns: parsed.peppolAcceptanceRuns ?? [], peppolAlerts: parsed.peppolAlerts ?? [], peppolNotifications: parsed.peppolNotifications ?? [], peppolNotificationSettings: { ...seed.peppolNotificationSettings, ...parsed.peppolNotificationSettings }, intercompanyCharges: parsed.intercompanyCharges ?? seed.intercompanyCharges, projectCosts: parsed.projectCosts ?? [], projectForecasts: parsed.projectForecasts ?? [], suppliers: parsed.suppliers ?? [], procurementRequests: (parsed.procurementRequests ?? []).map(request=>({...request,invitedSupplierIds:request.invitedSupplierIds??[]})), purchaseOrders: parsed.purchaseOrders ?? [], documents: parsed.documents ?? [], qhseCertificates: parsed.qhseCertificates ?? [], qhseInspections: parsed.qhseInspections ?? [] }
  } catch {
    return seed
  }
}

function workflowRecordStatus(state: BouwFlowState, input: WorkflowCorrectionInput) {
  switch (input.dossierType) {
    case 'opportunity': return state.opportunities.find(item => item.id === input.recordId)?.stage
    case 'document': return state.documents.find(item => item.id === input.recordId)?.status
    case 'contract': return state.projectContracts.find(item => item.id === input.recordId)?.approvalStatus
    case 'daily-report': return state.dailyReports.find(item => item.id === input.recordId)?.status
    case 'change-order': return state.changeOrders.find(item => item.id === input.recordId)?.status
    case 'progress-statement': return state.progressStatements.find(item => item.id === input.recordId)?.status
    case 'employee-absence': return state.employeeAbsences.find(item => item.id === input.recordId)?.status
    case 'time-entry': return state.timeEntries.find(item => item.id === input.recordId)?.status
    case 'project-claim': return state.projectClaims.find(item => item.id === input.recordId)?.status
    case 'qhse-inspection': return state.qhseInspections.find(item => item.id === input.recordId)?.status
  }
}

function applyWorkflowRecord(state: BouwFlowState, dossierType: WorkflowCorrectionInput['dossierType'], recordId: string, record: unknown): BouwFlowState {
  switch (dossierType) {
    case 'opportunity': return { ...state, opportunities: state.opportunities.map(item => item.id === recordId ? record as Opportunity : item) }
    case 'document': return { ...state, documents: state.documents.map(item => item.id === recordId ? record as ProjectDocument : item) }
    case 'contract': return { ...state, projectContracts: state.projectContracts.map(item => item.id === recordId ? record as ProjectContract : item) }
    case 'daily-report': return { ...state, dailyReports: state.dailyReports.map(item => item.id === recordId ? record as DailyReport : item) }
    case 'change-order': return { ...state, changeOrders: state.changeOrders.map(item => item.id === recordId ? record as ChangeOrder : item) }
    case 'progress-statement': return { ...state, progressStatements: state.progressStatements.map(item => item.id === recordId ? record as ProgressStatement : item) }
    case 'employee-absence': return { ...state, employeeAbsences: state.employeeAbsences.map(item => item.id === recordId ? record as EmployeeAbsence : item) }
    case 'time-entry': return { ...state, timeEntries: state.timeEntries.map(item => item.id === recordId ? record as TimeEntry : item) }
    case 'project-claim': return { ...state, projectClaims: state.projectClaims.map(item => item.id === recordId ? record as ProjectClaim : item) }
    case 'qhse-inspection': return { ...state, qhseInspections: state.qhseInspections.map(item => item.id === recordId ? record as QhseInspection : item) }
  }
}

function applyLocalWorkflowTarget(state: BouwFlowState, input: WorkflowCorrectionInput) {
  switch (input.dossierType) {
    case 'opportunity': {
      const current = state.opportunities.find(item => item.id === input.recordId)
      return current ? applyWorkflowRecord(state, input.dossierType, input.recordId, { ...current, stage: input.targetStatus as Opportunity['stage'] }) : state
    }
    case 'document': {
      const current = state.documents.find(item => item.id === input.recordId)
      return current && !current.immutable ? applyWorkflowRecord(state, input.dossierType, input.recordId, { ...current, status: input.targetStatus as ProjectDocument['status'] }) : state
    }
    case 'contract': {
      const current = state.projectContracts.find(item => item.id === input.recordId)
      return current ? applyWorkflowRecord(state, input.dossierType, input.recordId, { ...current, approvalStatus: input.targetStatus as ProjectContract['approvalStatus'] }) : state
    }
    case 'daily-report': {
      const current = state.dailyReports.find(item => item.id === input.recordId)
      return current ? applyWorkflowRecord(state, input.dossierType, input.recordId, { ...current, status: input.targetStatus as DailyReport['status'] }) : state
    }
    case 'change-order': {
      const current = state.changeOrders.find(item => item.id === input.recordId)
      return current ? applyWorkflowRecord(state, input.dossierType, input.recordId, { ...current, status: input.targetStatus as ChangeOrder['status'] }) : state
    }
    case 'progress-statement': {
      const current = state.progressStatements.find(item => item.id === input.recordId)
      return current ? applyWorkflowRecord(state, input.dossierType, input.recordId, { ...current, status: input.targetStatus as ProgressStatement['status'] }) : state
    }
    case 'employee-absence': {
      const current = state.employeeAbsences.find(item => item.id === input.recordId)
      return current ? applyWorkflowRecord(state, input.dossierType, input.recordId, { ...current, status: input.targetStatus as EmployeeAbsence['status'] }) : state
    }
    case 'time-entry': {
      const current = state.timeEntries.find(item => item.id === input.recordId)
      return current ? applyWorkflowRecord(state, input.dossierType, input.recordId, { ...current, status: input.targetStatus as TimeEntry['status'] }) : state
    }
    case 'project-claim': {
      const current = state.projectClaims.find(item => item.id === input.recordId)
      return current ? applyWorkflowRecord(state, input.dossierType, input.recordId, { ...current, status: input.targetStatus as ProjectClaim['status'] }) : state
    }
    case 'qhse-inspection': {
      const current = state.qhseInspections.find(item => item.id === input.recordId)
      return current ? applyWorkflowRecord(state, input.dossierType, input.recordId, { ...current, status: input.targetStatus as QhseInspection['status'] }) : state
    }
  }
}

export interface StoreConnection {
  mode: 'api' | 'browser'
  phase: 'loading' | 'ready' | 'syncing' | 'offline' | 'error'
  error?: string
  lastSyncedAt?: string
  pendingMutations?: number
}

export function useBouwFlowStore(tokenProvider?: () => Promise<string | undefined>) {
  const api = useMemo(() => API_URL ? new BouwFlowApi(API_URL, fetch, tokenProvider) : undefined, [tokenProvider])
  const [state, setState] = useState<BouwFlowState>(loadState)
  const [connection, setConnection] = useState<StoreConnection>({ mode: API_URL ? 'api' : 'browser', phase: API_URL ? 'loading' : 'ready' })

  useEffect(() => {
    if (!api) localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [api, state])

  const refresh = useCallback(async () => {
    if (!api) return
    setConnection(current => ({ ...current, phase: 'loading', error: undefined }))
    try {
      const replay = await api.flushOfflineQueue()
      if (replay.blocked) throw new Error(`${replay.blocked} offline wijziging(en) vereisen controle.`)
      const latest = await api.bootstrap()
      setState(latest)
      await saveOfflineSnapshot(await api.offlineScope(), latest)
      setConnection({ mode: 'api', phase: 'ready', lastSyncedAt: new Date().toISOString(), pendingMutations: await api.offlineQueueSize() })
    } catch (error) {
      const pendingMutations = await api.offlineQueueSize().catch(() => 0)
      const snapshot = await api.offlineScope().then(scope => readOfflineSnapshot<BouwFlowState>(scope)).catch(() => undefined)
      if (snapshot) setState(snapshot.data)
      const offline = !navigator.onLine && Boolean(snapshot || pendingMutations)
      const message = error instanceof TypeError && /fetch/i.test(error.message)
        ? `De BouwFlow-API op ${API_URL} is niet bereikbaar. Start de API of gebruik lokaal de demomodus.`
        : error instanceof Error ? error.message : 'De API is niet bereikbaar'
      setConnection({ mode: 'api', phase: offline ? 'offline' : 'error', error: offline && snapshot ? `Offline kopie van ${new Date(snapshot.savedAt).toLocaleString('nl-BE')}` : message, pendingMutations })
    }
  }, [api])

  useEffect(() => { void refresh() }, [refresh])

  useEffect(() => {
    if (!api) return
    const handleOnline = () => { void refresh() }
    window.addEventListener('online', handleOnline)
    void api.offlineQueueSize().then(count => { if (count) setConnection(current => ({ ...current, phase: navigator.onLine ? current.phase : 'offline', pendingMutations: count })) })
    return () => window.removeEventListener('online', handleOnline)
  }, [api, refresh])

  const remote = useCallback(async <T,>(operation: () => Promise<T>, apply: (result: T) => void) => {
    setConnection(current => ({ ...current, phase: 'syncing', error: undefined }))
    try {
      const result = await operation()
      apply(result)
      setConnection({ mode: 'api', phase: 'ready', lastSyncedAt: new Date().toISOString(), pendingMutations: await api?.offlineQueueSize() })
      return result
    } catch (error) {
      if (error instanceof OfflineMutationQueuedError) {
        setConnection({ mode: 'api', phase: 'offline', error: error.message, pendingMutations: await api?.offlineQueueSize() })
        return undefined
      }
      setConnection({ mode: 'api', phase: 'error', error: error instanceof Error ? error.message : 'Synchronisatie mislukt' })
      return undefined
    }
  }, [api])

  const actions = useMemo(() => ({
    async mailbox():Promise<MailboxOverview>{return api?api.mailbox():{configured:false,mailbox:'',messages:[]}},
    async synchronizeMailbox():Promise<MailboxOverview>{return api?api.synchronizeMailbox():{configured:false,mailbox:'',messages:[]}},
    async sendMailboxMessage(input:MailboxComposeInput){return api?api.sendMailboxMessage(input):undefined},
    async replyMailboxMessage(id:string,input:MailboxReplyInput){return api?api.replyMailboxMessage(id,input):undefined},
    async linkMailboxMessage(id:string,input:MailboxLinkInput){return api?api.linkMailboxMessage(id,input):undefined},
    async downloadBimTestModel(id: string) {
      if (api) return remote(() => api.downloadBimTestModel(id), () => undefined)
      const model = getBimProductionTestModel(id)
      if (!model) return undefined
      const response = await fetch(model.sourceUrl)
      return response.ok ? response.blob() : undefined
    },
    async searchBelgianAddresses(query: string, signal?: AbortSignal) {
      return api ? api.searchBelgianAddresses(query, signal) : searchBelgianAddressesOnline(query, signal)
    },
    async createLegalEntity(input: LegalEntityInput) {
      if (api) { await remote(() => api.createLegalEntity(input), result => setState(current => ({ ...current, legalEntities: [...current.legalEntities, result] }))); return }
      const entity: LegalEntity = { id: createId(), ...input, invoicePrefix: input.invoicePrefix ?? 'VF', nextInvoiceNumber: input.nextInvoiceNumber ?? 1, defaultVatPct: input.defaultVatPct ?? 21, iban: input.iban ?? '', bic: input.bic ?? '', paymentTermsDays: input.paymentTermsDays ?? 30, addressLine: input.addressLine ?? '', postalCode: input.postalCode ?? '', city: input.city ?? '', countryCode: input.countryCode ?? 'BE', peppolEndpointId: input.peppolEndpointId ?? '', peppolSchemeId: input.peppolSchemeId ?? '0208', createdAt: todayIso() }
      setState(current => current.legalEntities.some(item => item.vatNumber === input.vatNumber) ? current : { ...current, legalEntities: [...current.legalEntities, entity] })
    },
    async updateLegalEntityFinancial(id: string, input: LegalEntityFinancialInput) {
      if (api) { await remote(() => api.updateLegalEntityFinancial(id, input), result => setState(current => ({ ...current, legalEntities: current.legalEntities.map(item => item.id === id ? result : item) }))); return }
      setState(current => ({ ...current, legalEntities: current.legalEntities.map(item => item.id === id ? { ...item, ...input } : item) }))
    },
    async createOrganization(input: OrganizationInput) {
      if (api) { await remote(() => api.createOrganization(input), result => setState(current => ({ ...current, organizations: [...current.organizations, result].sort((a, b) => a.name.localeCompare(b.name)) }))); return }
      const organization: Organization = { id: createId(), ...input }
      setState(current => current.organizations.some(item => item.name.toLocaleLowerCase() === input.name.toLocaleLowerCase() || Boolean(input.vatNumber && item.vatNumber === input.vatNumber)) ? current : { ...current, organizations: [...current.organizations, organization].sort((a, b) => a.name.localeCompare(b.name)) })
    },
    async updateOrganization(id: string, input: OrganizationInput) {
      const applyUpdate = (current: BouwFlowState, result: Organization): BouwFlowState => ({ ...current, organizations: current.organizations.map(item => item.id === id ? result : item).sort((a, b) => a.name.localeCompare(b.name)), suppliers: current.suppliers.map(item => item.organizationId === id ? { ...item, name: result.name, vatNumber: result.vatNumber, contactName: result.contactName, email: result.email } : item), subcontractors: current.subcontractors.map(item => item.organizationId === id ? { ...item, name: result.name, vatNumber: result.vatNumber, contactName: result.contactName, email: result.email } : item) })
      if (api) { await remote(() => api.updateOrganization(id, input), result => setState(current => applyUpdate(current, result))); return }
      setState(current => applyUpdate(current, { id, ...input }))
    },
    async addCrmActivity(id:string,input:Omit<CrmActivity,'id'|'createdAt'>){
      if(api){await remote(()=>api.addCrmActivity(id,input),result=>setState(current=>({...current,organizations:current.organizations.map(item=>item.id===id?result:item)})));return}
      const activity:CrmActivity={id:createId(),...input,createdAt:todayIso()};setState(current=>({...current,organizations:current.organizations.map(item=>item.id===id?{...item,activities:[activity,...(item.activities??[])]}:item)}))
    },
    async addOrganizationRelation(id:string,input:Omit<OrganizationRelation,'id'|'createdAt'>){
      if(api){await remote(()=>api.addOrganizationRelation(id,input),result=>setState(current=>({...current,organizations:current.organizations.map(item=>item.id===id?result:item)})));return}
      const relation:OrganizationRelation={id:createId(),...input,createdAt:todayIso()};setState(current=>({...current,organizations:current.organizations.map(item=>item.id===id?{...item,relations:[relation,...(item.relations??[])]}:item)}))
    },
    async updateOrganizationBilling(id: string, input: OrganizationBillingInput) {
      if (api) { await remote(() => api.updateOrganizationBilling(id, input), result => setState(current => ({ ...current, organizations: current.organizations.map(item => item.id === id ? result : item) }))); return }
      setState(current => ({ ...current, organizations: current.organizations.map(item => {
        if (item.id !== id) return item
        const currentAddresses = item.addresses?.length ? item.addresses : [{ id:createId(), type:'Bezoekadres' as const, label:'Hoofdadres', addressLine:item.addressLine, postalCode:item.postalCode, city:item.city, countryCode:item.countryCode, isPrimary:true, notes:'' }]
        const billingIndex = currentAddresses.findIndex(address => address.type === 'Facturatieadres')
        const billingAddress = { id:billingIndex >= 0 ? currentAddresses[billingIndex].id : createId(), type:'Facturatieadres' as const, label:billingIndex >= 0 ? currentAddresses[billingIndex].label : 'Facturatie', addressLine:input.addressLine, postalCode:input.postalCode, city:input.city, countryCode:input.countryCode, isPrimary:billingIndex >= 0 ? currentAddresses[billingIndex].isPrimary : false, notes:billingIndex >= 0 ? currentAddresses[billingIndex].notes : '' }
        const addresses = billingIndex >= 0 ? currentAddresses.map((address,index) => index === billingIndex ? billingAddress : address) : [...currentAddresses,billingAddress]
        return { ...item, ...input, addresses }
      }) }))
    },
    async createIntercompanyCharge(input: IntercompanyChargeInput) {
      if (api) { await remote(() => api.createIntercompanyCharge(input), result => setState(current => ({ ...current, intercompanyCharges: [result, ...current.intercompanyCharges] }))); return }
      setState(current => {
        const totalAmount = roundCents(input.baseAmount * (1 + input.markupPct / 100))
        const charge: IntercompanyCharge = { id: createId(), number: `IC-${new Date().getFullYear()}-${String(current.intercompanyCharges.length + 1).padStart(4, '0')}`, ...input, totalAmount, status: 'Concept', createdAt: todayIso() }
        return { ...current, intercompanyCharges: [charge, ...current.intercompanyCharges] }
      })
    },
    async approveIntercompanyCharge(id: string) {
      if (api) { await remote(() => api.approveIntercompanyCharge(id), result => setState(current => ({ ...current, intercompanyCharges: current.intercompanyCharges.map(item => item.id === id ? result : item) }))); return }
      setState(current => ({ ...current, intercompanyCharges: current.intercompanyCharges.map(item => item.id === id && item.status === 'Concept' ? { ...item, status: 'Goedgekeurd', approvedAt: todayIso() } : item) }))
    },
    async postIntercompanyCharge(id: string) {
      if (api) { await remote(() => api.postIntercompanyCharge(id), result => setState(current => ({ ...current, intercompanyCharges: current.intercompanyCharges.map(item => item.id === id ? result : item) }))); return }
      setState(current => ({ ...current, intercompanyCharges: current.intercompanyCharges.map(item => item.id === id && item.status === 'Goedgekeurd' ? { ...item, status: 'Geboekt', postedAt: todayIso() } : item) }))
    },
    async createCompanyBranch(legalEntityId: string, input: CompanyBranchInput) {
      if (api) { await remote(() => api.createCompanyBranch(legalEntityId, input), result => setState(current => ({ ...current, companyBranches: [...current.companyBranches, result] }))); return }
      const branch: CompanyBranch = { id: createId(), legalEntityId, ...input, createdAt: todayIso() }
      setState(current => ({ ...current, companyBranches: [...current.companyBranches, branch] }))
    },
    async assignProjectCompany(projectId: string, input: ProjectCompanyAssignmentInput) {
      if (api) { await remote(() => api.assignProjectCompany(projectId, input), result => setState(current => ({ ...current, projects: current.projects.map(item => item.id === projectId ? result : item) }))); return }
      setState(current => ({ ...current, projects: current.projects.map(item => item.id === projectId ? { ...item, legalEntityId: input.legalEntityId, branchId: input.branchId } : item) }))
    },
    async updateCompanyUserAccess(userId: string, input: CompanyUserAccessInput) {
      if (api) {
        const updated = await remote(() => api.updateCompanyUserAccess(userId, input), result => setState(current => ({ ...current, companyUsers: current.companyUsers.map(item => item.id === userId ? result : item) })))
        if (updated && userId === updated.id) await refresh()
        return
      }
      setState(current => ({ ...current, companyUsers: current.companyUsers.map(item => item.id === userId ? { ...item, allLegalEntities: input.allLegalEntities, legalEntityIds: input.allLegalEntities ? [] : [...new Set(input.legalEntityIds)], allProjects: input.allProjects ?? item.allProjects ?? true, projectIds: (input.allProjects ?? item.allProjects ?? true) ? [] : [...new Set(input.projectIds ?? item.projectIds ?? [])] } : item) }))
    },
    async inviteCompanyUser(input:CompanyUserProfileInput){
      if(api){await remote(()=>api.inviteCompanyUser(input),result=>setState(current=>({...current,companyUsers:[...current.companyUsers,result]})));return}
      const item={id:createId(),...input,legalEntityIds:input.allLegalEntities?[]:[...new Set(input.legalEntityIds)],projectIds:input.allProjects?[]:[...new Set(input.projectIds??[])]}
      setState(current=>({...current,companyUsers:[...current.companyUsers,item]}))
    },
    async updateCompanyUser(userId:string,input:CompanyUserProfileInput){
      if(api){await remote(()=>api.updateCompanyUser(userId,input),result=>setState(current=>({...current,companyUsers:current.companyUsers.map(item=>item.id===userId?result:item)})));return}
      setState(current=>({...current,companyUsers:current.companyUsers.map(item=>item.id===userId?{...item,...input,legalEntityIds:input.allLegalEntities?[]:[...new Set(input.legalEntityIds)],projectIds:input.allProjects?[]:[...new Set(input.projectIds??[])]}:item)}))
    },
    switchDemoUser(userId:string){
      if(api)return
      setState(current=>current.companyUsers.some(item=>item.id===userId&&item.status!=='Geblokkeerd')
        ?{...current,currentUserId:userId}
        :current)
    },
    async switchApiDemoUser(userId?: string) {
      if (!api) return
      api.setDemoUser(userId)
      await refresh()
    },
    async createWorkflowDefinition(input:WorkflowDefinitionInput){
      if(api){await remote(()=>api.createWorkflowDefinition(input),result=>setState(current=>({...current,workflowDefinitions:[...current.workflowDefinitions,result]})));return}
      const item={id:createId(),...input,updatedAt:todayIso()}
      setState(current=>({...current,workflowDefinitions:[...current.workflowDefinitions,item]}))
    },
    async updateWorkflowDefinition(id:string,input:WorkflowDefinitionInput){
      if(api){await remote(()=>api.updateWorkflowDefinition(id,input),result=>setState(current=>({...current,workflowDefinitions:current.workflowDefinitions.map(item=>item.id===id?result:item)})));return}
      setState(current=>({...current,workflowDefinitions:current.workflowDefinitions.map(item=>item.id===id?{...item,...input,updatedAt:todayIso()}:item)}))
    },
    async correctWorkflow(input:WorkflowCorrectionInput){
      if(api){
        await remote(()=>api.correctWorkflow(input),result=>setState(current=>{
          const next=applyWorkflowRecord(current,input.dossierType,input.recordId,result.record)
          return {...next,workflowCorrections:[result.correction,...(next.workflowCorrections??[])]}
        }))
        return
      }
      setState(current=>{
        const previousStatus=workflowRecordStatus(current,input)
        if(!previousStatus||previousStatus===input.targetStatus)return current
        const corrected=applyLocalWorkflowTarget(current,input)
        const actor=current.companyUsers.find(item=>item.id===current.currentUserId)?.displayName??'BouwFlow-gebruiker'
        const correction:WorkflowCorrection={id:createId(),...input,previousStatus,correctedBy:actor,correctedAt:todayIso()}
        return {...corrected,workflowCorrections:[correction,...(corrected.workflowCorrections??[])]}
      })
    },
    async addOpportunity(input: Omit<Opportunity, 'id' | 'projectNumber'>) {
      if (api) {
        const { stage: _stage, ...apiInput } = input
        await remote(() => api.createOpportunity(apiInput), opportunity => setState(current => ({ ...current, opportunities: [...current.opportunities, opportunity] })))
        return
      }
      setState(current => ({ ...current, opportunities: [...current.opportunities, { ...input, id: createId(), projectNumber: `OPP-${new Date().getFullYear()}-${String(current.opportunities.length + 1).padStart(3, '0')}` }] }))
    },
    async updateOpportunity(id: string, input: OpportunityDetailsInput) {
      if (api) { await remote(() => api.updateOpportunity(id, input), result => setState(current => ({ ...current, opportunities: current.opportunities.map(item => item.id === id ? result : item) }))); return }
      setState(current => ({ ...current, opportunities: current.opportunities.map(item => item.id === id ? { ...item, ...input } : item) }))
    },
    async saveTenderDossier(id:string,input:TenderDossier){
      if(api){await remote(()=>api.saveTenderDossier(id,input),result=>setState(current=>({...current,opportunities:current.opportunities.map(item=>item.id===id?result:item)})));return}
      setState(current=>({...current,opportunities:current.opportunities.map(item=>item.id===id?{...item,deadline:input.submissionDeadline.slice(0,10),recognition:[input.recognitionClass,input.recognitionCategory].filter(Boolean).join(' '),tender:{...input,updatedAt:todayIso()}}:item)}))
    },
    async qualifyOpportunity(id: string) {
      if (api) { await remote(() => api.qualifyOpportunity(id), result => setState(current => ({ ...current, opportunities: current.opportunities.map(item => item.id === id ? result : item) }))); return }
      setState(current => ({ ...current, opportunities: current.opportunities.map(item => item.id === id && item.stage === 'Nieuw' ? { ...item, stage: 'Gekwalificeerd' } : item) }))
    },
    async assessOpportunity(id: string, input: OpportunityGoNoGoInput) {
      if (api) { await remote(() => api.assessOpportunity(id, input), result => setState(current => ({ ...current, opportunities: current.opportunities.map(item => item.id === id ? result : item) }))); return }
      const scoreValues = Object.values(input.scores)
      const assessment = { ...input, averageScore: Math.round(scoreValues.reduce((sum, value) => sum + value, 0) / scoreValues.length * 100) / 100, assessedAt: new Date().toISOString() }
      setState(current => ({ ...current, opportunities: current.opportunities.map(item => item.id === id ? { ...item, stage: input.decision === 'Go' ? 'Go/No-Go' : 'Verloren', probability: input.decision === 'Go' ? Math.max(item.probability, 50) : 0, goNoGo: assessment } : item) }))
    },
    async startCalculation(opportunityId: string) {
      if (api) {
        await remote(() => api.startCalculation(opportunityId), calculation => setState(current => ({
          ...current,
          opportunities: current.opportunities.map(item => item.id === opportunityId ? { ...item, stage: 'Calculatie' } : item),
          calculations: current.calculations.some(item => item.id === calculation.id) ? current.calculations.map(item => item.id === calculation.id ? calculation : item) : [...current.calculations, calculation],
        })))
        return
      }
      setState(current => {
        if (current.calculations.some(calculation => calculation.opportunityId === opportunityId)) return {
          ...current,
          opportunities: current.opportunities.map(opportunity => opportunity.id === opportunityId && opportunity.goNoGo?.decision === 'Go' ? { ...opportunity, stage: 'Calculatie' } : opportunity),
        }
        if (current.opportunities.find(item => item.id === opportunityId)?.goNoGo?.decision !== 'Go') return current
        const calculation: Calculation = { id: createId(), number: `CAL-${new Date().getFullYear()}-${String(current.calculations.length + 1).padStart(3, '0')}`, opportunityId, status: 'In opmaak', overheadPct: 8, riskPct: 2, marginPct: 10, siteOverheadPct: 0, escalationPct: 0, discountPct: 0, roundingStep: 0, chapters: [], items: [], updatedAt: todayIso() }
        return { ...current, opportunities: current.opportunities.map(opportunity => opportunity.id === opportunityId ? { ...opportunity, stage: 'Calculatie' } : opportunity), calculations: [...current.calculations, calculation] }
      })
    },
    async updateCalculation(id: string, patch: Partial<Pick<Calculation, 'overheadPct' | 'riskPct' | 'marginPct' | 'siteOverheadPct' | 'escalationPct' | 'discountPct' | 'roundingStep'>>) {
      if (api) {
        await remote(() => api.updateCalculation(id, patch), calculation => setState(current => ({ ...current, calculations: current.calculations.map(item => item.id === id ? calculation : item) })))
        return
      }
      setState(current => ({ ...current, calculations: current.calculations.map(calculation => calculation.id === id ? { ...calculation, ...patch, updatedAt: todayIso() } : calculation) }))
    },
    async addBoqItem(calculationId: string, input: Omit<BoqItem, 'id' | 'costApplications'>) {
      if (api) {
        return remote(() => api.addBoqItem(calculationId, input), item => setState(current => ({ ...current, calculations: current.calculations.map(calculation => calculation.id === calculationId ? { ...calculation, items: [...calculation.items, item], updatedAt: todayIso() } : calculation) })))
      }
      const item:BoqItem={...input,id:createId(),sortOrder:0,costApplications:{}}
      setState(current => ({ ...current, calculations: current.calculations.map(calculation => calculation.id === calculationId ? { ...calculation, items: [...calculation.items, { ...item, sortOrder: calculation.items.length }], updatedAt: todayIso() } : calculation) }))
      return item
    },
    async updateBoqItem(calculationId: string, itemId: string, patch: Partial<BoqItem>) {
      if (api) {
        await remote(() => api.updateBoqItem(calculationId, itemId, patch), item => setState(current => ({ ...current, calculations: current.calculations.map(calculation => calculation.id === calculationId ? { ...calculation, items: calculation.items.map(currentItem => currentItem.id === itemId ? item : currentItem), updatedAt: todayIso() } : calculation) })))
        return
      }
      setState(current => ({ ...current, calculations: current.calculations.map(calculation => calculation.id === calculationId ? { ...calculation, items: calculation.items.map(item => item.id === itemId ? patchBoqItem(item, patch) : item), updatedAt: todayIso() } : calculation) }))
    },
    async removeBoqItem(calculationId: string, itemId: string) {
      if (api) {
        await remote(() => api.removeBoqItem(calculationId, itemId), () => setState(current => ({ ...current, calculations: current.calculations.map(calculation => calculation.id === calculationId ? { ...calculation, items: calculation.items.filter(item => item.id !== itemId), updatedAt: todayIso() } : calculation) })))
        return
      }
      setState(current => ({ ...current, calculations: current.calculations.map(calculation => calculation.id === calculationId ? { ...calculation, items: calculation.items.filter(item => item.id !== itemId), updatedAt: todayIso() } : calculation) }))
    },
    async createCostLibraryItem(input: Omit<CostLibraryItem, 'id' | 'updatedAt'>) {
      if (api) {
        await remote(() => api.createCostLibraryItem(input), item => setState(current => ({ ...current, costLibrary: [...current.costLibrary, item] })))
        return
      }
      setState(current => current.costLibrary.some(item => item.libraryVersionId === input.libraryVersionId && item.code === input.code) ? current : { ...current, costLibrary: [...current.costLibrary, { ...input, id: createId(), updatedAt: todayIso() }] })
    },
    async createCostLibrary(input: Pick<CostLibrary, 'name' | 'description' | 'legalEntityId' | 'branchId'>) {
      if (api) { const result = await remote(() => api.createCostLibrary(input), result => setState(current => ({ ...current, costLibraries: [...current.costLibraries, result.library], costLibraryVersions: [...current.costLibraryVersions, result.version] }))); return result }
      const library: CostLibrary = { id: createId(), ...input, active: true, createdAt: todayIso() }
      const version: CostLibraryVersion = { id: createId(), libraryId: library.id, version: 1, label: 'Versie 1', status: 'Concept', effectiveFrom: todayIso(), createdAt: todayIso() }
      setState(current => ({ ...current, costLibraries: [...current.costLibraries, library], costLibraryVersions: [...current.costLibraryVersions, version] }))
      return { library, version }
    },
    async updateCostLibrary(id: string, patch: { active?: boolean; legalEntityId?: string | null; branchId?: string | null }) {
      if (api) { await remote(() => api.updateCostLibrary(id, patch), library => setState(current => ({ ...current, costLibraries: current.costLibraries.map(item => item.id === id ? library : item) }))); return }
      setState(current => ({ ...current, costLibraries: current.costLibraries.map(item => item.id === id ? { ...item, ...patch, legalEntityId: patch.legalEntityId === null ? undefined : patch.legalEntityId ?? item.legalEntityId, branchId: patch.branchId === null ? undefined : patch.branchId ?? item.branchId } : item) }))
    },
    async createUnit(input: Omit<UnitDefinition, 'id' | 'createdAt'>) {
      if (api) { await remote(() => api.createUnit(input), unit => setState(current => ({ ...current, units: [...current.units, unit] }))); return }
      setState(current => current.units.some(unit => unit.code.toLowerCase() === input.code.toLowerCase()) ? current : { ...current, units: [...current.units, { ...input, id: createId(), createdAt: todayIso() }] })
    },
    async updateUnit(id: string, patch: Partial<Pick<UnitDefinition, 'code' | 'name' | 'category' | 'active'>>) {
      if (api) { await remote(() => api.updateUnit(id, patch), unit => setState(current => ({ ...current, units: current.units.map(item => item.id === id ? unit : item) }))); return }
      setState(current => ({ ...current, units: current.units.map(unit => unit.id === id ? { ...unit, ...patch } : unit) }))
    },
    async createUnitConversion(input: Omit<UnitConversion, 'id' | 'createdAt'>) {
      if (api) { await remote(() => api.createUnitConversion(input), conversion => setState(current => ({ ...current, unitConversions: [...current.unitConversions, conversion] }))); return }
      setState(current => current.unitConversions.some(item => item.fromUnitId === input.fromUnitId && item.toUnitId === input.toUnitId) ? current : { ...current, unitConversions: [...current.unitConversions, { ...input, id: createId(), createdAt: todayIso() }] })
    },
    async bulkUpdateBoqItemsFromLibrary(calculationId: string, itemIds: string[], libraryId: string): Promise<BulkCostUpdateResult | undefined> {
      if (api) {
        return remote(() => api.bulkUpdateBoqItemsFromLibrary(calculationId, itemIds, libraryId), result => setState(current => ({ ...current, calculations: current.calculations.map(item => item.id === calculationId ? result.calculation : item) })))
      }
      return new Promise<BulkCostUpdateResult | undefined>((resolve) => setState(current => {
        const library = current.costLibraries.find(item => item.id === libraryId && item.active)
        const version = current.costLibraryVersions.filter(item => item.libraryId === libraryId && item.status === 'Gepubliceerd').sort((a, b) => b.version - a.version)[0]
        const calculation = current.calculations.find(item => item.id === calculationId)
        if (!library || !version || !calculation) { resolve(undefined); return current }
        const selected = new Set(itemIds)
        const libraryItems = current.costLibrary.filter(item => item.libraryVersionId === version.id)
        let updatedItems = 0; let updatedApplications = 0
        const items = calculation.items.map(item => {
          if (!selected.has(item.id)) return item
          const refreshed = refreshBoqItemFromLibrary(item, libraryItems, current.costLibrary, current.units, current.unitConversions)
          if (!refreshed.updatedApplications) return item
          updatedItems++; updatedApplications += refreshed.updatedApplications
          return refreshed.item
        })
        const updatedCalculation = { ...calculation, items, updatedAt: todayIso() }
        const result = { calculation: updatedCalculation, updatedItems, updatedApplications, skippedItems: itemIds.length - updatedItems }
        resolve(result)
        return { ...current, calculations: current.calculations.map(item => item.id === calculationId ? updatedCalculation : item) }
      }))
    },
    async bulkApplyBoqPriceAdjustment(calculationId: string, itemIds: string[], adjustment: BoqPriceAdjustment): Promise<BulkPriceAdjustmentResult | undefined> {
      if (api) {
        return remote(() => api.bulkApplyBoqPriceAdjustment(calculationId, itemIds, adjustment), result => setState(current => ({ ...current, calculations: current.calculations.map(item => item.id === calculationId ? result.calculation : item) })))
      }
      return new Promise<BulkPriceAdjustmentResult | undefined>(resolve => setState(current => {
        const calculation = current.calculations.find(item => item.id === calculationId)
        if (!calculation) { resolve(undefined); return current }
        const preview = bulkBoqPriceAdjustmentPreview(calculation, itemIds, adjustment)
        const result = { calculation: preview.updatedCalculation, affectedItems: preview.affectedItems, skippedItems: preview.skippedItems }
        resolve(result)
        return { ...current, calculations: current.calculations.map(item => item.id === calculationId ? preview.updatedCalculation : item) }
      }))
    },
    async createCostLibraryVersion(libraryId: string, input: { label: string; effectiveFrom: string; cloneFromVersionId?: string }) {
      if (api) { const result = await remote(() => api.createCostLibraryVersion(libraryId, input), result => setState(current => ({ ...current, costLibraryVersions: [...current.costLibraryVersions, result.version], costLibrary: [...current.costLibrary, ...result.items] }))); return result?.version }
      let created: CostLibraryVersion | undefined
      setState(current => {
        const versionNumber = Math.max(0, ...current.costLibraryVersions.filter(item => item.libraryId === libraryId).map(item => item.version)) + 1
        const version: CostLibraryVersion = { id: createId(), libraryId, version: versionNumber, label: input.label, effectiveFrom: input.effectiveFrom, status: 'Concept', createdAt: todayIso() }
        created = version
        const clonedItems = input.cloneFromVersionId ? current.costLibrary.filter(item => item.libraryVersionId === input.cloneFromVersionId).map(item => ({ ...item, id: createId(), libraryVersionId: version.id, updatedAt: todayIso() })) : []
        return { ...current, costLibraryVersions: [...current.costLibraryVersions, version], costLibrary: [...current.costLibrary, ...clonedItems] }
      })
      return created
    },
    async publishCostLibraryVersion(versionId: string) {
      if (api) { await remote(() => api.publishCostLibraryVersion(versionId), version => setState(current => ({ ...current, costLibraryVersions: current.costLibraryVersions.map(item => item.id === version.id ? version : item.libraryId === version.libraryId && item.status === 'Gepubliceerd' ? { ...item, status: 'Gearchiveerd' } : item) }))); return }
      setState(current => {
        const selected = current.costLibraryVersions.find(item => item.id === versionId)
        if (!selected) return current
        return { ...current, costLibraryVersions: current.costLibraryVersions.map(item => item.id === versionId ? { ...item, status: 'Gepubliceerd' } : item.libraryId === selected.libraryId && item.status === 'Gepubliceerd' ? { ...item, status: 'Gearchiveerd' } : item) }
      })
    },
    async updateCostLibraryItem(id: string, patch: Partial<Omit<CostLibraryItem, 'id' | 'updatedAt'>>) {
      if (api) {
        await remote(() => api.updateCostLibraryItem(id, patch), item => setState(current => ({ ...current, costLibrary: current.costLibrary.map(currentItem => currentItem.id === id ? item : currentItem) })))
        return
      }
      setState(current => ({ ...current, costLibrary: current.costLibrary.map(item => item.id === id ? { ...item, ...patch, updatedAt: todayIso() } : item) }))
    },
    async publishPostCalculationFeedback(projectId: string, input: PostCalculationFeedbackInput) {
      if (api) {
        await remote(() => api.publishPostCalculationFeedback(projectId, input), item => setState(current => ({ ...current, costLibrary: [...current.costLibrary, item] })))
        return
      }
      setState(current => {
        const project = current.projects.find(item => item.id === projectId)
        const insight = postCalculationAnalysis(current, projectId)?.itemInsights.find(item => item.boqItemId === input.boqItemId && item.category === input.category)
        if (!project || !insight || insight.actualUnitCost <= 0) return current
        const normalized = `${project.number}-${insight.code}-${input.category}`.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '')
        const code = `HIST-${normalized}`.slice(0, 50)
        if (current.costLibrary.some(item => item.code === code)) return current
        const item: CostLibraryItem = { id: createId(), code, name: `${insight.code} · ${insight.description}`, category: insight.category, unit: insight.unit, unitCost: insight.actualUnitCost, source: `Nacalculatie ${project.number} · gewogen toerekening op basis van de oorspronkelijke calculatie`, updatedAt: todayIso() }
        return { ...current, costLibrary: [...current.costLibrary, item] }
      })
    },
    async applyCostLibraryItem(calculationId: string, itemId: string, libraryItemId: string, factor: number) {
      if (api) {
        await remote(() => api.applyCostLibraryItem(calculationId, itemId, libraryItemId, factor), item => setState(current => ({ ...current, calculations: current.calculations.map(calculation => calculation.id === calculationId ? { ...calculation, items: calculation.items.map(currentItem => currentItem.id === itemId ? item : currentItem), updatedAt: todayIso() } : calculation) })))
        return
      }
      setState(current => {
        const libraryItem = current.costLibrary.find(item => item.id === libraryItemId)
        if (!libraryItem || factor <= 0) return current
        const appliedUnitCost = Number((libraryItem.unitCost * factor).toFixed(4))
        return { ...current, calculations: current.calculations.map(calculation => calculation.id === calculationId ? { ...calculation, updatedAt: todayIso(), items: calculation.items.map(item => item.id === itemId ? { ...item, [libraryItem.category]: appliedUnitCost, costApplications: { ...item.costApplications, [libraryItem.category]: { libraryItemId, factor, appliedUnitCost } } } : item) } : calculation) }
      })
    },
    async addChapter(calculationId: string, input: Pick<BoqChapter, 'code' | 'name'>) {
      if (api) {
        return remote(() => api.addChapter(calculationId, input), chapter => setState(current => ({ ...current, calculations: current.calculations.map(calculation => calculation.id === calculationId ? { ...calculation, chapters: [...calculation.chapters, chapter] } : calculation) })))
      }
      return new Promise<BoqChapter | undefined>((resolve) => setState(current => {
        const calculation = current.calculations.find(item => item.id === calculationId)
        const existing = calculation?.chapters.find(chapter => chapter.code === input.code)
        if (!calculation || existing) {
          resolve(existing)
          return current
        }
        const chapter: BoqChapter = { ...input, id: createId(), sortOrder: calculation.chapters.length }
        resolve(chapter)
        return { ...current, calculations: current.calculations.map(item => item.id === calculationId ? { ...item, chapters: [...item.chapters, chapter], updatedAt: todayIso() } : item) }
      }))
    },
    async updateCalculationStructure(calculationId: string, input: { chapters: Array<{ id: string; sortOrder: number }>; items: Array<{ id: string; chapterId?: string | null; sortOrder: number }> }) {
      if (api) {
        await remote(() => api.updateCalculationStructure(calculationId, input), calculation => setState(current => ({ ...current, calculations: current.calculations.map(item => item.id === calculationId ? calculation : item) })))
        return
      }
      const chapters = new Map(input.chapters.map(item => [item.id, item.sortOrder]))
      const items = new Map(input.items.map(item => [item.id, item]))
      setState(current => ({ ...current, calculations: current.calculations.map(calculation => calculation.id === calculationId ? { ...calculation, chapters: calculation.chapters.map(chapter => ({ ...chapter, sortOrder: chapters.get(chapter.id) ?? chapter.sortOrder })), items: calculation.items.map(item => { const next = items.get(item.id); return next ? { ...item, chapterId: next.chapterId, sortOrder: next.sortOrder } : item }), updatedAt: todayIso() } : calculation) }))
    },
    async applyCalculationTemplate(calculationId: string, templateId: string) {
      const template = class8CalculationTemplates.find(item => item.id === templateId)
      if (!template) return
      if (api) {
        await remote(() => api.applyCalculationTemplate(calculationId, template), calculation => setState(current => ({ ...current, calculations: current.calculations.map(item => item.id === calculationId ? calculation : item) })))
        return
      }
      setState(current => ({ ...current, calculations: current.calculations.map(calculation => {
        if (calculation.id !== calculationId) return calculation
        const chapters = [...calculation.chapters]
        const chapterByCode = new Map(chapters.map(chapter => [chapter.code, chapter]))
        for (const templateChapter of template.chapters) {
          if (!chapterByCode.has(templateChapter.code)) {
            const chapter: BoqChapter = { id: createId(), code: templateChapter.code, name: templateChapter.name, sortOrder: chapters.length }
            chapters.push(chapter); chapterByCode.set(chapter.code, chapter)
          }
        }
        const existingCodes = new Set(calculation.items.map(item => item.code))
        let nextSortOrder = calculation.items.length
        const additions = template.chapters.flatMap(templateChapter => templateChapter.items.filter(item => !existingCodes.has(item.code)).map(item => ({ ...item, id: createId(), chapterId: chapterByCode.get(templateChapter.code)!.id, sortOrder: nextSortOrder++, wastePct: 0, itemRiskPct: 0, markupPct: 0, notes: '', costApplications: {} })))
        return { ...calculation, chapters, items: [...calculation.items, ...additions], updatedAt: todayIso() }
      }) }))
    },
    async createCalculationVersion(calculationId: string, input: { label: string; reason: string }) {
      if (api) {
        await remote(() => api.createCalculationVersion(calculationId, input), version => setState(current => ({ ...current, calculationVersions: [...current.calculationVersions, version] })))
        return
      }
      setState(current => {
        const calculation = current.calculations.find(item => item.id === calculationId)
        if (!calculation) return current
        return { ...current, calculationVersions: [...current.calculationVersions, { id: createId(), calculationId, version: current.calculationVersions.filter(item => item.calculationId === calculationId).length + 1, ...input, snapshot: structuredClone(calculation), createdAt: todayIso(), createdBy: 'local' }] }
      })
    },
    async createCalculationScenario(calculationId: string, input: Omit<CalculationScenario, 'id' | 'calculationId' | 'isSelected' | 'updatedAt'>) {
      if (api) {
        await remote(() => api.createCalculationScenario(calculationId, input), scenario => setState(current => ({ ...current, calculationScenarios: [...current.calculationScenarios, scenario] })))
        return
      }
      setState(current => {
        if (current.calculationScenarios.some(scenario => scenario.calculationId === calculationId && scenario.name === input.name)) return current
        const hasSelected = current.calculationScenarios.some(scenario => scenario.calculationId === calculationId && scenario.isSelected)
        return { ...current, calculationScenarios: [...current.calculationScenarios, { ...input, id: createId(), calculationId, isSelected: !hasSelected, updatedAt: todayIso() }] }
      })
    },
    async createPresetScenarios(calculationId: string) {
      if (api) {
        await remote(() => api.createPresetScenarios(calculationId), scenarios => setState(current => ({ ...current, calculationScenarios: [...current.calculationScenarios.filter(item => item.calculationId !== calculationId), ...scenarios] })))
        return
      }
      setState(current => {
        if (current.calculationScenarios.some(scenario => scenario.calculationId === calculationId)) return current
        const calculation = current.calculations.find(item => item.id === calculationId)
        if (!calculation) return current
        const base = { calculationId, updatedAt: todayIso(), marginPct: calculation.marginPct }
        const scenarios: CalculationScenario[] = [
          { ...base, id: createId(), name: 'Verwacht', description: 'Meest waarschijnlijke uitvoering op basis van de huidige calculatie.', laborAdjustmentPct: 0, materialAdjustmentPct: 0, equipmentAdjustmentPct: 0, subcontractingAdjustmentPct: 0, overheadPct: calculation.overheadPct, riskPct: calculation.riskPct, isSelected: true },
          { ...base, id: createId(), name: 'Conservatief', description: 'Extra buffer voor productiviteit, marktprijzen en uitvoeringsrisico.', laborAdjustmentPct: 8, materialAdjustmentPct: 6, equipmentAdjustmentPct: 10, subcontractingAdjustmentPct: 5, overheadPct: calculation.overheadPct, riskPct: Math.max(calculation.riskPct, 7), isSelected: false },
          { ...base, id: createId(), name: 'Optimistisch', description: 'Gunstige productiviteit, inkoop en materieelinzet.', laborAdjustmentPct: -5, materialAdjustmentPct: -3, equipmentAdjustmentPct: -5, subcontractingAdjustmentPct: 0, overheadPct: Math.max(0, calculation.overheadPct - 1), riskPct: Math.max(0, calculation.riskPct - 2), isSelected: false },
        ]
        return { ...current, calculationScenarios: [...current.calculationScenarios, ...scenarios] }
      })
    },
    async updateCalculationScenario(calculationId: string, scenarioId: string, patch: Partial<Omit<CalculationScenario, 'id' | 'calculationId' | 'isSelected' | 'updatedAt'>>) {
      if (api) {
        await remote(() => api.updateCalculationScenario(calculationId, scenarioId, patch), scenario => setState(current => ({ ...current, calculationScenarios: current.calculationScenarios.map(item => item.id === scenarioId ? scenario : item) })))
        return
      }
      setState(current => ({ ...current, calculationScenarios: current.calculationScenarios.map(scenario => scenario.id === scenarioId && scenario.calculationId === calculationId ? { ...scenario, ...patch, updatedAt: todayIso() } : scenario) }))
    },
    async selectCalculationScenario(calculationId: string, scenarioId: string) {
      if (api) {
        await remote(() => api.selectCalculationScenario(calculationId, scenarioId), selected => setState(current => ({ ...current, calculationScenarios: current.calculationScenarios.map(scenario => scenario.calculationId === calculationId ? { ...scenario, isSelected: scenario.id === selected.id, updatedAt: scenario.id === selected.id ? selected.updatedAt : scenario.updatedAt } : scenario) })))
        return
      }
      setState(current => ({ ...current, calculationScenarios: current.calculationScenarios.map(scenario => scenario.calculationId === calculationId ? { ...scenario, isSelected: scenario.id === scenarioId, updatedAt: scenario.id === scenarioId ? todayIso() : scenario.updatedAt } : scenario) }))
    },
    async previewBoqImport(calculationId: string, file: File): Promise<BoqImportPreview | undefined> {
      if (!api) return parseBoqFileLocally(file)
      return remote(() => api.previewBoqImport(calculationId, file), () => undefined)
    },
    async importBoq(calculationId: string, file: File) {
      if (!api) {
        const preview = await parseBoqFileLocally(file)
        if (preview.errors.length || !preview.rows.length) return false
        let imported = false
        setState(current => ({
          ...current,
          calculations: current.calculations.map(calculation => {
            if (calculation.id !== calculationId) return calculation
            imported = true
            const chapters = [...calculation.chapters]
            const chaptersByCode = new Map(chapters.map(chapter => [chapter.code, chapter]))
            for (const row of preview.rows) {
              if (chaptersByCode.has(row.chapterCode)) continue
              const chapter: BoqChapter = { id: createId(), code: row.chapterCode, name: row.chapterName, sortOrder: chapters.length }
              chapters.push(chapter)
              chaptersByCode.set(chapter.code, chapter)
            }
            const items: BoqItem[] = preview.rows.map(row => ({
              id: createId(),
              chapterId: chaptersByCode.get(row.chapterCode)!.id,
              code: row.code,
              description: row.description,
              quantity: row.quantity,
              unit: row.unit,
              labor: row.labor,
              material: row.material,
              equipment: row.equipment,
              subcontracting: row.subcontracting,
            }))
            return { ...calculation, chapters, items: [...calculation.items, ...items], updatedAt: todayIso() }
          }),
        }))
        return imported
      }
      const result = await remote(() => api.importBoq(calculationId, file), calculation => setState(current => ({ ...current, calculations: current.calculations.map(item => item.id === calculationId ? calculation : item) })))
      return Boolean(result)
    },
    async createQuote(calculationId: string, content: QuoteContent) {
      if (api) {
        await remote(() => api.createQuote(calculationId, content), quote => setState(current => {
          return { ...current, calculations: current.calculations.map(item => item.id === calculationId ? { ...item, status: 'Offerte' } : item), quotes: [...current.quotes, quote] }
        }))
        return
      }
      setState(current => {
        const calculation = current.calculations.find(item => item.id === calculationId)
        if (!calculation?.items.length) return current
        const version = current.quotes.filter(quote => quote.calculationId === calculationId).length + 1
        const scenario = current.calculationScenarios.find(item => item.calculationId === calculationId && item.isSelected)
        const calculatedTotal = scenario ? scenarioSellingTotal(calculation, scenario) : sellingTotal(calculation)
        const opportunity = current.opportunities.find(item => item.id === calculation.opportunityId)!
        const organization = current.organizations.find(item => item.id === opportunity.organizationId)!
        const overheadPct = scenario?.overheadPct ?? calculation.overheadPct
        const riskPct = scenario?.riskPct ?? calculation.riskPct
        const marginPct = scenario?.marginPct ?? calculation.marginPct
        const commercialFactor = (1 + (overheadPct + riskPct) / 100) / (1 - marginPct / 100)
        const chapters = new Map(calculation.chapters.map(chapter => [chapter.id, chapter.code]))
        const lines = calculation.items.map(item => {
          const directUnitCost = scenario ? item.labor * (1 + scenario.laborAdjustmentPct / 100) + item.material * (1 + scenario.materialAdjustmentPct / 100) + item.equipment * (1 + scenario.equipmentAdjustmentPct / 100) + item.subcontracting * (1 + scenario.subcontractingAdjustmentPct / 100) : item.labor + item.material + item.equipment + item.subcontracting
          const unitPrice = Number((directUnitCost * commercialFactor).toFixed(4))
          return { chapterCode: item.chapterId ? chapters.get(item.chapterId) : undefined, code: item.code, description: item.description, quantity: item.quantity, unit: item.unit, unitPrice, total: Number((item.quantity * unitPrice).toFixed(2)) }
        })
        const total = Number(calculatedTotal.toFixed(2))
        const quoteContent = { ...content, subject: content.subject || `Offerte voor ${opportunity.title}` }
        const snapshot = { supplierName: 'BouwFlow Demo', clientName: organization.name, clientContact: organization.contactName, projectTitle: opportunity.title, projectNumber: opportunity.projectNumber, location: opportunity.location, scenarioName: scenario?.name, lines, directCost: Number((scenario ? scenarioDirectCost(calculation, scenario) : directCost(calculation)).toFixed(2)), overheadPct, riskPct, marginPct, total }
        const createdAt=todayIso();const validUntil=addDays(createdAt.slice(0,10),quoteContent.validityDays);const quote:Quote={id:createId(),number:`OFF-${new Date().getFullYear()}-${String(current.quotes.length+1).padStart(3,'0')}`,calculationId,scenarioId:scenario?.id,version,total,content:{...quoteContent,validUntil},snapshot,createdAt,workflow:{status:'Concept',validUntil,events:[{id:createId(),type:'Aangemaakt',at:createdAt,actor:'Calculatieteam'}]}}
        return { ...current, calculations: current.calculations.map(item => item.id === calculationId ? { ...item, status: 'Offerte' } : item), quotes: [...current.quotes, quote] }
      })
    },
    async approveQuote(id:string,approvedBy:string){if(api){await remote(()=>api.approveQuote(id,approvedBy),result=>setState(current=>({...current,quotes:current.quotes.map(item=>item.id===id?result:item)})));return}const now=todayIso();setState(current=>({...current,quotes:current.quotes.map(item=>item.id===id&&item.workflow?.status==='Concept'?{...item,workflow:{...item.workflow,status:'Intern goedgekeurd',approvedBy,approvedAt:now,events:[...item.workflow.events,{id:createId(),type:'Goedgekeurd',at:now,actor:approvedBy}]}}:item)}))},
    async sendQuote(id:string,sentTo:string,sentBy:string){if(api){await remote(()=>api.sendQuote(id,sentTo,sentBy),result=>setState(current=>{const calculation=current.calculations.find(item=>item.id===result.calculationId);return{...current,quotes:current.quotes.map(item=>item.id===id?result:item),opportunities:current.opportunities.map(item=>item.id===calculation?.opportunityId?{...item,stage:'Offerte verstuurd'}:item)}}));return}const now=todayIso();setState(current=>{const quote=current.quotes.find(item=>item.id===id);const calculation=current.calculations.find(item=>item.id===quote?.calculationId);return{...current,quotes:current.quotes.map(item=>item.id===id&&item.workflow?.status==='Intern goedgekeurd'?{...item,workflow:{...item.workflow,status:'Verzonden',sentTo,sentAt:now,reminderAt:addDays(now.slice(0,10),7),events:[...item.workflow.events,{id:createId(),type:'Verzonden',at:now,actor:sentBy,detail:sentTo}]}}:item),opportunities:current.opportunities.map(item=>item.id===calculation?.opportunityId?{...item,stage:'Offerte verstuurd'}:item)}})},
    async remindQuote(id:string,sentBy:string){if(api){await remote(()=>api.remindQuote(id,sentBy),result=>setState(current=>({...current,quotes:current.quotes.map(item=>item.id===id?result:item)})));return}const now=todayIso();setState(current=>({...current,quotes:current.quotes.map(item=>item.id===id&&['Verzonden','Geopend'].includes(item.workflow?.status??'')?{...item,workflow:{...item.workflow!,reminderAt:addDays(now.slice(0,10),7),events:[...item.workflow!.events,{id:createId(),type:'Herinnerd',at:now,actor:sentBy,detail:item.workflow!.sentTo}]}}:item)}))},
    async markQuoteOpened(id:string){if(api){await remote(()=>api.markQuoteOpened(id),result=>setState(current=>({...current,quotes:current.quotes.map(item=>item.id===id?result:item)})));return}const now=todayIso();setState(current=>({...current,quotes:current.quotes.map(item=>item.id===id&&item.workflow?.status==='Verzonden'?{...item,workflow:{...item.workflow,status:'Geopend',openedAt:now,events:[...item.workflow.events,{id:createId(),type:'Geopend',at:now,actor:'Klantportaal'}]}}:item)}))},
    async signQuote(id:string,signedBy:string){if(api){await remote(()=>api.signQuote(id,signedBy),result=>setState(current=>({...current,quotes:current.quotes.map(item=>item.id===id?result:item)})));return}const now=todayIso();setState(current=>({...current,quotes:current.quotes.map(item=>item.id===id&&['Verzonden','Geopend'].includes(item.workflow?.status??'')?{...item,workflow:{...item.workflow!,status:'Ondertekend',signedBy,signedAt:now,events:[...item.workflow!.events,{id:createId(),type:'Ondertekend',at:now,actor:signedBy}]}}:item)}))},
    async loseQuote(id:string,reason:string,recordedBy:string){if(api){await remote(()=>api.loseQuote(id,reason,recordedBy),result=>setState(current=>{const calculation=current.calculations.find(item=>item.id===result.calculationId);return{...current,quotes:current.quotes.map(item=>item.id===id?result:item),opportunities:current.opportunities.map(item=>item.id===calculation?.opportunityId?{...item,stage:'Verloren',probability:0}:item)}}));return}const now=todayIso();setState(current=>{const quote=current.quotes.find(item=>item.id===id);const calculation=current.calculations.find(item=>item.id===quote?.calculationId);return{...current,quotes:current.quotes.map(item=>item.id===id&&item.workflow&&!['Ondertekend','Verloren'].includes(item.workflow.status)?{...item,workflow:{...item.workflow,status:'Verloren',lossReason:reason,events:[...item.workflow.events,{id:createId(),type:'Verloren',at:now,actor:recordedBy,detail:reason}]}}:item),opportunities:current.opportunities.map(item=>item.id===calculation?.opportunityId?{...item,stage:'Verloren',probability:0}:item)}})},
    async downloadQuotePdf(quoteId: string) {
      if (!api) return undefined
      return remote(() => api.downloadQuotePdf(quoteId), () => undefined)
    },
    async awardCalculation(calculationId: string) {
      if (api) {
        await remote(() => api.award(calculationId), project => setState(current => {
          const calculation = current.calculations.find(item => item.id === calculationId)
          return { ...current, opportunities: current.opportunities.map(item => item.id === calculation?.opportunityId ? { ...item, stage: 'Gewonnen', probability: 100 } : item), projects: current.projects.some(item => item.id === project.id) ? current.projects : [...current.projects, project] }
        }))
        return
      }
      setState(current => {
        if (current.projects.some(project => project.sourceCalculationId === calculationId)) return current
        const calculation = current.calculations.find(item => item.id === calculationId)
        const opportunity = current.opportunities.find(item => item.id === calculation?.opportunityId)
        if (!calculation || !opportunity || !current.quotes.some(quote => quote.calculationId === calculationId)) return current
        const quote = current.quotes.filter(item => item.calculationId === calculationId).at(-1)!
        const scenario = current.calculationScenarios.find(item => item.id === quote.scenarioId)
        const contractValue = quote.total
        const marginPct = scenario?.marginPct ?? calculation.marginPct
        const costBudget = Number((contractValue * (1 - marginPct / 100)).toFixed(2))
        const chapterById = new Map(calculation.chapters.map(chapter => [chapter.id, chapter]))
        const valueByCode = new Map(quote.snapshot.lines.map(line => [line.code, line.total]))
        const groups = new Map<string, { code: string; name: string; value: number }>()
        for (const item of calculation.items) {
          const chapter = item.chapterId ? chapterById.get(item.chapterId) : undefined
          const key = chapter?.id ?? 'unassigned'
          const group = groups.get(key) ?? { code: chapter?.code ?? '00', name: chapter?.name ?? 'Niet toegewezen', value: 0 }
          group.value += valueByCode.get(item.code) ?? 0
          groups.set(key, group)
        }
        const grouped = [...groups.values()]
        const totalValue = grouped.reduce((sum, group) => sum + group.value, 0)
        let allocated = 0
        const workPackages: ProjectWorkPackage[] = grouped.map((group, index) => {
          const budget = index === grouped.length - 1 ? Number((costBudget - allocated).toFixed(2)) : Number((costBudget * (totalValue ? group.value / totalValue : 1 / grouped.length)).toFixed(2))
          allocated += budget
          return { id: createId(), code: group.code, name: group.name, budget, plannedHours: 0, status: 'Niet gestart' }
        })
        const handover = emptyHandover()
        if ((scenario?.riskPct ?? calculation.riskPct) > 0) handover.risks.push(`Calculatierisico van ${scenario?.riskPct ?? calculation.riskPct}% actief opvolgen.`)
        handover.risks.push(...quote.content.exclusions.map(exclusion => `Contractuele uitsluiting bewaken: ${exclusion}`))
        const legalEntity = current.legalEntities.find(item => item.id === opportunity.legalEntityId && item.active) ?? current.legalEntities.find(item => item.active)
        const branch = current.companyBranches.find(item => item.id === opportunity.branchId && item.legalEntityId === legalEntity?.id) ?? current.companyBranches.find(item => item.legalEntityId === legalEntity?.id)
        return { ...current, opportunities: current.opportunities.map(item => item.id === opportunity.id ? { ...item, stage: 'Gewonnen', probability: 100 } : item), projects: [...current.projects, { id: createId(), number: `PRJ-${new Date().getFullYear()}-${String(current.projects.length + 1).padStart(3, '0')}`, name: opportunity.title, organizationId: opportunity.organizationId, legalEntityId: legalEntity?.id, branchId: branch?.id, sourceCalculationId: calculationId, contractValue, costBudget, marginPct, progress: 0, status: 'Opstart', handover, workPackages, planning: emptyPlanning() }] }
      })
    },
    async updateProjectStartup(projectId: string, input: ProjectStartupInput) {
      if (api) {
        await remote(() => api.updateProjectStartup(projectId, input), project => setState(current => ({ ...current, projects: current.projects.map(item => item.id === projectId ? project : item) })))
        return
      }
      setState(current => ({ ...current, projects: current.projects.map(project => project.id === projectId ? { ...project, handover: { ...input.handover, acceptedAt: input.handover.status === 'Aanvaard' ? project.handover.acceptedAt ?? todayIso() : undefined }, workPackages: project.workPackages.map(workPackage => { const update = input.workPackages.find(item => item.id === workPackage.id); return update ? { ...workPackage, plannedHours: update.plannedHours, status: update.status } : workPackage }) } : project) }))
    },
    async updateProjectDetails(projectId: string, input: ProjectDetailsInput) {
      if (api) { await remote(() => api.updateProjectDetails(projectId, input), result => setState(current => ({ ...current, projects: current.projects.map(item => item.id === projectId ? result : item) }))); return }
      setState(current => ({ ...current, projects: current.projects.map(item => item.id === projectId ? { ...item, ...input } : item) }))
    },
    async generateProjectPlanning(projectId: string) {
      if (api) {
        await remote(() => api.generateProjectPlanning(projectId), project => setState(current => ({ ...current, projects: current.projects.map(item => item.id === projectId ? project : item) })))
        return
      }
      setState(current => ({ ...current, projects: current.projects.map(project => {
        if (project.id !== projectId || project.handover.status !== 'Aanvaard' || !project.handover.plannedStart || !project.handover.plannedEnd || project.planning.activities.length) return project
        const start = new Date(`${project.handover.plannedStart}T00:00:00.000Z`).getTime()
        const end = new Date(`${project.handover.plannedEnd}T00:00:00.000Z`).getTime()
        const spanDays = Math.max(1, Math.floor((end - start) / 86_400_000) + 1)
        const hoursWeight = project.workPackages.reduce((sum, workPackage) => sum + workPackage.plannedHours, 0)
        const totalWeight = hoursWeight || project.workPackages.reduce((sum, workPackage) => sum + workPackage.budget, 0) || project.workPackages.length
        let cumulativeWeight = 0
        let previousEndOffset = -1
        const activities: PlanningActivity[] = project.workPackages.map((workPackage, index) => {
          const weight = hoursWeight ? workPackage.plannedHours : workPackage.budget || 1
          const startOffset = index === 0 ? 0 : Math.min(spanDays - 1, previousEndOffset + 1)
          cumulativeWeight += weight
          const endOffset = Math.min(spanDays - 1, index === project.workPackages.length - 1 ? spanDays - 1 : Math.max(startOffset, Math.round(spanDays * cumulativeWeight / totalWeight) - 1))
          previousEndOffset = endOffset
          return { id: createId(), workPackageId: workPackage.id, name: `${workPackage.code} · ${workPackage.name}`, startDate: addDays(project.handover.plannedStart, startOffset), endDate: addDays(project.handover.plannedStart, endOffset), progress: 0, predecessorIds: [], milestone: false, responsible: project.handover.projectManager, responsibleEmployeeId: project.handover.projectManagerEmployeeId, crewSize: 0, weatherSensitive: false, resourceAssignments: [] }
        })
        activities.forEach((activity, index) => { if (index > 0) activity.predecessorIds = [activities[index - 1].id] })
        const lastActivity = activities.at(-1)
        activities.push({ id: createId(), name: 'Mijlpaal · einde werken', startDate: project.handover.plannedEnd, endDate: project.handover.plannedEnd, progress: 0, predecessorIds: lastActivity ? [lastActivity.id] : [], milestone: true, responsible: project.handover.projectManager, responsibleEmployeeId: project.handover.projectManagerEmployeeId, crewSize: 0, weatherSensitive: false, resourceAssignments: [] })
        return { ...project, planning: { status: 'Concept', baselineVersion: 0, activities, updatedAt: todayIso() } }
      }) }))
    },
    async updateProjectPlanning(projectId: string, input: ProjectPlanningInput) {
      if (api) {
        await remote(() => api.updateProjectPlanning(projectId, input), project => setState(current => ({ ...current, projects: current.projects.map(item => item.id === projectId ? project : item) })))
        return
      }
      setState(current => ({ ...current, projects: current.projects.map(project => {
        if (project.id !== projectId) return project
        const activities = project.planning.activities.map(activity => { const update = input.activities.find(item => item.id === activity.id); return update ? { ...activity, name: update.name, startDate: update.startDate, endDate: update.endDate, progress: update.progress, predecessorIds: update.predecessorIds, dependencies: update.dependencies, responsible: update.responsible, responsibleEmployeeId: update.responsibleEmployeeId, crewSize: update.crewSize, weatherSensitive: update.weatherSensitive, resourceAssignments: update.resourceAssignments } : activity })
        const changed = project.planning.baselineVersion > 0 && activities.some(activity => activity.startDate !== activity.baselineStartDate || activity.endDate !== activity.baselineEndDate)
        return { ...project, planning: { ...project.planning, activities, scenarios: input.scenarios ?? project.planning.scenarios ?? [], selectedScenarioId: input.selectedScenarioId, status: project.planning.baselineVersion ? changed ? 'Gewijzigd' : 'Baseline' : 'Concept', updatedAt: todayIso() } }
      }) }))
    },
    async baselineProjectPlanning(projectId: string, input: ProjectBaselineInput = {}) {
      if (api) {
        await remote(() => api.baselineProjectPlanning(projectId, input), project => setState(current => ({ ...current, projects: current.projects.map(item => item.id === projectId ? project : item) })))
        return
      }
      setState(current => ({ ...current, projects: current.projects.map(project => {
        if (project.id !== projectId || !project.planning.activities.length) return project
        const createdAt = todayIso()
        const version = project.planning.baselineVersion + 1
        const sourceHistory = project.planning.baselineHistory?.length ? project.planning.baselineHistory : project.planning.baselineVersion ? [{
          version: project.planning.baselineVersion,
          name: `Baseline B${project.planning.baselineVersion}`,
          reason: 'Bestaande referentieplanning',
          approvalStatus: 'Goedgekeurd' as const,
          createdAt: project.planning.updatedAt,
          createdBy: 'Projectteam',
          activities: project.planning.activities.map(activity => ({ activityId: activity.id, startDate: activity.baselineStartDate ?? activity.startDate, endDate: activity.baselineEndDate ?? activity.endDate })),
        }] : []
        const previousHistory = sourceHistory.map(item => item.approvalStatus === 'Goedgekeurd' ? { ...item, approvalStatus: 'Vervangen' as const } : item)
        const baseline = {
          version,
          name: input.name?.trim() || `Baseline B${version}`,
          reason: input.reason?.trim() || 'Nieuwe goedgekeurde referentieplanning',
          approvalStatus: input.approvalStatus ?? 'Goedgekeurd' as const,
          createdAt,
          createdBy: current.companyUsers.find(item => item.id === current.currentUserId)?.displayName ?? 'Huidige gebruiker',
          activities: project.planning.activities.map(activity => ({ activityId: activity.id, startDate: activity.startDate, endDate: activity.endDate })),
        }
        return { ...project, planning: { ...project.planning, status: 'Baseline', baselineVersion: version, updatedAt: createdAt, baselineHistory: [...previousHistory, baseline], activities: project.planning.activities.map(activity => ({ ...activity, baselineStartDate: activity.startDate, baselineEndDate: activity.endDate })) } }
      }) }))
    },
    async createDailyReport(projectId: string, input: DailyReportInput) {
      if (api) {
        await remote(() => api.createDailyReport(projectId, input), report => setState(current => ({ ...current, dailyReports: [report, ...current.dailyReports] })))
        return
      }
      setState(current => {
        if (current.dailyReports.some(report => report.projectId === projectId && report.date === input.date)) return current
        const report: DailyReport = { id: createId(), projectId, ...input, status: 'Concept', createdAt: todayIso() }
        return { ...current, dailyReports: [report, ...current.dailyReports] }
      })
    },
    async listLidarScans(projectId:string){if(!api)return [];return (await remote(()=>api.listLidarScans(projectId),()=>undefined))??[]},
    async createLidarScan(projectId:string,input:LidarScanInput&{controlPoints?:LidarControlPoint[];observations?:LidarElementObservation[]}){if(!api)return undefined;return remote(()=>api.createLidarScan(projectId,input),()=>undefined)},
    async uploadLidarArtifact(scanId:string,file:File,input:{kind:LidarArtifact['kind'];capturedAt:string}){if(!api)return undefined;return remote(()=>api.uploadLidarArtifact(scanId,file,input),()=>undefined)},
    async registerLidarScan(scanId:string,controlPoints:LidarControlPoint[],registeredBy:string){if(!api)return undefined;return remote(()=>api.registerLidarScan(scanId,controlPoints,registeredBy),()=>undefined)},
    async analyzeLidarScan(scanId:string,observations:LidarElementObservation[]){if(!api)return undefined;return remote(()=>api.analyzeLidarScan(scanId,observations),()=>undefined)},
    async approveLidarProposal(scanId:string,proposalId:string,approvedBy:string){if(!api)return undefined;return remote(()=>api.approveLidarProposal(scanId,proposalId,approvedBy),()=>undefined)},
    async createLidarBcfTopic(scanId:string,input:Omit<LidarBcfTopic,'id'|'scanSessionId'|'status'|'createdAt'>){if(!api)return undefined;return remote(()=>api.createLidarBcfTopic(scanId,input),()=>undefined)},
    async publishLidarAsBuilt(scanId:string,createdBy:string){if(!api)return undefined;return remote(()=>api.publishLidarAsBuilt(scanId,createdBy),()=>undefined)},
    async updateDailyReport(reportId: string, input: DailyReportInput) {
      if (api) {
        await remote(() => api.updateDailyReport(reportId, input), report => setState(current => ({ ...current, dailyReports: current.dailyReports.map(item => item.id === reportId ? report : item) })))
        return
      }
      setState(current => ({ ...current, dailyReports: current.dailyReports.map(report => report.id === reportId && report.status === 'Concept' ? { ...report, ...input } : report) }))
    },
    async submitDailyReport(reportId: string) {
      if (api) {
        await remote(() => api.submitDailyReport(reportId), report => setState(current => ({ ...current, dailyReports: current.dailyReports.map(item => item.id === reportId ? report : item) })))
        return
      }
      setState(current => ({ ...current, dailyReports: current.dailyReports.map(report => report.id === reportId && report.status === 'Concept' && Boolean(report.activities || report.delays || report.problems) && Boolean(report.laborEntries.length || report.subcontractors.length) ? { ...report, status: 'Ingediend', submittedAt: todayIso() } : report) }))
    },
    async signDailyReport(reportId: string, signedBy: string) {
      if (api) {
        await remote(() => api.signDailyReport(reportId, signedBy), report => setState(current => ({ ...current, dailyReports: current.dailyReports.map(item => item.id === reportId ? report : item) })))
        return
      }
      setState(current => ({ ...current, dailyReports: current.dailyReports.map(report => report.id === reportId && report.status === 'Ingediend' ? { ...report, status: 'Ondertekend', signedBy, signedAt: todayIso() } : report) }))
    },
    async uploadSitePhoto(reportId: string, file: File, input: SitePhotoInput) {
      if (!api) return false
      const result = await remote(() => api.uploadSitePhoto(reportId, file, input), photo => setState(current => ({ ...current, sitePhotos: [photo, ...current.sitePhotos] })))
      return Boolean(result)
    },
    async downloadSitePhoto(photoId: string) {
      if (!api) return undefined
      return remote(() => api.downloadSitePhoto(photoId), () => undefined)
    },
    async deleteSitePhoto(photoId: string) {
      if (!api) return
      await remote(() => api.deleteSitePhoto(photoId), () => setState(current => ({ ...current, sitePhotos: current.sitePhotos.filter(photo => photo.id !== photoId) })))
    },
    async uploadDocument(projectId: string, file: File, input: DocumentUploadInput) {
      if (api) {
        const result = await remote(() => api.uploadDocument(projectId, file, input), document => setState(current => ({ ...current, documents: [document, ...current.documents] })))
        return Boolean(result)
      }
      const documentId = createId()
      const versionId = createId()
      const createdAt = todayIso()
      const document: ProjectDocument = { id: documentId, projectId, title: input.title, category: input.category, status: 'Concept', currentVersionId: versionId, versions: [{ id: versionId, documentId, revision: 1, revisionLabel: 'R1', fileName: file.name, mimeType: file.type || 'application/octet-stream', sizeBytes: file.size, notes: input.notes, uploadedBy: input.uploadedBy, createdAt }], recipients: [], createdAt }
      setState(current => ({ ...current, documents: [document, ...current.documents] }))
      return true
    },
    async uploadDocumentRevision(documentId: string, file: File, input: DocumentRevisionInput) {
      if (api) {
        const result = await remote(() => api.uploadDocumentRevision(documentId, file, input), document => setState(current => ({ ...current, documents: current.documents.map(item => item.id === documentId ? document : item) })))
        return Boolean(result)
      }
      setState(current => ({ ...current, documents: current.documents.map(document => {
        if (document.id !== documentId) return document
        const now = todayIso()
        const revision = Math.max(0, ...document.versions.map(version => version.revision)) + 1
        const versionId = createId()
        return { ...document, status: 'Concept', currentVersionId: versionId, approvedBy: undefined, approvedAt: undefined, versions: [{ id: versionId, documentId, revision, revisionLabel: `R${revision}`, fileName: file.name, mimeType: file.type || 'application/octet-stream', sizeBytes: file.size, notes: input.notes, uploadedBy: input.uploadedBy, createdAt: now }, ...document.versions.map(version => version.id === document.currentVersionId ? { ...version, supersededAt: now } : version)] }
      }) }))
      return true
    },
    async downloadDocumentVersion(versionId: string) {
      if (!api) {
        const version = state.documents.flatMap(document => document.versions).find(item => item.id === versionId)
        return version ? demoDocumentBlob(version) : undefined
      }
      return remote(() => api.downloadDocumentVersion(versionId), () => undefined)
    },
    async verifyDocumentVersionIntegrity(versionId: string) {
      if (!api) return undefined
      return remote(() => api.verifyDocumentVersionIntegrity(versionId), () => undefined)
    },
    async submitDocument(id: string) {
      if (api) { await remote(() => api.submitDocument(id), result => setState(current => ({ ...current, documents: current.documents.map(item => item.id === id ? result : item) }))); return }
      setState(current => ({ ...current, documents: current.documents.map(item => item.id === id && item.status === 'Concept' ? { ...item, status: 'Ter goedkeuring' } : item) }))
    },
    async updateDocumentMetadata(id: string, input: DocumentMetadataInput) {
      if (api) { await remote(() => api.updateDocumentMetadata(id, input), result => setState(current => ({ ...current, documents: current.documents.map(item => item.id === id ? result : item) }))); return }
      setState(current => ({ ...current, documents: current.documents.map(item => item.id === id && !item.immutable ? { ...item, ...input } : item) }))
    },
    async approveDocument(id: string, approvedBy: string) {
      if (api) { await remote(() => api.approveDocument(id, approvedBy), result => setState(current => ({ ...current, documents: current.documents.map(item => item.id === id ? result : item) }))); return }
      setState(current => ({ ...current, documents: current.documents.map(item => item.id === id && item.status === 'Ter goedkeuring' ? { ...item, status: 'Goedgekeurd', approvedBy, approvedAt: todayIso() } : item) }))
    },
    async distributeDocument(id: string, input: DocumentDistributionInput) {
      if (api) { await remote(() => api.distributeDocument(id, input), result => setState(current => ({ ...current, documents: current.documents.map(item => item.id === id ? result : item) }))); return }
      setState(current => ({ ...current, documents: current.documents.map(item => item.id === id && item.status === 'Goedgekeurd' ? { ...item, recipients: [...input.recipients.map(recipient => ({ id: createId(), documentId: id, versionId: item.currentVersionId, ...recipient, deliveredAt: todayIso() })), ...item.recipients] } : item) }))
    },
    async markDocumentRead(recipientId: string) {
      if (api) { await remote(() => api.markDocumentRead(recipientId), result => setState(current => ({ ...current, documents: current.documents.map(document => ({ ...document, recipients: document.recipients.map(item => item.id === recipientId ? result : item) })) }))); return }
      setState(current => ({ ...current, documents: current.documents.map(document => ({ ...document, recipients: document.recipients.map(item => item.id === recipientId && !item.readAt ? { ...item, readAt: todayIso() } : item) })) }))
    },
    async linkDocumentRecord(documentId: string, input: DocumentRecordLinkInput) {
      if (api) { await remote(() => api.linkDocumentRecord(documentId, input), result => setState(current => ({ ...current, documents: current.documents.map(item => item.id === documentId ? result : item) }))); return }
      setState(current => ({ ...current, documents: current.documents.map(item => item.id === documentId ? { ...item, links: [{ id:createId(), documentId, ...input, createdAt:new Date().toISOString() }, ...(item.links ?? [])] } : item) }))
    },
    async unlinkDocumentRecord(documentId: string, linkId: string) {
      if (api) { await remote(() => api.unlinkDocumentRecord(documentId, linkId), result => setState(current => ({ ...current, documents: current.documents.map(item => item.id === documentId ? result : item) }))); return }
      setState(current => ({ ...current, documents: current.documents.map(item => item.id === documentId ? { ...item, links: (item.links ?? []).filter(link => link.id !== linkId) } : item) }))
    },
    async createQhseCertificate(projectId: string, input: QhseCertificateInput) {
      if (api) { await remote(() => api.createQhseCertificate(projectId, input), result => setState(current => ({ ...current, qhseCertificates: [result, ...current.qhseCertificates] }))); return }
      const certificate: QhseCertificate = { id: createId(), projectId, ...input, createdAt: todayIso() }
      setState(current => ({ ...current, qhseCertificates: [certificate, ...current.qhseCertificates] }))
    },
    async createQhseInspection(projectId: string, input: QhseInspectionInput) {
      if (api) { await remote(() => api.createQhseInspection(projectId, input), result => setState(current => ({ ...current, qhseInspections: [result, ...current.qhseInspections] }))); return }
      const inspection: QhseInspection = { id: createId(), projectId, ...input, status: 'Open', createdAt: todayIso() }
      setState(current => ({ ...current, qhseInspections: [inspection, ...current.qhseInspections] }))
    },
    async resolveQhseFinding(inspectionId: string, findingId: string) {
      if (api) { await remote(() => api.resolveQhseFinding(inspectionId, findingId), result => setState(current => ({ ...current, qhseInspections: current.qhseInspections.map(item => item.id === inspectionId ? result : item) }))); return }
      setState(current => ({ ...current, qhseInspections: current.qhseInspections.map(inspection => inspection.id === inspectionId && inspection.status === 'Open' ? { ...inspection, findings: inspection.findings.map(finding => finding.id === findingId && !finding.resolvedAt ? { ...finding, resolvedAt: todayIso() } : finding) } : inspection) }))
    },
    async closeQhseInspection(id: string) {
      if (api) { await remote(() => api.closeQhseInspection(id), result => setState(current => ({ ...current, qhseInspections: current.qhseInspections.map(item => item.id === id ? result : item) }))); return }
      setState(current => ({ ...current, qhseInspections: current.qhseInspections.map(item => item.id === id && item.findings.every(finding => finding.resolvedAt) ? { ...item, status: 'Gesloten', closedAt: todayIso() } : item) }))
    },
    async createChangeOrder(projectId: string, input: ChangeOrderInput) {
      if (api) {
        await remote(() => api.createChangeOrder(projectId, input), changeOrder => setState(current => ({ ...current, changeOrders: [changeOrder, ...current.changeOrders] })))
        return
      }
      setState(current => {
        const changeOrder: ChangeOrder = { id: createId(), number: `MW-${new Date().getFullYear()}-${String(current.changeOrders.length + 1).padStart(3, '0')}`, projectId, ...input, total: 0, status: 'Vastgesteld', createdAt: todayIso() }
        return { ...current, changeOrders: [changeOrder, ...current.changeOrders] }
      })
    },
    async updateChangeOrder(id: string, input: ChangeOrderInput) {
      if (api) {
        await remote(() => api.updateChangeOrder(id, input), changeOrder => setState(current => ({ ...current, changeOrders: current.changeOrders.map(item => item.id === id ? changeOrder : item) })))
        return
      }
      setState(current => ({ ...current, changeOrders: current.changeOrders.map(item => item.id === id && ['Vastgesteld', 'Berekend'].includes(item.status) ? { ...item, ...input, total: 0, status: 'Vastgesteld', calculatedAt: undefined } : item) }))
    },
    async calculateChangeOrder(id: string) {
      if (api) { await remote(() => api.calculateChangeOrder(id), result => setState(current => ({ ...current, changeOrders: current.changeOrders.map(item => item.id === id ? result : item) }))); return }
      setState(current => ({ ...current, changeOrders: current.changeOrders.map(item => item.id === id && ['Vastgesteld', 'Berekend'].includes(item.status) && changeOrderTotal(item.costs) > 0 ? { ...item, total: changeOrderTotal(item.costs), status: 'Berekend', calculatedAt: todayIso() } : item) }))
    },
    async submitChangeOrder(id: string) {
      if (api) { await remote(() => api.submitChangeOrder(id), result => setState(current => ({ ...current, changeOrders: current.changeOrders.map(item => item.id === id ? result : item) }))); return }
      setState(current => ({ ...current, changeOrders: current.changeOrders.map(item => item.id === id && item.status === 'Berekend' && Boolean(item.dailyReportId || item.photoIds.length) ? { ...item, status: 'Ter goedkeuring', submittedAt: todayIso() } : item) }))
    },
    async approveChangeOrder(id: string, approvedBy: string) {
      if (api) { await remote(() => api.approveChangeOrder(id, approvedBy), result => setState(current => ({ ...current, changeOrders: current.changeOrders.map(item => item.id === id ? result : item) }))); return }
      setState(current => ({ ...current, changeOrders: current.changeOrders.map(item => item.id === id && item.status === 'Ter goedkeuring' ? { ...item, status: 'Goedgekeurd', approvedBy, approvedAt: todayIso() } : item) }))
    },
    async executeChangeOrder(id: string) {
      if (api) { await remote(() => api.executeChangeOrder(id), result => setState(current => ({ ...current, changeOrders: current.changeOrders.map(item => item.id === id ? result : item) }))); return }
      setState(current => ({ ...current, changeOrders: current.changeOrders.map(item => item.id === id && item.status === 'Goedgekeurd' ? { ...item, status: 'Uitgevoerd', executedAt: todayIso() } : item) }))
    },
    async readyChangeOrderForInvoice(id: string) {
      if (api) { await remote(() => api.readyChangeOrderForInvoice(id), result => setState(current => ({ ...current, changeOrders: current.changeOrders.map(item => item.id === id ? result : item) }))); return }
      setState(current => ({ ...current, changeOrders: current.changeOrders.map(item => item.id === id && item.status === 'Uitgevoerd' ? { ...item, status: 'Klaar voor facturatie', readyForInvoiceAt: todayIso() } : item) }))
    },
    async createProgressStatement(projectId: string, input: ProgressStatementInput) {
      if (api) { await remote(() => api.createProgressStatement(projectId, input), result => setState(current => ({ ...current, progressStatements: [result, ...current.progressStatements] }))); return }
      setState(current => {
        const project = current.projects.find(item => item.id === projectId)
        if (!project || current.progressStatements.some(item => item.projectId === projectId && item.status === 'Concept')) return current
        const id = createId()
        const calculated = calculateLocalProgressStatement(current, project, input, id)
        const statement: ProgressStatement = { id, number: `VS-${new Date().getFullYear()}-${String(current.progressStatements.length + 1).padStart(3, '0')}`, projectId, ...input, ...calculated, status: 'Concept', createdAt: todayIso() }
        return { ...current, progressStatements: [statement, ...current.progressStatements] }
      })
    },
    async updateProgressStatement(id: string, input: ProgressStatementInput) {
      if (api) { await remote(() => api.updateProgressStatement(id, input), result => setState(current => ({ ...current, progressStatements: current.progressStatements.map(item => item.id === id ? result : item) }))); return }
      setState(current => {
        const statement = current.progressStatements.find(item => item.id === id)
        const project = current.projects.find(item => item.id === statement?.projectId)
        if (!statement || statement.status !== 'Concept' || !project) return current
        const calculated = calculateLocalProgressStatement(current, project, input, id)
        return { ...current, progressStatements: current.progressStatements.map(item => item.id === id ? { ...item, ...input, ...calculated } : item) }
      })
    },
    async submitProgressStatement(id: string) {
      if (api) { await remote(() => api.submitProgressStatement(id), result => setState(current => ({ ...current, progressStatements: current.progressStatements.map(item => item.id === id ? result : item), changeOrders: current.changeOrders.map(item => result.changeOrderIds.includes(item.id) ? { ...item, status: 'Opgenomen in vorderingsstaat', progressStatementId: id } : item) }))); return }
      setState(current => {
        const statement = current.progressStatements.find(item => item.id === id)
        if (!statement || statement.status !== 'Concept' || statement.netAmount <= 0) return current
        return { ...current, progressStatements: current.progressStatements.map(item => item.id === id ? { ...item, status: 'Ingediend', submittedAt: todayIso() } : item), changeOrders: current.changeOrders.map(item => statement.changeOrderIds.includes(item.id) ? { ...item, status: 'Opgenomen in vorderingsstaat', progressStatementId: id } : item) }
      })
    },
    async approveProgressStatement(id: string, approvedBy: string) {
      if (api) { await remote(() => api.approveProgressStatement(id, approvedBy), result => setState(current => ({ ...current, progressStatements: current.progressStatements.map(item => item.id === id ? result : item) }))); return }
      setState(current => ({ ...current, progressStatements: current.progressStatements.map(item => item.id === id && item.status === 'Ingediend' ? { ...item, status: 'Goedgekeurd', approvedBy, approvedAt: todayIso() } : item) }))
    },
    async createSalesInvoice(id: string, input: SalesInvoiceInput) {
      if (api) { await remote(() => api.createSalesInvoice(id, input), result => setState(current => ({ ...current, progressStatements: current.progressStatements.map(item => item.id === id ? result.statement : item), salesInvoices: [result.invoice, ...current.salesInvoices] }))); return }
      setState(current => {
        const statement = current.progressStatements.find(item => item.id === id)
        if (!statement || statement.status !== 'Goedgekeurd') return current
        const project = current.projects.find(item => item.id === statement.projectId)
        const entity = current.legalEntities.find(item => item.id === project?.legalEntityId)
        if (!entity) return current
        const invoiceId = createId()
        const vatPct = input.vatPct ?? entity.defaultVatPct
        const dueDate = input.dueDate ?? addDays(input.invoiceDate, entity.paymentTermsDays)
        const vatAmount = roundCents(statement.netAmount * vatPct / 100)
        const invoice = { id: invoiceId, number: `${entity.invoicePrefix}-${input.invoiceDate.slice(0, 4)}-${String(entity.nextInvoiceNumber).padStart(5, '0')}`, legalEntityId: entity.id, projectId: statement.projectId, progressStatementId: id, invoiceDate: input.invoiceDate, dueDate, vatPct, subtotal: statement.netAmount, vatAmount, total: roundCents(statement.netAmount + vatAmount), status: 'Concept' as const, createdAt: todayIso() }
        return { ...current, legalEntities: current.legalEntities.map(item => item.id === entity.id ? { ...item, nextInvoiceNumber: item.nextInvoiceNumber + 1 } : item), progressStatements: current.progressStatements.map(item => item.id === id ? { ...item, status: 'Factuurconcept', invoiceId } : item), salesInvoices: [invoice, ...current.salesInvoices] }
      })
    },
    async issueSalesInvoice(id: string, input: SalesInvoiceIssueInput) {
      if (api) { await remote(() => api.issueSalesInvoice(id, input), result => setState(current => ({ ...current, salesInvoices: current.salesInvoices.map(item => item.id === id ? result : item) }))); return }
      setState(current => ({ ...current, salesInvoices: current.salesInvoices.map(item => item.id === id && item.status === 'Concept' ? { ...item, status: 'Openstaand', issuedAt: todayIso(), issuedBy: input.issuedBy } : item) }))
    },
    async validateSalesInvoicePeppol(id: string) {
      if (api) { await remote(() => api.validateSalesInvoicePeppol(id), result => setState(current => ({ ...current, peppolValidationReports: [result, ...current.peppolValidationReports.filter(item => item.id !== result.id)] }))); return }
      setState(current => {
        const invoice = current.salesInvoices.find(item => item.id === id)
        const project = current.projects.find(item => item.id === invoice?.projectId)
        const entity = current.legalEntities.find(item => item.id === invoice?.legalEntityId)
        const customer = current.organizations.find(item => item.id === project?.organizationId)
        const statement = current.progressStatements.find(item => item.id === invoice?.progressStatementId)
        if (!invoice || !project || !entity || !customer || !statement) return current
        const readiness = invoiceExportReadiness({ invoice, project, entity, customer, statement })
        const report: PeppolValidationReport = {
          id: createId(), invoiceId: id, documentDigest: 'lokale-preflight', status: readiness.ready ? 'Geslaagd' : 'Afgekeurd', source: 'Preflight', engine: 'BouwFlow preflight 1.0', profile: 'Peppol BIS Billing 3.0 / UBL 2.1', networkReady: false, validatedAt: new Date().toISOString(),
          issues: readiness.checks.filter(check => !check.ready).map((check, index) => ({ code: `BF-PRE-${String(index + 1).padStart(3, '0')}`, severity: 'Fout', message: `${check.label} ontbreekt of is ongeldig` })),
        }
        return { ...current, peppolValidationReports: [report, ...current.peppolValidationReports] }
      })
    },
    async sendSalesInvoicePeppol(id: string) {
      if (api) { await remote(() => api.sendSalesInvoicePeppol(id), result => setState(current => ({ ...current, peppolDeliveries: [result, ...current.peppolDeliveries.filter(item => item.id !== result.id)] }))); return }
      setState(current => {
        const invoice = current.salesInvoices.find(item => item.id === id)
        if (!invoice || invoice.status === 'Concept') return current
        const validation = current.peppolValidationReports.find(item => item.invoiceId === id && item.source === 'Extern' && item.status === 'Geslaagd' && item.networkReady)
        if (!validation) return current
        const at = new Date().toISOString()
        const existing = current.peppolDeliveries.find(item => item.invoiceId === id)
        if (existing && ['In wachtrij', 'Geaccepteerd', 'Afgeleverd'].includes(existing.status)) return current
        const delivery: PeppolDelivery = { id: existing?.id ?? createId(), invoiceId: id, validationReportId: validation.id, status: 'Fout', provider: 'Lokale demo', idempotencyKey: existing?.idempotencyKey ?? `peppol:local:${id}`, attempts: (existing?.attempts ?? 0) + 1, message: 'Configureer de centrale API en een gecertificeerd accesspoint voor verzending', events: [...(existing?.events ?? []), { status: 'Fout', message: 'Configureer de centrale API en een gecertificeerd accesspoint voor verzending', at }], requestedAt: existing?.requestedAt ?? at, updatedAt: at }
        return { ...current, peppolDeliveries: [delivery, ...current.peppolDeliveries.filter(item => item.id !== delivery.id)] }
      })
    },
    async refreshSalesInvoicePeppolStatus(id: string) {
      if (api) { await remote(async () => { await api.refreshSalesInvoicePeppolStatus(id); return api.bootstrap() }, result => setState(result)); return }
    },
    async startPeppolAcceptance(id: string) {
      if (api) return remote(() => api.startPeppolAcceptance(id), result => setState(current => ({
        ...current,
        peppolAcceptanceRuns: [result.run, ...current.peppolAcceptanceRuns.filter(item => item.id !== result.run.id)],
        peppolValidationReports: result.validationReport ? [result.validationReport, ...current.peppolValidationReports.filter(item => item.id !== result.validationReport!.id)] : current.peppolValidationReports,
        peppolDeliveries: result.delivery ? [result.delivery, ...current.peppolDeliveries.filter(item => item.id !== result.delivery!.id)] : current.peppolDeliveries,
      })))
      return undefined
    },
    async releasePeppolAcceptance(id: string, input: PeppolAcceptanceReleaseInput) {
      if (api) return remote(async () => { await api.releasePeppolAcceptance(id, input); return api.bootstrap() }, result => setState(result))
      return undefined
    },
    async downloadPeppolAcceptancePdf(id: string) {
      if (!api) return undefined
      return remote(() => api.downloadPeppolAcceptancePdf(id), () => undefined)
    },
    async acknowledgePeppolAlert(id: string) {
      if (api) { await remote(() => api.acknowledgePeppolAlert(id), result => setState(current => ({ ...current, peppolAlerts: current.peppolAlerts.map(item => item.id === result.id ? result : item) }))); return }
      setState(current => {
        const acknowledgedAt = new Date().toISOString()
        return { ...current, peppolAlerts: current.peppolAlerts.map(item => item.id === id && item.status === 'Open' ? { ...item, status: 'In behandeling', acknowledgedBy: current.currentUserId, acknowledgedAt, updatedAt: acknowledgedAt } : item) }
      })
    },
    async updatePeppolNotificationSettings(input: PeppolNotificationSettingsInput) {
      if (api) { await remote(() => api.updatePeppolNotificationSettings(input), result => setState(current => ({ ...current, peppolNotificationSettings: result }))); return }
      setState(current => ({ ...current, peppolNotificationSettings: { ...input, connectorConfigured: false, connectorProvider: 'Niet geconfigureerd', connectorChannels: [], integrationChecks: [], productionGate: current.peppolNotificationSettings.productionGate, updatedAt: new Date().toISOString() } }))
    },
    async testPeppolNotification(input: PeppolNotificationTestInput) {
      if (api) return remote(() => api.testPeppolNotification(input), () => undefined)
      return undefined
    },
    async registerSalesPayment(id: string, input: PaymentRegistrationInput) {
      if (api) { await remote(() => api.registerSalesPayment(id, input), result => setState(current => ({ ...current, salesInvoices: current.salesInvoices.map(item => item.id === id ? result : item) }))); return }
      setState(current => ({ ...current, salesInvoices: current.salesInvoices.map(item => item.id === id && item.status === 'Openstaand' && Math.abs(item.total - input.amount) <= 0.01 ? { ...item, status: 'Betaald', paidAt: input.paymentDate, paidAmount: input.amount, paymentReference: input.reference } : item) }))
    },
    async createProjectCost(projectId: string, input: ProjectCostInput) {
      if (api) { await remote(() => api.createProjectCost(projectId, input), result => setState(current => ({ ...current, projectCosts: [result, ...current.projectCosts] }))); return }
      setState(current => { const cost: ProjectCost = { id: createId(), projectId, ...input, status: input.type === 'Verplichting' ? 'Open' : 'Geboekt', createdAt: todayIso() }; return { ...current, projectCosts: [cost, ...current.projectCosts] } })
    },
    async settleCommitment(id: string, input: CommitmentSettlementInput) {
      if (api) { await remote(() => api.settleCommitment(id, input), result => setState(current => ({ ...current, projectCosts: [result.actualCost, ...current.projectCosts.map(item => item.id === id ? result.commitment : item)] }))); return }
      setState(current => {
        const commitment = current.projectCosts.find(item => item.id === id)
        if (!commitment || commitment.type !== 'Verplichting' || commitment.status !== 'Open') return current
        const actualCost: ProjectCost = { id: createId(), projectId: commitment.projectId, workPackageId: commitment.workPackageId, date: input.date, type: 'Werkelijke kost', category: commitment.category, description: input.description, supplier: commitment.supplier, amount: input.amount, reference: input.reference, status: 'Geboekt', sourceCommitmentId: commitment.id, createdAt: todayIso() }
        return { ...current, projectCosts: [actualCost, ...current.projectCosts.map(item => item.id === id ? { ...item, status: 'Omgezet' as const, settledByEntryId: actualCost.id } : item)] }
      })
    },
    async createProjectForecast(projectId: string, input: ProjectForecastInput) {
      if (api) { await remote(() => api.createProjectForecast(projectId, input), result => setState(current => ({ ...current, projectForecasts: [result, ...current.projectForecasts] }))); return }
      setState(current => {
        const project = current.projects.find(item => item.id === projectId)
        if (!project) return current
        const metrics = projectControlMetrics(project, current.projectCosts, current.projectForecasts, current.changeOrders, current.salesInvoices)
        const lines = project.workPackages.map(workPackage => ({ workPackageId: workPackage.id, workPackageCode: workPackage.code, workPackageName: workPackage.name, remainingCost: input.lines.find(line => line.workPackageId === workPackage.id)?.remainingCost ?? 0, openCommitments: current.projectCosts.filter(cost => cost.projectId === projectId && cost.workPackageId === workPackage.id && cost.type === 'Verplichting' && cost.status === 'Open').reduce((sum, cost) => sum + cost.amount, 0) }))
        const remainingCost = roundCents(lines.reduce((sum, line) => sum + line.remainingCost, 0))
        const estimateAtCompletion = roundCents(metrics.actualCosts + remainingCost)
        const expectedMargin = roundCents(metrics.expectedRevenue - estimateAtCompletion)
        const forecast: ProjectForecast = { id: createId(), projectId, version: Math.max(0, ...current.projectForecasts.filter(item => item.projectId === projectId).map(item => item.version)) + 1, lines, actualCosts: metrics.actualCosts, openCommitments: metrics.openCommitments, remainingCost, estimateAtCompletion, expectedRevenue: metrics.expectedRevenue, expectedMargin, expectedMarginPct: metrics.expectedRevenue ? expectedMargin / metrics.expectedRevenue * 100 : 0, notes: input.notes,status:'Ter goedkeuring',createdBy:'Demo-gebruiker', createdAt: todayIso() }
        return { ...current, projectForecasts: [forecast, ...current.projectForecasts] }
      })
    },
    async approveProjectForecast(id:string){if(api){await remote(()=>api.approveProjectForecast(id),result=>setState(current=>({...current,projectForecasts:current.projectForecasts.map(item=>item.id===id?result:item.projectId===result.projectId&&item.status==='Goedgekeurd'?{...item,status:'Vervallen'}:item)})));return}setState(current=>{const target=current.projectForecasts.find(item=>item.id===id);if(!target)return current;return{...current,projectForecasts:current.projectForecasts.map(item=>item.id===id?{...item,status:'Goedgekeurd',approvedBy:'Demo-gebruiker',approvedAt:new Date().toISOString()}:item.projectId===target.projectId&&item.status==='Goedgekeurd'?{...item,status:'Vervallen'}:item)}})},
    async createSupplier(input: SupplierInput) {
      if (api) { await remote(() => api.createSupplier(input), result => setState(current => ({ ...current, suppliers: [...current.suppliers, result].sort((a, b) => a.name.localeCompare(b.name)) }))); return }
      setState(current => { const supplier: Supplier = { id: createId(), ...input, rating: 0, createdAt: todayIso() }; return { ...current, suppliers: [...current.suppliers, supplier].sort((a, b) => a.name.localeCompare(b.name)) } })
    },
    async createAsset(input: AssetInput) {
      if (api) { await remote(() => api.createAsset(input), result => setState(current => ({ ...current, assets: [...current.assets, result].sort((a, b) => a.code.localeCompare(b.code)) }))); return }
      const asset: Asset = { id: createId(), ...input }
      setState(current => current.assets.some(item => item.code.toLocaleLowerCase() === input.code.toLocaleLowerCase()) ? current : { ...current, assets: [...current.assets, asset].sort((a, b) => a.code.localeCompare(b.code)) })
    },
    async addAssetOperation(id:string,input:AssetOperationalInput){if(api){await remote(()=>api.addAssetOperation(id,input),result=>setState(current=>({...current,assets:current.assets.map(item=>item.id===id?result:item)})));return}setState(current=>({...current,assets:current.assets.map(item=>{if(item.id!==id)return item;const operation={id:createId(),...input.value};return input.kind==='maintenance'?{...item,maintenanceOrders:[operation as NonNullable<Asset['maintenanceOrders']>[number],...(item.maintenanceOrders??[])]}:input.kind==='damage'?{...item,status:'Defect',damageReports:[operation as NonNullable<Asset['damageReports']>[number],...(item.damageReports??[])]}:input.kind==='fuel'?{...item,fuelEntries:[operation as NonNullable<Asset['fuelEntries']>[number],...(item.fuelEntries??[])]}:{...item,reservations:[operation as NonNullable<Asset['reservations']>[number],...(item.reservations??[])]}})}))},
    async createWarehouse(input: WarehouseInput) {
      if (api) { await remote(() => api.createWarehouse(input), result => setState(current => ({ ...current, warehouses: [...current.warehouses, result] }))); return }
      const warehouse: Warehouse = { id: createId(), ...input }
      setState(current => ({ ...current, warehouses: [...current.warehouses, warehouse] }))
    },
    async createInventoryItem(input: InventoryItemInput) {
      if (api) { await remote(() => api.createInventoryItem(input), result => setState(current => ({ ...current, inventoryItems: [...current.inventoryItems, result].sort((a, b) => a.sku.localeCompare(b.sku)) }))); return }
      const item: InventoryItem = { id: createId(), ...input, stocks: [] }
      setState(current => current.inventoryItems.some(existing => existing.sku.toLocaleLowerCase() === input.sku.toLocaleLowerCase()) ? current : { ...current, inventoryItems: [...current.inventoryItems, item].sort((a, b) => a.sku.localeCompare(b.sku)) })
    },
    async countInventory(id:string,input:InventoryCountInput){if(api){await remote(()=>api.countInventory(id,input),result=>setState(current=>({...current,inventoryItems:current.inventoryItems.map(item=>item.id===id?result.item:item),stockMovements:result.movement?[result.movement,...current.stockMovements]:current.stockMovements})));return}setState(current=>({...current,inventoryItems:current.inventoryItems.map(item=>{if(item.id!==id)return item;const stock=item.stocks.find(entry=>entry.warehouseId===input.warehouseId)??{warehouseId:input.warehouseId,quantity:0,reserved:0};const difference=input.countedQuantity-stock.quantity;return{...item,stocks:[...item.stocks.filter(entry=>entry.warehouseId!==input.warehouseId),{...stock,quantity:input.countedQuantity}],counts:[{id:createId(),...input,bookQuantity:stock.quantity,difference,countedAt:new Date().toISOString()},...(item.counts??[])]}})}))},
    async registerStockMovement(input: StockMovementInput) {
      if (api) { await remote(() => api.registerStockMovement(input), result => setState(current => ({ ...current, inventoryItems: current.inventoryItems.map(item => item.id === result.item.id ? result.item : item), stockMovements: [result.movement, ...current.stockMovements] }))); return }
      setState(current => {
        const item = current.inventoryItems.find(entry => entry.id === input.inventoryItemId)
        const warehouse = current.warehouses.find(entry => entry.id === input.warehouseId)
        if (!item || !warehouse || input.quantity <= 0) return current
        const stock = item.stocks.find(entry => entry.warehouseId === input.warehouseId) ?? { warehouseId: input.warehouseId, quantity: 0, reserved: 0 }
        const quantityDelta = input.type === 'Ontvangst' || input.type === 'Retour' ? input.quantity : input.type === 'Uitgifte' ? -input.quantity : input.type === 'Correctie' ? input.quantity : 0
        const reservedDelta = input.type === 'Reservatie' ? input.quantity : input.type === 'Vrijgave' ? -input.quantity : input.type === 'Uitgifte' ? -Math.min(stock.reserved, input.quantity) : 0
        const nextStock = { ...stock, quantity: stock.quantity + quantityDelta, reserved: Math.max(0, stock.reserved + reservedDelta) }
        if (nextStock.quantity < 0 || nextStock.reserved > nextStock.quantity) return current
        const movement: StockMovement = { id: createId(), ...input, createdAt: new Date().toISOString() }
        return { ...current, inventoryItems: current.inventoryItems.map(entry => entry.id === item.id ? { ...entry, stocks: [...entry.stocks.filter(level => level.warehouseId !== input.warehouseId), nextStock] } : entry), stockMovements: [movement, ...current.stockMovements] }
      })
    },
    async createEmployee(input:EmployeeInput){if(api){await remote(()=>api.createEmployee(input),result=>setState(current=>({...current,employees:[...current.employees,result]})));return}setState(current=>{if(current.employees.some(item=>item.employeeNumber.toLocaleLowerCase()===input.employeeNumber.toLocaleLowerCase()||item.email.toLocaleLowerCase()===input.email.toLocaleLowerCase()))return current;const item:Employee={id:createId(),...input,createdAt:new Date().toISOString()};return{...current,employees:[...current.employees,item]}})},
    async createEmployeeCrew(input:EmployeeCrewInput){if(api){await remote(()=>api.createEmployeeCrew(input),result=>setState(current=>({...current,employeeCrews:[...current.employeeCrews,result]})));return}setState(current=>{const memberEmployeeIds=[...new Set([input.leaderEmployeeId,...input.memberEmployeeIds])];const item:EmployeeCrew={id:createId(),...input,memberEmployeeIds,createdAt:new Date().toISOString()};return{...current,employeeCrews:[...current.employeeCrews,item]}})},
    async createEmployeeAbsence(input:EmployeeAbsenceInput){if(api){await remote(()=>api.createEmployeeAbsence(input),result=>setState(current=>({...current,employeeAbsences:[result,...current.employeeAbsences]})));return}setState(current=>{const overlap=current.employeeAbsences.some(item=>item.employeeId===input.employeeId&&['Aangevraagd','Goedgekeurd'].includes(item.status)&&item.startDate<=input.endDate&&item.endDate>=input.startDate);if(overlap)return current;const item:EmployeeAbsence={id:createId(),...input,status:'Aangevraagd',requestedAt:new Date().toISOString()};return{...current,employeeAbsences:[item,...current.employeeAbsences]}})},
    async decideEmployeeAbsence(id:string,input:EmployeeAbsenceDecisionInput){if(api){await remote(()=>api.decideEmployeeAbsence(id,input),result=>setState(current=>({...current,employeeAbsences:current.employeeAbsences.map(item=>item.id===id?result:item)})));return}setState(current=>({...current,employeeAbsences:current.employeeAbsences.map(item=>item.id===id&&item.status==='Aangevraagd'?{...item,...input,decidedAt:new Date().toISOString()}:item)}))},
    async createSubcontractor(input: SubcontractorInput) {
      if (api) { await remote(() => api.createSubcontractor(input), result => setState(current => ({ ...current, subcontractors:[...current.subcontractors,result] }))); return }
      const item:Subcontractor={id:createId(),...input,status:'Te beoordelen',documentsComplete:Boolean(input.insuranceExpiresOn&&input.vcaExpiresOn),employees:[],createdAt:new Date().toISOString()}; setState(current=>({...current,subcontractors:[...current.subcontractors,item]}))
    },
    async inviteSubcontractor(id:string) { if(api){await remote(()=>api.inviteSubcontractor(id),result=>setState(current=>({...current,subcontractors:current.subcontractors.map(item=>item.id===id?result:item)})));return} setState(current=>({...current,subcontractors:current.subcontractors.map(item=>item.id===id&&item.documentsComplete?{...item,status:'Goedgekeurd',portalInvitedAt:item.portalInvitedAt??new Date().toISOString()}:item)})) },
    async addSubcontractorOperation(id:string,input:SubcontractorOperationInput){if(api){await remote(()=>api.addSubcontractorOperation(id,input),result=>setState(current=>({...current,subcontractors:current.subcontractors.map(item=>item.id===id?result:item)})));return}setState(current=>({...current,subcontractors:current.subcontractors.map(item=>{if(item.id!==id)return item;const operationId=createId();if(input.kind==='employee')return{...item,employees:[...item.employees,{id:operationId,...input.value}]};if(input.kind==='agreement')return{...item,agreements:[{id:operationId,...input.value},...(item.agreements??[])]};if(input.kind==='progress'){const agreement=(item.agreements??[]).find(entry=>entry.projectId===input.value.projectId&&entry.status==='Actief');if(!agreement)return item;const retentionAmount=input.value.grossAmount*agreement.retentionPct/100;return{...item,progressClaims:[{id:operationId,number:`OVS-${String((item.progressClaims??[]).length+1).padStart(3,'0')}`,...input.value,retentionAmount,netAmount:input.value.grossAmount-retentionAmount-input.value.penaltyAmount,status:'Ingediend',submittedAt:new Date().toISOString()},...(item.progressClaims??[])]}}if(input.kind==='evaluation')return{...item,evaluations:[{id:operationId,...input.value},...(item.evaluations??[])]};return{...item,documentIds:input.value.documentIds}})}))},
    async decideSubcontractorProgress(id:string,progressId:string,status:'Goedgekeurd'|'Afgewezen'){if(api){await remote(()=>api.decideSubcontractorProgress(id,progressId,status),result=>setState(current=>({...current,subcontractors:current.subcontractors.map(item=>item.id===id?result:item)})));return}setState(current=>({...current,subcontractors:current.subcontractors.map(item=>item.id===id?{...item,progressClaims:(item.progressClaims??[]).map(entry=>entry.id===progressId?{...entry,status,approvedAt:new Date().toISOString(),approvedBy:'Demo-gebruiker'}:entry)}:item)}))},
    async createQhseEvent(input:QhseEventInput){if(api){await remote(()=>api.createQhseEvent(input),result=>setState(current=>({...current,qhseEvents:[result,...current.qhseEvents]})));return}const item:QhseEvent={id:createId(),...input,status:'Open',createdAt:new Date().toISOString()};setState(current=>({...current,qhseEvents:[item,...current.qhseEvents]}))},
    async closeQhseEvent(id:string){if(api){await remote(()=>api.closeQhseEvent(id),result=>setState(current=>({...current,qhseEvents:current.qhseEvents.map(item=>item.id===id?result:item)})));return}setState(current=>({...current,qhseEvents:current.qhseEvents.map(item=>item.id===id?{...item,status:'Gesloten',closedAt:new Date().toISOString()}:item)}))},
    async createWorkTicket(input:WorkTicketInput){if(api){await remote(()=>api.createWorkTicket(input),result=>setState(current=>({...current,workTickets:[result,...current.workTickets]})));return}setState(current=>{const total=Math.round(input.lines.reduce((sum,line)=>sum+line.quantity*line.unitPrice,0)*100)/100;const item:WorkTicket={id:createId(),number:`WB-${new Date().getFullYear()}-${String(current.workTickets.length+1).padStart(4,'0')}`,...input,total,status:'Concept',createdAt:new Date().toISOString()};return{...current,workTickets:[item,...current.workTickets]}})},
    async submitWorkTicket(id:string){if(api){await remote(()=>api.submitWorkTicket(id),result=>setState(current=>({...current,workTickets:current.workTickets.map(item=>item.id===id?result:item)})));return}setState(current=>({...current,workTickets:current.workTickets.map(item=>item.id===id&&item.status==='Concept'?{...item,status:'Ter ondertekening',submittedAt:new Date().toISOString()}:item)}))},
    async signWorkTicket(id:string,signedBy:string){if(api){await remote(()=>api.signWorkTicket(id,signedBy),result=>setState(current=>({...current,workTickets:current.workTickets.map(item=>item.id===id?result:item)})));return}setState(current=>({...current,workTickets:current.workTickets.map(item=>item.id===id&&item.status==='Ter ondertekening'?{...item,status:'Ondertekend',signedBy,signedAt:new Date().toISOString()}:item)}))},
    async createTimeEntry(input:TimeEntryInput){if(api){await remote(()=>api.createTimeEntry(input),result=>setState(current=>({...current,timeEntries:[result,...current.timeEntries]})));return}const item:TimeEntry={id:createId(),...input,status:'Concept',createdAt:new Date().toISOString()};setState(current=>({...current,timeEntries:[item,...current.timeEntries]}))},
    async submitTimeEntry(id:string){if(api){await remote(()=>api.submitTimeEntry(id),result=>setState(current=>({...current,timeEntries:current.timeEntries.map(item=>item.id===id?result:item)})));return}setState(current=>({...current,timeEntries:current.timeEntries.map(item=>item.id===id&&['Concept','Gecorrigeerd'].includes(item.status)?{...item,status:'Ingediend'}:item)}))},
    async decideTimeEntry(id:string,decision:'Goedgekeurd'|'Geweigerd',reason?:string){if(api){await remote(()=>api.decideTimeEntry(id,decision,reason),result=>setState(current=>({...current,timeEntries:current.timeEntries.map(item=>item.id===id?result:item)})));return}setState(current=>({...current,timeEntries:current.timeEntries.map(item=>item.id===id&&item.status==='Ingediend'?{...item,status:decision,correctionReason:reason,approvedBy:'Demo-gebruiker',approvedAt:new Date().toISOString()}:item)}))},
    async configureCheckinatworkSite(input:CheckinatworkSiteInput){if(api){await remote(()=>api.configureCheckinatworkSite(input),result=>setState(current=>({...current,checkinatworkSites:[result,...current.checkinatworkSites.filter(item=>item.projectId!==result.projectId)]})));return}setState(current=>{const now=new Date().toISOString();const project=current.projects.find(item=>item.id===input.projectId);const existing=current.checkinatworkSites.find(item=>item.projectId===input.projectId);const applicability=input.provisionalAcceptanceOn?'Be\u00ebindigd':input.applicability==='Niet verplicht'?'Niet verplicht':(project?.contractValue??0)>=(input.thresholdAmount||CHECKINATWORK_THRESHOLD)?'Verplicht':'Niet verplicht';const site:CheckinatworkSite=existing?{...existing,...input,applicability,updatedAt:now}:{id:createId(),...input,applicability,createdAt:now,updatedAt:now};return{...current,checkinatworkSites:[site,...current.checkinatworkSites.filter(item=>item.projectId!==site.projectId)],checkinatworkAuditEvents:[{id:createId(),projectId:site.projectId,siteId:site.id,action:'SITE_CONFIGURED',detail:`${site.environment} \u00b7 ${site.applicability}`,actor:'Demo-gebruiker',at:now},...current.checkinatworkAuditEvents]}})},
    async createCheckinatworkParticipant(input:CheckinatworkParticipantInput){if(api){await remote(()=>api.createCheckinatworkParticipant(input),result=>setState(current=>({...current,checkinatworkParticipants:[result,...current.checkinatworkParticipants]})));return}setState(current=>{const now=new Date().toISOString();const participant:CheckinatworkParticipant={id:createId(),projectId:input.projectId,employeeId:input.employeeId,subcontractorId:input.subcontractorId,displayName:input.displayName,employerName:input.employerName,employerCompanyNumber:input.employerCompanyNumber,participantType:input.participantType,identifierType:input.identifierType,identifierLast4:maskCheckinatworkIdentifier(input.identifier),secureIdentityReference:`sim:${createId()}`,identityVerified:true,limosaExpiresOn:input.limosaExpiresOn,active:input.active,createdAt:now};return{...current,checkinatworkParticipants:[participant,...current.checkinatworkParticipants],checkinatworkAuditEvents:[{id:createId(),projectId:participant.projectId,participantId:participant.id,action:'IDENTITY_PROVISIONED',detail:`${participant.identifierType} eindigend op ${participant.identifierLast4}`,actor:'Demo-gebruiker',at:now},...current.checkinatworkAuditEvents]}})},
    async registerCheckinatworkPresence(input:CheckinatworkRegistrationInput){if(api){await remote(()=>api.registerCheckinatworkPresence(input),result=>setState(current=>({...current,checkinatworkRegistrations:[result,...current.checkinatworkRegistrations.filter(item=>item.id!==result.id)]})));return}setState(current=>{const site=current.checkinatworkSites.find(item=>item.id===input.siteId);const participant=current.checkinatworkParticipants.find(item=>item.id===input.participantId);if(!site||!participant)return current;const duplicate=current.checkinatworkRegistrations.find(item=>item.siteId===site.id&&item.participantId===participant.id&&item.registrationDate===input.registrationDate&&!['Geannuleerd','Geweigerd'].includes(item.status));if(duplicate)return current;const now=new Date().toISOString();const token=createId().replace(/-/g,'').slice(0,12).toUpperCase();const accepted=participant.identityVerified&&Boolean(site.workPlaceId);const registration:CheckinatworkRegistration={id:createId(),siteId:site.id,projectId:site.projectId,participantId:participant.id,registrationDate:input.registrationDate,source:input.source,status:accepted?'Officieel bevestigd':'Geweigerd',clientReference:`bouwflow:${site.id}:${participant.id}:${input.registrationDate}`,providerRegistrationId:accepted?`SIM-${token}`:undefined,receiptNumber:accepted?`CAW-SIM-${token}`:undefined,errorCode:accepted?undefined:participant.identityVerified?'INVALID_WORKPLACE':'IDENTITY_MISSING',errorMessage:accepted?undefined:participant.identityVerified?'RSZ-werkplaatsnummer ontbreekt':'Identiteit niet geverifieerd',submittedAt:now,confirmedAt:accepted?now:undefined,simulation:true,createdBy:'Demo-gebruiker',createdAt:now};return{...current,checkinatworkRegistrations:[registration,...current.checkinatworkRegistrations],checkinatworkAuditEvents:[{id:createId(),projectId:site.projectId,siteId:site.id,participantId:participant.id,registrationId:registration.id,action:registration.status==='Officieel bevestigd'?'REGISTRATION_CONFIRMED':'REGISTRATION_REJECTED',detail:registration.receiptNumber??registration.errorMessage??'Onbekende status',actor:'BouwFlow RSZ-simulator',at:now},...current.checkinatworkAuditEvents]}})},
    async cancelCheckinatworkPresence(id:string,reason:CheckinatworkCancellationReason){if(api){await remote(()=>api.cancelCheckinatworkPresence(id,reason),result=>setState(current=>({...current,checkinatworkRegistrations:current.checkinatworkRegistrations.map(item=>item.id===id?result:item)})));return}setState(current=>{const now=new Date().toISOString();const registration=current.checkinatworkRegistrations.find(item=>item.id===id);if(!registration)return current;return{...current,checkinatworkRegistrations:current.checkinatworkRegistrations.map(item=>item.id===id?{...item,status:'Geannuleerd',cancellationReason:reason,cancelledAt:now}:item),checkinatworkAuditEvents:[{id:createId(),projectId:registration.projectId,siteId:registration.siteId,participantId:registration.participantId,registrationId:id,action:'REGISTRATION_CANCELLED',detail:`Geannuleerd met reden ${reason}`,actor:'Demo-gebruiker',at:now},...current.checkinatworkAuditEvents]}})},
    async createProjectClaim(input:ProjectClaimInput){if(api){await remote(()=>api.createProjectClaim(input),result=>setState(current=>({...current,projectClaims:[result,...current.projectClaims]})));return}setState(current=>{const item:ProjectClaim={id:createId(),number:`CL-${new Date().getFullYear()}-${String(current.projectClaims.length+1).padStart(4,'0')}`,...input,status:'Concept',createdAt:new Date().toISOString()};return{...current,projectClaims:[item,...current.projectClaims]}})},
    async transitionProjectClaim(id:string,action:'approve'|'submit'|'accept'|'reject',notes?:string){if(api){await remote(()=>api.transitionProjectClaim(id,action,notes),result=>setState(current=>({...current,projectClaims:current.projectClaims.map(item=>item.id===id?result:item)})));return}setState(current=>({...current,projectClaims:current.projectClaims.map(item=>item.id===id?{...item,status:action==='approve'?'Intern goedgekeurd':action==='submit'?'Ingediend':action==='accept'?'Aanvaard':'Afgewezen',submittedAt:action==='submit'?new Date().toISOString():item.submittedAt,decidedAt:['accept','reject'].includes(action)?new Date().toISOString():item.decidedAt,decisionNotes:notes??item.decisionNotes}:item)}))},
    async createJointVenture(input:JointVentureInput){if(api){await remote(()=>api.createJointVenture(input),result=>setState(current=>({...current,jointVentures:[...current.jointVentures,result]})));return}const item:JointVenture={id:createId(),...input,status:'Actief',createdAt:new Date().toISOString()};setState(current=>({...current,jointVentures:[...current.jointVentures,item]}))},
    async createIntegrationConnection(input:IntegrationConnectionInput){if(api){await remote(()=>api.createIntegrationConnection(input),result=>setState(current=>({...current,integrationConnections:[...current.integrationConnections,result]})));return}const item:IntegrationConnection={id:createId(),...input,status:'Concept',createdAt:new Date().toISOString()};setState(current=>({...current,integrationConnections:[...current.integrationConnections,item]}))},
    async testIntegrationConnection(id:string){if(api){await remote(()=>api.testIntegrationConnection(id),result=>setState(current=>({...current,integrationConnections:current.integrationConnections.map(item=>item.id===id?result:item)})));return}setState(current=>({...current,integrationConnections:current.integrationConnections.map(item=>item.id===id?{...item,status:item.endpoint?'Actief':'Fout',lastTestAt:new Date().toISOString(),lastError:item.endpoint?undefined:'Endpoint ontbreekt'}:item)}))},
    async createIntegrationJob(input:IntegrationJobInput){if(api){await remote(()=>api.createIntegrationJob(input),result=>setState(current=>({...current,integrationJobs:[result,...current.integrationJobs]})));return}const now=new Date().toISOString();const item:IntegrationJob={id:createId(),...input,status:'In wachtrij',attempts:0,payloadDigest:`local-${input.entityType}-${input.entityId}`,nextAttemptAt:now,createdAt:now};setState(current=>({...current,integrationJobs:[item,...current.integrationJobs]}))},
    async processIntegrationJob(id:string){if(api){await remote(()=>api.processIntegrationJob(id),result=>setState(current=>({...current,integrationJobs:current.integrationJobs.map(item=>item.id===id?result:item)})));return}setState(current=>({...current,integrationJobs:current.integrationJobs.map(item=>item.id===id?{...item,status:'Geslaagd',attempts:item.attempts+1,completedAt:new Date().toISOString()}:item)}))},
    async createAiAnalysis(projectId:string,input:AiAnalysisInput){if(api){await remote(()=>api.createAiAnalysis(projectId,input),result=>setState(current=>({...current,aiAnalyses:[result,...current.aiAnalyses]})));return}setState(current=>{const project=current.projects.find(item=>item.id===projectId);if(!project)return current;const docs=current.documents.filter(item=>item.projectId===projectId);const sources=docs.length?docs.slice(0,8).map(item=>({documentId:item.id,title:item.title,excerpt:`${item.category} · ${item.status}`})):[{documentId:`project-${project.id}`,title:`Projectdossier ${project.number}`,excerpt:`${project.name}; risico's: ${project.handover.risks.join('; ')||'geen'}`}];const item:AiAnalysis={id:createId(),projectId,...input,answer:`Analyse voor ${project.name}: ${input.question}. Controleer de ${sources.length} geciteerde bron(nen).`,sources,status:'Concept',createdAt:new Date().toISOString()};return{...current,aiAnalyses:[item,...current.aiAnalyses]}})},
    async approveAiAnalysis(id:string,approvedBy:string){if(api){await remote(()=>api.approveAiAnalysis(id,approvedBy),result=>setState(current=>({...current,aiAnalyses:current.aiAnalyses.map(item=>item.id===id?result:item)})));return}setState(current=>({...current,aiAnalyses:current.aiAnalyses.map(item=>item.id===id&&item.sources.length?{...item,status:'Goedgekeurd',approvedBy,approvedAt:new Date().toISOString()}:item)}))},
    async priceIndexCatalogue(refresh=false){if(api)return api.priceIndexCatalogue(refresh);return demoPriceIndexCatalogue},
    async createProjectContract(projectId:string,input:ProjectContractInput){if(api){await remote(()=>api.createProjectContract(projectId,input),result=>setState(current=>({...current,projectContracts:[...current.projectContracts,result]})));return}const createdAt=new Date().toISOString();const item:ProjectContract={id:createId(),projectId,...input,status:'Actief',approvalStatus:'Concept',versions:[{id:createId(),version:1,changeSummary:'Contractdossier aangemaakt',createdBy:'Demo-gebruiker',createdAt}],createdAt};setState(current=>({...current,projectContracts:[...current.projectContracts,item]}))},
    async updateProjectContract(contractId:string,input:ProjectContractUpdateInput){if(api){await remote(()=>api.updateProjectContract(contractId,input),result=>setState(current=>({...current,projectContracts:current.projectContracts.map(item=>item.id===contractId?result:item)})));return}setState(current=>({...current,projectContracts:current.projectContracts.map(item=>item.id===contractId?{...item,...input,approvalStatus:'Concept',submittedBy:undefined,submittedAt:undefined,approvedBy:undefined,approvedAt:undefined,versions:[...(item.versions??[]),{id:createId(),version:(item.versions?.at(-1)?.version??0)+1,changeSummary:Object.keys(input).join(', ')||'Dossier bijgewerkt',createdBy:'Demo-gebruiker',createdAt:new Date().toISOString()}]}:item)}))},
    async submitProjectContract(contractId:string){if(api){await remote(()=>api.submitProjectContract(contractId),result=>setState(current=>({...current,projectContracts:current.projectContracts.map(item=>item.id===contractId?result:item)})));return}setState(current=>({...current,projectContracts:current.projectContracts.map(item=>item.id===contractId?{...item,approvalStatus:'Ter goedkeuring',submittedBy:'Demo-gebruiker',submittedAt:new Date().toISOString()}:item)}))},
    async approveProjectContract(contractId:string){if(api){await remote(()=>api.approveProjectContract(contractId),result=>setState(current=>({...current,projectContracts:current.projectContracts.map(item=>item.id===contractId?result:item)})));return}setState(current=>({...current,projectContracts:current.projectContracts.map(item=>item.id===contractId?{...item,approvalStatus:'Goedgekeurd',approvedBy:'Demo-directie',approvedAt:new Date().toISOString()}:item)}))},
    async completeContractObligation(contractId:string,obligationId:string){if(api){await remote(()=>api.completeContractObligation(contractId,obligationId),result=>setState(current=>({...current,projectContracts:current.projectContracts.map(item=>item.id===contractId?result:item)})));return}setState(current=>({...current,projectContracts:current.projectContracts.map(item=>item.id===contractId?{...item,obligations:item.obligations.map(obligation=>obligation.id===obligationId?{...obligation,status:'Voltooid',completedAt:new Date().toISOString()}:obligation)}:item)}))},
    async createProjectCloseout(projectId:string,input:ProjectCloseoutInput){if(api){await remote(()=>api.createProjectCloseout(projectId,input),result=>setState(current=>({...current,projectCloseouts:[...current.projectCloseouts,result]})));return}const item:ProjectCloseout={id:createId(),projectId,...input,items:[],serviceRequests:[],createdAt:new Date().toISOString()};setState(current=>({...current,projectCloseouts:[...current.projectCloseouts,item]}))},
    async updateProjectCloseout(closeoutId:string,input:ProjectCloseoutUpdateInput){if(api){await remote(()=>api.updateProjectCloseout(closeoutId,input),result=>setState(current=>({...current,projectCloseouts:current.projectCloseouts.map(item=>item.id===closeoutId?result:item)})));return}setState(current=>({...current,projectCloseouts:current.projectCloseouts.map(item=>item.id===closeoutId?{...item,...input}:item)}))},
    async customerSignProjectCloseout(closeoutId:string){if(api){await remote(()=>api.customerSignProjectCloseout(closeoutId),result=>setState(current=>({...current,projectCloseouts:current.projectCloseouts.map(item=>item.id===closeoutId?result:item)})));return}setState(current=>({...current,projectCloseouts:current.projectCloseouts.map(item=>item.id===closeoutId&&!item.customerSignedAt&&item.status!=='Voorbereiding'?{...item,customerSignedBy:current.companyUsers.find(user=>user.id===current.currentUserId)?.displayName??'Klant',customerSignedAt:new Date().toISOString()}:item)}))},
    async addCloseoutItem(closeoutId:string,input:Omit<CloseoutItem,'id'|'status'|'resolvedAt'>){if(api){await remote(()=>api.addCloseoutItem(closeoutId,input),result=>setState(current=>({...current,projectCloseouts:current.projectCloseouts.map(item=>item.id===closeoutId?result:item)})));return}setState(current=>({...current,projectCloseouts:current.projectCloseouts.map(item=>item.id===closeoutId?{...item,items:[...item.items,{id:createId(),...input,status:'Open'}]}:item)}))},
    async resolveCloseoutItem(closeoutId:string,itemId:string){if(api){await remote(()=>api.resolveCloseoutItem(closeoutId,itemId),result=>setState(current=>({...current,projectCloseouts:current.projectCloseouts.map(item=>item.id===closeoutId?result:item)})));return}setState(current=>({...current,projectCloseouts:current.projectCloseouts.map(item=>item.id===closeoutId?{...item,items:item.items.map(entry=>entry.id===itemId?{...entry,status:'Opgelost',resolvedAt:new Date().toISOString()}:entry)}:item)}))},
    async addServiceRequest(closeoutId:string,input:ServiceRequestInput){if(api){await remote(()=>api.addServiceRequest(closeoutId,input),result=>setState(current=>({...current,projectCloseouts:current.projectCloseouts.map(item=>item.id===closeoutId?result:item)})));return}setState(current=>({...current,projectCloseouts:current.projectCloseouts.map(item=>item.id===closeoutId?{...item,status:'Nazorg',serviceRequests:[{id:createId(),...input,status:'Nieuw'},...item.serviceRequests]}:item)}))},
    async resolveServiceRequest(closeoutId:string,requestId:string){if(api){await remote(()=>api.resolveServiceRequest(closeoutId,requestId),result=>setState(current=>({...current,projectCloseouts:current.projectCloseouts.map(item=>item.id===closeoutId?result:item)})));return}setState(current=>({...current,projectCloseouts:current.projectCloseouts.map(item=>item.id===closeoutId?{...item,serviceRequests:item.serviceRequests.map(request=>request.id===requestId?{...request,status:'Opgelost',resolvedAt:new Date().toISOString()}:request)}:item)}))},
    async createProcurementRequest(projectId: string, input: ProcurementRequestInput) {
      if (api) { await remote(() => api.createProcurementRequest(projectId, input), result => setState(current => ({ ...current, procurementRequests: [result, ...current.procurementRequests] }))); return }
      setState(current => {const amount=input.items.reduce((sum,item)=>sum+item.quantity*item.targetUnitPrice,0);const requiredRole=amount<=25_000?'Projectmanager':amount<=100_000?'Projectdirecteur':'Directie'; const request: ProcurementRequest = { id: createId(), number: `IB-${new Date().getFullYear()}-${String(current.procurementRequests.length + 1).padStart(3, '0')}`, projectId, ...input, status: 'Behoefte', quotes: [],approval:{status:'Te beoordelen',requiredRole,amount}, createdAt: todayIso() }; return { ...current, procurementRequests: [request, ...current.procurementRequests] } })
    },
    async issuePriceRequest(id: string) {
      if (api) { await remote(() => api.issuePriceRequest(id), result => setState(current => ({ ...current, procurementRequests: current.procurementRequests.map(item => item.id === id ? result : item) }))); return }
      setState(current => ({ ...current, procurementRequests: current.procurementRequests.map(item => item.id === id && item.status === 'Behoefte' ? { ...item, status: 'Prijsaanvraag' } : item) }))
    },
    async createSupplierFrameworkAgreement(id: string, input: import('./domain').SupplierFrameworkAgreementInput) {
      if (api) { await remote(() => api.createSupplierFrameworkAgreement(id, input), result => setState(current => ({ ...current, suppliers: current.suppliers.map(item => item.id === id ? result : item) }))); return }
      setState(current => ({ ...current, suppliers: current.suppliers.map(item => item.id === id ? { ...item, frameworkAgreements: [{ id: createId(), ...input, committedAmount: 0, status: 'Actief' as const, createdAt: new Date().toISOString() }, ...(item.frameworkAgreements ?? [])] } : item) }))
    },
    async approveProcurementRequest(id:string){if(api){await remote(()=>api.approveProcurementRequest(id),result=>setState(current=>({...current,procurementRequests:current.procurementRequests.map(item=>item.id===id?result:item)})));return}setState(current=>({...current,procurementRequests:current.procurementRequests.map(item=>item.id===id&&item.approval?{...item,approval:{...item.approval,status:'Goedgekeurd',approvedBy:'Demo-gebruiker',approvedAt:new Date().toISOString()}}:item)}))},
    async addSupplierQuote(id: string, input: SupplierQuoteInput) {
      if (api) { await remote(() => api.addSupplierQuote(id, input), result => setState(current => ({ ...current, procurementRequests: current.procurementRequests.map(item => item.id === id ? result : item) }))); return }
      setState(current => ({ ...current, procurementRequests: current.procurementRequests.map(item => item.id === id && ['Prijsaanvraag', 'Vergelijken'].includes(item.status) ? { ...item, status: 'Vergelijken', quotes: [...item.quotes, { id: createId(), ...input, createdAt: todayIso() }] } : item) }))
    },
    async selectSupplierQuote(id: string, quoteId: string) {
      if (api) { await remote(() => api.selectSupplierQuote(id, quoteId), result => setState(current => ({ ...current, procurementRequests: current.procurementRequests.map(item => item.id === id ? result.request : item), purchaseOrders: [result.order, ...current.purchaseOrders], projectCosts: [result.commitment, ...current.projectCosts] }))); return }
      setState(current => {
        const request = current.procurementRequests.find(item => item.id === id)
        const quote = request?.quotes.find(item => item.id === quoteId)
        const supplier = current.suppliers.find(item => item.id === quote?.supplierId)
        if (!request || request.status !== 'Vergelijken' || !quote || !supplier) return current
        const orderDate = new Date().toISOString().slice(0, 10)
        const commitment: ProjectCost = { id: createId(), projectId: request.projectId, workPackageId: request.workPackageId, date: orderDate, type: 'Verplichting', category: request.category, description: `${request.number} · ${request.description}`, supplier: supplier.name, amount: quote.amount, reference: request.number, status: 'Open', createdAt: todayIso() }
        const targetTotal = request.items.reduce((sum, item) => sum + item.quantity * item.targetUnitPrice, 0)
        const lines = request.items.map(item => ({ procurementItemId: item.id, description: item.description, unit: item.unit, orderedQuantity: item.quantity, receivedQuantity: 0, invoicedQuantity: 0, unitPrice: targetTotal ? quote.amount * (item.quantity * item.targetUnitPrice / targetTotal) / item.quantity : 0 }))
        const frameworkAgreement = (supplier.frameworkAgreements ?? []).find(item => item.status === 'Actief' && item.category === request.category && item.startsOn <= orderDate && item.endsOn >= orderDate)
        const order: PurchaseOrder = { id: createId(), number: `BB-${new Date().getFullYear()}-${String(current.purchaseOrders.length + 1).padStart(3, '0')}`, procurementRequestId: request.id, projectId: request.projectId, supplierId: supplier.id, frameworkAgreementId: frameworkAgreement?.id, orderDate, expectedDeliveryDate: addDays(orderDate, quote.leadTimeDays), amount: quote.amount, status: 'Besteld', commitmentCostId: commitment.id, lines, receipts: [], createdAt: todayIso() }
        return { ...current, procurementRequests: current.procurementRequests.map(item => item.id === id ? { ...item, status: 'Besteld', selectedQuoteId: quoteId, purchaseOrderId: order.id } : item), purchaseOrders: [order, ...current.purchaseOrders], projectCosts: [commitment, ...current.projectCosts] }
      })
    },
    async receivePurchaseOrder(id: string, input: PurchaseReceiptInput) {
      if (api) { await remote(() => api.receivePurchaseOrder(id, input), result => setState(current => ({ ...current, purchaseOrders: current.purchaseOrders.map(item => item.id === id ? result : item) }))); return }
      setState(current => ({ ...current, purchaseOrders: current.purchaseOrders.map(item => {
        if (item.id !== id || !['Besteld', 'Gedeeltelijk ontvangen'].includes(item.status)) return item
        const receiptLines = input.lines?.length ? input.lines : (item.lines ?? []).map(line => ({ procurementItemId: line.procurementItemId, quantity: line.orderedQuantity - line.receivedQuantity }))
        const lines = (item.lines ?? []).map(line => ({ ...line, receivedQuantity: line.receivedQuantity + (receiptLines.find(receipt => receipt.procurementItemId === line.procurementItemId)?.quantity ?? 0) }))
        const complete = !lines.length || lines.every(line => line.receivedQuantity >= line.orderedQuantity)
        return { ...item, status: complete ? 'Ontvangen' as const : 'Gedeeltelijk ontvangen' as const, lines, receipts: [...(item.receipts ?? []), { id: createId(), ...input, lines: receiptLines }], receivedAt: input.receivedAt, deliveryReference: input.deliveryReference, receivedBy: input.receivedBy, receiptNotes: input.notes }
      }) }))
    },
    async downloadPurchaseOrderPdf(id: string) {
      if (!api) { const order=state.purchaseOrders.find(item=>item.id===id); if(!order)return undefined; return demoDocumentBlob({id:`pdf-${id}`,documentId:id,revision:1,revisionLabel:'R1',fileName:`${order.number}.pdf`,mimeType:'application/pdf',sizeBytes:0,notes:`Bestelbon ${order.number} voor ${order.amount.toFixed(2)} EUR`,uploadedBy:'BouwFlow',createdAt:new Date().toISOString()}) }
      return remote(() => api.downloadPurchaseOrderPdf(id), () => undefined)
    },
    async matchPurchaseInvoice(id: string, input: PurchaseInvoiceMatchInput) {
      if (api) { await remote(() => api.matchPurchaseInvoice(id, input), result => setState(current => ({ ...current, purchaseOrders: current.purchaseOrders.map(item => item.id === id ? result.order : item), procurementRequests: current.procurementRequests.map(item => item.id === result.request.id ? result.request : item), projectCosts: [...(result.actualCost ? [result.actualCost] : []), ...current.projectCosts.map(item => item.id === result.commitment.id ? result.commitment : item)] }))); return }
      setState(current => {
        const order = current.purchaseOrders.find(item => item.id === id)
        const commitment = current.projectCosts.find(item => item.id === order?.commitmentCostId)
        if (!order || order.status !== 'Ontvangen' || !commitment || commitment.status !== 'Open') return current
        const invoiceLines = input.lines ?? (order.lines ?? []).map(line => ({ procurementItemId: line.procurementItemId, quantity: line.receivedQuantity, unitPrice: line.unitPrice }))
        const deviations: string[] = []
        for (const line of order.lines ?? []) {
          const invoiceLine = invoiceLines.find(entry => entry.procurementItemId === line.procurementItemId)
          if (!invoiceLine || Math.abs(invoiceLine.quantity - line.receivedQuantity) > .0001 || Math.abs(invoiceLine.unitPrice - line.unitPrice) > .01) deviations.push(`${line.description}: bestelling, ontvangst en factuur stemmen niet overeen`)
        }
        const amountDifference = Number((input.amount - order.amount).toFixed(2))
        if (Math.abs(amountDifference) > .01) deviations.push(`Factuurtotaal wijkt ${amountDifference.toFixed(2)} af van de bestelbon`)
        const matchResult = { matched: !deviations.length, amountDifference, deviations, invoiceLines, checkedBy: 'Demo-gebruiker', checkedAt: new Date().toISOString() }
        const lines = (order.lines ?? []).map(line => ({ ...line, invoicedQuantity: invoiceLines.find(entry => entry.procurementItemId === line.procurementItemId)?.quantity ?? 0 }))
        if (deviations.length) return { ...current, purchaseOrders: current.purchaseOrders.map(item => item.id === id ? { ...item, status: 'Afwijking', lines, matchResult, invoiceNumber: input.invoiceNumber, invoiceDate: input.invoiceDate, invoiceDueDate: input.dueDate, invoiceAmount: input.amount } : item) }
        const actualCost: ProjectCost = { id: createId(), projectId: order.projectId, workPackageId: commitment.workPackageId, date: input.invoiceDate, type: 'Werkelijke kost', category: commitment.category, description: commitment.description, supplier: commitment.supplier, amount: input.amount, reference: input.invoiceNumber, status: 'Geboekt', sourceCommitmentId: commitment.id, createdAt: todayIso() }
        return { ...current, purchaseOrders: current.purchaseOrders.map(item => item.id === id ? { ...item, status: 'Factuur gecontroleerd', lines, matchResult, invoiceNumber: input.invoiceNumber, invoiceDate: input.invoiceDate, invoiceDueDate: input.dueDate, invoiceAmount: input.amount, actualCostId: actualCost.id } : item), procurementRequests: current.procurementRequests.map(item => item.id === order.procurementRequestId ? { ...item, status: 'Afgesloten' } : item), projectCosts: [actualCost, ...current.projectCosts.map(item => item.id === commitment.id ? { ...item, status: 'Omgezet' as const, settledByEntryId: actualCost.id } : item)] }
      })
    },
    async approvePurchaseInvoiceDeviation(id: string, reason: string) {
      if (!api) { setState(current => { const order=current.purchaseOrders.find(item=>item.id===id); const commitment=current.projectCosts.find(item=>item.id===order?.commitmentCostId); if(!order||order.status!=='Afwijking'||!commitment||order.invoiceAmount==null||!order.invoiceDate||!order.invoiceNumber)return current; const actualCost:ProjectCost={id:createId(),projectId:order.projectId,workPackageId:commitment.workPackageId,date:order.invoiceDate,type:'Werkelijke kost',category:commitment.category,description:commitment.description,supplier:commitment.supplier,amount:order.invoiceAmount,reference:order.invoiceNumber,status:'Geboekt',sourceCommitmentId:commitment.id,createdAt:todayIso()}; return {...current,purchaseOrders:current.purchaseOrders.map(item=>item.id===id?{...item,status:'Factuur gecontroleerd',actualCostId:actualCost.id,matchResult:item.matchResult?{...item.matchResult,approvedBy:'Demo-gebruiker',approvedAt:new Date().toISOString(),approvalReason:reason}:item.matchResult}:item),procurementRequests:current.procurementRequests.map(item=>item.id===order.procurementRequestId?{...item,status:'Afgesloten'}:item),projectCosts:[actualCost,...current.projectCosts.map(item=>item.id===commitment.id?{...item,status:'Omgezet' as const,settledByEntryId:actualCost.id}:item)]} }); return }
      await remote(() => api.approvePurchaseInvoiceDeviation(id, reason), result => setState(current => ({ ...current, purchaseOrders: current.purchaseOrders.map(item => item.id === id ? result.order : item), procurementRequests: current.procurementRequests.map(item => item.id === result.request.id ? result.request : item), projectCosts: [...(result.actualCost ? [result.actualCost] : []), ...current.projectCosts.map(item => item.id === result.commitment.id ? result.commitment : item)] })))
    },
    async registerPurchasePayment(id: string, input: PaymentRegistrationInput) {
      if (api) { await remote(() => api.registerPurchasePayment(id, input), result => setState(current => ({ ...current, purchaseOrders: current.purchaseOrders.map(item => item.id === id ? result : item) }))); return }
      setState(current => ({ ...current, purchaseOrders: current.purchaseOrders.map(item => item.id === id && item.status === 'Factuur gecontroleerd' && item.invoiceAmount != null && Math.abs(item.invoiceAmount - input.amount) <= 0.01 ? { ...item, status: 'Betaald', paidAt: input.paymentDate, paidAmount: input.amount, paymentReference: input.reference } : item) }))
    },
    async loadUserPreference<T extends object>(key: string): Promise<T | undefined> {
      if (!api) return undefined
      return (await remote(() => api.userPreference<T>(key), () => undefined))?.value ?? undefined
    },
    async saveUserPreference<T extends object>(key: string, value: T): Promise<void> {
      if (api) await remote(() => api.saveUserPreference(key, value), () => undefined)
    },
    async loadAuditTrail(entityType: string, entityId: string): Promise<AuditTrailEntry[]> {
      if (!api) return []
      return (await remote(() => api.auditTrail(entityType, entityId), () => undefined)) ?? []
    },
    resetDemo() { if (!api) setState(seed) },
    retry: refresh,
  }), [api, refresh, remote, state.purchaseOrders, state.documents])

  return { state, actions, connection }
}
