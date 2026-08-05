import type { BelgianAddressSuggestion, BoqChapter, BoqImportPreview, BoqItem, BoqPriceAdjustment, BouwFlowState, BulkCostUpdateResult, BulkPriceAdjustmentResult, Calculation, CalculationScenario, CalculationTemplate, CalculationVersion, ChangeOrder, ChangeOrderInput, CommitmentSettlementInput, CompanyBranch, CompanyBranchInput, CompanyUser, CompanyUserAccessInput, CompanyUserProfileInput, CostLibrary, CostLibraryItem, CostLibraryVersion, DailyReport, DailyReportInput, DocumentDistributionInput, DocumentIntegrityResult, DocumentRecipient, DocumentRevisionInput, DocumentUploadInput, IntercompanyCharge, IntercompanyChargeInput, LegalEntity, LegalEntityFinancialInput, LegalEntityInput, MailboxComposeInput, MailboxLinkInput, MailboxMessage, MailboxOverview, MailboxReplyInput, Opportunity, OpportunityDetailsInput, OpportunityGoNoGoInput, Organization, OrganizationBillingInput, PaymentRegistrationInput, PeppolAcceptanceReleaseInput, PeppolAcceptanceResult, PeppolAcceptanceRun, PeppolAlert, PeppolDelivery, PeppolNotificationSettings, PeppolNotificationSettingsInput, PeppolNotificationTestInput, PeppolNotificationTestResult, PeppolValidationReport, PostCalculationFeedbackInput, ProcurementRequest, ProcurementRequestInput, ProgressStatement, ProgressStatementInput, Project, ProjectBaselineInput, ProjectCompanyAssignmentInput, ProjectCost, ProjectCostInput, ProjectDetailsInput, ProjectDocument, ProjectForecast, ProjectForecastInput, ProjectPlanningInput, ProjectStartupInput, PurchaseInvoiceMatchInput, PurchaseInvoiceMatchResult, PurchaseOrder, PurchaseReceiptInput, QhseCertificate, QhseCertificateInput, QhseInspection, QhseInspectionInput, Quote, QuoteContent, SalesInvoice, SalesInvoiceInput, SalesInvoiceIssueInput, SitePhoto, SitePhotoInput, Supplier, SupplierFrameworkAgreementInput, SupplierInput, SupplierQuoteInput, UnitConversion, UnitDefinition, WorkflowDefinition, WorkflowDefinitionInput } from './domain'
import type { CrmActivity, DocumentMetadataInput, DocumentRecordLinkInput, OrganizationInput, OrganizationRelation, TenderDossier } from './domain'
import type { AuditTrailEntry } from './domain'
import type { WorkflowCorrectionInput, WorkflowCorrectionResult } from './domain'
import type { CloseoutItem, ProjectCloseoutUpdateInput, ServiceRequestInput } from './domain'
import type { PriceIndexCatalogue } from './domain'
import type { Asset, AssetInput, AssetOperationalInput, InventoryCountInput, InventoryItem, InventoryItemInput, StockMovement, StockMovementInput, Warehouse, WarehouseInput } from './domain'
import type { AiAnalysis, AiAnalysisInput, CheckinatworkCancellationReason, CheckinatworkParticipant, CheckinatworkParticipantInput, CheckinatworkRegistration, CheckinatworkRegistrationInput, CheckinatworkSite, CheckinatworkSiteInput, Employee, EmployeeAbsence, EmployeeAbsenceDecisionInput, EmployeeAbsenceInput, EmployeeCrew, EmployeeCrewInput, EmployeeInput, IntegrationConnection, IntegrationConnectionInput, IntegrationJob, IntegrationJobInput, JointVenture, JointVentureInput, ProjectClaim, ProjectClaimInput, ProjectCloseout, ProjectCloseoutInput, ProjectContract, ProjectContractInput, ProjectContractUpdateInput, QhseEvent, QhseEventInput, Subcontractor, SubcontractorInput, SubcontractorOperationInput, TimeEntry, TimeEntryInput, WorkTicket, WorkTicketInput } from './domain'
import { canQueueOffline, countQueuedMutations, enqueueMutation, queuedMutations, removeQueuedMutation, updateQueuedMutation } from './offline-queue'
import type { LidarArtifact, LidarBcfTopic, LidarControlPoint, LidarElementObservation, LidarScanInput, LidarScanSession } from './lidar-bim'
import type { LidarSurveyElement, LidarWorkAssignment } from './lidar-calculation'
import type { WorkReminderInput, WorkReminderResult } from './domain'

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>
type TokenProvider = () => Promise<string | undefined>

export class BouwFlowApi {
  private readonly baseUrl: string
  private readonly fetcher: FetchLike
  private readonly tokenProvider?: TokenProvider
  private revisionEtag?: string
  private demoUserId?: string

  constructor(baseUrl: string, fetcher: FetchLike = fetch, tokenProvider?: TokenProvider) {
    this.baseUrl = baseUrl.replace(/\/$/, '')
    this.fetcher = fetcher.bind(globalThis)
    this.tokenProvider = tokenProvider
  }

  async offlineScope(token?: string) {
    token ??= await this.tokenProvider?.()
    if (!token) {
      if (this.tokenProvider) throw new Error('Geen aangemelde gebruiker voor offline gegevens')
      return `${this.baseUrl}|development`
    }
    try {
      const encoded = token.split('.')[1]
      if (!encoded) throw new Error('Token bevat geen claims')
      const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(encoded.length / 4) * 4, '=')
      const claims = JSON.parse(globalThis.atob(normalized)) as { tid?: unknown; oid?: unknown; sub?: unknown }
      const tenant = typeof claims.tid === 'string' ? claims.tid : ''
      const user = typeof claims.oid === 'string' ? claims.oid : typeof claims.sub === 'string' ? claims.sub : ''
      if (!tenant || !user) throw new Error('Tenant- of gebruikersclaim ontbreekt')
      return `${this.baseUrl}|${tenant}|${user}${this.demoUserId ? `|demo:${this.demoUserId}` : ''}`
    } catch {
      const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
      return `${this.baseUrl}|token-${Array.from(new Uint8Array(digest)).map(value => value.toString(16).padStart(2, '0')).join('')}${this.demoUserId ? `|demo:${this.demoUserId}` : ''}`
    }
  }

  bootstrap() {
    return this.request<BouwFlowState>('/api/bootstrap')
  }

  mailbox(){return this.request<MailboxOverview>('/api/mailbox')}
  synchronizeMailbox(){return this.request<MailboxOverview>('/api/mailbox/synchronize',{method:'POST'})}
  sendMailboxMessage(input:MailboxComposeInput){return this.request<MailboxMessage>('/api/mailbox/send',{method:'POST',body:JSON.stringify(input)})}
  replyMailboxMessage(id:string,input:MailboxReplyInput){return this.request<{sent:true}>(`/api/mailbox/messages/${encodeURIComponent(id)}/reply`,{method:'POST',body:JSON.stringify(input)})}
  linkMailboxMessage(id:string,input:MailboxLinkInput){return this.request<MailboxMessage>(`/api/mailbox/messages/${encodeURIComponent(id)}/link`,{method:'PATCH',body:JSON.stringify(input)})}
  sendWorkReminder(input:WorkReminderInput){return this.request<WorkReminderResult>('/api/work-reminders/send',{method:'POST',body:JSON.stringify(input)})}

  setDemoUser(userId?: string) {
    this.demoUserId = userId
    this.revisionEtag = undefined
  }

  auditTrail(entityType: string, entityId: string) {
    return this.request<AuditTrailEntry[]>(`/api/audit/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}`)
  }

  userPreference<T extends object>(key: string) {
    return this.request<{ key: string; value: T | null }>(`/api/user-preferences/${encodeURIComponent(key)}`)
  }

  saveUserPreference<T extends object>(key: string, value: T) {
    return this.request<{ key: string; value: T; updatedAt: string }>(`/api/user-preferences/${encodeURIComponent(key)}`, { method: 'PATCH', body: JSON.stringify({ value }) })
  }

  createLegalEntity(input: LegalEntityInput) { return this.request<LegalEntity>('/api/legal-entities', { method: 'POST', body: JSON.stringify(input) }) }
  updateLegalEntityFinancial(id: string, input: LegalEntityFinancialInput) { return this.request<LegalEntity>(`/api/legal-entities/${encodeURIComponent(id)}/financial-settings`, { method: 'PATCH', body: JSON.stringify(input) }) }
  createOrganization(input: OrganizationInput) { return this.request<Organization>('/api/organizations', { method: 'POST', body: JSON.stringify(input) }) }
  updateOrganization(id: string, input: OrganizationInput) { return this.request<Organization>(`/api/organizations/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) }) }
  searchBelgianAddresses(query: string, signal?: AbortSignal) { return this.request<{ suggestions: BelgianAddressSuggestion[] }>(`/api/addresses/be/suggestions?q=${encodeURIComponent(query)}&limit=12`, { signal }).then(result => result.suggestions) }
  async downloadBimTestModel(id: string) {
    const token = await this.tokenProvider?.()
    const response = await this.fetcher(`${this.baseUrl}/api/bim/test-models/${encodeURIComponent(id)}/file`, { headers: { Accept: 'application/x-step,application/octet-stream', ...(token ? { Authorization: `Bearer ${token}` } : {}) } })
    if (!response.ok) throw new ApiError(`IFC-proefmodeldownload mislukt (${response.status})`, response.status)
    return response.blob()
  }
  addCrmActivity(id: string, input: Omit<CrmActivity,'id'|'createdAt'>) { return this.request<Organization>(`/api/organizations/${encodeURIComponent(id)}/activities`, { method:'POST', body:JSON.stringify(input) }) }
  addOrganizationRelation(id: string, input: Omit<OrganizationRelation,'id'|'createdAt'>) { return this.request<Organization>(`/api/organizations/${encodeURIComponent(id)}/relations`, { method:'POST', body:JSON.stringify(input) }) }
  updateOrganizationBilling(id: string, input: OrganizationBillingInput) { return this.request<Organization>(`/api/organizations/${encodeURIComponent(id)}/billing-profile`, { method: 'PATCH', body: JSON.stringify(input) }) }
  createIntercompanyCharge(input: IntercompanyChargeInput) { return this.request<IntercompanyCharge>('/api/intercompany-charges', { method: 'POST', body: JSON.stringify(input) }) }
  approveIntercompanyCharge(id: string) { return this.request<IntercompanyCharge>(`/api/intercompany-charges/${encodeURIComponent(id)}/approve`, { method: 'POST' }) }
  postIntercompanyCharge(id: string) { return this.request<IntercompanyCharge>(`/api/intercompany-charges/${encodeURIComponent(id)}/post`, { method: 'POST' }) }
  createCompanyBranch(legalEntityId: string, input: CompanyBranchInput) { return this.request<CompanyBranch>(`/api/legal-entities/${encodeURIComponent(legalEntityId)}/branches`, { method: 'POST', body: JSON.stringify(input) }) }
  assignProjectCompany(projectId: string, input: ProjectCompanyAssignmentInput) { return this.request<Project>(`/api/projects/${encodeURIComponent(projectId)}/company-assignment`, { method: 'PATCH', body: JSON.stringify(input) }) }
  updateCompanyUserAccess(userId: string, input: CompanyUserAccessInput) { return this.request<CompanyUser>(`/api/users/${encodeURIComponent(userId)}/company-access`, { method: 'PATCH', body: JSON.stringify(input) }) }
  inviteCompanyUser(input: CompanyUserProfileInput) { return this.request<CompanyUser>('/api/users', { method:'POST', body:JSON.stringify(input) }) }
  updateCompanyUser(userId:string,input:CompanyUserProfileInput){return this.request<CompanyUser>(`/api/users/${encodeURIComponent(userId)}`,{method:'PATCH',body:JSON.stringify(input)})}
  createWorkflowDefinition(input:WorkflowDefinitionInput){return this.request<WorkflowDefinition>('/api/settings/workflows',{method:'POST',body:JSON.stringify(input)})}
  updateWorkflowDefinition(id:string,input:WorkflowDefinitionInput){return this.request<WorkflowDefinition>(`/api/settings/workflows/${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify(input)})}
  correctWorkflow(input:WorkflowCorrectionInput){return this.request<WorkflowCorrectionResult>('/api/workflows/correct',{method:'POST',body:JSON.stringify(input)})}
  updatePeppolNotificationSettings(input: PeppolNotificationSettingsInput) { return this.request<PeppolNotificationSettings>('/api/settings/peppol-notifications', { method: 'PATCH', body: JSON.stringify(input) }) }
  testPeppolNotification(input: PeppolNotificationTestInput) { return this.request<PeppolNotificationTestResult>('/api/settings/peppol-notifications/test', { method: 'POST', body: JSON.stringify(input) }) }

  createOpportunity(input: Omit<Opportunity, 'id' | 'projectNumber' | 'stage'>) {
    return this.request<Opportunity>('/api/opportunities', { method: 'POST', body: JSON.stringify(input) })
  }

  updateOpportunity(id: string, input: OpportunityDetailsInput) { return this.request<Opportunity>(`/api/opportunities/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) }) }
  saveTenderDossier(id: string, input: TenderDossier) { return this.request<Opportunity>(`/api/opportunities/${encodeURIComponent(id)}/tender`, { method:'PUT', body:JSON.stringify(input) }) }
  qualifyOpportunity(id: string) { return this.request<Opportunity>(`/api/opportunities/${encodeURIComponent(id)}/qualify`, { method: 'POST' }) }
  assessOpportunity(id: string, input: OpportunityGoNoGoInput) { return this.request<Opportunity>(`/api/opportunities/${encodeURIComponent(id)}/go-no-go`, { method: 'POST', body: JSON.stringify(input) }) }

  startCalculation(opportunityId: string) {
    return this.request<Calculation>(`/api/opportunities/${encodeURIComponent(opportunityId)}/calculations`, { method: 'POST' })
  }

  updateCalculation(id: string, patch: Partial<Pick<Calculation, 'overheadPct' | 'riskPct' | 'marginPct'>>) {
    return this.request<Calculation>(`/api/calculations/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) })
  }

  addBoqItem(calculationId: string, input: Omit<BoqItem, 'id' | 'costApplications'>) {
    return this.request<BoqItem>(`/api/calculations/${encodeURIComponent(calculationId)}/items`, { method: 'POST', body: JSON.stringify(input) })
  }

  updateBoqItem(calculationId: string, itemId: string, patch: Partial<Omit<BoqItem, 'id'>>) {
    return this.request<BoqItem>(`/api/calculations/${encodeURIComponent(calculationId)}/items/${encodeURIComponent(itemId)}`, { method: 'PATCH', body: JSON.stringify(patch) })
  }

  removeBoqItem(calculationId: string, itemId: string) {
    return this.request<void>(`/api/calculations/${encodeURIComponent(calculationId)}/items/${encodeURIComponent(itemId)}`, { method: 'DELETE' })
  }

  createCostLibraryItem(input: Omit<CostLibraryItem, 'id' | 'updatedAt'>) {
    return this.request<CostLibraryItem>('/api/cost-library', { method: 'POST', body: JSON.stringify(input) })
  }

  updateCostLibraryItem(id: string, patch: Partial<Omit<CostLibraryItem, 'id' | 'updatedAt'>>) {
    return this.request<CostLibraryItem>(`/api/cost-library/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) })
  }

  createCostLibrary(input: Pick<CostLibrary, 'name' | 'description' | 'legalEntityId' | 'branchId'>) {
    return this.request<{ library: CostLibrary; version: CostLibraryVersion }>('/api/cost-libraries', { method: 'POST', body: JSON.stringify(input) })
  }

  updateCostLibrary(id: string, patch: { active?: boolean; legalEntityId?: string | null; branchId?: string | null }) {
    return this.request<CostLibrary>(`/api/cost-libraries/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) })
  }

  createUnit(input: Omit<UnitDefinition, 'id' | 'createdAt'>) { return this.request<UnitDefinition>('/api/units', { method: 'POST', body: JSON.stringify(input) }) }
  updateUnit(id: string, patch: Partial<Pick<UnitDefinition, 'code' | 'name' | 'category' | 'active'>>) { return this.request<UnitDefinition>(`/api/units/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) }) }
  createUnitConversion(input: Omit<UnitConversion, 'id' | 'createdAt'>) { return this.request<UnitConversion>('/api/unit-conversions', { method: 'POST', body: JSON.stringify(input) }) }

  bulkUpdateBoqItemsFromLibrary(calculationId: string, itemIds: string[], libraryId: string) {
    return this.request<BulkCostUpdateResult>(`/api/calculations/${encodeURIComponent(calculationId)}/cost-library/bulk-update`, { method: 'POST', body: JSON.stringify({ itemIds, libraryId }) })
  }

  bulkApplyBoqPriceAdjustment(calculationId: string, itemIds: string[], adjustment: BoqPriceAdjustment) {
    return this.request<BulkPriceAdjustmentResult>(`/api/calculations/${encodeURIComponent(calculationId)}/price-adjustments/bulk-apply`, { method: 'POST', body: JSON.stringify({ itemIds, adjustment }) })
  }

  createCostLibraryVersion(libraryId: string, input: { label: string; effectiveFrom: string; cloneFromVersionId?: string }) {
    return this.request<{ version: CostLibraryVersion; items: CostLibraryItem[] }>(`/api/cost-libraries/${encodeURIComponent(libraryId)}/versions`, { method: 'POST', body: JSON.stringify(input) })
  }

  publishCostLibraryVersion(versionId: string) {
    return this.request<CostLibraryVersion>(`/api/cost-library-versions/${encodeURIComponent(versionId)}/publish`, { method: 'POST' })
  }

  publishPostCalculationFeedback(projectId: string, input: PostCalculationFeedbackInput) {
    return this.request<CostLibraryItem>(`/api/projects/${encodeURIComponent(projectId)}/post-calculation/library`, { method: 'POST', body: JSON.stringify(input) })
  }

  applyCostLibraryItem(calculationId: string, itemId: string, libraryItemId: string, factor: number) {
    return this.request<BoqItem>(`/api/calculations/${encodeURIComponent(calculationId)}/items/${encodeURIComponent(itemId)}/cost-library/${encodeURIComponent(libraryItemId)}`, { method: 'POST', body: JSON.stringify({ factor }) })
  }

  addChapter(calculationId: string, input: Pick<BoqChapter, 'code' | 'name'> & Partial<Pick<BoqChapter, 'parentChapterId' | 'responsibleUserId' | 'workflowStatus'>>) {
    return this.request<BoqChapter>(`/api/calculations/${encodeURIComponent(calculationId)}/chapters`, { method: 'POST', body: JSON.stringify(input) })
  }

  updateCalculationStructure(calculationId: string, input: { chapters: Array<{ id: string; sortOrder: number; code?: string; name?: string; parentChapterId?: string | null; responsibleUserId?: string | null; workflowStatus?: BoqChapter['workflowStatus'] }>; items: Array<{ id: string; chapterId?: string | null; sortOrder: number }> }) {
    return this.request<Calculation>(`/api/calculations/${encodeURIComponent(calculationId)}/structure`, { method: 'PUT', body: JSON.stringify(input) })
  }

  applyCalculationTemplate(calculationId: string, template: CalculationTemplate) {
    return this.request<Calculation>(`/api/calculations/${encodeURIComponent(calculationId)}/templates`, { method: 'POST', body: JSON.stringify(template) })
  }

  createCalculationVersion(calculationId: string, input: { label: string; reason: string }) {
    return this.request<CalculationVersion>(`/api/calculations/${encodeURIComponent(calculationId)}/versions`, { method: 'POST', body: JSON.stringify(input) })
  }

  createCalculationScenario(calculationId: string, input: Omit<CalculationScenario, 'id' | 'calculationId' | 'isSelected' | 'updatedAt'>) {
    return this.request<CalculationScenario>(`/api/calculations/${encodeURIComponent(calculationId)}/scenarios`, { method: 'POST', body: JSON.stringify(input) })
  }

  createPresetScenarios(calculationId: string) {
    return this.request<CalculationScenario[]>(`/api/calculations/${encodeURIComponent(calculationId)}/scenarios/presets`, { method: 'POST' })
  }

  updateCalculationScenario(calculationId: string, scenarioId: string, patch: Partial<Omit<CalculationScenario, 'id' | 'calculationId' | 'isSelected' | 'updatedAt'>>) {
    return this.request<CalculationScenario>(`/api/calculations/${encodeURIComponent(calculationId)}/scenarios/${encodeURIComponent(scenarioId)}`, { method: 'PATCH', body: JSON.stringify(patch) })
  }

  selectCalculationScenario(calculationId: string, scenarioId: string) {
    return this.request<CalculationScenario>(`/api/calculations/${encodeURIComponent(calculationId)}/scenarios/${encodeURIComponent(scenarioId)}/select`, { method: 'POST' })
  }

  previewBoqImport(calculationId: string, file: File) {
    return this.upload<BoqImportPreview>(`/api/calculations/${encodeURIComponent(calculationId)}/import/preview`, file)
  }

  importBoq(calculationId: string, file: File) {
    return this.upload<Calculation>(`/api/calculations/${encodeURIComponent(calculationId)}/import`, file)
  }

  createQuote(calculationId: string, content: QuoteContent) {
    return this.request<Quote>(`/api/calculations/${encodeURIComponent(calculationId)}/quotes`, { method: 'POST', body: JSON.stringify(content) })
  }
  approveQuote(id:string,approvedBy:string){return this.request<Quote>(`/api/quotes/${encodeURIComponent(id)}/approve`,{method:'POST',body:JSON.stringify({approvedBy})})}
  sendQuote(id:string,sentTo:string,sentBy:string){return this.request<Quote>(`/api/quotes/${encodeURIComponent(id)}/send`,{method:'POST',body:JSON.stringify({sentTo,sentBy})})}
  remindQuote(id:string,sentBy:string){return this.request<Quote>(`/api/quotes/${encodeURIComponent(id)}/remind`,{method:'POST',body:JSON.stringify({sentBy})})}
  markQuoteOpened(id:string){return this.request<Quote>(`/api/quotes/${encodeURIComponent(id)}/opened`,{method:'POST'})}
  signQuote(id:string,signedBy:string){return this.request<Quote>(`/api/quotes/${encodeURIComponent(id)}/sign`,{method:'POST',body:JSON.stringify({signedBy})})}
  loseQuote(id:string,reason:string,recordedBy:string){return this.request<Quote>(`/api/quotes/${encodeURIComponent(id)}/lose`,{method:'POST',body:JSON.stringify({reason,recordedBy})})}

  async downloadQuotePdf(id: string) {
    const token = await this.tokenProvider?.()
    const response = await this.fetcher(`${this.baseUrl}/api/quotes/${encodeURIComponent(id)}/pdf`, { headers: { Accept: 'application/pdf', ...(token ? { Authorization: `Bearer ${token}` } : {}) } })
    if (!response.ok) throw new ApiError(`PDF-download mislukt (${response.status})`, response.status)
    return response.blob()
  }

  award(calculationId: string) {
    return this.request<Project>(`/api/calculations/${encodeURIComponent(calculationId)}/award`, { method: 'POST' })
  }

  updateProjectStartup(projectId: string, input: ProjectStartupInput) {
    return this.request<Project>(`/api/projects/${encodeURIComponent(projectId)}/startup`, { method: 'PATCH', body: JSON.stringify(input) })
  }

  updateProjectDetails(projectId: string, input: ProjectDetailsInput) { return this.request<Project>(`/api/projects/${encodeURIComponent(projectId)}`, { method: 'PATCH', body: JSON.stringify(input) }) }

  generateProjectPlanning(projectId: string) {
    return this.request<Project>(`/api/projects/${encodeURIComponent(projectId)}/planning/generate`, { method: 'POST' })
  }

  updateProjectPlanning(projectId: string, input: ProjectPlanningInput) {
    return this.request<Project>(`/api/projects/${encodeURIComponent(projectId)}/planning`, { method: 'PATCH', body: JSON.stringify(input) })
  }

  baselineProjectPlanning(projectId: string, input: ProjectBaselineInput = {}) {
    return this.request<Project>(`/api/projects/${encodeURIComponent(projectId)}/planning/baseline`, { method: 'POST', body: JSON.stringify(input) })
  }

  createDailyReport(projectId: string, input: DailyReportInput) {
    return this.request<DailyReport>(`/api/projects/${encodeURIComponent(projectId)}/daily-reports`, { method: 'POST', body: JSON.stringify(input) })
  }

  updateDailyReport(reportId: string, input: DailyReportInput) {
    return this.request<DailyReport>(`/api/daily-reports/${encodeURIComponent(reportId)}`, { method: 'PATCH', body: JSON.stringify(input) })
  }

  submitDailyReport(reportId: string) {
    return this.request<DailyReport>(`/api/daily-reports/${encodeURIComponent(reportId)}/submit`, { method: 'POST' })
  }

  signDailyReport(reportId: string, signedBy: string) {
    return this.request<DailyReport>(`/api/daily-reports/${encodeURIComponent(reportId)}/sign`, { method: 'POST', body: JSON.stringify({ signedBy }) })
  }

  listLidarScans(projectId:string){return this.request<LidarScanSession[]>(`/api/projects/${encodeURIComponent(projectId)}/lidar-scans`)}
  listCalculationLidarScans(calculationId:string){return this.request<LidarScanSession[]>(`/api/calculations/${encodeURIComponent(calculationId)}/lidar-scans`)}
  createLidarScan(projectId:string,input:LidarScanInput&{controlPoints?:LidarControlPoint[];observations?:LidarElementObservation[]}){return this.request<LidarScanSession>(`/api/projects/${encodeURIComponent(projectId)}/lidar-scans`,{method:'POST',body:JSON.stringify(input)})}
  createCalculationLidarScan(calculationId:string,input:LidarScanInput&{controlPoints?:LidarControlPoint[];observations?:LidarElementObservation[]}){return this.request<LidarScanSession>(`/api/calculations/${encodeURIComponent(calculationId)}/lidar-scans`,{method:'POST',body:JSON.stringify(input)})}
  registerLidarScan(scanId:string,controlPoints:LidarControlPoint[],registeredBy:string){return this.request<LidarScanSession>(`/api/lidar-scans/${encodeURIComponent(scanId)}/register`,{method:'POST',body:JSON.stringify({controlPoints,registeredBy})})}
  analyzeLidarScan(scanId:string,observations:LidarElementObservation[]){return this.request<LidarScanSession>(`/api/lidar-scans/${encodeURIComponent(scanId)}/analyze`,{method:'POST',body:JSON.stringify({observations})})}
  approveLidarProposal(scanId:string,proposalId:string,approvedBy:string){return this.request<LidarScanSession>(`/api/lidar-scans/${encodeURIComponent(scanId)}/proposals/${encodeURIComponent(proposalId)}/approve`,{method:'POST',body:JSON.stringify({approvedBy})})}
  createLidarBcfTopic(scanId:string,input:Omit<LidarBcfTopic,'id'|'scanSessionId'|'status'|'createdAt'>){return this.request<LidarScanSession>(`/api/lidar-scans/${encodeURIComponent(scanId)}/bcf-topics`,{method:'POST',body:JSON.stringify(input)})}
  publishLidarAsBuilt(scanId:string,createdBy:string){return this.request<LidarScanSession>(`/api/lidar-scans/${encodeURIComponent(scanId)}/as-built`,{method:'POST',body:JSON.stringify({createdBy})})}
  uploadLidarArtifact(scanId:string,file:File,input:{kind:LidarArtifact['kind'];capturedAt:string}){const body=new FormData();body.append('kind',input.kind);body.append('capturedAt',input.capturedAt);body.append('file',file,file.name);return this.request<LidarScanSession>(`/api/lidar-scans/${encodeURIComponent(scanId)}/artifacts`,{method:'POST',body})}
  async downloadLidarArtifact(scanId:string,artifactId:string){
    const token=await this.tokenProvider?.()
    const response=await this.fetchWithRateLimit(`${this.baseUrl}/api/lidar-scans/${encodeURIComponent(scanId)}/artifacts/${encodeURIComponent(artifactId)}/file`,{headers:{Accept:'*/*',...(token?{Authorization:`Bearer ${token}`}:{})}})
    if(!response.ok){const payload=await response.json().catch(()=>undefined) as {message?:string}|undefined;throw new ApiError(payload?.message??`LiDAR-bewijs kon niet worden geladen (${response.status})`,response.status)}
    return response.blob()
  }
  buildLidarCalculationProposal(scanId:string,elements:LidarSurveyElement[],assignments:LidarWorkAssignment[]){return this.request<LidarScanSession>(`/api/lidar-scans/${encodeURIComponent(scanId)}/calculation-proposal`,{method:'POST',body:JSON.stringify({elements,assignments})})}
  approveLidarCalculationProposal(scanId:string,approvedBy:string){return this.request<LidarScanSession>(`/api/lidar-scans/${encodeURIComponent(scanId)}/calculation-proposal/approve`,{method:'POST',body:JSON.stringify({approvedBy})})}
  applyLidarCalculationProposal(scanId:string){return this.request<LidarScanSession>(`/api/lidar-scans/${encodeURIComponent(scanId)}/calculation-proposal/apply`,{method:'POST'})}

  uploadSitePhoto(reportId: string, file: File, input: SitePhotoInput) {
    const body = new FormData()
    if (input.workPackageId) body.append('workPackageId', input.workPackageId)
    body.append('caption', input.caption)
    body.append('location', input.location)
    body.append('takenAt', input.takenAt)
    body.append('file', file, file.name)
    return this.request<SitePhoto>(`/api/daily-reports/${encodeURIComponent(reportId)}/photos`, { method: 'POST', body })
  }

  async downloadSitePhoto(photoId: string) {
    const token = await this.tokenProvider?.()
    const response = await this.fetcher(`${this.baseUrl}/api/site-photos/${encodeURIComponent(photoId)}/file`, { headers: { Accept: 'image/*', ...(token ? { Authorization: `Bearer ${token}` } : {}) } })
    if (!response.ok) throw new ApiError(`Foto laden mislukt (${response.status})`, response.status)
    return response.blob()
  }

  deleteSitePhoto(photoId: string) {
    return this.request<void>(`/api/site-photos/${encodeURIComponent(photoId)}`, { method: 'DELETE' })
  }

  uploadDocument(projectId: string, file: File, input: DocumentUploadInput) {
    const body = new FormData()
    body.append('title', input.title)
    body.append('category', input.category)
    body.append('notes', input.notes)
    body.append('uploadedBy', input.uploadedBy)
    body.append('file', file, file.name)
    return this.request<ProjectDocument>(`/api/projects/${encodeURIComponent(projectId)}/documents`, { method: 'POST', body })
  }

  uploadDocumentRevision(documentId: string, file: File, input: DocumentRevisionInput) {
    const body = new FormData()
    body.append('notes', input.notes)
    body.append('uploadedBy', input.uploadedBy)
    body.append('file', file, file.name)
    return this.request<ProjectDocument>(`/api/documents/${encodeURIComponent(documentId)}/revisions`, { method: 'POST', body })
  }

  async downloadDocumentVersion(versionId: string) {
    const token = await this.tokenProvider?.()
    const response = await this.fetcher(`${this.baseUrl}/api/document-versions/${encodeURIComponent(versionId)}/file`, { headers: { Accept: '*/*', ...(token ? { Authorization: `Bearer ${token}` } : {}) } })
    if (!response.ok) throw new ApiError(`Documentdownload mislukt (${response.status})`, response.status)
    return response.blob()
  }

  verifyDocumentVersionIntegrity(versionId: string) { return this.request<DocumentIntegrityResult>(`/api/document-versions/${encodeURIComponent(versionId)}/verify-integrity`, { method: 'POST' }) }

  submitDocument(id: string) { return this.request<ProjectDocument>(`/api/documents/${encodeURIComponent(id)}/submit`, { method: 'POST' }) }
  updateDocumentMetadata(id: string, input: DocumentMetadataInput) { return this.request<ProjectDocument>(`/api/documents/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) }) }
  approveDocument(id: string, approvedBy: string) { return this.request<ProjectDocument>(`/api/documents/${encodeURIComponent(id)}/approve`, { method: 'POST', body: JSON.stringify({ approvedBy }) }) }
  distributeDocument(id: string, input: DocumentDistributionInput) { return this.request<ProjectDocument>(`/api/documents/${encodeURIComponent(id)}/distribute`, { method: 'POST', body: JSON.stringify(input) }) }
  markDocumentRead(id: string) { return this.request<DocumentRecipient>(`/api/document-recipients/${encodeURIComponent(id)}/read`, { method: 'POST' }) }
  linkDocumentRecord(documentId: string, input: DocumentRecordLinkInput) { return this.request<ProjectDocument>(`/api/documents/${encodeURIComponent(documentId)}/record-links`, { method: 'POST', body: JSON.stringify(input) }) }
  unlinkDocumentRecord(documentId: string, linkId: string) { return this.request<ProjectDocument>(`/api/documents/${encodeURIComponent(documentId)}/record-links/${encodeURIComponent(linkId)}`, { method: 'DELETE' }) }

  createQhseCertificate(projectId: string, input: QhseCertificateInput) { return this.request<QhseCertificate>(`/api/projects/${encodeURIComponent(projectId)}/qhse-certificates`, { method: 'POST', body: JSON.stringify(input) }) }
  createQhseInspection(projectId: string, input: QhseInspectionInput) { return this.request<QhseInspection>(`/api/projects/${encodeURIComponent(projectId)}/qhse-inspections`, { method: 'POST', body: JSON.stringify(input) }) }
  resolveQhseFinding(inspectionId: string, findingId: string) { return this.request<QhseInspection>(`/api/qhse-inspections/${encodeURIComponent(inspectionId)}/findings/${encodeURIComponent(findingId)}/resolve`, { method: 'POST' }) }
  closeQhseInspection(id: string) { return this.request<QhseInspection>(`/api/qhse-inspections/${encodeURIComponent(id)}/close`, { method: 'POST' }) }

  createChangeOrder(projectId: string, input: ChangeOrderInput) {
    return this.request<ChangeOrder>(`/api/projects/${encodeURIComponent(projectId)}/change-orders`, { method: 'POST', body: JSON.stringify(input) })
  }

  updateChangeOrder(id: string, input: ChangeOrderInput) {
    return this.request<ChangeOrder>(`/api/change-orders/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) })
  }

  calculateChangeOrder(id: string) { return this.request<ChangeOrder>(`/api/change-orders/${encodeURIComponent(id)}/calculate`, { method: 'POST' }) }
  submitChangeOrder(id: string) { return this.request<ChangeOrder>(`/api/change-orders/${encodeURIComponent(id)}/submit`, { method: 'POST' }) }
  approveChangeOrder(id: string, approvedBy: string) { return this.request<ChangeOrder>(`/api/change-orders/${encodeURIComponent(id)}/approve`, { method: 'POST', body: JSON.stringify({ approvedBy }) }) }
  executeChangeOrder(id: string) { return this.request<ChangeOrder>(`/api/change-orders/${encodeURIComponent(id)}/execute`, { method: 'POST' }) }
  readyChangeOrderForInvoice(id: string) { return this.request<ChangeOrder>(`/api/change-orders/${encodeURIComponent(id)}/ready-for-invoice`, { method: 'POST' }) }

  createProgressStatement(projectId: string, input: ProgressStatementInput) { return this.request<ProgressStatement>(`/api/projects/${encodeURIComponent(projectId)}/progress-statements`, { method: 'POST', body: JSON.stringify(input) }) }
  updateProgressStatement(id: string, input: ProgressStatementInput) { return this.request<ProgressStatement>(`/api/progress-statements/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) }) }
  submitProgressStatement(id: string) { return this.request<ProgressStatement>(`/api/progress-statements/${encodeURIComponent(id)}/submit`, { method: 'POST' }) }
  approveProgressStatement(id: string, approvedBy: string) { return this.request<ProgressStatement>(`/api/progress-statements/${encodeURIComponent(id)}/approve`, { method: 'POST', body: JSON.stringify({ approvedBy }) }) }
  createSalesInvoice(id: string, input: SalesInvoiceInput) { return this.request<{ statement: ProgressStatement; invoice: SalesInvoice }>(`/api/progress-statements/${encodeURIComponent(id)}/invoice`, { method: 'POST', body: JSON.stringify(input) }) }
  issueSalesInvoice(id: string, input: SalesInvoiceIssueInput) { return this.request<SalesInvoice>(`/api/sales-invoices/${encodeURIComponent(id)}/issue`, { method: 'POST', body: JSON.stringify(input) }) }
  validateSalesInvoicePeppol(id: string) { return this.request<PeppolValidationReport>(`/api/sales-invoices/${encodeURIComponent(id)}/peppol-validation`, { method: 'POST' }) }
  sendSalesInvoicePeppol(id: string) { return this.request<PeppolDelivery>(`/api/sales-invoices/${encodeURIComponent(id)}/peppol-delivery`, { method: 'POST' }) }
  refreshSalesInvoicePeppolStatus(id: string) { return this.request<PeppolDelivery>(`/api/sales-invoices/${encodeURIComponent(id)}/peppol-status`, { method: 'POST' }) }
  startPeppolAcceptance(id: string) { return this.request<PeppolAcceptanceResult>(`/api/sales-invoices/${encodeURIComponent(id)}/peppol-acceptance`, { method: 'POST', body: JSON.stringify({ confirmNetworkSend: true }) }) }
  releasePeppolAcceptance(id: string, input: PeppolAcceptanceReleaseInput) { return this.request<PeppolAcceptanceRun>(`/api/peppol-acceptance-runs/${encodeURIComponent(id)}/release`, { method: 'POST', body: JSON.stringify(input) }) }
  async downloadPeppolAcceptancePdf(id: string) {
    const token = await this.tokenProvider?.()
    const response = await this.fetcher(`${this.baseUrl}/api/peppol-acceptance-runs/${encodeURIComponent(id)}/pdf`, { headers: { Accept: 'application/pdf', ...(token ? { Authorization: `Bearer ${token}` } : {}) } })
    if (!response.ok) throw new ApiError(`Acceptatierapport downloaden mislukt (${response.status})`, response.status)
    return response.blob()
  }
  acknowledgePeppolAlert(id: string) { return this.request<PeppolAlert>(`/api/peppol-alerts/${encodeURIComponent(id)}/acknowledge`, { method: 'POST' }) }
  registerSalesPayment(id: string, input: PaymentRegistrationInput) { return this.request<SalesInvoice>(`/api/sales-invoices/${encodeURIComponent(id)}/payment`, { method: 'POST', body: JSON.stringify(input) }) }
  createProjectCost(projectId: string, input: ProjectCostInput) { return this.request<ProjectCost>(`/api/projects/${encodeURIComponent(projectId)}/costs`, { method: 'POST', body: JSON.stringify(input) }) }
  settleCommitment(id: string, input: CommitmentSettlementInput) { return this.request<{ commitment: ProjectCost; actualCost: ProjectCost }>(`/api/project-costs/${encodeURIComponent(id)}/settle`, { method: 'POST', body: JSON.stringify(input) }) }
  createProjectForecast(projectId: string, input: ProjectForecastInput) { return this.request<ProjectForecast>(`/api/projects/${encodeURIComponent(projectId)}/forecasts`, { method: 'POST', body: JSON.stringify(input) }) }
  approveProjectForecast(id:string){return this.request<ProjectForecast>(`/api/project-forecasts/${encodeURIComponent(id)}/approve`,{method:'POST'})}
  createSupplier(input: SupplierInput) { return this.request<Supplier>('/api/suppliers', { method: 'POST', body: JSON.stringify(input) }) }
  createAsset(input: AssetInput) { return this.request<Asset>('/api/assets', { method: 'POST', body: JSON.stringify(input) }) }
  addAssetOperation(id:string,input:AssetOperationalInput) { return this.request<Asset>(`/api/assets/${encodeURIComponent(id)}/operations`,{method:'POST',body:JSON.stringify(input)}) }
  createWarehouse(input: WarehouseInput) { return this.request<Warehouse>('/api/warehouses', { method: 'POST', body: JSON.stringify(input) }) }
  createInventoryItem(input: InventoryItemInput) { return this.request<InventoryItem>('/api/inventory-items', { method: 'POST', body: JSON.stringify(input) }) }
  countInventory(id:string,input:InventoryCountInput){return this.request<{item:InventoryItem;movement?:StockMovement}>(`/api/inventory-items/${encodeURIComponent(id)}/count`,{method:'POST',body:JSON.stringify(input)})}
  registerStockMovement(input: StockMovementInput) { return this.request<{ item: InventoryItem; movement: StockMovement }>('/api/stock-movements', { method: 'POST', body: JSON.stringify(input) }) }
  createEmployee(input: EmployeeInput) { return this.request<Employee>('/api/employees', { method:'POST', body:JSON.stringify(input) }) }
  createEmployeeCrew(input: EmployeeCrewInput) { return this.request<EmployeeCrew>('/api/employee-crews', { method:'POST', body:JSON.stringify(input) }) }
  createEmployeeAbsence(input: EmployeeAbsenceInput) { return this.request<EmployeeAbsence>('/api/employee-absences', { method:'POST', body:JSON.stringify(input) }) }
  decideEmployeeAbsence(id:string,input:EmployeeAbsenceDecisionInput) { return this.request<EmployeeAbsence>(`/api/employee-absences/${encodeURIComponent(id)}/decision`, { method:'POST', body:JSON.stringify(input) }) }
  createSubcontractor(input: SubcontractorInput) { return this.request<Subcontractor>('/api/subcontractors', { method:'POST', body:JSON.stringify(input) }) }
  inviteSubcontractor(id:string) { return this.request<Subcontractor>(`/api/subcontractors/${encodeURIComponent(id)}/invite`, { method:'POST' }) }
  addSubcontractorOperation(id:string,input:SubcontractorOperationInput){return this.request<Subcontractor>(`/api/subcontractors/${encodeURIComponent(id)}/operations`,{method:'POST',body:JSON.stringify(input)})}
  decideSubcontractorProgress(id:string,progressId:string,status:'Goedgekeurd'|'Afgewezen'){return this.request<Subcontractor>(`/api/subcontractors/${encodeURIComponent(id)}/progress/${encodeURIComponent(progressId)}/decision`,{method:'POST',body:JSON.stringify({status})})}
  createQhseEvent(input: QhseEventInput) { return this.request<QhseEvent>('/api/qhse-events', { method:'POST', body:JSON.stringify(input) }) }
  closeQhseEvent(id:string) { return this.request<QhseEvent>(`/api/qhse-events/${encodeURIComponent(id)}/close`, { method:'POST' }) }
  createWorkTicket(input:WorkTicketInput) { return this.request<WorkTicket>('/api/work-tickets',{method:'POST',body:JSON.stringify(input)}) }
  submitWorkTicket(id:string) { return this.request<WorkTicket>(`/api/work-tickets/${encodeURIComponent(id)}/submit`,{method:'POST'}) }
  signWorkTicket(id:string,signedBy:string) { return this.request<WorkTicket>(`/api/work-tickets/${encodeURIComponent(id)}/sign`,{method:'POST',body:JSON.stringify({signedBy})}) }
  createTimeEntry(input:TimeEntryInput) { return this.request<TimeEntry>('/api/time-entries',{method:'POST',body:JSON.stringify(input)}) }
  submitTimeEntry(id:string) { return this.request<TimeEntry>(`/api/time-entries/${encodeURIComponent(id)}/submit`,{method:'POST'}) }
  decideTimeEntry(id:string,decision:'Goedgekeurd'|'Geweigerd',reason?:string) { return this.request<TimeEntry>(`/api/time-entries/${encodeURIComponent(id)}/decision`,{method:'POST',body:JSON.stringify({decision,reason})}) }
  configureCheckinatworkSite(input:CheckinatworkSiteInput) { return this.request<CheckinatworkSite>('/api/checkinatwork/sites',{method:'PUT',body:JSON.stringify(input)}) }
  createCheckinatworkParticipant(input:CheckinatworkParticipantInput) { return this.request<CheckinatworkParticipant>('/api/checkinatwork/participants',{method:'POST',body:JSON.stringify(input)}) }
  registerCheckinatworkPresence(input:CheckinatworkRegistrationInput) { return this.request<CheckinatworkRegistration>('/api/checkinatwork/registrations',{method:'POST',body:JSON.stringify(input)}) }
  cancelCheckinatworkPresence(id:string,reason:CheckinatworkCancellationReason) { return this.request<CheckinatworkRegistration>(`/api/checkinatwork/registrations/${encodeURIComponent(id)}/cancel`,{method:'POST',body:JSON.stringify({reason})}) }
  createProjectClaim(input:ProjectClaimInput) { return this.request<ProjectClaim>('/api/project-claims',{method:'POST',body:JSON.stringify(input)}) }
  transitionProjectClaim(id:string,action:'approve'|'submit'|'accept'|'reject',notes?:string) { return this.request<ProjectClaim>(`/api/project-claims/${encodeURIComponent(id)}/transition`,{method:'POST',body:JSON.stringify({action,notes})}) }
  createJointVenture(input:JointVentureInput) { return this.request<JointVenture>('/api/joint-ventures',{method:'POST',body:JSON.stringify(input)}) }
  createIntegrationConnection(input:IntegrationConnectionInput) { return this.request<IntegrationConnection>('/api/integration-connections',{method:'POST',body:JSON.stringify(input)}) }
  testIntegrationConnection(id:string) { return this.request<IntegrationConnection>(`/api/integration-connections/${encodeURIComponent(id)}/test`,{method:'POST'}) }
  createIntegrationJob(input:IntegrationJobInput) { return this.request<IntegrationJob>('/api/integration-jobs',{method:'POST',body:JSON.stringify(input)}) }
  processIntegrationJob(id:string) { return this.request<IntegrationJob>(`/api/integration-jobs/${encodeURIComponent(id)}/process`,{method:'POST'}) }
  createAiAnalysis(projectId:string,input:AiAnalysisInput) { return this.request<AiAnalysis>(`/api/projects/${encodeURIComponent(projectId)}/ai-analyses`,{method:'POST',body:JSON.stringify(input)}) }
  approveAiAnalysis(id:string,approvedBy:string) { return this.request<AiAnalysis>(`/api/ai-analyses/${encodeURIComponent(id)}/approve`,{method:'POST',body:JSON.stringify({approvedBy})}) }
  priceIndexCatalogue(refresh=false) { return this.request<PriceIndexCatalogue>(`/api/price-indexes${refresh?'?refresh=true':''}`) }
  createProjectContract(projectId:string,input:ProjectContractInput) { return this.request<ProjectContract>(`/api/projects/${encodeURIComponent(projectId)}/contracts`,{method:'POST',body:JSON.stringify(input)}) }
  updateProjectContract(contractId:string,input:ProjectContractUpdateInput) { return this.request<ProjectContract>(`/api/contracts/${encodeURIComponent(contractId)}`,{method:'PATCH',body:JSON.stringify(input)}) }
  submitProjectContract(contractId:string) { return this.request<ProjectContract>(`/api/contracts/${encodeURIComponent(contractId)}/submit`,{method:'POST'}) }
  approveProjectContract(contractId:string) { return this.request<ProjectContract>(`/api/contracts/${encodeURIComponent(contractId)}/approve`,{method:'POST'}) }
  completeContractObligation(contractId:string,obligationId:string) { return this.request<ProjectContract>(`/api/contracts/${encodeURIComponent(contractId)}/obligations/${encodeURIComponent(obligationId)}/complete`,{method:'POST'}) }
  createProjectCloseout(projectId:string,input:ProjectCloseoutInput) { return this.request<ProjectCloseout>(`/api/projects/${encodeURIComponent(projectId)}/closeouts`,{method:'POST',body:JSON.stringify(input)}) }
  updateProjectCloseout(closeoutId:string,input:ProjectCloseoutUpdateInput) { return this.request<ProjectCloseout>(`/api/closeouts/${encodeURIComponent(closeoutId)}`,{method:'PATCH',body:JSON.stringify(input)}) }
  customerSignProjectCloseout(closeoutId:string) { return this.request<ProjectCloseout>(`/api/closeouts/${encodeURIComponent(closeoutId)}/customer-sign`,{method:'POST'}) }
  addCloseoutItem(closeoutId:string,input:Omit<CloseoutItem,'id'|'status'|'resolvedAt'>) { return this.request<ProjectCloseout>(`/api/closeouts/${encodeURIComponent(closeoutId)}/items`,{method:'POST',body:JSON.stringify(input)}) }
  resolveCloseoutItem(closeoutId:string,itemId:string) { return this.request<ProjectCloseout>(`/api/closeouts/${encodeURIComponent(closeoutId)}/items/${encodeURIComponent(itemId)}/resolve`,{method:'POST'}) }
  addServiceRequest(closeoutId:string,input:ServiceRequestInput) { return this.request<ProjectCloseout>(`/api/closeouts/${encodeURIComponent(closeoutId)}/service-requests`,{method:'POST',body:JSON.stringify(input)}) }
  resolveServiceRequest(closeoutId:string,requestId:string) { return this.request<ProjectCloseout>(`/api/closeouts/${encodeURIComponent(closeoutId)}/service-requests/${encodeURIComponent(requestId)}/resolve`,{method:'POST'}) }
  createProcurementRequest(projectId: string, input: ProcurementRequestInput) { return this.request<ProcurementRequest>(`/api/projects/${encodeURIComponent(projectId)}/procurement-requests`, { method: 'POST', body: JSON.stringify(input) }) }
  issuePriceRequest(id: string) { return this.request<ProcurementRequest>(`/api/procurement-requests/${encodeURIComponent(id)}/issue`, { method: 'POST' }) }
  createSupplierFrameworkAgreement(id: string, input: SupplierFrameworkAgreementInput) { return this.request<Supplier>(`/api/suppliers/${encodeURIComponent(id)}/framework-agreements`, { method: 'POST', body: JSON.stringify(input) }) }
  approveProcurementRequest(id:string){return this.request<ProcurementRequest>(`/api/procurement-requests/${encodeURIComponent(id)}/approve`,{method:'POST'})}
  addSupplierQuote(id: string, input: SupplierQuoteInput) { return this.request<ProcurementRequest>(`/api/procurement-requests/${encodeURIComponent(id)}/quotes`, { method: 'POST', body: JSON.stringify(input) }) }
  selectSupplierQuote(id: string, quoteId: string) { return this.request<{ request: ProcurementRequest; order: PurchaseOrder; commitment: ProjectCost }>(`/api/procurement-requests/${encodeURIComponent(id)}/quotes/${encodeURIComponent(quoteId)}/select`, { method: 'POST' }) }
  receivePurchaseOrder(id: string, input: PurchaseReceiptInput) { return this.request<PurchaseOrder>(`/api/purchase-orders/${encodeURIComponent(id)}/receive`, { method: 'POST', body: JSON.stringify(input) }) }
  async downloadPurchaseOrderPdf(id: string) {
    const token = await this.tokenProvider?.()
    const response = await this.fetcher(`${this.baseUrl}/api/purchase-orders/${encodeURIComponent(id)}/pdf`, { headers: { Accept: 'application/pdf', ...(token ? { Authorization: `Bearer ${token}` } : {}) } })
    if (!response.ok) throw new ApiError(`Bestelbon-download mislukt (${response.status})`, response.status)
    return response.blob()
  }
  matchPurchaseInvoice(id: string, input: PurchaseInvoiceMatchInput) { return this.request<PurchaseInvoiceMatchResult>(`/api/purchase-orders/${encodeURIComponent(id)}/match-invoice`, { method: 'POST', body: JSON.stringify(input) }) }
  approvePurchaseInvoiceDeviation(id: string, reason: string) { return this.request<PurchaseInvoiceMatchResult>(`/api/purchase-orders/${encodeURIComponent(id)}/approve-deviation`, { method: 'POST', body: JSON.stringify({ reason }) }) }
  registerPurchasePayment(id: string, input: PaymentRegistrationInput) { return this.request<PurchaseOrder>(`/api/purchase-orders/${encodeURIComponent(id)}/payment`, { method: 'POST', body: JSON.stringify(input) }) }

  async offlineQueueSize() { return canQueueOffline() ? countQueuedMutations(await this.offlineScope()) : 0 }

  async flushOfflineQueue() {
    if (!canQueueOffline()) return { completed: 0, pending: 0, blocked: 0 }
    const scope = await this.offlineScope()
    const mutations = await queuedMutations(scope)
    let completed = 0
    for (const mutation of mutations.filter(item => item.status === 'pending')) {
      try {
        const token = await this.tokenProvider?.()
        let replayBody: BodyInit | undefined = mutation.body
        if (mutation.formData) {
          const restored = new FormData()
          for (const entry of mutation.formData) {
            if (typeof entry.value === 'string') restored.append(entry.name, entry.value)
            else restored.append(entry.name, entry.value, entry.fileName)
          }
          replayBody = restored
        }
        const response = await this.fetcher(mutation.url, { method: mutation.method, body: replayBody, headers: { ...mutation.headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) } })
        if (response.ok) {
          const responseEtag = response.headers.get('ETag')
          if (responseEtag) this.revisionEtag = responseEtag
          await removeQueuedMutation(mutation.id)
          completed += 1
          continue
        }
        const message = (await response.json().catch(() => undefined) as { message?: string } | undefined)?.message ?? `HTTP ${response.status}`
        if (response.status === 401 || response.status === 403 || response.status >= 500 || response.status === 409) {
          await updateQueuedMutation({ ...mutation, attempts: mutation.attempts + 1, lastError: message })
          break
        }
        await updateQueuedMutation({ ...mutation, attempts: mutation.attempts + 1, status: 'blocked', lastError: message })
      } catch (error) {
        await updateQueuedMutation({ ...mutation, attempts: mutation.attempts + 1, lastError: error instanceof Error ? error.message : 'Netwerkfout' })
        break
      }
    }
    const remaining = await queuedMutations(scope)
    return { completed, pending: remaining.filter(item => item.status === 'pending').length, blocked: remaining.filter(item => item.status === 'blocked').length }
  }

  private upload<T>(path: string, file: File) {
    const body = new FormData()
    body.append('file', file, file.name)
    return this.request<T>(path, { method: 'POST', body })
  }

  private async fetchWithRateLimit(url:string,init:RequestInit){
    let response:Response
    for(let attempt=0;;attempt+=1){
      response=await this.fetcher(url,init)
      if(response.status!==429||attempt>=1)return response
      const raw=response.headers.get('Retry-After')?.trim()
      const seconds=raw&&/^\d+$/.test(raw)?Number(raw):1
      await new Promise(resolve=>globalThis.setTimeout(resolve,Math.min(60,Math.max(0,seconds))*1_000))
    }
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await this.tokenProvider?.()
    const method = (init.method ?? 'GET').toUpperCase()
    const mutating = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)
    const idempotencyKey = mutating ? globalThis.crypto.randomUUID() : undefined
    const headers = {
      Accept: 'application/json',
      ...(init.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      ...(mutating && this.revisionEtag ? { 'If-Match': this.revisionEtag } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(this.demoUserId ? { 'X-BouwFlow-Demo-User': this.demoUserId } : {}),
      ...init.headers,
    }
    const url = `${this.baseUrl}${path}`
    let response: Response
    try {
      response = await this.fetchWithRateLimit(url, { ...init, headers })
    } catch (error) {
      if (!mutating || !init.body || !idempotencyKey || !canQueueOffline()) throw error
      const formData = init.body instanceof FormData
        ? [...init.body.entries()].map(([name, value]) => ({ name, value, ...(typeof value === 'string' ? {} : { fileName: value.name }) }))
        : undefined
      if (typeof init.body !== 'string' && !formData) throw error
      const persistedHeaders = Object.fromEntries(Object.entries(headers).filter(([name, value]) => name.toLocaleLowerCase() !== 'authorization' && typeof value === 'string'))
      await enqueueMutation({ id: idempotencyKey, scope: await this.offlineScope(token), url, method, headers: persistedHeaders, ...(typeof init.body === 'string' ? { body: init.body } : {}), ...(formData ? { formData } : {}), createdAt: new Date().toISOString(), attempts: 0, status: 'pending' })
      throw new OfflineMutationQueuedError(idempotencyKey)
    }
    const responseEtag = response.headers.get('ETag')
    if (responseEtag) this.revisionEtag = responseEtag
    if (!response.ok) {
      const payload = await response.json().catch(() => undefined) as { message?: string; details?: unknown } | undefined
      throw new ApiError(payload?.message ?? `API-aanvraag mislukt (${response.status})`, response.status, payload?.details)
    }
    if (response.status === 204) return undefined as T
    return response.json() as Promise<T>
  }
}

export class ApiError extends Error {
  readonly status: number
  readonly details?: unknown

  constructor(message: string, status: number, details?: unknown) {
    super(message)
    this.status = status
    this.details = details
  }
}

export class OfflineMutationQueuedError extends Error {
  readonly queueId: string
  constructor(queueId: string) { super('Wijziging offline bewaard en wordt automatisch gesynchroniseerd zodra de verbinding terug is.'); this.queueId = queueId }
}
