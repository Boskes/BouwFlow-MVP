export type Page = 'dashboard' | 'dossiers' | 'crm' | 'opportunities' | 'calculations' | 'cost-library' | 'projects' | 'planning' | 'hr' | 'resources' | 'site' | 'changes' | 'financial' | 'control' | 'procurement' | 'cashflow' | 'post-calculation' | 'documents' | 'qhse' | 'subcontractors' | 'consortia' | 'integrations' | 'ai' | 'closeout' | 'client-portal' | 'subcontractor-portal' | 'supplier-portal' | 'company' | 'access' | 'entity-finance' | 'notification-settings'

export interface AuditTrailEntry {
  id: string
  userId: string
  userName: string
  entityType: string
  entityId: string
  action: string
  reason?: string
  createdAt: string
}

export type CostCategory = 'labor' | 'material' | 'equipment' | 'subcontracting'

export const DEFAULT_COST_LIBRARY_ID = '00000000-0000-4000-8000-000000000101'
export const DEFAULT_COST_LIBRARY_VERSION_ID = '00000000-0000-4000-8000-000000000102'

export interface CostLibrary {
  id: string
  name: string
  description: string
  active: boolean
  legalEntityId?: string
  branchId?: string
  createdAt: string
}

export interface CostLibraryVersion {
  id: string
  libraryId: string
  version: number
  label: string
  status: 'Concept' | 'Gepubliceerd' | 'Gearchiveerd'
  effectiveFrom: string
  createdAt: string
}

export type UnitCategory = 'Lengte' | 'Oppervlakte' | 'Volume' | 'Massa' | 'Tijd' | 'Aantal' | 'Globaal' | 'Overig'

export interface UnitDefinition {
  id: string
  code: string
  name: string
  category: UnitCategory
  active: boolean
  createdAt: string
}

export interface UnitConversion {
  id: string
  fromUnitId: string
  toUnitId: string
  factor: number
  createdAt: string
}

export interface BulkCostUpdateResult {
  calculation: Calculation
  updatedItems: number
  updatedApplications: number
  skippedItems: number
}

export interface BulkPriceAdjustmentResult {
  calculation: Calculation
  affectedItems: number
  skippedItems: number
}

export interface CostLibraryItem {
  id: string
  libraryVersionId?: string
  code: string
  name: string
  category: CostCategory
  unit: string
  unitCost: number
  source: string
  updatedAt: string
}

export interface CostApplication {
  libraryItemId: string
  factor: number
  appliedUnitCost: number
}

export type OpportunityStage =
  | 'Nieuw'
  | 'Gekwalificeerd'
  | 'Go/No-Go'
  | 'Calculatie'
  | 'Offerte verstuurd'
  | 'Onderhandeling'
  | 'Gewonnen'
  | 'Verloren'

export type GoNoGoCriterion =
  | 'capacity'
  | 'financialRisk'
  | 'recognition'
  | 'technicalFeasibility'
  | 'expectedMargin'
  | 'competition'
  | 'strategicValue'
  | 'resources'
  | 'subcontractors'
  | 'contractRisk'

export interface OpportunityGoNoGo {
  decision: 'Go' | 'No-Go'
  scores: Record<GoNoGoCriterion, number>
  averageScore: number
  notes: string
  assessedBy: string
  assessedAt: string
}

export type OpportunityGoNoGoInput = Pick<OpportunityGoNoGo, 'decision' | 'scores' | 'notes' | 'assessedBy'>

export type OrganizationRole =
  | 'Prospect'
  | 'Klant'
  | 'Opdrachtgever'
  | 'Architect'
  | 'Studiebureau'
  | 'Hoofdaannemer'
  | 'Onderaannemer'
  | 'Leverancier'
  | 'Vastgoedontwikkelaar'
  | 'Intercommunale'
  | 'Gemeente'
  | 'Overheidsdienst'
  | 'Nutsmaatschappij'
  | 'Partner'
  | 'Consultant'
  | 'Verzekeraar'
  | 'Financier'

export interface OrganizationContact {
  id: string
  firstName: string
  lastName: string
  jobTitle: string
  department: string
  email: string
  phone: string
  mobile: string
  isPrimary: boolean
  active: boolean
}

export type OrganizationAddressType =
  | 'Bezoekadres'
  | 'Maatschappelijke zetel'
  | 'Facturatieadres'
  | 'Leveringsadres'
  | 'Correspondentieadres'
  | 'Werfadres'
  | 'Ander'

export interface OrganizationAddress {
  id: string
  type: OrganizationAddressType
  label: string
  addressLine: string
  postalCode: string
  city: string
  countryCode: string
  isPrimary: boolean
  notes: string
}

export interface CrmActivity {
  id: string
  type: 'Telefoongesprek' | 'E-mail' | 'Afspraak' | 'Bezoek' | 'Taak' | 'Notitie'
  subject: string
  startsAt: string
  endsAt?: string
  contactId?: string
  ownerEmployeeId?: string
  status: 'Gepland' | 'Voltooid' | 'Geannuleerd'
  notes: string
  createdBy: string
  createdAt: string
}

export interface OrganizationRelation {
  id: string
  relatedOrganizationId: string
  type: 'Moederbedrijf' | 'Dochterbedrijf' | 'Partner' | 'Combinatie' | 'Opdrachtgever' | 'Architect' | 'Studiebureau' | 'Hoofdaannemer' | 'Onderaannemer' | 'Leverancier'
  notes: string
  createdAt: string
}

export interface Organization {
  id: string
  name: string
  type: 'Overheid' | 'Privaat' | 'Nutsbedrijf'
  contactName: string
  email: string
  vatNumber: string
  addressLine: string
  postalCode: string
  city: string
  countryCode: string
  peppolEndpointId: string
  peppolSchemeId: string
  roles?: OrganizationRole[]
  contacts?: OrganizationContact[]
  addresses?: OrganizationAddress[]
  activities?: CrmActivity[]
  relations?: OrganizationRelation[]
}

export type OrganizationInput = Omit<Organization, 'id'>
export type OrganizationBillingInput = Pick<Organization, 'vatNumber' | 'addressLine' | 'postalCode' | 'city' | 'countryCode' | 'peppolEndpointId' | 'peppolSchemeId'>

export function organizationAddresses(organization: Pick<Organization, 'id' | 'addressLine' | 'postalCode' | 'city' | 'countryCode' | 'addresses'>): OrganizationAddress[] {
  if (organization.addresses?.length) return organization.addresses
  return [{
    id: `legacy-address-${organization.id}`,
    type: 'Bezoekadres',
    label: 'Hoofdadres',
    addressLine: organization.addressLine,
    postalCode: organization.postalCode,
    city: organization.city,
    countryCode: organization.countryCode || 'BE',
    isPrimary: true,
    notes: '',
  }]
}

export function organizationAddress(
  organization: Pick<Organization, 'id' | 'addressLine' | 'postalCode' | 'city' | 'countryCode' | 'addresses'>,
  type?: OrganizationAddressType,
) {
  const addresses = organizationAddresses(organization)
  return (type ? addresses.find((address) => address.type === type) : undefined)
    ?? addresses.find((address) => address.isPrimary)
    ?? addresses[0]
}

export interface BelgianAddressSuggestion {
  id: string
  label: string
  addressLine: string
  street: string
  houseNumber: string
  postalCode: string
  city: string
  municipality: string
  province?: string
  latitude?: number
  longitude?: number
  source: string
}

export interface Opportunity {
  id: string
  projectNumber: string
  title: string
  organizationId: string
  legalEntityId?: string
  branchId?: string
  location: string
  deadline: string
  estimatedValue: number
  probability: number
  stage: OpportunityStage
  recognition: string
  goNoGo?: OpportunityGoNoGo
  tender?: TenderDossier
}

export interface TenderQuestion {
  id: string
  question: string
  askedOn: string
  answer?: string
  answeredOn?: string
  status: 'Open' | 'Beantwoord'
}

export interface TenderSiteVisit {
  id: string
  scheduledAt: string
  location: string
  mandatory: boolean
  attendees: string[]
  notes: string
  completedAt?: string
}

export type TenderSubmissionStatus = 'Niet gestart' | 'Gepland' | 'Klaar voor indiening' | 'Ingediend'

export interface TenderSubmissionChecklistItem {
  id: string
  label: string
  required: boolean
  completed: boolean
  completedAt?: string
  completedBy?: string
}

export interface TenderSubmissionPlan {
  ownerEmployeeId?: string
  reviewerEmployeeId?: string
  internalReviewAt?: string
  finalizationAt?: string
  submissionAt?: string
  reminderDays: number[]
  status: TenderSubmissionStatus
  checklist: TenderSubmissionChecklistItem[]
  notes: string
  submissionReference?: string
  submittedAt?: string
  submittedBy?: string
  updatedAt: string
}

export interface TenderDossier {
  procedureType: 'Openbaar' | 'Niet-openbaar' | 'Onderhandeling' | 'Privaat'
  publicationDate?: string
  submissionDeadline: string
  executionPeriod: string
  recognitionClass: string
  recognitionCategory: string
  selectionConditions: string[]
  awardCriteria: Array<{ id: string; criterion: string; weightPct: number }>
  requiredDocumentIds: string[]
  questions: TenderQuestion[]
  siteVisits: TenderSiteVisit[]
  competitors: string[]
  deadlineWarningDays: number[]
  approvedBy?: string
  approvedAt?: string
  submissionPlan?: TenderSubmissionPlan
  updatedAt: string
}

export function normalizeTenderDossier(value: Partial<TenderDossier> | null | undefined): TenderDossier {
  const tender = value ?? {}
  const legacyDocuments = (tender as Partial<TenderDossier> & { documents?: unknown }).documents
  const requiredDocumentIds = Array.isArray(tender.requiredDocumentIds)
    ? tender.requiredDocumentIds
    : Array.isArray(legacyDocuments)
      ? legacyDocuments.filter((item): item is string => typeof item === 'string')
      : []

  return {
    ...tender,
    procedureType: tender.procedureType ?? 'Openbaar',
    submissionDeadline: tender.submissionDeadline ?? '',
    executionPeriod: tender.executionPeriod ?? '',
    recognitionClass: tender.recognitionClass ?? '',
    recognitionCategory: tender.recognitionCategory ?? '',
    selectionConditions: Array.isArray(tender.selectionConditions) ? tender.selectionConditions : [],
    awardCriteria: Array.isArray(tender.awardCriteria) ? tender.awardCriteria : [],
    requiredDocumentIds,
    questions: Array.isArray(tender.questions) ? tender.questions : [],
    siteVisits: Array.isArray(tender.siteVisits) ? tender.siteVisits : [],
    competitors: Array.isArray(tender.competitors) ? tender.competitors : [],
    deadlineWarningDays: Array.isArray(tender.deadlineWarningDays) ? tender.deadlineWarningDays : [30, 14, 7, 2],
    updatedAt: tender.updatedAt ?? '',
  }
}

export type OpportunityDetailsInput = Pick<Opportunity, 'title' | 'organizationId' | 'legalEntityId' | 'branchId' | 'location' | 'deadline' | 'estimatedValue' | 'probability' | 'recognition'>

export type BoqPostType = 'Meetstaatpost' | 'Samengestelde post' | 'Percentagepost' | 'Stelpost' | 'Optiepost' | 'Tekstregel' | 'Subtotaal'
export type BoqFormulaTarget = 'quantity' | 'labor' | 'material' | 'equipment' | 'subcontracting' | 'wastePct' | 'itemRiskPct' | 'markupPct'
export type BoqFormulaField = BoqFormulaTarget | 'baseUnitCost'
export type BoqFormulaOperator = '+' | '-' | '*' | '/' | '%' | '^' | '(' | ')'

export interface BoqFormulaVariable {
  id: string
  name: string
  value: number
  unit: string
}

export type BoqFormulaToken =
  | { id: string; kind: 'field'; field: BoqFormulaField }
  | { id: string; kind: 'variable'; variableId: string }
  | { id: string; kind: 'number'; value: number }
  | { id: string; kind: 'operator'; operator: BoqFormulaOperator }

export interface BoqFormula {
  id: string
  label: string
  tokens: BoqFormulaToken[]
  updatedAt: string
}

export interface BoqPriceAdjustment {
  id: string
  label: string
  type: 'Markup' | 'Markdown'
  basis: 'Directe kost' | 'Arbeid' | 'Materiaal' | 'Materieel' | 'Onderaanneming'
  percentage: number
  active: boolean
}

export interface BoqItem {
  id: string
  chapterId?: string | null
  sortOrder?: number
  code: string
  description: string
  quantity: number
  unit: string
  labor: number
  material: number
  equipment: number
  subcontracting: number
  postType?: BoqPostType
  quantityType?: 'Forfaitair' | 'Vermoedelijk' | 'Verrekenbaar' | 'Optioneel'
  wastePct?: number
  itemRiskPct?: number
  markupPct?: number
  notes?: string
  variables?: BoqFormulaVariable[]
  formulas?: Partial<Record<BoqFormulaTarget, BoqFormula>>
  priceAdjustments?: BoqPriceAdjustment[]
  costApplications?: Partial<Record<CostCategory, CostApplication>>
}

export interface BoqChapter {
  id: string
  code: string
  name: string
  sortOrder: number
}

export interface Calculation {
  id: string
  number: string
  opportunityId: string
  status: 'In opmaak' | 'Review' | 'Offerte'
  overheadPct: number
  riskPct: number
  marginPct: number
  siteOverheadPct?: number
  escalationPct?: number
  discountPct?: number
  roundingStep?: number
  chapters: BoqChapter[]
  items: BoqItem[]
  updatedAt: string
}

export interface CalculationTemplateItem {
  code: string
  description: string
  quantity: number
  unit: string
  labor: number
  material: number
  equipment: number
  subcontracting: number
  quantityType?: BoqItem['quantityType']
}

export interface CalculationTemplateChapter {
  code: string
  name: string
  items: CalculationTemplateItem[]
}

export interface CalculationTemplate {
  id: string
  name: string
  description: string
  discipline: string
  recognitionClass: 'Klasse 8'
  version: number
  chapters: CalculationTemplateChapter[]
}

export interface CalculationVersion {
  id: string
  calculationId: string
  version: number
  label: string
  reason: string
  snapshot: Calculation
  createdAt: string
  createdBy: string
}

export type CalculationSnapshotDifferenceStatus = 'Toegevoegd' | 'Verwijderd' | 'Gewijzigd' | 'Gelijk'

export interface CalculationSnapshotItemDifference {
  code: string
  status: CalculationSnapshotDifferenceStatus
  before?: BoqItem
  after?: BoqItem
  beforeChapter: string
  afterChapter: string
  beforeQuantity: number
  afterQuantity: number
  beforeUnitCost: number
  afterUnitCost: number
  beforeTotal: number
  afterTotal: number
  totalDifference: number
  changedFields: string[]
}

export interface CalculationSnapshotComparison {
  beforeDirectCost: number
  afterDirectCost: number
  directCostDifference: number
  beforeSellingTotal: number
  afterSellingTotal: number
  sellingTotalDifference: number
  rows: CalculationSnapshotItemDifference[]
  added: number
  removed: number
  changed: number
  unchanged: number
  pricingChanges: Array<{ field: string; label: string; before: number; after: number; difference: number }>
}

export interface CalculationScenario {
  id: string
  calculationId: string
  name: string
  description: string
  laborAdjustmentPct: number
  materialAdjustmentPct: number
  equipmentAdjustmentPct: number
  subcontractingAdjustmentPct: number
  overheadPct: number
  riskPct: number
  marginPct: number
  isSelected: boolean
  updatedAt: string
}

export interface BoqImportError {
  row: number
  field: string
  message: string
}

export interface BoqImportRow extends Omit<BoqItem, 'id' | 'chapterId'> {
  chapterCode: string
  chapterName: string
}

export interface BoqImportPreview {
  fileName: string
  sheetName: string
  rows: BoqImportRow[]
  chapterCount: number
  validRowCount: number
  errors: BoqImportError[]
}

export interface Quote {
  id: string
  number: string
  calculationId: string
  scenarioId?: string | null
  version: number
  total: number
  content: QuoteContent
  snapshot: QuoteSnapshot
  createdAt: string
  workflow?: QuoteWorkflow
}

export interface QuoteWorkflowEvent {
  id: string
  type: 'Aangemaakt' | 'Goedgekeurd' | 'Verzonden' | 'Geopend' | 'Herinnerd' | 'Ondertekend' | 'Verloren'
  at: string
  actor: string
  detail?: string
}

export interface QuoteWorkflow {
  status: 'Concept' | 'Intern goedgekeurd' | 'Verzonden' | 'Geopend' | 'Ondertekend' | 'Verloren'
  validUntil: string
  approvedBy?: string
  approvedAt?: string
  sentTo?: string
  sentAt?: string
  mailProviderReference?: string
  openedAt?: string
  signedBy?: string
  signedAt?: string
  lossReason?: string
  reminderAt?: string
  events: QuoteWorkflowEvent[]
}

export interface QuoteContent {
  subject: string
  introduction: string
  executionTerm: string
  paymentTerms: string
  validityDays: number
  validUntil?: string
  priceRevision: string
  exclusions: string[]
  notes: string
}

export interface QuoteLine {
  chapterCode?: string
  code: string
  description: string
  quantity: number
  unit: string
  unitPrice: number
  total: number
}

export interface QuoteSnapshot {
  supplierName: string
  clientName: string
  clientContact: string
  projectTitle: string
  projectNumber: string
  location: string
  scenarioName?: string
  lines: QuoteLine[]
  directCost: number
  overheadPct: number
  riskPct: number
  marginPct: number
  total: number
}

export interface Project {
  id: string
  number: string
  name: string
  organizationId: string
  legalEntityId?: string
  branchId?: string
  sourceCalculationId: string
  contractValue: number
  costBudget: number
  marginPct: number
  progress: number
  status: 'Opstart' | 'Op schema' | 'Risico'
  handover: ProjectHandover
  workPackages: ProjectWorkPackage[]
  planning: ProjectPlanning
}

export type ProjectDetailsInput = Pick<Project, 'name' | 'organizationId' | 'progress' | 'status'>

export interface LegalEntity {
  id: string
  name: string
  vatNumber: string
  country: string
  currency: string
  active: boolean
  invoicePrefix: string
  nextInvoiceNumber: number
  defaultVatPct: number
  iban: string
  bic: string
  paymentTermsDays: number
  addressLine: string
  postalCode: string
  city: string
  countryCode: string
  peppolEndpointId: string
  peppolSchemeId: string
  createdAt: string
}

export type LegalEntityInput = Omit<LegalEntity, 'id' | 'createdAt' | 'invoicePrefix' | 'nextInvoiceNumber' | 'defaultVatPct' | 'iban' | 'bic' | 'paymentTermsDays' | 'addressLine' | 'postalCode' | 'city' | 'countryCode' | 'peppolEndpointId' | 'peppolSchemeId'> & Partial<Pick<LegalEntity, 'invoicePrefix' | 'nextInvoiceNumber' | 'defaultVatPct' | 'iban' | 'bic' | 'paymentTermsDays' | 'addressLine' | 'postalCode' | 'city' | 'countryCode' | 'peppolEndpointId' | 'peppolSchemeId'>>
export type LegalEntityFinancialInput = Pick<LegalEntity, 'vatNumber' | 'invoicePrefix' | 'nextInvoiceNumber' | 'defaultVatPct' | 'iban' | 'bic' | 'paymentTermsDays' | 'addressLine' | 'postalCode' | 'city' | 'countryCode' | 'peppolEndpointId' | 'peppolSchemeId'>

export interface CompanyBranch {
  id: string
  legalEntityId: string
  name: string
  address: string
  country: string
  createdAt: string
}

export type CompanyBranchInput = Omit<CompanyBranch, 'id' | 'legalEntityId' | 'createdAt'>

export interface ProjectCompanyAssignmentInput {
  legalEntityId: string
  branchId?: string
}

export interface CompanyUser {
  id: string
  displayName: string
  email: string
  role: string
  status?: 'Uitgenodigd' | 'Actief' | 'Geblokkeerd'
  employeeId?: string
  organizationId?: string
  subcontractorId?: string
  supplierId?: string
  allLegalEntities: boolean
  legalEntityIds: string[]
  allProjects?: boolean
  projectIds?: string[]
}

export interface CompanyUserAccessInput {
  allLegalEntities: boolean
  legalEntityIds: string[]
  allProjects?: boolean
  projectIds?: string[]
}

export interface CompanyUserProfileInput extends CompanyUserAccessInput {
  displayName: string
  email: string
  role: string
  status: 'Uitgenodigd' | 'Actief' | 'Geblokkeerd'
  employeeId?: string
  organizationId?: string
  subcontractorId?: string
  supplierId?: string
}

export type WorkflowDossierType = 'opportunity' | 'document' | 'contract' | 'daily-report' | 'change-order' | 'progress-statement' | 'employee-absence' | 'time-entry' | 'project-claim' | 'qhse-inspection'

export interface WorkflowStepDefinition {
  id: string
  label: string
  ownerRole: string
  slaHours?: number
  required: boolean
}

export interface WorkflowDefinition {
  id: string
  name: string
  dossierType: WorkflowDossierType
  active: boolean
  steps: WorkflowStepDefinition[]
  updatedAt: string
}

export type WorkflowDefinitionInput = Omit<WorkflowDefinition, 'id' | 'updatedAt'>

export interface WorkflowCorrectionInput {
  dossierType: WorkflowDossierType
  recordId: string
  targetStatus: string
  reason: string
}

export interface WorkflowCorrection extends WorkflowCorrectionInput {
  id: string
  previousStatus: string
  correctedBy: string
  correctedAt: string
}

export interface WorkflowCorrectionResult {
  correction: WorkflowCorrection
  record: unknown
}

export interface ProjectWorkPackage {
  id: string
  code: string
  name: string
  budget: number
  plannedHours: number
  status: 'Niet gestart' | 'Klaar voor planning'
}

export interface ProjectHandoverChecklist {
  scopeReviewed: boolean
  budgetReviewed: boolean
  contractReviewed: boolean
  documentsTransferred: boolean
  risksReviewed: boolean
  kickoffPlanned: boolean
}

export interface ProjectHandover {
  status: 'Concept' | 'Klaar voor overdracht' | 'Aanvaard'
  projectManager: string
  projectManagerEmployeeId?: string
  plannedStart: string
  plannedEnd: string
  notes: string
  risks: string[]
  checklist: ProjectHandoverChecklist
  acceptedAt?: string
}

export interface ProjectStartupInput {
  handover: Omit<ProjectHandover, 'acceptedAt'>
  workPackages: ProjectWorkPackage[]
}

export interface PlanningActivity {
  id: string
  workPackageId?: string
  name: string
  startDate: string
  endDate: string
  progress: number
  predecessorIds: string[]
  dependencies?: PlanningDependency[]
  milestone: boolean
  responsible: string
  responsibleEmployeeId?: string
  crewSize: number
  weatherSensitive: boolean
  resourceAssignments: PlanningResourceAssignment[]
  baselineStartDate?: string
  baselineEndDate?: string
}

export type PlanningDependencyType = 'FS' | 'SS' | 'FF' | 'SF'

export interface PlanningDependency {
  predecessorId: string
  type: PlanningDependencyType
  lagDays: number
}

export type PlanningResourceType = 'Medewerker' | 'Ploeg' | 'Materieel' | 'Onderaannemer'

export interface PlanningResourceAssignment {
  id: string
  employeeId?: string
  crewId?: string
  resourceType: PlanningResourceType
  resourceName: string
  allocationPct: number
  certificateExpiresOn?: string
}

export interface Employee {
  id: string
  employeeNumber: string
  firstName: string
  lastName: string
  email: string
  role: string
  legalEntityId: string
  branchId?: string
  employmentPct: number
  weeklyHours: number
  annualLeaveHours: number
  hireDate: string
  endDate?: string
  skills: string[]
  active: boolean
  createdAt: string
}

export type EmployeeInput = Omit<Employee, 'id' | 'createdAt'>

export interface EmployeeCrew {
  id: string
  name: string
  legalEntityId: string
  branchId?: string
  leaderEmployeeId: string
  memberEmployeeIds: string[]
  active: boolean
  createdAt: string
}

export type EmployeeCrewInput = Omit<EmployeeCrew, 'id' | 'createdAt'>

export type AbsenceType = 'Verlof' | 'Ziekte' | 'Opleiding' | 'Feestdag' | 'Tijdelijke werkloosheid' | 'Andere'

export interface EmployeeAbsence {
  id: string
  employeeId: string
  type: AbsenceType
  startDate: string
  endDate: string
  hours: number
  reason: string
  status: 'Aangevraagd' | 'Goedgekeurd' | 'Geweigerd' | 'Geannuleerd'
  requestedBy: string
  requestedAt: string
  decidedBy?: string
  decidedAt?: string
}

export type EmployeeAbsenceInput = Omit<EmployeeAbsence, 'id' | 'status' | 'requestedAt' | 'decidedBy' | 'decidedAt'>

export interface EmployeeAbsenceDecisionInput {
  status: 'Goedgekeurd' | 'Geweigerd'
  decidedBy: string
}

export interface PlanningConflict {
  id: string
  resourceName: string
  resourceType: PlanningResourceType
  severity: 'Waarschuwing' | 'Kritiek'
  message: string
  projectIds: string[]
  activityIds: string[]
  startDate: string
  endDate: string
  totalAllocationPct?: number
  capacityPct?: number
  usages?: PlanningConflictUsage[]
}

export interface PlanningConflictUsage {
  projectId: string
  projectNumber: string
  projectName: string
  activityId: string
  activityName: string
  assignmentId: string
  allocationPct: number
  startDate: string
  endDate: string
  resourceType: PlanningResourceType
}

export type PlanningBaselineApprovalStatus = 'Concept' | 'Ter goedkeuring' | 'Goedgekeurd' | 'Vervangen'

export interface PlanningBaselineActivity {
  activityId: string
  startDate: string
  endDate: string
}

export interface PlanningBaselineVersion {
  version: number
  name: string
  reason: string
  approvalStatus: PlanningBaselineApprovalStatus
  createdAt: string
  createdBy: string
  activities: PlanningBaselineActivity[]
}

export interface PlanningScenario {
  id: string
  name: string
  description: string
  createdAt: string
  createdBy: string
  activities: PlanningActivity[]
}

export interface ProjectPlanning {
  status: 'Concept' | 'Baseline' | 'Gewijzigd'
  baselineVersion: number
  activities: PlanningActivity[]
  updatedAt: string
  baselineHistory?: PlanningBaselineVersion[]
  scenarios?: PlanningScenario[]
  selectedScenarioId?: string
}

export interface ProjectPlanningInput {
  activities: PlanningActivity[]
  scenarios?: PlanningScenario[]
  selectedScenarioId?: string
}

export interface ProjectBaselineInput {
  name?: string
  reason?: string
  approvalStatus?: Exclude<PlanningBaselineApprovalStatus, 'Vervangen'>
}

export interface CriticalPathActivityMetric {
  activityId: string
  durationDays: number
  earliestStartDay: number
  earliestFinishDay: number
  latestStartDay: number
  latestFinishDay: number
  totalFloatDays: number
  critical: boolean
}

export interface CriticalPathAnalysis {
  projectDurationDays: number
  criticalActivityIds: Set<string>
  metrics: Map<string, CriticalPathActivityMetric>
  hasCycle: boolean
}

export interface DailyLaborEntry {
  id: string
  employeeId?: string
  employeeName: string
  role: string
  hours: number
  overtimeHours: number
}

export interface DailyResourceEntry {
  id: string
  description: string
  quantity: number
  unit: string
}

export interface DailyReport {
  id: string
  projectId: string
  date: string
  workPackageId?: string
  weather: 'Droog' | 'Regen' | 'Wind' | 'Vorst' | 'Hitte' | 'Wisselvallig'
  temperature: number
  activities: string
  laborEntries: DailyLaborEntry[]
  subcontractors: string[]
  materials: DailyResourceEntry[]
  machines: DailyResourceEntry[]
  deliveries: string
  delays: string
  problems: string
  visitors: string
  notes: string
  status: 'Concept' | 'Ingediend' | 'Ondertekend'
  createdAt: string
  submittedAt?: string
  signedBy?: string
  signedAt?: string
}

export type DailyReportInput = Omit<DailyReport, 'id' | 'projectId' | 'status' | 'createdAt' | 'submittedAt' | 'signedBy' | 'signedAt'>

export interface SitePhoto {
  id: string
  projectId: string
  dailyReportId: string
  workPackageId?: string
  fileName: string
  mimeType: string
  sizeBytes: number
  caption: string
  location: string
  takenAt: string
  createdAt: string
}

export interface SitePhotoInput {
  workPackageId?: string
  caption: string
  location: string
  takenAt: string
}

export type DocumentCategory = 'Bestek' | 'Meetstaat' | 'Plan' | 'Technische fiche' | 'Vergunning' | 'Veiligheid' | 'Contract' | 'Verslag' | 'As-built' | 'Oplevering' | 'Overig'

export interface DocumentVersion {
  id: string
  documentId: string
  revision: number
  revisionLabel: string
  fileName: string
  mimeType: string
  sizeBytes: number
  contentDigest?: string
  notes: string
  uploadedBy: string
  createdAt: string
  supersededAt?: string
}

export interface DocumentIntegrityResult {
  versionId: string
  algorithm: 'SHA-256'
  expectedDigest?: string
  actualDigest: string
  status: 'Geldig' | 'Gewijzigd' | 'Niet beschikbaar'
  verifiedAt: string
}

export interface DocumentRecipient {
  id: string
  documentId: string
  versionId: string
  name: string
  email: string
  deliveredAt: string
  readAt?: string
}

export type DocumentLinkType = 'Relatie' | 'Opportuniteit' | 'Calculatie' | 'Offerte' | 'Contract' | 'Werkpakket' | 'Meetstaatpost' | 'Dagrapport' | 'Meerwerk' | 'Claim' | 'Inkoop' | 'Onderaannemer' | 'Opleverpunt' | 'QHSE'

export interface DocumentRecordLink {
  id: string
  documentId: string
  type: DocumentLinkType
  recordId: string
  label: string
  createdBy: string
  createdAt: string
}

export type DocumentRecordLinkInput = Pick<DocumentRecordLink, 'type' | 'recordId' | 'label' | 'createdBy'>

export interface ProjectDocument {
  id: string
  projectId: string
  legalEntityId?: string
  salesInvoiceId?: string
  peppolAcceptanceRunId?: string
  title: string
  category: DocumentCategory
  status: 'Concept' | 'Ter goedkeuring' | 'Goedgekeurd'
  immutable?: boolean
  currentVersionId: string
  versions: DocumentVersion[]
  recipients: DocumentRecipient[]
  links?: DocumentRecordLink[]
  approvedBy?: string
  approvedAt?: string
  createdAt: string
}

export interface DocumentUploadInput {
  title: string
  category: DocumentCategory
  notes: string
  uploadedBy: string
}

export interface DocumentMetadataInput {
  title: string
  category: DocumentCategory
}

export interface DocumentRevisionInput {
  notes: string
  uploadedBy: string
}

export interface DocumentDistributionInput {
  recipients: Array<{ name: string; email: string }>
}

export type QhseHolderType = 'Medewerker' | 'Materieel' | 'Onderaannemer'

export interface QhseCertificate {
  id: string
  projectId: string
  holderType: QhseHolderType
  holderId?: string
  holderName: string
  certificateType: string
  certificateNumber: string
  issuedOn?: string
  expiresOn: string
  documentId?: string
  createdAt: string
}

export type QhseCertificateInput = Omit<QhseCertificate, 'id' | 'projectId' | 'createdAt'>

export interface QhseFinding {
  id: string
  description: string
  severity: 'Laag' | 'Middel' | 'Hoog'
  responsible: string
  dueDate: string
  resolvedAt?: string
}

export type QhseInspectionType = 'Toolboxmeeting' | 'LMRA' | 'Veiligheidsinspectie' | 'Werkvergunning' | 'Materieelinspectie'

export interface QhseInspection {
  id: string
  projectId: string
  inspectionDate: string
  type: QhseInspectionType
  inspector: string
  location: string
  notes: string
  findings: QhseFinding[]
  status: 'Open' | 'Gesloten'
  createdAt: string
  closedAt?: string
}

export type QhseInspectionInput = Pick<QhseInspection, 'inspectionDate' | 'type' | 'inspector' | 'location' | 'notes' | 'findings'>

export interface QhseAlert {
  id: string
  projectId: string
  sourceType: 'certificate' | 'finding'
  sourceId: string
  severity: 'Waarschuwing' | 'Kritiek'
  title: string
  detail: string
  dueDate: string
}

export type AssetCategory = 'Machine' | 'Vrachtwagen' | 'Bestelwagen' | 'Gereedschap' | 'Container' | 'Keetwagen' | 'Meetapparatuur'
export type AssetStatus = 'Beschikbaar' | 'Ingezet' | 'Onderhoud' | 'Defect' | 'Buiten dienst'

export interface Asset {
  id: string
  code: string
  name: string
  category: AssetCategory
  status: AssetStatus
  location: string
  hourlyRate: number
  projectId?: string
  inspectionExpiresOn?: string
  maintenanceDueOn?: string
  insurer?: string
  insurancePolicyNumber?: string
  insuranceExpiresOn?: string
  mileage: number
  operatingHours: number
  maintenanceOrders?: AssetMaintenanceOrder[]
  damageReports?: AssetDamageReport[]
  fuelEntries?: AssetFuelEntry[]
  reservations?: AssetReservation[]
}

export interface AssetMaintenanceOrder { id:string; title:string; scheduledOn:string; completedOn?:string; supplier:string; cost:number; status:'Gepland'|'In uitvoering'|'Voltooid'; notes:string }
export interface AssetDamageReport { id:string; reportedOn:string; description:string; reportedBy:string; insurerReference?:string; estimatedCost:number; status:'Open'|'In behandeling'|'Hersteld' }
export interface AssetFuelEntry { id:string; date:string; quantity:number; unitPrice:number; mileage?:number; operatingHours?:number; provider:string }
export interface AssetReservation { id:string; projectId:string; startDate:string; endDate:string; requestedBy:string; status:'Gepland'|'Bevestigd'|'Geannuleerd' }
export type AssetOperationalInput =
  | { kind:'maintenance'; value:Omit<AssetMaintenanceOrder,'id'> }
  | { kind:'damage'; value:Omit<AssetDamageReport,'id'> }
  | { kind:'fuel'; value:Omit<AssetFuelEntry,'id'> }
  | { kind:'reservation'; value:Omit<AssetReservation,'id'> }

export type AssetInput = Omit<Asset, 'id'>

export interface Warehouse {
  id: string
  name: string
  location: string
}

export type WarehouseInput = Omit<Warehouse, 'id'>

export interface InventoryStock {
  warehouseId: string
  quantity: number
  reserved: number
}

export interface InventoryItem {
  id: string
  sku: string
  name: string
  unit: string
  minimumStock: number
  maximumStock: number
  defaultPurchasePrice?: number
  stocks: InventoryStock[]
  lotTracking?: boolean
  serialTracking?: boolean
  lots?: InventoryLot[]
  counts?: InventoryCount[]
}

export type InventoryItemInput = Omit<InventoryItem, 'id' | 'stocks' | 'lots' | 'counts'>

export type StockMovementType = 'Ontvangst' | 'Uitgifte' | 'Retour' | 'Correctie' | 'Reservatie' | 'Vrijgave'

export interface StockMovement {
  id: string
  inventoryItemId: string
  warehouseId: string
  projectId?: string
  type: StockMovementType
  quantity: number
  reference: string
  performedBy: string
  lotNumber?: string
  serialNumbers?: string[]
  scanCode?: string
  createdAt: string
}

export type StockMovementInput = Omit<StockMovement, 'id' | 'createdAt'>

export interface InventoryLot { lotNumber:string;warehouseId:string;quantity:number;expiresOn?:string }
export interface InventoryCount { id:string;warehouseId:string;countedQuantity:number;bookQuantity:number;difference:number;countedBy:string;countedAt:string;notes:string }
export interface InventoryCountInput {warehouseId:string;countedQuantity:number;countedBy:string;notes:string;lotNumber?:string}

export interface SubcontractorEmployee {
  id: string
  name: string
  role: string
  certificate: string
  certificateExpiresOn?: string
}

export interface Subcontractor {
  id: string
  organizationId?: string
  name: string
  vatNumber: string
  contactName: string
  email: string
  status: 'Te beoordelen' | 'Goedgekeurd' | 'Geblokkeerd'
  insuranceExpiresOn?: string
  vcaExpiresOn?: string
  hourlyRate: number
  projectIds: string[]
  documentsComplete: boolean
  employees: SubcontractorEmployee[]
  agreements?: SubcontractAgreement[]
  progressClaims?: SubcontractProgressClaim[]
  evaluations?: SubcontractEvaluation[]
  documentIds?: string[]
  portalInvitedAt?: string
  portalLastAccessAt?: string
  createdAt: string
}

export interface SubcontractAgreement { id:string; number:string; projectId:string; title:string; contractValue:number; retentionPct:number; penaltyPerDay:number; startDate:string; endDate:string; status:'Concept'|'Actief'|'Afgesloten'; documentIds:string[] }
export interface SubcontractProgressClaim { id:string; number:string; projectId:string; periodEnd:string; grossAmount:number; retentionAmount:number; penaltyAmount:number; netAmount:number; status:'Concept'|'Ingediend'|'Goedgekeurd'|'Afgewezen'; notes:string; submittedAt?:string; approvedAt?:string; approvedBy?:string }
export interface SubcontractEvaluation { id:string; projectId:string; date:string; quality:number; safety:number; planning:number; administration:number; notes:string; evaluatedBy:string }
export type SubcontractorOperationInput =
  | {kind:'employee';value:Omit<SubcontractorEmployee,'id'>}
  | {kind:'agreement';value:Omit<SubcontractAgreement,'id'>}
  | {kind:'progress';value:Omit<SubcontractProgressClaim,'id'|'number'|'retentionAmount'|'netAmount'|'status'|'submittedAt'|'approvedAt'|'approvedBy'>}
  | {kind:'evaluation';value:Omit<SubcontractEvaluation,'id'>}
  | {kind:'documents';value:{documentIds:string[]}}

export type SubcontractorInput = Omit<Subcontractor, 'id' | 'status' | 'documentsComplete' | 'employees' | 'portalInvitedAt' | 'portalLastAccessAt' | 'createdAt'>

export type QhseEventType = 'Incident' | 'Bijna-ongeval' | 'Milieumelding' | 'LMRA' | 'Toolboxmeeting' | 'Werkvergunning' | 'PBM-uitgifte'

export interface QhseEvent {
  id: string
  projectId: string
  eventDate: string
  type: QhseEventType
  title: string
  description: string
  severity: 'Laag' | 'Middel' | 'Hoog' | 'Kritiek'
  reporter: string
  responsible: string
  dueDate?: string
  correctiveAction: string
  participants: string[]
  status: 'Open' | 'In behandeling' | 'Gesloten'
  closedAt?: string
  createdAt: string
}

export type QhseEventInput = Omit<QhseEvent, 'id' | 'status' | 'closedAt' | 'createdAt'>

export interface JointVentureMember {
  legalEntityId: string
  sharePct: number
  lead: boolean
}

export interface JointVenture {
  id: string
  name: string
  type: 'THV' | 'Combinatie' | 'Gezamenlijk project'
  projectId?: string
  country: string
  currency: string
  vatRule: string
  members: JointVentureMember[]
  status: 'Concept' | 'Actief' | 'Afgesloten'
  createdAt: string
}

export type JointVentureInput = Omit<JointVenture, 'id' | 'status' | 'createdAt'>

export type IntegrationProvider = 'Exact Online' | 'Business Central' | 'Dynamics 365' | 'Odoo' | 'SAP' | 'Generieke REST' | 'CSV/SFTP'

export interface IntegrationConnection {
  id: string
  name: string
  provider: IntegrationProvider
  legalEntityId: string
  endpoint: string
  status: 'Concept' | 'Actief' | 'Fout'
  lastTestAt?: string
  lastError?: string
  createdAt: string
}

export type IntegrationConnectionInput = Pick<IntegrationConnection, 'name' | 'provider' | 'legalEntityId' | 'endpoint'>

export interface IntegrationJob {
  id: string
  connectionId: string
  entityType: 'Verkoopfactuur' | 'Leveranciersfactuur' | 'Klant' | 'Project' | 'Uren'
  entityId: string
  direction: 'Export' | 'Import'
  status: 'In wachtrij' | 'Bezig' | 'Geslaagd' | 'Mislukt'
  attempts: number
  payloadDigest: string
  nextAttemptAt: string
  error?: string
  createdAt: string
  completedAt?: string
}

export interface IntegrationJobInput {
  connectionId: string
  entityType: IntegrationJob['entityType']
  entityId: string
  direction: IntegrationJob['direction']
}

export interface AiSourceReference {
  documentId?: string
  title: string
  excerpt: string
}

export interface AiAnalysis {
  id: string
  projectId: string
  type: 'Besteksamenvatting' | 'Contractrisico' | 'Ontbrekende documenten' | 'Projectvraag' | 'Claimbrief'
  question: string
  answer: string
  sources: AiSourceReference[]
  status: 'Concept' | 'Goedgekeurd'
  createdBy: string
  createdAt: string
  approvedBy?: string
  approvedAt?: string
}

export interface AiAnalysisInput {
  type: AiAnalysis['type']
  question: string
  createdBy: string
}

export interface ContractObligation {
  id: string
  title: string
  dueDate: string
  owner: string
  sourceDocumentId?: string
  status: 'Open' | 'Voltooid' | 'Te laat'
  completedAt?: string
}

export interface ContractRisk {
  id: string
  description: string
  impact: 'Laag' | 'Middel' | 'Hoog'
  mitigation: string
  owner: string
  status: 'Open' | 'Beheerst' | 'Gesloten'
}

export interface ContractSecurity {
  id: string
  type: 'Borgstelling' | 'Bankgarantie' | 'Verzekering'
  reference: string
  issuer: string
  amount: number
  expiresOn?: string
  status: 'Actief' | 'Vrijgave aangevraagd' | 'Vrijgegeven' | 'Vervallen'
}

export interface ContractCorrespondence {
  id: string
  date: string
  type: 'Brief' | 'E-mail' | 'Verslag' | 'Ingebrekestelling' | 'Termijnmelding'
  subject: string
  sender: string
  recipient: string
  documentId?: string
}

export interface ContractClaim {
  id: string
  number: string
  title: string
  amount: number
  scheduleImpactDays: number
  status: 'Concept' | 'Ingediend' | 'In behandeling' | 'Aanvaard' | 'Afgewezen'
  submittedAt?: string
}

export interface ContractVersion {
  id: string
  version: number
  changeSummary: string
  createdBy: string
  createdAt: string
}

export interface ProjectContract {
  id: string
  projectId: string
  title: string
  signedOn: string
  executionStart: string
  executionEnd: string
  paymentTerms: string
  retentionPct: number
  penaltyPerDay: number
  priceRevision: string
  contractNumber?: string
  contractType?: 'Openbare opdracht' | 'Private aanneming' | 'Onderaanneming' | 'THV'
  clientOrganizationId?: string
  contractValue?: number
  currency?: string
  documentIds?: string[]
  securities?: ContractSecurity[]
  correspondence?: ContractCorrespondence[]
  claims?: ContractClaim[]
  versions?: ContractVersion[]
  approvalStatus: 'Concept' | 'Ter goedkeuring' | 'Goedgekeurd'
  submittedBy?: string
  submittedAt?: string
  approvedBy?: string
  approvedAt?: string
  status: 'Concept' | 'Actief' | 'Afgesloten'
  obligations: ContractObligation[]
  risks: ContractRisk[]
  createdAt: string
}

export type ProjectContractInput = Omit<ProjectContract, 'id' | 'projectId' | 'status' | 'versions' | 'approvalStatus' | 'submittedBy' | 'submittedAt' | 'approvedBy' | 'approvedAt' | 'createdAt'>
export type ProjectContractUpdateInput = Partial<Pick<ProjectContract, 'title' | 'signedOn' | 'executionStart' | 'executionEnd' | 'paymentTerms' | 'retentionPct' | 'penaltyPerDay' | 'priceRevision' | 'contractNumber' | 'contractType' | 'clientOrganizationId' | 'contractValue' | 'currency' | 'documentIds' | 'securities' | 'correspondence' | 'claims' | 'status'>>

export interface CloseoutItem {
  id: string
  description: string
  responsible: string
  dueDate: string
  status: 'Open' | 'In behandeling' | 'Opgelost'
  location?: string
  workPackageId?: string
  photoIds?: string[]
  resolvedAt?: string
}

export interface ServiceRequest {
  id: string
  title: string
  description: string
  reportedAt: string
  status: 'Nieuw' | 'In behandeling' | 'Opgelost'
  resolvedAt?: string
}

export type ServiceRequestInput = Pick<ServiceRequest, 'title' | 'description' | 'reportedAt'>

export interface ProjectCloseout {
  id: string
  projectId: string
  status: 'Voorbereiding' | 'Voorlopig opgeleverd' | 'Definitief opgeleverd' | 'Nazorg'
  provisionalAcceptanceOn?: string
  definitiveAcceptanceOn?: string
  guaranteeUntil?: string
  bondReleaseStatus: 'Niet aangevraagd' | 'Aangevraagd' | 'Vrijgegeven'
  asBuiltComplete: boolean
  maintenanceFileComplete: boolean
  acceptanceDocumentIds?: string[]
  asBuiltDocumentIds?: string[]
  maintenanceDocumentIds?: string[]
  guaranteeDocumentIds?: string[]
  bondAmount?: number
  bondReleasedAmount?: number
  customerSignedBy?: string
  customerSignedAt?: string
  items: CloseoutItem[]
  serviceRequests: ServiceRequest[]
  createdAt: string
}

export type ProjectCloseoutInput = Omit<ProjectCloseout, 'id' | 'projectId' | 'items' | 'serviceRequests' | 'createdAt'>
export type ProjectCloseoutUpdateInput = Pick<ProjectCloseout, 'status' | 'provisionalAcceptanceOn' | 'definitiveAcceptanceOn' | 'guaranteeUntil' | 'bondReleaseStatus' | 'asBuiltComplete' | 'maintenanceFileComplete' | 'acceptanceDocumentIds' | 'asBuiltDocumentIds' | 'maintenanceDocumentIds' | 'guaranteeDocumentIds' | 'bondAmount' | 'bondReleasedAmount' | 'customerSignedBy' | 'customerSignedAt'>

export interface ChangeOrderCosts {
  labor: number
  material: number
  equipment: number
  transport: number
  subcontracting: number
  other: number
}

export type ChangeOrderStatus = 'Vastgesteld' | 'Berekend' | 'Ter goedkeuring' | 'Goedgekeurd' | 'Uitgevoerd' | 'Klaar voor facturatie' | 'Opgenomen in vorderingsstaat'

export interface ChangeOrder {
  id: string
  number: string
  projectId: string
  dailyReportId?: string
  workPackageId?: string
  date: string
  cause: string
  description: string
  initiator: string
  responsibleParty: string
  scheduleImpactDays: number
  costs: ChangeOrderCosts
  total: number
  photoIds: string[]
  status: ChangeOrderStatus
  createdAt: string
  calculatedAt?: string
  submittedAt?: string
  approvedBy?: string
  approvedAt?: string
  executedAt?: string
  readyForInvoiceAt?: string
  progressStatementId?: string
}

export type ChangeOrderInput = Pick<ChangeOrder, 'dailyReportId' | 'workPackageId' | 'date' | 'cause' | 'description' | 'initiator' | 'responsibleParty' | 'scheduleImpactDays' | 'costs' | 'photoIds'>

export interface ProgressStatementLineInput {
  workPackageId: string
  cumulativeProgressPct: number
}

export interface ProgressStatementLine extends ProgressStatementLineInput {
  workPackageCode: string
  workPackageName: string
  contractValue: number
  previousCumulative: number
  currentPeriod: number
  cumulativeValue: number
}

export interface ProgressStatementInput {
  periodStart: string
  periodEnd: string
  lines: ProgressStatementLineInput[]
  changeOrderIds: string[]
  priceRevisionAmount: number
  retentionPct: number
  notes: string
}

export interface ProgressStatement {
  id: string
  number: string
  projectId: string
  periodStart: string
  periodEnd: string
  lines: ProgressStatementLine[]
  changeOrderIds: string[]
  workAmount: number
  changeOrderAmount: number
  priceRevisionAmount: number
  grossAmount: number
  retentionPct: number
  retentionAmount: number
  netAmount: number
  status: 'Concept' | 'Ingediend' | 'Goedgekeurd' | 'Factuurconcept'
  notes: string
  createdAt: string
  submittedAt?: string
  approvedBy?: string
  approvedAt?: string
  invoiceId?: string
}

export interface SalesInvoiceInput {
  invoiceDate: string
  dueDate?: string
  vatPct?: number
}

export interface SalesInvoice {
  id: string
  number: string
  legalEntityId?: string
  projectId: string
  progressStatementId: string
  invoiceDate: string
  dueDate: string
  subtotal: number
  vatPct: number
  vatAmount: number
  total: number
  status: 'Concept' | 'Openstaand' | 'Betaald'
  issuedAt?: string
  issuedBy?: string
  paidAt?: string
  paidAmount?: number
  paymentReference?: string
  createdAt: string
}

export interface IntercompanyChargeInput {
  fromLegalEntityId: string
  toLegalEntityId: string
  projectId?: string
  description: string
  baseAmount: number
  markupPct: number
}

export interface IntercompanyCharge extends IntercompanyChargeInput {
  id: string
  number: string
  totalAmount: number
  status: 'Concept' | 'Goedgekeurd' | 'Geboekt'
  createdAt: string
  approvedAt?: string
  postedAt?: string
}

export interface SalesInvoiceIssueInput {
  issuedBy: string
}

export interface PeppolValidationIssue {
  code: string
  severity: 'Fout' | 'Waarschuwing'
  message: string
  path?: string
}

export interface PeppolValidationReport {
  id: string
  invoiceId: string
  documentDigest: string
  status: 'Geslaagd' | 'Afgekeurd' | 'Fout'
  source: 'Preflight' | 'Extern'
  engine: string
  profile: string
  networkReady: boolean
  issues: PeppolValidationIssue[]
  validatedAt: string
}

export type PeppolValidationReportInput = Omit<PeppolValidationReport, 'id' | 'invoiceId' | 'documentDigest' | 'validatedAt'>

export type PeppolDeliveryStatus = 'In wachtrij' | 'Geaccepteerd' | 'Afgeleverd' | 'Geweigerd' | 'Fout'

export interface PeppolDeliveryEvent {
  status: PeppolDeliveryStatus
  message: string
  at: string
  providerEventId?: string
}

export interface PeppolDelivery {
  id: string
  invoiceId: string
  validationReportId: string
  status: PeppolDeliveryStatus
  provider: string
  providerReference?: string
  idempotencyKey: string
  attempts: number
  message: string
  events: PeppolDeliveryEvent[]
  requestedAt: string
  updatedAt: string
  deliveredAt?: string
}

export type PeppolAcceptanceStatus = 'In uitvoering' | 'In opvolging' | 'Geslaagd' | 'Mislukt'
export type PeppolAcceptanceStepStatus = 'Geslaagd' | 'In afwachting' | 'Mislukt'

export interface PeppolAcceptanceStep {
  id: 'configuration' | 'validation' | 'submission' | 'delivery'
  label: string
  status: PeppolAcceptanceStepStatus
  message: string
  at: string
  reference?: string
}

export interface PeppolAcceptanceRun {
  id: string
  invoiceId: string
  status: PeppolAcceptanceStatus
  documentDigest: string
  validationReportId?: string
  deliveryId?: string
  steps: PeppolAcceptanceStep[]
  startedBy: string
  startedAt: string
  completedAt?: string
  releasedBy?: string
  releasedAt?: string
  releaseNotes?: string
}

export interface PeppolAcceptanceReleaseInput {
  releasedBy: string
  notes: string
}

export interface PeppolAcceptanceResult {
  run: PeppolAcceptanceRun
  validationReport?: PeppolValidationReport
  delivery?: PeppolDelivery
}

export type PeppolAlertType = 'Verzending mislukt' | 'Geweigerd' | 'Geen statusupdate'
export type PeppolAlertStatus = 'Open' | 'In behandeling' | 'Opgelost'

export interface PeppolAlert {
  id: string
  deliveryId: string
  invoiceId: string
  type: PeppolAlertType
  severity: 'Hoog' | 'Kritiek'
  status: PeppolAlertStatus
  message: string
  acknowledgedBy?: string
  acknowledgedAt?: string
  resolvedAt?: string
  createdAt: string
  updatedAt: string
}

export type PeppolNotificationChannel = 'E-mail' | 'Teams'
export type PeppolNotificationKind = 'Nieuwe waarschuwing' | 'SLA-escalatie' | 'Testmelding'
export type PeppolNotificationStatus = 'In wachtrij' | 'Verzonden' | 'Mislukt' | 'Geannuleerd'

export interface PeppolIntegrationCheck {
  id: 'validator' | 'access-point' | 'webhook' | 'status-monitor' | 'notification-connector' | 'notification-dispatcher'
  label: string
  ready: boolean
  detail: string
}

export interface PeppolNotification {
  id: string
  alertId: string
  channel: PeppolNotificationChannel
  kind: PeppolNotificationKind
  destination: string
  subject: string
  message: string
  status: PeppolNotificationStatus
  attempts: number
  nextAttemptAt: string
  lastError?: string
  sentAt?: string
  createdAt: string
  updatedAt: string
}

export interface PeppolNotificationSettings {
  emailRecipients: string[]
  teamsTargets: string[]
  criticalSlaMinutes: number
  connectorConfigured: boolean
  connectorProvider: string
  connectorChannels: PeppolNotificationChannel[]
  integrationChecks: PeppolIntegrationCheck[]
  productionGate: PeppolProductionGate
  updatedAt?: string
}

export interface PeppolProductionGate {
  released: boolean
  runId?: string
  releasedAt?: string
  releasedBy?: string
}

export type PeppolNotificationSettingsInput = Omit<PeppolNotificationSettings, 'connectorConfigured' | 'connectorProvider' | 'connectorChannels' | 'integrationChecks' | 'productionGate' | 'updatedAt'>

export interface PeppolNotificationTestInput {
  channel: PeppolNotificationChannel
  destination: string
}

export interface PeppolNotificationTestResult extends PeppolNotificationTestInput {
  id: string
  status: 'Verzonden'
  sentAt: string
}

export type PeppolOperationStatus = PeppolDeliveryStatus | 'Niet gestart'

export interface PeppolOperation {
  invoiceId: string
  status: PeppolOperationStatus
  delivery?: PeppolDelivery
  stale: boolean
  needsAttention: boolean
}

export function peppolOperations(invoices: SalesInvoice[], deliveries: PeppolDelivery[], now = new Date().toISOString(), staleAfterMinutes = 30): PeppolOperation[] {
  const nowMs = new Date(now).getTime()
  const staleAfterMs = staleAfterMinutes * 60_000
  return invoices
    .filter(invoice => invoice.status !== 'Concept')
    .map(invoice => {
      const delivery = deliveries.filter(item => item.invoiceId === invoice.id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
      const status: PeppolOperationStatus = delivery?.status ?? 'Niet gestart'
      const active = status === 'In wachtrij' || status === 'Geaccepteerd'
      const stale = Boolean(active && delivery && nowMs - new Date(delivery.updatedAt).getTime() > staleAfterMs)
      return { invoiceId: invoice.id, status, delivery, stale, needsAttention: stale || status === 'Fout' || status === 'Geweigerd' }
    })
    .sort((a, b) => Number(b.needsAttention) - Number(a.needsAttention) || (b.delivery?.updatedAt ?? '').localeCompare(a.delivery?.updatedAt ?? ''))
}

export interface PaymentRegistrationInput {
  paymentDate: string
  amount: number
  reference: string
}

export type ProjectCostCategory = 'labor' | 'material' | 'equipment' | 'transport' | 'subcontracting' | 'other'

export interface ProjectCostInput {
  workPackageId?: string
  date: string
  type: 'Verplichting' | 'Werkelijke kost'
  category: ProjectCostCategory
  description: string
  supplier: string
  amount: number
  reference: string
  recognition?: 'Boeking' | 'Overlopende kost' | 'Onderhanden werk'
  sourceDocumentId?: string
}

export interface ProjectCost extends ProjectCostInput {
  id: string
  projectId: string
  status: 'Open' | 'Geboekt' | 'Omgezet'
  sourceCommitmentId?: string
  settledByEntryId?: string
  createdAt: string
}

export interface CommitmentSettlementInput {
  date: string
  amount: number
  description: string
  reference: string
}

export interface ProjectForecastLineInput {
  workPackageId: string
  remainingCost: number
}

export interface ProjectForecastLine extends ProjectForecastLineInput {
  workPackageCode: string
  workPackageName: string
  openCommitments: number
}

export interface ProjectForecastInput {
  lines: ProjectForecastLineInput[]
  notes: string
}

export interface ProjectForecast {
  id: string
  projectId: string
  version: number
  lines: ProjectForecastLine[]
  actualCosts: number
  openCommitments: number
  remainingCost: number
  estimateAtCompletion: number
  expectedRevenue: number
  expectedMargin: number
  expectedMarginPct: number
  notes: string
  status: 'Concept' | 'Ter goedkeuring' | 'Goedgekeurd' | 'Vervallen'
  createdBy: string
  approvedBy?: string
  approvedAt?: string
  createdAt: string
}

export interface SupplierInput {
  organizationId?: string
  name: string
  vatNumber: string
  contactName: string
  email: string
  paymentTerms: string
}

export interface Supplier extends SupplierInput {
  id: string
  rating: number
  frameworkAgreements?: SupplierFrameworkAgreement[]
  createdAt: string
}

export interface SupplierFrameworkAgreementInput {
  number: string
  title: string
  category: ProjectCostCategory
  startsOn: string
  endsOn: string
  ceilingAmount: number
  documentIds: string[]
}

export interface SupplierFrameworkAgreement extends SupplierFrameworkAgreementInput {
  id: string
  committedAmount: number
  status: 'Concept' | 'Actief' | 'Vervallen' | 'Opgebruikt'
  createdAt: string
}

export interface ProcurementItem {
  id: string
  description: string
  quantity: number
  unit: string
  targetUnitPrice: number
}

export interface ProcurementRequestInput {
  workPackageId?: string
  invitedSupplierIds: string[]
  category: ProjectCostCategory
  requestedBy: string
  neededBy: string
  description: string
  items: ProcurementItem[]
}

export interface SupplierQuoteInput {
  supplierId: string
  amount: number
  leadTimeDays: number
  validityDate: string
  notes: string
}

export interface SupplierQuote extends SupplierQuoteInput {
  id: string
  createdAt: string
}

export interface ProcurementRequest extends ProcurementRequestInput {
  id: string
  number: string
  projectId: string
  status: 'Behoefte' | 'Prijsaanvraag' | 'Vergelijken' | 'Besteld' | 'Afgesloten'
  quotes: SupplierQuote[]
  selectedQuoteId?: string
  purchaseOrderId?: string
  approval?: ProcurementApproval
  createdAt: string
}

export interface ProcurementApproval {status:'Te beoordelen'|'Goedgekeurd'|'Afgewezen';requiredRole:'Projectmanager'|'Projectdirecteur'|'Directie';amount:number;approvedBy?:string;approvedAt?:string;reason?:string}

export interface PurchaseOrder {
  id: string
  number: string
  procurementRequestId: string
  projectId: string
  supplierId: string
  frameworkAgreementId?: string
  orderDate: string
  expectedDeliveryDate: string
  amount: number
  status: 'Besteld' | 'Gedeeltelijk ontvangen' | 'Ontvangen' | 'Afwijking' | 'Factuur gecontroleerd' | 'Betaald'
  commitmentCostId: string
  lines?: PurchaseOrderLine[]
  receipts?: PurchaseReceipt[]
  matchResult?: PurchaseMatchResult
  receivedAt?: string
  deliveryReference?: string
  receivedBy?: string
  receiptNotes?: string
  invoiceNumber?: string
  invoiceDate?: string
  invoiceDueDate?: string
  invoiceAmount?: number
  actualCostId?: string
  paidAt?: string
  paidAmount?: number
  paymentReference?: string
  createdAt: string
}

export interface PurchaseReceiptInput {
  receivedAt: string
  deliveryReference: string
  receivedBy: string
  notes: string
  lines?: { procurementItemId: string; quantity: number }[]
}

export interface PurchaseInvoiceMatchInput {
  invoiceNumber: string
  invoiceDate: string
  dueDate: string
  amount: number
  lines?: { procurementItemId: string; quantity: number; unitPrice: number }[]
}

export interface PurchaseOrderLine {
  procurementItemId: string
  description: string
  unit: string
  orderedQuantity: number
  receivedQuantity: number
  invoicedQuantity: number
  unitPrice: number
}

export interface PurchaseReceipt {
  id: string
  receivedAt: string
  deliveryReference: string
  receivedBy: string
  notes: string
  lines: { procurementItemId: string; quantity: number }[]
}

export interface PurchaseMatchResult {
  matched: boolean
  amountDifference: number
  deviations: string[]
  invoiceLines: { procurementItemId: string; quantity: number; unitPrice: number }[]
  checkedBy: string
  checkedAt: string
  approvedBy?: string
  approvedAt?: string
  approvalReason?: string
}

export interface PurchaseInvoiceMatchResult {
  order: PurchaseOrder
  request: ProcurementRequest
  commitment: ProjectCost
  actualCost?: ProjectCost
}

export interface WorkTicketLine {
  id: string
  category: 'Arbeid' | 'Materiaal' | 'Materieel' | 'Transport' | 'Wachttijd' | 'Herstelling'
  description: string
  quantity: number
  unit: string
  unitPrice: number
}

export interface WorkTicket {
  id: string
  number: string
  projectId: string
  subcontractorId?: string
  dailyReportId?: string
  type: 'Regiewerk' | 'Meerwerk' | 'Machine-uren' | 'Wachttijd' | 'Herstelling'
  date: string
  description: string
  lines: WorkTicketLine[]
  total: number
  latitude?: number
  longitude?: number
  status: 'Concept' | 'Ter ondertekening' | 'Ondertekend' | 'Gefactureerd'
  createdBy: string
  createdAt: string
  submittedAt?: string
  signedBy?: string
  signedAt?: string
}

export type WorkTicketInput = Pick<WorkTicket, 'projectId' | 'subcontractorId' | 'dailyReportId' | 'type' | 'date' | 'description' | 'lines' | 'latitude' | 'longitude' | 'createdBy'>

export interface TimeEntry {
  id: string
  employeeId: string
  projectId: string
  workPackageId?: string
  date: string
  startTime: string
  endTime: string
  breakMinutes: number
  regularHours: number
  overtimeHours: number
  travelHours: number
  nightHours: number
  weekendHours: number
  source: 'Mobiel' | 'QR' | 'Badge' | 'GPS' | 'Manueel' | 'Import'
  latitude?: number
  longitude?: number
  status: 'Concept' | 'Ingediend' | 'Goedgekeurd' | 'Gecorrigeerd' | 'Geweigerd'
  correctionReason?: string
  createdAt: string
  approvedBy?: string
  approvedAt?: string
}

export type TimeEntryInput = Omit<TimeEntry, 'id' | 'status' | 'createdAt' | 'approvedBy' | 'approvedAt'>

export interface ProjectClaim {
  id: string
  number: string
  /** Presentation alias retained for imported legacy contract claims. */
  title?: string
  projectId: string
  changeOrderId?: string
  type: 'Financiële claim' | 'Termijnverlenging' | 'Schadeclaim' | 'Contractmelding'
  cause: string
  description: string
  amount: number
  extensionDays: number
  responsibleParty: string
  documentIds: string[]
  status: 'Concept' | 'Intern goedgekeurd' | 'Ingediend' | 'In behandeling' | 'Aanvaard' | 'Afgewezen'
  createdBy: string
  createdAt: string
  submittedAt?: string
  decidedAt?: string
  decisionNotes?: string
}

export type ProjectClaimInput = Pick<ProjectClaim, 'projectId' | 'changeOrderId' | 'type' | 'cause' | 'description' | 'amount' | 'extensionDays' | 'responsibleParty' | 'documentIds' | 'createdBy'>

export type CashFlowEntryStatus = 'Te verzenden' | 'Verwacht' | 'Openstaand' | 'Achterstallig' | 'Betaald'

export interface CashFlowEntry {
  id: string
  sourceType: 'sales_invoice' | 'purchase_order'
  sourceId: string
  projectId: string
  projectNumber: string
  projectName: string
  direction: 'In' | 'Uit'
  date: string
  number: string
  counterparty: string
  description: string
  amount: number
  status: CashFlowEntryStatus
}

export interface CashFlowPeriod {
  month: string
  incoming: number
  outgoing: number
  net: number
}

export interface PostCalculationCategoryLine {
  category: ProjectCostCategory
  planned: number
  actual: number
  variance: number
  variancePct: number
}

export interface PostCalculationWorkPackageLine {
  workPackageId?: string
  code: string
  name: string
  planned: number
  actual: number
  variance: number
  variancePct: number
}

export interface PostCalculationItemInsight {
  boqItemId: string
  workPackageId: string
  code: string
  description: string
  category: CostCategory
  unit: string
  quantity: number
  plannedUnitCost: number
  actualUnitCost: number
  variancePct: number
  allocatedActualCost: number
}

export interface PostCalculationAnalysis {
  projectId: string
  planned: number
  actual: number
  variance: number
  variancePct: number
  completionPct: number
  categories: PostCalculationCategoryLine[]
  workPackages: PostCalculationWorkPackageLine[]
  itemInsights: PostCalculationItemInsight[]
  dimensions: PostCalculationDimensionLine[]
}

export interface PostCalculationDimensionLine {
  dimension: 'Ploeg' | 'Medewerker' | 'Machine' | 'Leverancier' | 'Onderaannemer'
  id: string
  name: string
  quantity: number
  unit: 'uur' | 'eenheid' | 'EUR'
  actualCost?: number
}

export interface PostCalculationFeedbackInput {
  boqItemId: string
  category: CostCategory
}

export interface BouwFlowState {
  currentUserId: string
  companyUsers: CompanyUser[]
  workflowDefinitions: WorkflowDefinition[]
  workflowCorrections: WorkflowCorrection[]
  legalEntities: LegalEntity[]
  companyBranches: CompanyBranch[]
  organizations: Organization[]
  opportunities: Opportunity[]
  calculations: Calculation[]
  calculationVersions: CalculationVersion[]
  calculationScenarios: CalculationScenario[]
  costLibraries: CostLibrary[]
  costLibraryVersions: CostLibraryVersion[]
  costLibrary: CostLibraryItem[]
  units: UnitDefinition[]
  unitConversions: UnitConversion[]
  quotes: Quote[]
  projects: Project[]
  dailyReports: DailyReport[]
  sitePhotos: SitePhoto[]
  changeOrders: ChangeOrder[]
  progressStatements: ProgressStatement[]
  salesInvoices: SalesInvoice[]
  peppolValidationReports: PeppolValidationReport[]
  peppolDeliveries: PeppolDelivery[]
  peppolAcceptanceRuns: PeppolAcceptanceRun[]
  peppolAlerts: PeppolAlert[]
  peppolNotifications: PeppolNotification[]
  peppolNotificationSettings: PeppolNotificationSettings
  intercompanyCharges: IntercompanyCharge[]
  projectCosts: ProjectCost[]
  projectForecasts: ProjectForecast[]
  suppliers: Supplier[]
  procurementRequests: ProcurementRequest[]
  purchaseOrders: PurchaseOrder[]
  documents: ProjectDocument[]
  qhseCertificates: QhseCertificate[]
  qhseInspections: QhseInspection[]
  assets: Asset[]
  warehouses: Warehouse[]
  inventoryItems: InventoryItem[]
  stockMovements: StockMovement[]
  subcontractors: Subcontractor[]
  qhseEvents: QhseEvent[]
  jointVentures: JointVenture[]
  integrationConnections: IntegrationConnection[]
  integrationJobs: IntegrationJob[]
  aiAnalyses: AiAnalysis[]
  projectContracts: ProjectContract[]
  projectCloseouts: ProjectCloseout[]
  employees: Employee[]
  employeeAbsences: EmployeeAbsence[]
  employeeCrews: EmployeeCrew[]
  workTickets: WorkTicket[]
  timeEntries: TimeEntry[]
  projectClaims: ProjectClaim[]
}

export const qhseCertificateStatus = (certificate: QhseCertificate, today = new Date().toISOString().slice(0, 10)): 'Geldig' | 'Verloopt binnenkort' | 'Vervallen' => {
  if (certificate.expiresOn < today) return 'Vervallen'
  const limit = new Date(`${today}T12:00:00Z`)
  limit.setUTCDate(limit.getUTCDate() + 30)
  return certificate.expiresOn <= limit.toISOString().slice(0, 10) ? 'Verloopt binnenkort' : 'Geldig'
}

export const qhseAlerts = (state: BouwFlowState, projectId?: string, today = new Date().toISOString().slice(0, 10)): QhseAlert[] => {
  const allowed = (id: string) => !projectId || id === projectId
  const certificates = state.qhseCertificates.filter(item => allowed(item.projectId)).flatMap(certificate => {
    const status = qhseCertificateStatus(certificate, today)
    if (status === 'Geldig') return []
    return [{ id: `certificate-${certificate.id}`, projectId: certificate.projectId, sourceType: 'certificate' as const, sourceId: certificate.id, severity: status === 'Vervallen' ? 'Kritiek' as const : 'Waarschuwing' as const, title: `${certificate.certificateType} · ${certificate.holderName}`, detail: status, dueDate: certificate.expiresOn }]
  })
  const findings = state.qhseInspections.filter(item => allowed(item.projectId)).flatMap(inspection => inspection.findings.filter(finding => !finding.resolvedAt && finding.dueDate <= today).map(finding => ({ id: `finding-${finding.id}`, projectId: inspection.projectId, sourceType: 'finding' as const, sourceId: finding.id, severity: finding.severity === 'Hoog' || finding.dueDate < today ? 'Kritiek' as const : 'Waarschuwing' as const, title: finding.description, detail: `${inspection.type} · ${finding.responsible}`, dueDate: finding.dueDate })))
  return [...certificates, ...findings].sort((a, b) => a.dueDate.localeCompare(b.dueDate))
}

const cashDate = (value: string) => value.slice(0, 10)

const expectedSupplierPaymentDate = (order: PurchaseOrder, supplier?: Supplier) => {
  const match = supplier?.paymentTerms.match(/\d+/)
  const days = match ? Number(match[0]) : 30
  const result = new Date(`${order.expectedDeliveryDate}T12:00:00Z`)
  result.setUTCDate(result.getUTCDate() + days)
  return result.toISOString().slice(0, 10)
}

export const cashFlowEntries = (state: BouwFlowState, projectId?: string, today = new Date().toISOString().slice(0, 10)): CashFlowEntry[] => {
  const projects = new Map(state.projects.map(project => [project.id, project]))
  const suppliers = new Map(state.suppliers.map(supplier => [supplier.id, supplier]))
  const projectAllowed = (id: string) => !projectId || id === projectId
  const incoming = state.salesInvoices.filter(invoice => projectAllowed(invoice.projectId)).map(invoice => {
    const project = projects.get(invoice.projectId)
    const entryDate = invoice.status === 'Betaald' && invoice.paidAt ? cashDate(invoice.paidAt) : invoice.dueDate
    const status: CashFlowEntryStatus = invoice.status === 'Concept' ? 'Te verzenden' : invoice.status === 'Betaald' ? 'Betaald' : invoice.dueDate < today ? 'Achterstallig' : 'Openstaand'
    return { id: `sales-${invoice.id}`, sourceType: 'sales_invoice' as const, sourceId: invoice.id, projectId: invoice.projectId, projectNumber: project?.number ?? 'Project', projectName: project?.name ?? 'Onbekend project', direction: 'In' as const, date: entryDate, number: invoice.number, counterparty: project?.name ?? 'Opdrachtgever', description: 'Verkoopfactuur', amount: invoice.paidAmount ?? invoice.total, status }
  })
  const outgoing = state.purchaseOrders.filter(order => projectAllowed(order.projectId)).map(order => {
    const project = projects.get(order.projectId)
    const supplier = suppliers.get(order.supplierId)
    const expectedDate = order.invoiceDueDate ?? expectedSupplierPaymentDate(order, supplier)
    const entryDate = order.status === 'Betaald' && order.paidAt ? cashDate(order.paidAt) : expectedDate
    const status: CashFlowEntryStatus = order.status === 'Betaald' ? 'Betaald' : order.status === 'Factuur gecontroleerd' ? (expectedDate < today ? 'Achterstallig' : 'Openstaand') : 'Verwacht'
    return { id: `purchase-${order.id}`, sourceType: 'purchase_order' as const, sourceId: order.id, projectId: order.projectId, projectNumber: project?.number ?? 'Project', projectName: project?.name ?? 'Onbekend project', direction: 'Uit' as const, date: entryDate, number: order.invoiceNumber ?? order.number, counterparty: supplier?.name ?? 'Onbekende leverancier', description: order.invoiceNumber ? `Leveranciersfactuur · ${order.number}` : 'Verwachte leveranciersbetaling', amount: order.paidAmount ?? order.invoiceAmount ?? order.amount, status }
  })
  return [...incoming, ...outgoing].sort((a, b) => a.date.localeCompare(b.date) || b.amount - a.amount)
}

export const cashFlowPeriods = (entries: CashFlowEntry[]): CashFlowPeriod[] => {
  const periods = new Map<string, CashFlowPeriod>()
  for (const entry of entries) {
    const month = entry.date.slice(0, 7)
    const period = periods.get(month) ?? { month, incoming: 0, outgoing: 0, net: 0 }
    if (entry.direction === 'In') period.incoming += entry.amount
    else period.outgoing += entry.amount
    period.net = period.incoming - period.outgoing
    periods.set(month, period)
  }
  return [...periods.values()].sort((a, b) => a.month.localeCompare(b.month))
}

const postCalculationCategories: ProjectCostCategory[] = ['labor', 'material', 'equipment', 'transport', 'subcontracting', 'other']
const feedbackCategories: CostCategory[] = ['labor', 'material', 'equipment', 'subcontracting']
const postRound = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

export const postCalculationAnalysis = (state: BouwFlowState, projectId: string): PostCalculationAnalysis | undefined => {
  const project = state.projects.find(item => item.id === projectId)
  const calculation = state.calculations.find(item => item.id === project?.sourceCalculationId)
  if (!project || !calculation) return undefined
  const quote = state.quotes.filter(item => item.calculationId === calculation.id).sort((a, b) => b.version - a.version)[0]
  const scenario = state.calculationScenarios.find(item => item.id === quote?.scenarioId)
  const adjustments: Record<CostCategory, number> = {
    labor: 1 + (scenario?.laborAdjustmentPct ?? 0) / 100,
    material: 1 + (scenario?.materialAdjustmentPct ?? 0) / 100,
    equipment: 1 + (scenario?.equipmentAdjustmentPct ?? 0) / 100,
    subcontracting: 1 + (scenario?.subcontractingAdjustmentPct ?? 0) / 100,
  }
  const chapters = new Map(calculation.chapters.map(chapter => [chapter.id, chapter]))
  const packageByCode = new Map(project.workPackages.map(workPackage => [workPackage.code, workPackage]))
  const itemRows = calculation.items.map(item => {
    const chapterCode = item.chapterId ? chapters.get(item.chapterId)?.code : '00'
    return { item, workPackage: packageByCode.get(chapterCode ?? '00') }
  }).filter(row => row.workPackage)
  const rawDirectCost = itemRows.reduce((total, row) => {const effective=effectiveBoqValues(row.item).values;return total + feedbackCategories.reduce((sum, category) => sum + effective.quantity * effective[category] * adjustments[category], 0)}, 0)
  const budgetScale = rawDirectCost > 0 ? project.costBudget / rawDirectCost : 1
  const actualCosts = state.projectCosts.filter(cost => cost.projectId === projectId && cost.type === 'Werkelijke kost')
  const plannedFor = (workPackageId: string | undefined, category: CostCategory) => itemRows.filter(row => row.workPackage?.id === workPackageId).reduce((sum, row) => {const effective=effectiveBoqValues(row.item).values;return sum + effective.quantity * effective[category] * adjustments[category] * budgetScale}, 0)
  const actualFor = (workPackageId: string | undefined, category?: ProjectCostCategory) => actualCosts.filter(cost => cost.workPackageId === workPackageId && (!category || cost.category === category)).reduce((sum, cost) => sum + cost.amount, 0)
  const categories = postCalculationCategories.map(category => {
    const planned = feedbackCategories.includes(category as CostCategory) ? project.workPackages.reduce((sum, workPackage) => sum + plannedFor(workPackage.id, category as CostCategory), 0) : 0
    const actual = actualCosts.filter(cost => cost.category === category).reduce((sum, cost) => sum + cost.amount, 0)
    const variance = planned - actual
    return { category, planned: postRound(planned), actual: postRound(actual), variance: postRound(variance), variancePct: planned ? variance / planned * 100 : actual ? -100 : 0 }
  })
  const workPackages: PostCalculationWorkPackageLine[] = project.workPackages.map(workPackage => {
    const planned = workPackage.budget
    const actual = actualFor(workPackage.id)
    const variance = planned - actual
    return { workPackageId: workPackage.id, code: workPackage.code, name: workPackage.name, planned: postRound(planned), actual: postRound(actual), variance: postRound(variance), variancePct: planned ? variance / planned * 100 : actual ? -100 : 0 }
  })
  const generalActual = actualFor(undefined)
  if (generalActual) workPackages.push({ code: 'ALG', name: 'Algemene projectkosten', planned: 0, actual: postRound(generalActual), variance: postRound(-generalActual), variancePct: -100 })
  const itemInsights: PostCalculationItemInsight[] = itemRows.flatMap(({ item, workPackage }) => {
    const effective = effectiveBoqValues(item).values
    const quantity = effective.quantity
    return feedbackCategories.flatMap(category => {
    const plannedUnitCost = effective[category] * adjustments[category] * budgetScale
    const plannedAmount = quantity * plannedUnitCost
    const packagePlanned = plannedFor(workPackage!.id, category)
    const packageActual = actualFor(workPackage!.id, category)
    if (plannedAmount <= 0 || packageActual <= 0 || packagePlanned <= 0) return []
    const allocatedActualCost = packageActual * plannedAmount / packagePlanned
    const actualUnitCost = quantity ? allocatedActualCost / quantity : 0
    return [{ boqItemId: item.id, workPackageId: workPackage!.id, code: item.code, description: item.description, category, unit: item.unit, quantity, plannedUnitCost: postRound(plannedUnitCost), actualUnitCost: postRound(actualUnitCost), variancePct: plannedUnitCost ? (plannedUnitCost - actualUnitCost) / plannedUnitCost * 100 : 0, allocatedActualCost: postRound(allocatedActualCost) }]
    })
  })
  const actual = actualCosts.reduce((sum, cost) => sum + cost.amount, 0)
  const variance = project.costBudget - actual
  const dimensionRows: PostCalculationDimensionLine[] = []
  const approvedTime = state.timeEntries.filter(entry => entry.projectId === projectId && ['Goedgekeurd', 'Gecorrigeerd'].includes(entry.status))
  for (const employee of state.employees) { const entries=approvedTime.filter(entry=>entry.employeeId===employee.id); const hours=entries.reduce((sum,entry)=>sum+entry.regularHours+entry.overtimeHours+entry.travelHours+entry.nightHours+entry.weekendHours,0); if(hours)dimensionRows.push({dimension:'Medewerker',id:employee.id,name:`${employee.firstName} ${employee.lastName}`,quantity:postRound(hours),unit:'uur'}) }
  for (const crew of state.employeeCrews) { const hours=approvedTime.filter(entry=>crew.memberEmployeeIds.includes(entry.employeeId)).reduce((sum,entry)=>sum+entry.regularHours+entry.overtimeHours+entry.travelHours+entry.nightHours+entry.weekendHours,0); if(hours)dimensionRows.push({dimension:'Ploeg',id:crew.id,name:crew.name,quantity:postRound(hours),unit:'uur'}) }
  const machines = new Map<string,number>(); for(const report of state.dailyReports.filter(item=>item.projectId===projectId))for(const machine of report.machines)machines.set(machine.description,(machines.get(machine.description)??0)+machine.quantity); for(const [name,quantity] of machines)dimensionRows.push({dimension:'Machine',id:name,name,quantity:postRound(quantity),unit:'eenheid'})
  const suppliers = new Map<string,number>(); for(const cost of actualCosts.filter(item=>item.supplier))suppliers.set(cost.supplier,(suppliers.get(cost.supplier)??0)+cost.amount); for(const [name,amount] of suppliers)dimensionRows.push({dimension:'Leverancier',id:name,name,quantity:postRound(amount),unit:'EUR',actualCost:postRound(amount)})
  for(const subcontractor of state.subcontractors){const amount=(subcontractor.progressClaims??[]).filter(item=>item.projectId===projectId&&item.status==='Goedgekeurd').reduce((sum,item)=>sum+item.netAmount,0);if(amount)dimensionRows.push({dimension:'Onderaannemer',id:subcontractor.id,name:subcontractor.name,quantity:postRound(amount),unit:'EUR',actualCost:postRound(amount)})}
  return { projectId, planned: project.costBudget, actual: postRound(actual), variance: postRound(variance), variancePct: project.costBudget ? variance / project.costBudget * 100 : 0, completionPct: project.progress, categories, workPackages, itemInsights, dimensions: dimensionRows }
}

export const changeOrderTotal = (costs: ChangeOrderCosts) => Object.values(costs).reduce((sum, value) => sum + value, 0)

export const projectControlMetrics = (project: Project, costs: ProjectCost[], forecasts: ProjectForecast[], changes: ChangeOrder[], invoices: SalesInvoice[]) => {
  const projectCosts = costs.filter(item => item.projectId === project.id)
  const actualCosts = projectCosts.filter(item => item.type === 'Werkelijke kost').reduce((sum, item) => sum + item.amount, 0)
  const openCommitments = projectCosts.filter(item => item.type === 'Verplichting' && item.status === 'Open').reduce((sum, item) => sum + item.amount, 0)
  const latestForecast = forecasts.filter(item => item.projectId === project.id).sort((a, b) => b.version - a.version)[0]
  const remainingCost = latestForecast?.remainingCost ?? Math.max(project.costBudget - actualCosts, openCommitments)
  const estimateAtCompletion = actualCosts + remainingCost
  const approvedChangeValue = changes.filter(item => item.projectId === project.id && ['Goedgekeurd', 'Uitgevoerd', 'Klaar voor facturatie', 'Opgenomen in vorderingsstaat'].includes(item.status)).reduce((sum, item) => sum + item.total, 0)
  const expectedRevenue = project.contractValue + approvedChangeValue
  const expectedMargin = expectedRevenue - estimateAtCompletion
  const invoicedValue = invoices.filter(item => item.projectId === project.id).reduce((sum, item) => sum + item.subtotal, 0)
  const earnedValue = project.costBudget * project.progress / 100
  const costPerformanceIndex = actualCosts ? earnedValue / actualCosts : 1
  const start = project.handover.plannedStart ? new Date(`${project.handover.plannedStart}T00:00:00Z`).getTime() : 0
  const end = project.handover.plannedEnd ? new Date(`${project.handover.plannedEnd}T00:00:00Z`).getTime() : 0
  const now = Date.now(); const plannedProgressPct = start && end > start ? Math.min(100, Math.max(0, (now - start) / (end - start) * 100)) : project.progress
  const plannedValue = project.costBudget * plannedProgressPct / 100
  const schedulePerformanceIndex = plannedValue ? earnedValue / plannedValue : 1
  const workInProgress = earnedValue - invoicedValue
  const accrual = Math.max(0, actualCosts + openCommitments - invoicedValue)
  return { actualCosts, openCommitments, remainingCost, estimateAtCompletion, approvedChangeValue, expectedRevenue, expectedMargin, expectedMarginPct: expectedRevenue ? expectedMargin / expectedRevenue * 100 : 0, budgetVariance: project.costBudget - estimateAtCompletion, invoicedValue, cashExposure: actualCosts - invoicedValue, latestForecast,earnedValue,plannedValue,costPerformanceIndex,schedulePerformanceIndex,workInProgress,accrual,plannedProgressPct }
}

const planningDayDifference = (from: string, to: string) => Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000)

const planningAddDays = (date: string, days: number) => {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

export const planningTimelineRange = (
  activities: Array<Pick<PlanningActivity, 'startDate' | 'endDate'>>,
  plannedStart?: string,
  plannedEnd?: string,
  fallbackDate = new Date().toISOString().slice(0, 10),
) => {
  const validDate = (value?: string) => Boolean(value && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()))
  const starts = activities.map(activity => activity.startDate).filter(validDate).sort()
  const ends = activities.map(activity => activity.endDate).filter(validDate).sort()
  const startDate = starts[0] ?? (validDate(plannedStart) ? plannedStart! : fallbackDate)
  const candidateEnd = ends.at(-1) ?? (validDate(plannedEnd) ? plannedEnd! : startDate)
  return { startDate, endDate: candidateEnd < startDate ? startDate : candidateEnd }
}

export const planningActivityDependencies = (activity: PlanningActivity): PlanningDependency[] => {
  const source = activity.dependencies?.length
    ? activity.dependencies
    : activity.predecessorIds.map(predecessorId => ({ predecessorId, type: 'FS' as const, lagDays: 0 }))
  return source.filter((dependency, index) => dependency.predecessorId !== activity.id && source.findIndex(item => item.predecessorId === dependency.predecessorId) === index)
}

const dependencyOffset = (predecessorDuration: number, successorDuration: number, dependency: PlanningDependency) => {
  if (dependency.type === 'SS') return dependency.lagDays
  if (dependency.type === 'FF') return predecessorDuration + dependency.lagDays - successorDuration
  if (dependency.type === 'SF') return dependency.lagDays - successorDuration
  return predecessorDuration + dependency.lagDays
}

const planningNetwork = (activities: PlanningActivity[]) => {
  const byId = new Map(activities.map(activity => [activity.id, activity]))
  const durations = new Map(activities.map(activity => [activity.id, activity.milestone ? 0 : Math.max(1, planningDayDifference(activity.startDate, activity.endDate) + 1)]))
  const outgoing = new Map(activities.map(activity => [activity.id, [] as Array<{ successorId: string; dependency: PlanningDependency }>]))
  const indegree = new Map(activities.map(activity => [activity.id, 0]))
  for (const activity of activities) {
    for (const dependency of planningActivityDependencies(activity)) {
      if (!byId.has(dependency.predecessorId)) continue
      outgoing.get(dependency.predecessorId)!.push({ successorId: activity.id, dependency })
      indegree.set(activity.id, (indegree.get(activity.id) ?? 0) + 1)
    }
  }
  const queue = activities.filter(activity => indegree.get(activity.id) === 0).map(activity => activity.id)
  const order: string[] = []
  while (queue.length) {
    const id = queue.shift()!
    order.push(id)
    for (const edge of outgoing.get(id) ?? []) {
      const next = (indegree.get(edge.successorId) ?? 0) - 1
      indegree.set(edge.successorId, next)
      if (next === 0) queue.push(edge.successorId)
    }
  }
  return { byId, durations, outgoing, order, hasCycle: order.length !== activities.length }
}

export const criticalPathAnalysis = (planning: ProjectPlanning): CriticalPathAnalysis => {
  const network = planningNetwork(planning.activities)
  if (network.hasCycle) return { projectDurationDays: 0, criticalActivityIds: new Set(), metrics: new Map(), hasCycle: true }
  const earliest = new Map(planning.activities.map(activity => [activity.id, 0]))
  for (const predecessorId of network.order) {
    for (const edge of network.outgoing.get(predecessorId) ?? []) {
      const offset = dependencyOffset(network.durations.get(predecessorId)!, network.durations.get(edge.successorId)!, edge.dependency)
      earliest.set(edge.successorId, Math.max(earliest.get(edge.successorId) ?? 0, (earliest.get(predecessorId) ?? 0) + offset))
    }
  }
  const projectDurationDays = Math.max(0, ...planning.activities.map(activity => (earliest.get(activity.id) ?? 0) + network.durations.get(activity.id)!))
  const latest = new Map(planning.activities.map(activity => [activity.id, projectDurationDays - network.durations.get(activity.id)!]))
  for (const predecessorId of [...network.order].reverse()) {
    for (const edge of network.outgoing.get(predecessorId) ?? []) {
      const offset = dependencyOffset(network.durations.get(predecessorId)!, network.durations.get(edge.successorId)!, edge.dependency)
      latest.set(predecessorId, Math.min(latest.get(predecessorId)!, latest.get(edge.successorId)! - offset))
    }
  }
  const metrics = new Map<string, CriticalPathActivityMetric>()
  const criticalActivityIds = new Set<string>()
  for (const activity of planning.activities) {
    const durationDays = network.durations.get(activity.id)!
    const earliestStartDay = earliest.get(activity.id) ?? 0
    const latestStartDay = latest.get(activity.id) ?? earliestStartDay
    const totalFloatDays = Math.max(0, latestStartDay - earliestStartDay)
    const metric = { activityId: activity.id, durationDays, earliestStartDay, earliestFinishDay: earliestStartDay + durationDays, latestStartDay, latestFinishDay: latestStartDay + durationDays, totalFloatDays, critical: totalFloatDays === 0 }
    metrics.set(activity.id, metric)
    if (metric.critical) criticalActivityIds.add(activity.id)
  }
  return { projectDurationDays, criticalActivityIds, metrics, hasCycle: false }
}

export const criticalPathActivityIds = (planning: ProjectPlanning) => criticalPathAnalysis(planning).criticalActivityIds

export const autoSchedulePlanningActivities = (activities: PlanningActivity[], anchorDate?: string): PlanningActivity[] => {
  if (!activities.length) return []
  const network = planningNetwork(activities)
  if (network.hasCycle) return activities
  const anchor = anchorDate ?? activities.map(activity => activity.startDate).sort()[0]
  const starts = new Map<string, number>()
  for (const activity of activities) {
    if (!planningActivityDependencies(activity).length) starts.set(activity.id, Math.max(0, planningDayDifference(anchor, activity.startDate)))
    else starts.set(activity.id, 0)
  }
  for (const predecessorId of network.order) {
    for (const edge of network.outgoing.get(predecessorId) ?? []) {
      const offset = dependencyOffset(network.durations.get(predecessorId)!, network.durations.get(edge.successorId)!, edge.dependency)
      starts.set(edge.successorId, Math.max(starts.get(edge.successorId) ?? 0, (starts.get(predecessorId) ?? 0) + offset))
    }
  }
  return activities.map(activity => {
    const startDate = planningAddDays(anchor, starts.get(activity.id) ?? 0)
    const endDate = activity.milestone ? startDate : planningAddDays(startDate, network.durations.get(activity.id)! - 1)
    return { ...activity, startDate, endDate }
  })
}

export const planningConflicts = (projects: Project[], employees: Employee[] = [], absences: EmployeeAbsence[] = [], crews: EmployeeCrew[] = []): PlanningConflict[] => {
  const usages = projects.flatMap(project => project.planning.activities.flatMap(activity => activity.resourceAssignments.map(assignment => ({ project, activity, assignment }))))
  const conflicts: PlanningConflict[] = []
  const seen = new Set<string>()
  const employeeFor = (assignment: PlanningResourceAssignment) => assignment.resourceType === 'Medewerker'
    ? employees.find(employee => employee.id === assignment.employeeId || `${employee.firstName} ${employee.lastName}`.trim().toLocaleLowerCase() === assignment.resourceName.trim().toLocaleLowerCase())
    : undefined
  for (let leftIndex = 0; leftIndex < usages.length; leftIndex += 1) {
    const left = usages[leftIndex]
    const employee = employeeFor(left.assignment)
    if (employee) {
      for (const absence of absences.filter(item => item.employeeId === employee.id && item.status === 'Goedgekeurd' && item.startDate <= left.activity.endDate && item.endDate >= left.activity.startDate)) {
        const key = `absence:${absence.id}:${left.activity.id}`
        if (!seen.has(key)) conflicts.push({ id: key, resourceName: left.assignment.resourceName, resourceType: 'Medewerker', severity: 'Kritiek', message: `${absence.type} van ${absence.startDate} tot ${absence.endDate}; medewerker is niet beschikbaar.`, projectIds: [left.project.id], activityIds: [left.activity.id], startDate: absence.startDate > left.activity.startDate ? absence.startDate : left.activity.startDate, endDate: absence.endDate < left.activity.endDate ? absence.endDate : left.activity.endDate })
        seen.add(key)
      }
      if (left.assignment.allocationPct > employee.employmentPct) {
        const key = `employment:${employee.id}:${left.activity.id}`
        if (!seen.has(key)) conflicts.push({ id: key, resourceName: left.assignment.resourceName, resourceType: 'Medewerker', severity: 'Waarschuwing', message: `${left.assignment.allocationPct}% ingepland bij een arbeidsregime van ${employee.employmentPct}%.`, projectIds: [left.project.id], activityIds: [left.activity.id], startDate: left.activity.startDate, endDate: left.activity.endDate })
        seen.add(key)
      }
    }
    const crew = left.assignment.resourceType === 'Ploeg' ? crews.find(item => item.id === left.assignment.crewId || item.name.trim().toLocaleLowerCase() === left.assignment.resourceName.trim().toLocaleLowerCase()) : undefined
    if (crew) {
      for (const memberId of crew.memberEmployeeIds) {
        const member = employees.find(item => item.id === memberId)
        for (const absence of absences.filter(item => item.employeeId === memberId && item.status === 'Goedgekeurd' && item.startDate <= left.activity.endDate && item.endDate >= left.activity.startDate)) {
          const key = `crew-absence:${crew.id}:${absence.id}:${left.activity.id}`
          if (!seen.has(key)) conflicts.push({ id: key, resourceName: `${crew.name} · ${member ? `${member.firstName} ${member.lastName}` : 'ploeglid'}`, resourceType: 'Ploeg', severity: 'Kritiek', message: `${absence.type} van ${absence.startDate} tot ${absence.endDate}; de ploegbezetting is onvolledig.`, projectIds: [left.project.id], activityIds: [left.activity.id], startDate: absence.startDate > left.activity.startDate ? absence.startDate : left.activity.startDate, endDate: absence.endDate < left.activity.endDate ? absence.endDate : left.activity.endDate })
          seen.add(key)
        }
      }
    }
    if (left.assignment.certificateExpiresOn && left.assignment.certificateExpiresOn < left.activity.endDate) {
      const key = `certificate:${left.assignment.id}:${left.activity.id}`
      if (!seen.has(key)) conflicts.push({ id: key, resourceName: left.assignment.resourceName, resourceType: left.assignment.resourceType, severity: 'Kritiek', message: `Attest vervalt op ${left.assignment.certificateExpiresOn}, vóór het einde van de activiteit.`, projectIds: [left.project.id], activityIds: [left.activity.id], startDate: left.activity.startDate, endDate: left.activity.endDate })
      seen.add(key)
    }
  }
  const resourceGroups = new Map<string, typeof usages>()
  for (const usage of usages) {
    const employee = employeeFor(usage.assignment)
    const crew = usage.assignment.resourceType === 'Ploeg'
      ? crews.find(item => item.id === usage.assignment.crewId || item.name.trim().toLocaleLowerCase() === usage.assignment.resourceName.trim().toLocaleLowerCase())
      : undefined
    const resourceKey = employee
      ? `employee:${employee.id}`
      : usage.assignment.employeeId
        ? `employee:${usage.assignment.employeeId}`
        : crew
          ? `crew:${crew.id}`
          : usage.assignment.crewId
            ? `crew:${usage.assignment.crewId}`
            : `${usage.assignment.resourceType.toLocaleLowerCase()}:${usage.assignment.resourceName.trim().toLocaleLowerCase()}`
    resourceGroups.set(resourceKey, [...(resourceGroups.get(resourceKey) ?? []), usage])
  }
  for (const [resourceKey, resourceUsages] of resourceGroups) {
    if (resourceUsages.length < 2) continue
    const matchingEmployee = resourceUsages.map(usage => employeeFor(usage.assignment)).find(Boolean)
    const capacityPct = matchingEmployee?.employmentPct ?? 100
    const boundaries = [...new Set(resourceUsages.flatMap(usage => [usage.activity.startDate, planningAddDays(usage.activity.endDate, 1)]))].sort()
    const segments: Array<{ startDate: string; endDate: string; active: typeof usages; totalAllocationPct: number; signature: string }> = []
    for (let index = 0; index < boundaries.length - 1; index += 1) {
      const startDate = boundaries[index]
      const endDate = planningAddDays(boundaries[index + 1], -1)
      const active = resourceUsages.filter(usage => usage.activity.startDate <= startDate && usage.activity.endDate >= startDate)
      const totalAllocationPct = active.reduce((sum, usage) => sum + usage.assignment.allocationPct, 0)
      if (active.length < 2 || totalAllocationPct <= capacityPct) continue
      const signature = active.map(usage => `${usage.project.id}:${usage.activity.id}:${usage.assignment.id}`).sort().join('|')
      const previous = segments.at(-1)
      if (previous && previous.signature === signature && planningAddDays(previous.endDate, 1) === startDate) {
        previous.endDate = endDate
        continue
      }
      segments.push({ startDate, endDate, active, totalAllocationPct, signature })
    }
    for (const segment of segments) {
      const projectIds = [...new Set(segment.active.map(usage => usage.project.id))]
      const activityIds = [...new Set(segment.active.map(usage => usage.activity.id))]
      const first = segment.active[0]
      const key = `capacity:${resourceKey}:${segment.signature}:${segment.startDate}:${segment.endDate}`
      const projectLabel = projectIds.length === 1 ? '1 project' : `${projectIds.length} projecten`
      conflicts.push({
        id: key,
        resourceName: first.assignment.resourceName,
        resourceType: first.assignment.resourceType,
        severity: 'Kritiek',
        message: `${segment.totalAllocationPct}% gepland tegenover ${capacityPct}% capaciteit over ${activityIds.length} activiteiten in ${projectLabel}.`,
        projectIds,
        activityIds,
        startDate: segment.startDate,
        endDate: segment.endDate,
        totalAllocationPct: segment.totalAllocationPct,
        capacityPct,
        usages: segment.active.map(usage => ({
          projectId: usage.project.id,
          projectNumber: usage.project.number,
          projectName: usage.project.name,
          activityId: usage.activity.id,
          activityName: usage.activity.name,
          assignmentId: usage.assignment.id,
          allocationPct: usage.assignment.allocationPct,
          startDate: usage.activity.startDate,
          endDate: usage.activity.endDate,
          resourceType: usage.assignment.resourceType,
        })),
      })
    }
  }
  for (const project of projects) for (const activity of project.planning.activities) {
    if (!activity.responsibleEmployeeId) continue
    const responsible = employees.find(item => item.id === activity.responsibleEmployeeId)
    for (const absence of absences.filter(item => item.employeeId === activity.responsibleEmployeeId && item.status === 'Goedgekeurd' && item.startDate <= activity.endDate && item.endDate >= activity.startDate)) {
      const key = `responsible-absence:${absence.id}:${activity.id}`
      if (!seen.has(key)) conflicts.push({ id:key, resourceName: responsible ? `${responsible.firstName} ${responsible.lastName}` : activity.responsible, resourceType:'Medewerker', severity:'Kritiek', message:`Verantwoordelijke is afwezig wegens ${absence.type} van ${absence.startDate} tot ${absence.endDate}.`, projectIds:[project.id], activityIds:[activity.id], startDate:absence.startDate > activity.startDate ? absence.startDate : activity.startDate, endDate:absence.endDate < activity.endDate ? absence.endDate : activity.endDate })
      seen.add(key)
    }
  }
  return conflicts.sort((a, b) => a.startDate.localeCompare(b.startDate))
}

export const class8CalculationTemplates: CalculationTemplate[] = [
  {
    id: 'class8-infrastructure-v1', name: 'Infrastructuur en wegenbouw', discipline: 'Wegenbouw', recognitionClass: 'Klasse 8', version: 1,
    description: 'Uitgebreide hoofdstukstructuur voor openbare wegenis, riolering en omgevingsaanleg.',
    chapters: [
      { code: '01', name: 'Voorbereiding en werfinrichting', items: [{ code: '01.01', description: 'Werfinrichting en algemene maatregelen', quantity: 1, unit: 'GP', labor: 0, material: 0, equipment: 0, subcontracting: 0, quantityType: 'Forfaitair' }] },
      { code: '02', name: 'Opbraak- en grondwerken', items: [{ code: '02.01', description: 'Selectieve opbraak bestaande verharding', quantity: 1, unit: 'm²', labor: 0, material: 0, equipment: 0, subcontracting: 0, quantityType: 'Vermoedelijk' }, { code: '02.02', description: 'Uitgraving en afvoer grond', quantity: 1, unit: 'm³', labor: 0, material: 0, equipment: 0, subcontracting: 0, quantityType: 'Verrekenbaar' }] },
      { code: '03', name: 'Riolering en afwatering', items: [{ code: '03.01', description: 'Riolering inclusief sleuf en aanvulling', quantity: 1, unit: 'm', labor: 0, material: 0, equipment: 0, subcontracting: 0, quantityType: 'Vermoedelijk' }, { code: '03.02', description: 'Inspectieput compleet', quantity: 1, unit: 'st', labor: 0, material: 0, equipment: 0, subcontracting: 0, quantityType: 'Vermoedelijk' }] },
      { code: '04', name: 'Funderingen en verhardingen', items: [{ code: '04.01', description: 'Fundering in steenslag', quantity: 1, unit: 'm²', labor: 0, material: 0, equipment: 0, subcontracting: 0, quantityType: 'Vermoedelijk' }, { code: '04.02', description: 'Asfaltverharding', quantity: 1, unit: 'm²', labor: 0, material: 0, equipment: 0, subcontracting: 0, quantityType: 'Vermoedelijk' }] },
      { code: '05', name: 'Signalisatie, proeven en oplevering', items: [{ code: '05.01', description: 'Proeven, keuringen en as-built-dossier', quantity: 1, unit: 'GP', labor: 0, material: 0, equipment: 0, subcontracting: 0, quantityType: 'Forfaitair' }] },
    ],
  },
  {
    id: 'class8-building-v1', name: 'Utiliteitsbouw en klasse-8-bouwprojecten', discipline: 'Bouwkunde', recognitionClass: 'Klasse 8', version: 1,
    description: 'WBS voor grote utiliteits-, publieke en industriële bouwprojecten.',
    chapters: [
      { code: '10', name: 'Algemene werken en bouwplaatskosten', items: [{ code: '10.01', description: 'Bouwplaatsinrichting, coördinatie en logistiek', quantity: 1, unit: 'GP', labor: 0, material: 0, equipment: 0, subcontracting: 0, quantityType: 'Forfaitair' }] },
      { code: '20', name: 'Ruwbouw en structuur', items: [{ code: '20.01', description: 'Funderings- en betonwerken', quantity: 1, unit: 'm³', labor: 0, material: 0, equipment: 0, subcontracting: 0, quantityType: 'Vermoedelijk' }, { code: '20.02', description: 'Dragende structuur', quantity: 1, unit: 'ton', labor: 0, material: 0, equipment: 0, subcontracting: 0, quantityType: 'Vermoedelijk' }] },
      { code: '30', name: 'Gebouwschil', items: [{ code: '30.01', description: 'Gevel- en dakwerken', quantity: 1, unit: 'm²', labor: 0, material: 0, equipment: 0, subcontracting: 0, quantityType: 'Vermoedelijk' }] },
      { code: '40', name: 'Technieken', items: [{ code: '40.01', description: 'HVAC, sanitair en elektriciteit', quantity: 1, unit: 'GP', labor: 0, material: 0, equipment: 0, subcontracting: 0, quantityType: 'Forfaitair' }] },
      { code: '50', name: 'Afwerking en oplevering', items: [{ code: '50.01', description: 'Binnenafwerking, testen en opleverdossier', quantity: 1, unit: 'GP', labor: 0, material: 0, equipment: 0, subcontracting: 0, quantityType: 'Forfaitair' }] },
    ],
  },
  {
    id: 'class8-civil-v1', name: 'Burgerlijke bouwkunde en kunstwerken', discipline: 'Burgerlijke bouwkunde', recognitionClass: 'Klasse 8', version: 1,
    description: 'Projectstructuur voor bruggen, tunnels, kades en complexe betonconstructies.',
    chapters: [
      { code: 'A', name: 'Projectbeheersing en tijdelijke werken', items: [{ code: 'A.01', description: 'Engineering, fasering en tijdelijke constructies', quantity: 1, unit: 'GP', labor: 0, material: 0, equipment: 0, subcontracting: 0, quantityType: 'Forfaitair' }] },
      { code: 'B', name: 'Grond-, funderings- en bemalingswerken', items: [{ code: 'B.01', description: 'Diepfundering en bemaling', quantity: 1, unit: 'GP', labor: 0, material: 0, equipment: 0, subcontracting: 0, quantityType: 'Vermoedelijk' }] },
      { code: 'C', name: 'Beton- en staalconstructies', items: [{ code: 'C.01', description: 'Constructief beton inclusief wapening en bekisting', quantity: 1, unit: 'm³', labor: 0, material: 0, equipment: 0, subcontracting: 0, quantityType: 'Verrekenbaar' }] },
      { code: 'D', name: 'Uitrusting, proeven en indienststelling', items: [{ code: 'D.01', description: 'Uitrusting, monitoring, proeven en indienststelling', quantity: 1, unit: 'GP', labor: 0, material: 0, equipment: 0, subcontracting: 0, quantityType: 'Forfaitair' }] },
    ],
  },
]

export function unitConversionFactor(fromCode: string, toCode: string, units: UnitDefinition[], conversions: UnitConversion[]): number | undefined {
  if (fromCode.trim().toLocaleLowerCase() === toCode.trim().toLocaleLowerCase()) return 1
  const from = units.find(unit => unit.code.toLocaleLowerCase() === fromCode.trim().toLocaleLowerCase())
  const to = units.find(unit => unit.code.toLocaleLowerCase() === toCode.trim().toLocaleLowerCase())
  if (!from || !to) return undefined
  const direct = conversions.find(conversion => conversion.fromUnitId === from.id && conversion.toUnitId === to.id)
  if (direct) return direct.factor
  const inverse = conversions.find(conversion => conversion.fromUnitId === to.id && conversion.toUnitId === from.id)
  return inverse ? 1 / inverse.factor : undefined
}

export function costLibraryMatchesScope(library: CostLibrary, legalEntityId?: string, branchId?: string): boolean {
  if (!library.legalEntityId) return true
  if (!legalEntityId || library.legalEntityId !== legalEntityId) return false
  if (!library.branchId) return true
  return Boolean(branchId) && library.branchId === branchId
}

const formulaPrecedence: Partial<Record<BoqFormulaOperator, number>> = { '+': 1, '-': 1, '*': 2, '/': 2, '%': 2, '^': 3 }

export const boqFormulaFieldLabels: Record<BoqFormulaField, string> = {
  quantity: 'Hoeveelheid', labor: 'Arbeid', material: 'Materiaal', equipment: 'Materieel', subcontracting: 'Onderaanneming',
  wastePct: 'Materiaalverlies %', itemRiskPct: 'Postrisico %', markupPct: 'Postopslag %', baseUnitCost: 'Basis eenheidskost',
}

export function evaluateFormulaTokens(tokens: BoqFormulaToken[], resolveField: (field: BoqFormulaField) => number, resolveVariable: (id: string) => number): number {
  if (!tokens.length) throw new Error('De formule is leeg')
  const output: Array<number | Exclude<BoqFormulaOperator, '(' | ')'>> = []
  const operators: BoqFormulaOperator[] = []
  let expectsValue = true
  for (const token of tokens) {
    if (token.kind !== 'operator') {
      if (!expectsValue) throw new Error('Plaats een operator tussen twee waarden')
      const value = token.kind === 'field' ? resolveField(token.field) : token.kind === 'variable' ? resolveVariable(token.variableId) : token.value
      if (!Number.isFinite(value)) throw new Error('Een formuleveld bevat geen geldig getal')
      output.push(value); expectsValue = false; continue
    }
    if (token.operator === '(') { if (!expectsValue) throw new Error('Plaats een operator voor het haakje'); operators.push(token.operator); continue }
    if (token.operator === ')') {
      if (expectsValue) throw new Error('Het sluitende haakje staat op een ongeldige plaats')
      while (operators.length && operators.at(-1) !== '(') output.push(operators.pop() as Exclude<BoqFormulaOperator, '(' | ')'>)
      if (operators.pop() !== '(') throw new Error('De haakjes zijn niet in evenwicht')
      expectsValue = false; continue
    }
    if (expectsValue) throw new Error(`Operator ${token.operator} mist een waarde`)
    while (operators.length && operators.at(-1) !== '(' && (formulaPrecedence[operators.at(-1)!] ?? 0) >= (formulaPrecedence[token.operator] ?? 0) && token.operator !== '^') output.push(operators.pop() as Exclude<BoqFormulaOperator, '(' | ')'>)
    operators.push(token.operator); expectsValue = true
  }
  if (expectsValue) throw new Error('De formule eindigt met een operator')
  while (operators.length) { const operator = operators.pop()!; if (operator === '(' || operator === ')') throw new Error('De haakjes zijn niet in evenwicht'); output.push(operator) }
  const values: number[] = []
  for (const part of output) {
    if (typeof part === 'number') { values.push(part); continue }
    const right = values.pop(); const left = values.pop()
    if (left === undefined || right === undefined) throw new Error('De formule is onvolledig')
    if ((part === '/' || part === '%') && right === 0) throw new Error('Delen door nul is niet toegestaan')
    const value = part === '+' ? left + right : part === '-' ? left - right : part === '*' ? left * right : part === '/' ? left / right : part === '%' ? left % right : left ** right
    if (!Number.isFinite(value)) throw new Error('De formule levert geen geldig resultaat op')
    values.push(value)
  }
  if (values.length !== 1) throw new Error('De formule is onvolledig')
  return values[0]
}

export function effectiveBoqValues(item: BoqItem): { values: Record<BoqFormulaTarget, number>; errors: Partial<Record<BoqFormulaTarget, string>> } {
  const raw: Record<BoqFormulaTarget, number> = { quantity:item.quantity, labor:item.labor, material:item.material, equipment:item.equipment, subcontracting:item.subcontracting, wastePct:item.wastePct??0, itemRiskPct:item.itemRiskPct??0, markupPct:item.markupPct??0 }
  const cache = new Map<BoqFormulaTarget, number>(); const errors: Partial<Record<BoqFormulaTarget, string>> = {}
  const variables = new Map((item.variables ?? []).map(variable => [variable.id, variable.value]))
  const resolve = (field: BoqFormulaField, stack: BoqFormulaTarget[]): number => {
    if (field === 'baseUnitCost') {
      return resolve('labor', stack) + resolve('material', stack) * (1 + resolve('wastePct', stack) / 100) + resolve('equipment', stack) + resolve('subcontracting', stack)
    }
    if (cache.has(field)) return cache.get(field)!
    if (stack.includes(field)) throw new Error(`Cirkelverwijzing via ${boqFormulaFieldLabels[field]}`)
    const formula = item.formulas?.[field]
    if (!formula) return raw[field]
    const value = evaluateFormulaTokens(formula.tokens, next => resolve(next, [...stack, field]), id => {
      const variable = variables.get(id); if (variable === undefined) throw new Error('Een gebruikte invoervariabele bestaat niet meer'); return variable
    })
    cache.set(field, value); return value
  }
  const values = { ...raw }
  for (const field of Object.keys(raw) as BoqFormulaTarget[]) {
    try { values[field] = resolve(field, []) } catch (error) { errors[field] = error instanceof Error ? error.message : 'Ongeldige formule'; values[field] = raw[field] }
  }
  return { values, errors }
}

export function boqPriceBreakdown(item: BoqItem) {
  const { values, errors } = effectiveBoqValues(item)
  if (item.postType === 'Tekstregel' || item.postType === 'Subtotaal') return { values, errors, base:0, riskAmount:0, legacyMarkupAmount:0, adjustments:[], total:0 }
  const materialWithWaste = values.material * (1 + values.wastePct / 100)
  const components = { 'Arbeid':values.labor, 'Materiaal':materialWithWaste, 'Materieel':values.equipment, 'Onderaanneming':values.subcontracting }
  const base = values.labor + materialWithWaste + values.equipment + values.subcontracting
  const riskAmount = base * values.itemRiskPct / 100
  // De bestaande postrisico- en postopslagvelden blijven additief op dezelfde
  // basis rekenen. Nieuwe, expliciete prijsregels worden daarna in volgorde
  // toegepast en kunnen dus bewust op de lopende directe kost stapelen.
  const legacyMarkupAmount = base * values.markupPct / 100
  let running = base + riskAmount + legacyMarkupAmount
  const adjustments = (item.priceAdjustments ?? []).filter(rule=>rule.active).map(rule => {
    const basis = rule.basis === 'Directe kost' ? running : components[rule.basis]
    const amount = basis * rule.percentage / 100 * (rule.type === 'Markdown' ? -1 : 1)
    running += amount
    return { ...rule, amount, runningTotal:running }
  })
  return { values, errors, base, riskAmount, legacyMarkupAmount, adjustments, total:running }
}

export const unitCost = (item: BoqItem) => boqPriceBreakdown(item).total

export const boqItemQuantity = (item: BoqItem) => effectiveBoqValues(item).values.quantity

export const directCost = (calculation: Calculation) =>
  calculation.items.reduce((total, item) => total + boqItemQuantity(item) * unitCost(item), 0)

export const sellingTotal = (calculation: Calculation) => {
  const cost = directCost(calculation)
  const withSiteOverhead = cost * (1 + (calculation.siteOverheadPct ?? 0) / 100)
  const withOverheadAndRisk = withSiteOverhead * (1 + (calculation.overheadPct + calculation.riskPct + (calculation.escalationPct ?? 0)) / 100)
  const withMargin = withOverheadAndRisk / (1 - calculation.marginPct / 100)
  const discounted = withMargin * (1 - (calculation.discountPct ?? 0) / 100)
  const step = calculation.roundingStep ?? 0
  return step > 0 ? Math.round(discounted / step) * step : discounted
}

const calculationNumbersDiffer = (before: number, after: number) => Math.abs(before - after) > 0.000001

export function compareCalculationSnapshots(before: Calculation, after: Calculation): CalculationSnapshotComparison {
  const beforeByCode = new Map(before.items.map(item => [item.code, item]))
  const afterByCode = new Map(after.items.map(item => [item.code, item]))
  const beforeChapterById = new Map(before.chapters.map(chapter => [chapter.id, `${chapter.code} · ${chapter.name}`]))
  const afterChapterById = new Map(after.chapters.map(chapter => [chapter.id, `${chapter.code} · ${chapter.name}`]))
  const codes = [...new Set([...beforeByCode.keys(), ...afterByCode.keys()])].sort((left, right) => left.localeCompare(right, 'nl-BE', { numeric:true }))

  const rows = codes.map(code => {
    const beforeItem = beforeByCode.get(code)
    const afterItem = afterByCode.get(code)
    const beforeQuantity = beforeItem ? boqItemQuantity(beforeItem) : 0
    const afterQuantity = afterItem ? boqItemQuantity(afterItem) : 0
    const beforeItemUnitCost = beforeItem ? unitCost(beforeItem) : 0
    const afterItemUnitCost = afterItem ? unitCost(afterItem) : 0
    const beforeTotal = beforeQuantity * beforeItemUnitCost
    const afterTotal = afterQuantity * afterItemUnitCost
    const beforeChapter = beforeItem?.chapterId ? beforeChapterById.get(beforeItem.chapterId) ?? 'Onbekend hoofdstuk' : 'Zonder hoofdstuk'
    const afterChapter = afterItem?.chapterId ? afterChapterById.get(afterItem.chapterId) ?? 'Onbekend hoofdstuk' : 'Zonder hoofdstuk'
    const changedFields: string[] = []

    if (!beforeItem) changedFields.push('Nieuwe post')
    else if (!afterItem) changedFields.push('Verwijderde post')
    else {
      if (beforeItem.description !== afterItem.description) changedFields.push('Omschrijving')
      if (beforeChapter !== afterChapter) changedFields.push('Hoofdstuk')
      if (beforeItem.unit !== afterItem.unit) changedFields.push('Eenheid')
      if (calculationNumbersDiffer(beforeQuantity, afterQuantity)) changedFields.push('Hoeveelheid')
      if (calculationNumbersDiffer(beforeItemUnitCost, afterItemUnitCost)) changedFields.push('Eenheidsprijs')
      if (beforeItem.notes !== afterItem.notes) changedFields.push('Notitie')
      if (beforeItem.postType !== afterItem.postType || beforeItem.quantityType !== afterItem.quantityType) changedFields.push('Postinstellingen')
      const beforePriceStructure = JSON.stringify({ labor:beforeItem.labor, material:beforeItem.material, equipment:beforeItem.equipment, subcontracting:beforeItem.subcontracting, wastePct:beforeItem.wastePct, itemRiskPct:beforeItem.itemRiskPct, markupPct:beforeItem.markupPct, variables:beforeItem.variables, formulas:beforeItem.formulas, priceAdjustments:beforeItem.priceAdjustments, costApplications:beforeItem.costApplications })
      const afterPriceStructure = JSON.stringify({ labor:afterItem.labor, material:afterItem.material, equipment:afterItem.equipment, subcontracting:afterItem.subcontracting, wastePct:afterItem.wastePct, itemRiskPct:afterItem.itemRiskPct, markupPct:afterItem.markupPct, variables:afterItem.variables, formulas:afterItem.formulas, priceAdjustments:afterItem.priceAdjustments, costApplications:afterItem.costApplications })
      if (beforePriceStructure !== afterPriceStructure && !changedFields.includes('Eenheidsprijs')) changedFields.push('Prijsopbouw')
    }

    const status: CalculationSnapshotDifferenceStatus = !beforeItem ? 'Toegevoegd' : !afterItem ? 'Verwijderd' : changedFields.length ? 'Gewijzigd' : 'Gelijk'
    return { code, status, before:beforeItem, after:afterItem, beforeChapter, afterChapter, beforeQuantity, afterQuantity, beforeUnitCost:beforeItemUnitCost, afterUnitCost:afterItemUnitCost, beforeTotal, afterTotal, totalDifference:afterTotal-beforeTotal, changedFields }
  })

  const pricingFields = [
    ['siteOverheadPct','Werfkosten'], ['overheadPct','Algemene kosten'], ['riskPct','Risico'], ['escalationPct','Indexatie'], ['marginPct','Marge'], ['discountPct','Korting'], ['roundingStep','Afronding'],
  ] as const
  const pricingChanges = pricingFields.map(([field,label]) => {
    const beforeValue = before[field] ?? 0
    const afterValue = after[field] ?? 0
    return { field, label, before:beforeValue, after:afterValue, difference:afterValue-beforeValue }
  }).filter(item => calculationNumbersDiffer(item.before,item.after))
  const beforeDirectCost = directCost(before)
  const afterDirectCost = directCost(after)
  const beforeSellingTotal = sellingTotal(before)
  const afterSellingTotal = sellingTotal(after)

  return {
    beforeDirectCost,
    afterDirectCost,
    directCostDifference:afterDirectCost-beforeDirectCost,
    beforeSellingTotal,
    afterSellingTotal,
    sellingTotalDifference:afterSellingTotal-beforeSellingTotal,
    rows,
    added:rows.filter(row=>row.status==='Toegevoegd').length,
    removed:rows.filter(row=>row.status==='Verwijderd').length,
    changed:rows.filter(row=>row.status==='Gewijzigd').length,
    unchanged:rows.filter(row=>row.status==='Gelijk').length,
    pricingChanges,
  }
}

export function bulkBoqPriceAdjustmentPreview(
  calculation: Calculation,
  itemIds: string[],
  adjustment: BoqPriceAdjustment,
) {
  const selectedIds = new Set(itemIds)
  let affectedItems = 0
  let skippedItems = 0
  const items = calculation.items.map(item => {
    if (!selectedIds.has(item.id)) return item
    if (item.postType === 'Tekstregel' || item.postType === 'Subtotaal' || (item.priceAdjustments?.length ?? 0) >= 50) {
      skippedItems += 1
      return item
    }
    affectedItems += 1
    return { ...item, priceAdjustments: [...(item.priceAdjustments ?? []), adjustment] }
  })
  const updatedCalculation = { ...calculation, items }
  const beforeDirectCost = directCost(calculation)
  const afterDirectCost = directCost(updatedCalculation)
  const beforeSellingTotal = sellingTotal(calculation)
  const afterSellingTotal = sellingTotal(updatedCalculation)
  return {
    updatedCalculation,
    selectedItems: itemIds.length,
    affectedItems,
    skippedItems,
    beforeDirectCost,
    afterDirectCost,
    directCostImpact: afterDirectCost - beforeDirectCost,
    beforeSellingTotal,
    afterSellingTotal,
    sellingTotalImpact: afterSellingTotal - beforeSellingTotal,
    hasNegativeUnitCost: items.some(item => selectedIds.has(item.id) && unitCost(item) < 0),
  }
}

export const grossMargin = (calculation: Calculation) => sellingTotal(calculation) - directCost(calculation)

export const scenarioDirectCost = (calculation: Calculation, scenario: CalculationScenario) =>
  calculation.items.reduce((total, item) => { if(item.postType === 'Tekstregel' || item.postType === 'Subtotaal')return total; const effective=effectiveBoqValues(item).values; return total + effective.quantity * (
    effective.labor * (1 + scenario.laborAdjustmentPct / 100)
    + effective.material * (1 + scenario.materialAdjustmentPct / 100)
    + effective.equipment * (1 + scenario.equipmentAdjustmentPct / 100)
    + effective.subcontracting * (1 + scenario.subcontractingAdjustmentPct / 100)
  ) }, 0)

export const scenarioSellingTotal = (calculation: Calculation, scenario: CalculationScenario) => {
  const cost = scenarioDirectCost(calculation, scenario)
  const withSiteOverhead = cost * (1 + (calculation.siteOverheadPct ?? 0) / 100)
  const withOverheadAndRisk = withSiteOverhead * (1 + (scenario.overheadPct + scenario.riskPct + (calculation.escalationPct ?? 0)) / 100)
  const withMargin = withOverheadAndRisk / (1 - scenario.marginPct / 100)
  const discounted = withMargin * (1 - (calculation.discountPct ?? 0) / 100)
  const step = calculation.roundingStep ?? 0
  return step > 0 ? Math.round(discounted / step) * step : discounted
}

export const scenarioGrossMargin = (calculation: Calculation, scenario: CalculationScenario) =>
  scenarioSellingTotal(calculation, scenario) - scenarioDirectCost(calculation, scenario)

export const createId = () => crypto.randomUUID()

export const todayIso = () => new Date().toISOString()
