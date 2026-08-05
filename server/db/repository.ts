import { createHash, randomUUID } from 'node:crypto'
import type { Pool, PoolClient, QueryResultRow } from 'pg'
import { DEFAULT_COST_LIBRARY_VERSION_ID, changeOrderTotal, directCost, normalizeTenderDossier, postCalculationAnalysis, scenarioDirectCost, scenarioSellingTotal, sellingTotal, unitConversionFactor, type BoqChapter, type BoqImportPreview, type BoqItem, type BoqPriceAdjustment, type BouwFlowState, type BulkCostUpdateResult, type BulkPriceAdjustmentResult, type Calculation, type CalculationScenario, type CalculationTemplate, type CalculationVersion, type ChangeOrder, type ChangeOrderInput, type CommitmentSettlementInput, type CompanyBranch, type CompanyBranchInput, type CompanyUser, type CompanyUserAccessInput, type CompanyUserProfileInput, type CostCategory, type CostLibrary, type CostLibraryItem, type CostLibraryVersion, type DailyLaborEntry, type DailyProductionEntry, type DailyReport, type DailyReportInput, type DailyResourceEntry, type DocumentDistributionInput, type DocumentIntegrityResult, type DocumentMetadataInput, type DocumentRecipient, type DocumentRevisionInput, type DocumentUploadInput, type DocumentVersion, type IntercompanyCharge, type IntercompanyChargeInput, type LegalEntity, type LegalEntityFinancialInput, type LegalEntityInput, type MailboxLinkInput, type MailboxMessage, type MailboxOverview, type Opportunity, type OpportunityDetailsInput, type OpportunityGoNoGo, type OpportunityGoNoGoInput, type Organization, type OrganizationBillingInput, type PaymentRegistrationInput, type PeppolAcceptanceReleaseInput, type PeppolAcceptanceRun, type PeppolAcceptanceStep, type PeppolAlert, type PeppolDelivery, type PeppolIntegrationCheck, type PeppolNotification, type PeppolNotificationChannel, type PeppolNotificationSettings, type PeppolNotificationSettingsInput, type PeppolNotificationTestInput, type PeppolNotificationTestResult, type PeppolProductionGate, type PeppolValidationReport, type PeppolValidationReportInput, type PlanningActivity, type PostCalculationFeedbackInput, type ProcurementRequest, type ProcurementRequestInput, type ProgressStatement, type ProgressStatementInput, type Project, type ProjectBaselineInput, type ProjectCompanyAssignmentInput, type ProjectCost, type ProjectCostInput, type ProjectDetailsInput, type ProjectDocument, type ProjectForecast, type ProjectForecastInput, type ProjectHandover, type ProjectPlanning, type ProjectPlanningInput, type ProjectStartupInput, type ProjectWorkPackage, type PurchaseInvoiceMatchInput, type PurchaseOrder, type PurchaseReceiptInput, type QhseCertificate, type QhseCertificateInput, type QhseFinding, type QhseInspection, type QhseInspectionInput, type Quote, type QuoteContent, type QuoteSnapshot, type SalesInvoice, type SalesInvoiceInput, type SalesInvoiceIssueInput, type SitePhoto, type SitePhotoInput, type Supplier, type SupplierInput, type SupplierQuoteInput, type UnitConversion, type UnitDefinition, type WorkflowDefinition, type WorkflowDefinitionInput } from '../../src/domain.js'
import { buildDailyReportEvidence, buildMeetstaatEvidence, workPackageBoqItems } from '../../src/progress-measurements.js'
import { calculateContractPriceRevision } from '../../src/price-revision.js'
import { defaultWorkflowDefinitions } from '../../src/administration.js'
import type { InvoiceExportContext } from '../../src/invoice-export.js'
import { boqItemQuantity, effectiveBoqValues, unitCost } from '../../src/domain.js'
import type { CrmActivity, DocumentRecordLink, DocumentRecordLinkInput, OrganizationInput, OrganizationRelation, QuoteWorkflow, TenderDossier } from '../../src/domain.js'
import type { WorkflowCorrection, WorkflowCorrectionInput, WorkflowCorrectionResult } from '../../src/domain.js'
import type { Asset, AssetInput, AssetOperationalInput, InventoryCountInput, InventoryItem, InventoryItemInput, StockMovement, StockMovementInput, Warehouse, WarehouseInput } from '../../src/domain.js'
import type { AiAnalysis, AiAnalysisInput, CheckinatworkAuditEvent, CheckinatworkCancellationReason, CheckinatworkParticipant, CheckinatworkParticipantInput, CheckinatworkRegistration, CheckinatworkRegistrationInput, CheckinatworkSite, CheckinatworkSiteInput, Employee, EmployeeAbsence, EmployeeAbsenceDecisionInput, EmployeeAbsenceInput, EmployeeCrew, EmployeeCrewInput, EmployeeInput, IntegrationConnection, IntegrationConnectionInput, IntegrationJob, IntegrationJobInput, JointVenture, JointVentureInput, ProjectClaim, ProjectClaimInput, ProjectCloseout, ProjectCloseoutInput, ProjectCloseoutUpdateInput, ProjectContract, ProjectContractInput, ProjectContractUpdateInput, QhseEvent, QhseEventInput, ServiceRequestInput, Subcontractor, SubcontractorInput, SubcontractorOperationInput, TimeEntry, TimeEntryInput, WorkTicket, WorkTicketInput } from '../../src/domain.js'
import { DevelopmentAiGateway, DevelopmentIntegrationGateway, type AiGateway, type IntegrationGateway } from '../enterprise-gateways.js'
import type { PeppolTransportResult } from '../peppol/access-point.js'
import type { PeppolNotificationTarget } from '../peppol/notification.js'
import type { CentralMailMessage } from '../microsoft365-mail.js'
import type { PriceIndexProvider } from '../price-index-service.js'
import { CheckinatworkGatewayError, SimulationCheckinatworkGateway, type CheckinatworkGateway } from '../checkinatwork-gateway.js'
import { analyzeLidarObservations, approveLidarProposal, buildAsBuiltRevision, buildLidarProgressProposals, createLidarBcfTopic, registerLidarScan, type LidarArtifact, type LidarBcfTopic, type LidarControlPoint, type LidarElementObservation, type LidarScanInput, type LidarScanSession } from '../../src/lidar-bim.js'
import { approveLidarCalculationProposal, buildLidarCalculationProposal, type LidarSurveyElement, type LidarWorkAssignment } from '../../src/lidar-calculation.js'

const workflowCorrectionSequences: Record<WorkflowCorrectionInput['dossierType'], string[]> = {
  opportunity: ['Nieuw','Gekwalificeerd','Go/No-Go','Calculatie','Offerte verstuurd','Onderhandeling','Gewonnen'],
  document: ['Concept','Ter goedkeuring','Goedgekeurd'],
  contract: ['Concept','Ter goedkeuring','Goedgekeurd'],
  'daily-report': ['Concept','Ingediend','Ondertekend'],
  'change-order': ['Vastgesteld','Berekend','Ter goedkeuring','Goedgekeurd','Uitgevoerd','Klaar voor facturatie'],
  'progress-statement': ['Concept','Ingediend','Goedgekeurd','Factuurconcept','Gefactureerd'],
  'employee-absence': ['Aangevraagd','Goedgekeurd'],
  'time-entry': ['Concept','Ingediend','Goedgekeurd'],
  'project-claim': ['Concept','Intern goedgekeurd','Ingediend','In behandeling','Aanvaard'],
  'qhse-inspection': ['Open','In behandeling','Gesloten'],
}
import type { RequestContext } from '../context.js'
import type { ObjectStorage } from '../storage.js'

type SqlClient = Pick<PoolClient, 'query'>

interface OrganizationRow extends QueryResultRow {
  id: string; name: string; type: 'Overheid' | 'Privaat' | 'Nutsbedrijf'; contact_name: string; email: string; vat_number: string; address_line: string; postal_code: string; city: string; country_code: string; peppol_endpoint_id: string; peppol_scheme_id: string; roles: NonNullable<Organization['roles']> | string; contacts: NonNullable<Organization['contacts']> | string; addresses: NonNullable<Organization['addresses']> | string; activities: NonNullable<Organization['activities']> | string; relations: NonNullable<Organization['relations']> | string
}

interface OperationsStateRow extends QueryResultRow {
  assets: Asset[] | string
  warehouses: Warehouse[] | string
  inventory_items: InventoryItem[] | string
  stock_movements: StockMovement[] | string
}

interface BlueprintStateRow extends QueryResultRow {
  subcontractors: Subcontractor[] | string
  qhse_events: QhseEvent[] | string
  joint_ventures: JointVenture[] | string
  integration_connections: IntegrationConnection[] | string
  integration_jobs: IntegrationJob[] | string
  ai_analyses: AiAnalysis[] | string
  project_contracts: ProjectContract[] | string
  project_closeouts: ProjectCloseout[] | string
  employees: Employee[] | string
  employee_absences: EmployeeAbsence[] | string
  employee_crews: EmployeeCrew[] | string
  work_tickets: WorkTicket[] | string
  time_entries: TimeEntry[] | string
  project_claims: ProjectClaim[] | string
  workflow_definitions: WorkflowDefinition[] | string
}

interface CheckinatworkStateRow extends QueryResultRow {
  sites: CheckinatworkSite[] | string
  participants: CheckinatworkParticipant[] | string
  registrations: CheckinatworkRegistration[] | string
  audit_events: CheckinatworkAuditEvent[] | string
}

interface LegalEntityRow extends QueryResultRow {
  id: string; name: string; vat_number: string; country: string; currency: string; active: boolean; invoice_prefix: string; next_invoice_number: number; default_vat_pct: string; iban: string; bic: string; payment_terms_days: number; address_line: string; postal_code: string; city: string; country_code: string; peppol_endpoint_id: string; peppol_scheme_id: string; created_at: string | Date
}

interface CompanyBranchRow extends QueryResultRow {
  id: string; legal_entity_id: string; name: string; address: string; country: string; created_at: string | Date
}

interface CompanyUserRow extends QueryResultRow {
  id: string; display_name: string; email: string; role: string; roles:string[]|string; status:string; employee_id:string|null; organization_id:string|null; subcontractor_id:string|null; supplier_id:string|null; all_legal_entities: boolean; all_projects:boolean
}

interface UserEntityAccessRow extends QueryResultRow {
  user_id: string; legal_entity_id: string
}
interface UserProjectAccessRow extends QueryResultRow { user_id:string; project_id:string }
interface MailboxMessageRow extends QueryResultRow {
  id:string; provider_message_id:string; internet_message_id:string|null; conversation_id:string|null; direction:MailboxMessage['direction']; from_name:string; from_address:string;
  to_recipients:MailboxMessage['toRecipients']|string; cc_recipients:MailboxMessage['ccRecipients']|string; subject:string; body_preview:string; received_at:string|Date|null; sent_at:string|Date|null;
  is_read:boolean; has_attachments:boolean; web_link:string|null; organization_id:string|null; opportunity_id:string|null; project_id:string|null; synchronized_at:string|Date
}

interface OpportunityRow extends QueryResultRow {
  id: string; project_number: string; title: string; organization_id: string; location: string; deadline: string | Date
  estimated_value: string; probability: number; stage: Opportunity['stage']; recognition: string; go_no_go: OpportunityGoNoGo | string | null; tender: Opportunity['tender'] | string | null; legal_entity_id: string | null; branch_id: string | null
}

interface CalculationRow extends QueryResultRow {
  id: string; number: string; opportunity_id: string; status: Calculation['status']; overhead_pct: string; risk_pct: string; margin_pct: string; site_overhead_pct: string; escalation_pct: string; discount_pct: string; rounding_step: string; updated_at: string | Date
}

interface BoqItemRow extends QueryResultRow {
  id: string; calculation_id: string; chapter_id: string | null; code: string; description: string; quantity: string; unit: string
  labor: string; material: string; equipment: string; subcontracting: string
  cost_applications: BoqItem['costApplications'] | string
  advanced: Partial<BoqItem> | string
  sort_order: number
}

interface CostLibraryItemRow extends QueryResultRow {
  id: string; library_version_id: string | null; code: string; name: string; category: CostCategory; unit: string; unit_cost: string; source: string; updated_at: string | Date
}

interface CostLibraryRow extends QueryResultRow { id: string; name: string; description: string; active: boolean; legal_entity_id: string | null; branch_id: string | null; created_at: string | Date }
interface CostLibraryVersionRow extends QueryResultRow { id: string; library_id: string; version: number; label: string; status: CostLibraryVersion['status']; effective_from: string | Date; created_at: string | Date }
interface UnitDefinitionRow extends QueryResultRow { id: string; code: string; name: string; category: UnitDefinition['category']; active: boolean; created_at: string | Date }
interface UnitConversionRow extends QueryResultRow { id: string; from_unit_id: string; to_unit_id: string; factor: number; created_at: string | Date }

interface BoqChapterRow extends QueryResultRow {
  id: string; calculation_id: string; code: string; name: string; sort_order: number
  parent_chapter_id: string | null; responsible_user_id: string | null; workflow_status: BoqChapter['workflowStatus']
}

interface CalculationVersionRow extends QueryResultRow {
  id: string; calculation_id: string; version: number; label: string; reason: string; snapshot: Calculation; created_at: string | Date; created_by: string
}

interface CalculationScenarioRow extends QueryResultRow {
  id: string; calculation_id: string; name: string; description: string
  labor_adjustment_pct: string; material_adjustment_pct: string; equipment_adjustment_pct: string; subcontracting_adjustment_pct: string
  overhead_pct: string; risk_pct: string; margin_pct: string; is_selected: boolean; updated_at: string | Date
}

interface QuoteRow extends QueryResultRow {
  id: string; number: string; calculation_id: string; scenario_id: string | null; version: number; total: string
  content: QuoteContent | string; snapshot: QuoteSnapshot | string; workflow: Quote['workflow'] | string | null; created_at: string | Date
}

interface ProjectRow extends QueryResultRow {
  id: string; number: string; name: string; organization_id: string; source_calculation_id: string
  legal_entity_id: string | null; branch_id: string | null
  contract_value: string; cost_budget: string; margin_pct: string; progress: string; status: Project['status']
  handover: ProjectHandover | string; work_packages: ProjectWorkPackage[] | string
  planning: ProjectPlanning | string
}

interface DailyReportRow extends QueryResultRow {
  id: string; project_id: string; report_date: string | Date; work_package_id: string | null; weather: DailyReport['weather']; temperature: string
  activities: string; labor_entries: DailyLaborEntry[] | string; subcontractors: string[] | string; materials: DailyResourceEntry[] | string; machines: DailyResourceEntry[] | string; production_entries: DailyProductionEntry[] | string
  deliveries: string; delays: string; problems: string; visitors: string; notes: string; status: DailyReport['status']; created_at: string | Date
  submitted_at: string | Date | null; signed_by: string | null; signed_at: string | Date | null
}

interface SitePhotoRow extends QueryResultRow {
  id: string; project_id: string; daily_report_id: string; work_package_id: string | null; storage_key: string; file_name: string; mime_type: string; size_bytes: number
  caption: string; location: string; taken_at: string | Date; created_at: string | Date
}

interface DocumentRow extends QueryResultRow {
  id: string; project_id: string; legal_entity_id: string | null; sales_invoice_id: string | null; peppol_acceptance_run_id: string | null; title: string; category: ProjectDocument['category']; status: ProjectDocument['status']; immutable: boolean; current_version_id: string
  approved_by: string | null; approved_at: string | Date | null; created_at: string | Date
}

interface DocumentVersionRow extends QueryResultRow {
  id: string; document_id: string; revision: number; revision_label: string; storage_key: string; file_name: string; mime_type: string; size_bytes: number
  content_digest: string | null; notes: string; uploaded_by: string; created_at: string | Date; superseded_at: string | Date | null
}

interface DocumentRecipientRow extends QueryResultRow {
  id: string; document_id: string; version_id: string; name: string; email: string; delivered_at: string | Date; read_at: string | Date | null
}

interface DocumentRecordLinkRow extends QueryResultRow {
  id: string; document_id: string; link_type: DocumentRecordLink['type']; record_id: string; label: string; created_by: string; created_at: string | Date
}

interface QhseCertificateRow extends QueryResultRow {
  id: string; project_id: string; holder_type: QhseCertificate['holderType']; holder_id: string | null; holder_name: string; certificate_type: string; certificate_number: string
  issued_on: string | Date | null; expires_on: string | Date; document_id: string | null; created_at: string | Date
}

interface QhseInspectionRow extends QueryResultRow {
  id: string; project_id: string; inspection_date: string | Date; inspection_type: QhseInspection['type']; inspector: string; location: string; notes: string
  findings: QhseFinding[] | string; status: QhseInspection['status']; created_at: string | Date; closed_at: string | Date | null
}

interface ChangeOrderRow extends QueryResultRow {
  id: string; number: string; project_id: string; daily_report_id: string | null; work_package_id: string | null; change_date: string | Date
  cause: string; description: string; initiator: string; responsible_party: string; schedule_impact_days: number
  costs: ChangeOrder['costs'] | string; total: string; photo_ids: string[] | string; status: ChangeOrder['status']; created_at: string | Date
  calculated_at: string | Date | null; submitted_at: string | Date | null; approved_by: string | null; approved_at: string | Date | null
  executed_at: string | Date | null; ready_for_invoice_at: string | Date | null
  progress_statement_id: string | null
}

interface ProgressStatementRow extends QueryResultRow {
  id: string; number: string; project_id: string; period_start: string | Date; period_end: string | Date; lines: ProgressStatement['lines'] | string
  change_order_ids: string[] | string; work_amount: string; change_order_amount: string; price_revision_amount: string; gross_amount: string
  retention_pct: string; retention_amount: string; net_amount: string; status: ProgressStatement['status']; notes: string; created_at: string | Date
  submitted_at: string | Date | null; approved_by: string | null; approved_at: string | Date | null; invoice_id: string | null
  details: Partial<ProgressStatement> | string | null
}

interface SalesInvoiceRow extends QueryResultRow {
  id: string; number: string; legal_entity_id: string | null; project_id: string; progress_statement_id: string; invoice_date: string | Date; due_date: string | Date
  subtotal: string; vat_pct: string; vat_amount: string; total: string; status: SalesInvoice['status']; issued_at: string | Date | null; issued_by: string | null
  paid_at: string | Date | null; paid_amount: string | null; payment_reference: string | null; created_at: string | Date
  lines: NonNullable<PurchaseOrder['lines']> | string; receipts: NonNullable<PurchaseOrder['receipts']> | string; match_result: PurchaseOrder['matchResult'] | string | null
}

interface IntercompanyChargeRow extends QueryResultRow {
  id: string; number: string; from_legal_entity_id: string; to_legal_entity_id: string; project_id: string | null; description: string
  base_amount: string; markup_pct: string; total_amount: string; status: IntercompanyCharge['status']; created_at: string | Date; approved_at: string | Date | null; posted_at: string | Date | null
}

interface PeppolValidationReportRow extends QueryResultRow {
  id: string; invoice_id: string; document_digest: string; status: PeppolValidationReport['status']; source: PeppolValidationReport['source']; engine: string; profile: string; network_ready: boolean; issues: PeppolValidationReport['issues'] | string; validated_at: string | Date
}

interface PeppolDeliveryRow extends QueryResultRow {
  id: string; invoice_id: string; validation_report_id: string; status: PeppolDelivery['status']; provider: string; provider_reference: string | null; idempotency_key: string; attempts: number; message: string; events: PeppolDelivery['events'] | string; requested_at: string | Date; updated_at: string | Date; delivered_at: string | Date | null
}

interface PeppolAcceptanceRunRow extends QueryResultRow {
  id: string; invoice_id: string; status: PeppolAcceptanceRun['status']; document_digest: string; validation_report_id: string | null; delivery_id: string | null
  steps: PeppolAcceptanceStep[] | string; started_by: string; started_at: string | Date; completed_at: string | Date | null
  released_by: string | null; released_at: string | Date | null; release_notes: string | null
}

interface PeppolAlertRow extends QueryResultRow {
  tenant_id: string; id: string; delivery_id: string; invoice_id: string; type: PeppolAlert['type']; severity: PeppolAlert['severity']; status: PeppolAlert['status']; message: string; acknowledged_by: string | null; acknowledged_at: string | Date | null; resolved_at: string | Date | null; created_at: string | Date; updated_at: string | Date
}

interface PeppolNotificationRow extends QueryResultRow {
  id: string; alert_id: string; channel: PeppolNotification['channel']; kind: PeppolNotification['kind']; destination: string; subject: string; message: string; status: PeppolNotification['status']; attempts: number; next_attempt_at: string | Date; last_error: string | null; sent_at: string | Date | null; created_at: string | Date; updated_at: string | Date
}

interface PeppolNotificationSettingsRow extends QueryResultRow {
  email_recipients: string[] | string; teams_targets: string[] | string; critical_sla_minutes: number; updated_at: string | Date
}

interface SystemPeppolNotificationRow extends PeppolNotificationRow { tenant_id: string }

interface SystemPeppolDeliveryRow extends PeppolDeliveryRow { tenant_id: string }
interface PeppolAuditUserRow extends QueryResultRow { user_id: string }

interface ProjectCostRow extends QueryResultRow {
  id: string; project_id: string; work_package_id: string | null; cost_date: string | Date; type: ProjectCost['type']; category: ProjectCost['category']
  description: string; supplier: string; amount: string; reference: string; recognition: NonNullable<ProjectCost['recognition']>; source_document_id: string | null; status: ProjectCost['status']; source_commitment_id: string | null; settled_by_entry_id: string | null; created_at: string | Date
}

interface ProjectForecastRow extends QueryResultRow {
  id: string; project_id: string; version: number; lines: ProjectForecast['lines'] | string; actual_costs: string; open_commitments: string
  remaining_cost: string; estimate_at_completion: string; expected_revenue: string; expected_margin: string; expected_margin_pct: string; notes: string; status:ProjectForecast['status'];created_by:string;approved_by:string|null;approved_at:string|Date|null; created_at: string | Date
}

interface SupplierRow extends QueryResultRow {
  id: string; organization_id: string | null; name: string; vat_number: string; contact_name: string; email: string; payment_terms: string; rating: string; framework_agreements: NonNullable<Supplier['frameworkAgreements']> | string; created_at: string | Date
}

interface ProcurementRequestRow extends QueryResultRow {
  id: string; number: string; project_id: string; work_package_id: string | null; category: ProcurementRequest['category']; requested_by: string; needed_by: string | Date; description: string
  invited_supplier_ids: string[] | string; items: ProcurementRequest['items'] | string; status: ProcurementRequest['status']; quotes: ProcurementRequest['quotes'] | string; selected_quote_id: string | null; purchase_order_id: string | null;approval:ProcurementRequest['approval']|string|null; created_at: string | Date
}

interface PurchaseOrderRow extends QueryResultRow {
  id: string; number: string; procurement_request_id: string; project_id: string; supplier_id: string; framework_agreement_id: string | null; order_date: string | Date; expected_delivery_date: string | Date
  amount: string; status: PurchaseOrder['status']; commitment_cost_id: string; received_at: string | Date | null; delivery_reference: string | null; received_by: string | null; receipt_notes: string | null
  invoice_number: string | null; invoice_date: string | Date | null; invoice_due_date: string | Date | null; invoice_amount: string | null; actual_cost_id: string | null
  paid_at: string | Date | null; paid_amount: string | null; payment_reference: string | null; created_at: string | Date
}

export interface AuditEntry extends QueryResultRow {
  id: string
  userId: string
  entityType: string
  entityId: string
  action: string
  oldValue: unknown
  newValue: unknown
  reason: string | null
  createdAt: string
}

export interface AuditTrailEntry extends QueryResultRow {
  id: string; userId: string; userName: string; entityType: string; entityId: string; action: string; reason: string | null; createdAt: string
}

export interface OpportunityInput {
  title: string
  organizationId: string
  legalEntityId?: string
  branchId?: string
  location: string
  deadline: string
  estimatedValue: number
  probability: number
  recognition: string
}

export type BoqItemInput = Omit<BoqItem, 'id' | 'costApplications'>
export type CalculationScenarioInput = Omit<CalculationScenario, 'id' | 'calculationId' | 'isSelected' | 'updatedAt'>

const iso = (value: string | Date) => new Date(value).toISOString()
const dateOnly = (value: string | Date) => typeof value === 'string' ? value.slice(0, 10) : value.toISOString().slice(0, 10)
const cents = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100
const documentMimeExtensions: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-excel': 'xls',
  'text/csv': 'csv',
  'text/plain': 'txt',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/acad': 'dwg',
  'application/x-acad': 'dwg',
  'image/vnd.dwg': 'dwg',
}

function documentExtension(fileName: string, mimeType: string) {
  const direct = documentMimeExtensions[mimeType]
  if (direct) return direct
  const extension = fileName.split('.').pop()?.toLowerCase()
  if (mimeType === 'application/octet-stream' && extension && ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'txt', 'dwg'].includes(extension)) return extension
  throw new RepositoryError('Dit bestandstype is niet toegestaan voor documentbeheer', 415)
}

function lidarArtifactExtension(fileName:string,mimeType:string){
  const extension=fileName.split('.').pop()?.toLowerCase()
  const allowed=new Set(['usdz','json','ply','obj','zip','jpg','jpeg','png','webp','heic'])
  if(extension&&allowed.has(extension))return extension==='jpeg'?'jpg':extension
  const byMime:Record<string,string>={'model/vnd.usdz+zip':'usdz','application/json':'json','application/zip':'zip','image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/heic':'heic'}
  const mapped=byMime[mimeType];if(mapped)return mapped
  throw new RepositoryError('Alleen USDZ, RoomPlan-JSON, PLY/OBJ, ZIP en werffotoâ€™s zijn toegestaan als LiDAR-bewijs',415)
}

function mapOpportunity(row: OpportunityRow): Opportunity {
  return { id: row.id, projectNumber: row.project_number, title: row.title, organizationId: row.organization_id, legalEntityId: row.legal_entity_id ?? undefined, branchId: row.branch_id ?? undefined, location: row.location, deadline: dateOnly(row.deadline), estimatedValue: Number(row.estimated_value), probability: Number(row.probability), stage: row.stage, recognition: row.recognition, goNoGo: row.go_no_go ? jsonValue(row.go_no_go) : undefined, tender: row.tender ? normalizeTenderDossier(jsonValue(row.tender)) : undefined }
}

function mapItem(row: BoqItemRow): BoqItem {
  const costApplications = typeof row.cost_applications === 'string' ? JSON.parse(row.cost_applications) as BoqItem['costApplications'] : row.cost_applications
  const advanced = typeof row.advanced === 'string' ? JSON.parse(row.advanced) as Partial<BoqItem> : row.advanced
  return { id: row.id, chapterId: row.chapter_id ?? undefined, sortOrder: Number(row.sort_order), code: row.code, description: row.description, quantity: Number(row.quantity), unit: row.unit, labor: Number(row.labor), material: Number(row.material), equipment: Number(row.equipment), subcontracting: Number(row.subcontracting), postType:advanced?.postType??'Meetstaatpost', quantityType: advanced?.quantityType ?? 'Vermoedelijk', wastePct: Number(advanced?.wastePct ?? 0), itemRiskPct: Number(advanced?.itemRiskPct ?? 0), markupPct: Number(advanced?.markupPct ?? 0), notes: advanced?.notes ?? '', variables:advanced?.variables??[], formulas:advanced?.formulas??{}, priceAdjustments:advanced?.priceAdjustments??[], responsibleUserId:advanced?.responsibleUserId, workflowStatus:advanced?.workflowStatus??'Niet gestart', workPackageId:advanced?.workPackageId, planningActivityId:advanced?.planningActivityId, bimElementIds:advanced?.bimElementIds??[], lidarScanIds:advanced?.lidarScanIds??[], costApplications: costApplications ?? {} }
}

function itemAdvanced(item:BoqItem){return{postType:item.postType??'Meetstaatpost',quantityType:item.quantityType??'Vermoedelijk',wastePct:item.wastePct??0,itemRiskPct:item.itemRiskPct??0,markupPct:item.markupPct??0,notes:item.notes??'',variables:item.variables??[],formulas:item.formulas??{},priceAdjustments:item.priceAdjustments??[],responsibleUserId:item.responsibleUserId,workflowStatus:item.workflowStatus??'Niet gestart',workPackageId:item.workPackageId,planningActivityId:item.planningActivityId,bimElementIds:item.bimElementIds??[],lidarScanIds:item.lidarScanIds??[]}}

function mapCostLibraryItem(row: CostLibraryItemRow): CostLibraryItem {
  return { id: row.id, libraryVersionId: row.library_version_id ?? DEFAULT_COST_LIBRARY_VERSION_ID, code: row.code, name: row.name, category: row.category, unit: row.unit, unitCost: Number(row.unit_cost), source: row.source, updatedAt: iso(row.updated_at) }
}

function mapCostLibrary(row: CostLibraryRow): CostLibrary { return { id: row.id, name: row.name, description: row.description, active: row.active, legalEntityId: row.legal_entity_id ?? undefined, branchId: row.branch_id ?? undefined, createdAt: iso(row.created_at) } }
function mapCostLibraryVersion(row: CostLibraryVersionRow): CostLibraryVersion { return { id: row.id, libraryId: row.library_id, version: Number(row.version), label: row.label, status: row.status, effectiveFrom: dateOnly(row.effective_from), createdAt: iso(row.created_at) } }
function mapUnit(row: UnitDefinitionRow): UnitDefinition { return { id: row.id, code: row.code, name: row.name, category: row.category, active: row.active, createdAt: iso(row.created_at) } }
function mapUnitConversion(row: UnitConversionRow): UnitConversion { return { id: row.id, fromUnitId: row.from_unit_id, toUnitId: row.to_unit_id, factor: Number(row.factor), createdAt: iso(row.created_at) } }

function mapCalculationScenario(row: CalculationScenarioRow): CalculationScenario {
  return {
    id: row.id, calculationId: row.calculation_id, name: row.name, description: row.description,
    laborAdjustmentPct: Number(row.labor_adjustment_pct), materialAdjustmentPct: Number(row.material_adjustment_pct), equipmentAdjustmentPct: Number(row.equipment_adjustment_pct), subcontractingAdjustmentPct: Number(row.subcontracting_adjustment_pct),
    overheadPct: Number(row.overhead_pct), riskPct: Number(row.risk_pct), marginPct: Number(row.margin_pct), isSelected: row.is_selected, updatedAt: iso(row.updated_at),
  }
}

function jsonValue<T>(value: T | string): T {
  return typeof value === 'string' ? JSON.parse(value) as T : value
}

function mapQuote(row: QuoteRow): Quote {
  const quote: Quote = { id: row.id, number: row.number, calculationId: row.calculation_id, scenarioId: row.scenario_id, version: Number(row.version), total: Number(row.total), content: jsonValue(row.content), snapshot: jsonValue(row.snapshot), workflow: row.workflow ? jsonValue(row.workflow) : undefined, createdAt: iso(row.created_at) }
  return { ...quote, workflow: quote.workflow ?? defaultQuoteWorkflow(quote) }
}

function mapLegalEntity(row: LegalEntityRow): LegalEntity {
  return { id: row.id, name: row.name, vatNumber: row.vat_number, country: row.country, currency: row.currency, active: row.active, invoicePrefix: row.invoice_prefix, nextInvoiceNumber: Number(row.next_invoice_number), defaultVatPct: Number(row.default_vat_pct), iban: row.iban, bic: row.bic, paymentTermsDays: Number(row.payment_terms_days), addressLine: row.address_line, postalCode: row.postal_code, city: row.city, countryCode: row.country_code, peppolEndpointId: row.peppol_endpoint_id, peppolSchemeId: row.peppol_scheme_id, createdAt: iso(row.created_at) }
}

function mapOrganization(row: OrganizationRow): Organization {
  return { id: row.id, name: row.name, type: row.type, contactName: row.contact_name, email: row.email, vatNumber: row.vat_number, addressLine: row.address_line, postalCode: row.postal_code, city: row.city, countryCode: row.country_code, peppolEndpointId: row.peppol_endpoint_id, peppolSchemeId: row.peppol_scheme_id, roles: jsonValue<NonNullable<Organization['roles']>>(row.roles ?? []), contacts: jsonValue<NonNullable<Organization['contacts']>>(row.contacts ?? []), addresses: jsonValue<NonNullable<Organization['addresses']>>(row.addresses ?? []), activities: jsonValue<NonNullable<Organization['activities']>>(row.activities ?? []), relations: jsonValue<NonNullable<Organization['relations']>>(row.relations ?? []) }
}

function mapMailboxMessage(row: MailboxMessageRow): MailboxMessage {
  return { id:row.id, providerMessageId:row.provider_message_id, internetMessageId:row.internet_message_id??undefined, conversationId:row.conversation_id??undefined,
    direction:row.direction, fromName:row.from_name, fromAddress:row.from_address, toRecipients:jsonValue(row.to_recipients), ccRecipients:jsonValue(row.cc_recipients),
    subject:row.subject, bodyPreview:row.body_preview, receivedAt:row.received_at?iso(row.received_at):undefined, sentAt:row.sent_at?iso(row.sent_at):undefined,
    isRead:row.is_read, hasAttachments:row.has_attachments, webLink:row.web_link??undefined, organizationId:row.organization_id??undefined, opportunityId:row.opportunity_id??undefined,
    projectId:row.project_id??undefined, synchronizedAt:iso(row.synchronized_at) }
}

function mapIntercompanyCharge(row: IntercompanyChargeRow): IntercompanyCharge {
  return { id: row.id, number: row.number, fromLegalEntityId: row.from_legal_entity_id, toLegalEntityId: row.to_legal_entity_id, projectId: row.project_id ?? undefined, description: row.description, baseAmount: Number(row.base_amount), markupPct: Number(row.markup_pct), totalAmount: Number(row.total_amount), status: row.status, createdAt: iso(row.created_at), approvedAt: row.approved_at ? iso(row.approved_at) : undefined, postedAt: row.posted_at ? iso(row.posted_at) : undefined }
}

function mapCompanyBranch(row: CompanyBranchRow): CompanyBranch {
  return { id: row.id, legalEntityId: row.legal_entity_id, name: row.name, address: row.address, country: row.country, createdAt: iso(row.created_at) }
}

function mapDailyReport(row: DailyReportRow): DailyReport {
  return { id: row.id, projectId: row.project_id, date: dateOnly(row.report_date), workPackageId: row.work_package_id ?? undefined, weather: row.weather, temperature: Number(row.temperature), activities: row.activities, laborEntries: jsonValue(row.labor_entries), subcontractors: jsonValue(row.subcontractors), materials: jsonValue(row.materials), machines: jsonValue(row.machines), productionEntries: jsonValue(row.production_entries ?? []), deliveries: row.deliveries, delays: row.delays, problems: row.problems, visitors: row.visitors, notes: row.notes, status: row.status, createdAt: iso(row.created_at), submittedAt: row.submitted_at ? iso(row.submitted_at) : undefined, signedBy: row.signed_by ?? undefined, signedAt: row.signed_at ? iso(row.signed_at) : undefined }
}

function mapSitePhoto(row: SitePhotoRow): SitePhoto {
  return { id: row.id, projectId: row.project_id, dailyReportId: row.daily_report_id, workPackageId: row.work_package_id ?? undefined, fileName: row.file_name, mimeType: row.mime_type, sizeBytes: Number(row.size_bytes), caption: row.caption, location: row.location, takenAt: iso(row.taken_at), createdAt: iso(row.created_at) }
}

function mapDocumentVersion(row: DocumentVersionRow): DocumentVersion {
  return { id: row.id, documentId: row.document_id, revision: Number(row.revision), revisionLabel: row.revision_label, fileName: row.file_name, mimeType: row.mime_type, sizeBytes: Number(row.size_bytes), contentDigest: row.content_digest ?? undefined, notes: row.notes, uploadedBy: row.uploaded_by, createdAt: iso(row.created_at), supersededAt: row.superseded_at ? iso(row.superseded_at) : undefined }
}

function mapDocumentRecipient(row: DocumentRecipientRow): DocumentRecipient {
  return { id: row.id, documentId: row.document_id, versionId: row.version_id, name: row.name, email: row.email, deliveredAt: iso(row.delivered_at), readAt: row.read_at ? iso(row.read_at) : undefined }
}

function mapDocumentRecordLink(row: DocumentRecordLinkRow): DocumentRecordLink {
  return { id: row.id, documentId: row.document_id, type: row.link_type, recordId: row.record_id, label: row.label, createdBy: row.created_by, createdAt: iso(row.created_at) }
}

function mapDocument(row: DocumentRow, versions: DocumentVersionRow[], recipients: DocumentRecipientRow[], links: DocumentRecordLinkRow[] = []): ProjectDocument {
  return { id: row.id, projectId: row.project_id, legalEntityId: row.legal_entity_id ?? undefined, salesInvoiceId: row.sales_invoice_id ?? undefined, peppolAcceptanceRunId: row.peppol_acceptance_run_id ?? undefined, title: row.title, category: row.category, status: row.status, immutable: Boolean(row.immutable), currentVersionId: row.current_version_id, versions: versions.filter(version => version.document_id === row.id).map(mapDocumentVersion), recipients: recipients.filter(recipient => recipient.document_id === row.id).map(mapDocumentRecipient), links: links.filter(link => link.document_id === row.id).map(mapDocumentRecordLink), approvedBy: row.approved_by ?? undefined, approvedAt: row.approved_at ? iso(row.approved_at) : undefined, createdAt: iso(row.created_at) }
}

function mapQhseCertificate(row: QhseCertificateRow): QhseCertificate {
  return { id: row.id, projectId: row.project_id, holderType: row.holder_type, holderId: row.holder_id ?? undefined, holderName: row.holder_name, certificateType: row.certificate_type, certificateNumber: row.certificate_number, issuedOn: row.issued_on ? dateOnly(row.issued_on) : undefined, expiresOn: dateOnly(row.expires_on), documentId: row.document_id ?? undefined, createdAt: iso(row.created_at) }
}

function mapQhseInspection(row: QhseInspectionRow): QhseInspection {
  return { id: row.id, projectId: row.project_id, inspectionDate: dateOnly(row.inspection_date), type: row.inspection_type, inspector: row.inspector, location: row.location, notes: row.notes, findings: jsonValue(row.findings), status: row.status, createdAt: iso(row.created_at), closedAt: row.closed_at ? iso(row.closed_at) : undefined }
}

function mapChangeOrder(row: ChangeOrderRow): ChangeOrder {
  return {
    id: row.id, number: row.number, projectId: row.project_id, dailyReportId: row.daily_report_id ?? undefined, workPackageId: row.work_package_id ?? undefined,
    date: dateOnly(row.change_date), cause: row.cause, description: row.description, initiator: row.initiator, responsibleParty: row.responsible_party,
    scheduleImpactDays: Number(row.schedule_impact_days), costs: jsonValue(row.costs), total: Number(row.total), photoIds: jsonValue(row.photo_ids), status: row.status,
    createdAt: iso(row.created_at), calculatedAt: row.calculated_at ? iso(row.calculated_at) : undefined, submittedAt: row.submitted_at ? iso(row.submitted_at) : undefined,
    approvedBy: row.approved_by ?? undefined, approvedAt: row.approved_at ? iso(row.approved_at) : undefined, executedAt: row.executed_at ? iso(row.executed_at) : undefined,
    readyForInvoiceAt: row.ready_for_invoice_at ? iso(row.ready_for_invoice_at) : undefined, progressStatementId: row.progress_statement_id ?? undefined,
  }
}

function mapProgressStatement(row: ProgressStatementRow): ProgressStatement {
  const details = row.details ? jsonValue<Partial<ProgressStatement>>(row.details) : {}
  return {
    id: row.id, number: row.number, projectId: row.project_id, periodStart: dateOnly(row.period_start), periodEnd: dateOnly(row.period_end), lines: jsonValue(row.lines), changeOrderIds: jsonValue(row.change_order_ids),
    workAmount: Number(row.work_amount), changeOrderAmount: Number(row.change_order_amount), priceRevisionAmount: Number(row.price_revision_amount), grossAmount: Number(row.gross_amount),
    retentionPct: Number(row.retention_pct), retentionAmount: Number(row.retention_amount), netAmount: Number(row.net_amount), status: row.status, notes: row.notes, createdAt: iso(row.created_at),
    submittedAt: row.submitted_at ? iso(row.submitted_at) : undefined, approvedBy: row.approved_by ?? undefined, approvedAt: row.approved_at ? iso(row.approved_at) : undefined, invoiceId: row.invoice_id ?? undefined,
    valuationDate:details.valuationDate, dueDate:details.dueDate, certificateReference:details.certificateReference, preparedBy:details.preparedBy,
    revisionFormula:details.revisionFormula, priceRevisionCalculation:details.priceRevisionCalculation, advancePaymentAmount:Number(details.advancePaymentAmount??0), advanceRecoveryAmount:Number(details.advanceRecoveryAmount??0),
    otherDeductionsAmount:Number(details.otherDeductionsAmount??0), evidenceDocumentIds:details.evidenceDocumentIds??[], qualityChecklist:details.qualityChecklist,
  }
}

function progressStatementDetails(input:ProgressStatementInput) {
  return {
    valuationDate:input.valuationDate, dueDate:input.dueDate, certificateReference:input.certificateReference, preparedBy:input.preparedBy,
    revisionFormula:input.revisionFormula, priceRevisionCalculation:input.priceRevisionCalculation, advancePaymentAmount:input.advancePaymentAmount??0, advanceRecoveryAmount:input.advanceRecoveryAmount??0,
    otherDeductionsAmount:input.otherDeductionsAmount??0, evidenceDocumentIds:input.evidenceDocumentIds??[], qualityChecklist:input.qualityChecklist,
  }
}

function mapSalesInvoice(row: SalesInvoiceRow): SalesInvoice {
  return { id: row.id, number: row.number, legalEntityId: row.legal_entity_id ?? undefined, projectId: row.project_id, progressStatementId: row.progress_statement_id, invoiceDate: dateOnly(row.invoice_date), dueDate: dateOnly(row.due_date), subtotal: Number(row.subtotal), vatPct: Number(row.vat_pct), vatAmount: Number(row.vat_amount), total: Number(row.total), status: row.status, issuedAt: row.issued_at ? iso(row.issued_at) : undefined, issuedBy: row.issued_by ?? undefined, paidAt: row.paid_at ? dateOnly(row.paid_at) : undefined, paidAmount: row.paid_amount == null ? undefined : Number(row.paid_amount), paymentReference: row.payment_reference ?? undefined, createdAt: iso(row.created_at) }
}

function mapPeppolValidationReport(row: PeppolValidationReportRow): PeppolValidationReport {
  return { id: row.id, invoiceId: row.invoice_id, documentDigest: row.document_digest, status: row.status, source: row.source, engine: row.engine, profile: row.profile, networkReady: row.network_ready, issues: jsonValue(row.issues), validatedAt: iso(row.validated_at) }
}

function mapPeppolDelivery(row: PeppolDeliveryRow): PeppolDelivery {
  return { id: row.id, invoiceId: row.invoice_id, validationReportId: row.validation_report_id, status: row.status, provider: row.provider, providerReference: row.provider_reference ?? undefined, idempotencyKey: row.idempotency_key, attempts: Number(row.attempts), message: row.message, events: jsonValue(row.events), requestedAt: iso(row.requested_at), updatedAt: iso(row.updated_at), deliveredAt: row.delivered_at ? iso(row.delivered_at) : undefined }
}

function mapPeppolAlert(row: PeppolAlertRow): PeppolAlert {
  return { id: row.id, deliveryId: row.delivery_id, invoiceId: row.invoice_id, type: row.type, severity: row.severity, status: row.status, message: row.message, acknowledgedBy: row.acknowledged_by ?? undefined, acknowledgedAt: row.acknowledged_at ? iso(row.acknowledged_at) : undefined, resolvedAt: row.resolved_at ? iso(row.resolved_at) : undefined, createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) }
}

function mapPeppolNotification(row: PeppolNotificationRow): PeppolNotification {
  return { id: row.id, alertId: row.alert_id, channel: row.channel, kind: row.kind, destination: row.destination, subject: row.subject, message: row.message, status: row.status, attempts: Number(row.attempts), nextAttemptAt: iso(row.next_attempt_at), lastError: row.last_error ?? undefined, sentAt: row.sent_at ? iso(row.sent_at) : undefined, createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) }
}

function mapPeppolAcceptanceRun(row: PeppolAcceptanceRunRow): PeppolAcceptanceRun {
  return { id: row.id, invoiceId: row.invoice_id, status: row.status, documentDigest: row.document_digest, validationReportId: row.validation_report_id ?? undefined, deliveryId: row.delivery_id ?? undefined, steps: jsonValue(row.steps), startedBy: row.started_by, startedAt: iso(row.started_at), completedAt: row.completed_at ? iso(row.completed_at) : undefined, releasedBy: row.released_by ?? undefined, releasedAt: row.released_at ? iso(row.released_at) : undefined, releaseNotes: row.release_notes ?? undefined }
}

function mapPeppolNotificationSettings(row: PeppolNotificationSettingsRow, connectorConfigured: boolean, connectorProvider: string, connectorChannels: readonly PeppolNotificationChannel[], integrationChecks: readonly PeppolIntegrationCheck[], productionGate: PeppolProductionGate): PeppolNotificationSettings {
  return { emailRecipients: jsonValue(row.email_recipients), teamsTargets: jsonValue(row.teams_targets), criticalSlaMinutes: Number(row.critical_sla_minutes), connectorConfigured, connectorProvider, connectorChannels: [...connectorChannels], integrationChecks: integrationChecks.map(check => ({ ...check })), productionGate, updatedAt: iso(row.updated_at) }
}

function mapProjectCost(row: ProjectCostRow): ProjectCost {
  return { id: row.id, projectId: row.project_id, workPackageId: row.work_package_id ?? undefined, date: dateOnly(row.cost_date), type: row.type, category: row.category, description: row.description, supplier: row.supplier, amount: Number(row.amount), reference: row.reference, recognition: row.recognition ?? 'Boeking', sourceDocumentId: row.source_document_id ?? undefined, status: row.status, sourceCommitmentId: row.source_commitment_id ?? undefined, settledByEntryId: row.settled_by_entry_id ?? undefined, createdAt: iso(row.created_at) }
}

function mapProjectForecast(row: ProjectForecastRow): ProjectForecast {
  return { id: row.id, projectId: row.project_id, version: Number(row.version), lines: jsonValue(row.lines), actualCosts: Number(row.actual_costs), openCommitments: Number(row.open_commitments), remainingCost: Number(row.remaining_cost), estimateAtCompletion: Number(row.estimate_at_completion), expectedRevenue: Number(row.expected_revenue), expectedMargin: Number(row.expected_margin), expectedMarginPct: Number(row.expected_margin_pct), notes: row.notes,status:row.status??'Concept',createdBy:row.created_by??'',approvedBy:row.approved_by??undefined,approvedAt:row.approved_at?iso(row.approved_at):undefined, createdAt: iso(row.created_at) }
}

function mapSupplier(row: SupplierRow): Supplier {
  return { id: row.id, organizationId: row.organization_id ?? undefined, name: row.name, vatNumber: row.vat_number, contactName: row.contact_name, email: row.email, paymentTerms: row.payment_terms, rating: Number(row.rating), frameworkAgreements: jsonValue(row.framework_agreements ?? []), createdAt: iso(row.created_at) }
}

function mapProcurementRequest(row: ProcurementRequestRow): ProcurementRequest {
  return { id: row.id, number: row.number, projectId: row.project_id, workPackageId: row.work_package_id ?? undefined, invitedSupplierIds: jsonValue(row.invited_supplier_ids), category: row.category, requestedBy: row.requested_by, neededBy: dateOnly(row.needed_by), description: row.description, items: jsonValue(row.items), status: row.status, quotes: jsonValue(row.quotes), selectedQuoteId: row.selected_quote_id ?? undefined, purchaseOrderId: row.purchase_order_id ?? undefined,approval:row.approval?jsonValue(row.approval):undefined, createdAt: iso(row.created_at) }
}

function mapPurchaseOrder(row: PurchaseOrderRow): PurchaseOrder {
  return { id: row.id, number: row.number, procurementRequestId: row.procurement_request_id, projectId: row.project_id, supplierId: row.supplier_id, frameworkAgreementId: row.framework_agreement_id ?? undefined, orderDate: dateOnly(row.order_date), expectedDeliveryDate: dateOnly(row.expected_delivery_date), amount: Number(row.amount), status: row.status, commitmentCostId: row.commitment_cost_id, lines: jsonValue(row.lines), receipts: jsonValue(row.receipts), matchResult: row.match_result ? jsonValue(row.match_result) : undefined, receivedAt: row.received_at ? dateOnly(row.received_at) : undefined, deliveryReference: row.delivery_reference ?? undefined, receivedBy: row.received_by ?? undefined, receiptNotes: row.receipt_notes ?? undefined, invoiceNumber: row.invoice_number ?? undefined, invoiceDate: row.invoice_date ? dateOnly(row.invoice_date) : undefined, invoiceDueDate: row.invoice_due_date ? dateOnly(row.invoice_due_date) : undefined, invoiceAmount: row.invoice_amount == null ? undefined : Number(row.invoice_amount), actualCostId: row.actual_cost_id ?? undefined, paidAt: row.paid_at ? dateOnly(row.paid_at) : undefined, paidAmount: row.paid_amount == null ? undefined : Number(row.paid_amount), paymentReference: row.payment_reference ?? undefined, createdAt: iso(row.created_at) }
}

const normalizedEmail = (value: string | undefined) => value?.trim().toLowerCase() ?? ''

/**
 * External portal accounts must be scoped before the bootstrap payload leaves the API.
 * Client-side filtering remains useful for presentation, but is never a security boundary.
 */
export function scopeExternalBootstrap(state: BouwFlowState, context: RequestContext): BouwFlowState {
  const externalRoles = context.roles.filter(role => ['Klant', 'Onderaannemer', 'Leverancier'].includes(role))
  if (!externalRoles.length || context.roles.some(role => !['Klant', 'Onderaannemer', 'Leverancier'].includes(role))) return state

  const email = normalizedEmail(context.email)
  const externalUser = state.companyUsers.find(user => user.id === context.userId) ?? {
    id: context.userId,
    displayName: context.displayName,
    email: context.email,
    role: externalRoles[0],
    allLegalEntities: true,
    legalEntityIds: [],
  }
  const emptyInternalData = {
    currentUserId: context.userId,
    companyUsers: [{ ...externalUser, displayName: context.displayName, email: context.email, role: externalRoles[0] }],
    calculations: [], calculationVersions: [], calculationScenarios: [], costLibraries: [], costLibraryVersions: [], costLibrary: [],
    units: [], unitConversions: [], salesInvoices: [], peppolValidationReports: [], peppolDeliveries: [], peppolAcceptanceRuns: [],
    peppolAlerts: [], peppolNotifications: [], intercompanyCharges: [], projectCosts: [], projectForecasts: [],
    assets: [], warehouses: [], inventoryItems: [], stockMovements: [], jointVentures: [], integrationConnections: [], integrationJobs: [],
    aiAnalyses: [], employees: [], employeeAbsences: [], employeeCrews: [],
    workTickets: [], timeEntries: [], projectClaims: [], checkinatworkSites: [], checkinatworkParticipants: [], checkinatworkRegistrations: [], checkinatworkAuditEvents: [],
  } satisfies Partial<BouwFlowState>

  if (externalRoles.includes('Klant')) {
    const organizations = state.organizations.filter(organization => {
      const addresses = [organization.email, ...(organization.contacts ?? []).map(contact => contact.email)].map(normalizedEmail)
      return addresses.includes(email)
    })
    const organizationIds = new Set(organizations.map(organization => organization.id))
    const projects = state.projects.filter(project => organizationIds.has(project.organizationId)).map(project => ({ ...project, costBudget: 0, marginPct: 0 }))
    const projectIds = new Set(projects.map(project => project.id))
    const opportunities = state.opportunities.filter(opportunity => organizationIds.has(opportunity.organizationId))
    const opportunityIds = new Set(opportunities.map(opportunity => opportunity.id))
    const visibleCalculations = state.calculations.filter(calculation => opportunityIds.has(calculation.opportunityId)).map(calculation => ({ ...calculation, chapters: [], items: [], overheadPct: 0, riskPct: 0, marginPct: 0, siteOverheadPct: 0, escalationPct: 0, discountPct: 0 }))
    const calculationIds = new Set(visibleCalculations.map(calculation => calculation.id))
    const visibleDocuments = state.documents.filter(document => projectIds.has(document.projectId) && document.status === 'Goedgekeurd')
    return {
      ...state, ...emptyInternalData,
      legalEntities: state.legalEntities.filter(entity => projects.some(project => project.legalEntityId === entity.id)),
      companyBranches: state.companyBranches.filter(branch => projects.some(project => project.branchId === branch.id)),
      organizations, opportunities, calculations: visibleCalculations, quotes: state.quotes.filter(quote => calculationIds.has(quote.calculationId)), projects,
      dailyReports: [], sitePhotos: [],
      documents: visibleDocuments,
      changeOrders: state.changeOrders.filter(order => projectIds.has(order.projectId) && ['Ter goedkeuring', 'Goedgekeurd', 'Uitgevoerd', 'Klaar voor facturatie', 'Opgenomen in vorderingsstaat'].includes(order.status)),
      progressStatements: state.progressStatements.filter(statement => projectIds.has(statement.projectId) && statement.status !== 'Concept'),
      procurementRequests: [], purchaseOrders: [], suppliers: [], subcontractors: [], qhseCertificates: [], qhseInspections: [], qhseEvents: [],
      projectContracts: state.projectContracts.filter(contract => projectIds.has(contract.projectId) && contract.status !== 'Concept').map(contract => ({ ...contract, risks: [] })),
      projectCloseouts: state.projectCloseouts.filter(closeout => projectIds.has(closeout.projectId)),
      workTickets: state.workTickets.filter(ticket => projectIds.has(ticket.projectId) && !ticket.subcontractorId && ['Ter ondertekening', 'Ondertekend', 'Gefactureerd'].includes(ticket.status)),
      projectClaims: state.projectClaims.filter(claim => projectIds.has(claim.projectId) && !['Concept', 'Intern goedgekeurd'].includes(claim.status)),
    }
  }

  if (externalRoles.includes('Onderaannemer')) {
    const subcontractors = state.subcontractors.filter(subcontractor => normalizedEmail(subcontractor.email) === email)
    const subcontractorIds = new Set(subcontractors.map(subcontractor => subcontractor.id))
    const projectIds = new Set(subcontractors.flatMap(subcontractor => subcontractor.projectIds))
    const checkinatworkParticipants = state.checkinatworkParticipants.filter(participant => Boolean(participant.subcontractorId && subcontractorIds.has(participant.subcontractorId) && projectIds.has(participant.projectId)))
    const checkinatworkParticipantIds = new Set(checkinatworkParticipants.map(participant => participant.id))
    const projects = state.projects.filter(project => projectIds.has(project.id)).map(project => ({ ...project, contractValue: 0, costBudget: 0, marginPct: 0 }))
    return {
      ...state, ...emptyInternalData,
      legalEntities: state.legalEntities.filter(entity => projects.some(project => project.legalEntityId === entity.id)),
      companyBranches: state.companyBranches.filter(branch => projects.some(project => project.branchId === branch.id)),
      organizations: state.organizations.filter(organization => subcontractors.some(subcontractor => subcontractor.organizationId === organization.id)),
      opportunities: [], quotes: [], projects,
      dailyReports: state.dailyReports.filter(report => projectIds.has(report.projectId) && report.subcontractors.some(entry => subcontractors.some(subcontractor => entry.toLowerCase().includes(subcontractor.name.toLowerCase())))),
      sitePhotos: [], changeOrders: [], progressStatements: [], suppliers: [], procurementRequests: [], purchaseOrders: [],
      documents: state.documents.filter(document => {
        if (!projectIds.has(document.projectId)) return false
        const linkedToOwnDossier = (document.links ?? []).some(link => link.type === 'Onderaannemer' && subcontractorIds.has(link.recordId))
        return linkedToOwnDossier || (document.status === 'Goedgekeurd' && ['Plan', 'Veiligheid', 'Vergunning'].includes(document.category))
      }),
      qhseCertificates: state.qhseCertificates.filter(certificate => projectIds.has(certificate.projectId) && certificate.holderType === 'Onderaannemer' && subcontractors.some(subcontractor => certificate.holderName.toLowerCase().includes(subcontractor.name.toLowerCase()))),
      qhseInspections: [], qhseEvents: [], subcontractors,
      checkinatworkSites: state.checkinatworkSites.filter(site => projectIds.has(site.projectId)),
      checkinatworkParticipants,
      checkinatworkRegistrations: state.checkinatworkRegistrations.filter(registration => checkinatworkParticipantIds.has(registration.participantId)),
      projectContracts: [], projectCloseouts: [],
      workTickets: state.workTickets.filter(ticket => projectIds.has(ticket.projectId) && Boolean(ticket.subcontractorId && subcontractorIds.has(ticket.subcontractorId))),
    }
  }

  const suppliers = state.suppliers.filter(supplier => normalizedEmail(supplier.email) === email)
  const supplierIds = new Set(suppliers.map(supplier => supplier.id))
  const procurementRequests = state.procurementRequests.filter(request => request.invitedSupplierIds.some(id => supplierIds.has(id)) || request.quotes.some(quote => supplierIds.has(quote.supplierId)) || state.purchaseOrders.some(order => order.procurementRequestId === request.id && supplierIds.has(order.supplierId)))
    .map(request => ({ ...request, quotes: request.quotes.filter(quote => supplierIds.has(quote.supplierId)) }))
  const requestIds = new Set(procurementRequests.map(request => request.id))
  const purchaseOrders = state.purchaseOrders.filter(order => supplierIds.has(order.supplierId))
  return {
    ...state, ...emptyInternalData,
    legalEntities: [], companyBranches: [], organizations: state.organizations.filter(organization => suppliers.some(supplier => supplier.organizationId === organization.id)),
    opportunities: [], quotes: [], projects: [], dailyReports: [], sitePhotos: [], changeOrders: [], progressStatements: [],
    suppliers, procurementRequests: procurementRequests.filter(request => requestIds.has(request.id)), purchaseOrders, documents: [],
    qhseCertificates: [], qhseInspections: [], qhseEvents: [], subcontractors: [], projectContracts: [], projectCloseouts: [],
  }
}

const emptyHandover = (): ProjectHandover => ({
  status: 'Concept', projectManager: '', plannedStart: '', plannedEnd: '', notes: '', risks: [],
  checklist: { scopeReviewed: false, budgetReviewed: false, contractReviewed: false, documentsTransferred: false, risksReviewed: false, kickoffPlanned: false },
})

const emptyPlanning = (): ProjectPlanning => ({ status: 'Concept', baselineVersion: 0, activities: [], updatedAt: new Date(0).toISOString() })
const addDays = (date: string, days: number) => {
  const value = new Date(`${date}T00:00:00.000Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

const defaultQuoteWorkflow = (quote: Pick<Quote, 'createdAt' | 'content'>): QuoteWorkflow => ({
  status: 'Concept', validUntil: addDays(quote.createdAt.slice(0, 10), quote.content.validityDays),
  events: [{ id: randomUUID(), type: 'Aangemaakt', at: quote.createdAt, actor: 'Calculatieteam' }],
})

function mapChapter(row: BoqChapterRow): BoqChapter {
  return { id: row.id, code: row.code, name: row.name, sortOrder: Number(row.sort_order), parentChapterId: row.parent_chapter_id ?? undefined, responsibleUserId: row.responsible_user_id ?? undefined, workflowStatus: row.workflow_status ?? 'Niet gestart' }
}

function mapCalculation(row: CalculationRow, chapters: BoqChapter[] = [], items: BoqItem[] = []): Calculation {
  return { id: row.id, number: row.number, opportunityId: row.opportunity_id, status: row.status, overheadPct: Number(row.overhead_pct), riskPct: Number(row.risk_pct), marginPct: Number(row.margin_pct), siteOverheadPct: Number(row.site_overhead_pct ?? 0), escalationPct: Number(row.escalation_pct ?? 0), discountPct: Number(row.discount_pct ?? 0), roundingStep: Number(row.rounding_step ?? 0), updatedAt: iso(row.updated_at), chapters, items }
}

export class BouwFlowRepository {
  constructor(
    private readonly pool: Pool,
    private readonly objectStorage: ObjectStorage,
    private readonly fallbackPeppolNotificationTargets: PeppolNotificationTarget[] = [],
    private readonly fallbackPeppolCriticalSlaMinutes = 15,
    private readonly peppolNotificationConnectorConfigured = false,
    private readonly peppolNotificationConnectorProvider = peppolNotificationConnectorConfigured ? 'Aangepaste adapter' : 'Niet geconfigureerd',
    private readonly peppolNotificationConnectorChannels: readonly PeppolNotificationChannel[] = peppolNotificationConnectorConfigured ? ['E-mail', 'Teams'] : [],
    private readonly peppolIntegrationChecks: readonly PeppolIntegrationCheck[] = [],
    private readonly integrationGateway: IntegrationGateway = new DevelopmentIntegrationGateway(),
    private readonly aiGateway: AiGateway = new DevelopmentAiGateway(),
    private readonly priceIndexProvider?: PriceIndexProvider,
    private readonly checkinatworkGateway: CheckinatworkGateway = new SimulationCheckinatworkGateway(),
  ) {}

  async priceIndexCatalogue(force=false) {
    if (!this.priceIndexProvider) throw new RepositoryError('De officiële prijsindexservice is niet geconfigureerd', 503)
    try { return await this.priceIndexProvider.catalogue(force) }
    catch (error) { throw new RepositoryError(`Officiële prijsindexen konden niet worden opgehaald: ${error instanceof Error ? error.message : 'onbekende fout'}`, 503) }
  }

  private fallbackPeppolNotificationSettings(): PeppolNotificationSettings {
    return {
      emailRecipients: this.fallbackPeppolNotificationTargets.filter(target => target.channel === 'E-mail').map(target => target.destination),
      teamsTargets: this.fallbackPeppolNotificationTargets.filter(target => target.channel === 'Teams').map(target => target.destination),
      criticalSlaMinutes: this.fallbackPeppolCriticalSlaMinutes,
      connectorConfigured: this.peppolNotificationConnectorConfigured,
      connectorProvider: this.peppolNotificationConnectorProvider,
      connectorChannels: [...this.peppolNotificationConnectorChannels],
      integrationChecks: this.peppolIntegrationChecks.map(check => ({ ...check })),
      productionGate: { released: false },
    }
  }

  private async loadPeppolProductionGate(queryable: Pick<Pool, 'query'>, tenantId: string): Promise<PeppolProductionGate> {
    const result = await queryable.query<PeppolAcceptanceRunRow>("SELECT * FROM peppol_acceptance_runs WHERE tenant_id=$1 AND status='Geslaagd' AND released_at IS NOT NULL ORDER BY released_at DESC LIMIT 25", [tenantId])
    const run = result.rows.find(row => jsonValue<PeppolAcceptanceStep[]>(row.steps).some(step => step.id === 'delivery' && step.status === 'Geslaagd'))
    if (!run) return { released: false }
    return { released: true, runId: run.id, releasedAt: iso(run.released_at!), releasedBy: run.released_by ?? undefined }
  }

  private async loadPeppolNotificationSettings(queryable: Pick<Pool, 'query'>, tenantId: string): Promise<PeppolNotificationSettings> {
    const [result, productionGate] = await Promise.all([
      queryable.query<PeppolNotificationSettingsRow>('SELECT * FROM peppol_notification_settings WHERE tenant_id=$1', [tenantId]),
      this.loadPeppolProductionGate(queryable, tenantId),
    ])
    return result.rowCount
      ? mapPeppolNotificationSettings(result.rows[0], this.peppolNotificationConnectorConfigured, this.peppolNotificationConnectorProvider, this.peppolNotificationConnectorChannels, this.peppolIntegrationChecks, productionGate)
      : { ...this.fallbackPeppolNotificationSettings(), productionGate }
  }

  private canAccessEntity(context: RequestContext, legalEntityId: string | null | undefined) {
    return context.allLegalEntities !== false || Boolean(legalEntityId && context.legalEntityIds?.includes(legalEntityId))
  }
  private canAccessProject(context:RequestContext,projectId:string){return context.allProjects!==false||Boolean(context.projectIds?.includes(projectId))}

  private async transaction<T>(work: (client: SqlClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const result = await work(client)
      await client.query('COMMIT')
      return result
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  private async audit(client: SqlClient, context: RequestContext, entityType: string, entityId: string, action: string, oldValue: unknown, newValue: unknown, reason?: string) {
    await client.query(`INSERT INTO audit_log
      (tenant_id, id, user_id, entity_type, entity_id, action, old_value, new_value, reason)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`, [context.tenantId, randomUUID(), context.userId, entityType, entityId, action, oldValue ? JSON.stringify(oldValue) : null, newValue ? JSON.stringify(newValue) : null, reason ?? null])
  }

  private async ensureDefaultUnits(tenantId: string) {
    await this.pool.query(`INSERT INTO unit_definitions (tenant_id,id,code,name,category) VALUES
      ($1,'00000000-0000-4000-8000-000000000201','st','Stuk','Aantal'),
      ($1,'00000000-0000-4000-8000-000000000202','GP','Globale prijs','Globaal'),
      ($1,'00000000-0000-4000-8000-000000000203','m','Meter','Lengte'),
      ($1,'00000000-0000-4000-8000-000000000204','km','Kilometer','Lengte'),
      ($1,'00000000-0000-4000-8000-000000000205','m²','Vierkante meter','Oppervlakte'),
      ($1,'00000000-0000-4000-8000-000000000206','m³','Kubieke meter','Volume'),
      ($1,'00000000-0000-4000-8000-000000000207','kg','Kilogram','Massa'),
      ($1,'00000000-0000-4000-8000-000000000208','ton','Ton','Massa'),
      ($1,'00000000-0000-4000-8000-000000000209','uur','Uur','Tijd'),
      ($1,'00000000-0000-4000-8000-000000000210','dag','Werkdag','Tijd') ON CONFLICT (tenant_id,id) DO NOTHING`, [tenantId])
    await this.pool.query(`INSERT INTO unit_conversions (tenant_id,id,from_unit_id,to_unit_id,factor) VALUES
      ($1,'00000000-0000-4000-8000-000000000301','00000000-0000-4000-8000-000000000204','00000000-0000-4000-8000-000000000203',1000),
      ($1,'00000000-0000-4000-8000-000000000302','00000000-0000-4000-8000-000000000208','00000000-0000-4000-8000-000000000207',1000),
      ($1,'00000000-0000-4000-8000-000000000303','00000000-0000-4000-8000-000000000210','00000000-0000-4000-8000-000000000209',8) ON CONFLICT (tenant_id,id) DO NOTHING`, [tenantId])
  }

  async bootstrap(context: RequestContext): Promise<BouwFlowState> {
    await this.ensureDefaultUnits(context.tenantId)
    const [users, userEntityAccess, userProjectAccess] = await Promise.all([
      this.pool.query<CompanyUserRow>('SELECT id,display_name,email,role,roles,status,employee_id,organization_id,subcontractor_id,supplier_id,all_legal_entities,all_projects FROM users WHERE tenant_id=$1 ORDER BY display_name', [context.tenantId]),
      this.pool.query<UserEntityAccessRow>('SELECT user_id,legal_entity_id FROM user_legal_entity_access WHERE tenant_id=$1', [context.tenantId]),
      this.pool.query<UserProjectAccessRow>('SELECT user_id,project_id FROM user_project_access WHERE tenant_id=$1', [context.tenantId]),
    ])
    const [peppolNotificationSettings, legalEntities, companyBranches, organizations, opportunities, calculations, chapters, items, calculationVersions, calculationScenarios, costLibraries, costLibraryVersions, costLibrary, units, unitConversions, quotes, projects, dailyReports, sitePhotos, changeOrders, progressStatements, salesInvoices, peppolValidationReports, peppolDeliveries, peppolAcceptanceRuns, peppolAlerts, peppolNotifications, intercompanyCharges, projectCosts, projectForecasts, suppliers, procurementRequests, purchaseOrders, documents, documentVersions, documentRecipients, documentRecordLinks, qhseCertificates, qhseInspections] = await Promise.all([
      this.loadPeppolNotificationSettings(this.pool, context.tenantId),
      this.pool.query<LegalEntityRow>('SELECT * FROM legal_entities WHERE tenant_id = $1 ORDER BY active DESC, name', [context.tenantId]),
      this.pool.query<CompanyBranchRow>('SELECT * FROM company_branches WHERE tenant_id = $1 ORDER BY name', [context.tenantId]),
      this.pool.query<OrganizationRow>('SELECT * FROM organizations WHERE tenant_id = $1 ORDER BY name', [context.tenantId]),
      this.pool.query<OpportunityRow>('SELECT * FROM opportunities WHERE tenant_id = $1 ORDER BY created_at', [context.tenantId]),
      this.pool.query<CalculationRow>('SELECT * FROM calculations WHERE tenant_id = $1 ORDER BY updated_at', [context.tenantId]),
      this.pool.query<BoqChapterRow>('SELECT * FROM boq_chapters WHERE tenant_id = $1 ORDER BY sort_order, code', [context.tenantId]),
      this.pool.query<BoqItemRow>('SELECT * FROM boq_items WHERE tenant_id = $1 ORDER BY sort_order, code', [context.tenantId]),
      this.pool.query<CalculationVersionRow>('SELECT * FROM calculation_versions WHERE tenant_id = $1 ORDER BY calculation_id, version', [context.tenantId]),
      this.pool.query<CalculationScenarioRow>('SELECT * FROM calculation_scenarios WHERE tenant_id = $1 ORDER BY calculation_id, name', [context.tenantId]),
      this.pool.query<CostLibraryRow>('SELECT * FROM cost_libraries WHERE tenant_id = $1 ORDER BY name', [context.tenantId]),
      this.pool.query<CostLibraryVersionRow>('SELECT * FROM cost_library_versions WHERE tenant_id = $1 ORDER BY library_id, version DESC', [context.tenantId]),
      this.pool.query<CostLibraryItemRow>('SELECT * FROM cost_library_items WHERE tenant_id = $1 ORDER BY category, code', [context.tenantId]),
      this.pool.query<UnitDefinitionRow>('SELECT * FROM unit_definitions WHERE tenant_id = $1 ORDER BY category, code', [context.tenantId]),
      this.pool.query<UnitConversionRow>('SELECT * FROM unit_conversions WHERE tenant_id = $1 ORDER BY created_at', [context.tenantId]),
      this.pool.query<QuoteRow>('SELECT * FROM quotes WHERE tenant_id = $1 ORDER BY created_at', [context.tenantId]),
      this.pool.query<ProjectRow>('SELECT * FROM projects WHERE tenant_id = $1 ORDER BY created_at', [context.tenantId]),
      this.pool.query<DailyReportRow>('SELECT * FROM daily_reports WHERE tenant_id = $1 ORDER BY report_date DESC, created_at DESC', [context.tenantId]),
      this.pool.query<SitePhotoRow>('SELECT * FROM site_photos WHERE tenant_id = $1 ORDER BY taken_at DESC, created_at DESC', [context.tenantId]),
      this.pool.query<ChangeOrderRow>('SELECT * FROM change_orders WHERE tenant_id = $1 ORDER BY change_date DESC, created_at DESC', [context.tenantId]),
      this.pool.query<ProgressStatementRow>('SELECT * FROM progress_statements WHERE tenant_id = $1 ORDER BY period_end DESC, created_at DESC', [context.tenantId]),
      this.pool.query<SalesInvoiceRow>('SELECT * FROM sales_invoices WHERE tenant_id = $1 ORDER BY invoice_date DESC, created_at DESC', [context.tenantId]),
      this.pool.query<PeppolValidationReportRow>('SELECT * FROM peppol_validation_reports WHERE tenant_id = $1 ORDER BY validated_at DESC', [context.tenantId]),
      this.pool.query<PeppolDeliveryRow>('SELECT * FROM peppol_deliveries WHERE tenant_id = $1 ORDER BY updated_at DESC', [context.tenantId]),
      this.pool.query<PeppolAcceptanceRunRow>('SELECT * FROM peppol_acceptance_runs WHERE tenant_id = $1 ORDER BY started_at DESC', [context.tenantId]),
      this.pool.query<PeppolAlertRow>('SELECT * FROM peppol_alerts WHERE tenant_id = $1 ORDER BY status, severity DESC, updated_at DESC', [context.tenantId]),
      this.pool.query<PeppolNotificationRow>('SELECT * FROM peppol_notification_outbox WHERE tenant_id = $1 ORDER BY created_at DESC', [context.tenantId]),
      this.pool.query<IntercompanyChargeRow>('SELECT * FROM intercompany_charges WHERE tenant_id = $1 ORDER BY created_at DESC', [context.tenantId]),
      this.pool.query<ProjectCostRow>('SELECT * FROM project_costs WHERE tenant_id = $1 ORDER BY cost_date DESC, created_at DESC', [context.tenantId]),
      this.pool.query<ProjectForecastRow>('SELECT * FROM project_forecasts WHERE tenant_id = $1 ORDER BY project_id, version DESC', [context.tenantId]),
      this.pool.query<SupplierRow>('SELECT * FROM suppliers WHERE tenant_id = $1 ORDER BY name', [context.tenantId]),
      this.pool.query<ProcurementRequestRow>('SELECT * FROM procurement_requests WHERE tenant_id = $1 ORDER BY needed_by, created_at', [context.tenantId]),
      this.pool.query<PurchaseOrderRow>('SELECT * FROM purchase_orders WHERE tenant_id = $1 ORDER BY order_date DESC, created_at DESC', [context.tenantId]),
      this.pool.query<DocumentRow>('SELECT * FROM documents WHERE tenant_id = $1 ORDER BY created_at DESC', [context.tenantId]),
      this.pool.query<DocumentVersionRow>('SELECT * FROM document_versions WHERE tenant_id = $1 ORDER BY document_id, revision DESC', [context.tenantId]),
      this.pool.query<DocumentRecipientRow>('SELECT * FROM document_recipients WHERE tenant_id = $1 ORDER BY delivered_at DESC', [context.tenantId]),
      this.pool.query<DocumentRecordLinkRow>('SELECT * FROM document_record_links WHERE tenant_id = $1 ORDER BY created_at DESC', [context.tenantId]),
      this.pool.query<QhseCertificateRow>('SELECT * FROM qhse_certificates WHERE tenant_id = $1 ORDER BY expires_on, created_at DESC', [context.tenantId]),
      this.pool.query<QhseInspectionRow>('SELECT * FROM qhse_inspections WHERE tenant_id = $1 ORDER BY inspection_date DESC, created_at DESC', [context.tenantId]),
    ])
    const canManageAccess = context.roles.some(role => ['Administrator', 'Directie'].includes(role))
    const canViewPeppolNotificationSettings = context.roles.some(role => ['Administrator', 'Directie', 'Financiële administratie'].includes(role))
    const companyUsers: CompanyUser[] = users.rows.filter(row => canManageAccess || row.id === context.userId).map(row => ({
      id: row.id, displayName: row.display_name, email: row.email, role: row.role, roles: [...new Set([row.role, ...jsonValue<string[]>(row.roles ?? [])])], status:row.status as CompanyUser['status'], employeeId:row.employee_id??undefined, organizationId:row.organization_id??undefined, subcontractorId:row.subcontractor_id??undefined, supplierId:row.supplier_id??undefined, allLegalEntities: row.all_legal_entities, allProjects:row.all_projects,
      legalEntityIds: userEntityAccess.rows.filter(item => item.user_id === row.id).map(item => item.legal_entity_id),
      projectIds:userProjectAccess.rows.filter(item=>item.user_id===row.id).map(item=>item.project_id),
    }))
    const operationsResult = await this.pool.query<OperationsStateRow>('SELECT * FROM operations_state WHERE tenant_id=$1', [context.tenantId])
    const operations = operationsResult.rows[0]
    const blueprintResult = await this.pool.query<BlueprintStateRow>('SELECT * FROM blueprint_state WHERE tenant_id=$1', [context.tenantId])
    const blueprint = blueprintResult.rows[0]
    const checkinatworkResult = await this.pool.query<CheckinatworkStateRow>('SELECT * FROM checkinatwork_state WHERE tenant_id=$1', [context.tenantId])
    const checkinatwork = checkinatworkResult.rows[0]
    const state: BouwFlowState = {
      currentUserId: context.userId,
      companyUsers,
      workflowDefinitions:blueprint&&jsonValue<WorkflowDefinition[]>(blueprint.workflow_definitions).length?jsonValue<WorkflowDefinition[]>(blueprint.workflow_definitions):defaultWorkflowDefinitions,
      workflowCorrections: [],
      legalEntities: legalEntities.rows.map(mapLegalEntity),
      companyBranches: companyBranches.rows.map(mapCompanyBranch),
      organizations: organizations.rows.map(mapOrganization),
      opportunities: opportunities.rows.map(mapOpportunity),
      calculations: calculations.rows.map(row => mapCalculation(row, chapters.rows.filter(chapter => chapter.calculation_id === row.id).map(mapChapter), items.rows.filter(item => item.calculation_id === row.id).map(mapItem))),
      calculationVersions: calculationVersions.rows.map(row => ({ id: row.id, calculationId: row.calculation_id, version: Number(row.version), label: row.label, reason: row.reason, snapshot: row.snapshot, createdAt: iso(row.created_at), createdBy: row.created_by })),
      calculationScenarios: calculationScenarios.rows.map(mapCalculationScenario),
      costLibraries: costLibraries.rows.map(mapCostLibrary),
      costLibraryVersions: costLibraryVersions.rows.map(mapCostLibraryVersion),
      costLibrary: costLibrary.rows.map(mapCostLibraryItem),
      units: units.rows.map(mapUnit),
      unitConversions: unitConversions.rows.map(mapUnitConversion),
      quotes: quotes.rows.map(mapQuote),
      projects: projects.rows.map(row => this.mapProject(row)),
      dailyReports: dailyReports.rows.map(mapDailyReport),
      sitePhotos: sitePhotos.rows.map(mapSitePhoto),
      changeOrders: changeOrders.rows.map(mapChangeOrder),
      progressStatements: progressStatements.rows.map(mapProgressStatement),
      salesInvoices: salesInvoices.rows.map(mapSalesInvoice),
      peppolValidationReports: peppolValidationReports.rows.map(mapPeppolValidationReport),
      peppolDeliveries: peppolDeliveries.rows.map(mapPeppolDelivery),
      peppolAcceptanceRuns: peppolAcceptanceRuns.rows.map(mapPeppolAcceptanceRun),
      peppolAlerts: peppolAlerts.rows.map(mapPeppolAlert),
      peppolNotifications: peppolNotifications.rows.map(mapPeppolNotification),
      peppolNotificationSettings: canViewPeppolNotificationSettings ? peppolNotificationSettings : { ...peppolNotificationSettings, emailRecipients: [], teamsTargets: [] },
      intercompanyCharges: intercompanyCharges.rows.map(mapIntercompanyCharge),
      projectCosts: projectCosts.rows.map(mapProjectCost),
      projectForecasts: projectForecasts.rows.map(mapProjectForecast),
      suppliers: suppliers.rows.map(mapSupplier),
      procurementRequests: procurementRequests.rows.map(mapProcurementRequest),
      purchaseOrders: purchaseOrders.rows.map(mapPurchaseOrder),
      documents: documents.rows.map(row => mapDocument(row, documentVersions.rows, documentRecipients.rows, documentRecordLinks.rows)),
      qhseCertificates: qhseCertificates.rows.map(mapQhseCertificate),
      qhseInspections: qhseInspections.rows.map(mapQhseInspection),
      assets: operations ? jsonValue<Asset[]>(operations.assets) : [],
      warehouses: operations ? jsonValue<Warehouse[]>(operations.warehouses) : [],
      inventoryItems: operations ? jsonValue<InventoryItem[]>(operations.inventory_items) : [],
      stockMovements: operations ? jsonValue<StockMovement[]>(operations.stock_movements) : [],
      subcontractors: blueprint ? jsonValue<Subcontractor[]>(blueprint.subcontractors) : [],
      qhseEvents: blueprint ? jsonValue<QhseEvent[]>(blueprint.qhse_events) : [],
      jointVentures: blueprint ? jsonValue<JointVenture[]>(blueprint.joint_ventures) : [],
      integrationConnections: blueprint ? jsonValue<IntegrationConnection[]>(blueprint.integration_connections) : [],
      integrationJobs: blueprint ? jsonValue<IntegrationJob[]>(blueprint.integration_jobs) : [],
      aiAnalyses: blueprint ? jsonValue<AiAnalysis[]>(blueprint.ai_analyses) : [],
      projectContracts: blueprint ? jsonValue<ProjectContract[]>(blueprint.project_contracts).map(item => ({ ...item, approvalStatus:item.approvalStatus ?? 'Concept' })) : [],
      projectCloseouts: blueprint ? jsonValue<ProjectCloseout[]>(blueprint.project_closeouts) : [],
      employees: blueprint ? jsonValue<Employee[]>(blueprint.employees) : [],
      employeeAbsences: blueprint ? jsonValue<EmployeeAbsence[]>(blueprint.employee_absences) : [],
      employeeCrews: blueprint ? jsonValue<EmployeeCrew[]>(blueprint.employee_crews) : [],
      workTickets: blueprint ? jsonValue<WorkTicket[]>(blueprint.work_tickets) : [],
      timeEntries: blueprint ? jsonValue<TimeEntry[]>(blueprint.time_entries) : [],
      checkinatworkSites: checkinatwork ? jsonValue<CheckinatworkSite[]>(checkinatwork.sites) : [],
      checkinatworkParticipants: checkinatwork ? jsonValue<CheckinatworkParticipant[]>(checkinatwork.participants).map(participant => ({ ...participant, secureIdentityReference: undefined })) : [],
      checkinatworkRegistrations: checkinatwork ? jsonValue<CheckinatworkRegistration[]>(checkinatwork.registrations) : [],
      checkinatworkAuditEvents: checkinatwork ? jsonValue<CheckinatworkAuditEvent[]>(checkinatwork.audit_events) : [],
      checkinatworkIntegrationStatus: {
        simulationAvailable: true,
        productionConfigured: this.checkinatworkGateway.productionConfigured,
        productionEnabled: this.checkinatworkGateway.productionEnabled,
        provider: this.checkinatworkGateway.provider,
        protocol: 'RSZ PresenceRegistration v1.11 \u00b7 SAML Holder-of-Key SHA-256',
        lastCheckedAt: new Date().toISOString(),
      },
      projectClaims: blueprint ? jsonValue<ProjectClaim[]>(blueprint.project_claims) : [],
    }
    const externallyScopedState = scopeExternalBootstrap(state, context)
    if (externallyScopedState !== state) return externallyScopedState
    if (context.allLegalEntities !== false && context.allProjects !== false) return state
    const allowedEntities = new Set(context.legalEntityIds ?? [])
    const allowedProjects=new Set(context.projectIds??[])
    const entityAllowed=(id:string|undefined)=>context.allLegalEntities!==false||Boolean(id&&allowedEntities.has(id))
    const projectAllowed=(id:string)=>context.allProjects!==false||allowedProjects.has(id)
    const visibleOpportunities = state.opportunities.filter(opportunity => entityAllowed(opportunity.legalEntityId))
    const visibleOpportunityIds = new Set(visibleOpportunities.map(opportunity => opportunity.id))
    const visibleCalculations = state.calculations.filter(calculation => visibleOpportunityIds.has(calculation.opportunityId))
    const visibleCalculationIds = new Set(visibleCalculations.map(calculation => calculation.id))
    const visibleProjects = state.projects.filter(project => entityAllowed(project.legalEntityId)&&projectAllowed(project.id))
    const visibleProjectIds = new Set(visibleProjects.map(project => project.id))
    const visibleCostLibraries = state.costLibraries.filter(library => !library.legalEntityId || entityAllowed(library.legalEntityId))
    const visibleCostLibraryIds = new Set(visibleCostLibraries.map(library => library.id))
    const visibleCostLibraryVersions = state.costLibraryVersions.filter(version => visibleCostLibraryIds.has(version.libraryId))
    const visibleCostLibraryVersionIds = new Set(visibleCostLibraryVersions.map(version => version.id))
    return {
      ...state,
      legalEntities: state.legalEntities.filter(entity => entityAllowed(entity.id)),
      companyBranches: state.companyBranches.filter(branch => entityAllowed(branch.legalEntityId)),
      opportunities: visibleOpportunities,
      calculations: visibleCalculations,
      calculationVersions: state.calculationVersions.filter(item => visibleCalculationIds.has(item.calculationId)),
      calculationScenarios: state.calculationScenarios.filter(item => visibleCalculationIds.has(item.calculationId)),
      quotes: state.quotes.filter(item => visibleCalculationIds.has(item.calculationId)),
      costLibraries: visibleCostLibraries,
      costLibraryVersions: visibleCostLibraryVersions,
      costLibrary: state.costLibrary.filter(item => !item.libraryVersionId || visibleCostLibraryVersionIds.has(item.libraryVersionId)),
      projects: visibleProjects,
      checkinatworkSites: state.checkinatworkSites.filter(item => visibleProjectIds.has(item.projectId)),
      checkinatworkParticipants: state.checkinatworkParticipants.filter(item => visibleProjectIds.has(item.projectId)),
      checkinatworkRegistrations: state.checkinatworkRegistrations.filter(item => visibleProjectIds.has(item.projectId)),
      checkinatworkAuditEvents: state.checkinatworkAuditEvents.filter(item => visibleProjectIds.has(item.projectId)),
      dailyReports: state.dailyReports.filter(item => visibleProjectIds.has(item.projectId)),
      sitePhotos: state.sitePhotos.filter(item => visibleProjectIds.has(item.projectId)),
      changeOrders: state.changeOrders.filter(item => visibleProjectIds.has(item.projectId)),
      progressStatements: state.progressStatements.filter(item => visibleProjectIds.has(item.projectId)),
      salesInvoices: state.salesInvoices.filter(item => visibleProjectIds.has(item.projectId)),
      peppolValidationReports: state.peppolValidationReports.filter(report => state.salesInvoices.some(invoice => invoice.id === report.invoiceId && visibleProjectIds.has(invoice.projectId))),
      peppolDeliveries: state.peppolDeliveries.filter(delivery => state.salesInvoices.some(invoice => invoice.id === delivery.invoiceId && visibleProjectIds.has(invoice.projectId))),
      peppolAcceptanceRuns: state.peppolAcceptanceRuns.filter(run => state.salesInvoices.some(invoice => invoice.id === run.invoiceId && visibleProjectIds.has(invoice.projectId))),
      peppolAlerts: state.peppolAlerts.filter(alert => state.salesInvoices.some(invoice => invoice.id === alert.invoiceId && visibleProjectIds.has(invoice.projectId))),
      peppolNotifications: state.peppolNotifications.filter(notification => state.peppolAlerts.some(alert => alert.id === notification.alertId && state.salesInvoices.some(invoice => invoice.id === alert.invoiceId && visibleProjectIds.has(invoice.projectId)))),
      intercompanyCharges: [],
      projectCosts: state.projectCosts.filter(item => visibleProjectIds.has(item.projectId)),
      projectForecasts: state.projectForecasts.filter(item => visibleProjectIds.has(item.projectId)),
      procurementRequests: state.procurementRequests.filter(item => visibleProjectIds.has(item.projectId)),
      purchaseOrders: state.purchaseOrders.filter(item => visibleProjectIds.has(item.projectId)),
      documents: state.documents.filter(item => visibleProjectIds.has(item.projectId)),
      qhseCertificates: state.qhseCertificates.filter(item => visibleProjectIds.has(item.projectId)),
      qhseInspections: state.qhseInspections.filter(item => visibleProjectIds.has(item.projectId)),
      assets: state.assets.filter(item => !item.projectId || visibleProjectIds.has(item.projectId)),
      stockMovements: state.stockMovements.filter(item => !item.projectId || visibleProjectIds.has(item.projectId)),
      subcontractors: state.subcontractors.filter(item => !item.projectIds.length || item.projectIds.some(id => visibleProjectIds.has(id))),
      qhseEvents: state.qhseEvents.filter(item => visibleProjectIds.has(item.projectId)),
      jointVentures: state.jointVentures.filter(item => !item.projectId || visibleProjectIds.has(item.projectId)),
      integrationConnections: state.integrationConnections.filter(item => allowedEntities.has(item.legalEntityId)),
      integrationJobs: state.integrationJobs.filter(item => state.integrationConnections.some(connection => connection.id === item.connectionId && allowedEntities.has(connection.legalEntityId))),
      aiAnalyses: state.aiAnalyses.filter(item => visibleProjectIds.has(item.projectId)),
      projectContracts: state.projectContracts.filter(item => visibleProjectIds.has(item.projectId)),
      projectCloseouts: state.projectCloseouts.filter(item => visibleProjectIds.has(item.projectId)),
      employees: state.employees.filter(item => entityAllowed(item.legalEntityId)),
      employeeAbsences: state.employeeAbsences.filter(item => state.employees.some(employee => employee.id === item.employeeId && entityAllowed(employee.legalEntityId))),
      employeeCrews: state.employeeCrews.filter(item => entityAllowed(item.legalEntityId)),
      workTickets: state.workTickets.filter(item => visibleProjectIds.has(item.projectId)),
      timeEntries: state.timeEntries.filter(item => visibleProjectIds.has(item.projectId)),
      projectClaims: state.projectClaims.filter(item => visibleProjectIds.has(item.projectId)),
    }
  }

  async createLegalEntity(context: RequestContext, input: LegalEntityInput): Promise<LegalEntity> {
    return this.transaction(async client => {
      const duplicate = await client.query('SELECT id FROM legal_entities WHERE tenant_id=$1 AND vat_number=$2', [context.tenantId, input.vatNumber])
      if (duplicate.rowCount) throw new RepositoryError('Er bestaat al een juridische entiteit met dit btw-nummer', 409)
      const entity: LegalEntity = { id: randomUUID(), ...input, invoicePrefix: input.invoicePrefix ?? 'VF', nextInvoiceNumber: input.nextInvoiceNumber ?? 1, defaultVatPct: input.defaultVatPct ?? 21, iban: input.iban ?? '', bic: input.bic ?? '', paymentTermsDays: input.paymentTermsDays ?? 30, addressLine: input.addressLine ?? '', postalCode: input.postalCode ?? '', city: input.city ?? '', countryCode: input.countryCode ?? 'BE', peppolEndpointId: input.peppolEndpointId ?? '', peppolSchemeId: input.peppolSchemeId ?? '0208', createdAt: new Date().toISOString() }
      await client.query(`INSERT INTO legal_entities (tenant_id,id,name,vat_number,country,currency,active,invoice_prefix,next_invoice_number,default_vat_pct,iban,bic,payment_terms_days,address_line,postal_code,city,country_code,peppol_endpoint_id,peppol_scheme_id,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`, [context.tenantId, entity.id, entity.name, entity.vatNumber, entity.country, entity.currency, entity.active, entity.invoicePrefix, entity.nextInvoiceNumber, entity.defaultVatPct, entity.iban, entity.bic, entity.paymentTermsDays, entity.addressLine, entity.postalCode, entity.city, entity.countryCode, entity.peppolEndpointId, entity.peppolSchemeId, entity.createdAt])
      await this.audit(client, context, 'legal_entity', entity.id, 'created', null, entity)
      return entity
    })
  }

  async createOrganization(context: RequestContext, input: OrganizationInput): Promise<Organization> {
    return this.transaction(async client => {
      const duplicate = await client.query('SELECT id FROM organizations WHERE tenant_id=$1 AND (lower(name)=lower($2) OR ($3 <> \'\' AND vat_number=$3))', [context.tenantId, input.name, input.vatNumber])
      if (duplicate.rowCount) throw new RepositoryError('Er bestaat al een relatie met deze naam of dit btw-nummer', 409)
      const organization: Organization = { id: randomUUID(), ...input }
      await client.query(`INSERT INTO organizations (tenant_id,id,name,type,contact_name,email,vat_number,address_line,postal_code,city,country_code,peppol_endpoint_id,peppol_scheme_id,roles,contacts,addresses)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`, [context.tenantId, organization.id, organization.name, organization.type, organization.contactName, organization.email, organization.vatNumber, organization.addressLine, organization.postalCode, organization.city, organization.countryCode, organization.peppolEndpointId, organization.peppolSchemeId, JSON.stringify(organization.roles ?? []), JSON.stringify(organization.contacts ?? []), JSON.stringify(organization.addresses ?? [])])
      await this.audit(client, context, 'organization', organization.id, 'created', null, organization)
      return organization
    })
  }

  async updateOrganization(context: RequestContext, organizationId: string, input: OrganizationInput): Promise<Organization> {
    return this.transaction(async client => {
      const result = await client.query<OrganizationRow>('SELECT * FROM organizations WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [context.tenantId, organizationId])
      if (!result.rowCount) throw new RepositoryError('Organisatie niet gevonden', 404)
      const duplicate = await client.query('SELECT id FROM organizations WHERE tenant_id=$1 AND id<>$2 AND (lower(name)=lower($3) OR ($4 <> \'\' AND vat_number=$4))', [context.tenantId, organizationId, input.name, input.vatNumber])
      if (duplicate.rowCount) throw new RepositoryError('Er bestaat al een relatie met deze naam of dit btw-nummer', 409)
      const previous = mapOrganization(result.rows[0])
      await client.query(`UPDATE organizations SET name=$3,type=$4,contact_name=$5,email=$6,vat_number=$7,address_line=$8,postal_code=$9,city=$10,country_code=$11,peppol_endpoint_id=$12,peppol_scheme_id=$13,roles=$14,contacts=$15,addresses=$16 WHERE tenant_id=$1 AND id=$2`, [context.tenantId, organizationId, input.name, input.type, input.contactName, input.email, input.vatNumber, input.addressLine, input.postalCode, input.city, input.countryCode, input.peppolEndpointId, input.peppolSchemeId, JSON.stringify(input.roles ?? []), JSON.stringify(input.contacts ?? []), JSON.stringify(input.addresses ?? [])])
      const updated: Organization = { id: organizationId, ...input }
      await client.query('UPDATE suppliers SET name=$3,vat_number=$4,contact_name=$5,email=$6 WHERE tenant_id=$1 AND organization_id=$2', [context.tenantId, organizationId, updated.name, updated.vatNumber, updated.contactName, updated.email])
      const blueprint = await this.blueprintState(client, context.tenantId)
      if (blueprint.subcontractors.some(item => item.organizationId === organizationId)) {
        blueprint.subcontractors = blueprint.subcontractors.map(item => item.organizationId === organizationId ? { ...item, name: updated.name, vatNumber: updated.vatNumber, contactName: updated.contactName, email: updated.email } : item)
        await this.saveBlueprintState(client, context.tenantId, blueprint)
      }
      await this.audit(client, context, 'organization', organizationId, 'updated', previous, updated)
      return updated
    })
  }

  async addCrmActivity(context: RequestContext, organizationId: string, input: Omit<CrmActivity, 'id' | 'createdAt'>): Promise<Organization> {
    return this.transaction(async client => {
      const result = await client.query<OrganizationRow>('SELECT * FROM organizations WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [context.tenantId, organizationId])
      if (!result.rowCount) throw new RepositoryError('Relatie niet gevonden', 404)
      const current = mapOrganization(result.rows[0])
      if (input.contactId && !(current.contacts ?? []).some(contact => contact.id === input.contactId)) throw new RepositoryError('De contactpersoon behoort niet tot deze relatie', 409)
      if (input.ownerEmployeeId) {
        const blueprint = await this.blueprintState(client, context.tenantId)
        if (!blueprint.employees.some(employee => employee.id === input.ownerEmployeeId && employee.active)) throw new RepositoryError('Selecteer een actieve medewerker als eigenaar', 409)
      }
      const activity: CrmActivity = { id: randomUUID(), ...input, createdAt: new Date().toISOString() }
      const updated: Organization = { ...current, activities: [activity, ...(current.activities ?? [])] }
      await client.query('UPDATE organizations SET activities=$3 WHERE tenant_id=$1 AND id=$2', [context.tenantId, organizationId, JSON.stringify(updated.activities)])
      await this.audit(client, context, 'organization', organizationId, 'crm_activity_added', current, updated, input.subject)
      return updated
    })
  }

  async addOrganizationRelation(context: RequestContext, organizationId: string, input: Omit<OrganizationRelation, 'id' | 'createdAt'>): Promise<Organization> {
    return this.transaction(async client => {
      if (organizationId === input.relatedOrganizationId) throw new RepositoryError('Een relatie kan niet aan zichzelf worden gekoppeld', 409)
      const result = await client.query<OrganizationRow>('SELECT * FROM organizations WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [context.tenantId, organizationId])
      const related = await client.query('SELECT id FROM organizations WHERE tenant_id=$1 AND id=$2', [context.tenantId, input.relatedOrganizationId])
      if (!result.rowCount || !related.rowCount) throw new RepositoryError('Relatie niet gevonden', 404)
      const current = mapOrganization(result.rows[0])
      if ((current.relations ?? []).some(item => item.relatedOrganizationId === input.relatedOrganizationId && item.type === input.type)) throw new RepositoryError('Deze ondernemingsrelatie bestaat al', 409)
      const relation: OrganizationRelation = { id: randomUUID(), ...input, createdAt: new Date().toISOString() }
      const updated: Organization = { ...current, relations: [relation, ...(current.relations ?? [])] }
      await client.query('UPDATE organizations SET relations=$3 WHERE tenant_id=$1 AND id=$2', [context.tenantId, organizationId, JSON.stringify(updated.relations)])
      await this.audit(client, context, 'organization', organizationId, 'organization_relation_added', current, updated, input.type)
      return updated
    })
  }

  async saveTenderDossier(context: RequestContext, opportunityId: string, tender: TenderDossier): Promise<Opportunity> {
    return this.transaction(async client => {
      const result = await client.query<OpportunityRow>('SELECT * FROM opportunities WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [context.tenantId, opportunityId])
      if (!result.rowCount) throw new RepositoryError('Opportuniteit niet gevonden', 404)
      const current = mapOpportunity(result.rows[0])
      if (tender.requiredDocumentIds.length) {
        const documents = await client.query<{ id:string } & QueryResultRow>('SELECT id FROM documents WHERE tenant_id=$1 AND id=ANY($2::uuid[])', [context.tenantId, tender.requiredDocumentIds])
        if (documents.rowCount !== tender.requiredDocumentIds.length) throw new RepositoryError('Een of meer tenderdocumenten zijn niet beschikbaar', 409)
      }
      const updated: Opportunity = { ...current, tender: { ...tender, updatedAt: new Date().toISOString() } }
      await client.query('UPDATE opportunities SET tender=$3,deadline=$4,recognition=$5,updated_at=now() WHERE tenant_id=$1 AND id=$2', [context.tenantId, opportunityId, JSON.stringify(updated.tender), tender.submissionDeadline.slice(0,10), [tender.recognitionClass,tender.recognitionCategory].filter(Boolean).join(' ')])
      await this.audit(client, context, 'opportunity', opportunityId, 'tender_dossier_updated', current, updated)
      return updated
    })
  }

  async updateOrganizationBilling(context: RequestContext, organizationId: string, input: OrganizationBillingInput): Promise<Organization> {
    return this.transaction(async client => {
      const result = await client.query<OrganizationRow>('SELECT * FROM organizations WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [context.tenantId, organizationId])
      if (!result.rowCount) throw new RepositoryError('Organisatie niet gevonden', 404)
      const previous = mapOrganization(result.rows[0])
      const currentAddresses = previous.addresses?.length ? previous.addresses : [{
        id: randomUUID(), type: 'Bezoekadres' as const, label: 'Hoofdadres', addressLine: previous.addressLine,
        postalCode: previous.postalCode, city: previous.city, countryCode: previous.countryCode, isPrimary: true, notes: '',
      }]
      const billingIndex = currentAddresses.findIndex(address => address.type === 'Facturatieadres')
      const billingAddress = {
        id: billingIndex >= 0 ? currentAddresses[billingIndex].id : randomUUID(),
        type: 'Facturatieadres' as const,
        label: billingIndex >= 0 ? currentAddresses[billingIndex].label : 'Facturatie',
        addressLine: input.addressLine,
        postalCode: input.postalCode,
        city: input.city,
        countryCode: input.countryCode,
        isPrimary: billingIndex >= 0 ? currentAddresses[billingIndex].isPrimary : false,
        notes: billingIndex >= 0 ? currentAddresses[billingIndex].notes : '',
      }
      const addresses = billingIndex >= 0
        ? currentAddresses.map((address, index) => index === billingIndex ? billingAddress : address)
        : [...currentAddresses, billingAddress]
      await client.query('UPDATE organizations SET vat_number=$3,address_line=$4,postal_code=$5,city=$6,country_code=$7,peppol_endpoint_id=$8,peppol_scheme_id=$9,addresses=$10 WHERE tenant_id=$1 AND id=$2', [context.tenantId, organizationId, input.vatNumber, input.addressLine, input.postalCode, input.city, input.countryCode, input.peppolEndpointId, input.peppolSchemeId, JSON.stringify(addresses)])
      const updated: Organization = { ...previous, ...input, addresses }
      await this.audit(client, context, 'organization', organizationId, 'billing_profile_updated', previous, updated)
      return updated
    })
  }

  private async requireProject(client: SqlClient, context: RequestContext, projectId: string) {
    const result = await client.query<{ legal_entity_id: string | null } & QueryResultRow>('SELECT legal_entity_id FROM projects WHERE tenant_id=$1 AND id=$2', [context.tenantId, projectId])
    if (!result.rowCount) throw new RepositoryError('Project niet gevonden', 404)
    if (!this.canAccessEntity(context, result.rows[0].legal_entity_id)) throw new RepositoryError('Je hebt geen toegang tot dit project', 403)
    if(!this.canAccessProject(context,projectId))throw new RepositoryError('Dit project is niet aan jouw account toegewezen',403)
  }

  private async requireProjectDocuments(client:SqlClient,context:RequestContext,projectId:string,documentIds:string[]|undefined){
    for(const documentId of documentIds??[]){const result=await client.query('SELECT id FROM documents WHERE tenant_id=$1 AND id=$2 AND project_id=$3',[context.tenantId,documentId,projectId]);if(!result.rowCount)throw new RepositoryError('Een gekoppeld contractdocument behoort niet tot dit project',409)}
  }

  private async requireClientProject(client: SqlClient, context: RequestContext, projectId: string) {
    if (!context.roles.includes('Klant')) return
    const result = await client.query<OrganizationRow>('SELECT o.* FROM projects p JOIN organizations o ON o.tenant_id=p.tenant_id AND o.id=p.organization_id WHERE p.tenant_id=$1 AND p.id=$2', [context.tenantId, projectId])
    if (!result.rowCount) throw new RepositoryError('Project of klantrelatie niet gevonden', 404)
    const organization = mapOrganization(result.rows[0])
    const emails = new Set([organization.email, ...(organization.contacts ?? []).map(contact => contact.email)].map(email => email.toLowerCase()))
    if (!emails.has(context.email.toLowerCase())) throw new RepositoryError('Deze klantaccount is niet aan dit project gekoppeld', 403)
  }

  private async requireExternalDocumentAccess(context: RequestContext, versionId: string) {
    const externalRoles = context.roles.filter(role => ['Klant', 'Onderaannemer', 'Leverancier'].includes(role))
    if (!externalRoles.length || context.roles.some(role => !['Klant', 'Onderaannemer', 'Leverancier'].includes(role))) return
    if (externalRoles.includes('Leverancier')) throw new RepositoryError('Leveranciersaccounts hebben geen toegang tot interne projectdocumenten', 403)

    const documentResult = await this.pool.query<(DocumentRow & QueryResultRow)>(`SELECT d.* FROM document_versions v
      JOIN documents d ON d.tenant_id=v.tenant_id AND d.id=v.document_id
      WHERE v.tenant_id=$1 AND v.id=$2`, [context.tenantId, versionId])
    if (!documentResult.rowCount) throw new RepositoryError('Documentversie niet gevonden', 404)
    const document = documentResult.rows[0]
    if (externalRoles.includes('Klant')) {
      if (document.status !== 'Goedgekeurd') throw new RepositoryError('Klantaccounts mogen alleen goedgekeurde documenten raadplegen', 403)
      await this.requireClientProject(this.pool as unknown as SqlClient, context, document.project_id)
      return
    }

    const blueprint = await this.pool.query<BlueprintStateRow>('SELECT * FROM blueprint_state WHERE tenant_id=$1', [context.tenantId])
    const subcontractors = blueprint.rowCount ? jsonValue<Subcontractor[]>(blueprint.rows[0].subcontractors) : []
    const ownSubcontractors = subcontractors.filter(item => normalizedEmail(item.email) === normalizedEmail(context.email) && item.projectIds.includes(document.project_id))
    if (!ownSubcontractors.length) throw new RepositoryError('Deze onderaannemeraccount is niet aan het project gekoppeld', 403)
    const permittedCategory = ['Plan', 'Veiligheid', 'Vergunning'].includes(document.category)
    const links = await this.pool.query<{ record_id: string } & QueryResultRow>("SELECT record_id FROM document_record_links WHERE tenant_id=$1 AND document_id=$2 AND link_type='Onderaannemer'", [context.tenantId, document.id])
    const linkedToOwnDossier = links.rows.some(link => ownSubcontractors.some(item => item.id === link.record_id))
    if (!linkedToOwnDossier && !(document.status === 'Goedgekeurd' && permittedCategory)) throw new RepositoryError('Dit document is niet voor deze onderaannemer vrijgegeven', 403)
  }

  private async operationalState(client: SqlClient, tenantId: string) {
    const result = await client.query<OperationsStateRow>('SELECT * FROM operations_state WHERE tenant_id=$1 FOR UPDATE', [tenantId])
    if (!result.rowCount) return { assets: [] as Asset[], warehouses: [] as Warehouse[], inventoryItems: [] as InventoryItem[], stockMovements: [] as StockMovement[] }
    const row = result.rows[0]
    return { assets: jsonValue<Asset[]>(row.assets), warehouses: jsonValue<Warehouse[]>(row.warehouses), inventoryItems: jsonValue<InventoryItem[]>(row.inventory_items), stockMovements: jsonValue<StockMovement[]>(row.stock_movements) }
  }

  private async saveOperationalState(client: SqlClient, tenantId: string, state: { assets: Asset[]; warehouses: Warehouse[]; inventoryItems: InventoryItem[]; stockMovements: StockMovement[] }) {
    await client.query(`INSERT INTO operations_state (tenant_id,assets,warehouses,inventory_items,stock_movements,updated_at) VALUES ($1,$2,$3,$4,$5,now()) ON CONFLICT (tenant_id) DO UPDATE SET assets=EXCLUDED.assets,warehouses=EXCLUDED.warehouses,inventory_items=EXCLUDED.inventory_items,stock_movements=EXCLUDED.stock_movements,updated_at=now()`, [tenantId, JSON.stringify(state.assets), JSON.stringify(state.warehouses), JSON.stringify(state.inventoryItems), JSON.stringify(state.stockMovements)])
  }

  async createAsset(context: RequestContext, input: AssetInput): Promise<Asset> {
    return this.transaction(async client => {
      const state = await this.operationalState(client, context.tenantId)
      if (state.assets.some(item => item.code.toLocaleLowerCase() === input.code.toLocaleLowerCase())) throw new RepositoryError('Er bestaat al materieel met deze code', 409)
      if (input.projectId) await this.requireProject(client, context, input.projectId)
      const asset: Asset = { id: randomUUID(), ...input }
      state.assets.push(asset); await this.saveOperationalState(client, context.tenantId, state); await this.audit(client, context, 'asset', asset.id, 'created', null, asset)
      return asset
    })
  }

  async addAssetOperation(context: RequestContext, assetId:string, input:AssetOperationalInput):Promise<Asset>{
    return this.transaction(async client=>{const state=await this.operationalState(client,context.tenantId);const current=state.assets.find(item=>item.id===assetId);if(!current)throw new RepositoryError('Materieel niet gevonden',404);if(input.kind==='reservation'){await this.requireProject(client,context,input.value.projectId);const overlap=(current.reservations??[]).some(item=>item.status!=='Geannuleerd'&&item.startDate<=input.value.endDate&&item.endDate>=input.value.startDate);if(overlap)throw new RepositoryError('Dit materieel is in deze periode al gereserveerd',409)}const id=randomUUID();const updated:Asset=input.kind==='maintenance'?{...current,maintenanceOrders:[{id,...input.value},...(current.maintenanceOrders??[])]}:input.kind==='damage'?{...current,status:'Defect',damageReports:[{id,...input.value},...(current.damageReports??[])]}:input.kind==='fuel'?{...current,mileage:input.value.mileage??current.mileage,operatingHours:input.value.operatingHours??current.operatingHours,fuelEntries:[{id,...input.value},...(current.fuelEntries??[])]}:{...current,reservations:[{id,...input.value},...(current.reservations??[])]};state.assets=state.assets.map(item=>item.id===assetId?updated:item);await this.saveOperationalState(client,context.tenantId,state);await this.audit(client,context,'asset',assetId,`${input.kind}_added`,current,updated);return updated})
  }

  async createWarehouse(context: RequestContext, input: WarehouseInput): Promise<Warehouse> {
    return this.transaction(async client => {
      const state = await this.operationalState(client, context.tenantId)
      const warehouse: Warehouse = { id: randomUUID(), ...input }
      state.warehouses.push(warehouse); await this.saveOperationalState(client, context.tenantId, state); await this.audit(client, context, 'warehouse', warehouse.id, 'created', null, warehouse)
      return warehouse
    })
  }

  async createInventoryItem(context: RequestContext, input: InventoryItemInput): Promise<InventoryItem> {
    return this.transaction(async client => {
      const state = await this.operationalState(client, context.tenantId)
      if (state.inventoryItems.some(item => item.sku.toLocaleLowerCase() === input.sku.toLocaleLowerCase())) throw new RepositoryError('Er bestaat al een artikel met deze code', 409)
      const item: InventoryItem = { id: randomUUID(), ...input, stocks: [],lots:[],counts:[] }
      state.inventoryItems.push(item); await this.saveOperationalState(client, context.tenantId, state); await this.audit(client, context, 'inventory_item', item.id, 'created', null, item)
      return item
    })
  }

  async registerStockMovement(context: RequestContext, input: StockMovementInput): Promise<{ item: InventoryItem; movement: StockMovement }> {
    return this.transaction(async client => {
      const state = await this.operationalState(client, context.tenantId)
      const item = state.inventoryItems.find(entry => entry.id === input.inventoryItemId)
      if (!item || !state.warehouses.some(entry => entry.id === input.warehouseId)) throw new RepositoryError('Artikel of magazijn niet gevonden', 404)
      if (input.projectId) await this.requireProject(client, context, input.projectId)
      const stock = item.stocks.find(entry => entry.warehouseId === input.warehouseId) ?? { warehouseId: input.warehouseId, quantity: 0, reserved: 0 }
      const quantityDelta = input.type === 'Ontvangst' || input.type === 'Retour' ? input.quantity : input.type === 'Uitgifte' ? -input.quantity : input.type === 'Correctie' ? input.quantity : 0
      const reservedDelta = input.type === 'Reservatie' ? input.quantity : input.type === 'Vrijgave' ? -input.quantity : input.type === 'Uitgifte' ? -Math.min(stock.reserved, input.quantity) : 0
      const nextStock = { ...stock, quantity: stock.quantity + quantityDelta, reserved: Math.max(0, stock.reserved + reservedDelta) }
      if (nextStock.quantity < 0 || nextStock.reserved > nextStock.quantity) throw new RepositoryError('Onvoldoende vrije voorraad voor deze beweging', 409)
      const updated:InventoryItem = { ...item, stocks: [...item.stocks.filter(level => level.warehouseId !== input.warehouseId), nextStock] }
      if(item.lotTracking&&!input.lotNumber)throw new RepositoryError('Lotnummer is verplicht voor dit artikel',409)
      if(item.serialTracking&&(!input.serialNumbers?.length||input.serialNumbers.length!==input.quantity))throw new RepositoryError('Registreer exact één serienummer per stuk',409)
      if(input.lotNumber){const lot=(item.lots??[]).find(entry=>entry.lotNumber===input.lotNumber&&entry.warehouseId===input.warehouseId)??{lotNumber:input.lotNumber,warehouseId:input.warehouseId,quantity:0};const lotQuantity=lot.quantity+quantityDelta;if(lotQuantity<0)throw new RepositoryError('Onvoldoende voorraad in dit lot',409);updated.lots=[...(item.lots??[]).filter(entry=>!(entry.lotNumber===input.lotNumber&&entry.warehouseId===input.warehouseId)),{...lot,quantity:lotQuantity}]}
      state.inventoryItems = state.inventoryItems.map(entry => entry.id === item.id ? updated : entry)
      const movement: StockMovement = { id: randomUUID(), ...input, createdAt: new Date().toISOString() }
      state.stockMovements.unshift(movement); await this.saveOperationalState(client, context.tenantId, state); await this.audit(client, context, 'stock_movement', movement.id, 'created', null, movement)
      return { item: updated, movement }
    })
  }

  async countInventory(context:RequestContext,itemId:string,input:InventoryCountInput):Promise<{item:InventoryItem;movement?:StockMovement}>{return this.transaction(async client=>{const state=await this.operationalState(client,context.tenantId);const item=state.inventoryItems.find(entry=>entry.id===itemId);if(!item)throw new RepositoryError('Voorraadartikel niet gevonden',404);if(!state.warehouses.some(entry=>entry.id===input.warehouseId))throw new RepositoryError('Magazijn niet gevonden',404);const stock=item.stocks.find(entry=>entry.warehouseId===input.warehouseId)??{warehouseId:input.warehouseId,quantity:0,reserved:0};if(input.countedQuantity<stock.reserved)throw new RepositoryError('Getelde voorraad kan niet lager zijn dan de actieve reservaties',409);const difference=input.countedQuantity-stock.quantity;const count={id:randomUUID(),...input,bookQuantity:stock.quantity,difference,countedAt:new Date().toISOString()};const updated={...item,stocks:[...item.stocks.filter(entry=>entry.warehouseId!==input.warehouseId),{...stock,quantity:input.countedQuantity}],counts:[count,...(item.counts??[])]};state.inventoryItems=state.inventoryItems.map(entry=>entry.id===itemId?updated:entry);let movement:StockMovement|undefined;if(Math.abs(difference)>0.0001){movement={id:randomUUID(),inventoryItemId:itemId,warehouseId:input.warehouseId,type:'Correctie',quantity:Math.abs(difference),reference:`Telling ${count.countedAt.slice(0,10)}`,performedBy:input.countedBy,lotNumber:input.lotNumber,createdAt:count.countedAt};state.stockMovements.unshift(movement)}await this.saveOperationalState(client,context.tenantId,state);await this.audit(client,context,'inventory_item',itemId,'counted',item,updated,input.notes);return{item:updated,movement}})}

  private async blueprintState(client: SqlClient, tenantId: string) {
    const result = await client.query<BlueprintStateRow>('SELECT * FROM blueprint_state WHERE tenant_id=$1 FOR UPDATE', [tenantId])
    if (!result.rowCount) return { subcontractors: [] as Subcontractor[], qhseEvents: [] as QhseEvent[], jointVentures: [] as JointVenture[], integrationConnections: [] as IntegrationConnection[], integrationJobs: [] as IntegrationJob[], aiAnalyses: [] as AiAnalysis[], projectContracts: [] as ProjectContract[], projectCloseouts: [] as ProjectCloseout[], employees: [] as Employee[], employeeAbsences: [] as EmployeeAbsence[], employeeCrews: [] as EmployeeCrew[], workTickets: [] as WorkTicket[], timeEntries: [] as TimeEntry[], projectClaims: [] as ProjectClaim[], workflowDefinitions:[...defaultWorkflowDefinitions] }
    const row = result.rows[0]
    const workflows=jsonValue<WorkflowDefinition[]>(row.workflow_definitions)
    return { subcontractors: jsonValue<Subcontractor[]>(row.subcontractors), qhseEvents: jsonValue<QhseEvent[]>(row.qhse_events), jointVentures: jsonValue<JointVenture[]>(row.joint_ventures), integrationConnections: jsonValue<IntegrationConnection[]>(row.integration_connections), integrationJobs: jsonValue<IntegrationJob[]>(row.integration_jobs), aiAnalyses: jsonValue<AiAnalysis[]>(row.ai_analyses), projectContracts: jsonValue<ProjectContract[]>(row.project_contracts).map(item => ({ ...item, approvalStatus:item.approvalStatus ?? 'Concept' })), projectCloseouts: jsonValue<ProjectCloseout[]>(row.project_closeouts), employees: jsonValue<Employee[]>(row.employees), employeeAbsences: jsonValue<EmployeeAbsence[]>(row.employee_absences), employeeCrews: jsonValue<EmployeeCrew[]>(row.employee_crews), workTickets: jsonValue<WorkTicket[]>(row.work_tickets), timeEntries: jsonValue<TimeEntry[]>(row.time_entries), projectClaims: jsonValue<ProjectClaim[]>(row.project_claims), workflowDefinitions:workflows.length?workflows:[...defaultWorkflowDefinitions] }
  }

  private async saveBlueprintState(client: SqlClient, tenantId: string, state: Awaited<ReturnType<BouwFlowRepository['blueprintState']>>) {
    await client.query(`INSERT INTO blueprint_state (tenant_id,subcontractors,qhse_events,joint_ventures,integration_connections,integration_jobs,ai_analyses,project_contracts,project_closeouts,employees,employee_absences,employee_crews,work_tickets,time_entries,project_claims,workflow_definitions,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,now()) ON CONFLICT (tenant_id) DO UPDATE SET subcontractors=EXCLUDED.subcontractors,qhse_events=EXCLUDED.qhse_events,joint_ventures=EXCLUDED.joint_ventures,integration_connections=EXCLUDED.integration_connections,integration_jobs=EXCLUDED.integration_jobs,ai_analyses=EXCLUDED.ai_analyses,project_contracts=EXCLUDED.project_contracts,project_closeouts=EXCLUDED.project_closeouts,employees=EXCLUDED.employees,employee_absences=EXCLUDED.employee_absences,employee_crews=EXCLUDED.employee_crews,work_tickets=EXCLUDED.work_tickets,time_entries=EXCLUDED.time_entries,project_claims=EXCLUDED.project_claims,workflow_definitions=EXCLUDED.workflow_definitions,updated_at=now()`, [tenantId, JSON.stringify(state.subcontractors), JSON.stringify(state.qhseEvents), JSON.stringify(state.jointVentures), JSON.stringify(state.integrationConnections), JSON.stringify(state.integrationJobs), JSON.stringify(state.aiAnalyses), JSON.stringify(state.projectContracts), JSON.stringify(state.projectCloseouts), JSON.stringify(state.employees), JSON.stringify(state.employeeAbsences), JSON.stringify(state.employeeCrews), JSON.stringify(state.workTickets), JSON.stringify(state.timeEntries), JSON.stringify(state.projectClaims),JSON.stringify(state.workflowDefinitions)])
  }

  private async checkinatworkState(client: SqlClient, tenantId: string) {
    const result = await client.query<CheckinatworkStateRow>('SELECT * FROM checkinatwork_state WHERE tenant_id=$1 FOR UPDATE', [tenantId])
    if (!result.rowCount) return { sites: [] as CheckinatworkSite[], participants: [] as CheckinatworkParticipant[], registrations: [] as CheckinatworkRegistration[], auditEvents: [] as CheckinatworkAuditEvent[] }
    const row = result.rows[0]
    return { sites: jsonValue<CheckinatworkSite[]>(row.sites), participants: jsonValue<CheckinatworkParticipant[]>(row.participants), registrations: jsonValue<CheckinatworkRegistration[]>(row.registrations), auditEvents: jsonValue<CheckinatworkAuditEvent[]>(row.audit_events) }
  }

  private async saveCheckinatworkState(client: SqlClient, tenantId: string, state: Awaited<ReturnType<BouwFlowRepository['checkinatworkState']>>) {
    await client.query(`INSERT INTO checkinatwork_state (tenant_id,sites,participants,registrations,audit_events,updated_at) VALUES ($1,$2,$3,$4,$5,now()) ON CONFLICT (tenant_id) DO UPDATE SET sites=EXCLUDED.sites,participants=EXCLUDED.participants,registrations=EXCLUDED.registrations,audit_events=EXCLUDED.audit_events,updated_at=now()`, [tenantId, JSON.stringify(state.sites), JSON.stringify(state.participants), JSON.stringify(state.registrations), JSON.stringify(state.auditEvents.slice(0, 5_000))])
  }

  private checkinatworkTransport(site: CheckinatworkSite) {
    if (site.environment === 'Simulatie') return new SimulationCheckinatworkGateway()
    if (!this.checkinatworkGateway.productionConfigured) throw new RepositoryError('De productie-adapter, technische gebruiker en GlobalSign-configuratie zijn nog niet ingesteld', 503)
    return this.checkinatworkGateway
  }

  private checkinatworkAudit(state: Awaited<ReturnType<BouwFlowRepository['checkinatworkState']>>, context: RequestContext, event: Omit<CheckinatworkAuditEvent, 'id' | 'actor' | 'at'>) {
    state.auditEvents.unshift({ id: randomUUID(), ...event, actor: context.displayName, at: new Date().toISOString() })
  }

  async configureCheckinatworkSite(context: RequestContext, input: CheckinatworkSiteInput): Promise<CheckinatworkSite> {
    return this.transaction(async client => {
      await this.requireProject(client, context, input.projectId)
      const projectResult = await client.query<{contract_value:string|number} & QueryResultRow>('SELECT contract_value FROM projects WHERE tenant_id=$1 AND id=$2', [context.tenantId, input.projectId])
      const contractValue = Number(projectResult.rows[0]?.contract_value ?? 0)
      const thresholdAmount = input.thresholdAmount || 500_000
      const applicability = input.provisionalAcceptanceOn ? 'Be\u00ebindigd' : input.applicability === 'Niet verplicht' ? 'Niet verplicht' : contractValue >= thresholdAmount ? 'Verplicht' : 'Niet verplicht'
      const now = new Date().toISOString()
      const state = await this.checkinatworkState(client, context.tenantId)
      const current = state.sites.find(item => item.projectId === input.projectId)
      const site: CheckinatworkSite = current ? { ...current, ...input, applicability, updatedAt: now } : { id: randomUUID(), ...input, applicability, createdAt: now, updatedAt: now }
      state.sites = [site, ...state.sites.filter(item => item.id !== site.id && item.projectId !== input.projectId)]
      this.checkinatworkAudit(state, context, { projectId: site.projectId, siteId: site.id, action: 'SITE_CONFIGURED', detail: `${site.environment} \u00b7 ${site.applicability} \u00b7 werkplaats ${site.workPlaceId || 'nog niet ingevuld'}` })
      await this.saveCheckinatworkState(client, context.tenantId, state)
      await this.audit(client, context, 'checkinatwork_site', site.id, current ? 'updated' : 'created', current ?? null, site)
      return site
    })
  }

  async createCheckinatworkParticipant(context: RequestContext, input: CheckinatworkParticipantInput): Promise<CheckinatworkParticipant> {
    return this.transaction(async client => {
      await this.requireProject(client, context, input.projectId)
      const state = await this.checkinatworkState(client, context.tenantId)
      const site = state.sites.find(item => item.projectId === input.projectId && item.active)
      if (!site) throw new RepositoryError('Configureer eerst de Checkinatwork-werkplaats', 409)
      if (context.roles.includes('Onderaannemer')) {
        const blueprint = await this.blueprintState(client, context.tenantId)
        const own = blueprint.subcontractors.find(item => item.id === input.subcontractorId && normalizedEmail(item.email) === normalizedEmail(context.email) && item.projectIds.includes(input.projectId))
        if (!own) throw new RepositoryError('Je kunt alleen medewerkers van je eigen onderaannemersdossier aanmelden', 403)
      }
      const transport = this.checkinatworkTransport(site)
      let identity: Awaited<ReturnType<CheckinatworkGateway['provisionIdentity']>>
      try { identity = await transport.provisionIdentity(input) }
      catch (error) { throw new RepositoryError(error instanceof CheckinatworkGatewayError ? error.message : 'Identiteit kon niet veilig worden geprovisioneerd', 409) }
      const participant: CheckinatworkParticipant = { id: randomUUID(), projectId: input.projectId, employeeId: input.employeeId, subcontractorId: input.subcontractorId, displayName: input.displayName, employerName: input.employerName, employerCompanyNumber: input.employerCompanyNumber, participantType: input.participantType, identifierType: input.identifierType, identifierLast4: identity.identifierLast4, secureIdentityReference: identity.secureIdentityReference, identityVerified: true, limosaExpiresOn: input.limosaExpiresOn, active: input.active, createdAt: new Date().toISOString() }
      state.participants.unshift(participant)
      this.checkinatworkAudit(state, context, { projectId: participant.projectId, siteId: site.id, participantId: participant.id, action: 'IDENTITY_PROVISIONED', detail: `${participant.identifierType} eindigend op ${participant.identifierLast4} veilig geprovisioneerd` })
      await this.saveCheckinatworkState(client, context.tenantId, state)
      await this.audit(client, context, 'checkinatwork_participant', participant.id, 'created', null, { ...participant, secureIdentityReference: '[AFGESCHERMD]' })
      return { ...participant, secureIdentityReference: undefined }
    })
  }

  async registerCheckinatworkPresence(context: RequestContext, input: CheckinatworkRegistrationInput): Promise<CheckinatworkRegistration> {
    return this.transaction(async client => {
      const state = await this.checkinatworkState(client, context.tenantId)
      const site = state.sites.find(item => item.id === input.siteId && item.active)
      const participant = state.participants.find(item => item.id === input.participantId && item.active)
      if (!site || !participant || participant.projectId !== site.projectId) throw new RepositoryError('Werkplaats of deelnemer niet gevonden', 404)
      await this.requireProject(client, context, site.projectId)
      if (context.roles.includes('Onderaannemer')) {
        const blueprint = await this.blueprintState(client, context.tenantId)
        const own = blueprint.subcontractors.find(item => item.id === participant.subcontractorId && normalizedEmail(item.email) === normalizedEmail(context.email) && item.projectIds.includes(site.projectId))
        if (!own) throw new RepositoryError('Deze persoon behoort niet tot je eigen onderaannemersdossier', 403)
      }
      const unrestrictedRoles = ['Administrator','Projectmanager','Werfleider','Preventieadviseur']
      const restrictedWorker = context.roles.includes('Arbeider') && !context.roles.some(role => unrestrictedRoles.includes(role))
      const restrictedForeman = context.roles.includes('Ploegbaas') && !context.roles.some(role => unrestrictedRoles.includes(role))
      if (restrictedWorker || restrictedForeman) {
        const blueprint = await this.blueprintState(client, context.tenantId)
        const ownEmployee = blueprint.employees.find(item => normalizedEmail(item.email) === normalizedEmail(context.email))
        const allowedEmployeeIds = new Set([ownEmployee?.id, ...(restrictedForeman ? blueprint.employeeCrews.filter(crew => crew.leaderEmployeeId === ownEmployee?.id).flatMap(crew => crew.memberEmployeeIds) : [])].filter(Boolean))
        if (!participant.employeeId || !allowedEmployeeIds.has(participant.employeeId)) throw new RepositoryError('Je kunt alleen jezelf of leden van je eigen ploeg registreren', 403)
      }
      const duplicate = state.registrations.find(item => item.siteId === site.id && item.participantId === participant.id && item.registrationDate === input.registrationDate && !['Geannuleerd', 'Geweigerd'].includes(item.status))
      if (duplicate) return duplicate
      const clientReference = `bouwflow:${site.id}:${participant.id}:${input.registrationDate}`
      const registration: CheckinatworkRegistration = { id: randomUUID(), siteId: site.id, projectId: site.projectId, participantId: participant.id, registrationDate: input.registrationDate, source: input.source, status: 'Verzending bezig', clientReference, simulation: site.environment === 'Simulatie', createdBy: context.displayName, createdAt: new Date().toISOString(), submittedAt: new Date().toISOString() }
      try {
        const result = await this.checkinatworkTransport(site).register({ site, participant, registrationDate: input.registrationDate, clientReference })
        Object.assign(registration, { status: 'Officieel bevestigd' as const, providerRegistrationId: result.providerRegistrationId, receiptNumber: result.receiptNumber, confirmedAt: result.confirmedAt })
        this.checkinatworkAudit(state, context, { projectId: site.projectId, siteId: site.id, participantId: participant.id, registrationId: registration.id, action: 'REGISTRATION_CONFIRMED', detail: `Ontvangstnummer ${result.receiptNumber}` })
      } catch (error) {
        const gatewayError = error instanceof CheckinatworkGatewayError ? error : undefined
        Object.assign(registration, { status: 'Geweigerd' as const, errorCode: gatewayError?.code ?? 'DELIVERY_FAILED', errorMessage: error instanceof Error ? error.message : 'Registratie mislukt' })
        this.checkinatworkAudit(state, context, { projectId: site.projectId, siteId: site.id, participantId: participant.id, registrationId: registration.id, action: 'REGISTRATION_REJECTED', detail: registration.errorMessage ?? 'Registratie geweigerd' })
      }
      state.registrations.unshift(registration)
      await this.saveCheckinatworkState(client, context.tenantId, state)
      await this.audit(client, context, 'checkinatwork_registration', registration.id, registration.status === 'Officieel bevestigd' ? 'confirmed' : 'rejected', null, { ...registration, clientReference: '[AFGESCHERMD]' })
      return registration
    })
  }

  async cancelCheckinatworkPresence(context: RequestContext, id: string, reason: CheckinatworkCancellationReason): Promise<CheckinatworkRegistration> {
    return this.transaction(async client => {
      const state = await this.checkinatworkState(client, context.tenantId)
      const current = state.registrations.find(item => item.id === id)
      if (!current) throw new RepositoryError('Aanwezigheidsregistratie niet gevonden', 404)
      const site = state.sites.find(item => item.id === current.siteId)
      if (!site || !current.providerRegistrationId) throw new RepositoryError('Deze registratie kan niet officieel worden geannuleerd', 409)
      await this.requireProject(client, context, current.projectId)
      if (context.roles.includes('Onderaannemer')) {
        const participant = state.participants.find(item => item.id === current.participantId)
        const blueprint = await this.blueprintState(client, context.tenantId)
        const own = blueprint.subcontractors.find(item => item.id === participant?.subcontractorId && normalizedEmail(item.email) === normalizedEmail(context.email) && item.projectIds.includes(current.projectId))
        if (!own) throw new RepositoryError('Je kunt alleen registraties van je eigen onderaannemersdossier annuleren', 403)
      }
      const result = await this.checkinatworkTransport(site).cancel({ site, registrationId: current.id, providerRegistrationId: current.providerRegistrationId, reason })
      const updated: CheckinatworkRegistration = { ...current, status: 'Geannuleerd', cancellationReason: reason, cancelledAt: result.cancelledAt }
      state.registrations = state.registrations.map(item => item.id === id ? updated : item)
      this.checkinatworkAudit(state, context, { projectId: current.projectId, siteId: current.siteId, participantId: current.participantId, registrationId: current.id, action: 'REGISTRATION_CANCELLED', detail: `Geannuleerd met reden ${reason}` })
      await this.saveCheckinatworkState(client, context.tenantId, state)
      await this.audit(client, context, 'checkinatwork_registration', id, 'cancelled', current, updated, reason)
      return updated
    })
  }

  async createEmployee(context: RequestContext, input: EmployeeInput): Promise<Employee> {
    return this.transaction(async client => {
      if (!this.canAccessEntity(context, input.legalEntityId)) throw new RepositoryError('Geen toegang tot juridische entiteit', 403)
      const entity = await client.query('SELECT id FROM legal_entities WHERE tenant_id=$1 AND id=$2 AND active=true', [context.tenantId, input.legalEntityId])
      if (!entity.rowCount) throw new RepositoryError('Selecteer een actieve juridische entiteit', 409)
      if (input.branchId) {
        const branch = await client.query('SELECT id FROM company_branches WHERE tenant_id=$1 AND id=$2 AND legal_entity_id=$3', [context.tenantId, input.branchId, input.legalEntityId])
        if (!branch.rowCount) throw new RepositoryError('De vestiging behoort niet tot de gekozen entiteit', 409)
      }
      const state = await this.blueprintState(client, context.tenantId)
      if (state.employees.some(item => item.employeeNumber.toLocaleLowerCase() === input.employeeNumber.toLocaleLowerCase() || item.email.toLocaleLowerCase() === input.email.toLocaleLowerCase())) throw new RepositoryError('Personeelsnummer of e-mailadres bestaat al', 409)
      const item: Employee = { id: randomUUID(), ...input, createdAt: new Date().toISOString() }
      state.employees.push(item)
      await this.saveBlueprintState(client, context.tenantId, state)
      await this.audit(client, context, 'employee', item.id, 'created', null, item)
      return item
    })
  }

  async createEmployeeCrew(context: RequestContext, input: EmployeeCrewInput): Promise<EmployeeCrew> {
    return this.transaction(async client => {
      if (!this.canAccessEntity(context, input.legalEntityId)) throw new RepositoryError('Geen toegang tot juridische entiteit', 403)
      const state = await this.blueprintState(client, context.tenantId)
      if (state.employeeCrews.some(item => item.active && item.name.toLocaleLowerCase() === input.name.toLocaleLowerCase())) throw new RepositoryError('Er bestaat al een actieve ploeg met deze naam', 409)
      const memberIds = [...new Set(input.memberEmployeeIds)]
      if (!memberIds.includes(input.leaderEmployeeId)) memberIds.unshift(input.leaderEmployeeId)
      const members = state.employees.filter(item => memberIds.includes(item.id) && item.active && item.legalEntityId === input.legalEntityId)
      if (members.length !== memberIds.length) throw new RepositoryError('Alle ploegleden moeten actieve medewerkers van dezelfde entiteit zijn', 409)
      if (input.branchId && members.some(item => item.branchId && item.branchId !== input.branchId)) throw new RepositoryError('Een of meer ploegleden behoren tot een andere vestiging', 409)
      const item: EmployeeCrew = { id: randomUUID(), ...input, memberEmployeeIds: memberIds, createdAt: new Date().toISOString() }
      state.employeeCrews.push(item)
      await this.saveBlueprintState(client, context.tenantId, state)
      await this.audit(client, context, 'employee_crew', item.id, 'created', null, item)
      return item
    })
  }

  async createEmployeeAbsence(context: RequestContext, input: EmployeeAbsenceInput): Promise<EmployeeAbsence> {
    return this.transaction(async client => {
      const state = await this.blueprintState(client, context.tenantId)
      const employee = state.employees.find(item => item.id === input.employeeId)
      if (!employee) throw new RepositoryError('Medewerker niet gevonden', 404)
      if (!this.canAccessEntity(context, employee.legalEntityId)) throw new RepositoryError('Geen toegang tot medewerker', 403)
      if (!employee.active) throw new RepositoryError('Afwezigheid kan alleen voor een actieve medewerker worden aangevraagd', 409)
      if (state.employeeAbsences.some(item => item.employeeId === input.employeeId && ['Aangevraagd','Goedgekeurd'].includes(item.status) && item.startDate <= input.endDate && item.endDate >= input.startDate)) throw new RepositoryError('Deze medewerker heeft al een overlappende afwezigheid', 409)
      const item: EmployeeAbsence = { id: randomUUID(), ...input, status: 'Aangevraagd', requestedAt: new Date().toISOString() }
      state.employeeAbsences.unshift(item)
      await this.saveBlueprintState(client, context.tenantId, state)
      await this.audit(client, context, 'employee_absence', item.id, 'requested', null, item)
      return item
    })
  }

  async decideEmployeeAbsence(context: RequestContext, id: string, input: EmployeeAbsenceDecisionInput): Promise<EmployeeAbsence> {
    return this.transaction(async client => {
      const state = await this.blueprintState(client, context.tenantId)
      const current = state.employeeAbsences.find(item => item.id === id)
      if (!current) throw new RepositoryError('Afwezigheidsaanvraag niet gevonden', 404)
      if (current.status !== 'Aangevraagd') throw new RepositoryError('Alleen een open aanvraag kan worden beslist', 409)
      const employee = state.employees.find(item => item.id === current.employeeId)
      if (!employee || !this.canAccessEntity(context, employee.legalEntityId)) throw new RepositoryError('Geen toegang tot medewerker', 403)
      const updated: EmployeeAbsence = { ...current, ...input, decidedAt: new Date().toISOString() }
      state.employeeAbsences = state.employeeAbsences.map(item => item.id === id ? updated : item)
      await this.saveBlueprintState(client, context.tenantId, state)
      await this.audit(client, context, 'employee_absence', id, input.status === 'Goedgekeurd' ? 'approved' : 'rejected', current, updated)
      return updated
    })
  }

  async createSubcontractor(context: RequestContext, input: SubcontractorInput): Promise<Subcontractor> {
    return this.transaction(async client => { if(input.organizationId){const relation=await client.query<OrganizationRow>('SELECT * FROM organizations WHERE tenant_id=$1 AND id=$2',[context.tenantId,input.organizationId]);if(!relation.rowCount)throw new RepositoryError('Geselecteerde relatie niet gevonden',404);if(!mapOrganization(relation.rows[0]).roles?.includes('Onderaannemer'))throw new RepositoryError('Deze relatie heeft niet de rol Onderaannemer',409)} const state = await this.blueprintState(client, context.tenantId); if (state.subcontractors.some(item => item.vatNumber === input.vatNumber || Boolean(input.organizationId && item.organizationId === input.organizationId))) throw new RepositoryError('Onderaannemer bestaat al', 409); for (const id of input.projectIds) await this.requireProject(client, context, id); const item: Subcontractor = { id: randomUUID(), ...input, status: 'Te beoordelen', documentsComplete: Boolean(input.insuranceExpiresOn && input.vcaExpiresOn), employees: [], createdAt: new Date().toISOString() }; state.subcontractors.push(item); await this.saveBlueprintState(client, context.tenantId, state); await this.audit(client, context, 'subcontractor', item.id, 'created', null, item); return item })
  }

  async inviteSubcontractor(context: RequestContext, id: string): Promise<Subcontractor> {
    return this.transaction(async client => { const state = await this.blueprintState(client, context.tenantId); const current = state.subcontractors.find(item => item.id === id); if (!current) throw new RepositoryError('Onderaannemer niet gevonden', 404); if (!current.documentsComplete) throw new RepositoryError('Verzekering en VCA moeten geldig geregistreerd zijn', 409); const updated: Subcontractor = { ...current, status: 'Goedgekeurd', portalInvitedAt: current.portalInvitedAt ?? new Date().toISOString() }; state.subcontractors = state.subcontractors.map(item => item.id === id ? updated : item); await this.saveBlueprintState(client, context.tenantId, state); await this.audit(client, context, 'subcontractor', id, 'portal_invited', current, updated); return updated })
  }

  async addSubcontractorOperation(context:RequestContext,id:string,input:SubcontractorOperationInput):Promise<Subcontractor>{
    return this.transaction(async client=>{const state=await this.blueprintState(client,context.tenantId);const current=state.subcontractors.find(item=>item.id===id);if(!current)throw new RepositoryError('Onderaannemer niet gevonden',404);if(context.roles.includes('Onderaannemer')&&current.email.toLowerCase()!==context.email.toLowerCase())throw new RepositoryError('Deze onderaannemeraccount mag alleen het eigen dossier bijwerken',403);if(context.roles.includes('Onderaannemer')&&!['progress','employee'].includes(input.kind))throw new RepositoryError('Het portaal kan alleen medewerkers en vorderingsstaten indienen',403);const operationId=randomUUID();let updated:Subcontractor;if(input.kind==='employee'){updated={...current,employees:[...current.employees,{id:operationId,...input.value}]}}else if(input.kind==='agreement'){if(!current.projectIds.includes(input.value.projectId))throw new RepositoryError('Onderaannemer is niet aan dit project toegewezen',409);await this.requireProject(client,context,input.value.projectId);updated={...current,agreements:[{id:operationId,...input.value},...(current.agreements??[])]}}else if(input.kind==='progress'){if(!current.projectIds.includes(input.value.projectId))throw new RepositoryError('Onderaannemer is niet aan dit project toegewezen',409);const agreement=(current.agreements??[]).find(item=>item.projectId===input.value.projectId&&item.status==='Actief');if(!agreement)throw new RepositoryError('Een actieve onderaannemingsovereenkomst is verplicht',409);const retentionAmount=Math.round(input.value.grossAmount*agreement.retentionPct)/100;const netAmount=Math.round((input.value.grossAmount-retentionAmount-input.value.penaltyAmount)*100)/100;const sequence=(current.progressClaims??[]).length+1;updated={...current,progressClaims:[{id:operationId,number:`OVS-${String(sequence).padStart(3,'0')}`,...input.value,retentionAmount,netAmount,status:'Ingediend',submittedAt:new Date().toISOString()},...(current.progressClaims??[])]}}else if(input.kind==='evaluation'){if(!current.projectIds.includes(input.value.projectId))throw new RepositoryError('Onderaannemer is niet aan dit project toegewezen',409);updated={...current,evaluations:[{id:operationId,...input.value},...(current.evaluations??[])]}}else{updated={...current,documentIds:[...new Set(input.value.documentIds)]}}state.subcontractors=state.subcontractors.map(item=>item.id===id?updated:item);await this.saveBlueprintState(client,context.tenantId,state);await this.audit(client,context,'subcontractor',id,`${input.kind}_added`,current,updated);return updated})
  }

  async decideSubcontractorProgress(context:RequestContext,id:string,progressId:string,status:'Goedgekeurd'|'Afgewezen'):Promise<Subcontractor>{
    return this.transaction(async client=>{const state=await this.blueprintState(client,context.tenantId);const current=state.subcontractors.find(item=>item.id===id);const progress=current?.progressClaims?.find(item=>item.id===progressId);if(!current||!progress)throw new RepositoryError('Onderaannemersvordering niet gevonden',404);if(progress.status!=='Ingediend')throw new RepositoryError('Alleen een ingediende vordering kan worden beoordeeld',409);await this.requireProject(client,context,progress.projectId);const updated={...current,progressClaims:(current.progressClaims??[]).map(item=>item.id===progressId?{...item,status,approvedAt:new Date().toISOString(),approvedBy:context.displayName}:item)};state.subcontractors=state.subcontractors.map(item=>item.id===id?updated:item);await this.saveBlueprintState(client,context.tenantId,state);await this.audit(client,context,'subcontractor_progress',progressId,status==='Goedgekeurd'?'approved':'rejected',progress,updated.progressClaims.find(item=>item.id===progressId));return updated})
  }

  async createQhseEvent(context: RequestContext, input: QhseEventInput): Promise<QhseEvent> {
    return this.transaction(async client => { await this.requireProject(client, context, input.projectId); const state = await this.blueprintState(client, context.tenantId); const item: QhseEvent = { id: randomUUID(), ...input, status: 'Open', createdAt: new Date().toISOString() }; state.qhseEvents.unshift(item); await this.saveBlueprintState(client, context.tenantId, state); await this.audit(client, context, 'qhse_event', item.id, 'created', null, item); return item })
  }

  async closeQhseEvent(context: RequestContext, id: string): Promise<QhseEvent> {
    return this.transaction(async client => { const state = await this.blueprintState(client, context.tenantId); const current = state.qhseEvents.find(item => item.id === id); if (!current) throw new RepositoryError('QHSE-melding niet gevonden', 404); if (!current.correctiveAction.trim() && ['Incident','Bijna-ongeval','Milieumelding'].includes(current.type)) throw new RepositoryError('Corrigerende maatregel is verplicht', 409); const updated: QhseEvent = { ...current, status: 'Gesloten', closedAt: new Date().toISOString() }; state.qhseEvents = state.qhseEvents.map(item => item.id === id ? updated : item); await this.saveBlueprintState(client, context.tenantId, state); await this.audit(client, context, 'qhse_event', id, 'closed', current, updated); return updated })
  }

  async createWorkTicket(context: RequestContext, input: WorkTicketInput): Promise<WorkTicket> {
    return this.transaction(async client => {
      await this.requireProject(client, context, input.projectId)
      if (input.dailyReportId) {
        const report = await client.query('SELECT id FROM daily_reports WHERE tenant_id=$1 AND id=$2 AND project_id=$3', [context.tenantId, input.dailyReportId, input.projectId])
        if (!report.rowCount) throw new RepositoryError('Het gekozen dagrapport behoort niet tot dit project', 409)
      }
      const state = await this.blueprintState(client, context.tenantId)
      if (input.subcontractorId && !state.subcontractors.some(item => item.id === input.subcontractorId && item.projectIds.includes(input.projectId))) throw new RepositoryError('De gekozen onderaannemer is niet aan dit project gekoppeld', 409)
      const total = Math.round(input.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0) * 100) / 100
      const sequence = state.workTickets.filter(item => item.createdAt.slice(0, 4) === new Date().getUTCFullYear().toString()).length + 1
      const item: WorkTicket = { id: randomUUID(), number: `WB-${new Date().getUTCFullYear()}-${String(sequence).padStart(4, '0')}`, ...input, lines: input.lines.map(line => ({ ...line, id: line.id || randomUUID() })), total, status: 'Concept', createdAt: new Date().toISOString() }
      state.workTickets.unshift(item)
      await this.saveBlueprintState(client, context.tenantId, state)
      await this.audit(client, context, 'work_ticket', item.id, 'created', null, item)
      return item
    })
  }

  async submitWorkTicket(context: RequestContext, id: string): Promise<WorkTicket> {
    return this.transaction(async client => {
      const state = await this.blueprintState(client, context.tenantId)
      const current = state.workTickets.find(item => item.id === id)
      if (!current) throw new RepositoryError('Werfbon niet gevonden', 404)
      await this.requireProject(client, context, current.projectId)
      if (current.status !== 'Concept') throw new RepositoryError('Alleen een conceptwerfbon kan ter ondertekening worden aangeboden', 409)
      if (!current.lines.length || current.total <= 0) throw new RepositoryError('Voeg minstens één geldige prestatieregel toe', 409)
      const updated: WorkTicket = { ...current, status: 'Ter ondertekening', submittedAt: new Date().toISOString() }
      state.workTickets = state.workTickets.map(item => item.id === id ? updated : item)
      await this.saveBlueprintState(client, context.tenantId, state)
      await this.audit(client, context, 'work_ticket', id, 'submitted_for_signature', current, updated)
      return updated
    })
  }

  async signWorkTicket(context: RequestContext, id: string, signedBy: string): Promise<WorkTicket> {
    return this.transaction(async client => {
      const state = await this.blueprintState(client, context.tenantId)
      const current = state.workTickets.find(item => item.id === id)
      if (!current) throw new RepositoryError('Werfbon niet gevonden', 404)
      if (context.roles.includes('Klant')) {
        await this.requireClientProject(client, context, current.projectId)
        if (current.subcontractorId) throw new RepositoryError('Deze werfbon is toegewezen aan een onderaannemer', 403)
      }
      else if (context.roles.includes('Onderaannemer')) {
        const subcontractor = state.subcontractors.find(item => item.id === current.subcontractorId && normalizedEmail(item.email) === normalizedEmail(context.email) && item.projectIds.includes(current.projectId))
        if (!subcontractor) throw new RepositoryError('Deze werfbon is niet aan uw onderaannemersdossier toegewezen', 403)
      } else await this.requireProject(client, context, current.projectId)
      if (context.roles.includes('Klant') || context.roles.includes('Onderaannemer')) signedBy = context.displayName
      if (current.status !== 'Ter ondertekening') throw new RepositoryError('Deze werfbon staat niet ter ondertekening', 409)
      const updated: WorkTicket = { ...current, status: 'Ondertekend', signedBy, signedAt: new Date().toISOString() }
      state.workTickets = state.workTickets.map(item => item.id === id ? updated : item)
      await this.saveBlueprintState(client, context.tenantId, state)
      await this.audit(client, context, 'work_ticket', id, 'digitally_signed', current, updated, `Ondertekend door ${signedBy}`)
      return updated
    })
  }

  async createTimeEntry(context: RequestContext, input: TimeEntryInput): Promise<TimeEntry> {
    return this.transaction(async client => {
      await this.requireProject(client, context, input.projectId)
      const state = await this.blueprintState(client, context.tenantId)
      const employee = state.employees.find(item => item.id === input.employeeId && item.active)
      if (!employee) throw new RepositoryError('Selecteer een actieve medewerker uit HR', 409)
      const toMinutes = (value: string) => { const [hours, minutes] = value.split(':').map(Number); return hours * 60 + minutes }
      const workedMinutes = toMinutes(input.endTime) - toMinutes(input.startTime) - input.breakMinutes
      if (workedMinutes <= 0) throw new RepositoryError('De eindtijd moet na de starttijd liggen', 409)
      if (Math.abs(input.regularHours + input.overtimeHours - workedMinutes / 60) > 0.02) throw new RepositoryError('Reguliere uren en overuren moeten overeenkomen met starttijd, eindtijd en pauze', 409)
      if (state.timeEntries.some(item => item.employeeId === input.employeeId && item.date === input.date && item.status !== 'Geweigerd' && toMinutes(input.startTime) < toMinutes(item.endTime) && toMinutes(input.endTime) > toMinutes(item.startTime))) throw new RepositoryError('Deze medewerker heeft al een overlappende urenregistratie', 409)
      const item: TimeEntry = { id: randomUUID(), ...input, status: 'Concept', createdAt: new Date().toISOString() }
      state.timeEntries.unshift(item)
      await this.saveBlueprintState(client, context.tenantId, state)
      await this.audit(client, context, 'time_entry', item.id, 'created', null, item, `${employee.firstName} ${employee.lastName}`)
      return item
    })
  }

  async submitTimeEntry(context: RequestContext, id: string): Promise<TimeEntry> {
    return this.transaction(async client => {
      const state = await this.blueprintState(client, context.tenantId)
      const current = state.timeEntries.find(item => item.id === id)
      if (!current) throw new RepositoryError('Urenregistratie niet gevonden', 404)
      await this.requireProject(client, context, current.projectId)
      if (!['Concept', 'Gecorrigeerd'].includes(current.status)) throw new RepositoryError('Deze urenregistratie kan niet opnieuw worden ingediend', 409)
      const updated: TimeEntry = { ...current, status: 'Ingediend' }
      state.timeEntries = state.timeEntries.map(item => item.id === id ? updated : item)
      await this.saveBlueprintState(client, context.tenantId, state)
      await this.audit(client, context, 'time_entry', id, 'submitted', current, updated)
      return updated
    })
  }

  async decideTimeEntry(context: RequestContext, id: string, decision: 'Goedgekeurd' | 'Geweigerd', reason?: string): Promise<TimeEntry> {
    return this.transaction(async client => {
      const state = await this.blueprintState(client, context.tenantId)
      const current = state.timeEntries.find(item => item.id === id)
      if (!current) throw new RepositoryError('Urenregistratie niet gevonden', 404)
      await this.requireProject(client, context, current.projectId)
      if (current.status !== 'Ingediend') throw new RepositoryError('Alleen ingediende uren kunnen worden beoordeeld', 409)
      if (decision === 'Geweigerd' && !reason?.trim()) throw new RepositoryError('Een reden is verplicht bij weigering', 409)
      const updated: TimeEntry = { ...current, status: decision, correctionReason: reason?.trim() || undefined, approvedBy: context.displayName, approvedAt: new Date().toISOString() }
      state.timeEntries = state.timeEntries.map(item => item.id === id ? updated : item)
      await this.saveBlueprintState(client, context.tenantId, state)
      await this.audit(client, context, 'time_entry', id, decision === 'Goedgekeurd' ? 'approved' : 'rejected', current, updated, reason)
      return updated
    })
  }

  async createProjectClaim(context: RequestContext, input: ProjectClaimInput): Promise<ProjectClaim> {
    return this.transaction(async client => {
      await this.requireProject(client, context, input.projectId)
      const state = await this.blueprintState(client, context.tenantId)
      if (input.changeOrderId) {
        const change = await client.query('SELECT id FROM change_orders WHERE tenant_id=$1 AND id=$2 AND project_id=$3', [context.tenantId, input.changeOrderId, input.projectId])
        if (!change.rowCount) throw new RepositoryError('Het gekozen meerwerk behoort niet tot dit project', 409)
      }
      if (input.documentIds.length) {
        const documents = await client.query<{id:string} & QueryResultRow>('SELECT id FROM documents WHERE tenant_id=$1 AND project_id=$2 AND id=ANY($3::uuid[])', [context.tenantId, input.projectId, input.documentIds])
        if (documents.rowCount !== input.documentIds.length) throw new RepositoryError('Een of meer bewijsdocumenten behoren niet tot dit project', 409)
      }
      const sequence = state.projectClaims.filter(item => item.createdAt.slice(0, 4) === new Date().getUTCFullYear().toString()).length + 1
      const item: ProjectClaim = { id: randomUUID(), number: `CL-${new Date().getUTCFullYear()}-${String(sequence).padStart(4, '0')}`, ...input, status: 'Concept', createdAt: new Date().toISOString() }
      state.projectClaims.unshift(item)
      await this.saveBlueprintState(client, context.tenantId, state)
      await this.audit(client, context, 'project_claim', item.id, 'created', null, item)
      return item
    })
  }

  async transitionProjectClaim(context: RequestContext, id: string, action: 'approve' | 'submit' | 'accept' | 'reject', notes?: string): Promise<ProjectClaim> {
    return this.transaction(async client => {
      const state = await this.blueprintState(client, context.tenantId)
      const current = state.projectClaims.find(item => item.id === id)
      if (!current) throw new RepositoryError('Claim niet gevonden', 404)
      if (context.roles.includes('Klant') && !['accept', 'reject'].includes(action)) throw new RepositoryError('Een klantaccount kan alleen een ingediende claim beoordelen', 403)
      if (context.roles.includes('Klant')) await this.requireClientProject(client, context, current.projectId)
      else await this.requireProject(client, context, current.projectId)
      const allowed: Record<typeof action, ProjectClaim['status'][]> = { approve: ['Concept'], submit: ['Intern goedgekeurd'], accept: ['Ingediend', 'In behandeling'], reject: ['Ingediend', 'In behandeling'] }
      if (!allowed[action].includes(current.status)) throw new RepositoryError('Deze claim kan vanuit de huidige status niet worden verwerkt', 409)
      if (action === 'reject' && !notes?.trim()) throw new RepositoryError('Een motivering is verplicht bij afwijzing', 409)
      const status: ProjectClaim['status'] = action === 'approve' ? 'Intern goedgekeurd' : action === 'submit' ? 'Ingediend' : action === 'accept' ? 'Aanvaard' : 'Afgewezen'
      const now = new Date().toISOString()
      const updated: ProjectClaim = { ...current, status, submittedAt: action === 'submit' ? now : current.submittedAt, decidedAt: ['accept', 'reject'].includes(action) ? now : current.decidedAt, decisionNotes: notes?.trim() || current.decisionNotes }
      state.projectClaims = state.projectClaims.map(item => item.id === id ? updated : item)
      await this.saveBlueprintState(client, context.tenantId, state)
      await this.audit(client, context, 'project_claim', id, action, current, updated, notes)
      return updated
    })
  }

  async createJointVenture(context: RequestContext, input: JointVentureInput): Promise<JointVenture> {
    return this.transaction(async client => { if (input.projectId) await this.requireProject(client, context, input.projectId); const state = await this.blueprintState(client, context.tenantId); const item: JointVenture = { id: randomUUID(), ...input, status: 'Actief', createdAt: new Date().toISOString() }; state.jointVentures.push(item); await this.saveBlueprintState(client, context.tenantId, state); await this.audit(client, context, 'joint_venture', item.id, 'created', null, item); return item })
  }

  async createIntegrationConnection(context: RequestContext, input: IntegrationConnectionInput): Promise<IntegrationConnection> {
    return this.transaction(async client => { if (!this.canAccessEntity(context, input.legalEntityId)) throw new RepositoryError('Geen toegang tot juridische entiteit', 403); const state = await this.blueprintState(client, context.tenantId); const item: IntegrationConnection = { id: randomUUID(), ...input, status: 'Concept', createdAt: new Date().toISOString() }; state.integrationConnections.push(item); await this.saveBlueprintState(client, context.tenantId, state); await this.audit(client, context, 'integration_connection', item.id, 'created', null, { ...item, endpoint: item.endpoint ? '[geconfigureerd]' : '' }); return item })
  }

  async testIntegrationConnection(context: RequestContext, id: string): Promise<IntegrationConnection> {
    const current = await this.transaction(async client => {
      const state = await this.blueprintState(client, context.tenantId)
      const connection = state.integrationConnections.find(item => item.id === id)
      if (!connection) throw new RepositoryError('Integratie niet gevonden', 404)
      if (!this.canAccessEntity(context, connection.legalEntityId)) throw new RepositoryError('Geen toegang tot juridische entiteit', 403)
      return connection
    })
    let failure: string | undefined
    try { await this.integrationGateway.test(current) } catch (error) { failure = error instanceof Error ? error.message : 'Integratietest is mislukt' }
    return this.transaction(async client => {
      const state = await this.blueprintState(client, context.tenantId)
      const latest = state.integrationConnections.find(item => item.id === id)
      if (!latest) throw new RepositoryError('Integratie niet gevonden', 404)
      const updated: IntegrationConnection = { ...latest, status: failure ? 'Fout' : 'Actief', lastTestAt: new Date().toISOString(), lastError: failure }
      state.integrationConnections = state.integrationConnections.map(item => item.id === id ? updated : item)
      await this.saveBlueprintState(client, context.tenantId, state)
      await this.audit(client, context, 'integration_connection', id, failure ? 'test_failed' : 'tested', latest, { ...updated, endpoint: updated.endpoint ? '[geconfigureerd]' : '' })
      return updated
    })
  }

  async createIntegrationJob(context: RequestContext, input: IntegrationJobInput): Promise<IntegrationJob> {
    return this.transaction(async client => { const state = await this.blueprintState(client, context.tenantId); const connection = state.integrationConnections.find(item => item.id === input.connectionId); if (!connection || connection.status !== 'Actief') throw new RepositoryError('Integratieverbinding is niet actief', 409); const now = new Date().toISOString(); const item: IntegrationJob = { id: randomUUID(), ...input, status: 'In wachtrij', attempts: 0, payloadDigest: createHash('sha256').update(`${input.entityType}:${input.entityId}:${input.direction}`).digest('hex'), nextAttemptAt: now, createdAt: now }; state.integrationJobs.unshift(item); await this.saveBlueprintState(client, context.tenantId, state); await this.audit(client, context, 'integration_job', item.id, 'queued', null, item); return item })
  }

  async processIntegrationJob(context: RequestContext, id: string): Promise<IntegrationJob> {
    const prepared = await this.transaction(async client => {
      const state = await this.blueprintState(client, context.tenantId)
      const current = state.integrationJobs.find(item => item.id === id)
      if (!current) throw new RepositoryError('Integratiejob niet gevonden', 404)
      const connection = state.integrationConnections.find(item => item.id === current.connectionId)
      if (!connection || connection.status !== 'Actief') throw new RepositoryError('Connector niet beschikbaar', 409)
      if (!this.canAccessEntity(context, connection.legalEntityId)) throw new RepositoryError('Geen toegang tot juridische entiteit', 403)
      const processing: IntegrationJob = { ...current, status: 'Bezig', attempts: current.attempts + 1, error: undefined }
      state.integrationJobs = state.integrationJobs.map(item => item.id === id ? processing : item)
      await this.saveBlueprintState(client, context.tenantId, state)
      await this.audit(client, context, 'integration_job', id, 'processing', current, processing)
      return { job: processing, connection }
    })
    let failure: string | undefined
    try { await this.integrationGateway.dispatch(prepared.connection, prepared.job) } catch (error) { failure = error instanceof Error ? error.message : 'Connectorverwerking is mislukt' }
    return this.transaction(async client => {
      const state = await this.blueprintState(client, context.tenantId)
      const current = state.integrationJobs.find(item => item.id === id)
      if (!current) throw new RepositoryError('Integratiejob niet gevonden', 404)
      const now = new Date().toISOString()
      const updated: IntegrationJob = { ...current, status: failure ? 'Mislukt' : 'Geslaagd', nextAttemptAt: failure ? new Date(Date.now() + Math.min(3600, 2 ** Math.max(0, current.attempts - 1) * 60) * 1000).toISOString() : current.nextAttemptAt, error: failure, completedAt: failure ? undefined : now }
      state.integrationJobs = state.integrationJobs.map(item => item.id === id ? updated : item)
      await this.saveBlueprintState(client, context.tenantId, state)
      await this.audit(client, context, 'integration_job', id, failure ? 'failed' : 'completed', current, updated)
      return updated
    })
  }

  async createAiAnalysis(context: RequestContext, projectId: string, input: AiAnalysisInput): Promise<AiAnalysis> {
    return this.transaction(async client => { await this.requireProject(client, context, projectId); const projectResult = await client.query<ProjectRow>('SELECT * FROM projects WHERE tenant_id=$1 AND id=$2', [context.tenantId, projectId]); const project = this.mapProject(projectResult.rows[0]); const documentResult = await client.query<{ id:string; title:string; notes:string } & QueryResultRow>(`SELECT d.id,d.title,COALESCE(v.notes,'') AS notes FROM documents d LEFT JOIN document_versions v ON v.tenant_id=d.tenant_id AND v.id=d.current_version_id WHERE d.tenant_id=$1 AND d.project_id=$2 ORDER BY d.created_at DESC LIMIT 8`, [context.tenantId, projectId]); const sources: AiAnalysis['sources'] = documentResult.rows.map(row => ({ documentId: row.id, title: row.title, excerpt: row.notes || 'Documentmetadata beschikbaar in het projectdossier.' })); if (!sources.length) sources.push({ documentId: `project-${project.id}`, title: `Projectdossier ${project.number}`, excerpt: `${project.name}; contractwaarde ${project.contractValue}; risico's: ${project.handover.risks.join('; ') || 'geen geregistreerde risico’s'}.` }); const generated = await this.aiGateway.analyze({ project, request: input, sources }); const citedSources = sources.filter(source => source.documentId && generated.sourceIds.includes(source.documentId)); if (!citedSources.length) throw new RepositoryError('AI-antwoord bevat geen geldige dossierbron', 502); const state = await this.blueprintState(client, context.tenantId); const item: AiAnalysis = { id: randomUUID(), projectId, ...input, answer: generated.answer, sources: citedSources, status: 'Concept', createdAt: new Date().toISOString() }; state.aiAnalyses.unshift(item); await this.saveBlueprintState(client, context.tenantId, state); await this.audit(client, context, 'ai_analysis', item.id, 'created_with_sources', null, item); return item })
  }

  async approveAiAnalysis(context: RequestContext, id: string, approvedBy: string): Promise<AiAnalysis> {
    return this.transaction(async client => { const state = await this.blueprintState(client, context.tenantId); const current = state.aiAnalyses.find(item => item.id === id); if (!current) throw new RepositoryError('AI-analyse niet gevonden', 404); if (!current.sources.length) throw new RepositoryError('AI-analyse zonder bronnen kan niet worden goedgekeurd', 409); const updated: AiAnalysis = { ...current, status: 'Goedgekeurd', approvedBy, approvedAt: new Date().toISOString() }; state.aiAnalyses = state.aiAnalyses.map(item => item.id === id ? updated : item); await this.saveBlueprintState(client, context.tenantId, state); await this.audit(client, context, 'ai_analysis', id, 'approved', current, updated); return updated })
  }

  async createProjectContract(context: RequestContext, projectId: string, input: ProjectContractInput): Promise<ProjectContract> {
    return this.transaction(async client => { await this.requireProject(client, context, projectId); await this.requireProjectDocuments(client,context,projectId,input.documentIds); const state = await this.blueprintState(client, context.tenantId); if (state.projectContracts.some(item => item.projectId === projectId && item.status !== 'Afgesloten')) throw new RepositoryError('Project heeft al een actief contractdossier', 409); const createdAt = new Date().toISOString(); const item: ProjectContract = { id: randomUUID(), projectId, ...input, status: 'Actief', approvalStatus:'Concept', versions:[{id:randomUUID(),version:1,changeSummary:'Contractdossier aangemaakt',createdBy:context.displayName,createdAt}], createdAt }; state.projectContracts.push(item); await this.saveBlueprintState(client, context.tenantId, state); await this.audit(client, context, 'project_contract', item.id, 'created', null, item); return item })
  }

  async updateProjectContract(context: RequestContext, contractId: string, input: ProjectContractUpdateInput): Promise<ProjectContract> {
    return this.transaction(async client => { const state = await this.blueprintState(client, context.tenantId); const current = state.projectContracts.find(item => item.id === contractId); if (!current) throw new RepositoryError('Contractdossier niet gevonden', 404); await this.requireProject(client, context, current.projectId); await this.requireProjectDocuments(client,context,current.projectId,input.documentIds); const changedFields = Object.keys(input); const updated: ProjectContract = { ...current, ...input, approvalStatus:'Concept',submittedBy:undefined,submittedAt:undefined,approvedBy:undefined,approvedAt:undefined, versions:[...(current.versions ?? []),{id:randomUUID(),version:(current.versions?.at(-1)?.version ?? 0)+1,changeSummary:changedFields.join(', ') || 'Dossier bijgewerkt',createdBy:context.displayName,createdAt:new Date().toISOString()}] }; if (updated.executionEnd < updated.executionStart) throw new RepositoryError('Uitvoeringseinde ligt voor de start', 409); state.projectContracts = state.projectContracts.map(item => item.id === contractId ? updated : item); await this.saveBlueprintState(client, context.tenantId, state); await this.audit(client, context, 'project_contract', contractId, 'updated', current, updated); return updated })
  }

  async submitProjectContract(context:RequestContext,contractId:string):Promise<ProjectContract>{return this.transaction(async client=>{const state=await this.blueprintState(client,context.tenantId);const current=state.projectContracts.find(item=>item.id===contractId);if(!current)throw new RepositoryError('Contractdossier niet gevonden',404);await this.requireProject(client,context,current.projectId);if((current.approvalStatus??'Concept')!=='Concept')throw new RepositoryError('Alleen een conceptcontract kan ter goedkeuring worden aangeboden',409);if(!(current.documentIds?.length))throw new RepositoryError('Koppel minstens het getekende contract of de contractdocumenten voor indiening',409);const updated:ProjectContract={...current,approvalStatus:'Ter goedkeuring',submittedBy:context.displayName,submittedAt:new Date().toISOString()};state.projectContracts=state.projectContracts.map(item=>item.id===contractId?updated:item);await this.saveBlueprintState(client,context.tenantId,state);await this.audit(client,context,'project_contract',contractId,'submitted_for_approval',current,updated);return updated})}

  async approveProjectContract(context:RequestContext,contractId:string):Promise<ProjectContract>{return this.transaction(async client=>{const state=await this.blueprintState(client,context.tenantId);const current=state.projectContracts.find(item=>item.id===contractId);if(!current)throw new RepositoryError('Contractdossier niet gevonden',404);await this.requireProject(client,context,current.projectId);if(current.approvalStatus!=='Ter goedkeuring')throw new RepositoryError('Alleen een ingediend contract kan worden goedgekeurd',409);const updated:ProjectContract={...current,approvalStatus:'Goedgekeurd',approvedBy:context.displayName,approvedAt:new Date().toISOString()};state.projectContracts=state.projectContracts.map(item=>item.id===contractId?updated:item);await this.saveBlueprintState(client,context.tenantId,state);await this.audit(client,context,'project_contract',contractId,'approved',current,updated);return updated})}

  async completeContractObligation(context: RequestContext, contractId: string, obligationId: string): Promise<ProjectContract> {
    return this.transaction(async client => { const state = await this.blueprintState(client, context.tenantId); const current = state.projectContracts.find(item => item.id === contractId); if (!current || !current.obligations.some(item => item.id === obligationId)) throw new RepositoryError('Contractverplichting niet gevonden', 404); await this.requireProject(client, context, current.projectId); const updated = { ...current, obligations: current.obligations.map(item => item.id === obligationId ? { ...item, status: 'Voltooid' as const, completedAt: new Date().toISOString() } : item) }; state.projectContracts = state.projectContracts.map(item => item.id === contractId ? updated : item); await this.saveBlueprintState(client, context.tenantId, state); await this.audit(client, context, 'project_contract', contractId, 'obligation_completed', current, updated); return updated })
  }

  async createProjectCloseout(context: RequestContext, projectId: string, input: ProjectCloseoutInput): Promise<ProjectCloseout> {
    return this.transaction(async client => { await this.requireProject(client, context, projectId); const state = await this.blueprintState(client, context.tenantId); if (state.projectCloseouts.some(item => item.projectId === projectId)) throw new RepositoryError('Opleverdossier bestaat al', 409); const item: ProjectCloseout = { id: randomUUID(), projectId, ...input, items: [], serviceRequests: [], createdAt: new Date().toISOString() }; state.projectCloseouts.push(item); await this.saveBlueprintState(client, context.tenantId, state); await this.audit(client, context, 'project_closeout', item.id, 'created', null, item); return item })
  }

  async addCloseoutItem(context: RequestContext, closeoutId: string, input: Omit<import('../../src/domain.js').CloseoutItem, 'id' | 'status' | 'resolvedAt'>): Promise<ProjectCloseout> {
    return this.transaction(async client => { const state = await this.blueprintState(client, context.tenantId); const current = state.projectCloseouts.find(item => item.id === closeoutId); if (!current) throw new RepositoryError('Opleverdossier niet gevonden', 404); await this.requireProject(client, context, current.projectId); const updated = { ...current, items: [...current.items, { id: randomUUID(), ...input, status: 'Open' as const }] }; state.projectCloseouts = state.projectCloseouts.map(item => item.id === closeoutId ? updated : item); await this.saveBlueprintState(client, context.tenantId, state); await this.audit(client, context, 'project_closeout', closeoutId, 'item_added', current, updated); return updated })
  }

  async resolveCloseoutItem(context: RequestContext, closeoutId: string, itemId: string): Promise<ProjectCloseout> {
    return this.transaction(async client => { const state = await this.blueprintState(client, context.tenantId); const current = state.projectCloseouts.find(item => item.id === closeoutId); if (!current || !current.items.some(item => item.id === itemId)) throw new RepositoryError('Opleverpunt niet gevonden', 404); await this.requireProject(client, context, current.projectId); const updated = { ...current, items: current.items.map(item => item.id === itemId ? { ...item, status: 'Opgelost' as const, resolvedAt: new Date().toISOString() } : item) }; state.projectCloseouts = state.projectCloseouts.map(item => item.id === closeoutId ? updated : item); await this.saveBlueprintState(client, context.tenantId, state); await this.audit(client, context, 'project_closeout', closeoutId, 'item_resolved', current, updated); return updated })
  }

  async updateProjectCloseout(context: RequestContext, closeoutId: string, input: ProjectCloseoutUpdateInput): Promise<ProjectCloseout> {
    return this.transaction(async client => { const state = await this.blueprintState(client, context.tenantId); const current = state.projectCloseouts.find(item => item.id === closeoutId); if (!current) throw new RepositoryError('Opleverdossier niet gevonden', 404); await this.requireProject(client, context, current.projectId); if (['Voorlopig opgeleverd','Definitief opgeleverd','Nazorg'].includes(input.status) && !input.provisionalAcceptanceOn) throw new RepositoryError('Datum voorlopige oplevering is verplicht', 409); if (['Definitief opgeleverd','Nazorg'].includes(input.status) && (!input.definitiveAcceptanceOn || !input.asBuiltComplete || !input.maintenanceFileComplete)) throw new RepositoryError('Definitieve oplevering vereist datum, as-built en onderhoudsdossier', 409); if (input.bondReleaseStatus === 'Vrijgegeven' && input.status === 'Voorbereiding') throw new RepositoryError('Borg kan niet voor de oplevering worden vrijgegeven', 409); const updated: ProjectCloseout = { ...current, ...input }; state.projectCloseouts = state.projectCloseouts.map(item => item.id === closeoutId ? updated : item); await this.saveBlueprintState(client, context.tenantId, state); await this.audit(client, context, 'project_closeout', closeoutId, 'status_updated', current, updated); return updated })
  }

  async customerSignProjectCloseout(context: RequestContext, closeoutId: string): Promise<ProjectCloseout> {
    return this.transaction(async client => {
      const state = await this.blueprintState(client, context.tenantId)
      const current = state.projectCloseouts.find(item => item.id === closeoutId)
      if (!current) throw new RepositoryError('Opleverdossier niet gevonden', 404)
      await this.requireProject(client, context, current.projectId)
      await this.requireClientProject(client, context, current.projectId)
      if (current.status === 'Voorbereiding') throw new RepositoryError('De klant kan pas tekenen nadat het dossier voorlopig is opgeleverd', 409)
      if (current.customerSignedAt) throw new RepositoryError('Dit opleverdossier is al door de klant bevestigd', 409)
      const updated: ProjectCloseout = { ...current, customerSignedBy: context.displayName, customerSignedAt: new Date().toISOString() }
      state.projectCloseouts = state.projectCloseouts.map(item => item.id === closeoutId ? updated : item)
      await this.saveBlueprintState(client, context.tenantId, state)
      await this.audit(client, context, 'project_closeout', closeoutId, 'customer_signed', current, updated, `Digitaal bevestigd door ${context.displayName}`)
      return updated
    })
  }

  async addServiceRequest(context: RequestContext, closeoutId: string, input: ServiceRequestInput): Promise<ProjectCloseout> {
    return this.transaction(async client => { const state = await this.blueprintState(client, context.tenantId); const current = state.projectCloseouts.find(item => item.id === closeoutId); if (!current) throw new RepositoryError('Opleverdossier niet gevonden', 404); await this.requireProject(client, context, current.projectId); const updated: ProjectCloseout = { ...current, status: 'Nazorg', serviceRequests: [{ id: randomUUID(), ...input, status: 'Nieuw' }, ...current.serviceRequests] }; state.projectCloseouts = state.projectCloseouts.map(item => item.id === closeoutId ? updated : item); await this.saveBlueprintState(client, context.tenantId, state); await this.audit(client, context, 'project_closeout', closeoutId, 'service_request_added', current, updated, input.title); return updated })
  }

  async resolveServiceRequest(context: RequestContext, closeoutId: string, requestId: string): Promise<ProjectCloseout> {
    return this.transaction(async client => { const state = await this.blueprintState(client, context.tenantId); const current = state.projectCloseouts.find(item => item.id === closeoutId); if (!current || !current.serviceRequests.some(item => item.id === requestId)) throw new RepositoryError('Serviceaanvraag niet gevonden', 404); await this.requireProject(client, context, current.projectId); const updated: ProjectCloseout = { ...current, serviceRequests: current.serviceRequests.map(item => item.id === requestId ? { ...item, status: 'Opgelost', resolvedAt: new Date().toISOString() } : item) }; state.projectCloseouts = state.projectCloseouts.map(item => item.id === closeoutId ? updated : item); await this.saveBlueprintState(client, context.tenantId, state); await this.audit(client, context, 'project_closeout', closeoutId, 'service_request_resolved', current, updated); return updated })
  }

  async updateLegalEntityFinancial(context: RequestContext, legalEntityId: string, input: LegalEntityFinancialInput): Promise<LegalEntity> {
    return this.transaction(async client => {
      if (!this.canAccessEntity(context, legalEntityId)) throw new RepositoryError('Je hebt geen toegang tot deze juridische entiteit', 403)
      const result = await client.query<LegalEntityRow>('SELECT * FROM legal_entities WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [context.tenantId, legalEntityId])
      if (!result.rowCount) throw new RepositoryError('Juridische entiteit niet gevonden', 404)
      const previous = mapLegalEntity(result.rows[0])
      await client.query('UPDATE legal_entities SET vat_number=$3,invoice_prefix=$4,next_invoice_number=$5,default_vat_pct=$6,iban=$7,bic=$8,payment_terms_days=$9,address_line=$10,postal_code=$11,city=$12,country_code=$13,peppol_endpoint_id=$14,peppol_scheme_id=$15 WHERE tenant_id=$1 AND id=$2', [context.tenantId, legalEntityId, input.vatNumber, input.invoicePrefix, input.nextInvoiceNumber, input.defaultVatPct, input.iban, input.bic, input.paymentTermsDays, input.addressLine, input.postalCode, input.city, input.countryCode, input.peppolEndpointId, input.peppolSchemeId])
      const updated: LegalEntity = { ...previous, ...input }
      await this.audit(client, context, 'legal_entity', legalEntityId, 'financial_settings_updated', previous, updated)
      return updated
    })
  }

  async createIntercompanyCharge(context: RequestContext, input: IntercompanyChargeInput): Promise<IntercompanyCharge> {
    return this.transaction(async client => {
      const entities = await client.query<{ id: string }>('SELECT id FROM legal_entities WHERE tenant_id=$1 AND id=ANY($2::uuid[])', [context.tenantId, [input.fromLegalEntityId, input.toLegalEntityId]])
      if (entities.rowCount !== 2) throw new RepositoryError('Selecteer twee geldige juridische entiteiten', 409)
      if (input.projectId) {
        const project = await client.query<ProjectRow>('SELECT * FROM projects WHERE tenant_id=$1 AND id=$2', [context.tenantId, input.projectId])
        if (!project.rowCount || project.rows[0].legal_entity_id !== input.toLegalEntityId) throw new RepositoryError('Het project moet tot de ontvangende entiteit behoren', 409)
      }
      const count = await client.query<{ count: string }>('SELECT count(*)::text AS count FROM intercompany_charges WHERE tenant_id=$1', [context.tenantId])
      const totalAmount = cents(input.baseAmount * (1 + input.markupPct / 100))
      const charge: IntercompanyCharge = { id: randomUUID(), number: `IC-${new Date().getFullYear()}-${String(Number(count.rows[0].count) + 1).padStart(4, '0')}`, ...input, totalAmount, status: 'Concept', createdAt: new Date().toISOString() }
      await client.query(`INSERT INTO intercompany_charges (tenant_id,id,number,from_legal_entity_id,to_legal_entity_id,project_id,description,base_amount,markup_pct,total_amount,status,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`, [context.tenantId, charge.id, charge.number, charge.fromLegalEntityId, charge.toLegalEntityId, charge.projectId ?? null, charge.description, charge.baseAmount, charge.markupPct, charge.totalAmount, charge.status, charge.createdAt])
      await this.audit(client, context, 'intercompany_charge', charge.id, 'created', null, charge)
      return charge
    })
  }

  async approveIntercompanyCharge(context: RequestContext, chargeId: string): Promise<IntercompanyCharge> {
    return this.transitionIntercompanyCharge(context, chargeId, 'Concept', 'Goedgekeurd', 'approved_at', 'approved')
  }

  async postIntercompanyCharge(context: RequestContext, chargeId: string): Promise<IntercompanyCharge> {
    return this.transitionIntercompanyCharge(context, chargeId, 'Goedgekeurd', 'Geboekt', 'posted_at', 'posted')
  }

  async createCompanyBranch(context: RequestContext, legalEntityId: string, input: CompanyBranchInput): Promise<CompanyBranch> {
    return this.transaction(async client => {
      if (!this.canAccessEntity(context, legalEntityId)) throw new RepositoryError('Je hebt geen toegang tot deze juridische entiteit', 403)
      const entity = await client.query('SELECT id FROM legal_entities WHERE tenant_id=$1 AND id=$2', [context.tenantId, legalEntityId])
      if (!entity.rowCount) throw new RepositoryError('Juridische entiteit niet gevonden', 404)
      const branch: CompanyBranch = { id: randomUUID(), legalEntityId, ...input, createdAt: new Date().toISOString() }
      await client.query(`INSERT INTO company_branches (tenant_id,id,legal_entity_id,name,address,country,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)`, [context.tenantId, branch.id, legalEntityId, branch.name, branch.address, branch.country, branch.createdAt])
      await this.audit(client, context, 'company_branch', branch.id, 'created', null, branch)
      return branch
    })
  }

  async updateCompanyUserAccess(context: RequestContext, userId: string, input: CompanyUserAccessInput): Promise<CompanyUser> {
    return this.transaction(async client => {
      const user = await client.query<CompanyUserRow>('SELECT id,display_name,email,role,roles,status,employee_id,organization_id,subcontractor_id,supplier_id,all_legal_entities,all_projects FROM users WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [context.tenantId, userId])
      if (!user.rowCount) throw new RepositoryError('Gebruiker niet gevonden', 404)
      const entityIds = [...new Set(input.legalEntityIds)]
      const projectIds=[...new Set(input.projectIds??[])]
      if (!input.allLegalEntities) {
        const entities = await client.query<{ id: string }>('SELECT id FROM legal_entities WHERE tenant_id=$1', [context.tenantId])
        const existing = new Set(entities.rows.map(entity => entity.id))
        if (entityIds.some(id => !existing.has(id))) throw new RepositoryError('Een geselecteerde juridische entiteit bestaat niet', 409)
      }
      const previousAccess = await client.query<UserEntityAccessRow>('SELECT user_id,legal_entity_id FROM user_legal_entity_access WHERE tenant_id=$1 AND user_id=$2', [context.tenantId, userId])
      const previousProjects=await client.query<UserProjectAccessRow>('SELECT user_id,project_id FROM user_project_access WHERE tenant_id=$1 AND user_id=$2',[context.tenantId,userId])
      const row=user.rows[0]
      const previous: CompanyUser = { id:row.id,displayName:row.display_name,email:row.email,role:row.role,roles:[...new Set([row.role,...jsonValue<string[]>(row.roles??[])])],status:row.status as CompanyUser['status'],employeeId:row.employee_id??undefined,organizationId:row.organization_id??undefined,subcontractorId:row.subcontractor_id??undefined,supplierId:row.supplier_id??undefined,allLegalEntities:row.all_legal_entities,legalEntityIds:previousAccess.rows.map(item=>item.legal_entity_id),allProjects:row.all_projects,projectIds:previousProjects.rows.map(item=>item.project_id) }
      if(!input.allProjects){const projects=await client.query<{id:string}>('SELECT id FROM projects WHERE tenant_id=$1',[context.tenantId]);const existing=new Set(projects.rows.map(item=>item.id));if(projectIds.some(id=>!existing.has(id)))throw new RepositoryError('Een geselecteerd project bestaat niet',409)}
      await client.query('UPDATE users SET all_legal_entities=$3,all_projects=$4 WHERE tenant_id=$1 AND id=$2', [context.tenantId, userId, input.allLegalEntities,input.allProjects??true])
      await client.query('DELETE FROM user_legal_entity_access WHERE tenant_id=$1 AND user_id=$2', [context.tenantId, userId])
      if (!input.allLegalEntities) for (const legalEntityId of entityIds) await client.query('INSERT INTO user_legal_entity_access (tenant_id,user_id,legal_entity_id) VALUES ($1,$2,$3)', [context.tenantId, userId, legalEntityId])
      await client.query('DELETE FROM user_project_access WHERE tenant_id=$1 AND user_id=$2',[context.tenantId,userId])
      if(!input.allProjects)for(const projectId of projectIds)await client.query('INSERT INTO user_project_access (tenant_id,user_id,project_id) VALUES ($1,$2,$3)',[context.tenantId,userId,projectId])
      const updated: CompanyUser = { ...previous, allLegalEntities:input.allLegalEntities,legalEntityIds:input.allLegalEntities?[]:entityIds,allProjects:input.allProjects??true,projectIds:(input.allProjects??true)?[]:projectIds }
      await this.audit(client, context, 'user', userId, 'company_access_updated', previous, updated)
      return updated
    })
  }

  async inviteCompanyUser(context:RequestContext,input:CompanyUserProfileInput):Promise<CompanyUser>{
    return this.transaction(async client=>{
      const duplicate=await client.query('SELECT id FROM users WHERE tenant_id=$1 AND lower(email)=lower($2)',[context.tenantId,input.email]);if(duplicate.rowCount)throw new RepositoryError('Er bestaat al een gebruiker met dit e-mailadres',409)
      const id=randomUUID();await client.query(`INSERT INTO users (tenant_id,id,entra_object_id,display_name,email,role,roles,status,employee_id,organization_id,subcontractor_id,supplier_id,all_legal_entities,all_projects) VALUES ($1,$2,null,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,[context.tenantId,id,input.displayName,input.email,input.role,JSON.stringify(input.roles?.length?input.roles:[input.role]),input.status,input.employeeId??null,input.organizationId??null,input.subcontractorId??null,input.supplierId??null,input.allLegalEntities,input.allProjects])
      if(!input.allLegalEntities)for(const entityId of input.legalEntityIds)await client.query('INSERT INTO user_legal_entity_access (tenant_id,user_id,legal_entity_id) VALUES ($1,$2,$3)',[context.tenantId,id,entityId])
      if(!input.allProjects)for(const projectId of input.projectIds??[])await client.query('INSERT INTO user_project_access (tenant_id,user_id,project_id) VALUES ($1,$2,$3)',[context.tenantId,id,projectId])
      const created:CompanyUser={id,...input,legalEntityIds:input.allLegalEntities?[]:input.legalEntityIds,projectIds:input.allProjects?[]:input.projectIds??[]};await this.audit(client,context,'user',id,'invited',null,created);return created
    })
  }

  async updateCompanyUser(context:RequestContext,userId:string,input:CompanyUserProfileInput):Promise<CompanyUser>{
    return this.transaction(async client=>{
      const current=await client.query<CompanyUserRow>('SELECT id,display_name,email,role,roles,status,employee_id,organization_id,subcontractor_id,supplier_id,all_legal_entities,all_projects FROM users WHERE tenant_id=$1 AND id=$2 FOR UPDATE',[context.tenantId,userId]);if(!current.rowCount)throw new RepositoryError('Gebruiker niet gevonden',404)
      const emailDuplicate=await client.query('SELECT id FROM users WHERE tenant_id=$1 AND lower(email)=lower($2) AND id<>$3',[context.tenantId,input.email,userId]);if(emailDuplicate.rowCount)throw new RepositoryError('Dit e-mailadres is al in gebruik',409)
      await client.query('UPDATE users SET display_name=$3,email=$4,role=$5,roles=$6,status=$7,employee_id=$8,organization_id=$9,subcontractor_id=$10,supplier_id=$11,all_legal_entities=$12,all_projects=$13 WHERE tenant_id=$1 AND id=$2',[context.tenantId,userId,input.displayName,input.email,input.role,JSON.stringify(input.roles?.length?input.roles:[input.role]),input.status,input.employeeId??null,input.organizationId??null,input.subcontractorId??null,input.supplierId??null,input.allLegalEntities,input.allProjects])
      await client.query('DELETE FROM user_legal_entity_access WHERE tenant_id=$1 AND user_id=$2',[context.tenantId,userId]);if(!input.allLegalEntities)for(const entityId of input.legalEntityIds)await client.query('INSERT INTO user_legal_entity_access (tenant_id,user_id,legal_entity_id) VALUES ($1,$2,$3)',[context.tenantId,userId,entityId])
      await client.query('DELETE FROM user_project_access WHERE tenant_id=$1 AND user_id=$2',[context.tenantId,userId]);if(!input.allProjects)for(const projectId of input.projectIds??[])await client.query('INSERT INTO user_project_access (tenant_id,user_id,project_id) VALUES ($1,$2,$3)',[context.tenantId,userId,projectId])
      const updated:CompanyUser={id:userId,...input,legalEntityIds:input.allLegalEntities?[]:input.legalEntityIds,projectIds:input.allProjects?[]:input.projectIds??[]};await this.audit(client,context,'user',userId,'profile_updated',current.rows[0],updated);return updated
    })
  }

  async createWorkflowDefinition(context:RequestContext,input:WorkflowDefinitionInput):Promise<WorkflowDefinition>{return this.transaction(async client=>{const state=await this.blueprintState(client,context.tenantId);if(state.workflowDefinitions.some(item=>item.dossierType===input.dossierType&&item.active&&input.active))throw new RepositoryError('Er bestaat al een actieve workflow voor dit dossiertype',409);const item:WorkflowDefinition={id:randomUUID(),...input,updatedAt:new Date().toISOString()};state.workflowDefinitions.push(item);await this.saveBlueprintState(client,context.tenantId,state);await this.audit(client,context,'workflow',item.id,'created',null,item);return item})}
  async updateWorkflowDefinition(context:RequestContext,id:string,input:WorkflowDefinitionInput):Promise<WorkflowDefinition>{return this.transaction(async client=>{const state=await this.blueprintState(client,context.tenantId);const current=state.workflowDefinitions.find(item=>item.id===id);if(!current)throw new RepositoryError('Workflow niet gevonden',404);if(input.active&&state.workflowDefinitions.some(item=>item.id!==id&&item.dossierType===input.dossierType&&item.active))throw new RepositoryError('Er bestaat al een actieve workflow voor dit dossiertype',409);const updated:WorkflowDefinition={id,...input,updatedAt:new Date().toISOString()};state.workflowDefinitions=state.workflowDefinitions.map(item=>item.id===id?updated:item);await this.saveBlueprintState(client,context.tenantId,state);await this.audit(client,context,'workflow',id,'updated',current,updated);return updated})}

  async correctWorkflow(context:RequestContext,input:WorkflowCorrectionInput):Promise<WorkflowCorrectionResult>{
    return this.transaction(async client=>{
      const sequence=workflowCorrectionSequences[input.dossierType]
      const targetIndex=sequence.indexOf(input.targetStatus)
      if(targetIndex<0)throw new RepositoryError('De gekozen doelstap is geen geldige status voor dit dossiertype',409)
      const correctedAt=new Date().toISOString()
      const finish=async(previousStatus:string,record:unknown,previous:unknown,entityType:string)=>{
        const currentIndex=sequence.indexOf(previousStatus)
        if(previousStatus===input.targetStatus||(currentIndex>=0&&targetIndex>=currentIndex))throw new RepositoryError('Kies een workflowstap die vóór de huidige status ligt',409)
        const correction:WorkflowCorrection={id:randomUUID(),...input,previousStatus,correctedBy:context.displayName,correctedAt}
        await this.audit(client,context,entityType,input.recordId,'workflow_corrected',previous,record,input.reason)
        return {correction,record}
      }

      if(input.dossierType==='opportunity'){
        const result=await client.query<OpportunityRow>('SELECT * FROM opportunities WHERE tenant_id=$1 AND id=$2 FOR UPDATE',[context.tenantId,input.recordId])
        if(!result.rowCount)throw new RepositoryError('Opportuniteit niet gevonden',404)
        const current=mapOpportunity(result.rows[0])
        if(current.legalEntityId&&!this.canAccessEntity(context,current.legalEntityId))throw new RepositoryError('Geen toegang tot de juridische entiteit van deze opportuniteit',403)
        const stage=input.targetStatus as Opportunity['stage']
        await client.query('UPDATE opportunities SET stage=$3 WHERE tenant_id=$1 AND id=$2',[context.tenantId,input.recordId,stage])
        return finish(current.stage,{...current,stage},current,'opportunity')
      }

      if(input.dossierType==='document'){
        const current=await this.lockDocument(client,context.tenantId,input.recordId)
        await this.requireProject(client,context,current.projectId)
        if(current.immutable)throw new RepositoryError('Een onveranderlijk archiefdocument kan niet naar een eerdere workflowstap worden teruggezet',409)
        const status=input.targetStatus as ProjectDocument['status']
        await client.query('UPDATE documents SET status=$3 WHERE tenant_id=$1 AND id=$2',[context.tenantId,input.recordId,status])
        return finish(current.status,{...current,status},current,'document')
      }

      if(input.dossierType==='daily-report'){
        const result=await client.query<DailyReportRow>('SELECT * FROM daily_reports WHERE tenant_id=$1 AND id=$2 FOR UPDATE',[context.tenantId,input.recordId])
        if(!result.rowCount)throw new RepositoryError('Dagrapport niet gevonden',404)
        const current=mapDailyReport(result.rows[0])
        await this.requireProject(client,context,current.projectId)
        const status=input.targetStatus as DailyReport['status']
        await client.query('UPDATE daily_reports SET status=$3 WHERE tenant_id=$1 AND id=$2',[context.tenantId,input.recordId,status])
        return finish(current.status,{...current,status},current,'daily_report')
      }

      if(input.dossierType==='change-order'){
        const current=await this.lockChangeOrder(client,context.tenantId,input.recordId)
        await this.requireProject(client,context,current.projectId)
        const status=input.targetStatus as ChangeOrder['status']
        await client.query('UPDATE change_orders SET status=$3 WHERE tenant_id=$1 AND id=$2',[context.tenantId,input.recordId,status])
        return finish(current.status,{...current,status},current,'change_order')
      }

      if(input.dossierType==='progress-statement'){
        const current=await this.lockProgressStatement(client,context.tenantId,input.recordId)
        await this.requireProject(client,context,current.projectId)
        const status=input.targetStatus as ProgressStatement['status']
        await client.query('UPDATE progress_statements SET status=$3 WHERE tenant_id=$1 AND id=$2',[context.tenantId,input.recordId,status])
        return finish(current.status,{...current,status},current,'progress_statement')
      }

      if(input.dossierType==='qhse-inspection'){
        const result=await client.query<QhseInspectionRow>('SELECT * FROM qhse_inspections WHERE tenant_id=$1 AND id=$2 FOR UPDATE',[context.tenantId,input.recordId])
        if(!result.rowCount)throw new RepositoryError('QHSE-controle niet gevonden',404)
        const current=mapQhseInspection(result.rows[0])
        await this.requireProject(client,context,current.projectId)
        if(input.targetStatus!=='Open')throw new RepositoryError('Een QHSE-controle kan alleen opnieuw worden geopend',409)
        const updated:QhseInspection={...current,status:'Open'}
        await client.query("UPDATE qhse_inspections SET status='Open' WHERE tenant_id=$1 AND id=$2",[context.tenantId,input.recordId])
        return finish(current.status,updated,current,'qhse_inspection')
      }

      const state=await this.blueprintState(client,context.tenantId)
      if(input.dossierType==='contract'){
        const current=state.projectContracts.find(item=>item.id===input.recordId)
        if(!current)throw new RepositoryError('Contractdossier niet gevonden',404)
        await this.requireProject(client,context,current.projectId)
        const updated:ProjectContract={...current,approvalStatus:input.targetStatus as ProjectContract['approvalStatus']}
        state.projectContracts=state.projectContracts.map(item=>item.id===current.id?updated:item)
        await this.saveBlueprintState(client,context.tenantId,state)
        return finish(current.approvalStatus,updated,current,'project_contract')
      }
      if(input.dossierType==='employee-absence'){
        const current=state.employeeAbsences.find(item=>item.id===input.recordId)
        if(!current)throw new RepositoryError('Afwezigheidsaanvraag niet gevonden',404)
        const employee=state.employees.find(item=>item.id===current.employeeId)
        if(employee&&!this.canAccessEntity(context,employee.legalEntityId))throw new RepositoryError('Geen toegang tot de juridische entiteit van deze medewerker',403)
        const updated:EmployeeAbsence={...current,status:input.targetStatus as EmployeeAbsence['status']}
        state.employeeAbsences=state.employeeAbsences.map(item=>item.id===current.id?updated:item)
        await this.saveBlueprintState(client,context.tenantId,state)
        return finish(current.status,updated,current,'employee_absence')
      }
      if(input.dossierType==='time-entry'){
        const current=state.timeEntries.find(item=>item.id===input.recordId)
        if(!current)throw new RepositoryError('Tijdsregistratie niet gevonden',404)
        await this.requireProject(client,context,current.projectId)
        const updated:TimeEntry={...current,status:input.targetStatus as TimeEntry['status']}
        state.timeEntries=state.timeEntries.map(item=>item.id===current.id?updated:item)
        await this.saveBlueprintState(client,context.tenantId,state)
        return finish(current.status,updated,current,'time_entry')
      }
      if(input.dossierType==='project-claim'){
        const current=state.projectClaims.find(item=>item.id===input.recordId)
        if(!current)throw new RepositoryError('Claimdossier niet gevonden',404)
        await this.requireProject(client,context,current.projectId)
        const updated:ProjectClaim={...current,status:input.targetStatus as ProjectClaim['status']}
        state.projectClaims=state.projectClaims.map(item=>item.id===current.id?updated:item)
        await this.saveBlueprintState(client,context.tenantId,state)
        return finish(current.status,updated,current,'project_claim')
      }
      throw new RepositoryError('Dit dossiertype ondersteunt geen workflowcorrectie',409)
    })
  }

  async updateProjectDetails(context: RequestContext, projectId: string, input: ProjectDetailsInput): Promise<Project> {
    return this.transaction(async client => {
      await this.requireProject(client, context, projectId)
      const result = await client.query<ProjectRow>('SELECT * FROM projects WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [context.tenantId, projectId])
      const organization = await client.query('SELECT id FROM organizations WHERE tenant_id=$1 AND id=$2', [context.tenantId, input.organizationId])
      if (!organization.rowCount) throw new RepositoryError('Opdrachtgever niet gevonden', 404)
      const current = this.mapProject(result.rows[0])
      await client.query('UPDATE projects SET name=$3,organization_id=$4,progress=$5,status=$6 WHERE tenant_id=$1 AND id=$2', [context.tenantId, projectId, input.name, input.organizationId, input.progress, input.status])
      const updated: Project = { ...current, ...input }
      await this.audit(client, context, 'project', projectId, 'details_updated', current, updated)
      return updated
    })
  }

  async assignProjectCompany(context: RequestContext, projectId: string, input: ProjectCompanyAssignmentInput): Promise<Project> {
    return this.transaction(async client => {
      if (!this.canAccessEntity(context, input.legalEntityId)) throw new RepositoryError('Je hebt geen toegang tot de gekozen juridische entiteit', 403)
      const projectResult = await client.query<ProjectRow>('SELECT * FROM projects WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [context.tenantId, projectId])
      if (!projectResult.rowCount) throw new RepositoryError('Project niet gevonden', 404)
      const entity = await client.query<LegalEntityRow>('SELECT * FROM legal_entities WHERE tenant_id=$1 AND id=$2', [context.tenantId, input.legalEntityId])
      if (!entity.rowCount || !entity.rows[0].active) throw new RepositoryError('Selecteer een actieve juridische entiteit', 409)
      if (input.branchId) {
        const branch = await client.query<CompanyBranchRow>('SELECT * FROM company_branches WHERE tenant_id=$1 AND id=$2 AND legal_entity_id=$3', [context.tenantId, input.branchId, input.legalEntityId])
        if (!branch.rowCount) throw new RepositoryError('De vestiging behoort niet tot de gekozen juridische entiteit', 409)
      }
      const current = this.mapProject(projectResult.rows[0])
      await client.query('UPDATE projects SET legal_entity_id=$3,branch_id=$4 WHERE tenant_id=$1 AND id=$2', [context.tenantId, projectId, input.legalEntityId, input.branchId ?? null])
      const updated: Project = { ...current, legalEntityId: input.legalEntityId, branchId: input.branchId }
      await this.audit(client, context, 'project', projectId, 'company_assignment_updated', current, updated)
      return updated
    })
  }

  async createOpportunity(context: RequestContext, input: OpportunityInput): Promise<Opportunity> {
    return this.transaction(async client => {
      if (input.legalEntityId) {
        if (!this.canAccessEntity(context, input.legalEntityId)) throw new RepositoryError('Geen toegang tot juridische entiteit', 403)
        const entity = await client.query('SELECT id FROM legal_entities WHERE tenant_id=$1 AND id=$2 AND active=true', [context.tenantId, input.legalEntityId])
        if (!entity.rowCount) throw new RepositoryError('Selecteer een actieve juridische entiteit', 409)
        if (input.branchId) {
          const branch = await client.query('SELECT id FROM company_branches WHERE tenant_id=$1 AND id=$2 AND legal_entity_id=$3', [context.tenantId, input.branchId, input.legalEntityId])
          if (!branch.rowCount) throw new RepositoryError('De vestiging behoort niet tot de gekozen juridische entiteit', 409)
        }
      } else if (input.branchId) throw new RepositoryError('Selecteer eerst een juridische entiteit', 409)
      const count = await client.query<{ count: string }>('SELECT count(*)::text AS count FROM opportunities WHERE tenant_id = $1', [context.tenantId])
      const opportunity: Opportunity = { id: randomUUID(), projectNumber: `OPP-${new Date().getFullYear()}-${String(Number(count.rows[0].count) + 1).padStart(3, '0')}`, ...input, stage: 'Nieuw' }
      await client.query(`INSERT INTO opportunities
        (tenant_id, id, project_number, title, organization_id, legal_entity_id, branch_id, location, deadline, estimated_value, probability, stage, recognition)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`, [context.tenantId, opportunity.id, opportunity.projectNumber, opportunity.title, opportunity.organizationId, opportunity.legalEntityId ?? null, opportunity.branchId ?? null, opportunity.location, opportunity.deadline, opportunity.estimatedValue, opportunity.probability, opportunity.stage, opportunity.recognition])
      await this.audit(client, context, 'opportunity', opportunity.id, 'created', null, opportunity)
      return opportunity
    })
  }

  async updateOpportunity(context: RequestContext, id: string, input: OpportunityDetailsInput): Promise<Opportunity> {
    return this.transaction(async client => {
      const result = await client.query<OpportunityRow>('SELECT * FROM opportunities WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [context.tenantId, id])
      if (!result.rowCount) throw new RepositoryError('Opportuniteit niet gevonden', 404)
      const organization = await client.query('SELECT id FROM organizations WHERE tenant_id=$1 AND id=$2', [context.tenantId, input.organizationId])
      if (!organization.rowCount) throw new RepositoryError('Opdrachtgever niet gevonden', 404)
      if (input.legalEntityId) {
        if (!this.canAccessEntity(context, input.legalEntityId)) throw new RepositoryError('Geen toegang tot juridische entiteit', 403)
        const entity = await client.query('SELECT id FROM legal_entities WHERE tenant_id=$1 AND id=$2 AND active=true', [context.tenantId, input.legalEntityId])
        if (!entity.rowCount) throw new RepositoryError('Selecteer een actieve juridische entiteit', 409)
        if (input.branchId) {
          const branch = await client.query('SELECT id FROM company_branches WHERE tenant_id=$1 AND id=$2 AND legal_entity_id=$3', [context.tenantId, input.branchId, input.legalEntityId])
          if (!branch.rowCount) throw new RepositoryError('De vestiging behoort niet tot de gekozen juridische entiteit', 409)
        }
      } else if (input.branchId) throw new RepositoryError('Selecteer eerst een juridische entiteit', 409)
      const current = mapOpportunity(result.rows[0])
      await client.query('UPDATE opportunities SET title=$3,organization_id=$4,legal_entity_id=$5,branch_id=$6,location=$7,deadline=$8,estimated_value=$9,probability=$10,recognition=$11,updated_at=now() WHERE tenant_id=$1 AND id=$2', [context.tenantId, id, input.title, input.organizationId, input.legalEntityId ?? null, input.branchId ?? null, input.location, input.deadline, input.estimatedValue, input.probability, input.recognition])
      const updated: Opportunity = { ...current, ...input }
      await this.audit(client, context, 'opportunity', id, 'updated', current, updated)
      return updated
    })
  }

  async qualifyOpportunity(context: RequestContext, id: string): Promise<Opportunity> {
    return this.transaction(async client => {
      const result = await client.query<OpportunityRow>('SELECT * FROM opportunities WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [context.tenantId, id])
      if (!result.rowCount) throw new RepositoryError('Opportuniteit niet gevonden', 404)
      const current = mapOpportunity(result.rows[0])
      if (current.stage !== 'Nieuw') throw new RepositoryError('Alleen een nieuwe opportuniteit kan worden gekwalificeerd', 409)
      const updated: Opportunity = { ...current, stage: 'Gekwalificeerd' }
      await client.query("UPDATE opportunities SET stage='Gekwalificeerd',updated_at=now() WHERE tenant_id=$1 AND id=$2", [context.tenantId, id])
      await this.audit(client, context, 'opportunity', id, 'qualified', current, updated)
      return updated
    })
  }

  async assessOpportunity(context: RequestContext, id: string, input: OpportunityGoNoGoInput): Promise<Opportunity> {
    return this.transaction(async client => {
      const result = await client.query<OpportunityRow>('SELECT * FROM opportunities WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [context.tenantId, id])
      if (!result.rowCount) throw new RepositoryError('Opportuniteit niet gevonden', 404)
      const current = mapOpportunity(result.rows[0])
      if (!['Gekwalificeerd', 'Go/No-Go', 'Verloren'].includes(current.stage)) throw new RepositoryError('Go/No-Go kan alleen vóór de calculatie worden beoordeeld', 409)
      const scoreValues = Object.values(input.scores)
      const assessment: OpportunityGoNoGo = { ...input, averageScore: Math.round(scoreValues.reduce((sum, value) => sum + value, 0) / scoreValues.length * 100) / 100, assessedAt: new Date().toISOString() }
      const updated: Opportunity = { ...current, stage: input.decision === 'Go' ? 'Go/No-Go' : 'Verloren', probability: input.decision === 'Go' ? Math.max(current.probability, 50) : 0, goNoGo: assessment }
      await client.query('UPDATE opportunities SET stage=$3,probability=$4,go_no_go=$5,updated_at=now() WHERE tenant_id=$1 AND id=$2', [context.tenantId, id, updated.stage, updated.probability, JSON.stringify(assessment)])
      await this.audit(client, context, 'opportunity', id, input.decision === 'Go' ? 'go_decision' : 'no_go_decision', current, updated)
      return updated
    })
  }

  async startCalculation(context: RequestContext, opportunityId: string): Promise<Calculation> {
    return this.transaction(async client => {
      const existing = await client.query<CalculationRow>('SELECT * FROM calculations WHERE tenant_id = $1 AND opportunity_id = $2', [context.tenantId, opportunityId])
      if (existing.rowCount) {
        const opportunityResult=await client.query<OpportunityRow>('SELECT * FROM opportunities WHERE tenant_id=$1 AND id=$2 FOR UPDATE',[context.tenantId,opportunityId])
        if(!opportunityResult.rowCount)throw new RepositoryError('Opportuniteit niet gevonden',404)
        const opportunity=mapOpportunity(opportunityResult.rows[0])
        if(opportunity.goNoGo?.decision!=='Go')throw new RepositoryError('Een expliciete Go-beslissing is vereist voordat de calculatie wordt hervat',409)
        if(opportunity.stage!=='Calculatie'){
          const updatedOpportunity:Opportunity={...opportunity,stage:'Calculatie'}
          await client.query("UPDATE opportunities SET stage='Calculatie',updated_at=now() WHERE tenant_id=$1 AND id=$2",[context.tenantId,opportunityId])
          await this.audit(client,context,'opportunity',opportunityId,'calculation_resumed',opportunity,updatedOpportunity)
        }
        const chapterRows = await client.query<BoqChapterRow>('SELECT * FROM boq_chapters WHERE tenant_id = $1 AND calculation_id = $2 ORDER BY sort_order', [context.tenantId, existing.rows[0].id])
        const itemRows = await client.query<BoqItemRow>('SELECT * FROM boq_items WHERE tenant_id = $1 AND calculation_id = $2 ORDER BY sort_order', [context.tenantId, existing.rows[0].id])
        return mapCalculation(existing.rows[0], chapterRows.rows.map(mapChapter), itemRows.rows.map(mapItem))
      }
      const opportunity = await client.query<OpportunityRow>('SELECT * FROM opportunities WHERE tenant_id = $1 AND id = $2', [context.tenantId, opportunityId])
      if (!opportunity.rowCount) throw new RepositoryError('Opportuniteit niet gevonden', 404)
      const opportunityState = mapOpportunity(opportunity.rows[0])
      if (opportunityState.goNoGo?.decision !== 'Go') throw new RepositoryError('Een expliciete Go-beslissing is vereist voordat de calculatie start', 409)
      const count = await client.query<{ count: string }>('SELECT count(*)::text AS count FROM calculations WHERE tenant_id = $1', [context.tenantId])
      const calculation: Calculation = { id: randomUUID(), number: `CAL-${new Date().getFullYear()}-${String(Number(count.rows[0].count) + 1).padStart(3, '0')}`, opportunityId, status: 'In opmaak', overheadPct: 8, riskPct: 2, marginPct: 10, siteOverheadPct: 0, escalationPct: 0, discountPct: 0, roundingStep: 0, chapters: [], items: [], updatedAt: new Date().toISOString() }
      await client.query(`INSERT INTO calculations (tenant_id,id,number,opportunity_id,status,overhead_pct,risk_pct,margin_pct,site_overhead_pct,escalation_pct,discount_pct,rounding_step)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`, [context.tenantId, calculation.id, calculation.number, opportunityId, calculation.status, calculation.overheadPct, calculation.riskPct, calculation.marginPct, calculation.siteOverheadPct, calculation.escalationPct, calculation.discountPct, calculation.roundingStep])
      await client.query(`UPDATE opportunities SET stage = 'Calculatie', updated_at = now() WHERE tenant_id = $1 AND id = $2`, [context.tenantId, opportunityId])
      await this.audit(client, context, 'calculation', calculation.id, 'created', null, calculation)
      return calculation
    })
  }

  async updateCalculation(context: RequestContext, id: string, patch: Partial<Pick<Calculation, 'overheadPct' | 'riskPct' | 'marginPct' | 'siteOverheadPct' | 'escalationPct' | 'discountPct' | 'roundingStep'>>): Promise<Calculation> {
    return this.transaction(async client => {
      const before = await this.getCalculation(client, context.tenantId, id)
      if (!before) throw new RepositoryError('Calculatie niet gevonden', 404)
      const next = { ...before, ...patch, updatedAt: new Date().toISOString() }
      await client.query(`UPDATE calculations SET overhead_pct=$3, risk_pct=$4, margin_pct=$5, site_overhead_pct=$6, escalation_pct=$7, discount_pct=$8, rounding_step=$9, updated_at=now()
        WHERE tenant_id=$1 AND id=$2`, [context.tenantId, id, next.overheadPct, next.riskPct, next.marginPct, next.siteOverheadPct ?? 0, next.escalationPct ?? 0, next.discountPct ?? 0, next.roundingStep ?? 0])
      await this.audit(client, context, 'calculation', id, 'updated', before, next)
      return next
    })
  }

  async addBoqItem(context: RequestContext, calculationId: string, input: BoqItemInput): Promise<BoqItem> {
    return this.transaction(async client => {
      if (!await this.getCalculation(client, context.tenantId, calculationId)) throw new RepositoryError('Calculatie niet gevonden', 404)
      if (input.chapterId) {
        const chapter = await client.query('SELECT id FROM boq_chapters WHERE tenant_id=$1 AND calculation_id=$2 AND id=$3', [context.tenantId, calculationId, input.chapterId])
        if (!chapter.rowCount) throw new RepositoryError('Hoofdstuk behoort niet tot deze calculatie', 409)
      }
      const item: BoqItem = { ...input, id: randomUUID() }
      const order = await client.query<{ count: string }>('SELECT count(*)::text AS count FROM boq_items WHERE tenant_id=$1 AND calculation_id=$2', [context.tenantId, calculationId])
      item.sortOrder = Number(order.rows[0].count)
      await client.query(`INSERT INTO boq_items
        (tenant_id,id,calculation_id,chapter_id,code,description,quantity,unit,labor,material,equipment,subcontracting,advanced,sort_order)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`, [context.tenantId, item.id, calculationId, item.chapterId ?? null, item.code, item.description, item.quantity, item.unit, item.labor, item.material, item.equipment, item.subcontracting, JSON.stringify(itemAdvanced(item)), item.sortOrder])
      await client.query('UPDATE calculations SET updated_at=now() WHERE tenant_id=$1 AND id=$2', [context.tenantId, calculationId])
      await this.audit(client, context, 'boq_item', item.id, 'created', null, item)
      return item
    })
  }

  async updateBoqItem(context: RequestContext, calculationId: string, itemId: string, patch: Partial<BoqItemInput>): Promise<BoqItem> {
    return this.transaction(async client => {
      const result = await client.query<BoqItemRow>('SELECT * FROM boq_items WHERE tenant_id=$1 AND calculation_id=$2 AND id=$3', [context.tenantId, calculationId, itemId])
      if (!result.rowCount) throw new RepositoryError('Meetstaatpost niet gevonden', 404)
      const before = mapItem(result.rows[0])
      const costApplications = { ...before.costApplications }
      for (const category of ['labor', 'material', 'equipment', 'subcontracting'] as const) {
        if (category in patch) delete costApplications[category]
      }
      const next = { ...before, ...patch, costApplications }
      if (next.chapterId) {
        const chapter = await client.query('SELECT id FROM boq_chapters WHERE tenant_id=$1 AND calculation_id=$2 AND id=$3', [context.tenantId, calculationId, next.chapterId])
        if (!chapter.rowCount) throw new RepositoryError('Hoofdstuk behoort niet tot deze calculatie', 409)
      }
      await client.query(`UPDATE boq_items SET chapter_id=$4,code=$5,description=$6,quantity=$7,unit=$8,labor=$9,material=$10,equipment=$11,subcontracting=$12,cost_applications=$13,advanced=$14,sort_order=$15
        WHERE tenant_id=$1 AND calculation_id=$2 AND id=$3`, [context.tenantId, calculationId, itemId, next.chapterId ?? null, next.code, next.description, next.quantity, next.unit, next.labor, next.material, next.equipment, next.subcontracting, JSON.stringify(next.costApplications), JSON.stringify(itemAdvanced(next)), next.sortOrder ?? 0])
      await client.query('UPDATE calculations SET updated_at=now() WHERE tenant_id=$1 AND id=$2', [context.tenantId, calculationId])
      await this.audit(client, context, 'boq_item', itemId, 'updated', before, next)
      return next
    })
  }

  async removeBoqItem(context: RequestContext, calculationId: string, itemId: string): Promise<void> {
    await this.transaction(async client => {
      const result = await client.query<BoqItemRow>('SELECT * FROM boq_items WHERE tenant_id=$1 AND calculation_id=$2 AND id=$3', [context.tenantId, calculationId, itemId])
      if (!result.rowCount) throw new RepositoryError('Meetstaatpost niet gevonden', 404)
      const before = mapItem(result.rows[0])
      await client.query('DELETE FROM boq_items WHERE tenant_id=$1 AND calculation_id=$2 AND id=$3', [context.tenantId, calculationId, itemId])
      await client.query('UPDATE calculations SET updated_at=now() WHERE tenant_id=$1 AND id=$2', [context.tenantId, calculationId])
      await this.audit(client, context, 'boq_item', itemId, 'deleted', before, null)
    })
  }

  async addChapter(context: RequestContext, calculationId: string, input: Pick<BoqChapter, 'code' | 'name' | 'parentChapterId' | 'responsibleUserId' | 'workflowStatus'>): Promise<BoqChapter> {
    return this.transaction(async client => {
      if (!await this.getCalculation(client, context.tenantId, calculationId)) throw new RepositoryError('Calculatie niet gevonden', 404)
      const existing = await client.query<BoqChapterRow>('SELECT * FROM boq_chapters WHERE tenant_id=$1 AND calculation_id=$2 AND code=$3', [context.tenantId, calculationId, input.code])
      if (existing.rowCount) return mapChapter(existing.rows[0])
      const count = await client.query<{ count: string }>('SELECT count(*)::text AS count FROM boq_chapters WHERE tenant_id=$1 AND calculation_id=$2', [context.tenantId, calculationId])
      if (input.parentChapterId) {
        const parent = await client.query('SELECT id FROM boq_chapters WHERE tenant_id=$1 AND calculation_id=$2 AND id=$3', [context.tenantId, calculationId, input.parentChapterId])
        if (!parent.rowCount) throw new RepositoryError('Bovenliggend hoofdstuk behoort niet tot deze calculatie', 409)
      }
      const chapter: BoqChapter = { id: randomUUID(), code: input.code, name: input.name, sortOrder: Number(count.rows[0].count), parentChapterId: input.parentChapterId ?? undefined, responsibleUserId: input.responsibleUserId, workflowStatus: input.workflowStatus ?? 'Niet gestart' }
      await client.query('INSERT INTO boq_chapters (tenant_id,id,calculation_id,code,name,sort_order,parent_chapter_id,responsible_user_id,workflow_status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)', [context.tenantId, chapter.id, calculationId, chapter.code, chapter.name, chapter.sortOrder, chapter.parentChapterId ?? null, chapter.responsibleUserId ?? null, chapter.workflowStatus])
      await client.query('UPDATE calculations SET updated_at=now() WHERE tenant_id=$1 AND id=$2', [context.tenantId, calculationId])
      await this.audit(client, context, 'boq_chapter', chapter.id, 'created', null, chapter)
      return chapter
    })
  }

  async updateCalculationStructure(context: RequestContext, calculationId: string, input: { chapters: Array<{ id: string; sortOrder: number; code?: string; name?: string; parentChapterId?: string | null; responsibleUserId?: string | null; workflowStatus?: BoqChapter['workflowStatus'] }>; items: Array<{ id: string; chapterId?: string | null; sortOrder: number }> }): Promise<Calculation> {
    return this.transaction(async client => {
      if (!await this.getCalculation(client, context.tenantId, calculationId)) throw new RepositoryError('Calculatie niet gevonden', 404)
      const allowedChapters = new Set((await client.query<{ id: string }>('SELECT id FROM boq_chapters WHERE tenant_id=$1 AND calculation_id=$2', [context.tenantId, calculationId])).rows.map(row => row.id))
      for (const chapter of input.chapters) {
        if (!allowedChapters.has(chapter.id)) throw new RepositoryError('Hoofdstuk behoort niet tot deze calculatie', 409)
        if (chapter.parentChapterId === chapter.id || (chapter.parentChapterId && !allowedChapters.has(chapter.parentChapterId))) throw new RepositoryError('Ongeldig bovenliggend hoofdstuk', 409)
        await client.query('UPDATE boq_chapters SET sort_order=$4,parent_chapter_id=$5,responsible_user_id=$6,workflow_status=$7,code=COALESCE($8,code),name=COALESCE($9,name) WHERE tenant_id=$1 AND calculation_id=$2 AND id=$3', [context.tenantId, calculationId, chapter.id, chapter.sortOrder, chapter.parentChapterId ?? null, chapter.responsibleUserId ?? null, chapter.workflowStatus ?? 'Niet gestart', chapter.code ?? null, chapter.name ?? null])
      }
      for (const item of input.items) {
        if (item.chapterId && !allowedChapters.has(item.chapterId)) throw new RepositoryError('Doelhoofdstuk behoort niet tot deze calculatie', 409)
        await client.query('UPDATE boq_items SET chapter_id=$4,sort_order=$5 WHERE tenant_id=$1 AND calculation_id=$2 AND id=$3', [context.tenantId, calculationId, item.id, item.chapterId ?? null, item.sortOrder])
      }
      await client.query('UPDATE calculations SET updated_at=now() WHERE tenant_id=$1 AND id=$2', [context.tenantId, calculationId])
      await this.audit(client, context, 'calculation', calculationId, 'structure_updated', null, { chapters: input.chapters.length, items: input.items.length })
      return (await this.getCalculation(client, context.tenantId, calculationId))!
    })
  }

  async applyCalculationTemplate(context: RequestContext, calculationId: string, template: CalculationTemplate): Promise<Calculation> {
    return this.transaction(async client => {
      const calculation = await this.getCalculation(client, context.tenantId, calculationId)
      if (!calculation) throw new RepositoryError('Calculatie niet gevonden', 404)
      const chaptersByCode = new Map(calculation.chapters.map(chapter => [chapter.code, chapter]))
      for (const templateChapter of template.chapters) {
        if (chaptersByCode.has(templateChapter.code)) continue
        const chapter: BoqChapter = { id: randomUUID(), code: templateChapter.code, name: templateChapter.name, sortOrder: chaptersByCode.size }
        await client.query('INSERT INTO boq_chapters (tenant_id,id,calculation_id,code,name,sort_order) VALUES ($1,$2,$3,$4,$5,$6)', [context.tenantId, chapter.id, calculationId, chapter.code, chapter.name, chapter.sortOrder])
        chaptersByCode.set(chapter.code, chapter)
      }
      const existingCodes = new Set(calculation.items.map(item => item.code))
      let sortOrder = calculation.items.length
      for (const templateChapter of template.chapters) {
        for (const templateItem of templateChapter.items) {
          if (existingCodes.has(templateItem.code)) continue
          const item: BoqItem = { ...templateItem, id: randomUUID(), chapterId: chaptersByCode.get(templateChapter.code)!.id, sortOrder: sortOrder++, wastePct: 0, itemRiskPct: 0, markupPct: 0, notes: '', costApplications: {} }
          await client.query(`INSERT INTO boq_items (tenant_id,id,calculation_id,chapter_id,code,description,quantity,unit,labor,material,equipment,subcontracting,cost_applications,advanced,sort_order)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`, [context.tenantId, item.id, calculationId, item.chapterId, item.code, item.description, item.quantity, item.unit, item.labor, item.material, item.equipment, item.subcontracting, JSON.stringify({}), JSON.stringify({ quantityType: item.quantityType ?? 'Vermoedelijk', wastePct: 0, itemRiskPct: 0, markupPct: 0, notes: '' }), item.sortOrder])
          existingCodes.add(item.code)
        }
      }
      await client.query('UPDATE calculations SET updated_at=now() WHERE tenant_id=$1 AND id=$2', [context.tenantId, calculationId])
      await this.audit(client, context, 'calculation', calculationId, 'template_applied', null, { templateId: template.id, version: template.version })
      return (await this.getCalculation(client, context.tenantId, calculationId))!
    })
  }

  async createCostLibraryItem(context: RequestContext, input: Omit<CostLibraryItem, 'id' | 'updatedAt'>): Promise<CostLibraryItem> {
    return this.transaction(async client => {
      const libraryVersionId = input.libraryVersionId ?? DEFAULT_COST_LIBRARY_VERSION_ID
      const duplicate = await client.query('SELECT id FROM cost_library_items WHERE tenant_id=$1 AND library_version_id=$2 AND code=$3', [context.tenantId, libraryVersionId, input.code])
      if (duplicate.rowCount) throw new RepositoryError('Er bestaat al een kostprijs met deze code', 409)
      const item: CostLibraryItem = { ...input, libraryVersionId, id: randomUUID(), updatedAt: new Date().toISOString() }
      await client.query(`INSERT INTO cost_library_items (tenant_id,id,library_version_id,code,name,category,unit,unit_cost,source,updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [context.tenantId, item.id, item.libraryVersionId, item.code, item.name, item.category, item.unit, item.unitCost, item.source, item.updatedAt])
      await this.audit(client, context, 'cost_library_item', item.id, 'created', null, item)
      return item
    })
  }

  async createCostLibrary(context: RequestContext, input: Pick<CostLibrary, 'name' | 'description' | 'legalEntityId' | 'branchId'>): Promise<{ library: CostLibrary; version: CostLibraryVersion }> {
    return this.transaction(async client => {
      if (input.legalEntityId && context.allLegalEntities === false && !(context.legalEntityIds ?? []).includes(input.legalEntityId)) throw new RepositoryError('Geen toegang tot deze juridische entiteit', 403)
      if (input.legalEntityId) {
        const entity = await client.query('SELECT id FROM legal_entities WHERE tenant_id=$1 AND id=$2', [context.tenantId, input.legalEntityId])
        if (!entity.rowCount) throw new RepositoryError('Juridische entiteit niet gevonden', 404)
      }
      if (input.branchId) {
        const branch = await client.query('SELECT id FROM company_branches WHERE tenant_id=$1 AND id=$2 AND legal_entity_id=$3', [context.tenantId, input.branchId, input.legalEntityId])
        if (!branch.rowCount) throw new RepositoryError('Vestiging behoort niet tot de gekozen entiteit', 409)
      }
      const library: CostLibrary = { id: randomUUID(), ...input, active: true, createdAt: new Date().toISOString() }
      const version: CostLibraryVersion = { id: randomUUID(), libraryId: library.id, version: 1, label: 'Versie 1', status: 'Concept', effectiveFrom: new Date().toISOString().slice(0, 10), createdAt: library.createdAt }
      await client.query('INSERT INTO cost_libraries (tenant_id,id,name,description,active,legal_entity_id,branch_id,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [context.tenantId, library.id, library.name, library.description, library.active, library.legalEntityId ?? null, library.branchId ?? null, library.createdAt])
      await client.query('INSERT INTO cost_library_versions (tenant_id,id,library_id,version,label,status,effective_from,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [context.tenantId, version.id, version.libraryId, version.version, version.label, version.status, version.effectiveFrom, version.createdAt])
      await this.audit(client, context, 'cost_library', library.id, 'created', null, { library, version })
      return { library, version }
    })
  }

  async updateCostLibrary(context: RequestContext, id: string, patch: { active?: boolean; legalEntityId?: string | null; branchId?: string | null }): Promise<CostLibrary> {
    return this.transaction(async client => {
      const result = await client.query<CostLibraryRow>('SELECT * FROM cost_libraries WHERE tenant_id=$1 AND id=$2', [context.tenantId, id])
      if (!result.rowCount) throw new RepositoryError('Kostenbibliotheek niet gevonden', 404)
      const before = mapCostLibrary(result.rows[0])
      const library = { ...before, ...patch, legalEntityId: patch.legalEntityId ?? (patch.legalEntityId === undefined ? before.legalEntityId : undefined), branchId: patch.branchId ?? (patch.branchId === undefined ? before.branchId : undefined) }
      if (library.legalEntityId && context.allLegalEntities === false && !(context.legalEntityIds ?? []).includes(library.legalEntityId)) throw new RepositoryError('Geen toegang tot deze juridische entiteit', 403)
      if (library.branchId && !library.legalEntityId) throw new RepositoryError('Een vestigingsbibliotheek vereist een juridische entiteit', 409)
      if (library.branchId) {
        const branch = await client.query('SELECT id FROM company_branches WHERE tenant_id=$1 AND id=$2 AND legal_entity_id=$3', [context.tenantId, library.branchId, library.legalEntityId])
        if (!branch.rowCount) throw new RepositoryError('Vestiging behoort niet tot de gekozen entiteit', 409)
      }
      await client.query('UPDATE cost_libraries SET active=$3,legal_entity_id=$4,branch_id=$5 WHERE tenant_id=$1 AND id=$2', [context.tenantId, id, library.active, library.legalEntityId ?? null, library.branchId ?? null])
      await this.audit(client, context, 'cost_library', id, 'updated', before, library)
      return library
    })
  }

  async createUnit(context: RequestContext, input: Omit<UnitDefinition, 'id' | 'createdAt'>): Promise<UnitDefinition> {
    return this.transaction(async client => {
      const duplicate = await client.query('SELECT id FROM unit_definitions WHERE tenant_id=$1 AND lower(code)=lower($2)', [context.tenantId, input.code])
      if (duplicate.rowCount) throw new RepositoryError('Deze eenheidscode bestaat al', 409)
      const unit: UnitDefinition = { ...input, id: randomUUID(), createdAt: new Date().toISOString() }
      await client.query('INSERT INTO unit_definitions (tenant_id,id,code,name,category,active,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)', [context.tenantId, unit.id, unit.code, unit.name, unit.category, unit.active, unit.createdAt])
      await this.audit(client, context, 'unit_definition', unit.id, 'created', null, unit)
      return unit
    })
  }

  async updateUnit(context: RequestContext, id: string, patch: Partial<Pick<UnitDefinition, 'code' | 'name' | 'category' | 'active'>>): Promise<UnitDefinition> {
    return this.transaction(async client => {
      const result = await client.query<UnitDefinitionRow>('SELECT * FROM unit_definitions WHERE tenant_id=$1 AND id=$2', [context.tenantId, id])
      if (!result.rowCount) throw new RepositoryError('Eenheid niet gevonden', 404)
      const before = mapUnit(result.rows[0]); const unit = { ...before, ...patch }
      await client.query('UPDATE unit_definitions SET code=$3,name=$4,category=$5,active=$6 WHERE tenant_id=$1 AND id=$2', [context.tenantId, id, unit.code, unit.name, unit.category, unit.active])
      await this.audit(client, context, 'unit_definition', id, 'updated', before, unit)
      return unit
    })
  }

  async createUnitConversion(context: RequestContext, input: Omit<UnitConversion, 'id' | 'createdAt'>): Promise<UnitConversion> {
    return this.transaction(async client => {
      const units = await client.query('SELECT id FROM unit_definitions WHERE tenant_id=$1 AND id=ANY($2::uuid[])', [context.tenantId, [input.fromUnitId, input.toUnitId]])
      if (units.rowCount !== 2) throw new RepositoryError('Bron- of doeleenheid niet gevonden', 404)
      const duplicate = await client.query('SELECT id FROM unit_conversions WHERE tenant_id=$1 AND from_unit_id=$2 AND to_unit_id=$3', [context.tenantId, input.fromUnitId, input.toUnitId])
      if (duplicate.rowCount) throw new RepositoryError('Deze conversie bestaat al', 409)
      const conversion: UnitConversion = { ...input, id: randomUUID(), createdAt: new Date().toISOString() }
      await client.query('INSERT INTO unit_conversions (tenant_id,id,from_unit_id,to_unit_id,factor,created_at) VALUES ($1,$2,$3,$4,$5,$6)', [context.tenantId, conversion.id, conversion.fromUnitId, conversion.toUnitId, conversion.factor, conversion.createdAt])
      await this.audit(client, context, 'unit_conversion', conversion.id, 'created', null, conversion)
      return conversion
    })
  }

  async createCostLibraryVersion(context: RequestContext, libraryId: string, input: { label: string; effectiveFrom: string; cloneFromVersionId?: string }): Promise<{ version: CostLibraryVersion; items: CostLibraryItem[] }> {
    return this.transaction(async client => {
      const library = await client.query('SELECT id FROM cost_libraries WHERE tenant_id=$1 AND id=$2', [context.tenantId, libraryId])
      if (!library.rowCount) throw new RepositoryError('Kostenbibliotheek niet gevonden', 404)
      const count = await client.query<{ count: string }>('SELECT count(*)::text AS count FROM cost_library_versions WHERE tenant_id=$1 AND library_id=$2', [context.tenantId, libraryId])
      const version: CostLibraryVersion = { id: randomUUID(), libraryId, version: Number(count.rows[0].count) + 1, label: input.label, status: 'Concept', effectiveFrom: input.effectiveFrom, createdAt: new Date().toISOString() }
      await client.query('INSERT INTO cost_library_versions (tenant_id,id,library_id,version,label,status,effective_from,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [context.tenantId, version.id, version.libraryId, version.version, version.label, version.status, version.effectiveFrom, version.createdAt])
      const items: CostLibraryItem[] = []
      if (input.cloneFromVersionId) {
        const source = await client.query<CostLibraryItemRow>('SELECT * FROM cost_library_items WHERE tenant_id=$1 AND library_version_id=$2 ORDER BY category,code', [context.tenantId, input.cloneFromVersionId])
        for (const row of source.rows) {
          const original = mapCostLibraryItem(row)
          const item: CostLibraryItem = { ...original, id: randomUUID(), libraryVersionId: version.id, updatedAt: version.createdAt }
          await client.query('INSERT INTO cost_library_items (tenant_id,id,library_version_id,code,name,category,unit,unit_cost,source,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [context.tenantId, item.id, item.libraryVersionId, item.code, item.name, item.category, item.unit, item.unitCost, item.source, item.updatedAt])
          items.push(item)
        }
      }
      await this.audit(client, context, 'cost_library_version', version.id, 'created', null, { ...version, clonedItems: items.length })
      return { version, items }
    })
  }

  async publishCostLibraryVersion(context: RequestContext, versionId: string): Promise<CostLibraryVersion> {
    return this.transaction(async client => {
      const result = await client.query<CostLibraryVersionRow>('SELECT * FROM cost_library_versions WHERE tenant_id=$1 AND id=$2', [context.tenantId, versionId])
      if (!result.rowCount) throw new RepositoryError('Bibliotheekversie niet gevonden', 404)
      const before = mapCostLibraryVersion(result.rows[0])
      await client.query(`UPDATE cost_library_versions SET status='Gearchiveerd' WHERE tenant_id=$1 AND library_id=$2 AND status='Gepubliceerd'`, [context.tenantId, before.libraryId])
      await client.query(`UPDATE cost_library_versions SET status='Gepubliceerd' WHERE tenant_id=$1 AND id=$2`, [context.tenantId, versionId])
      const version = { ...before, status: 'Gepubliceerd' as const }
      await this.audit(client, context, 'cost_library_version', versionId, 'published', before, version)
      return version
    })
  }

  async publishPostCalculationFeedback(context: RequestContext, projectId: string, input: PostCalculationFeedbackInput): Promise<CostLibraryItem> {
    const state = await this.bootstrap(context)
    const project = state.projects.find(item => item.id === projectId)
    const analysis = postCalculationAnalysis(state, projectId)
    const insight = analysis?.itemInsights.find(item => item.boqItemId === input.boqItemId && item.category === input.category)
    if (!project || !analysis) throw new RepositoryError('Nacalculatie niet beschikbaar', 404)
    if (!insight || insight.actualUnitCost <= 0) throw new RepositoryError('Voor deze post is geen bruikbare werkelijke eenheidskost beschikbaar', 409)
    const normalized = `${project.number}-${insight.code}-${input.category}`.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '')
    const code = `HIST-${normalized}`.slice(0, 50)
    return this.transaction(async client => {
      const duplicate = await client.query('SELECT id FROM cost_library_items WHERE tenant_id=$1 AND library_version_id=$2 AND code=$3', [context.tenantId, DEFAULT_COST_LIBRARY_VERSION_ID, code])
      if (duplicate.rowCount) throw new RepositoryError('Deze nacalculatie is al naar de kostprijsbibliotheek gestuurd', 409)
      const item: CostLibraryItem = { id: randomUUID(), libraryVersionId: DEFAULT_COST_LIBRARY_VERSION_ID, code, name: `${insight.code} · ${insight.description}`, category: insight.category, unit: insight.unit, unitCost: insight.actualUnitCost, source: `Nacalculatie ${project.number} · gewogen toerekening op basis van de oorspronkelijke calculatie`, updatedAt: new Date().toISOString() }
      await client.query(`INSERT INTO cost_library_items (tenant_id,id,library_version_id,code,name,category,unit,unit_cost,source,updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [context.tenantId, item.id, item.libraryVersionId, item.code, item.name, item.category, item.unit, item.unitCost, item.source, item.updatedAt])
      await this.audit(client, context, 'cost_library_item', item.id, 'created_from_post_calculation', null, item, `${project.number} · ${insight.code}`)
      return item
    })
  }

  async updateCostLibraryItem(context: RequestContext, id: string, patch: Partial<Omit<CostLibraryItem, 'id' | 'updatedAt'>>): Promise<CostLibraryItem> {
    return this.transaction(async client => {
      const result = await client.query<CostLibraryItemRow>('SELECT * FROM cost_library_items WHERE tenant_id=$1 AND id=$2', [context.tenantId, id])
      if (!result.rowCount) throw new RepositoryError('Kostprijs niet gevonden', 404)
      const before = mapCostLibraryItem(result.rows[0])
      const next = { ...before, ...patch, updatedAt: new Date().toISOString() }
      if (patch.code && patch.code !== before.code) {
        const duplicate = await client.query('SELECT id FROM cost_library_items WHERE tenant_id=$1 AND library_version_id=$2 AND code=$3 AND id<>$4', [context.tenantId, next.libraryVersionId ?? DEFAULT_COST_LIBRARY_VERSION_ID, patch.code, id])
        if (duplicate.rowCount) throw new RepositoryError('Er bestaat al een kostprijs met deze code', 409)
      }
      await client.query(`UPDATE cost_library_items SET library_version_id=$3,code=$4,name=$5,category=$6,unit=$7,unit_cost=$8,source=$9,updated_at=$10
        WHERE tenant_id=$1 AND id=$2`, [context.tenantId, id, next.libraryVersionId ?? DEFAULT_COST_LIBRARY_VERSION_ID, next.code, next.name, next.category, next.unit, next.unitCost, next.source, next.updatedAt])
      await this.audit(client, context, 'cost_library_item', id, 'updated', before, next)
      return next
    })
  }

  async applyCostLibraryItem(context: RequestContext, calculationId: string, itemId: string, libraryItemId: string, factor: number): Promise<BoqItem> {
    return this.transaction(async client => {
      const [itemResult, libraryResult] = await Promise.all([
        client.query<BoqItemRow>('SELECT * FROM boq_items WHERE tenant_id=$1 AND calculation_id=$2 AND id=$3', [context.tenantId, calculationId, itemId]),
        client.query<CostLibraryItemRow>('SELECT * FROM cost_library_items WHERE tenant_id=$1 AND id=$2', [context.tenantId, libraryItemId]),
      ])
      if (!itemResult.rowCount) throw new RepositoryError('Meetstaatpost niet gevonden', 404)
      if (!libraryResult.rowCount) throw new RepositoryError('Kostprijs niet gevonden', 404)
      const libraryScope = await client.query<{ legal_entity_id: string | null }>(`SELECT libraries.legal_entity_id FROM cost_library_items items JOIN cost_library_versions versions ON versions.tenant_id=items.tenant_id AND versions.id=items.library_version_id JOIN cost_libraries libraries ON libraries.tenant_id=versions.tenant_id AND libraries.id=versions.library_id WHERE items.tenant_id=$1 AND items.id=$2`, [context.tenantId, libraryItemId])
      const scopedEntityId = libraryScope.rows[0]?.legal_entity_id
      if (scopedEntityId && context.allLegalEntities === false && !(context.legalEntityIds ?? []).includes(scopedEntityId)) throw new RepositoryError('Geen toegang tot deze entiteitsbibliotheek', 403)
      const before = mapItem(itemResult.rows[0])
      const libraryItem = mapCostLibraryItem(libraryResult.rows[0])
      const appliedUnitCost = Number((libraryItem.unitCost * factor).toFixed(4))
      const next: BoqItem = {
        ...before,
        [libraryItem.category]: appliedUnitCost,
        costApplications: { ...before.costApplications, [libraryItem.category]: { libraryItemId, factor, appliedUnitCost } },
      }
      await client.query(`UPDATE boq_items SET labor=$4,material=$5,equipment=$6,subcontracting=$7,cost_applications=$8
        WHERE tenant_id=$1 AND calculation_id=$2 AND id=$3`, [context.tenantId, calculationId, itemId, next.labor, next.material, next.equipment, next.subcontracting, JSON.stringify(next.costApplications)])
      await client.query('UPDATE calculations SET updated_at=now() WHERE tenant_id=$1 AND id=$2', [context.tenantId, calculationId])
      await this.audit(client, context, 'boq_item', itemId, 'cost_applied', before, next, `${libraryItem.code} × ${factor} ${libraryItem.unit}`)
      return next
    })
  }

  async bulkUpdateBoqItemsFromLibrary(context: RequestContext, calculationId: string, itemIds: string[], libraryId: string): Promise<BulkCostUpdateResult> {
    const state = await this.bootstrap(context)
    const library = state.costLibraries.find(item => item.id === libraryId && item.active)
    const version = state.costLibraryVersions.filter(item => item.libraryId === libraryId && item.status === 'Gepubliceerd').sort((a, b) => b.version - a.version)[0]
    if (!library || !version) throw new RepositoryError('Actieve gepubliceerde kostenbibliotheek niet gevonden', 409)
    if (library.legalEntityId && context.allLegalEntities === false && !(context.legalEntityIds ?? []).includes(library.legalEntityId)) throw new RepositoryError('Geen toegang tot deze entiteitsbibliotheek', 403)
    const sources = state.costLibrary.filter(item => item.libraryVersionId === version.id)
    return this.transaction(async client => {
      const calculation = await this.getCalculation(client, context.tenantId, calculationId)
      if (!calculation) throw new RepositoryError('Calculatie niet gevonden', 404)
      const selected = new Set(itemIds); let updatedItems = 0; let updatedApplications = 0
      for (const item of calculation.items.filter(candidate => selected.has(candidate.id))) {
        const next = { ...structuredClone(item), costApplications: { ...(item.costApplications ?? {}) } }; let itemUpdates = 0
        for (const category of ['labor', 'material', 'equipment', 'subcontracting'] as const) {
          const application = item.costApplications?.[category]
          const oldSource = application ? state.costLibrary.find(source => source.id === application.libraryItemId) : undefined
          const source = oldSource ? sources.find(candidate => candidate.category === category && candidate.code === oldSource.code) : sources.find(candidate => candidate.category === category && candidate.code === item.code)
          if (!source) continue
          const factor = oldSource && application ? application.factor * (unitConversionFactor(oldSource.unit, source.unit, state.units, state.unitConversions) ?? (oldSource.unit === source.unit ? 1 : 0)) : unitConversionFactor(item.unit, source.unit, state.units, state.unitConversions) ?? (item.unit === source.unit ? 1 : 0)
          if (!(factor > 0)) continue
          const appliedUnitCost = Number((source.unitCost * factor).toFixed(4)); next[category] = appliedUnitCost
          next.costApplications[category] = { libraryItemId: source.id, factor, appliedUnitCost }; itemUpdates++
        }
        if (!itemUpdates) continue
        await client.query('UPDATE boq_items SET labor=$4,material=$5,equipment=$6,subcontracting=$7,cost_applications=$8 WHERE tenant_id=$1 AND calculation_id=$2 AND id=$3', [context.tenantId, calculationId, item.id, next.labor, next.material, next.equipment, next.subcontracting, JSON.stringify(next.costApplications)])
        updatedItems++; updatedApplications += itemUpdates
      }
      await client.query('UPDATE calculations SET updated_at=now() WHERE tenant_id=$1 AND id=$2', [context.tenantId, calculationId])
      const updated = (await this.getCalculation(client, context.tenantId, calculationId))!
      const result = { calculation: updated, updatedItems, updatedApplications, skippedItems: itemIds.length - updatedItems }
      await this.audit(client, context, 'calculation', calculationId, 'bulk_cost_update', calculation, updated, `${library.name}: ${updatedItems} posten`)
      return result
    })
  }

  async bulkApplyBoqPriceAdjustment(context: RequestContext, calculationId: string, itemIds: string[], adjustment: BoqPriceAdjustment): Promise<BulkPriceAdjustmentResult> {
    return this.transaction(async client => {
      const calculation = await this.getCalculation(client, context.tenantId, calculationId)
      if (!calculation) throw new RepositoryError('Calculatie niet gevonden', 404)
      const selected = new Set(itemIds)
      let affectedItems = 0
      let skippedItems = 0
      for (const item of calculation.items.filter(candidate => selected.has(candidate.id))) {
        if (item.postType === 'Tekstregel' || item.postType === 'Subtotaal' || (item.priceAdjustments?.length ?? 0) >= 50) {
          skippedItems += 1
          continue
        }
        const next = { ...item, priceAdjustments: [...(item.priceAdjustments ?? []), adjustment] }
        await client.query('UPDATE boq_items SET advanced=$4 WHERE tenant_id=$1 AND calculation_id=$2 AND id=$3', [context.tenantId, calculationId, item.id, JSON.stringify(itemAdvanced(next))])
        await this.audit(client, context, 'boq_item', item.id, 'price_adjustment_applied', item, next, `${adjustment.label}: ${adjustment.type === 'Markdown' ? '-' : '+'}${adjustment.percentage}%`)
        affectedItems += 1
      }
      skippedItems += Math.max(0, itemIds.length - affectedItems - skippedItems)
      await client.query('UPDATE calculations SET updated_at=now() WHERE tenant_id=$1 AND id=$2', [context.tenantId, calculationId])
      const updated = (await this.getCalculation(client, context.tenantId, calculationId))!
      await this.audit(client, context, 'calculation', calculationId, 'bulk_price_adjustment', calculation, updated, `${adjustment.label}: ${affectedItems} posten`)
      return { calculation: updated, affectedItems, skippedItems }
    })
  }

  async createCalculationScenario(context: RequestContext, calculationId: string, input: CalculationScenarioInput): Promise<CalculationScenario> {
    return this.transaction(async client => {
      if (!await this.getCalculation(client, context.tenantId, calculationId)) throw new RepositoryError('Calculatie niet gevonden', 404)
      const duplicate = await client.query('SELECT id FROM calculation_scenarios WHERE tenant_id=$1 AND calculation_id=$2 AND name=$3', [context.tenantId, calculationId, input.name])
      if (duplicate.rowCount) throw new RepositoryError('Er bestaat al een scenario met deze naam', 409)
      const selected = await client.query('SELECT id FROM calculation_scenarios WHERE tenant_id=$1 AND calculation_id=$2 AND is_selected=true', [context.tenantId, calculationId])
      const scenario: CalculationScenario = { ...input, id: randomUUID(), calculationId, isSelected: !selected.rowCount, updatedAt: new Date().toISOString() }
      await client.query(`INSERT INTO calculation_scenarios
        (tenant_id,id,calculation_id,name,description,labor_adjustment_pct,material_adjustment_pct,equipment_adjustment_pct,subcontracting_adjustment_pct,overhead_pct,risk_pct,margin_pct,is_selected,updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`, [context.tenantId, scenario.id, calculationId, scenario.name, scenario.description, scenario.laborAdjustmentPct, scenario.materialAdjustmentPct, scenario.equipmentAdjustmentPct, scenario.subcontractingAdjustmentPct, scenario.overheadPct, scenario.riskPct, scenario.marginPct, scenario.isSelected, scenario.updatedAt])
      await this.audit(client, context, 'calculation_scenario', scenario.id, 'created', null, scenario)
      return scenario
    })
  }

  async createPresetScenarios(context: RequestContext, calculationId: string): Promise<CalculationScenario[]> {
    return this.transaction(async client => {
      const calculation = await this.getCalculation(client, context.tenantId, calculationId)
      if (!calculation) throw new RepositoryError('Calculatie niet gevonden', 404)
      const existing = await client.query<CalculationScenarioRow>('SELECT * FROM calculation_scenarios WHERE tenant_id=$1 AND calculation_id=$2 ORDER BY name', [context.tenantId, calculationId])
      if (existing.rowCount) return existing.rows.map(mapCalculationScenario)
      const presets: Array<CalculationScenarioInput & { isSelected: boolean }> = [
        { name: 'Verwacht', description: 'Meest waarschijnlijke uitvoering op basis van de huidige calculatie.', laborAdjustmentPct: 0, materialAdjustmentPct: 0, equipmentAdjustmentPct: 0, subcontractingAdjustmentPct: 0, overheadPct: calculation.overheadPct, riskPct: calculation.riskPct, marginPct: calculation.marginPct, isSelected: true },
        { name: 'Conservatief', description: 'Extra buffer voor productiviteit, marktprijzen en uitvoeringsrisico.', laborAdjustmentPct: 8, materialAdjustmentPct: 6, equipmentAdjustmentPct: 10, subcontractingAdjustmentPct: 5, overheadPct: calculation.overheadPct, riskPct: Math.max(calculation.riskPct, 7), marginPct: calculation.marginPct, isSelected: false },
        { name: 'Optimistisch', description: 'Gunstige productiviteit, inkoop en materieelinzet.', laborAdjustmentPct: -5, materialAdjustmentPct: -3, equipmentAdjustmentPct: -5, subcontractingAdjustmentPct: 0, overheadPct: Math.max(0, calculation.overheadPct - 1), riskPct: Math.max(0, calculation.riskPct - 2), marginPct: calculation.marginPct, isSelected: false },
      ]
      const scenarios: CalculationScenario[] = []
      for (const preset of presets) {
        const scenario: CalculationScenario = { ...preset, id: randomUUID(), calculationId, updatedAt: new Date().toISOString() }
        await client.query(`INSERT INTO calculation_scenarios
          (tenant_id,id,calculation_id,name,description,labor_adjustment_pct,material_adjustment_pct,equipment_adjustment_pct,subcontracting_adjustment_pct,overhead_pct,risk_pct,margin_pct,is_selected,updated_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`, [context.tenantId, scenario.id, calculationId, scenario.name, scenario.description, scenario.laborAdjustmentPct, scenario.materialAdjustmentPct, scenario.equipmentAdjustmentPct, scenario.subcontractingAdjustmentPct, scenario.overheadPct, scenario.riskPct, scenario.marginPct, scenario.isSelected, scenario.updatedAt])
        scenarios.push(scenario)
      }
      await this.audit(client, context, 'calculation', calculationId, 'scenario_presets_created', null, scenarios.map(scenario => ({ id: scenario.id, name: scenario.name })))
      return scenarios
    })
  }

  async updateCalculationScenario(context: RequestContext, calculationId: string, scenarioId: string, patch: Partial<CalculationScenarioInput>): Promise<CalculationScenario> {
    return this.transaction(async client => {
      const result = await client.query<CalculationScenarioRow>('SELECT * FROM calculation_scenarios WHERE tenant_id=$1 AND calculation_id=$2 AND id=$3', [context.tenantId, calculationId, scenarioId])
      if (!result.rowCount) throw new RepositoryError('Scenario niet gevonden', 404)
      const before = mapCalculationScenario(result.rows[0])
      const next = { ...before, ...patch, updatedAt: new Date().toISOString() }
      if (patch.name && patch.name !== before.name) {
        const duplicate = await client.query('SELECT id FROM calculation_scenarios WHERE tenant_id=$1 AND calculation_id=$2 AND name=$3 AND id<>$4', [context.tenantId, calculationId, patch.name, scenarioId])
        if (duplicate.rowCount) throw new RepositoryError('Er bestaat al een scenario met deze naam', 409)
      }
      await client.query(`UPDATE calculation_scenarios SET name=$4,description=$5,labor_adjustment_pct=$6,material_adjustment_pct=$7,equipment_adjustment_pct=$8,subcontracting_adjustment_pct=$9,overhead_pct=$10,risk_pct=$11,margin_pct=$12,updated_at=$13
        WHERE tenant_id=$1 AND calculation_id=$2 AND id=$3`, [context.tenantId, calculationId, scenarioId, next.name, next.description, next.laborAdjustmentPct, next.materialAdjustmentPct, next.equipmentAdjustmentPct, next.subcontractingAdjustmentPct, next.overheadPct, next.riskPct, next.marginPct, next.updatedAt])
      await this.audit(client, context, 'calculation_scenario', scenarioId, 'updated', before, next)
      return next
    })
  }

  async selectCalculationScenario(context: RequestContext, calculationId: string, scenarioId: string): Promise<CalculationScenario> {
    return this.transaction(async client => {
      const result = await client.query<CalculationScenarioRow>('SELECT * FROM calculation_scenarios WHERE tenant_id=$1 AND calculation_id=$2 AND id=$3', [context.tenantId, calculationId, scenarioId])
      if (!result.rowCount) throw new RepositoryError('Scenario niet gevonden', 404)
      await client.query('UPDATE calculation_scenarios SET is_selected=false WHERE tenant_id=$1 AND calculation_id=$2', [context.tenantId, calculationId])
      await client.query('UPDATE calculation_scenarios SET is_selected=true,updated_at=now() WHERE tenant_id=$1 AND calculation_id=$2 AND id=$3', [context.tenantId, calculationId, scenarioId])
      const selected = { ...mapCalculationScenario(result.rows[0]), isSelected: true, updatedAt: new Date().toISOString() }
      await this.audit(client, context, 'calculation_scenario', scenarioId, 'selected', null, { calculationId, name: selected.name })
      return selected
    })
  }

  async createCalculationVersion(context: RequestContext, calculationId: string, input: { label: string; reason: string }): Promise<CalculationVersion> {
    return this.transaction(async client => {
      const calculation = await this.getCalculation(client, context.tenantId, calculationId)
      if (!calculation) throw new RepositoryError('Calculatie niet gevonden', 404)
      const count = await client.query<{ count: string }>('SELECT count(*)::text AS count FROM calculation_versions WHERE tenant_id=$1 AND calculation_id=$2', [context.tenantId, calculationId])
      const version: CalculationVersion = { id: randomUUID(), calculationId, version: Number(count.rows[0].count) + 1, label: input.label, reason: input.reason, snapshot: calculation, createdAt: new Date().toISOString(), createdBy: context.userId }
      await client.query(`INSERT INTO calculation_versions (tenant_id,id,calculation_id,version,label,reason,snapshot,created_by,created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [context.tenantId, version.id, calculationId, version.version, version.label, version.reason, JSON.stringify(version.snapshot), context.userId, version.createdAt])
      await this.audit(client, context, 'calculation_version', version.id, 'created', null, { calculationId, version: version.version, label: version.label }, version.reason)
      return version
    })
  }

  async importBoq(context: RequestContext, calculationId: string, preview: BoqImportPreview): Promise<Calculation> {
    if (preview.errors.length) throw new RepositoryError('Los eerst alle importfouten op', 409)
    if (!preview.rows.length) throw new RepositoryError('Het importbestand bevat geen geldige meetstaatposten', 409)
    return this.transaction(async client => {
      if (!await this.getCalculation(client, context.tenantId, calculationId)) throw new RepositoryError('Calculatie niet gevonden', 404)
      const existingChapters = await client.query<BoqChapterRow>('SELECT * FROM boq_chapters WHERE tenant_id=$1 AND calculation_id=$2 ORDER BY sort_order', [context.tenantId, calculationId])
      const chaptersByCode = new Map(existingChapters.rows.map(row => [row.code, mapChapter(row)]))
      for (const row of preview.rows) {
        if (chaptersByCode.has(row.chapterCode)) continue
        const chapter: BoqChapter = { id: randomUUID(), code: row.chapterCode, name: row.chapterName, sortOrder: chaptersByCode.size }
        await client.query('INSERT INTO boq_chapters (tenant_id,id,calculation_id,code,name,sort_order) VALUES ($1,$2,$3,$4,$5,$6)', [context.tenantId, chapter.id, calculationId, chapter.code, chapter.name, chapter.sortOrder])
        chaptersByCode.set(chapter.code, chapter)
      }
      const currentItems = await client.query<{ count: string }>('SELECT count(*)::text AS count FROM boq_items WHERE tenant_id=$1 AND calculation_id=$2', [context.tenantId, calculationId])
      const importedItems = preview.rows.map((row, index): BoqItem & { sortOrder: number } => ({ id: randomUUID(), chapterId: chaptersByCode.get(row.chapterCode)!.id, code: row.code, description: row.description, quantity: row.quantity, unit: row.unit, labor: row.labor, material: row.material, equipment: row.equipment, subcontracting: row.subcontracting, sortOrder: Number(currentItems.rows[0].count) + index }))
      for (let offset = 0; offset < importedItems.length; offset += 300) {
        const batch = importedItems.slice(offset, offset + 300)
        const values: unknown[] = []
        const placeholders = batch.map((item, rowIndex) => {
          const start = rowIndex * 13
          values.push(context.tenantId, item.id, calculationId, item.chapterId, item.code, item.description, item.quantity, item.unit, item.labor, item.material, item.equipment, item.subcontracting, item.sortOrder)
          return `(${Array.from({ length: 13 }, (_, columnIndex) => `$${start + columnIndex + 1}`).join(',')})`
        })
        await client.query(`INSERT INTO boq_items (tenant_id,id,calculation_id,chapter_id,code,description,quantity,unit,labor,material,equipment,subcontracting,sort_order) VALUES ${placeholders.join(',')}`, values)
      }
      await client.query('UPDATE calculations SET updated_at=now() WHERE tenant_id=$1 AND id=$2', [context.tenantId, calculationId])
      await this.audit(client, context, 'calculation', calculationId, 'boq_imported', null, { fileName: preview.fileName, sheetName: preview.sheetName, rowCount: preview.rows.length, chapterCount: preview.chapterCount })
      return (await this.getCalculation(client, context.tenantId, calculationId))!
    })
  }

  async createQuote(context: RequestContext, calculationId: string, input: QuoteContent): Promise<Quote> {
    return this.transaction(async client => {
      const calculation = await this.getCalculation(client, context.tenantId, calculationId)
      if (!calculation) throw new RepositoryError('Calculatie niet gevonden', 404)
      if (!calculation.items.length) throw new RepositoryError('Een offerte vereist minstens één meetstaatpost', 409)
      const versions = await client.query<{ count: string }>('SELECT count(*)::text AS count FROM quotes WHERE tenant_id=$1 AND calculation_id=$2', [context.tenantId, calculationId])
      const totalQuotes = await client.query<{ count: string }>('SELECT count(*)::text AS count FROM quotes WHERE tenant_id=$1', [context.tenantId])
      const selectedResult = await client.query<CalculationScenarioRow>('SELECT * FROM calculation_scenarios WHERE tenant_id=$1 AND calculation_id=$2 AND is_selected=true LIMIT 1', [context.tenantId, calculationId])
      const selectedScenario = selectedResult.rowCount ? mapCalculationScenario(selectedResult.rows[0]) : undefined
      const calculatedTotal = selectedScenario ? scenarioSellingTotal(calculation, selectedScenario) : sellingTotal(calculation)
      const [opportunityResult, tenantResult] = await Promise.all([
        client.query<OpportunityRow>('SELECT * FROM opportunities WHERE tenant_id=$1 AND id=$2', [context.tenantId, calculation.opportunityId]),
        client.query<{ name: string }>('SELECT name FROM tenants WHERE id=$1', [context.tenantId]),
      ])
      const opportunity = opportunityResult.rows[0]
      const organizationResult = await client.query<OrganizationRow>('SELECT * FROM organizations WHERE tenant_id=$1 AND id=$2', [context.tenantId, opportunity.organization_id])
      const organization = organizationResult.rows[0]
      const overheadPct = selectedScenario?.overheadPct ?? calculation.overheadPct
      const riskPct = selectedScenario?.riskPct ?? calculation.riskPct
      const marginPct = selectedScenario?.marginPct ?? calculation.marginPct
      const commercialFactor = (1 + (overheadPct + riskPct) / 100) / (1 - marginPct / 100)
      const chapterCodes = new Map(calculation.chapters.map(chapter => [chapter.id, chapter.code]))
      const lines = calculation.items.map(item => {
        const effective=effectiveBoqValues(item).values
        const directUnitCost = selectedScenario
          ? effective.labor * (1 + selectedScenario.laborAdjustmentPct / 100) + effective.material * (1 + selectedScenario.materialAdjustmentPct / 100) + effective.equipment * (1 + selectedScenario.equipmentAdjustmentPct / 100) + effective.subcontracting * (1 + selectedScenario.subcontractingAdjustmentPct / 100)
          : unitCost(item)
        const unitPrice = Number((directUnitCost * commercialFactor).toFixed(4))
        const quantity=boqItemQuantity(item)
        return { chapterCode: item.chapterId ? chapterCodes.get(item.chapterId) : undefined, code: item.code, description: item.description, quantity, unit: item.unit, unitPrice, total: Number((quantity * unitPrice).toFixed(2)) }
      })
      const total = Number(calculatedTotal.toFixed(2))
      const createdAt = new Date().toISOString()
      const content: QuoteContent = { ...input, subject: input.subject || `Offerte voor ${opportunity.title}`, validUntil: addDays(createdAt.slice(0, 10), input.validityDays) }
      const snapshot: QuoteSnapshot = { supplierName: tenantResult.rows[0]?.name ?? 'BouwFlow', clientName: organization.name, clientContact: organization.contact_name, projectTitle: opportunity.title, projectNumber: opportunity.project_number, location: opportunity.location, scenarioName: selectedScenario?.name, lines, directCost: Number((selectedScenario ? scenarioDirectCost(calculation, selectedScenario) : directCost(calculation)).toFixed(2)), overheadPct, riskPct, marginPct, total }
      const quoteBase: Quote = { id: randomUUID(), number: `OFF-${new Date().getFullYear()}-${String(Number(totalQuotes.rows[0].count) + 1).padStart(3, '0')}`, calculationId, scenarioId: selectedScenario?.id, version: Number(versions.rows[0].count) + 1, total, content, snapshot, createdAt }
      const quote: Quote = { ...quoteBase, workflow: defaultQuoteWorkflow(quoteBase) }
      await client.query(`INSERT INTO quotes (tenant_id,id,number,calculation_id,scenario_id,version,total,content,snapshot,workflow,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, [context.tenantId, quote.id, quote.number, calculationId, quote.scenarioId ?? null, quote.version, quote.total, JSON.stringify(quote.content), JSON.stringify(quote.snapshot), JSON.stringify(quote.workflow), quote.createdAt])
      await client.query(`UPDATE calculations SET status='Offerte',updated_at=now() WHERE tenant_id=$1 AND id=$2`, [context.tenantId, calculationId])
      await this.audit(client, context, 'quote', quote.id, 'created', null, quote)
      return quote
    })
  }

  private async transitionQuote(context: RequestContext, quoteId: string, transition: (current: Quote, now: string) => Quote) {
    return this.transaction(async client => {
      const result = await client.query<QuoteRow>('SELECT * FROM quotes WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [context.tenantId, quoteId])
      if (!result.rowCount) throw new RepositoryError('Offerte niet gevonden', 404)
      const current = mapQuote(result.rows[0])
      const updated = transition(current, new Date().toISOString())
      await client.query('UPDATE quotes SET workflow=$3 WHERE tenant_id=$1 AND id=$2', [context.tenantId, quoteId, JSON.stringify(updated.workflow)])
      await this.audit(client, context, 'quote', quoteId, `workflow_${updated.workflow?.status.toLowerCase().replace(/\s+/g,'_')}`, current, updated)
      return updated
    })
  }

  async approveQuote(context: RequestContext, quoteId: string, approvedBy: string) {
    return this.transitionQuote(context, quoteId, (current, now) => {
      if (current.workflow?.status !== 'Concept') throw new RepositoryError('Alleen een conceptofferte kan intern worden goedgekeurd', 409)
      return { ...current, workflow: { ...current.workflow, status:'Intern goedgekeurd', approvedBy, approvedAt:now, events:[...current.workflow.events,{id:randomUUID(),type:'Goedgekeurd',at:now,actor:approvedBy}] } }
    })
  }

  async sendQuote(context: RequestContext, quoteId: string, sentTo: string, sentBy: string, mailProviderReference?: string) {
    const quote = await this.transitionQuote(context, quoteId, (current, now) => {
      if (current.workflow?.status !== 'Intern goedgekeurd') throw new RepositoryError('De offerte moet intern goedgekeurd zijn voor verzending', 409)
      return { ...current, workflow: { ...current.workflow, status:'Verzonden', sentTo, sentAt:now, mailProviderReference, reminderAt:addDays(now.slice(0,10),7), events:[...current.workflow.events,{id:randomUUID(),type:'Verzonden',at:now,actor:sentBy,detail:[sentTo,mailProviderReference].filter(Boolean).join(' · ')}] } }
    })
    await this.pool.query(`UPDATE opportunities SET stage='Offerte verstuurd',updated_at=now() WHERE tenant_id=$1 AND id=(SELECT opportunity_id FROM calculations WHERE tenant_id=$1 AND id=$2)`, [context.tenantId, quote.calculationId])
    return quote
  }

  async remindQuote(context: RequestContext, quoteId: string, sentBy: string, mailProviderReference?: string) {
    return this.transitionQuote(context, quoteId, (current, now) => {
      if (!['Verzonden', 'Geopend'].includes(current.workflow?.status ?? '') || !current.workflow?.sentTo) throw new RepositoryError('Alleen een verzonden, nog niet ondertekende offerte kan worden herinnerd', 409)
      return { ...current, workflow: { ...current.workflow, reminderAt:addDays(now.slice(0,10),7), mailProviderReference:mailProviderReference ?? current.workflow.mailProviderReference, events:[...current.workflow.events,{id:randomUUID(),type:'Herinnerd',at:now,actor:sentBy,detail:[current.workflow.sentTo,mailProviderReference].filter(Boolean).join(' · ')}] } }
    })
  }

  async markQuoteOpened(context: RequestContext, quoteId: string) {
    const result = await this.pool.query<OrganizationRow>(`SELECT o.* FROM quotes q JOIN calculations c ON c.tenant_id=q.tenant_id AND c.id=q.calculation_id JOIN opportunities x ON x.tenant_id=c.tenant_id AND x.id=c.opportunity_id JOIN organizations o ON o.tenant_id=x.tenant_id AND o.id=x.organization_id WHERE q.tenant_id=$1 AND q.id=$2`, [context.tenantId, quoteId])
    if (!result.rowCount) throw new RepositoryError('Offerte of klantrelatie niet gevonden', 404)
    if (context.roles.includes('Klant')) {
      const organization = mapOrganization(result.rows[0])
      const emails = [organization.email, ...(organization.contacts ?? []).map(contact=>contact.email)].map(normalizedEmail)
      if (!emails.includes(normalizedEmail(context.email))) throw new RepositoryError('Deze klantaccount is niet aan de offerte gekoppeld', 403)
    }
    return this.transitionQuote(context, quoteId, (current, now) => {
      if (current.workflow?.status === 'Geopend') return current
      if (current.workflow?.status !== 'Verzonden') throw new RepositoryError('Alleen een verzonden offerte kan als geopend worden geregistreerd', 409)
      return { ...current, workflow: { ...current.workflow, status:'Geopend', openedAt:now, events:[...current.workflow.events,{id:randomUUID(),type:'Geopend',at:now,actor:context.displayName}] } }
    })
  }

  async signQuote(context: RequestContext, quoteId: string, signedBy: string) {
    if (context.roles.includes('Klant')) {
      const result = await this.pool.query<OrganizationRow>(`SELECT o.* FROM quotes q JOIN calculations c ON c.tenant_id=q.tenant_id AND c.id=q.calculation_id JOIN opportunities x ON x.tenant_id=c.tenant_id AND x.id=c.opportunity_id JOIN organizations o ON o.tenant_id=x.tenant_id AND o.id=x.organization_id WHERE q.tenant_id=$1 AND q.id=$2`, [context.tenantId, quoteId])
      if (!result.rowCount) throw new RepositoryError('Offerte of klantrelatie niet gevonden', 404)
      const organization = mapOrganization(result.rows[0])
      const emails = [organization.email, ...(organization.contacts ?? []).map(contact=>contact.email)].map(normalizedEmail)
      if (!emails.includes(normalizedEmail(context.email))) throw new RepositoryError('Deze klantaccount is niet aan de offerte gekoppeld', 403)
      signedBy = context.displayName
    }
    return this.transitionQuote(context, quoteId, (current, now) => {
      if (!['Verzonden','Geopend'].includes(current.workflow?.status ?? '')) throw new RepositoryError('Alleen een verzonden offerte kan digitaal worden ondertekend', 409)
      return { ...current, workflow: { ...current.workflow!, status:'Ondertekend', signedBy, signedAt:now, events:[...current.workflow!.events,{id:randomUUID(),type:'Ondertekend',at:now,actor:signedBy}] } }
    })
  }

  async loseQuote(context: RequestContext, quoteId: string, reason: string, recordedBy: string) {
    const quote = await this.transitionQuote(context, quoteId, (current, now) => {
      if (['Ondertekend','Verloren'].includes(current.workflow?.status ?? '')) throw new RepositoryError('Deze offerte kan niet als verloren worden geregistreerd', 409)
      return { ...current, workflow: { ...current.workflow!, status:'Verloren', lossReason:reason, events:[...current.workflow!.events,{id:randomUUID(),type:'Verloren',at:now,actor:recordedBy,detail:reason}] } }
    })
    await this.pool.query(`UPDATE opportunities SET stage='Verloren',probability=0,updated_at=now() WHERE tenant_id=$1 AND id=(SELECT opportunity_id FROM calculations WHERE tenant_id=$1 AND id=$2)`, [context.tenantId, quote.calculationId])
    return quote
  }

  async award(context: RequestContext, calculationId: string): Promise<Project> {
    return this.transaction(async client => {
      const existing = await client.query<ProjectRow>('SELECT * FROM projects WHERE tenant_id=$1 AND source_calculation_id=$2', [context.tenantId, calculationId])
      if (existing.rowCount) return this.mapProject(existing.rows[0])
      const calculation = await this.getCalculation(client, context.tenantId, calculationId)
      if (!calculation) throw new RepositoryError('Calculatie niet gevonden', 404)
      const quote = await client.query<QuoteRow>('SELECT * FROM quotes WHERE tenant_id=$1 AND calculation_id=$2 ORDER BY version DESC LIMIT 1', [context.tenantId, calculationId])
      if (!quote.rowCount) throw new RepositoryError('Gunning vereist een offerteversie', 409)
      const opportunity = await client.query<OpportunityRow>('SELECT * FROM opportunities WHERE tenant_id=$1 AND id=$2', [context.tenantId, calculation.opportunityId])
      const count = await client.query<{ count: string }>('SELECT count(*)::text AS count FROM projects WHERE tenant_id=$1', [context.tenantId])
      const scenarioResult = quote.rows[0].scenario_id ? await client.query<CalculationScenarioRow>('SELECT * FROM calculation_scenarios WHERE tenant_id=$1 AND id=$2', [context.tenantId, quote.rows[0].scenario_id]) : undefined
      const scenario = scenarioResult?.rowCount ? mapCalculationScenario(scenarioResult.rows[0]) : undefined
      const contractValue = Number(quote.rows[0].total)
      const marginPct = scenario?.marginPct ?? calculation.marginPct
      const costBudget = Number((contractValue * (1 - marginPct / 100)).toFixed(2))
      const frozenQuote = mapQuote(quote.rows[0])
      const chapterById = new Map(calculation.chapters.map(chapter => [chapter.id, chapter]))
      const valueByCode = new Map(frozenQuote.snapshot.lines.map(line => [line.code, line.total]))
      const packageGroups = new Map<string, { code: string; name: string; value: number }>()
      for (const item of calculation.items) {
        const chapter = item.chapterId ? chapterById.get(item.chapterId) : undefined
        const key = chapter?.id ?? 'unassigned'
        const current = packageGroups.get(key) ?? { code: chapter?.code ?? '00', name: chapter?.name ?? 'Niet toegewezen', value: 0 }
        current.value += valueByCode.get(item.code) ?? 0
        packageGroups.set(key, current)
      }
      const groups = [...packageGroups.values()]
      const groupedValue = groups.reduce((sum, group) => sum + group.value, 0)
      let allocatedBudget = 0
      const workPackages: ProjectWorkPackage[] = groups.map((group, index) => {
        const budget = index === groups.length - 1 ? Number((costBudget - allocatedBudget).toFixed(2)) : Number((costBudget * (groupedValue ? group.value / groupedValue : 1 / groups.length)).toFixed(2))
        allocatedBudget += budget
        return { id: randomUUID(), code: group.code, name: group.name, budget, plannedHours: 0, status: 'Niet gestart' }
      })
      const handover = emptyHandover()
      if ((scenario?.riskPct ?? calculation.riskPct) > 0) handover.risks.push(`Calculatierisico van ${scenario?.riskPct ?? calculation.riskPct}% actief opvolgen.`)
      handover.risks.push(...frozenQuote.content.exclusions.map(exclusion => `Contractuele uitsluiting bewaken: ${exclusion}`))
      const opportunityState = mapOpportunity(opportunity.rows[0])
      const entities = await client.query<LegalEntityRow>('SELECT * FROM legal_entities WHERE tenant_id=$1 AND active=true ORDER BY created_at', [context.tenantId])
      const entity = opportunityState.legalEntityId
        ? entities.rows.find(item => item.id === opportunityState.legalEntityId && this.canAccessEntity(context, item.id))
        : entities.rows.find(item => this.canAccessEntity(context, item.id))
      if (!entity) throw new RepositoryError('Er is geen toegankelijke actieve juridische entiteit voor dit project', 409)
      const branch = opportunityState.branchId
        ? await client.query<CompanyBranchRow>('SELECT * FROM company_branches WHERE tenant_id=$1 AND id=$2 AND legal_entity_id=$3', [context.tenantId, opportunityState.branchId, entity.id])
        : await client.query<CompanyBranchRow>('SELECT * FROM company_branches WHERE tenant_id=$1 AND legal_entity_id=$2 ORDER BY created_at LIMIT 1', [context.tenantId, entity.id])
      const project: Project = { id: randomUUID(), number: `PRJ-${new Date().getFullYear()}-${String(Number(count.rows[0].count) + 1).padStart(3, '0')}`, name: opportunity.rows[0].title, organizationId: opportunity.rows[0].organization_id, legalEntityId: entity.id, branchId: branch.rows[0]?.id, sourceCalculationId: calculationId, contractValue, costBudget, marginPct, progress: 0, status: 'Opstart', handover, workPackages, planning: emptyPlanning() }
      await client.query(`INSERT INTO projects (tenant_id,id,number,name,organization_id,legal_entity_id,branch_id,source_calculation_id,contract_value,cost_budget,margin_pct,progress,status,handover,work_packages,planning)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`, [context.tenantId, project.id, project.number, project.name, project.organizationId, project.legalEntityId ?? null, project.branchId ?? null, calculationId, project.contractValue, project.costBudget, project.marginPct, project.progress, project.status, JSON.stringify(project.handover), JSON.stringify(project.workPackages), JSON.stringify(project.planning)])
      const lidarBaselines=await client.query<{id:string;session_data:LidarScanSession|string}&QueryResultRow>('SELECT id,session_data FROM lidar_scan_sessions WHERE tenant_id=$1 AND calculation_id=$2 FOR UPDATE',[context.tenantId,calculationId])
      for(const row of lidarBaselines.rows){const scan=jsonValue<LidarScanSession>(row.session_data);const baseline:LidarScanSession={...scan,projectId:project.id,purpose:'Nulmeting'};await client.query('UPDATE lidar_scan_sessions SET project_id=$3,purpose=$4,session_data=$5,updated_at=now() WHERE tenant_id=$1 AND id=$2',[context.tenantId,row.id,project.id,'Nulmeting',JSON.stringify(baseline)]);await this.audit(client,context,'lidar_scan',row.id,'promoted_to_baseline',scan,baseline,project.number)}
      await client.query(`UPDATE opportunities SET stage='Gewonnen',probability=100,updated_at=now() WHERE tenant_id=$1 AND id=$2`, [context.tenantId, calculation.opportunityId])
      await this.audit(client, context, 'project', project.id, 'created_from_award', null, project)
      return project
    })
  }

  async updateProjectStartup(context: RequestContext, projectId: string, input: ProjectStartupInput): Promise<Project> {
    return this.transaction(async client => {
      const result = await client.query<ProjectRow>('SELECT * FROM projects WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [context.tenantId, projectId])
      if (!result.rowCount) throw new RepositoryError('Project niet gevonden', 404)
      const current = this.mapProject(result.rows[0])
      const allowedStatuses: Record<ProjectHandover['status'], ProjectHandover['status'][]> = { Concept: ['Concept', 'Klaar voor overdracht'], 'Klaar voor overdracht': ['Concept', 'Klaar voor overdracht', 'Aanvaard'], Aanvaard: ['Aanvaard'] }
      if (!allowedStatuses[current.handover.status].includes(input.handover.status)) throw new RepositoryError('Deze overdrachtsstatus kan niet rechtstreeks worden gekozen', 409)
      if (current.workPackages.length !== input.workPackages.length || current.workPackages.some(workPackage => !input.workPackages.some(item => item.id === workPackage.id))) throw new RepositoryError('De werkpakketstructuur stemt niet overeen met het projectbudget', 409)
      const workPackages = current.workPackages.map(workPackage => {
        const update = input.workPackages.find(item => item.id === workPackage.id)!
        return { ...workPackage, plannedHours: update.plannedHours, status: update.status }
      })
      const handover: ProjectHandover = { ...input.handover, acceptedAt: input.handover.status === 'Aanvaard' ? current.handover.acceptedAt ?? new Date().toISOString() : undefined }
      await client.query('UPDATE projects SET handover=$3,work_packages=$4 WHERE tenant_id=$1 AND id=$2', [context.tenantId, projectId, JSON.stringify(handover), JSON.stringify(workPackages)])
      const updated = { ...current, handover, workPackages }
      await this.audit(client, context, 'project', projectId, 'startup_updated', current, updated)
      return updated
    })
  }

  async generateProjectPlanning(context: RequestContext, projectId: string): Promise<Project> {
    return this.transaction(async client => {
      const result = await client.query<ProjectRow>('SELECT * FROM projects WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [context.tenantId, projectId])
      if (!result.rowCount) throw new RepositoryError('Project niet gevonden', 404)
      const project = this.mapProject(result.rows[0])
      if (project.handover.status !== 'Aanvaard') throw new RepositoryError('De projectoverdracht moet eerst aanvaard zijn', 409)
      if (!project.handover.plannedStart || !project.handover.plannedEnd) throw new RepositoryError('De geplande projectdatums ontbreken', 409)
      if (project.planning.activities.length) return project
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
        const proportionalEnd = index === project.workPackages.length - 1 ? spanDays - 1 : Math.max(startOffset, Math.round(spanDays * cumulativeWeight / totalWeight) - 1)
        const endOffset = Math.min(spanDays - 1, proportionalEnd)
        const activity: PlanningActivity = { id: randomUUID(), workPackageId: workPackage.id, name: `${workPackage.code} · ${workPackage.name}`, startDate: addDays(project.handover.plannedStart, startOffset), endDate: addDays(project.handover.plannedStart, endOffset), progress: 0, predecessorIds: [], milestone: false, responsible: project.handover.projectManager, responsibleEmployeeId: project.handover.projectManagerEmployeeId, crewSize: 0, weatherSensitive: false, resourceAssignments: [] }
        previousEndOffset = endOffset
        return activity
      })
      activities.forEach((activity, index) => { if (index > 0) activity.predecessorIds = [activities[index - 1].id] })
      const lastActivity = activities.at(-1)
      activities.push({ id: randomUUID(), name: 'Mijlpaal · einde werken', startDate: project.handover.plannedEnd, endDate: project.handover.plannedEnd, progress: 0, predecessorIds: lastActivity ? [lastActivity.id] : [], milestone: true, responsible: project.handover.projectManager, responsibleEmployeeId: project.handover.projectManagerEmployeeId, crewSize: 0, weatherSensitive: false, resourceAssignments: [] })
      const planning: ProjectPlanning = { status: 'Concept', baselineVersion: 0, activities, updatedAt: new Date().toISOString() }
      await client.query('UPDATE projects SET planning=$3 WHERE tenant_id=$1 AND id=$2', [context.tenantId, projectId, JSON.stringify(planning)])
      const updated = { ...project, planning }
      await this.audit(client, context, 'project_planning', projectId, 'generated', null, planning)
      return updated
    })
  }

  async updateProjectPlanning(context: RequestContext, projectId: string, input: ProjectPlanningInput): Promise<Project> {
    return this.transaction(async client => {
      const result = await client.query<ProjectRow>('SELECT * FROM projects WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [context.tenantId, projectId])
      if (!result.rowCount) throw new RepositoryError('Project niet gevonden', 404)
      const project = this.mapProject(result.rows[0])
      if (project.planning.activities.length !== input.activities.length || project.planning.activities.some(activity => !input.activities.some(item => item.id === activity.id))) throw new RepositoryError('De activiteitenstructuur stemt niet overeen met de projectplanning', 409)
      const activities = project.planning.activities.map(activity => {
        const update = input.activities.find(item => item.id === activity.id)!
        return { ...activity, name: update.name, startDate: update.startDate, endDate: update.endDate, progress: update.progress, predecessorIds: update.predecessorIds, dependencies: update.dependencies, responsible: update.responsible, responsibleEmployeeId: update.responsibleEmployeeId, crewSize: update.crewSize, weatherSensitive: update.weatherSensitive, resourceAssignments: update.resourceAssignments }
      })
      const changedFromBaseline = project.planning.baselineVersion > 0 && activities.some(activity => activity.startDate !== activity.baselineStartDate || activity.endDate !== activity.baselineEndDate)
      const planning: ProjectPlanning = { ...project.planning, status: project.planning.baselineVersion ? changedFromBaseline ? 'Gewijzigd' : 'Baseline' : 'Concept', activities, scenarios: input.scenarios ?? project.planning.scenarios ?? [], selectedScenarioId: input.selectedScenarioId, updatedAt: new Date().toISOString() }
      await client.query('UPDATE projects SET planning=$3 WHERE tenant_id=$1 AND id=$2', [context.tenantId, projectId, JSON.stringify(planning)])
      const updated = { ...project, planning }
      await this.audit(client, context, 'project_planning', projectId, 'updated', project.planning, planning)
      return updated
    })
  }

  async baselineProjectPlanning(context: RequestContext, projectId: string, input: ProjectBaselineInput = {}): Promise<Project> {
    return this.transaction(async client => {
      const result = await client.query<ProjectRow>('SELECT * FROM projects WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [context.tenantId, projectId])
      if (!result.rowCount) throw new RepositoryError('Project niet gevonden', 404)
      const project = this.mapProject(result.rows[0])
      if (!project.planning.activities.length) throw new RepositoryError('Genereer eerst een projectplanning', 409)
      const createdAt = new Date().toISOString()
      const version = project.planning.baselineVersion + 1
      const baseline = {
        version,
        name: input.name?.trim() || `Baseline B${version}`,
        reason: input.reason?.trim() || 'Nieuwe goedgekeurde referentieplanning',
        approvalStatus: input.approvalStatus ?? 'Goedgekeurd' as const,
        createdAt,
        createdBy: context.displayName,
        activities: project.planning.activities.map(activity => ({ activityId: activity.id, startDate: activity.startDate, endDate: activity.endDate })),
      }
      const sourceHistory = project.planning.baselineHistory?.length ? project.planning.baselineHistory : project.planning.baselineVersion ? [{
        version: project.planning.baselineVersion,
        name: `Baseline B${project.planning.baselineVersion}`,
        reason: 'Bestaande referentieplanning',
        approvalStatus: 'Goedgekeurd' as const,
        createdAt: project.planning.updatedAt,
        createdBy: 'Projectteam',
        activities: project.planning.activities.map(activity => ({ activityId: activity.id, startDate: activity.baselineStartDate ?? activity.startDate, endDate: activity.baselineEndDate ?? activity.endDate })),
      }] : []
      const baselineHistory = [...sourceHistory.map(item => item.approvalStatus === 'Goedgekeurd' ? { ...item, approvalStatus: 'Vervangen' as const } : item), baseline]
      const planning: ProjectPlanning = { ...project.planning, status: 'Baseline', baselineVersion: version, baselineHistory, updatedAt: createdAt, activities: project.planning.activities.map(activity => ({ ...activity, baselineStartDate: activity.startDate, baselineEndDate: activity.endDate })) }
      await client.query('UPDATE projects SET planning=$3 WHERE tenant_id=$1 AND id=$2', [context.tenantId, projectId, JSON.stringify(planning)])
      const updated = { ...project, planning }
      await this.audit(client, context, 'project_planning', projectId, 'baseline_created', project.planning, planning, `Baseline ${planning.baselineVersion}`)
      return updated
    })
  }

  async createDailyReport(context: RequestContext, projectId: string, input: DailyReportInput): Promise<DailyReport> {
    return this.transaction(async client => {
      await this.validateDailyReportProject(client, context.tenantId, projectId, input.workPackageId)
      await this.validateDailyProductionEntries(client, context.tenantId, projectId, input.productionEntries ?? [])
      const normalizedInput = await this.normalizeDailyReportEmployees(client, context.tenantId, projectId, input)
      const existing = await client.query('SELECT id FROM daily_reports WHERE tenant_id=$1 AND project_id=$2 AND report_date=$3', [context.tenantId, projectId, input.date])
      if (existing.rowCount) throw new RepositoryError('Voor deze projectdatum bestaat al een dagrapport', 409)
      const report: DailyReport = { id: randomUUID(), projectId, ...normalizedInput, status: 'Concept', createdAt: new Date().toISOString() }
      await client.query(`INSERT INTO daily_reports (tenant_id,id,project_id,report_date,work_package_id,weather,temperature,activities,labor_entries,subcontractors,materials,machines,production_entries,deliveries,delays,problems,visitors,notes,status,created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`, [context.tenantId, report.id, projectId, report.date, report.workPackageId ?? null, report.weather, report.temperature, report.activities, JSON.stringify(report.laborEntries), JSON.stringify(report.subcontractors), JSON.stringify(report.materials), JSON.stringify(report.machines), JSON.stringify(report.productionEntries ?? []), report.deliveries, report.delays, report.problems, report.visitors, report.notes, report.status, report.createdAt])
      await this.audit(client, context, 'daily_report', report.id, 'created', null, report)
      return report
    })
  }

  async updateDailyReport(context: RequestContext, reportId: string, input: DailyReportInput): Promise<DailyReport> {
    return this.transaction(async client => {
      const result = await client.query<DailyReportRow>('SELECT * FROM daily_reports WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [context.tenantId, reportId])
      if (!result.rowCount) throw new RepositoryError('Dagrapport niet gevonden', 404)
      const current = mapDailyReport(result.rows[0])
      if (current.status !== 'Concept') throw new RepositoryError('Alleen een conceptdagrapport kan worden gewijzigd', 409)
      await this.validateDailyReportProject(client, context.tenantId, current.projectId, input.workPackageId)
      await this.validateDailyProductionEntries(client, context.tenantId, current.projectId, input.productionEntries ?? [])
      const normalizedInput = await this.normalizeDailyReportEmployees(client, context.tenantId, current.projectId, input)
      const duplicate = await client.query('SELECT id FROM daily_reports WHERE tenant_id=$1 AND project_id=$2 AND report_date=$3 AND id<>$4', [context.tenantId, current.projectId, input.date, reportId])
      if (duplicate.rowCount) throw new RepositoryError('Voor deze projectdatum bestaat al een dagrapport', 409)
      await client.query(`UPDATE daily_reports SET report_date=$3,work_package_id=$4,weather=$5,temperature=$6,activities=$7,labor_entries=$8,subcontractors=$9,materials=$10,machines=$11,production_entries=$12,deliveries=$13,delays=$14,problems=$15,visitors=$16,notes=$17 WHERE tenant_id=$1 AND id=$2`, [context.tenantId, reportId, normalizedInput.date, normalizedInput.workPackageId ?? null, normalizedInput.weather, normalizedInput.temperature, normalizedInput.activities, JSON.stringify(normalizedInput.laborEntries), JSON.stringify(normalizedInput.subcontractors), JSON.stringify(normalizedInput.materials), JSON.stringify(normalizedInput.machines), JSON.stringify(normalizedInput.productionEntries ?? []), normalizedInput.deliveries, normalizedInput.delays, normalizedInput.problems, normalizedInput.visitors, normalizedInput.notes])
      const updated: DailyReport = { ...current, ...normalizedInput }
      await this.audit(client, context, 'daily_report', reportId, 'updated', current, updated)
      return updated
    })
  }

  async submitDailyReport(context: RequestContext, reportId: string): Promise<DailyReport> {
    return this.transaction(async client => {
      const result = await client.query<DailyReportRow>('SELECT * FROM daily_reports WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [context.tenantId, reportId])
      if (!result.rowCount) throw new RepositoryError('Dagrapport niet gevonden', 404)
      const current = mapDailyReport(result.rows[0])
      if (current.status !== 'Concept') throw new RepositoryError('Dit dagrapport is al ingediend', 409)
      if (!current.activities && !current.delays && !current.problems) throw new RepositoryError('Beschrijf de uitgevoerde activiteiten, stilstand of problemen', 409)
      if (!current.laborEntries.length && !current.subcontractors.length) throw new RepositoryError('Registreer minstens één medewerker of onderaannemer', 409)
      const submittedAt = new Date().toISOString()
      await client.query("UPDATE daily_reports SET status='Ingediend',submitted_at=$3 WHERE tenant_id=$1 AND id=$2", [context.tenantId, reportId, submittedAt])
      const updated: DailyReport = { ...current, status: 'Ingediend', submittedAt }
      await this.audit(client, context, 'daily_report', reportId, 'submitted', current, updated)
      return updated
    })
  }

  async signDailyReport(context: RequestContext, reportId: string, signedBy: string): Promise<DailyReport> {
    return this.transaction(async client => {
      const result = await client.query<DailyReportRow>('SELECT * FROM daily_reports WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [context.tenantId, reportId])
      if (!result.rowCount) throw new RepositoryError('Dagrapport niet gevonden', 404)
      const current = mapDailyReport(result.rows[0])
      if (current.status !== 'Ingediend') throw new RepositoryError('Alleen een ingediend dagrapport kan worden ondertekend', 409)
      const signedAt = new Date().toISOString()
      await client.query("UPDATE daily_reports SET status='Ondertekend',signed_by=$3,signed_at=$4 WHERE tenant_id=$1 AND id=$2", [context.tenantId, reportId, signedBy, signedAt])
      const updated: DailyReport = { ...current, status: 'Ondertekend', signedBy, signedAt }
      await this.audit(client, context, 'daily_report', reportId, 'signed', current, updated, `Ondertekend door ${signedBy}`)
      return updated
    })
  }

  async createSitePhoto(context: RequestContext, reportId: string, input: SitePhotoInput, file: { fileName: string; mimeType: string; data: Buffer }): Promise<SitePhoto> {
    const id = randomUUID()
    const extension = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif' } as Record<string, string>)[file.mimeType]
    if (!extension) throw new RepositoryError('Alleen JPEG-, PNG-, WebP- en HEIC-foto’s zijn toegestaan', 415)
    const storageKey = `${context.tenantId}/${id}.${extension}`
    await this.objectStorage.put(storageKey, file.data)
    try {
      return await this.transaction(async client => {
        const reportResult = await client.query<DailyReportRow>('SELECT * FROM daily_reports WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [context.tenantId, reportId])
        if (!reportResult.rowCount) throw new RepositoryError('Dagrapport niet gevonden', 404)
        const report = mapDailyReport(reportResult.rows[0])
        if (report.status !== 'Concept') throw new RepositoryError('Foto’s kunnen alleen aan een conceptdagrapport worden toegevoegd', 409)
        await this.validateDailyReportProject(client, context.tenantId, report.projectId, input.workPackageId)
        const photo: SitePhoto = { id, projectId: report.projectId, dailyReportId: reportId, workPackageId: input.workPackageId, fileName: file.fileName.slice(0, 255), mimeType: file.mimeType, sizeBytes: file.data.length, caption: input.caption, location: input.location, takenAt: input.takenAt, createdAt: new Date().toISOString() }
        await client.query(`INSERT INTO site_photos (tenant_id,id,project_id,daily_report_id,work_package_id,storage_key,file_name,mime_type,size_bytes,caption,location,taken_at,created_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`, [context.tenantId, photo.id, photo.projectId, reportId, photo.workPackageId ?? null, storageKey, photo.fileName, photo.mimeType, photo.sizeBytes, photo.caption, photo.location, photo.takenAt, photo.createdAt])
        await this.audit(client, context, 'site_photo', photo.id, 'created', null, photo)
        return photo
      })
    } catch (error) {
      await this.objectStorage.delete(storageKey)
      throw error
    }
  }

  async getSitePhotoFile(context: RequestContext, photoId: string) {
    const result = await this.pool.query<SitePhotoRow>('SELECT * FROM site_photos WHERE tenant_id=$1 AND id=$2', [context.tenantId, photoId])
    if (!result.rowCount) throw new RepositoryError('Werffoto niet gevonden', 404)
    const photo = mapSitePhoto(result.rows[0])
    return { photo, data: await this.objectStorage.get(result.rows[0].storage_key) }
  }

  async deleteSitePhoto(context: RequestContext, photoId: string): Promise<void> {
    const storageKey = await this.transaction(async client => {
      const result = await client.query<SitePhotoRow & { report_status: DailyReport['status'] }>(`SELECT p.*,r.status AS report_status FROM site_photos p JOIN daily_reports r ON r.tenant_id=p.tenant_id AND r.id=p.daily_report_id WHERE p.tenant_id=$1 AND p.id=$2 FOR UPDATE`, [context.tenantId, photoId])
      if (!result.rowCount) throw new RepositoryError('Werffoto niet gevonden', 404)
      if (result.rows[0].report_status !== 'Concept') throw new RepositoryError('Bewijs bij een ingediend dagrapport kan niet worden verwijderd', 409)
      const linkedChange = await client.query("SELECT id FROM change_orders WHERE tenant_id=$1 AND status NOT IN ('Vastgesteld','Berekend') AND photo_ids @> $2::jsonb", [context.tenantId, JSON.stringify([photoId])])
      if (linkedChange.rowCount) throw new RepositoryError('Bewijs bij een ingediend meerwerk kan niet worden verwijderd', 409)
      const photo = mapSitePhoto(result.rows[0])
      await client.query('DELETE FROM site_photos WHERE tenant_id=$1 AND id=$2', [context.tenantId, photoId])
      await this.audit(client, context, 'site_photo', photoId, 'deleted', photo, null)
      return result.rows[0].storage_key
    })
    await this.objectStorage.delete(storageKey)
  }

  private async lidarSession(client:SqlClient,context:RequestContext,id:string,lock=false):Promise<LidarScanSession>{
    const result=await client.query<{session_data:LidarScanSession|string}&QueryResultRow>(`SELECT session_data FROM lidar_scan_sessions WHERE tenant_id=$1 AND id=$2${lock?' FOR UPDATE':''}`,[context.tenantId,id])
    if(!result.rowCount)throw new RepositoryError('LiDAR-scansessie niet gevonden',404)
    const session=jsonValue<LidarScanSession>(result.rows[0].session_data)
    if(session.projectId)await this.requireProject(client,context,session.projectId)
    else if(session.calculationId){if(!await this.getCalculation(client,context.tenantId,session.calculationId))throw new RepositoryError('Calculatie bij LiDAR-scan niet gevonden',404)}
    else throw new RepositoryError('LiDAR-scan heeft geen geldige project- of calculatiecontext',409)
    return session
  }

  async listLidarScans(context:RequestContext,projectId:string):Promise<LidarScanSession[]>{
    await this.requireProject(this.pool as unknown as SqlClient,context,projectId)
    const result=await this.pool.query<{session_data:LidarScanSession|string}&QueryResultRow>('SELECT session_data FROM lidar_scan_sessions WHERE tenant_id=$1 AND project_id=$2 ORDER BY updated_at DESC',[context.tenantId,projectId])
    return result.rows.map(row=>jsonValue<LidarScanSession>(row.session_data))
  }

  async listCalculationLidarScans(context:RequestContext,calculationId:string):Promise<LidarScanSession[]>{
    if(!await this.getCalculation(this.pool as unknown as SqlClient,context.tenantId,calculationId))throw new RepositoryError('Calculatie niet gevonden',404)
    const result=await this.pool.query<{session_data:LidarScanSession|string}&QueryResultRow>('SELECT session_data FROM lidar_scan_sessions WHERE tenant_id=$1 AND calculation_id=$2 ORDER BY updated_at DESC',[context.tenantId,calculationId])
    return result.rows.map(row=>jsonValue<LidarScanSession>(row.session_data))
  }

  async createLidarScan(context:RequestContext,projectId:string,input:LidarScanInput&{controlPoints?:LidarControlPoint[];observations?:LidarElementObservation[]}):Promise<LidarScanSession>{
    return this.transaction(async client=>{await this.requireProject(client,context,projectId);if(!input.deviceSupportsLidar)throw new RepositoryError('Dit toestel rapporteert geen ondersteunde LiDAR-sensor',409);const session:LidarScanSession={id:randomUUID(),projectId,...input,purpose:input.purpose??'Vorderingsopname',status:'Opgenomen',controlPoints:input.controlPoints??[],registration:undefined,artifacts:[],observations:input.observations??[],matches:[],progressProposals:[],bcfTopics:[],asBuiltRevisions:[],surveyElements:input.surveyElements??[],workAssignments:input.workAssignments??[]};await client.query('INSERT INTO lidar_scan_sessions (tenant_id,id,project_id,purpose,session_data) VALUES ($1,$2,$3,$4,$5)',[context.tenantId,session.id,projectId,session.purpose,JSON.stringify(session)]);await this.audit(client,context,'lidar_scan',session.id,'captured',null,session,`${session.modelName} · ${session.zone}`);return session})
  }

  async createCalculationLidarScan(context:RequestContext,calculationId:string,input:LidarScanInput&{controlPoints?:LidarControlPoint[];observations?:LidarElementObservation[]}):Promise<LidarScanSession>{
    return this.transaction(async client=>{const calculation=await this.getCalculation(client,context.tenantId,calculationId);if(!calculation)throw new RepositoryError('Calculatie niet gevonden',404);if(!input.deviceSupportsLidar)throw new RepositoryError('Dit toestel rapporteert geen ondersteunde LiDAR-sensor',409);const session:LidarScanSession={id:randomUUID(),calculationId,opportunityId:calculation.opportunityId,...input,purpose:'Calculatie-opname',status:'Opgenomen',controlPoints:input.controlPoints??[],registration:undefined,artifacts:[],observations:input.observations??[],matches:[],progressProposals:[],bcfTopics:[],asBuiltRevisions:[],surveyElements:input.surveyElements??[],workAssignments:input.workAssignments??[]};await client.query('INSERT INTO lidar_scan_sessions (tenant_id,id,opportunity_id,calculation_id,purpose,session_data) VALUES ($1,$2,$3,$4,$5,$6)',[context.tenantId,session.id,calculation.opportunityId,calculationId,session.purpose,JSON.stringify(session)]);await this.audit(client,context,'lidar_calculation_scan',session.id,'captured',null,session,`${session.modelName} · ${session.zone}`);return session})
  }

  async uploadLidarArtifact(context:RequestContext,scanId:string,input:{kind:LidarArtifact['kind'];capturedAt:string},file:{fileName:string;mimeType:string;data:Buffer}):Promise<LidarScanSession>{
    const artifactId=randomUUID();const extension=lidarArtifactExtension(file.fileName,file.mimeType);const storageKey=`${context.tenantId}/lidar/${scanId}/${artifactId}.${extension}`;await this.objectStorage.put(storageKey,file.data)
    try{return await this.transaction(async client=>{const current=await this.lidarSession(client,context,scanId,true);if(current.status==='As-built gepubliceerd')throw new RepositoryError('Een gepubliceerde LiDAR-sessie is onveranderlijk',409);const artifact:LidarArtifact={id:artifactId,kind:input.kind,fileName:file.fileName.slice(0,255),mimeType:file.mimeType,sizeBytes:file.data.length,digest:createHash('sha256').update(file.data).digest('hex'),storageKey,capturedAt:input.capturedAt};const updated={...current,artifacts:[...current.artifacts,artifact]};await client.query('UPDATE lidar_scan_sessions SET session_data=$3,updated_at=now() WHERE tenant_id=$1 AND id=$2',[context.tenantId,scanId,JSON.stringify(updated)]);await this.audit(client,context,'lidar_scan',scanId,'artifact_uploaded',current,updated,artifact.fileName);return updated})}catch(error){await this.objectStorage.delete(storageKey);throw error}
  }

  async getLidarArtifactFile(context:RequestContext,scanId:string,artifactId:string){
    const session=await this.lidarSession(this.pool as unknown as SqlClient,context,scanId)
    const artifact=session.artifacts.find(item=>item.id===artifactId)
    if(!artifact?.storageKey)throw new RepositoryError('LiDAR-bewijsbestand niet gevonden',404)
    return {artifact,data:await this.objectStorage.get(artifact.storageKey)}
  }

  async buildLidarCalculation(context:RequestContext,id:string,elements:LidarSurveyElement[],assignments:LidarWorkAssignment[]):Promise<LidarScanSession>{
    return this.transaction(async client=>{const current=await this.lidarSession(client,context,id,true);if(!current.calculationId)throw new RepositoryError('Deze LiDAR-scan is niet aan een calculatie gekoppeld',409);const proposal=buildLidarCalculationProposal(id,current.calculationId,elements,assignments);const updated:LidarScanSession={...current,surveyElements:elements,workAssignments:assignments,calculationProposal:proposal,status:'Ter goedkeuring'};await client.query('UPDATE lidar_scan_sessions SET session_data=$3,updated_at=now() WHERE tenant_id=$1 AND id=$2',[context.tenantId,id,JSON.stringify(updated)]);await this.audit(client,context,'lidar_calculation_scan',id,'proposal_built',current,updated,`${proposal.items.length} calculatieposten · € ${proposal.directCost}`);return updated})
  }

  async approveLidarCalculation(context:RequestContext,id:string,approvedBy:string):Promise<LidarScanSession>{
    return this.transaction(async client=>{const current=await this.lidarSession(client,context,id,true);if(!current.calculationProposal)throw new RepositoryError('Maak eerst een LiDAR-calculatievoorstel',409);const calculationProposal=approveLidarCalculationProposal(current.calculationProposal,approvedBy);const updated:LidarScanSession={...current,calculationProposal,status:'Goedgekeurd'};await client.query('UPDATE lidar_scan_sessions SET session_data=$3,updated_at=now() WHERE tenant_id=$1 AND id=$2',[context.tenantId,id,JSON.stringify(updated)]);await this.audit(client,context,'lidar_calculation_scan',id,'proposal_approved',current,updated,approvedBy);return updated})
  }

  async applyLidarCalculation(context:RequestContext,id:string):Promise<LidarScanSession>{
    return this.transaction(async client=>{
      const current=await this.lidarSession(client,context,id,true)
      const proposal=current.calculationProposal
      if(!current.calculationId||!proposal)throw new RepositoryError('LiDAR-calculatievoorstel niet gevonden',409)
      if(proposal.status==='Toegepast')return current
      if(proposal.status!=='Goedgekeurd')throw new RepositoryError('Keur het LiDAR-calculatievoorstel eerst goed',409)
      const calculation=await this.getCalculation(client,context.tenantId,current.calculationId)
      if(!calculation)throw new RepositoryError('Calculatie niet gevonden',404)
      const chapters=new Map(calculation.chapters.map(item=>[item.name,item]))
      const existingCodes=new Set(calculation.items.map(item=>item.code))
      let chapterOrder=calculation.chapters.length
      let itemOrder=calculation.items.length
      const createdItemIds:string[]=[]
      for(const proposed of proposal.items){
        let chapter=chapters.get(proposed.discipline)
        if(!chapter){const code=`L-${proposed.catalogCode.split('-')[0]}`;chapter={id:randomUUID(),code,name:proposed.discipline,sortOrder:chapterOrder++};await client.query('INSERT INTO boq_chapters (tenant_id,id,calculation_id,code,name,sort_order) VALUES ($1,$2,$3,$4,$5,$6)',[context.tenantId,chapter.id,current.calculationId,chapter.code,chapter.name,chapter.sortOrder]);chapters.set(chapter.name,chapter)}
        let code=proposed.boqItem.code
        if(existingCodes.has(code)){let sequence=2;while(existingCodes.has(`${code}.${sequence}`))sequence+=1;code=`${code}.${sequence}`}
        existingCodes.add(code)
        const item:BoqItem={...proposed.boqItem,id:randomUUID(),chapterId:chapter.id,sortOrder:itemOrder++,lidarScanIds:[id],workflowStatus:proposed.reviewReasons.length?'Ter controle':'In bewerking'}
        item.code=code
        await client.query(`INSERT INTO boq_items (tenant_id,id,calculation_id,chapter_id,code,description,quantity,unit,labor,material,equipment,subcontracting,advanced,sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,[context.tenantId,item.id,current.calculationId,chapter.id,item.code,item.description,item.quantity,item.unit,item.labor,item.material,item.equipment,item.subcontracting,JSON.stringify(itemAdvanced(item)),item.sortOrder])
        createdItemIds.push(item.id)
        await this.audit(client,context,'boq_item',item.id,'created_from_lidar',null,item,`${current.zone} · scan ${id}`)
      }
      await client.query('UPDATE calculations SET updated_at=now() WHERE tenant_id=$1 AND id=$2',[context.tenantId,current.calculationId])
      const calculationProposal={...proposal,status:'Toegepast' as const,appliedAt:new Date().toISOString(),createdItemIds}
      const updated:LidarScanSession={...current,calculationProposal,status:'Goedgekeurd'}
      await client.query('UPDATE lidar_scan_sessions SET session_data=$3,updated_at=now() WHERE tenant_id=$1 AND id=$2',[context.tenantId,id,JSON.stringify(updated)])
      await this.audit(client,context,'lidar_calculation_scan',id,'proposal_applied',current,updated,`${createdItemIds.length} posten toegevoegd aan ${calculation.number}`)
      return updated
    })
  }

  async registerLidarSession(context:RequestContext,id:string,controlPoints:LidarControlPoint[],registeredBy:string):Promise<LidarScanSession>{return this.transaction(async client=>{const current=await this.lidarSession(client,context,id,true);if(current.status==='As-built gepubliceerd')throw new RepositoryError('Een gepubliceerde LiDAR-sessie is onveranderlijk',409);const registration=registerLidarScan(controlPoints,registeredBy);const updated:LidarScanSession={...current,controlPoints,registration,status:'Uitgelijnd'};await client.query('UPDATE lidar_scan_sessions SET session_data=$3,updated_at=now() WHERE tenant_id=$1 AND id=$2',[context.tenantId,id,JSON.stringify(updated)]);await this.audit(client,context,'lidar_scan',id,'registered',current,updated,`${registration.rmsErrorMm} mm RMS`);return updated})}

  async analyzeLidarSession(context:RequestContext,id:string,observations:LidarElementObservation[]):Promise<LidarScanSession>{
    return this.transaction(async client=>{
      const current=await this.lidarSession(client,context,id,true)
      if(!current.projectId)throw new RepositoryError('Een vorderingsanalyse vereist een gegund project',409)
      if(!current.registration)throw new RepositoryError('Lijn de scan eerst uit met minstens drie controlepunten',409)
      const dailyReportIds=[...new Set(observations.flatMap(item=>item.dailyReportIds??[]))]
      if(dailyReportIds.length){
        const reports=await client.query<{id:string}&QueryResultRow>("SELECT id FROM daily_reports WHERE tenant_id=$1 AND project_id=$2 AND status='Ondertekend' AND id=ANY($3::uuid[])",[context.tenantId,current.projectId,dailyReportIds])
        if(reports.rowCount!==dailyReportIds.length)throw new RepositoryError('Gebruik alleen ondertekende dagrapporten van dit project als LiDAR-bewijs',409)
      }
      const inspectionDocumentIds=[...new Set(observations.flatMap(item=>item.inspectionDocumentIds??[]))]
      if(inspectionDocumentIds.length){
        const documents=await client.query<{id:string}&QueryResultRow>("SELECT id FROM documents WHERE tenant_id=$1 AND project_id=$2 AND status='Goedgekeurd' AND id=ANY($3::uuid[])",[context.tenantId,current.projectId,inspectionDocumentIds])
        if(documents.rowCount!==inspectionDocumentIds.length)throw new RepositoryError('Gebruik alleen goedgekeurde keuringsdocumenten van dit project als LiDAR-bewijs',409)
      }
      const projectResult=await client.query<ProjectRow>('SELECT * FROM projects WHERE tenant_id=$1 AND id=$2',[context.tenantId,current.projectId])
      const project=this.mapProject(projectResult.rows[0])
      const matches=analyzeLidarObservations(observations)
      const progressProposals=buildLidarProgressProposals(id,matches,project.workPackages)
      if(!progressProposals.length)throw new RepositoryError('Geen scanobjecten konden aan projectwerkpakketten worden gekoppeld',409)
      const updated:LidarScanSession={...current,observations,matches,progressProposals,status:progressProposals.some(item=>item.reviewReasons.length)?'Ter goedkeuring':'Geanalyseerd'}
      await client.query('UPDATE lidar_scan_sessions SET session_data=$3,updated_at=now() WHERE tenant_id=$1 AND id=$2',[context.tenantId,id,JSON.stringify(updated)])
      await this.audit(client,context,'lidar_scan',id,'analyzed',current,updated,`${matches.length} IFC-objecten`)
      return updated
    })
  }

  async approveLidarProgress(context:RequestContext,id:string,proposalId:string,approvedBy:string):Promise<LidarScanSession>{return this.transaction(async client=>{const current=await this.lidarSession(client,context,id,true);const proposal=current.progressProposals.find(item=>item.id===proposalId);if(!proposal)throw new RepositoryError('LiDAR-vorderingsvoorstel niet gevonden',404);const approved=approveLidarProposal(proposal,approvedBy);const progressProposals=current.progressProposals.map(item=>item.id===proposalId?approved:item);const updated:LidarScanSession={...current,progressProposals,status:progressProposals.every(item=>['Goedgekeurd','Afgekeurd'].includes(item.status))?'Goedgekeurd':'Ter goedkeuring'};await client.query('UPDATE lidar_scan_sessions SET session_data=$3,updated_at=now() WHERE tenant_id=$1 AND id=$2',[context.tenantId,id,JSON.stringify(updated)]);await this.audit(client,context,'lidar_scan',id,'progress_approved',current,updated,proposal.workPackageName);return updated})}

  async addLidarBcfTopic(context:RequestContext,id:string,input:Omit<LidarBcfTopic,'id'|'scanSessionId'|'status'|'createdAt'>):Promise<LidarScanSession>{return this.transaction(async client=>{const current=await this.lidarSession(client,context,id,true);const topic=createLidarBcfTopic({...input,scanSessionId:id});const updated:LidarScanSession={...current,bcfTopics:[topic,...current.bcfTopics]};await client.query('UPDATE lidar_scan_sessions SET session_data=$3,updated_at=now() WHERE tenant_id=$1 AND id=$2',[context.tenantId,id,JSON.stringify(updated)]);await this.audit(client,context,'lidar_scan',id,'bcf_created',current,updated,topic.title);return updated})}

  async publishLidarAsBuilt(context:RequestContext,id:string,createdBy:string):Promise<LidarScanSession>{return this.transaction(async client=>{const current=await this.lidarSession(client,context,id,true);const revision=buildAsBuiltRevision(current,createdBy);const updated:LidarScanSession={...current,status:'As-built gepubliceerd',asBuiltRevisions:[revision,...current.asBuiltRevisions]};await client.query('UPDATE lidar_scan_sessions SET session_data=$3,updated_at=now() WHERE tenant_id=$1 AND id=$2',[context.tenantId,id,JSON.stringify(updated)]);await this.audit(client,context,'lidar_scan',id,'as_built_published',current,updated,revision.revision);return updated})}

  async createDocument(context: RequestContext, projectId: string, input: DocumentUploadInput, file: { fileName: string; mimeType: string; data: Buffer }): Promise<ProjectDocument> {
    const documentId = randomUUID()
    const versionId = randomUUID()
    const extension = documentExtension(file.fileName, file.mimeType)
    const storageKey = `${context.tenantId}/documents/${documentId}/${versionId}.${extension}`
    await this.objectStorage.put(storageKey, file.data)
    try {
      return await this.transaction(async client => {
        const externalSubcontractor = context.roles.includes('Onderaannemer') && context.roles.every(role => ['Onderaannemer'].includes(role))
        let portalSubcontractor: Subcontractor | undefined
        if (externalSubcontractor) {
          const state = await this.blueprintState(client, context.tenantId)
          portalSubcontractor = state.subcontractors.find(item => normalizedEmail(item.email) === normalizedEmail(context.email) && item.projectIds.includes(projectId))
          if (!portalSubcontractor) throw new RepositoryError('Deze onderaannemeraccount is niet aan dit project gekoppeld', 403)
        } else await this.requireProject(client, context, projectId)
        const createdAt = new Date().toISOString()
        const version: DocumentVersion = { id: versionId, documentId, revision: 1, revisionLabel: 'R1', fileName: file.fileName.slice(0, 255), mimeType: file.mimeType, sizeBytes: file.data.length, contentDigest: createHash('sha256').update(file.data).digest('hex'), notes: input.notes, uploadedBy: context.displayName, createdAt }
        const portalLink: DocumentRecordLink | undefined = portalSubcontractor ? { id:randomUUID(),documentId,type:'Onderaannemer',recordId:portalSubcontractor.id,label:portalSubcontractor.name,createdBy:context.displayName,createdAt } : undefined
        const document: ProjectDocument = { id: documentId, projectId, title: input.title, category: input.category, status: 'Concept', immutable: false, currentVersionId: versionId, versions: [version], recipients: [], links:portalLink?[portalLink]:[], createdAt }
        await client.query(`INSERT INTO documents (tenant_id,id,project_id,title,category,status,current_version_id,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [context.tenantId, document.id, projectId, document.title, document.category, document.status, versionId, createdAt])
        await client.query(`INSERT INTO document_versions (tenant_id,id,document_id,revision,revision_label,storage_key,file_name,mime_type,size_bytes,content_digest,notes,uploaded_by,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`, [context.tenantId, version.id, documentId, version.revision, version.revisionLabel, storageKey, version.fileName, version.mimeType, version.sizeBytes, version.contentDigest, version.notes, version.uploadedBy, version.createdAt])
        if (portalLink) await client.query('INSERT INTO document_record_links (tenant_id,id,document_id,link_type,record_id,label,created_by,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [context.tenantId, portalLink.id, documentId, portalLink.type, portalLink.recordId, portalLink.label, portalLink.createdBy, portalLink.createdAt])
        await this.audit(client, context, 'document', documentId, 'created', null, document)
        await this.audit(client, context, 'document_version', versionId, 'uploaded', null, version, document.title)
        return document
      })
    } catch (error) {
      await this.objectStorage.delete(storageKey)
      throw error
    }
  }

  async createDocumentRevision(context: RequestContext, documentId: string, input: DocumentRevisionInput, file: { fileName: string; mimeType: string; data: Buffer }): Promise<ProjectDocument> {
    const versionId = randomUUID()
    const extension = documentExtension(file.fileName, file.mimeType)
    const storageKey = `${context.tenantId}/documents/${documentId}/${versionId}.${extension}`
    await this.objectStorage.put(storageKey, file.data)
    try {
      return await this.transaction(async client => {
        const current = await this.lockDocument(client, context.tenantId, documentId)
        if (current.immutable) throw new RepositoryError('Een automatisch gearchiveerd vrijgavebewijs is onveranderlijk', 409)
        const revision = Math.max(0, ...current.versions.map(version => version.revision)) + 1
        const now = new Date().toISOString()
        const version: DocumentVersion = { id: versionId, documentId, revision, revisionLabel: `R${revision}`, fileName: file.fileName.slice(0, 255), mimeType: file.mimeType, sizeBytes: file.data.length, contentDigest: createHash('sha256').update(file.data).digest('hex'), notes: input.notes, uploadedBy: input.uploadedBy, createdAt: now }
        await client.query('UPDATE document_versions SET superseded_at=$4 WHERE tenant_id=$1 AND document_id=$2 AND id=$3', [context.tenantId, documentId, current.currentVersionId, now])
        await client.query(`INSERT INTO document_versions (tenant_id,id,document_id,revision,revision_label,storage_key,file_name,mime_type,size_bytes,content_digest,notes,uploaded_by,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`, [context.tenantId, version.id, documentId, version.revision, version.revisionLabel, storageKey, version.fileName, version.mimeType, version.sizeBytes, version.contentDigest, version.notes, version.uploadedBy, version.createdAt])
        await client.query("UPDATE documents SET current_version_id=$3,status='Concept',approved_by=NULL,approved_at=NULL WHERE tenant_id=$1 AND id=$2", [context.tenantId, documentId, versionId])
        const versions = current.versions.map(item => item.id === current.currentVersionId ? { ...item, supersededAt: now } : item)
        const updated: ProjectDocument = { ...current, status: 'Concept', currentVersionId: versionId, versions: [version, ...versions], approvedBy: undefined, approvedAt: undefined }
        await this.audit(client, context, 'document', documentId, 'revision_created', current, updated, version.revisionLabel)
        await this.audit(client, context, 'document_version', versionId, 'uploaded', null, version, current.title)
        return updated
      })
    } catch (error) {
      await this.objectStorage.delete(storageKey)
      throw error
    }
  }

  async updateDocumentMetadata(context: RequestContext, documentId: string, input: DocumentMetadataInput): Promise<ProjectDocument> {
    return this.transaction(async client => {
      const current = await this.lockDocument(client, context.tenantId, documentId)
      if (current.immutable) throw new RepositoryError('Een automatisch gearchiveerd vrijgavebewijs is onveranderlijk', 409)
      await client.query('UPDATE documents SET title=$3,category=$4 WHERE tenant_id=$1 AND id=$2', [context.tenantId, documentId, input.title, input.category])
      const updated: ProjectDocument = { ...current, ...input }
      await this.audit(client, context, 'document', documentId, 'metadata_updated', current, updated)
      return updated
    })
  }

  async submitDocument(context: RequestContext, documentId: string): Promise<ProjectDocument> {
    return this.transaction(async client => {
      const current = await this.lockDocument(client, context.tenantId, documentId)
      if (current.status !== 'Concept') throw new RepositoryError('Alleen een conceptdocument kan ter goedkeuring worden ingediend', 409)
      await client.query("UPDATE documents SET status='Ter goedkeuring' WHERE tenant_id=$1 AND id=$2", [context.tenantId, documentId])
      const updated: ProjectDocument = { ...current, status: 'Ter goedkeuring' }
      await this.audit(client, context, 'document', documentId, 'submitted_for_approval', current, updated)
      return updated
    })
  }

  async approveDocument(context: RequestContext, documentId: string, approvedBy: string): Promise<ProjectDocument> {
    return this.transaction(async client => {
      const current = await this.lockDocument(client, context.tenantId, documentId)
      if (current.status !== 'Ter goedkeuring') throw new RepositoryError('Alleen een ingediend document kan worden goedgekeurd', 409)
      const approvedAt = new Date().toISOString()
      await client.query("UPDATE documents SET status='Goedgekeurd',approved_by=$3,approved_at=$4 WHERE tenant_id=$1 AND id=$2", [context.tenantId, documentId, approvedBy, approvedAt])
      const updated: ProjectDocument = { ...current, status: 'Goedgekeurd', approvedBy, approvedAt }
      await this.audit(client, context, 'document', documentId, 'approved', current, updated, approvedBy)
      return updated
    })
  }

  async distributeDocument(context: RequestContext, documentId: string, input: DocumentDistributionInput, deliveryReferences: Record<string, string> = {}): Promise<ProjectDocument> {
    return this.transaction(async client => {
      const current = await this.lockDocument(client, context.tenantId, documentId)
      if (current.status !== 'Goedgekeurd') throw new RepositoryError('Alleen een goedgekeurd document kan worden verspreid', 409)
      const existingEmails = new Set(current.recipients.filter(recipient => recipient.versionId === current.currentVersionId).map(recipient => recipient.email.toLowerCase()))
      if (input.recipients.some(recipient => existingEmails.has(recipient.email.toLowerCase()))) throw new RepositoryError('Een of meer ontvangers kregen deze revisie al', 409)
      const deliveredAt = new Date().toISOString()
      const recipients: DocumentRecipient[] = input.recipients.map(recipient => ({ id: randomUUID(), documentId, versionId: current.currentVersionId, ...recipient, deliveredAt }))
      for (const recipient of recipients) await client.query(`INSERT INTO document_recipients (tenant_id,id,document_id,version_id,name,email,delivered_at) VALUES ($1,$2,$3,$4,$5,$6,$7)`, [context.tenantId, recipient.id, documentId, recipient.versionId, recipient.name, recipient.email, deliveredAt])
      const updated: ProjectDocument = { ...current, recipients: [...recipients, ...current.recipients] }
      const providerReferences = Object.values(deliveryReferences).filter(Boolean)
      await this.audit(client, context, 'document', documentId, 'distributed', current, updated, `${recipients.length} ontvanger(s)${providerReferences.length ? ` · providerreferenties ${providerReferences.join(', ')}` : ''}`)
      return updated
    })
  }

  async getDocument(context: RequestContext, documentId: string): Promise<ProjectDocument> {
    return this.transaction(async client => {
      const document = await this.lockDocument(client, context.tenantId, documentId)
      await this.requireProject(client, context, document.projectId)
      return document
    })
  }

  async markDocumentRead(context: RequestContext, recipientId: string): Promise<DocumentRecipient> {
    return this.transaction(async client => {
      const result = await client.query<DocumentRecipientRow>('SELECT * FROM document_recipients WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [context.tenantId, recipientId])
      if (!result.rowCount) throw new RepositoryError('Documentontvanger niet gevonden', 404)
      const current = mapDocumentRecipient(result.rows[0])
      if (current.readAt) return current
      const readAt = new Date().toISOString()
      await client.query('UPDATE document_recipients SET read_at=$3 WHERE tenant_id=$1 AND id=$2', [context.tenantId, recipientId, readAt])
      const updated: DocumentRecipient = { ...current, readAt }
      await this.audit(client, context, 'document_recipient', recipientId, 'read_confirmed', current, updated, current.email)
      return updated
    })
  }

  async linkDocumentRecord(context: RequestContext, documentId: string, input: DocumentRecordLinkInput): Promise<ProjectDocument> {
    return this.transaction(async client => {
      const current = await this.lockDocument(client, context.tenantId, documentId)
      await this.requireProject(client, context, current.projectId)
      if (current.links?.some(link => link.type === input.type && link.recordId === input.recordId)) throw new RepositoryError('Dit dossierrecord is al gekoppeld', 409)
      let verifiedLabel = input.label
      if (input.type === 'Claim') {
        const state = await this.blueprintState(client, context.tenantId)
        const claim = state.projectClaims.find(item => item.id === input.recordId && item.projectId === current.projectId)
        if (!claim) throw new RepositoryError('De gekozen claim behoort niet tot dit project', 409)
        verifiedLabel = `${claim.number} · ${claim.cause}`
      }
      const link: DocumentRecordLink = { id: randomUUID(), documentId, ...input, label: verifiedLabel, createdBy: context.displayName, createdAt: new Date().toISOString() }
      await client.query('INSERT INTO document_record_links (tenant_id,id,document_id,link_type,record_id,label,created_by,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [context.tenantId, link.id, documentId, link.type, link.recordId, link.label, link.createdBy, link.createdAt])
      const updated: ProjectDocument = { ...current, links: [link, ...(current.links ?? [])] }
      await this.audit(client, context, 'document', documentId, 'record_linked', current, updated, `${link.type}: ${link.label}`)
      return updated
    })
  }

  async unlinkDocumentRecord(context: RequestContext, documentId: string, linkId: string): Promise<ProjectDocument> {
    return this.transaction(async client => {
      const current = await this.lockDocument(client, context.tenantId, documentId)
      const link = current.links?.find(item => item.id === linkId)
      if (!link) throw new RepositoryError('Documentkoppeling niet gevonden', 404)
      await client.query('DELETE FROM document_record_links WHERE tenant_id=$1 AND document_id=$2 AND id=$3', [context.tenantId, documentId, linkId])
      const updated: ProjectDocument = { ...current, links: (current.links ?? []).filter(item => item.id !== linkId) }
      await this.audit(client, context, 'document', documentId, 'record_unlinked', current, updated, `${link.type}: ${link.label}`)
      return updated
    })
  }

  async getDocumentVersionFile(context: RequestContext, versionId: string) {
    await this.requireExternalDocumentAccess(context, versionId)
    const result = await this.pool.query<DocumentVersionRow>('SELECT * FROM document_versions WHERE tenant_id=$1 AND id=$2', [context.tenantId, versionId])
    if (!result.rowCount) throw new RepositoryError('Documentversie niet gevonden', 404)
    const version = mapDocumentVersion(result.rows[0])
    const externalOnly = context.roles.length > 0 && context.roles.every(role => ['Klant', 'Onderaannemer', 'Leverancier'].includes(role))
    if (version.supersededAt && externalOnly) throw new RepositoryError('Deze documentrevisie is vervallen. Open de actuele revisie vanuit het dossier.', 409)
    const data = await this.objectStorage.get(result.rows[0].storage_key)
    await this.transaction(client => this.audit(client, context, 'document_version', versionId, 'file_opened', null, { revision:version.revisionLabel, fileName:version.fileName, sizeBytes:version.sizeBytes }, version.supersededAt ? 'Interne raadpleging vervallen revisie' : 'Actuele revisie'))
    return { version, data }
  }

  async verifyDocumentVersionIntegrity(context: RequestContext, versionId: string): Promise<DocumentIntegrityResult> {
    await this.requireExternalDocumentAccess(context, versionId)
    const found = await this.pool.query<DocumentVersionRow>('SELECT * FROM document_versions WHERE tenant_id=$1 AND id=$2', [context.tenantId, versionId])
    if (!found.rowCount) throw new RepositoryError('Documentversie niet gevonden', 404)
    const version = mapDocumentVersion(found.rows[0])
    const data = await this.objectStorage.get(found.rows[0].storage_key)
    const actualDigest = createHash('sha256').update(data).digest('hex')
    const status: DocumentIntegrityResult['status'] = !version.contentDigest ? 'Niet beschikbaar' : version.contentDigest === actualDigest ? 'Geldig' : 'Gewijzigd'
    const verification: DocumentIntegrityResult = { versionId, algorithm: 'SHA-256', expectedDigest: version.contentDigest, actualDigest, status, verifiedAt: new Date().toISOString() }
    await this.transaction(client => this.audit(client, context, 'document_version', versionId, 'integrity_verified', null, verification, status))
    return verification
  }

  async createQhseCertificate(context: RequestContext, projectId: string, input: QhseCertificateInput): Promise<QhseCertificate> {
    return this.transaction(async client => {
      const project = await client.query('SELECT id FROM projects WHERE tenant_id=$1 AND id=$2', [context.tenantId, projectId])
      if (!project.rowCount) throw new RepositoryError('Project niet gevonden', 404)
      if (input.documentId) {
        const document = await client.query<DocumentRow>('SELECT * FROM documents WHERE tenant_id=$1 AND id=$2 AND project_id=$3', [context.tenantId, input.documentId, projectId])
        if (!document.rowCount) throw new RepositoryError('Gekoppeld document behoort niet tot dit project', 409)
        if (document.rows[0].status !== 'Goedgekeurd') throw new RepositoryError('Alleen een goedgekeurd document kan als attestbewijs worden gekoppeld', 409)
      }
      const certificate: QhseCertificate = { id: randomUUID(), projectId, ...input, createdAt: new Date().toISOString() }
      await client.query(`INSERT INTO qhse_certificates (tenant_id,id,project_id,holder_type,holder_id,holder_name,certificate_type,certificate_number,issued_on,expires_on,document_id,created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`, [context.tenantId, certificate.id, projectId, certificate.holderType, certificate.holderId ?? null, certificate.holderName, certificate.certificateType, certificate.certificateNumber, certificate.issuedOn ?? null, certificate.expiresOn, certificate.documentId ?? null, certificate.createdAt])
      await this.audit(client, context, 'qhse_certificate', certificate.id, 'created', null, certificate)
      return certificate
    })
  }

  async createQhseInspection(context: RequestContext, projectId: string, input: QhseInspectionInput): Promise<QhseInspection> {
    return this.transaction(async client => {
      const project = await client.query('SELECT id FROM projects WHERE tenant_id=$1 AND id=$2', [context.tenantId, projectId])
      if (!project.rowCount) throw new RepositoryError('Project niet gevonden', 404)
      const inspection: QhseInspection = { id: randomUUID(), projectId, ...input, status: 'Open', createdAt: new Date().toISOString() }
      await client.query(`INSERT INTO qhse_inspections (tenant_id,id,project_id,inspection_date,inspection_type,inspector,location,notes,findings,status,created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, [context.tenantId, inspection.id, projectId, inspection.inspectionDate, inspection.type, inspection.inspector, inspection.location, inspection.notes, JSON.stringify(inspection.findings), inspection.status, inspection.createdAt])
      await this.audit(client, context, 'qhse_inspection', inspection.id, 'created', null, inspection)
      return inspection
    })
  }

  async resolveQhseFinding(context: RequestContext, inspectionId: string, findingId: string): Promise<QhseInspection> {
    return this.transaction(async client => {
      const result = await client.query<QhseInspectionRow>('SELECT * FROM qhse_inspections WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [context.tenantId, inspectionId])
      if (!result.rowCount) throw new RepositoryError('Veiligheidscontrole niet gevonden', 404)
      const current = mapQhseInspection(result.rows[0])
      if (current.status === 'Gesloten') throw new RepositoryError('Een gesloten veiligheidscontrole kan niet worden gewijzigd', 409)
      const finding = current.findings.find(item => item.id === findingId)
      if (!finding) throw new RepositoryError('Vaststelling niet gevonden', 404)
      if (finding.resolvedAt) return current
      const resolvedAt = new Date().toISOString()
      const updated: QhseInspection = { ...current, findings: current.findings.map(item => item.id === findingId ? { ...item, resolvedAt } : item) }
      await client.query('UPDATE qhse_inspections SET findings=$3 WHERE tenant_id=$1 AND id=$2', [context.tenantId, inspectionId, JSON.stringify(updated.findings)])
      await this.audit(client, context, 'qhse_inspection', inspectionId, 'finding_resolved', current, updated, finding.description)
      return updated
    })
  }

  async closeQhseInspection(context: RequestContext, inspectionId: string): Promise<QhseInspection> {
    return this.transaction(async client => {
      const result = await client.query<QhseInspectionRow>('SELECT * FROM qhse_inspections WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [context.tenantId, inspectionId])
      if (!result.rowCount) throw new RepositoryError('Veiligheidscontrole niet gevonden', 404)
      const current = mapQhseInspection(result.rows[0])
      if (current.status === 'Gesloten') return current
      if (current.findings.some(finding => !finding.resolvedAt)) throw new RepositoryError('Los eerst alle vaststellingen op', 409)
      const closedAt = new Date().toISOString()
      const updated: QhseInspection = { ...current, status: 'Gesloten', closedAt }
      await client.query("UPDATE qhse_inspections SET status='Gesloten',closed_at=$3 WHERE tenant_id=$1 AND id=$2", [context.tenantId, inspectionId, closedAt])
      await this.audit(client, context, 'qhse_inspection', inspectionId, 'closed', current, updated)
      return updated
    })
  }

  async createChangeOrder(context: RequestContext, projectId: string, input: ChangeOrderInput): Promise<ChangeOrder> {
    return this.transaction(async client => {
      await this.validateChangeOrderLinks(client, context.tenantId, projectId, input)
      const count = await client.query<{ count: string }>('SELECT count(*)::text AS count FROM change_orders WHERE tenant_id=$1', [context.tenantId])
      const changeOrder: ChangeOrder = {
        id: randomUUID(), number: `MW-${new Date().getFullYear()}-${String(Number(count.rows[0].count) + 1).padStart(3, '0')}`,
        projectId, ...input, total: 0, status: 'Vastgesteld', createdAt: new Date().toISOString(),
      }
      await client.query(`INSERT INTO change_orders (tenant_id,id,number,project_id,daily_report_id,work_package_id,change_date,cause,description,initiator,responsible_party,schedule_impact_days,costs,total,photo_ids,status,created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`, [context.tenantId, changeOrder.id, changeOrder.number, projectId, changeOrder.dailyReportId ?? null, changeOrder.workPackageId ?? null, changeOrder.date, changeOrder.cause, changeOrder.description, changeOrder.initiator, changeOrder.responsibleParty, changeOrder.scheduleImpactDays, JSON.stringify(changeOrder.costs), changeOrder.total, JSON.stringify(changeOrder.photoIds), changeOrder.status, changeOrder.createdAt])
      await this.audit(client, context, 'change_order', changeOrder.id, 'created', null, changeOrder)
      return changeOrder
    })
  }

  async updateChangeOrder(context: RequestContext, changeOrderId: string, input: ChangeOrderInput): Promise<ChangeOrder> {
    return this.transaction(async client => {
      const result = await client.query<ChangeOrderRow>('SELECT * FROM change_orders WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [context.tenantId, changeOrderId])
      if (!result.rowCount) throw new RepositoryError('Meerwerk niet gevonden', 404)
      const current = mapChangeOrder(result.rows[0])
      if (!['Vastgesteld', 'Berekend'].includes(current.status)) throw new RepositoryError('Een ingediend meerwerk kan niet meer worden gewijzigd', 409)
      await this.validateChangeOrderLinks(client, context.tenantId, current.projectId, input)
      await client.query(`UPDATE change_orders SET daily_report_id=$3,work_package_id=$4,change_date=$5,cause=$6,description=$7,initiator=$8,responsible_party=$9,schedule_impact_days=$10,costs=$11,total=0,status='Vastgesteld',calculated_at=NULL WHERE tenant_id=$1 AND id=$2`, [context.tenantId, changeOrderId, input.dailyReportId ?? null, input.workPackageId ?? null, input.date, input.cause, input.description, input.initiator, input.responsibleParty, input.scheduleImpactDays, JSON.stringify(input.costs)])
      await client.query('UPDATE change_orders SET photo_ids=$3 WHERE tenant_id=$1 AND id=$2', [context.tenantId, changeOrderId, JSON.stringify(input.photoIds)])
      const updated: ChangeOrder = { ...current, ...input, total: 0, status: 'Vastgesteld', calculatedAt: undefined }
      await this.audit(client, context, 'change_order', changeOrderId, 'updated', current, updated)
      return updated
    })
  }

  async calculateChangeOrder(context: RequestContext, changeOrderId: string): Promise<ChangeOrder> {
    return this.transaction(async client => {
      const current = await this.lockChangeOrder(client, context.tenantId, changeOrderId)
      if (!['Vastgesteld', 'Berekend'].includes(current.status)) throw new RepositoryError('Een ingediend meerwerk kan niet opnieuw worden berekend', 409)
      const total = changeOrderTotal(current.costs)
      if (total <= 0) throw new RepositoryError('Voeg minstens één kost toe voor de berekening', 409)
      const calculatedAt = new Date().toISOString()
      await client.query("UPDATE change_orders SET total=$3,status='Berekend',calculated_at=$4 WHERE tenant_id=$1 AND id=$2", [context.tenantId, changeOrderId, total, calculatedAt])
      const updated: ChangeOrder = { ...current, total, status: 'Berekend', calculatedAt }
      await this.audit(client, context, 'change_order', changeOrderId, 'calculated', current, updated)
      return updated
    })
  }

  async submitChangeOrder(context: RequestContext, changeOrderId: string): Promise<ChangeOrder> {
    return this.transaction(async client => {
      const current = await this.lockChangeOrder(client, context.tenantId, changeOrderId)
      if (current.status !== 'Berekend') throw new RepositoryError('Bereken het meerwerk voor indiening', 409)
      if (!current.photoIds.length && !current.dailyReportId) throw new RepositoryError('Koppel minstens een dagrapport of foto als bewijs', 409)
      const submittedAt = new Date().toISOString()
      await client.query("UPDATE change_orders SET status='Ter goedkeuring',submitted_at=$3 WHERE tenant_id=$1 AND id=$2", [context.tenantId, changeOrderId, submittedAt])
      const updated: ChangeOrder = { ...current, status: 'Ter goedkeuring', submittedAt }
      await this.audit(client, context, 'change_order', changeOrderId, 'submitted', current, updated)
      return updated
    })
  }

  async approveChangeOrder(context: RequestContext, changeOrderId: string, approvedBy: string): Promise<ChangeOrder> {
    return this.transaction(async client => {
      const current = await this.lockChangeOrder(client, context.tenantId, changeOrderId)
      await this.requireClientProject(client, context, current.projectId)
      if (context.roles.includes('Klant')) approvedBy = context.displayName
      if (current.status !== 'Ter goedkeuring') throw new RepositoryError('Alleen een ingediend meerwerk kan worden goedgekeurd', 409)
      const approvedAt = new Date().toISOString()
      await client.query("UPDATE change_orders SET status='Goedgekeurd',approved_by=$3,approved_at=$4 WHERE tenant_id=$1 AND id=$2", [context.tenantId, changeOrderId, approvedBy, approvedAt])
      const updated: ChangeOrder = { ...current, status: 'Goedgekeurd', approvedBy, approvedAt }
      await this.audit(client, context, 'change_order', changeOrderId, 'approved', current, updated, `Goedgekeurd door ${approvedBy}`)
      return updated
    })
  }

  async executeChangeOrder(context: RequestContext, changeOrderId: string): Promise<ChangeOrder> {
    return this.transitionChangeOrder(context, changeOrderId, 'Goedgekeurd', 'Uitgevoerd', 'executed_at', 'executed')
  }

  async readyChangeOrderForInvoice(context: RequestContext, changeOrderId: string): Promise<ChangeOrder> {
    return this.transitionChangeOrder(context, changeOrderId, 'Uitgevoerd', 'Klaar voor facturatie', 'ready_for_invoice_at', 'ready_for_invoice')
  }

  async createProgressStatement(context: RequestContext, projectId: string, input: ProgressStatementInput): Promise<ProgressStatement> {
    return this.transaction(async client => {
      const existing = await client.query("SELECT id FROM progress_statements WHERE tenant_id=$1 AND project_id=$2 AND status='Concept'", [context.tenantId, projectId])
      if (existing.rowCount) throw new RepositoryError('Werk eerst de bestaande conceptvorderingsstaat af', 409)
      const id = randomUUID()
      const calculated = await this.calculateProgressStatement(client, context.tenantId, projectId, input, id)
      const count = await client.query<{ count: string }>('SELECT count(*)::text AS count FROM progress_statements WHERE tenant_id=$1', [context.tenantId])
      const statement: ProgressStatement = { id, number: `VS-${new Date().getFullYear()}-${String(Number(count.rows[0].count) + 1).padStart(3, '0')}`, projectId, ...input, ...calculated, status: 'Concept', createdAt: new Date().toISOString() }
      await client.query(`INSERT INTO progress_statements (tenant_id,id,number,project_id,period_start,period_end,lines,change_order_ids,work_amount,change_order_amount,price_revision_amount,gross_amount,retention_pct,retention_amount,net_amount,status,notes,created_at,details)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`, [context.tenantId, statement.id, statement.number, projectId, statement.periodStart, statement.periodEnd, JSON.stringify(statement.lines), JSON.stringify(statement.changeOrderIds), statement.workAmount, statement.changeOrderAmount, statement.priceRevisionAmount, statement.grossAmount, statement.retentionPct, statement.retentionAmount, statement.netAmount, statement.status, statement.notes, statement.createdAt, JSON.stringify(progressStatementDetails(statement))])
      await this.audit(client, context, 'progress_statement', statement.id, 'created', null, statement)
      return statement
    })
  }

  async updateProgressStatement(context: RequestContext, statementId: string, input: ProgressStatementInput): Promise<ProgressStatement> {
    return this.transaction(async client => {
      const result = await client.query<ProgressStatementRow>('SELECT * FROM progress_statements WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [context.tenantId, statementId])
      if (!result.rowCount) throw new RepositoryError('Vorderingsstaat niet gevonden', 404)
      const current = mapProgressStatement(result.rows[0])
      if (current.status !== 'Concept') throw new RepositoryError('Alleen een conceptvorderingsstaat kan worden gewijzigd', 409)
      const calculated = await this.calculateProgressStatement(client, context.tenantId, current.projectId, input, statementId)
      const updated: ProgressStatement = { ...current, ...input, ...calculated }
      await client.query(`UPDATE progress_statements SET period_start=$3,period_end=$4,lines=$5,change_order_ids=$6,work_amount=$7,change_order_amount=$8,price_revision_amount=$9,gross_amount=$10,retention_pct=$11,retention_amount=$12,net_amount=$13,notes=$14,details=$15 WHERE tenant_id=$1 AND id=$2`, [context.tenantId, statementId, updated.periodStart, updated.periodEnd, JSON.stringify(updated.lines), JSON.stringify(updated.changeOrderIds), updated.workAmount, updated.changeOrderAmount, updated.priceRevisionAmount, updated.grossAmount, updated.retentionPct, updated.retentionAmount, updated.netAmount, updated.notes, JSON.stringify(progressStatementDetails(updated))])
      await this.audit(client, context, 'progress_statement', statementId, 'updated', current, updated)
      return updated
    })
  }

  async submitProgressStatement(context: RequestContext, statementId: string): Promise<ProgressStatement> {
    return this.transaction(async client => {
      const current = await this.lockProgressStatement(client, context.tenantId, statementId)
      if (current.status !== 'Concept') throw new RepositoryError('Deze vorderingsstaat is al ingediend', 409)
      if (current.netAmount <= 0) throw new RepositoryError('Het netto te vorderen bedrag moet positief zijn', 409)
      const bimLines = current.lines.filter(line => line.measurementMethod === 'BIM')
      if (bimLines.some(line => !line.bimEvidence || line.bimEvidence.status !== 'Gecontroleerd')) throw new RepositoryError('Iedere BIM-vorderingsregel vereist een gecontroleerd meetbewijs', 409)
      if (bimLines.length && !current.qualityChecklist?.bimModelValidated) throw new RepositoryError('Bevestig de BIM-versie- en clashcontrole voor indiening', 409)
      if (current.changeOrderIds.length) {
        const changes = await client.query<ChangeOrderRow>('SELECT * FROM change_orders WHERE tenant_id=$1 AND id=ANY($2::uuid[]) FOR UPDATE', [context.tenantId, current.changeOrderIds])
        if (changes.rowCount !== current.changeOrderIds.length || changes.rows.some(row => row.status !== 'Klaar voor facturatie' || row.progress_statement_id)) throw new RepositoryError('Een geselecteerd meerwerk is niet meer beschikbaar voor facturatie', 409)
        await client.query("UPDATE change_orders SET status='Opgenomen in vorderingsstaat',progress_statement_id=$3 WHERE tenant_id=$1 AND id=ANY($2::uuid[])", [context.tenantId, current.changeOrderIds, statementId])
        for (const row of changes.rows) {
          const changeOrder = mapChangeOrder(row)
          await this.audit(client, context, 'change_order', changeOrder.id, 'included_in_progress_statement', changeOrder, { ...changeOrder, status: 'Opgenomen in vorderingsstaat', progressStatementId: statementId }, current.number)
        }
      }
      const submittedAt = new Date().toISOString()
      await client.query("UPDATE progress_statements SET status='Ingediend',submitted_at=$3 WHERE tenant_id=$1 AND id=$2", [context.tenantId, statementId, submittedAt])
      const updated: ProgressStatement = { ...current, status: 'Ingediend', submittedAt }
      await this.audit(client, context, 'progress_statement', statementId, 'submitted', current, updated)
      return updated
    })
  }

  async approveProgressStatement(context: RequestContext, statementId: string, approvedBy: string): Promise<ProgressStatement> {
    return this.transaction(async client => {
      const current = await this.lockProgressStatement(client, context.tenantId, statementId)
      await this.requireClientProject(client, context, current.projectId)
      if (context.roles.includes('Klant')) approvedBy = context.displayName
      if (current.status !== 'Ingediend') throw new RepositoryError('Alleen een ingediende vorderingsstaat kan worden goedgekeurd', 409)
      const approvedAt = new Date().toISOString()
      await client.query("UPDATE progress_statements SET status='Goedgekeurd',approved_by=$3,approved_at=$4 WHERE tenant_id=$1 AND id=$2", [context.tenantId, statementId, approvedBy, approvedAt])
      const updated: ProgressStatement = { ...current, status: 'Goedgekeurd', approvedBy, approvedAt }
      await this.audit(client, context, 'progress_statement', statementId, 'approved', current, updated, `Goedgekeurd door ${approvedBy}`)
      return updated
    })
  }

  async createSalesInvoice(context: RequestContext, statementId: string, input: SalesInvoiceInput): Promise<{ statement: ProgressStatement; invoice: SalesInvoice }> {
    return this.transaction(async client => {
      const current = await this.lockProgressStatement(client, context.tenantId, statementId)
      if (current.status !== 'Goedgekeurd') throw new RepositoryError('Een goedgekeurde vorderingsstaat is vereist voor facturatie', 409)
      const existing = await client.query('SELECT id FROM sales_invoices WHERE tenant_id=$1 AND progress_statement_id=$2', [context.tenantId, statementId])
      if (existing.rowCount) throw new RepositoryError('Voor deze vorderingsstaat bestaat al een factuurconcept', 409)
      const project = await client.query<ProjectRow>('SELECT * FROM projects WHERE tenant_id=$1 AND id=$2', [context.tenantId, current.projectId])
      const legalEntityId = project.rows[0]?.legal_entity_id
      if (!legalEntityId) throw new RepositoryError('Wijs het project eerst toe aan een juridische entiteit', 409)
      const entityResult = await client.query<LegalEntityRow>('SELECT * FROM legal_entities WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [context.tenantId, legalEntityId])
      if (!entityResult.rowCount) throw new RepositoryError('Juridische entiteit niet gevonden', 404)
      const entity = mapLegalEntity(entityResult.rows[0])
      const vatPct = input.vatPct ?? entity.defaultVatPct
      const dueDate = input.dueDate ?? addDays(input.invoiceDate, entity.paymentTermsDays)
      const vatAmount = cents(current.netAmount * vatPct / 100)
      const invoice: SalesInvoice = { id: randomUUID(), number: `${entity.invoicePrefix}-${input.invoiceDate.slice(0, 4)}-${String(entity.nextInvoiceNumber).padStart(5, '0')}`, legalEntityId, projectId: current.projectId, progressStatementId: statementId, invoiceDate: input.invoiceDate, dueDate, vatPct, subtotal: current.netAmount, vatAmount, total: cents(current.netAmount + vatAmount), status: 'Concept', createdAt: new Date().toISOString() }
      await client.query(`INSERT INTO sales_invoices (tenant_id,id,number,legal_entity_id,project_id,progress_statement_id,invoice_date,due_date,subtotal,vat_pct,vat_amount,total,status,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`, [context.tenantId, invoice.id, invoice.number, legalEntityId, invoice.projectId, statementId, invoice.invoiceDate, invoice.dueDate, invoice.subtotal, invoice.vatPct, invoice.vatAmount, invoice.total, invoice.status, invoice.createdAt])
      await client.query('UPDATE legal_entities SET next_invoice_number=next_invoice_number+1 WHERE tenant_id=$1 AND id=$2', [context.tenantId, legalEntityId])
      await client.query("UPDATE progress_statements SET status='Factuurconcept',invoice_id=$3 WHERE tenant_id=$1 AND id=$2", [context.tenantId, statementId, invoice.id])
      const statement: ProgressStatement = { ...current, status: 'Factuurconcept', invoiceId: invoice.id }
      await this.audit(client, context, 'progress_statement', statementId, 'invoice_created', current, statement, invoice.number)
      await this.audit(client, context, 'sales_invoice', invoice.id, 'created_from_progress_statement', null, invoice)
      return { statement, invoice }
    })
  }

  async issueSalesInvoice(context: RequestContext, invoiceId: string, input: SalesInvoiceIssueInput): Promise<SalesInvoice> {
    return this.transaction(async client => {
      const current = await this.lockSalesInvoice(client, context.tenantId, invoiceId)
      if (current.status !== 'Concept') throw new RepositoryError('Alleen een conceptfactuur kan worden verzonden', 409)
      const issuedAt = new Date().toISOString()
      await client.query("UPDATE sales_invoices SET status='Openstaand',issued_at=$3,issued_by=$4 WHERE tenant_id=$1 AND id=$2", [context.tenantId, invoiceId, issuedAt, input.issuedBy])
      const updated: SalesInvoice = { ...current, status: 'Openstaand', issuedAt, issuedBy: input.issuedBy }
      await this.audit(client, context, 'sales_invoice', invoiceId, 'issued', current, updated, `Verzonden door ${input.issuedBy}`)
      return updated
    })
  }

  async salesInvoiceExportContext(context: RequestContext, invoiceId: string): Promise<InvoiceExportContext> {
    const invoiceResult = await this.pool.query<SalesInvoiceRow>('SELECT * FROM sales_invoices WHERE tenant_id=$1 AND id=$2', [context.tenantId, invoiceId])
    if (!invoiceResult.rowCount) throw new RepositoryError('Verkoopfactuur niet gevonden', 404)
    const invoice = mapSalesInvoice(invoiceResult.rows[0])
    if (!this.canAccessEntity(context, invoice.legalEntityId)) throw new RepositoryError('Je hebt geen toegang tot deze juridische entiteit', 403)
    const [projectResult, entityResult, statementResult] = await Promise.all([
      this.pool.query<ProjectRow>('SELECT * FROM projects WHERE tenant_id=$1 AND id=$2', [context.tenantId, invoice.projectId]),
      this.pool.query<LegalEntityRow>('SELECT * FROM legal_entities WHERE tenant_id=$1 AND id=$2', [context.tenantId, invoice.legalEntityId]),
      this.pool.query<ProgressStatementRow>('SELECT * FROM progress_statements WHERE tenant_id=$1 AND id=$2', [context.tenantId, invoice.progressStatementId]),
    ])
    if (!projectResult.rowCount || !entityResult.rowCount || !statementResult.rowCount) throw new RepositoryError('Factuurcontext is onvolledig', 409)
    const project = this.mapProject(projectResult.rows[0])
    const customerResult = await this.pool.query<OrganizationRow>('SELECT * FROM organizations WHERE tenant_id=$1 AND id=$2', [context.tenantId, project.organizationId])
    if (!customerResult.rowCount) throw new RepositoryError('Factuurklant niet gevonden', 409)
    return { invoice, project, entity: mapLegalEntity(entityResult.rows[0]), customer: mapOrganization(customerResult.rows[0]), statement: mapProgressStatement(statementResult.rows[0]) }
  }

  async recordPeppolValidation(context: RequestContext, invoiceId: string, input: PeppolValidationReportInput, documentDigest: string): Promise<PeppolValidationReport> {
    return this.transaction(async client => {
      const invoice = await this.lockSalesInvoice(client, context.tenantId, invoiceId)
      if (!this.canAccessEntity(context, invoice.legalEntityId)) throw new RepositoryError('Je hebt geen toegang tot deze juridische entiteit', 403)
      const report: PeppolValidationReport = { id: randomUUID(), invoiceId, documentDigest, ...input, validatedAt: new Date().toISOString() }
      await client.query('INSERT INTO peppol_validation_reports (tenant_id,id,invoice_id,document_digest,status,source,engine,profile,network_ready,issues,validated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)', [context.tenantId, report.id, invoiceId, report.documentDigest, report.status, report.source, report.engine, report.profile, report.networkReady, JSON.stringify(report.issues), report.validatedAt])
      await this.audit(client, context, 'sales_invoice', invoiceId, 'peppol_validated', null, report, `${report.source}: ${report.status}`)
      return report
    })
  }

  async beginPeppolAcceptanceRun(context: RequestContext, invoiceId: string, documentDigest: string): Promise<{ run: PeppolAcceptanceRun; shouldExecute: boolean }> {
    return this.transaction(async client => {
      const invoice = await this.lockSalesInvoice(client, context.tenantId, invoiceId)
      if (!this.canAccessEntity(context, invoice.legalEntityId)) throw new RepositoryError('Je hebt geen toegang tot deze juridische entiteit', 403)
      if (invoice.status === 'Concept') throw new RepositoryError('Geef de verkoopfactuur eerst uit voordat je een acceptatietest start', 409)
      const active = await client.query<PeppolAcceptanceRunRow>("SELECT * FROM peppol_acceptance_runs WHERE tenant_id=$1 AND invoice_id=$2 AND status IN ('In uitvoering','In opvolging','Geslaagd') ORDER BY started_at DESC LIMIT 1 FOR UPDATE", [context.tenantId, invoiceId])
      if (active.rowCount) return { run: mapPeppolAcceptanceRun(active.rows[0]), shouldExecute: false }
      const startedAt = new Date().toISOString()
      const run: PeppolAcceptanceRun = {
        id: randomUUID(), invoiceId, status: 'In uitvoering', documentDigest,
        steps: [{ id: 'configuration', label: 'Productieconfiguratie', status: 'Geslaagd', message: 'Validator, accesspoint, webhook en statusmonitor zijn actief.', at: startedAt }],
        startedBy: context.userId, startedAt,
      }
      await client.query('INSERT INTO peppol_acceptance_runs (tenant_id,id,invoice_id,status,document_digest,steps,started_by,started_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [context.tenantId, run.id, invoiceId, run.status, documentDigest, JSON.stringify(run.steps), run.startedBy, startedAt])
      await this.audit(client, context, 'peppol_acceptance_run', run.id, 'started', null, run, invoice.number)
      return { run, shouldExecute: true }
    })
  }

  async updatePeppolAcceptanceRun(context: RequestContext, runId: string, update: Pick<PeppolAcceptanceRun, 'status' | 'steps'> & { validationReportId?: string; deliveryId?: string }): Promise<PeppolAcceptanceRun> {
    return this.transaction(async client => {
      const found = await client.query<PeppolAcceptanceRunRow>('SELECT * FROM peppol_acceptance_runs WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [context.tenantId, runId])
      if (!found.rowCount) throw new RepositoryError('Peppol-acceptatierun niet gevonden', 404)
      const current = mapPeppolAcceptanceRun(found.rows[0])
      const invoice = await this.lockSalesInvoice(client, context.tenantId, current.invoiceId)
      if (!this.canAccessEntity(context, invoice.legalEntityId)) throw new RepositoryError('Je hebt geen toegang tot deze juridische entiteit', 403)
      const completedAt = update.status === 'Geslaagd' || update.status === 'Mislukt' ? new Date().toISOString() : undefined
      const run: PeppolAcceptanceRun = { ...current, ...update, validationReportId: update.validationReportId ?? current.validationReportId, deliveryId: update.deliveryId ?? current.deliveryId, completedAt }
      await client.query('UPDATE peppol_acceptance_runs SET status=$3,validation_report_id=$4,delivery_id=$5,steps=$6,completed_at=$7 WHERE tenant_id=$1 AND id=$2', [context.tenantId, runId, run.status, run.validationReportId ?? null, run.deliveryId ?? null, JSON.stringify(run.steps), completedAt ?? null])
      await this.audit(client, context, 'peppol_acceptance_run', run.id, 'updated', current, run, `${invoice.number}: ${run.status}`)
      return run
    })
  }

  async getPeppolAcceptanceRun(context: RequestContext, runId: string): Promise<PeppolAcceptanceRun> {
    const found = await this.pool.query<PeppolAcceptanceRunRow>('SELECT * FROM peppol_acceptance_runs WHERE tenant_id=$1 AND id=$2', [context.tenantId, runId])
    if (!found.rowCount) throw new RepositoryError('Peppol-acceptatierun niet gevonden', 404)
    const run = mapPeppolAcceptanceRun(found.rows[0])
    const invoice = await this.lockSalesInvoice(this.pool, context.tenantId, run.invoiceId)
    if (!this.canAccessEntity(context, invoice.legalEntityId)) throw new RepositoryError('Je hebt geen toegang tot deze juridische entiteit', 403)
    return run
  }

  async releasePeppolAcceptanceRun(context: RequestContext, runId: string, input: PeppolAcceptanceReleaseInput): Promise<PeppolAcceptanceRun> {
    return this.transaction(async client => {
      const found = await client.query<PeppolAcceptanceRunRow>('SELECT * FROM peppol_acceptance_runs WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [context.tenantId, runId])
      if (!found.rowCount) throw new RepositoryError('Peppol-acceptatierun niet gevonden', 404)
      const current = mapPeppolAcceptanceRun(found.rows[0])
      const invoice = await this.lockSalesInvoice(client, context.tenantId, current.invoiceId)
      if (!this.canAccessEntity(context, invoice.legalEntityId)) throw new RepositoryError('Je hebt geen toegang tot deze juridische entiteit', 403)
      if (current.releasedAt) return current
      if (current.status !== 'Geslaagd' || !current.steps.some(step => step.id === 'delivery' && step.status === 'Geslaagd')) throw new RepositoryError('Alleen een aantoonbaar afgeleverde acceptatierun kan voor productie worden vrijgegeven', 409)
      const missingChecks = this.peppolIntegrationChecks.filter(check => !check.ready)
      if (this.peppolIntegrationChecks.length < 6 || missingChecks.length) throw new RepositoryError(`Productievrijgave geblokkeerd: ${missingChecks.map(check => check.label).join(', ') || 'de volledige readinesscontrole ontbreekt'}`, 409)
      const releasedAt = new Date().toISOString()
      const run: PeppolAcceptanceRun = { ...current, releasedBy: input.releasedBy, releasedAt, releaseNotes: input.notes }
      await client.query('UPDATE peppol_acceptance_runs SET released_by=$3,released_at=$4,release_notes=$5 WHERE tenant_id=$1 AND id=$2', [context.tenantId, runId, run.releasedBy, releasedAt, run.releaseNotes])
      await this.audit(client, context, 'peppol_acceptance_run', run.id, 'released_for_production', current, run, `${invoice.number}: ${input.releasedBy}`)
      return run
    })
  }

  async archivePeppolAcceptanceReport(context: RequestContext, runId: string, pdf: Buffer): Promise<ProjectDocument> {
    let storageKey: string | undefined
    try {
      return await this.transaction(async client => {
        const found = await client.query<PeppolAcceptanceRunRow>('SELECT * FROM peppol_acceptance_runs WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [context.tenantId, runId])
        if (!found.rowCount) throw new RepositoryError('Peppol-acceptatierun niet gevonden', 404)
        const run = mapPeppolAcceptanceRun(found.rows[0])
        if (!run.releasedAt || !run.releasedBy || run.status !== 'Geslaagd') throw new RepositoryError('Alleen een vrijgegeven acceptatierun kan worden gearchiveerd', 409)
        const invoice = await this.lockSalesInvoice(client, context.tenantId, run.invoiceId)
        if (!this.canAccessEntity(context, invoice.legalEntityId)) throw new RepositoryError('Je hebt geen toegang tot deze juridische entiteit', 403)
        const existing = await client.query<DocumentRow>('SELECT * FROM documents WHERE tenant_id=$1 AND peppol_acceptance_run_id=$2 FOR UPDATE', [context.tenantId, runId])
        if (existing.rowCount) return this.lockDocument(client, context.tenantId, existing.rows[0].id)

        const documentId = randomUUID()
        const versionId = randomUUID()
        storageKey = `${context.tenantId}/documents/${documentId}/${versionId}.pdf`
        await this.objectStorage.put(storageKey, pdf)
        const fileNumber = invoice.number.replace(/[^A-Za-z0-9._-]+/g, '-')
        const notes = `Automatisch en onveranderlijk Peppol-vrijgavebewijs · acceptatierun ${run.id} · documentdigest ${run.documentDigest}`
        const version: DocumentVersion = { id: versionId, documentId, revision: 1, revisionLabel: 'R1', fileName: `Peppol-acceptatie-${fileNumber}.pdf`, mimeType: 'application/pdf', sizeBytes: pdf.length, contentDigest: createHash('sha256').update(pdf).digest('hex'), notes, uploadedBy: run.releasedBy, createdAt: run.releasedAt }
        const document: ProjectDocument = { id: documentId, projectId: invoice.projectId, legalEntityId: invoice.legalEntityId, salesInvoiceId: invoice.id, peppolAcceptanceRunId: run.id, title: `Peppol-productievrijgave ${invoice.number}`, category: 'Verslag', status: 'Goedgekeurd', immutable: true, currentVersionId: versionId, versions: [version], recipients: [], approvedBy: run.releasedBy, approvedAt: run.releasedAt, createdAt: run.releasedAt }
        await client.query(`INSERT INTO documents (tenant_id,id,project_id,legal_entity_id,sales_invoice_id,peppol_acceptance_run_id,title,category,status,immutable,current_version_id,approved_by,approved_at,created_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`, [context.tenantId, document.id, document.projectId, document.legalEntityId ?? null, document.salesInvoiceId, document.peppolAcceptanceRunId, document.title, document.category, document.status, true, versionId, document.approvedBy, document.approvedAt, document.createdAt])
        await client.query(`INSERT INTO document_versions (tenant_id,id,document_id,revision,revision_label,storage_key,file_name,mime_type,size_bytes,content_digest,notes,uploaded_by,created_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`, [context.tenantId, version.id, document.id, version.revision, version.revisionLabel, storageKey, version.fileName, version.mimeType, version.sizeBytes, version.contentDigest, version.notes, version.uploadedBy, version.createdAt])
        await this.audit(client, context, 'document', document.id, 'peppol_acceptance_archived', null, document, `${invoice.number}: ${run.id}`)
        await this.audit(client, context, 'document_version', version.id, 'uploaded', null, version, document.title)
        return document
      })
    } catch (error) {
      if (storageKey) await this.objectStorage.delete(storageKey)
      throw error
    }
  }

  async assertPeppolProductionReleased(context: RequestContext): Promise<PeppolProductionGate> {
    const productionGate = await this.loadPeppolProductionGate(this.pool, context.tenantId)
    if (!productionGate.released) throw new RepositoryError('Peppol-productieverzending is geblokkeerd: voltooi en geef eerst een geslaagde acceptatierun vrij', 409)
    const missingChecks = this.peppolIntegrationChecks.filter(check => !check.ready)
    if (this.peppolIntegrationChecks.length < 6 || missingChecks.length) throw new RepositoryError(`Peppol-productieverzending is geblokkeerd: ${missingChecks.map(check => check.label).join(', ') || 'de volledige readinesscontrole ontbreekt'}`, 409)
    return productionGate
  }

  async beginPeppolDelivery(context: RequestContext, invoiceId: string, documentDigest: string): Promise<{ delivery: PeppolDelivery; shouldSend: boolean }> {
    return this.transaction(async client => {
      const invoice = await this.lockSalesInvoice(client, context.tenantId, invoiceId)
      if (!this.canAccessEntity(context, invoice.legalEntityId)) throw new RepositoryError('Je hebt geen toegang tot deze juridische entiteit', 403)
      if (invoice.status === 'Concept') throw new RepositoryError('Geef de verkoopfactuur eerst uit voordat je ze via Peppol verzendt', 409)
      const validation = await client.query<PeppolValidationReportRow>("SELECT * FROM peppol_validation_reports WHERE tenant_id=$1 AND invoice_id=$2 AND document_digest=$3 AND source='Extern' AND status='Geslaagd' AND network_ready=true ORDER BY validated_at DESC LIMIT 1", [context.tenantId, invoiceId, documentDigest])
      if (!validation.rowCount) throw new RepositoryError('Een geslaagde externe Peppol-validatie van de huidige factuurversie is vereist voor verzending', 409)
      const existing = await client.query<PeppolDeliveryRow>('SELECT * FROM peppol_deliveries WHERE tenant_id=$1 AND invoice_id=$2 ORDER BY requested_at DESC LIMIT 1 FOR UPDATE', [context.tenantId, invoiceId])
      if (existing.rowCount) {
        const current = mapPeppolDelivery(existing.rows[0])
        if (['In wachtrij', 'Geaccepteerd', 'Afgeleverd'].includes(current.status)) return { delivery: current, shouldSend: false }
        const updatedAt = new Date().toISOString()
        const delivery: PeppolDelivery = { ...current, status: 'In wachtrij', message: 'Nieuwe verzendpoging gestart', updatedAt, events: [...current.events, { status: 'In wachtrij', message: 'Nieuwe verzendpoging gestart', at: updatedAt }] }
        await client.query("UPDATE peppol_deliveries SET status='In wachtrij',message=$3,events=$4,updated_at=$5 WHERE tenant_id=$1 AND id=$2", [context.tenantId, current.id, delivery.message, JSON.stringify(delivery.events), updatedAt])
        await this.audit(client, context, 'peppol_delivery', delivery.id, 'retried', current, delivery, invoice.number)
        return { delivery, shouldSend: true }
      }
      const requestedAt = new Date().toISOString()
      const delivery: PeppolDelivery = { id: randomUUID(), invoiceId, validationReportId: validation.rows[0].id, status: 'In wachtrij', provider: 'In afwachting', idempotencyKey: `peppol:${context.tenantId}:${invoiceId}`, attempts: 0, message: 'Verzending voorbereid', events: [{ status: 'In wachtrij', message: 'Verzending voorbereid', at: requestedAt }], requestedAt, updatedAt: requestedAt }
      await client.query('INSERT INTO peppol_deliveries (tenant_id,id,invoice_id,validation_report_id,status,provider,idempotency_key,attempts,message,events,requested_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)', [context.tenantId, delivery.id, invoiceId, delivery.validationReportId, delivery.status, delivery.provider, delivery.idempotencyKey, delivery.attempts, delivery.message, JSON.stringify(delivery.events), requestedAt, requestedAt])
      await this.audit(client, context, 'peppol_delivery', delivery.id, 'queued', null, delivery, invoice.number)
      return { delivery, shouldSend: true }
    })
  }

  private peppolTransitionAllowed(current: PeppolDelivery['status'], next: PeppolDelivery['status']) {
    if (current === next) return true
    if (current === 'Afgeleverd' || current === 'Geweigerd') return false
    if (current === 'Geaccepteerd') return ['Afgeleverd', 'Geweigerd', 'Fout'].includes(next)
    return true
  }

  private async peppolSystemContext(client: SqlClient, row: SystemPeppolDeliveryRow): Promise<RequestContext> {
    const auditUser = await client.query<PeppolAuditUserRow>("SELECT user_id FROM audit_log WHERE tenant_id=$1 AND entity_type='peppol_delivery' AND entity_id=$2 ORDER BY created_at LIMIT 1", [row.tenant_id, row.id])
    if (!auditUser.rowCount) throw new RepositoryError('Initiator van de Peppol-verzending ontbreekt', 409)
    return { tenantId: row.tenant_id, userId: auditUser.rows[0].user_id, displayName: 'Peppol-monitor', email: '', roles: [], allLegalEntities: true }
  }

  private async enqueuePeppolAlertNotifications(client: SqlClient, context: RequestContext, alert: PeppolAlert, kind: PeppolNotification['kind'], cycleKey: string) {
    let queued = 0
    const createdAt = new Date().toISOString()
    const settings = await this.loadPeppolNotificationSettings(client, context.tenantId)
    const targets: PeppolNotificationTarget[] = [
      ...settings.emailRecipients.map(destination => ({ channel: 'E-mail' as const, destination })),
      ...settings.teamsTargets.map(destination => ({ channel: 'Teams' as const, destination })),
    ]
    const deliverableTargets = settings.connectorConfigured ? targets.filter(target => settings.connectorChannels.includes(target.channel)) : targets
    for (const target of deliverableTargets) {
      const eventKey = `peppol-alert:${alert.id}:${kind}:${cycleKey}:${target.channel}:${target.destination}`
      const existing = await client.query('SELECT id FROM peppol_notification_outbox WHERE tenant_id=$1 AND event_key=$2', [context.tenantId, eventKey])
      if (existing.rows.length) continue
      const notification: PeppolNotification = { id: randomUUID(), alertId: alert.id, channel: target.channel, kind, destination: target.destination, subject: `${alert.severity} Peppol: ${alert.type}`, message: alert.message, status: 'In wachtrij', attempts: 0, nextAttemptAt: createdAt, createdAt, updatedAt: createdAt }
      const inserted = await client.query('INSERT INTO peppol_notification_outbox (tenant_id,id,alert_id,event_key,channel,kind,destination,subject,message,status,attempts,next_attempt_at,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) ON CONFLICT (tenant_id,event_key) DO NOTHING RETURNING id', [context.tenantId, notification.id, alert.id, eventKey, notification.channel, notification.kind, notification.destination, notification.subject, notification.message, notification.status, notification.attempts, notification.nextAttemptAt, notification.createdAt, notification.updatedAt])
      if (!inserted.rows.length) continue
      await this.audit(client, context, 'peppol_notification', notification.id, 'queued', null, notification, `${notification.channel}: ${notification.destination}`)
      queued += 1
    }
    return queued
  }

  private async upsertPeppolAlert(client: SqlClient, context: RequestContext, delivery: PeppolDelivery, type: PeppolAlert['type'], severity: PeppolAlert['severity'], message: string) {
    const existingResult = await client.query<PeppolAlertRow>('SELECT * FROM peppol_alerts WHERE tenant_id=$1 AND delivery_id=$2 AND type=$3 FOR UPDATE', [context.tenantId, delivery.id, type])
    const updatedAt = new Date().toISOString()
    if (existingResult.rowCount) {
      const current = mapPeppolAlert(existingResult.rows[0])
      if (current.status !== 'Opgelost' && current.message === message && current.severity === severity) return current
      const alert: PeppolAlert = { ...current, severity, status: 'Open', message, acknowledgedBy: undefined, acknowledgedAt: undefined, resolvedAt: undefined, updatedAt }
      await client.query("UPDATE peppol_alerts SET severity=$3,status='Open',message=$4,acknowledged_by=NULL,acknowledged_at=NULL,resolved_at=NULL,updated_at=$5 WHERE tenant_id=$1 AND id=$2", [context.tenantId, alert.id, severity, message, updatedAt])
      await this.audit(client, context, 'peppol_alert', alert.id, current.status === 'Opgelost' ? 'reopened' : 'updated', current, alert, message)
      await this.enqueuePeppolAlertNotifications(client, context, alert, 'Nieuwe waarschuwing', updatedAt)
      return alert
    }
    const alert: PeppolAlert = { id: randomUUID(), deliveryId: delivery.id, invoiceId: delivery.invoiceId, type, severity, status: 'Open', message, createdAt: updatedAt, updatedAt }
    await client.query('INSERT INTO peppol_alerts (tenant_id,id,delivery_id,invoice_id,type,severity,status,message,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [context.tenantId, alert.id, alert.deliveryId, alert.invoiceId, alert.type, alert.severity, alert.status, alert.message, alert.createdAt, alert.updatedAt])
    await this.audit(client, context, 'peppol_alert', alert.id, 'created', null, alert, message)
    await this.enqueuePeppolAlertNotifications(client, context, alert, 'Nieuwe waarschuwing', alert.createdAt)
    return alert
  }

  private async resolvePeppolAlerts(client: SqlClient, context: RequestContext, delivery: PeppolDelivery, reason: string) {
    const alerts = await client.query<PeppolAlertRow>("SELECT * FROM peppol_alerts WHERE tenant_id=$1 AND delivery_id=$2 AND status<>'Opgelost' FOR UPDATE", [context.tenantId, delivery.id])
    const resolvedAt = new Date().toISOString()
    for (const row of alerts.rows) {
      const current = mapPeppolAlert(row)
      const alert: PeppolAlert = { ...current, status: 'Opgelost', resolvedAt, updatedAt: resolvedAt }
      await client.query("UPDATE peppol_alerts SET status='Opgelost',resolved_at=$3,updated_at=$3 WHERE tenant_id=$1 AND id=$2", [context.tenantId, alert.id, resolvedAt])
      const pendingNotifications = await client.query<PeppolNotificationRow>("SELECT * FROM peppol_notification_outbox WHERE tenant_id=$1 AND alert_id=$2 AND status IN ('In wachtrij','Mislukt') FOR UPDATE", [context.tenantId, alert.id])
      for (const notificationRow of pendingNotifications.rows) {
        const currentNotification = mapPeppolNotification(notificationRow)
        const notification: PeppolNotification = { ...currentNotification, status: 'Geannuleerd', lastError: reason, updatedAt: resolvedAt }
        await client.query("UPDATE peppol_notification_outbox SET status='Geannuleerd',last_error=$3,updated_at=$4 WHERE tenant_id=$1 AND id=$2", [context.tenantId, notification.id, reason, resolvedAt])
        await this.audit(client, context, 'peppol_notification', notification.id, 'cancelled', currentNotification, notification, reason)
      }
      await this.audit(client, context, 'peppol_alert', alert.id, 'resolved', current, alert, reason)
    }
  }

  private async syncPeppolAlerts(client: SqlClient, context: RequestContext, delivery: PeppolDelivery) {
    if (delivery.status === 'Fout') await this.upsertPeppolAlert(client, context, delivery, 'Verzending mislukt', 'Hoog', delivery.message)
    if (delivery.status === 'Geweigerd') await this.upsertPeppolAlert(client, context, delivery, 'Geweigerd', 'Kritiek', delivery.message)
    if (delivery.status === 'Geaccepteerd' || delivery.status === 'Afgeleverd') await this.resolvePeppolAlerts(client, context, delivery, `Levering hersteld: ${delivery.status}`)
  }

  private async syncPeppolAcceptanceRuns(client: SqlClient, context: RequestContext, delivery: PeppolDelivery) {
    const runs = await client.query<PeppolAcceptanceRunRow>("SELECT * FROM peppol_acceptance_runs WHERE tenant_id=$1 AND delivery_id=$2 AND status IN ('In uitvoering','In opvolging') FOR UPDATE", [context.tenantId, delivery.id])
    for (const row of runs.rows) {
      const current = mapPeppolAcceptanceRun(row)
      const terminalFailure = delivery.status === 'Fout' || delivery.status === 'Geweigerd'
      const delivered = delivery.status === 'Afgeleverd'
      const step: PeppolAcceptanceStep = {
        id: 'delivery', label: 'Netwerkaflevering',
        status: delivered ? 'Geslaagd' : terminalFailure ? 'Mislukt' : 'In afwachting',
        message: delivery.message,
        at: delivery.updatedAt,
        reference: delivery.providerReference,
      }
      const steps = [...current.steps.filter(item => item.id !== 'delivery'), step]
      const status: PeppolAcceptanceRun['status'] = delivered ? 'Geslaagd' : terminalFailure ? 'Mislukt' : 'In opvolging'
      const completedAt = delivered || terminalFailure ? delivery.updatedAt : null
      const run: PeppolAcceptanceRun = { ...current, status, steps, completedAt: completedAt ?? undefined }
      await client.query('UPDATE peppol_acceptance_runs SET status=$3,steps=$4,completed_at=$5 WHERE tenant_id=$1 AND id=$2', [context.tenantId, run.id, status, JSON.stringify(steps), completedAt])
      await this.audit(client, context, 'peppol_acceptance_run', run.id, delivered ? 'completed' : terminalFailure ? 'failed' : 'status_updated', current, run, delivery.message)
    }
  }

  private async updatePeppolDelivery(client: SqlClient, context: RequestContext, current: PeppolDelivery, invoiceNumber: string, result: PeppolTransportResult, countAttempt: boolean, auditAction: string) {
    if (current.providerReference && result.providerReference && current.providerReference !== result.providerReference) throw new RepositoryError('De providerreferentie hoort niet bij deze Peppol-verzending', 409)
    if (result.eventId && current.events.some(event => event.providerEventId === result.eventId)) {
      await this.syncPeppolAlerts(client, context, current)
      await this.syncPeppolAcceptanceRuns(client, context, current)
      return current
    }
    const updatedAt = new Date().toISOString()
    const providerReference = result.providerReference ?? current.providerReference
    const sameResult = current.status === result.status && current.provider === result.provider && current.providerReference === providerReference && current.message === result.message
    if (!this.peppolTransitionAllowed(current.status, result.status) || sameResult) {
      await client.query('UPDATE peppol_deliveries SET updated_at=$3 WHERE tenant_id=$1 AND id=$2', [context.tenantId, current.id, updatedAt])
      const delivery = { ...current, updatedAt }
      if (this.peppolTransitionAllowed(current.status, result.status)) await this.syncPeppolAlerts(client, context, delivery)
      if (this.peppolTransitionAllowed(current.status, result.status)) await this.syncPeppolAcceptanceRuns(client, context, delivery)
      return delivery
    }
    const deliveredAt = result.status === 'Afgeleverd' ? updatedAt : current.deliveredAt
    const delivery: PeppolDelivery = { ...current, status: result.status, provider: result.provider, providerReference, attempts: current.attempts + (countAttempt ? 1 : 0), message: result.message, events: [...current.events, { status: result.status, message: result.message, at: updatedAt, providerEventId: result.eventId }], updatedAt, deliveredAt }
    await client.query('UPDATE peppol_deliveries SET status=$3,provider=$4,provider_reference=$5,attempts=$6,message=$7,events=$8,updated_at=$9,delivered_at=$10 WHERE tenant_id=$1 AND id=$2', [context.tenantId, current.id, delivery.status, delivery.provider, delivery.providerReference ?? null, delivery.attempts, delivery.message, JSON.stringify(delivery.events), updatedAt, deliveredAt ?? null])
    await this.audit(client, context, 'peppol_delivery', current.id, auditAction, current, delivery, `${invoiceNumber}: ${result.message}`)
    await this.syncPeppolAlerts(client, context, delivery)
    await this.syncPeppolAcceptanceRuns(client, context, delivery)
    return delivery
  }

  async completePeppolDelivery(context: RequestContext, deliveryId: string, result: PeppolTransportResult, countAttempt = true): Promise<PeppolDelivery> {
    return this.transaction(async client => {
      const found = await client.query<PeppolDeliveryRow>('SELECT * FROM peppol_deliveries WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [context.tenantId, deliveryId])
      if (!found.rowCount) throw new RepositoryError('Peppol-verzending niet gevonden', 404)
      const current = mapPeppolDelivery(found.rows[0])
      const invoice = await this.lockSalesInvoice(client, context.tenantId, current.invoiceId)
      if (!this.canAccessEntity(context, invoice.legalEntityId)) throw new RepositoryError('Je hebt geen toegang tot deze juridische entiteit', 403)
      return this.updatePeppolDelivery(client, context, current, invoice.number, result, countAttempt, 'status_changed')
    })
  }

  async stalePeppolDeliveries(staleBefore: string, limit = 50): Promise<Array<{ id: string; providerReference: string; status: PeppolDelivery['status'] }>> {
    const deliveries = await this.pool.query<PeppolDeliveryRow>("SELECT * FROM peppol_deliveries WHERE status IN ('In wachtrij','Geaccepteerd','Fout') AND provider_reference IS NOT NULL AND updated_at <= $1 ORDER BY updated_at LIMIT $2", [staleBefore, limit])
    return deliveries.rows.map(row => ({ id: row.id, providerReference: row.provider_reference!, status: row.status }))
  }

  async applyPeppolProviderUpdate(deliveryId: string, result: PeppolTransportResult, auditAction: 'provider_webhook' | 'background_status_check'): Promise<PeppolDelivery> {
    return this.transaction(async client => {
      const found = await client.query<SystemPeppolDeliveryRow>('SELECT * FROM peppol_deliveries WHERE id=$1 FOR UPDATE', [deliveryId])
      if (!found.rowCount) throw new RepositoryError('Peppol-verzending niet gevonden', 404)
      if (found.rowCount !== 1) throw new RepositoryError('Peppol-verzending is niet eenduidig', 409)
      const row = found.rows[0]
      const current = mapPeppolDelivery(row)
      const invoice = await this.lockSalesInvoice(client, row.tenant_id, current.invoiceId)
      const context = await this.peppolSystemContext(client, row)
      return this.updatePeppolDelivery(client, context, current, invoice.number, result, false, auditAction)
    })
  }

  async raiseStalePeppolAlert(deliveryId: string): Promise<PeppolAlert> {
    return this.transaction(async client => {
      const found = await client.query<SystemPeppolDeliveryRow>('SELECT * FROM peppol_deliveries WHERE id=$1 FOR UPDATE', [deliveryId])
      if (!found.rowCount) throw new RepositoryError('Peppol-verzending niet gevonden', 404)
      if (found.rowCount !== 1) throw new RepositoryError('Peppol-verzending is niet eenduidig', 409)
      const row = found.rows[0]
      const delivery = mapPeppolDelivery(row)
      const context = await this.peppolSystemContext(client, row)
      return this.upsertPeppolAlert(client, context, delivery, 'Geen statusupdate', 'Hoog', 'De provider heeft niet binnen de ingestelde termijn een nieuwe leveringsstatus gemeld')
    })
  }

  async acknowledgePeppolAlert(context: RequestContext, alertId: string): Promise<PeppolAlert> {
    return this.transaction(async client => {
      const result = await client.query<PeppolAlertRow & { legal_entity_id: string | null }>('SELECT a.*,s.legal_entity_id FROM peppol_alerts a JOIN sales_invoices s ON s.tenant_id=a.tenant_id AND s.id=a.invoice_id WHERE a.tenant_id=$1 AND a.id=$2 FOR UPDATE', [context.tenantId, alertId])
      if (!result.rowCount) throw new RepositoryError('Peppol-waarschuwing niet gevonden', 404)
      const current = mapPeppolAlert(result.rows[0])
      if (!this.canAccessEntity(context, result.rows[0].legal_entity_id)) throw new RepositoryError('Je hebt geen toegang tot deze juridische entiteit', 403)
      if (current.status === 'Opgelost') throw new RepositoryError('Deze Peppol-waarschuwing is al opgelost', 409)
      if (current.status === 'In behandeling') return current
      const acknowledgedAt = new Date().toISOString()
      const alert: PeppolAlert = { ...current, status: 'In behandeling', acknowledgedBy: context.userId, acknowledgedAt, updatedAt: acknowledgedAt }
      await client.query("UPDATE peppol_alerts SET status='In behandeling',acknowledged_by=$3,acknowledged_at=$4,updated_at=$4 WHERE tenant_id=$1 AND id=$2", [context.tenantId, alertId, context.userId, acknowledgedAt])
      await this.audit(client, context, 'peppol_alert', alertId, 'acknowledged', current, alert, 'Financiële opvolging gestart')
      return alert
    })
  }

  async updatePeppolNotificationSettings(context: RequestContext, input: PeppolNotificationSettingsInput): Promise<PeppolNotificationSettings> {
    return this.transaction(async client => {
      const previous = await this.loadPeppolNotificationSettings(client, context.tenantId)
      const updatedAt = new Date().toISOString()
      await client.query(`INSERT INTO peppol_notification_settings (tenant_id,email_recipients,teams_targets,critical_sla_minutes,updated_at)
        VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT (tenant_id) DO UPDATE SET email_recipients=EXCLUDED.email_recipients,teams_targets=EXCLUDED.teams_targets,critical_sla_minutes=EXCLUDED.critical_sla_minutes,updated_at=EXCLUDED.updated_at`, [context.tenantId, JSON.stringify(input.emailRecipients), JSON.stringify(input.teamsTargets), input.criticalSlaMinutes, updatedAt])
      const settings: PeppolNotificationSettings = { ...input, connectorConfigured: this.peppolNotificationConnectorConfigured, connectorProvider: this.peppolNotificationConnectorProvider, connectorChannels: [...this.peppolNotificationConnectorChannels], integrationChecks: this.peppolIntegrationChecks.map(check => ({ ...check })), productionGate: previous.productionGate, updatedAt }
      await this.audit(client, context, 'peppol_notification_settings', context.tenantId, 'updated', previous, settings, 'Peppol-notificatiekanalen en SLA bijgewerkt')
      return settings
    })
  }

  async preparePeppolNotificationTest(context: RequestContext, input: PeppolNotificationTestInput): Promise<PeppolNotification> {
    return this.transaction(async client => {
      const settings = await this.loadPeppolNotificationSettings(client, context.tenantId)
      if (!settings.connectorChannels.includes(input.channel)) throw new RepositoryError(`${input.channel} is niet geconfigureerd in de actieve notificatieconnector`, 409)
      const allowedDestinations = input.channel === 'E-mail' ? settings.emailRecipients : settings.teamsTargets
      if (!allowedDestinations.includes(input.destination)) throw new RepositoryError('Kies een opgeslagen Peppol-notificatiebestemming', 400)
      const createdAt = new Date().toISOString()
      const notification: PeppolNotification = {
        id: randomUUID(), alertId: randomUUID(), channel: input.channel, kind: 'Testmelding', destination: input.destination,
        subject: 'BouwFlow Peppol-testmelding', message: 'De notificatieconnector voor Peppol-waarschuwingen is correct gekoppeld.',
        status: 'In wachtrij', attempts: 0, nextAttemptAt: createdAt, createdAt, updatedAt: createdAt,
      }
      await this.audit(client, context, 'peppol_notification_test', notification.id, 'requested', null, notification, `${input.channel}: ${input.destination}`)
      return notification
    })
  }

  async completePeppolNotificationTest(context: RequestContext, notification: PeppolNotification, error?: string): Promise<PeppolNotificationTestResult | undefined> {
    return this.transaction(async client => {
      const completedAt = new Date().toISOString()
      const completed = error
        ? { ...notification, status: 'Mislukt' as const, attempts: 1, lastError: error, updatedAt: completedAt }
        : { ...notification, status: 'Verzonden' as const, attempts: 1, sentAt: completedAt, updatedAt: completedAt }
      await this.audit(client, context, 'peppol_notification_test', notification.id, error ? 'delivery_failed' : 'sent', notification, completed, error ?? `${notification.channel}: ${notification.destination}`)
      return error ? undefined : { id: notification.id, channel: notification.channel, destination: notification.destination, status: 'Verzonden', sentAt: completedAt }
    })
  }

  async enqueueCriticalPeppolEscalations(at = new Date().toISOString()): Promise<number> {
    return this.transaction(async client => {
      const alerts = await client.query<PeppolAlertRow>("SELECT * FROM peppol_alerts WHERE severity='Kritiek' AND status='Open' ORDER BY updated_at")
      const settingsByTenant = new Map<string, PeppolNotificationSettings>()
      const now = new Date(at).getTime()
      let queued = 0
      for (const row of alerts.rows) {
        let settings = settingsByTenant.get(row.tenant_id)
        if (!settings) {
          settings = await this.loadPeppolNotificationSettings(client, row.tenant_id)
          settingsByTenant.set(row.tenant_id, settings)
        }
        if (new Date(row.updated_at).getTime() > now - settings.criticalSlaMinutes * 60_000) continue
        const alert = mapPeppolAlert(row)
        const deliveryResult = await client.query<SystemPeppolDeliveryRow>('SELECT * FROM peppol_deliveries WHERE tenant_id=$1 AND invoice_id=$2 AND id=$3', [row.tenant_id, alert.invoiceId, alert.deliveryId])
        if (!deliveryResult.rowCount) continue
        const context = await this.peppolSystemContext(client, deliveryResult.rows[0])
        queued += await this.enqueuePeppolAlertNotifications(client, context, alert, 'SLA-escalatie', 'critical-sla')
      }
      return queued
    })
  }

  async duePeppolNotifications(limit = 50): Promise<PeppolNotification[]> {
    const channelFilter = this.peppolNotificationConnectorConfigured && this.peppolNotificationConnectorChannels.length
      ? ` AND channel IN (${this.peppolNotificationConnectorChannels.map((_, index) => `$${index + 1}`).join(',')})`
      : ''
    const parameters: unknown[] = channelFilter ? [...this.peppolNotificationConnectorChannels, limit] : [limit]
    const limitParameter = `$${parameters.length}`
    const result = await this.pool.query<PeppolNotificationRow>(`SELECT * FROM peppol_notification_outbox WHERE status IN ('In wachtrij','Mislukt') AND attempts < 5 AND next_attempt_at <= now()${channelFilter} ORDER BY next_attempt_at,created_at LIMIT ${limitParameter}`, parameters)
    return result.rows.map(mapPeppolNotification)
  }

  private async updatePeppolNotificationResult(notificationId: string, error?: string) {
    return this.transaction(async client => {
      const found = await client.query<SystemPeppolNotificationRow>('SELECT * FROM peppol_notification_outbox WHERE id=$1 FOR UPDATE', [notificationId])
      if (!found.rowCount) throw new RepositoryError('Peppol-notificatie niet gevonden', 404)
      const row = found.rows[0]
      const current = mapPeppolNotification(row)
      if (current.status === 'Geannuleerd') return current
      const updatedAt = new Date().toISOString()
      const attempts = current.attempts + 1
      const nextAttemptAt = error ? new Date(Date.now() + Math.min(60, 2 ** attempts) * 60_000).toISOString() : current.nextAttemptAt
      const notification: PeppolNotification = error ? { ...current, status: 'Mislukt', attempts, nextAttemptAt, lastError: error, updatedAt } : { ...current, status: 'Verzonden', attempts, lastError: undefined, sentAt: updatedAt, updatedAt }
      await client.query('UPDATE peppol_notification_outbox SET status=$3,attempts=$4,next_attempt_at=$5,last_error=$6,sent_at=$7,updated_at=$8 WHERE tenant_id=$1 AND id=$2', [row.tenant_id, notificationId, notification.status, attempts, notification.nextAttemptAt, notification.lastError ?? null, notification.sentAt ?? null, updatedAt])
      const alertResult = await client.query<PeppolAlertRow>('SELECT * FROM peppol_alerts WHERE tenant_id=$1 AND id=$2', [row.tenant_id, current.alertId])
      if (alertResult.rowCount) {
        const alert = mapPeppolAlert(alertResult.rows[0])
        const deliveryResult = await client.query<SystemPeppolDeliveryRow>('SELECT * FROM peppol_deliveries WHERE tenant_id=$1 AND id=$2', [row.tenant_id, alert.deliveryId])
        if (deliveryResult.rowCount) {
          const context = await this.peppolSystemContext(client, deliveryResult.rows[0])
          await this.audit(client, context, 'peppol_notification', notificationId, error ? 'delivery_failed' : 'sent', current, notification, error ?? `${notification.channel}: ${notification.destination}`)
        }
      }
      return notification
    })
  }

  async markPeppolNotificationSent(notificationId: string) { await this.updatePeppolNotificationResult(notificationId) }
  async markPeppolNotificationFailed(notificationId: string, error: string) { await this.updatePeppolNotificationResult(notificationId, error.slice(0, 1_000)) }

  async latestPeppolDelivery(context: RequestContext, invoiceId: string): Promise<PeppolDelivery> {
    const invoiceResult = await this.pool.query<SalesInvoiceRow>('SELECT * FROM sales_invoices WHERE tenant_id=$1 AND id=$2', [context.tenantId, invoiceId])
    if (!invoiceResult.rowCount) throw new RepositoryError('Verkoopfactuur niet gevonden', 404)
    const invoice = mapSalesInvoice(invoiceResult.rows[0])
    if (!this.canAccessEntity(context, invoice.legalEntityId)) throw new RepositoryError('Je hebt geen toegang tot deze juridische entiteit', 403)
    const delivery = await this.pool.query<PeppolDeliveryRow>('SELECT * FROM peppol_deliveries WHERE tenant_id=$1 AND invoice_id=$2 ORDER BY requested_at DESC LIMIT 1', [context.tenantId, invoiceId])
    if (!delivery.rowCount) throw new RepositoryError('Voor deze factuur bestaat nog geen Peppol-verzending', 404)
    return mapPeppolDelivery(delivery.rows[0])
  }

  async registerSalesPayment(context: RequestContext, invoiceId: string, input: PaymentRegistrationInput): Promise<SalesInvoice> {
    return this.transaction(async client => {
      const current = await this.lockSalesInvoice(client, context.tenantId, invoiceId)
      if (current.status !== 'Openstaand') throw new RepositoryError('Alleen een openstaande verkoopfactuur kan worden betaald', 409)
      if (Math.abs(current.total - input.amount) > 0.01) throw new RepositoryError('Het betalingsbedrag moet gelijk zijn aan het openstaande factuurbedrag', 409)
      await client.query("UPDATE sales_invoices SET status='Betaald',paid_at=$3,paid_amount=$4,payment_reference=$5 WHERE tenant_id=$1 AND id=$2", [context.tenantId, invoiceId, input.paymentDate, input.amount, input.reference])
      const updated: SalesInvoice = { ...current, status: 'Betaald', paidAt: input.paymentDate, paidAmount: input.amount, paymentReference: input.reference }
      await this.audit(client, context, 'sales_invoice', invoiceId, 'payment_registered', current, updated, input.reference)
      return updated
    })
  }

  async createProjectCost(context: RequestContext, projectId: string, input: ProjectCostInput): Promise<ProjectCost> {
    return this.transaction(async client => {
      await this.validateDailyReportProject(client, context.tenantId, projectId, input.workPackageId)
      if (input.sourceDocumentId) { const source = await client.query('SELECT id FROM documents WHERE tenant_id=$1 AND id=$2 AND project_id=$3', [context.tenantId, input.sourceDocumentId, projectId]); if (!source.rowCount) throw new RepositoryError('Brondocument behoort niet tot dit project', 409) }
      const cost: ProjectCost = { id: randomUUID(), projectId, ...input, recognition: input.recognition ?? 'Boeking', status: input.type === 'Verplichting' ? 'Open' : 'Geboekt', createdAt: new Date().toISOString() }
      await client.query(`INSERT INTO project_costs (tenant_id,id,project_id,work_package_id,cost_date,type,category,description,supplier,amount,reference,recognition,source_document_id,status,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`, [context.tenantId, cost.id, projectId, cost.workPackageId ?? null, cost.date, cost.type, cost.category, cost.description, cost.supplier, cost.amount, cost.reference, cost.recognition, cost.sourceDocumentId ?? null, cost.status, cost.createdAt])
      await this.audit(client, context, 'project_cost', cost.id, 'created', null, cost)
      return cost
    })
  }

  async settleCommitment(context: RequestContext, commitmentId: string, input: CommitmentSettlementInput): Promise<{ commitment: ProjectCost; actualCost: ProjectCost }> {
    return this.transaction(async client => {
      const result = await client.query<ProjectCostRow>('SELECT * FROM project_costs WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [context.tenantId, commitmentId])
      if (!result.rowCount) throw new RepositoryError('Verplichting niet gevonden', 404)
      const current = mapProjectCost(result.rows[0])
      if (current.type !== 'Verplichting' || current.status !== 'Open') throw new RepositoryError('Alleen een open verplichting kan als werkelijke kost worden geboekt', 409)
      const actualCost: ProjectCost = { id: randomUUID(), projectId: current.projectId, workPackageId: current.workPackageId, date: input.date, type: 'Werkelijke kost', category: current.category, description: input.description, supplier: current.supplier, amount: input.amount, reference: input.reference, status: 'Geboekt', sourceCommitmentId: current.id, createdAt: new Date().toISOString() }
      await client.query(`INSERT INTO project_costs (tenant_id,id,project_id,work_package_id,cost_date,type,category,description,supplier,amount,reference,status,source_commitment_id,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`, [context.tenantId, actualCost.id, actualCost.projectId, actualCost.workPackageId ?? null, actualCost.date, actualCost.type, actualCost.category, actualCost.description, actualCost.supplier, actualCost.amount, actualCost.reference, actualCost.status, current.id, actualCost.createdAt])
      await client.query("UPDATE project_costs SET status='Omgezet',settled_by_entry_id=$3 WHERE tenant_id=$1 AND id=$2", [context.tenantId, commitmentId, actualCost.id])
      const commitment: ProjectCost = { ...current, status: 'Omgezet', settledByEntryId: actualCost.id }
      await this.audit(client, context, 'project_cost', commitmentId, 'settled', current, commitment, actualCost.reference)
      await this.audit(client, context, 'project_cost', actualCost.id, 'created_from_commitment', null, actualCost, current.reference)
      return { commitment, actualCost }
    })
  }

  async createProjectForecast(context: RequestContext, projectId: string, input: ProjectForecastInput): Promise<ProjectForecast> {
    return this.transaction(async client => {
      const projectResult = await client.query<ProjectRow>('SELECT * FROM projects WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [context.tenantId, projectId])
      if (!projectResult.rowCount) throw new RepositoryError('Project niet gevonden', 404)
      const project = this.mapProject(projectResult.rows[0])
      const inputLines = new Map(input.lines.map(line => [line.workPackageId, line]))
      if (inputLines.size !== input.lines.length || inputLines.size !== project.workPackages.length || project.workPackages.some(workPackage => !inputLines.has(workPackage.id))) throw new RepositoryError('Geef voor ieder werkpakket exact één resterende kost op', 409)
      const costResult = await client.query<ProjectCostRow>('SELECT * FROM project_costs WHERE tenant_id=$1 AND project_id=$2', [context.tenantId, projectId])
      const costs = costResult.rows.map(mapProjectCost)
      const actualCosts = cents(costs.filter(cost => cost.type === 'Werkelijke kost').reduce((sum, cost) => sum + cost.amount, 0))
      const openCommitments = cents(costs.filter(cost => cost.type === 'Verplichting' && cost.status === 'Open').reduce((sum, cost) => sum + cost.amount, 0))
      const lines = project.workPackages.map(workPackage => {
        const openForPackage = cents(costs.filter(cost => cost.workPackageId === workPackage.id && cost.type === 'Verplichting' && cost.status === 'Open').reduce((sum, cost) => sum + cost.amount, 0))
        const remainingCost = inputLines.get(workPackage.id)!.remainingCost
        if (remainingCost < openForPackage) throw new RepositoryError(`De resterende kost van ${workPackage.code} mag niet lager zijn dan de open verplichtingen`, 409)
        return { workPackageId: workPackage.id, workPackageCode: workPackage.code, workPackageName: workPackage.name, remainingCost, openCommitments: openForPackage }
      })
      const remainingCost = cents(lines.reduce((sum, line) => sum + line.remainingCost, 0))
      if (remainingCost < openCommitments) throw new RepositoryError('De totale resterende kost mag niet lager zijn dan alle open verplichtingen', 409)
      const estimateAtCompletion = cents(actualCosts + remainingCost)
      const changeResult = await client.query<ChangeOrderRow>("SELECT * FROM change_orders WHERE tenant_id=$1 AND project_id=$2 AND status IN ('Goedgekeurd','Uitgevoerd','Klaar voor facturatie','Opgenomen in vorderingsstaat')", [context.tenantId, projectId])
      const expectedRevenue = cents(project.contractValue + changeResult.rows.map(mapChangeOrder).reduce((sum, change) => sum + change.total, 0))
      const expectedMargin = cents(expectedRevenue - estimateAtCompletion)
      const versionResult = await client.query<{ version: number | null }>('SELECT max(version) AS version FROM project_forecasts WHERE tenant_id=$1 AND project_id=$2', [context.tenantId, projectId])
      const forecast: ProjectForecast = { id: randomUUID(), projectId, version: Number(versionResult.rows[0].version ?? 0) + 1, lines, actualCosts, openCommitments, remainingCost, estimateAtCompletion, expectedRevenue, expectedMargin, expectedMarginPct: expectedRevenue ? expectedMargin / expectedRevenue * 100 : 0, notes: input.notes,status:'Ter goedkeuring',createdBy:context.displayName, createdAt: new Date().toISOString() }
      await client.query(`INSERT INTO project_forecasts (tenant_id,id,project_id,version,lines,actual_costs,open_commitments,remaining_cost,estimate_at_completion,expected_revenue,expected_margin,expected_margin_pct,notes,status,created_by,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`, [context.tenantId, forecast.id, projectId, forecast.version, JSON.stringify(forecast.lines), forecast.actualCosts, forecast.openCommitments, forecast.remainingCost, forecast.estimateAtCompletion, forecast.expectedRevenue, forecast.expectedMargin, forecast.expectedMarginPct, forecast.notes,forecast.status,forecast.createdBy, forecast.createdAt])
      await this.audit(client, context, 'project_forecast', forecast.id, 'created', null, forecast, `Prognoseversie ${forecast.version}`)
      return forecast
    })
  }

  async approveProjectForecast(context:RequestContext,id:string):Promise<ProjectForecast>{return this.transaction(async client=>{const result=await client.query<ProjectForecastRow>('SELECT * FROM project_forecasts WHERE tenant_id=$1 AND id=$2 FOR UPDATE',[context.tenantId,id]);if(!result.rowCount)throw new RepositoryError('Forecast niet gevonden',404);const current=mapProjectForecast(result.rows[0]);await this.requireProject(client,context,current.projectId);if(current.status!=='Ter goedkeuring')throw new RepositoryError('Alleen een forecast ter goedkeuring kan worden vrijgegeven',409);await client.query("UPDATE project_forecasts SET status='Vervallen' WHERE tenant_id=$1 AND project_id=$2 AND status='Goedgekeurd'",[context.tenantId,current.projectId]);const approvedAt=new Date().toISOString();await client.query("UPDATE project_forecasts SET status='Goedgekeurd',approved_by=$3,approved_at=$4 WHERE tenant_id=$1 AND id=$2",[context.tenantId,id,context.displayName,approvedAt]);const updated={...current,status:'Goedgekeurd' as const,approvedBy:context.displayName,approvedAt};await this.audit(client,context,'project_forecast',id,'approved',current,updated);return updated})}

  async createSupplier(context: RequestContext, input: SupplierInput): Promise<Supplier> {
    return this.transaction(async client => {
      if (input.organizationId) {
        const organizationResult = await client.query<OrganizationRow>('SELECT * FROM organizations WHERE tenant_id=$1 AND id=$2', [context.tenantId, input.organizationId])
        if (!organizationResult.rowCount) throw new RepositoryError('Geselecteerde relatie niet gevonden', 404)
        if (!mapOrganization(organizationResult.rows[0]).roles?.includes('Leverancier')) throw new RepositoryError('Deze relatie heeft niet de rol Leverancier', 409)
      }
      const duplicate = await client.query('SELECT id FROM suppliers WHERE tenant_id=$1 AND lower(name)=lower($2)', [context.tenantId, input.name])
      if (duplicate.rowCount) throw new RepositoryError('Er bestaat al een leverancier met deze naam', 409)
      const supplier: Supplier = { id: randomUUID(), ...input, rating: 0, frameworkAgreements: [], createdAt: new Date().toISOString() }
      await client.query(`INSERT INTO suppliers (tenant_id,id,organization_id,name,vat_number,contact_name,email,payment_terms,rating,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [context.tenantId, supplier.id, supplier.organizationId ?? null, supplier.name, supplier.vatNumber, supplier.contactName, supplier.email, supplier.paymentTerms, supplier.rating, supplier.createdAt])
      await this.audit(client, context, 'supplier', supplier.id, 'created', null, supplier)
      return supplier
    })
  }

  async createSupplierFrameworkAgreement(context: RequestContext, supplierId: string, input: import('../../src/domain.js').SupplierFrameworkAgreementInput): Promise<Supplier> {
    return this.transaction(async client => {
      const result = await client.query<SupplierRow>('SELECT * FROM suppliers WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [context.tenantId, supplierId])
      if (!result.rowCount) throw new RepositoryError('Leverancier niet gevonden', 404)
      const current = mapSupplier(result.rows[0])
      if (input.endsOn < input.startsOn) throw new RepositoryError('De einddatum moet na de startdatum liggen', 409)
      if ((current.frameworkAgreements ?? []).some(item => item.number.toLowerCase() === input.number.toLowerCase())) throw new RepositoryError('Dit raamcontractnummer bestaat al bij de leverancier', 409)
      const agreement: NonNullable<Supplier['frameworkAgreements']>[number] = { id: randomUUID(), ...input, committedAmount: 0, status: input.startsOn > new Date().toISOString().slice(0, 10) ? 'Concept' : 'Actief', createdAt: new Date().toISOString() }
      const frameworkAgreements = [agreement, ...(current.frameworkAgreements ?? [])]
      await client.query('UPDATE suppliers SET framework_agreements=$3 WHERE tenant_id=$1 AND id=$2', [context.tenantId, supplierId, JSON.stringify(frameworkAgreements)])
      const updated = { ...current, frameworkAgreements }
      await this.audit(client, context, 'supplier', supplierId, 'framework_agreement_created', current, updated, agreement.number)
      return updated
    })
  }

  async createProcurementRequest(context: RequestContext, projectId: string, input: ProcurementRequestInput): Promise<ProcurementRequest> {
    return this.transaction(async client => {
      await this.validateDailyReportProject(client, context.tenantId, projectId, input.workPackageId)
      if (new Set(input.items.map(item => item.id)).size !== input.items.length) throw new RepositoryError('Artikel-ID’s moeten uniek zijn', 409)
      const count = await client.query<{ count: string }>('SELECT count(*)::text AS count FROM procurement_requests WHERE tenant_id=$1', [context.tenantId])
      const amount=input.items.reduce((sum,item)=>sum+item.quantity*item.targetUnitPrice,0);const requiredRole=amount<=25_000?'Projectmanager':amount<=100_000?'Projectdirecteur':'Directie';const approval:NonNullable<ProcurementRequest['approval']>={status:'Te beoordelen',requiredRole,amount}
      const request: ProcurementRequest = { id: randomUUID(), number: `IB-${new Date().getFullYear()}-${String(Number(count.rows[0].count) + 1).padStart(3, '0')}`, projectId, ...input, status: 'Behoefte', quotes: [],approval, createdAt: new Date().toISOString() }
      await client.query(`INSERT INTO procurement_requests (tenant_id,id,number,project_id,work_package_id,invited_supplier_ids,category,requested_by,needed_by,description,items,status,quotes,approval,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`, [context.tenantId, request.id, request.number, projectId, request.workPackageId ?? null, JSON.stringify(request.invitedSupplierIds), request.category, request.requestedBy, request.neededBy, request.description, JSON.stringify(request.items), request.status, JSON.stringify(request.quotes),JSON.stringify(approval), request.createdAt])
      await this.audit(client, context, 'procurement_request', request.id, 'created', null, request)
      return request
    })
  }

  async approveProcurementRequest(context:RequestContext,requestId:string):Promise<ProcurementRequest>{return this.transaction(async client=>{const current=await this.lockProcurementRequest(client,context.tenantId,requestId);if(current.approval?.status!=='Te beoordelen')throw new RepositoryError('Deze inkoopbehoefte staat niet ter goedkeuring',409);const required=current.approval.requiredRole;const allowed=context.roles.includes('Administrator')||context.roles.includes('Directie')||(required!=='Directie'&&context.roles.includes('Projectdirecteur'))||(required==='Projectmanager'&&context.roles.includes('Projectmanager'));if(!allowed)throw new RepositoryError(`Goedkeuring vereist de rol ${required} of hoger`,403);const approval={...current.approval,status:'Goedgekeurd' as const,approvedBy:context.displayName,approvedAt:new Date().toISOString()};await client.query('UPDATE procurement_requests SET approval=$3 WHERE tenant_id=$1 AND id=$2',[context.tenantId,requestId,JSON.stringify(approval)]);const updated={...current,approval};await this.audit(client,context,'procurement_request',requestId,'approved',current,updated,required);return updated})}

  async issuePriceRequest(context: RequestContext, requestId: string): Promise<ProcurementRequest> {
    return this.transaction(async client => {
      const current = await this.lockProcurementRequest(client, context.tenantId, requestId)
      if (current.status !== 'Behoefte') throw new RepositoryError('Alleen een nieuwe inkoopbehoefte kan als prijsaanvraag worden uitgestuurd', 409)
      if(current.approval?.status!=='Goedgekeurd')throw new RepositoryError('De inkoopbehoefte moet volgens de goedkeuringsmatrix zijn vrijgegeven',409)
      await client.query("UPDATE procurement_requests SET status='Prijsaanvraag' WHERE tenant_id=$1 AND id=$2", [context.tenantId, requestId])
      const updated: ProcurementRequest = { ...current, status: 'Prijsaanvraag' }
      await this.audit(client, context, 'procurement_request', requestId, 'price_request_issued', current, updated)
      return updated
    })
  }

  async addSupplierQuote(context: RequestContext, requestId: string, input: SupplierQuoteInput): Promise<ProcurementRequest> {
    return this.transaction(async client => {
      const current = await this.lockProcurementRequest(client, context.tenantId, requestId)
      if (!['Prijsaanvraag', 'Vergelijken'].includes(current.status)) throw new RepositoryError('Deze inkoopbehoefte staat niet open voor leveranciersoffertes', 409)
      const supplier = await client.query<{id:string;email:string}&QueryResultRow>('SELECT id,email FROM suppliers WHERE tenant_id=$1 AND id=$2', [context.tenantId, input.supplierId])
      if (!supplier.rowCount) throw new RepositoryError('Leverancier niet gevonden', 404)
      if (context.roles.includes('Leverancier') && supplier.rows[0].email.toLowerCase() !== context.email.toLowerCase()) throw new RepositoryError('Deze leverancieraccount mag alleen voor de eigen organisatie offreren', 403)
      if (context.roles.includes('Leverancier') && !current.invitedSupplierIds.includes(input.supplierId)) throw new RepositoryError('Deze leverancier is niet voor deze prijsaanvraag uitgenodigd', 403)
      if (current.quotes.some(quote => quote.supplierId === input.supplierId)) throw new RepositoryError('Voor deze leverancier is al een offerte geregistreerd', 409)
      const quote = { id: randomUUID(), ...input, createdAt: new Date().toISOString() }
      const quotes = [...current.quotes, quote]
      await client.query("UPDATE procurement_requests SET status='Vergelijken',quotes=$3 WHERE tenant_id=$1 AND id=$2", [context.tenantId, requestId, JSON.stringify(quotes)])
      const updated: ProcurementRequest = { ...current, status: 'Vergelijken', quotes }
      await this.audit(client, context, 'procurement_request', requestId, 'supplier_quote_added', current, updated, input.supplierId)
      return updated
    })
  }

  async selectSupplierQuote(context: RequestContext, requestId: string, quoteId: string): Promise<{ request: ProcurementRequest; order: PurchaseOrder; commitment: ProjectCost }> {
    return this.transaction(async client => {
      const current = await this.lockProcurementRequest(client, context.tenantId, requestId)
      if (current.status !== 'Vergelijken') throw new RepositoryError('Er zijn geen vergelijkbare offertes beschikbaar', 409)
      const quote = current.quotes.find(item => item.id === quoteId)
      if (!quote) throw new RepositoryError('Leveranciersofferte niet gevonden', 404)
      const supplierResult = await client.query<SupplierRow>('SELECT * FROM suppliers WHERE tenant_id=$1 AND id=$2', [context.tenantId, quote.supplierId])
      if (!supplierResult.rowCount) throw new RepositoryError('Leverancier niet gevonden', 404)
      const supplier = mapSupplier(supplierResult.rows[0])
      const orderCount = await client.query<{ count: string }>('SELECT count(*)::text AS count FROM purchase_orders WHERE tenant_id=$1', [context.tenantId])
      const orderDate = new Date().toISOString().slice(0, 10)
      const frameworkAgreement = (supplier.frameworkAgreements ?? []).find(item => item.status === 'Actief' && item.category === current.category && item.startsOn <= orderDate && item.endsOn >= orderDate)
      if (frameworkAgreement && frameworkAgreement.committedAmount + quote.amount > frameworkAgreement.ceilingAmount + 0.01) throw new RepositoryError(`Raamcontract ${frameworkAgreement.number} overschrijdt het plafondbedrag`, 409)
      const commitment: ProjectCost = { id: randomUUID(), projectId: current.projectId, workPackageId: current.workPackageId, date: orderDate, type: 'Verplichting', category: current.category, description: `${current.number} · ${current.description}`, supplier: supplier.name, amount: quote.amount, reference: current.number, status: 'Open', createdAt: new Date().toISOString() }
      await client.query(`INSERT INTO project_costs (tenant_id,id,project_id,work_package_id,cost_date,type,category,description,supplier,amount,reference,status,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`, [context.tenantId, commitment.id, commitment.projectId, commitment.workPackageId ?? null, commitment.date, commitment.type, commitment.category, commitment.description, commitment.supplier, commitment.amount, commitment.reference, commitment.status, commitment.createdAt])
      const targetTotal=current.items.reduce((sum,item)=>sum+item.quantity*item.targetUnitPrice,0);const orderLines=current.items.map(item=>({procurementItemId:item.id,description:item.description,unit:item.unit,orderedQuantity:item.quantity,receivedQuantity:0,invoicedQuantity:0,unitPrice:targetTotal>0?quote.amount*(item.quantity*item.targetUnitPrice/targetTotal)/item.quantity:quote.amount/current.items.length/item.quantity}))
      const order: PurchaseOrder = { id: randomUUID(), number: `BB-${new Date().getFullYear()}-${String(Number(orderCount.rows[0].count) + 1).padStart(3, '0')}`, procurementRequestId: current.id, projectId: current.projectId, supplierId: quote.supplierId, frameworkAgreementId: frameworkAgreement?.id, orderDate, expectedDeliveryDate: addDays(orderDate, quote.leadTimeDays), amount: quote.amount, status: 'Besteld', commitmentCostId: commitment.id, lines:orderLines,receipts:[], createdAt: new Date().toISOString() }
      await client.query(`INSERT INTO purchase_orders (tenant_id,id,number,procurement_request_id,project_id,supplier_id,framework_agreement_id,order_date,expected_delivery_date,amount,status,commitment_cost_id,lines,receipts,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`, [context.tenantId, order.id, order.number, current.id, order.projectId, order.supplierId, order.frameworkAgreementId ?? null, order.orderDate, order.expectedDeliveryDate, order.amount, order.status, order.commitmentCostId, JSON.stringify(order.lines),JSON.stringify(order.receipts),order.createdAt])
      if (frameworkAgreement) {
        const frameworkAgreements = (supplier.frameworkAgreements ?? []).map(item => item.id === frameworkAgreement.id ? { ...item, committedAmount: item.committedAmount + quote.amount, status: item.committedAmount + quote.amount >= item.ceilingAmount ? 'Opgebruikt' as const : item.status } : item)
        await client.query('UPDATE suppliers SET framework_agreements=$3 WHERE tenant_id=$1 AND id=$2', [context.tenantId, supplier.id, JSON.stringify(frameworkAgreements)])
      }
      await client.query("UPDATE procurement_requests SET status='Besteld',selected_quote_id=$3,purchase_order_id=$4 WHERE tenant_id=$1 AND id=$2", [context.tenantId, requestId, quoteId, order.id])
      const request: ProcurementRequest = { ...current, status: 'Besteld', selectedQuoteId: quoteId, purchaseOrderId: order.id }
      await this.audit(client, context, 'project_cost', commitment.id, 'created_from_purchase_order', null, commitment, order.number)
      await this.audit(client, context, 'purchase_order', order.id, 'created', null, order, quoteId)
      await this.audit(client, context, 'procurement_request', requestId, 'supplier_quote_selected', current, request, order.number)
      return { request, order, commitment }
    })
  }

  async receivePurchaseOrder(context: RequestContext, orderId: string, input: PurchaseReceiptInput): Promise<PurchaseOrder> {
    return this.transaction(async client => {
      const current = await this.lockPurchaseOrder(client, context.tenantId, orderId)
      if (!['Besteld','Gedeeltelijk ontvangen'].includes(current.status)) throw new RepositoryError('Alleen een open bestelling kan worden ontvangen', 409)
      const receiptLines=input.lines?.length?input.lines:(current.lines??[]).map(line=>({procurementItemId:line.procurementItemId,quantity:line.orderedQuantity-line.receivedQuantity}));const nextLines=(current.lines??[]).map(line=>{const receipt=receiptLines.find(item=>item.procurementItemId===line.procurementItemId);const receivedQuantity=line.receivedQuantity+(receipt?.quantity??0);if(receivedQuantity>line.orderedQuantity+0.0001)throw new RepositoryError(`Ontvangen hoeveelheid voor ${line.description} overschrijdt de bestelling`,409);return{...line,receivedQuantity}});const complete=!nextLines.length||nextLines.every(line=>line.receivedQuantity>=line.orderedQuantity);const status:PurchaseOrder['status']=complete?'Ontvangen':'Gedeeltelijk ontvangen';const receipts=[...(current.receipts??[]),{id:randomUUID(),receivedAt:input.receivedAt,deliveryReference:input.deliveryReference,receivedBy:input.receivedBy,notes:input.notes,lines:receiptLines}]
      await client.query("UPDATE purchase_orders SET status=$3,received_at=$4,delivery_reference=$5,received_by=$6,receipt_notes=$7,lines=$8,receipts=$9 WHERE tenant_id=$1 AND id=$2", [context.tenantId, orderId,status, input.receivedAt, input.deliveryReference, input.receivedBy, input.notes,JSON.stringify(nextLines),JSON.stringify(receipts)])
      const updated: PurchaseOrder = { ...current, status, lines:nextLines,receipts, receivedAt: input.receivedAt, deliveryReference: input.deliveryReference, receivedBy: input.receivedBy, receiptNotes: input.notes }
      await this.audit(client, context, 'purchase_order', orderId, 'received', current, updated, input.deliveryReference)
      return updated
    })
  }

  async purchaseOrderDocument(context: RequestContext, orderId: string) {
    const orderResult = await this.pool.query<PurchaseOrderRow>('SELECT * FROM purchase_orders WHERE tenant_id=$1 AND id=$2', [context.tenantId, orderId])
    if (!orderResult.rowCount) throw new RepositoryError('Bestelbon niet gevonden', 404)
    const order = mapPurchaseOrder(orderResult.rows[0])
    const [requestResult, supplierResult, projectResult] = await Promise.all([
      this.pool.query<ProcurementRequestRow>('SELECT * FROM procurement_requests WHERE tenant_id=$1 AND id=$2', [context.tenantId, order.procurementRequestId]),
      this.pool.query<SupplierRow>('SELECT * FROM suppliers WHERE tenant_id=$1 AND id=$2', [context.tenantId, order.supplierId]),
      this.pool.query<ProjectRow>('SELECT * FROM projects WHERE tenant_id=$1 AND id=$2', [context.tenantId, order.projectId]),
    ])
    if (!requestResult.rowCount || !supplierResult.rowCount || !projectResult.rowCount) throw new RepositoryError('Besteldossier is onvolledig', 409)
    const supplier = mapSupplier(supplierResult.rows[0])
    if (context.roles.includes('Leverancier') && supplier.email.toLowerCase() !== context.email.toLowerCase()) throw new RepositoryError('Deze leverancieraccount mag alleen eigen bestelbonnen raadplegen', 403)
    if (!context.roles.includes('Leverancier')) await this.requireProject(this.pool, context, order.projectId)
    const project = this.mapProject(projectResult.rows[0])
    let entity: LegalEntity | undefined
    if (project.legalEntityId) {
      const entityResult = await this.pool.query<LegalEntityRow>('SELECT * FROM legal_entities WHERE tenant_id=$1 AND id=$2', [context.tenantId, project.legalEntityId])
      if (entityResult.rowCount) entity = mapLegalEntity(entityResult.rows[0])
    }
    return { order, request: mapProcurementRequest(requestResult.rows[0]), supplier, project, entity }
  }

  async matchPurchaseInvoice(context: RequestContext, orderId: string, input: PurchaseInvoiceMatchInput): Promise<import('../../src/domain.js').PurchaseInvoiceMatchResult> {
    return this.transaction(async client => {
      const current = await this.lockPurchaseOrder(client, context.tenantId, orderId)
      if (current.status !== 'Ontvangen') throw new RepositoryError('Ontvang de bestelling voor de factuurcontrole', 409)
      const commitmentResult = await client.query<ProjectCostRow>('SELECT * FROM project_costs WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [context.tenantId, current.commitmentCostId])
      if (!commitmentResult.rowCount) throw new RepositoryError('Bestelverplichting niet gevonden', 409)
      const currentCommitment = mapProjectCost(commitmentResult.rows[0])
      if (currentCommitment.status !== 'Open') throw new RepositoryError('De bestelverplichting is al afgesloten', 409)
      const requestResult = await client.query<ProcurementRequestRow>('SELECT * FROM procurement_requests WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [context.tenantId, current.procurementRequestId])
      if (!requestResult.rowCount) throw new RepositoryError('Inkoopdossier niet gevonden', 409)
      const currentRequest = mapProcurementRequest(requestResult.rows[0])
      const invoiceLines = input.lines?.length ? input.lines : (current.lines ?? []).map(line => ({ procurementItemId: line.procurementItemId, quantity: line.receivedQuantity, unitPrice: line.unitPrice }))
      const deviations: string[] = []
      const orderLines = current.lines ?? []
      for (const line of orderLines) {
        const invoiceLine = invoiceLines.find(item => item.procurementItemId === line.procurementItemId)
        if (!invoiceLine) { deviations.push(`${line.description}: ontbreekt op de factuur`); continue }
        if (Math.abs(line.receivedQuantity - line.orderedQuantity) > 0.0001) deviations.push(`${line.description}: ${line.receivedQuantity} ontvangen tegenover ${line.orderedQuantity} besteld`)
        if (Math.abs(invoiceLine.quantity - line.receivedQuantity) > 0.0001) deviations.push(`${line.description}: ${invoiceLine.quantity} gefactureerd tegenover ${line.receivedQuantity} ontvangen`)
        if (Math.abs(invoiceLine.unitPrice - line.unitPrice) > 0.01) deviations.push(`${line.description}: factuurprijs ${invoiceLine.unitPrice.toFixed(2)} tegenover bestelprijs ${line.unitPrice.toFixed(2)}`)
      }
      for (const invoiceLine of invoiceLines) if (!orderLines.some(line => line.procurementItemId === invoiceLine.procurementItemId)) deviations.push(`Onbekende factuurlijn ${invoiceLine.procurementItemId}`)
      const invoiceLineTotal = invoiceLines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0)
      if (Math.abs(invoiceLineTotal - input.amount) > 0.01) deviations.push(`Lijntotaal ${invoiceLineTotal.toFixed(2)} wijkt af van factuurtotaal ${input.amount.toFixed(2)}`)
      const amountDifference = Number((input.amount - current.amount).toFixed(2))
      if (Math.abs(amountDifference) > 0.01) deviations.push(`Factuurtotaal wijkt ${amountDifference.toFixed(2)} af van de bestelbon`)
      const matchResult: NonNullable<PurchaseOrder['matchResult']> = { matched: deviations.length === 0, amountDifference, deviations, invoiceLines, checkedBy: context.displayName, checkedAt: new Date().toISOString() }
      const lines = orderLines.map(line => ({ ...line, invoicedQuantity: invoiceLines.find(item => item.procurementItemId === line.procurementItemId)?.quantity ?? 0 }))
      if (!matchResult.matched) {
        const order: PurchaseOrder = { ...current, status: 'Afwijking', lines, matchResult, invoiceNumber: input.invoiceNumber, invoiceDate: input.invoiceDate, invoiceDueDate: input.dueDate, invoiceAmount: input.amount }
        await client.query("UPDATE purchase_orders SET status='Afwijking',invoice_number=$3,invoice_date=$4,invoice_due_date=$5,invoice_amount=$6,lines=$7,match_result=$8 WHERE tenant_id=$1 AND id=$2", [context.tenantId, orderId, input.invoiceNumber, input.invoiceDate, input.dueDate, input.amount, JSON.stringify(lines), JSON.stringify(matchResult)])
        await this.audit(client, context, 'purchase_order', orderId, 'invoice_deviation_detected', current, order, deviations.join('; '))
        return { order, request: currentRequest, commitment: currentCommitment }
      }
      return this.finalizePurchaseInvoice(client, context, current, currentRequest, currentCommitment, input, lines, matchResult)
    })
  }

  async approvePurchaseInvoiceDeviation(context: RequestContext, orderId: string, reason: string): Promise<import('../../src/domain.js').PurchaseInvoiceMatchResult> {
    return this.transaction(async client => {
      const current = await this.lockPurchaseOrder(client, context.tenantId, orderId)
      if (current.status !== 'Afwijking' || !current.matchResult || current.invoiceAmount == null || !current.invoiceNumber || !current.invoiceDate || !current.invoiceDueDate) throw new RepositoryError('Er staat geen volledige factuurafwijking ter goedkeuring', 409)
      const commitmentResult = await client.query<ProjectCostRow>('SELECT * FROM project_costs WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [context.tenantId, current.commitmentCostId])
      const requestResult = await client.query<ProcurementRequestRow>('SELECT * FROM procurement_requests WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [context.tenantId, current.procurementRequestId])
      if (!commitmentResult.rowCount || !requestResult.rowCount) throw new RepositoryError('Het inkoopdossier is onvolledig', 409)
      const commitment = mapProjectCost(commitmentResult.rows[0])
      if (commitment.status !== 'Open') throw new RepositoryError('De bestelverplichting is al afgesloten', 409)
      const matchResult = { ...current.matchResult, approvedBy: context.displayName, approvedAt: new Date().toISOString(), approvalReason: reason }
      const input: PurchaseInvoiceMatchInput = { invoiceNumber: current.invoiceNumber, invoiceDate: current.invoiceDate, dueDate: current.invoiceDueDate, amount: current.invoiceAmount, lines: matchResult.invoiceLines }
      const result = await this.finalizePurchaseInvoice(client, context, current, mapProcurementRequest(requestResult.rows[0]), commitment, input, current.lines ?? [], matchResult)
      await this.audit(client, context, 'purchase_order', orderId, 'invoice_deviation_approved', current, result.order, reason)
      return result
    })
  }

  private async finalizePurchaseInvoice(client: SqlClient, context: RequestContext, current: PurchaseOrder, currentRequest: ProcurementRequest, currentCommitment: ProjectCost, input: PurchaseInvoiceMatchInput, lines: NonNullable<PurchaseOrder['lines']>, matchResult: NonNullable<PurchaseOrder['matchResult']>): Promise<import('../../src/domain.js').PurchaseInvoiceMatchResult> {
    const actualCost: ProjectCost = { id: randomUUID(), projectId: current.projectId, workPackageId: currentCommitment.workPackageId, date: input.invoiceDate, type: 'Werkelijke kost', category: currentCommitment.category, description: currentCommitment.description, supplier: currentCommitment.supplier, amount: input.amount, reference: input.invoiceNumber, status: 'Geboekt', sourceCommitmentId: currentCommitment.id, createdAt: new Date().toISOString() }
    await client.query(`INSERT INTO project_costs (tenant_id,id,project_id,work_package_id,cost_date,type,category,description,supplier,amount,reference,status,source_commitment_id,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`, [context.tenantId, actualCost.id, actualCost.projectId, actualCost.workPackageId ?? null, actualCost.date, actualCost.type, actualCost.category, actualCost.description, actualCost.supplier, actualCost.amount, actualCost.reference, actualCost.status, actualCost.sourceCommitmentId, actualCost.createdAt])
    await client.query("UPDATE project_costs SET status='Omgezet',settled_by_entry_id=$3 WHERE tenant_id=$1 AND id=$2", [context.tenantId, currentCommitment.id, actualCost.id])
    await client.query("UPDATE purchase_orders SET status='Factuur gecontroleerd',invoice_number=$3,invoice_date=$4,invoice_due_date=$5,invoice_amount=$6,actual_cost_id=$7,lines=$8,match_result=$9 WHERE tenant_id=$1 AND id=$2", [context.tenantId, current.id, input.invoiceNumber, input.invoiceDate, input.dueDate, input.amount, actualCost.id, JSON.stringify(lines), JSON.stringify(matchResult)])
    await client.query("UPDATE procurement_requests SET status='Afgesloten' WHERE tenant_id=$1 AND id=$2", [context.tenantId, currentRequest.id])
    const commitment: ProjectCost = { ...currentCommitment, status: 'Omgezet', settledByEntryId: actualCost.id }
    const order: PurchaseOrder = { ...current, status: 'Factuur gecontroleerd', lines, matchResult, invoiceNumber: input.invoiceNumber, invoiceDate: input.invoiceDate, invoiceDueDate: input.dueDate, invoiceAmount: input.amount, actualCostId: actualCost.id }
    const request: ProcurementRequest = { ...currentRequest, status: 'Afgesloten' }
    await this.audit(client, context, 'project_cost', commitment.id, 'settled_by_purchase_invoice', currentCommitment, commitment, input.invoiceNumber)
    await this.audit(client, context, 'project_cost', actualCost.id, 'created_from_purchase_invoice', null, actualCost, current.number)
    await this.audit(client, context, 'purchase_order', current.id, 'invoice_matched', current, order, input.invoiceNumber)
    await this.audit(client, context, 'procurement_request', request.id, 'closed', currentRequest, request, order.number)
    return { order, request, commitment, actualCost }
  }

  async registerPurchasePayment(context: RequestContext, orderId: string, input: PaymentRegistrationInput): Promise<PurchaseOrder> {
    return this.transaction(async client => {
      const current = await this.lockPurchaseOrder(client, context.tenantId, orderId)
      if (current.status !== 'Factuur gecontroleerd' || current.invoiceAmount == null) throw new RepositoryError('Alleen een gecontroleerde leveranciersfactuur kan worden betaald', 409)
      if (Math.abs(current.invoiceAmount - input.amount) > 0.01) throw new RepositoryError('Het betalingsbedrag moet gelijk zijn aan het gecontroleerde factuurbedrag', 409)
      await client.query("UPDATE purchase_orders SET status='Betaald',paid_at=$3,paid_amount=$4,payment_reference=$5 WHERE tenant_id=$1 AND id=$2", [context.tenantId, orderId, input.paymentDate, input.amount, input.reference])
      const updated: PurchaseOrder = { ...current, status: 'Betaald', paidAt: input.paymentDate, paidAmount: input.amount, paymentReference: input.reference }
      await this.audit(client, context, 'purchase_order', orderId, 'payment_registered', current, updated, input.reference)
      return updated
    })
  }

  async auditEntries(context: RequestContext, limit = 100): Promise<AuditEntry[]> {
    const result = await this.pool.query(`SELECT id,user_id AS "userId",entity_type AS "entityType",entity_id AS "entityId",action,
      old_value AS "oldValue",new_value AS "newValue",reason,created_at AS "createdAt"
      FROM audit_log WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2`, [context.tenantId, limit])
    return result.rows as AuditEntry[]
  }

  async recordAuditEntries(context: RequestContext, entityType: string, entityId: string, limit = 100): Promise<AuditTrailEntry[]> {
    if (context.allLegalEntities === false) {
      const projectTables: Record<string, string> = {
        daily_report: 'daily_reports', change_order: 'change_orders', document: 'documents', project_cost: 'project_costs',
        progress_statement: 'progress_statements', procurement_request: 'procurement_requests', purchase_order: 'purchase_orders', sales_invoice: 'sales_invoices',
        site_photo: 'site_photos', qhse_certificate: 'qhse_certificates', qhse_inspection: 'qhse_inspections', project_forecast: 'project_forecasts',
      }
      let projectId: string | undefined
      if (entityType === 'project') projectId = entityId
      else if (projectTables[entityType]) {
        const result = await this.pool.query<{ project_id: string }>(`SELECT project_id FROM ${projectTables[entityType]} WHERE tenant_id=$1 AND id=$2`, [context.tenantId, entityId])
        projectId = result.rows[0]?.project_id
        if (!projectId) throw new RepositoryError('Dossier niet gevonden', 404)
      } else if (entityType === 'project_contract' || entityType === 'project_closeout') {
        const state = await this.blueprintState(this.pool, context.tenantId)
        projectId = entityType === 'project_contract' ? state.projectContracts.find(item => item.id === entityId)?.projectId : state.projectCloseouts.find(item => item.id === entityId)?.projectId
        if (!projectId) throw new RepositoryError('Dossier niet gevonden', 404)
      } else if (['work_ticket', 'time_entry', 'project_claim'].includes(entityType)) {
        const state = await this.blueprintState(this.pool, context.tenantId)
        if (entityType === 'work_ticket') projectId = state.workTickets.find(item => item.id === entityId)?.projectId
        else if (entityType === 'time_entry') projectId = state.timeEntries.find(item => item.id === entityId)?.projectId
        else projectId = state.projectClaims.find(item => item.id === entityId)?.projectId
        if (!projectId) throw new RepositoryError('Dossier niet gevonden', 404)
      } else if (entityType === 'opportunity') {
        const result = await this.pool.query<{ legal_entity_id: string | null }>('SELECT legal_entity_id FROM opportunities WHERE tenant_id=$1 AND id=$2', [context.tenantId, entityId])
        if (!result.rowCount) throw new RepositoryError('Dossier niet gevonden', 404)
        if (!this.canAccessEntity(context, result.rows[0].legal_entity_id)) throw new RepositoryError('Je hebt geen toegang tot dit dossier', 403)
      } else if (entityType === 'calculation') {
        const result = await this.pool.query<{ legal_entity_id: string | null }>('SELECT o.legal_entity_id FROM calculations c JOIN opportunities o ON o.tenant_id=c.tenant_id AND o.id=c.opportunity_id WHERE c.tenant_id=$1 AND c.id=$2', [context.tenantId, entityId])
        if (!result.rowCount) throw new RepositoryError('Dossier niet gevonden', 404)
        if (!this.canAccessEntity(context, result.rows[0].legal_entity_id)) throw new RepositoryError('Je hebt geen toegang tot dit dossier', 403)
      } else if (entityType === 'quote') {
        const result = await this.pool.query<{ legal_entity_id: string | null }>('SELECT o.legal_entity_id FROM quotes q JOIN calculations c ON c.tenant_id=q.tenant_id AND c.id=q.calculation_id JOIN opportunities o ON o.tenant_id=c.tenant_id AND o.id=c.opportunity_id WHERE q.tenant_id=$1 AND q.id=$2', [context.tenantId, entityId])
        if (!result.rowCount) throw new RepositoryError('Dossier niet gevonden', 404)
        if (!this.canAccessEntity(context, result.rows[0].legal_entity_id)) throw new RepositoryError('Je hebt geen toegang tot dit dossier', 403)
      } else if (entityType === 'employee' || entityType === 'employee_absence') {
        const state = await this.blueprintState(this.pool, context.tenantId)
        const employee = entityType === 'employee' ? state.employees.find(item => item.id === entityId) : state.employees.find(item => item.id === state.employeeAbsences.find(absence => absence.id === entityId)?.employeeId)
        if (!employee) throw new RepositoryError('Dossier niet gevonden', 404)
        if (!this.canAccessEntity(context, employee.legalEntityId)) throw new RepositoryError('Je hebt geen toegang tot dit dossier', 403)
      } else if (entityType === 'employee_crew') {
        const state = await this.blueprintState(this.pool, context.tenantId)
        const crew = state.employeeCrews.find(item => item.id === entityId)
        if (!crew) throw new RepositoryError('Dossier niet gevonden', 404)
        if (!this.canAccessEntity(context, crew.legalEntityId)) throw new RepositoryError('Je hebt geen toegang tot dit dossier', 403)
      } else if (['asset','inventory_item','warehouse','stock_movement'].includes(entityType)) {
        const state = await this.operationalState(this.pool, context.tenantId)
        if (entityType === 'asset') {
          const asset = state.assets.find(item => item.id === entityId)
          if (!asset) throw new RepositoryError('Dossier niet gevonden', 404)
          projectId = asset.projectId
        } else if (entityType === 'inventory_item' && !state.inventoryItems.some(item => item.id === entityId)) throw new RepositoryError('Dossier niet gevonden', 404)
        else if (entityType === 'warehouse' && !state.warehouses.some(item => item.id === entityId)) throw new RepositoryError('Dossier niet gevonden', 404)
        else if (entityType === 'stock_movement') {
          const movement = state.stockMovements.find(item => item.id === entityId)
          if (!movement) throw new RepositoryError('Dossier niet gevonden', 404)
          projectId = movement.projectId
        }
      } else if (entityType === 'supplier') {
        const result = await this.pool.query('SELECT id FROM suppliers WHERE tenant_id=$1 AND id=$2', [context.tenantId, entityId])
        if (!result.rowCount) throw new RepositoryError('Dossier niet gevonden', 404)
      } else if (entityType === 'joint_venture') {
        const state = await this.blueprintState(this.pool, context.tenantId)
        const jointVenture = state.jointVentures.find(item => item.id === entityId)
        if (!jointVenture) throw new RepositoryError('Dossier niet gevonden', 404)
        if (jointVenture.members.some(member => !this.canAccessEntity(context, member.legalEntityId))) throw new RepositoryError('Je hebt geen toegang tot dit dossier', 403)
        projectId = jointVenture.projectId
      } else if (entityType === 'intercompany_charge') {
        const result = await this.pool.query<{ from_legal_entity_id:string; to_legal_entity_id:string; project_id:string|null }>('SELECT from_legal_entity_id,to_legal_entity_id,project_id FROM intercompany_charges WHERE tenant_id=$1 AND id=$2', [context.tenantId, entityId])
        if (!result.rowCount) throw new RepositoryError('Dossier niet gevonden', 404)
        if (!this.canAccessEntity(context, result.rows[0].from_legal_entity_id) || !this.canAccessEntity(context, result.rows[0].to_legal_entity_id)) throw new RepositoryError('Je hebt geen toegang tot dit dossier', 403)
        projectId = result.rows[0].project_id ?? undefined
      } else if (['subcontractor','qhse_event','ai_analysis'].includes(entityType)) {
        const state = await this.blueprintState(this.pool, context.tenantId)
        if (entityType === 'qhse_event') projectId = state.qhseEvents.find(item => item.id === entityId)?.projectId
        else if (entityType === 'ai_analysis') projectId = state.aiAnalyses.find(item => item.id === entityId)?.projectId
        else {
          const subcontractor = state.subcontractors.find(item => item.id === entityId)
          if (!subcontractor) throw new RepositoryError('Dossier niet gevonden', 404)
          if (subcontractor.projectIds.length) {
            let allowed = false
            for (const candidateId of subcontractor.projectIds) { try { await this.requireProject(this.pool, context, candidateId); allowed = true; break } catch { /* probeer volgend gekoppeld project */ } }
            if (!allowed) throw new RepositoryError('Je hebt geen toegang tot dit dossier', 403)
          }
        }
        if (entityType !== 'subcontractor' && !projectId) throw new RepositoryError('Dossier niet gevonden', 404)
      } else if (entityType !== 'organization') throw new RepositoryError('Dit dossiertype ondersteunt geen audithistoriek', 400)
      if (projectId) await this.requireProject(this.pool, context, projectId)
    }
    const result = await this.pool.query<{ id:string; userId:string; userName:string; entityType:string; entityId:string; action:string; reason:string|null; createdAt:string|Date }>(`SELECT a.id,a.user_id AS "userId",u.display_name AS "userName",a.entity_type AS "entityType",a.entity_id AS "entityId",a.action,a.reason,a.created_at AS "createdAt"
      FROM audit_log a JOIN users u ON u.tenant_id=a.tenant_id AND u.id=a.user_id
      WHERE a.tenant_id=$1 AND a.entity_type=$2 AND a.entity_id=$3 ORDER BY a.created_at DESC LIMIT $4`, [context.tenantId, entityType, entityId, limit])
    return result.rows.map(item => ({ ...item, createdAt: iso(item.createdAt) }))
  }

  async userPreference(context: RequestContext, key: string): Promise<unknown | undefined> {
    const result = await this.pool.query<{ value: unknown }>('SELECT value FROM user_preferences WHERE tenant_id=$1 AND user_id=$2 AND preference_key=$3', [context.tenantId, context.userId, key])
    return result.rows[0]?.value
  }

  async saveUserPreference(context: RequestContext, key: string, value: unknown): Promise<{ key: string; value: unknown; updatedAt: string }> {
    const updatedAt = new Date().toISOString()
    await this.pool.query(`INSERT INTO user_preferences (tenant_id,user_id,preference_key,value,updated_at) VALUES ($1,$2,$3,$4,$5)
      ON CONFLICT (tenant_id,user_id,preference_key) DO UPDATE SET value=EXCLUDED.value,updated_at=EXCLUDED.updated_at`, [context.tenantId, context.userId, key, JSON.stringify(value), updatedAt])
    return { key, value, updatedAt }
  }

  private async transitionIntercompanyCharge(context: RequestContext, chargeId: string, expected: IntercompanyCharge['status'], status: IntercompanyCharge['status'], timestampColumn: 'approved_at' | 'posted_at', action: string): Promise<IntercompanyCharge> {
    return this.transaction(async client => {
      const result = await client.query<IntercompanyChargeRow>('SELECT * FROM intercompany_charges WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [context.tenantId, chargeId])
      if (!result.rowCount) throw new RepositoryError('Intercompany-doorrekening niet gevonden', 404)
      const current = mapIntercompanyCharge(result.rows[0])
      if (current.status !== expected) throw new RepositoryError(`Status ${expected} is vereist voor deze stap`, 409)
      const timestamp = new Date().toISOString()
      await client.query(`UPDATE intercompany_charges SET status=$3,${timestampColumn}=$4 WHERE tenant_id=$1 AND id=$2`, [context.tenantId, chargeId, status, timestamp])
      const updated: IntercompanyCharge = { ...current, status, ...(timestampColumn === 'approved_at' ? { approvedAt: timestamp } : { postedAt: timestamp }) }
      await this.audit(client, context, 'intercompany_charge', chargeId, action, current, updated)
      return updated
    })
  }

  async getQuote(context: RequestContext, id: string): Promise<Quote> {
    const result = await this.pool.query<QuoteRow>('SELECT * FROM quotes WHERE tenant_id=$1 AND id=$2', [context.tenantId, id])
    if (!result.rowCount) throw new RepositoryError('Offerte niet gevonden', 404)
    return mapQuote(result.rows[0])
  }

  private async normalizeDailyReportEmployees(client: SqlClient, tenantId: string, projectId: string, input: DailyReportInput): Promise<DailyReportInput> {
    const projectResult = await client.query<ProjectRow>('SELECT * FROM projects WHERE tenant_id=$1 AND id=$2', [tenantId, projectId])
    if (!projectResult.rowCount) throw new RepositoryError('Project niet gevonden', 404)
    const employees = (await this.blueprintState(client, tenantId)).employees
    const projectLegalEntityId = projectResult.rows[0].legal_entity_id
    return {
      ...input,
      laborEntries: input.laborEntries.map(entry => {
        const normalizedName = entry.employeeName.trim().toLocaleLowerCase()
        const employee = entry.employeeId
          ? employees.find(item => item.id === entry.employeeId)
          : employees.find(item => `${item.firstName} ${item.lastName}`.trim().toLocaleLowerCase() === normalizedName)
        if (!employee) {
          if (entry.employeeId) throw new RepositoryError('Geselecteerde medewerker bestaat niet in HR', 404)
          return entry
        }
        if (!employee.active) throw new RepositoryError(`${employee.firstName} ${employee.lastName} is niet actief in HR`, 409)
        if (employee.legalEntityId !== projectLegalEntityId) throw new RepositoryError(`${employee.firstName} ${employee.lastName} behoort niet tot de juridische entiteit van dit project`, 409)
        return { ...entry, employeeId: employee.id, employeeName: `${employee.firstName} ${employee.lastName}`.trim(), role: employee.role }
      }),
    }
  }

  private async validateDailyReportProject(client: SqlClient, tenantId: string, projectId: string, workPackageId?: string) {
    const result = await client.query<ProjectRow>('SELECT * FROM projects WHERE tenant_id=$1 AND id=$2', [tenantId, projectId])
    if (!result.rowCount) throw new RepositoryError('Project niet gevonden', 404)
    if (workPackageId && !this.mapProject(result.rows[0]).workPackages.some(workPackage => workPackage.id === workPackageId)) throw new RepositoryError('Werkpakket behoort niet tot dit project', 409)
  }

  private async validateDailyProductionEntries(client: SqlClient, tenantId: string, projectId: string, entries: DailyProductionEntry[]) {
    if (!entries.length) return
    const projectResult = await client.query<ProjectRow>('SELECT * FROM projects WHERE tenant_id=$1 AND id=$2', [tenantId, projectId])
    if (!projectResult.rowCount) throw new RepositoryError('Project niet gevonden', 404)
    const project = this.mapProject(projectResult.rows[0])
    const calculation = await this.getCalculation(client, tenantId, project.sourceCalculationId)
    if (!calculation) throw new RepositoryError('De broncalculatie voor productiehoeveelheden bestaat niet', 409)
    if (new Set(entries.map(entry => entry.id)).size !== entries.length) throw new RepositoryError('Een productieprestatie komt meer dan eenmaal voor', 409)
    for (const entry of entries) {
      const workPackage = project.workPackages.find(item => item.id === entry.workPackageId)
      if (!workPackage) throw new RepositoryError('Productieprestatie verwijst naar een ongeldig werkpakket', 409)
      const item = workPackageBoqItems(calculation, workPackage).find(candidate => candidate.id === entry.boqItemId)
      if (!item) throw new RepositoryError(`Calculatiepost van productieprestatie behoort niet tot ${workPackage.code}`, 409)
      if (item.unit !== entry.unit) throw new RepositoryError(`Eenheid van productieprestatie ${item.code} komt niet overeen met de calculatie`, 409)
    }
  }

  private async validateChangeOrderLinks(client: SqlClient, tenantId: string, projectId: string, input: ChangeOrderInput) {
    await this.validateDailyReportProject(client, tenantId, projectId, input.workPackageId)
    if (input.dailyReportId) {
      const report = await client.query('SELECT id FROM daily_reports WHERE tenant_id=$1 AND id=$2 AND project_id=$3', [tenantId, input.dailyReportId, projectId])
      if (!report.rowCount) throw new RepositoryError('Dagrapport behoort niet tot dit project', 409)
    }
    if (input.photoIds.length) {
      const photos = await client.query<{ id: string }>('SELECT id FROM site_photos WHERE tenant_id=$1 AND project_id=$2 AND id=ANY($3::uuid[])', [tenantId, projectId, input.photoIds])
      if (photos.rowCount !== new Set(input.photoIds).size) throw new RepositoryError('Een of meer bewijsfoto’s behoren niet tot dit project', 409)
    }
  }

  private async calculateProgressStatement(client: SqlClient, tenantId: string, projectId: string, input: ProgressStatementInput, statementId: string) {
    const projectResult = await client.query<ProjectRow>('SELECT * FROM projects WHERE tenant_id=$1 AND id=$2', [tenantId, projectId])
    if (!projectResult.rowCount) throw new RepositoryError('Project niet gevonden', 404)
    const project = this.mapProject(projectResult.rows[0])
    if (!project.workPackages.length) throw new RepositoryError('Het project heeft geen werkpakketten', 409)
    const inputLines = new Map(input.lines.map(line => [line.workPackageId, line]))
    if (inputLines.size !== input.lines.length || inputLines.size !== project.workPackages.length || project.workPackages.some(workPackage => !inputLines.has(workPackage.id))) throw new RepositoryError('Geef voor ieder werkpakket exact één cumulatieve voortgang op', 409)

    const previousResult = await client.query<ProgressStatementRow>("SELECT * FROM progress_statements WHERE tenant_id=$1 AND project_id=$2 AND id<>$3 AND status<>'Concept' ORDER BY period_end DESC,created_at DESC LIMIT 1", [tenantId, projectId, statementId])
    const previous = previousResult.rowCount ? mapProgressStatement(previousResult.rows[0]) : undefined
    if (previous && input.periodStart <= previous.periodEnd) throw new RepositoryError('De nieuwe periode moet na de vorige ingediende periode starten', 409)
    const previousLines = new Map(previous?.lines.map(line => [line.workPackageId, line]) ?? [])
    const hasAutomatedLines = input.lines.some(line => line.measurementMethod === 'Meetstaat' || line.measurementMethod === 'Dagrapporten')
    const calculation = hasAutomatedLines ? await this.getCalculation(client, tenantId, project.sourceCalculationId) : undefined
    if (hasAutomatedLines && !calculation) throw new RepositoryError('De broncalculatie voor automatische voortgang bestaat niet', 409)
    const approvedReportResult = input.lines.some(line => line.measurementMethod === 'Dagrapporten')
      ? await client.query<DailyReportRow>("SELECT * FROM daily_reports WHERE tenant_id=$1 AND project_id=$2 AND status='Ondertekend' AND report_date<=$3 ORDER BY report_date", [tenantId, projectId, input.periodEnd])
      : undefined
    const approvedReports = approvedReportResult?.rows.map(mapDailyReport) ?? []
    const totalBudget = project.workPackages.reduce((sum, workPackage) => sum + workPackage.budget, 0)
    let allocatedContractValue = 0
    const lines = project.workPackages.map((workPackage, index) => {
      let lineInput = inputLines.get(workPackage.id)!
      if (lineInput.measurementMethod === 'Meetstaat') {
        const evidence = lineInput.meetstaatEvidence
        if (!evidence) throw new RepositoryError(`Meetstaatmeting ontbreekt voor ${workPackage.code}`, 409)
        if (evidence.sourceCalculationId !== project.sourceCalculationId) throw new RepositoryError(`Meetstaatmeting voor ${workPackage.code} gebruikt niet de projectcalculatie`, 409)
        const linkedItems = workPackageBoqItems(calculation, workPackage)
        if (!linkedItems.length) throw new RepositoryError(`Geen calculatieposten gekoppeld aan werkpakket ${workPackage.code}`, 409)
        if (new Set(evidence.measurements.map(item => item.boqItemId)).size !== evidence.measurements.length) throw new RepositoryError(`Meetstaatmeting voor ${workPackage.code} bevat dubbele posten`, 409)
        const linkedIds = new Set(linkedItems.map(item => item.id))
        if (evidence.measurements.length !== linkedItems.length || evidence.measurements.some(item => !linkedIds.has(item.boqItemId))) throw new RepositoryError(`Meetstaatmeting voor ${workPackage.code} is niet volledig gekoppeld aan de calculatie`, 409)
        const recalculatedEvidence = buildMeetstaatEvidence(calculation!, workPackage, evidence.measurements, evidence.measuredBy, evidence.measuredAt)
        lineInput = { ...lineInput, cumulativeProgressPct:recalculatedEvidence.completionPct, meetstaatEvidence:recalculatedEvidence, dailyReportEvidence:undefined, bimEvidence:undefined }
      }
      if (lineInput.measurementMethod === 'Dagrapporten') {
        const evidence = buildDailyReportEvidence(calculation!, project, workPackage, approvedReports, input.periodEnd)
        if (!evidence.productionEntryCount) throw new RepositoryError(`Geen goedgekeurde productieprestaties gevonden voor ${workPackage.code} tot ${input.periodEnd}`, 409)
        lineInput = { ...lineInput, cumulativeProgressPct:evidence.completionPct, dailyReportEvidence:evidence, meetstaatEvidence:undefined, bimEvidence:undefined }
      }
      if (lineInput.measurementMethod === 'BIM') {
        const evidence = lineInput.bimEvidence
        if (!evidence) throw new RepositoryError(`BIM-meetbewijs ontbreekt voor ${workPackage.code}`, 409)
        if (evidence.elementCount !== new Set(evidence.elementIds).size) throw new RepositoryError(`BIM-selectie voor ${workPackage.code} bevat dubbele of ontbrekende elementen`, 409)
        if (evidence.verifiedQuantity > evidence.measuredQuantity) throw new RepositoryError(`Geverifieerde BIM-hoeveelheid voor ${workPackage.code} overschrijdt de gemeten hoeveelheid`, 409)
        if (Math.abs(evidence.completionPct - lineInput.cumulativeProgressPct) > .001) throw new RepositoryError(`BIM-voortgang voor ${workPackage.code} komt niet overeen met het cumulatieve percentage`, 409)
      }
      const contractValue = index === project.workPackages.length - 1 ? cents(project.contractValue - allocatedContractValue) : cents(project.contractValue * (totalBudget > 0 ? workPackage.budget / totalBudget : 1 / project.workPackages.length))
      allocatedContractValue = cents(allocatedContractValue + contractValue)
      const previousLine = previousLines.get(workPackage.id)
      const previousCumulative = previousLine?.cumulativeValue ?? 0
      const previousPct = previousLine?.cumulativeProgressPct ?? 0
      if (lineInput.cumulativeProgressPct < previousPct) throw new RepositoryError(`De cumulatieve voortgang van ${workPackage.code} kan niet dalen onder ${previousPct}%`, 409)
      const cumulativeValue = cents(contractValue * lineInput.cumulativeProgressPct / 100)
      return { ...lineInput, workPackageCode: workPackage.code, workPackageName: workPackage.name, contractValue, previousCumulative, currentPeriod: cents(cumulativeValue - previousCumulative), cumulativeValue }
    })

    if (new Set(input.changeOrderIds).size !== input.changeOrderIds.length) throw new RepositoryError('Een meerwerk kan maar één keer worden geselecteerd', 409)
    let changes: ChangeOrder[] = []
    if (input.changeOrderIds.length) {
      const changeResult = await client.query<ChangeOrderRow>('SELECT * FROM change_orders WHERE tenant_id=$1 AND id=ANY($2::uuid[])', [tenantId, input.changeOrderIds])
      changes = changeResult.rows.map(mapChangeOrder)
      if (changes.length !== input.changeOrderIds.length || changes.some(change => change.projectId !== projectId)) throw new RepositoryError('Een geselecteerd meerwerk behoort niet tot dit project', 409)
      if (changes.some(change => change.status !== 'Klaar voor facturatie' && change.progressStatementId !== statementId)) throw new RepositoryError('Een geselecteerd meerwerk is niet beschikbaar voor deze vorderingsstaat', 409)
    }
    const workAmount = cents(lines.reduce((sum, line) => sum + line.currentPeriod, 0))
    const changeOrderAmount = cents(changes.reduce((sum, change) => sum + change.total, 0))
    let priceRevisionAmount=input.priceRevisionAmount
    let priceRevisionCalculation=input.priceRevisionCalculation
    let revisionFormula=input.revisionFormula
    const blueprint=await this.blueprintState(client,tenantId)
    const contract=blueprint.projectContracts.find(item=>item.projectId===projectId&&item.status==='Actief'&&item.priceRevisionClause)
    if(contract?.priceRevisionClause){
      if(contract.approvalStatus!=='Goedgekeurd')throw new RepositoryError('Laat de gewijzigde prijsherzieningsclausule eerst goedkeuren voordat een vorderingsstaat wordt berekend',409)
      const valuationDate=contract.priceRevisionClause.valuationDateRule==='Waarderingsdatum'?(input.valuationDate??input.periodEnd):input.periodEnd
      try{
        const catalogue=contract.priceRevisionClause.enabled?await this.priceIndexCatalogue():{material:[],labor:[],sources:[],synchronizedAt:new Date().toISOString()}
        const calculation=calculateContractPriceRevision({clause:contract.priceRevisionClause,catalogue,workAmount,changeOrderAmount,valuationDate})
        priceRevisionCalculation=calculation
        priceRevisionAmount=calculation.revisionAmount
        revisionFormula=calculation.formula
      }catch(error){
        if(error instanceof RepositoryError)throw error
        throw new RepositoryError(`Prijsherziening kon niet contractueel worden berekend: ${error instanceof Error?error.message:'onbekende fout'}`,409)
      }
    }
    const grossAmount = cents(workAmount + changeOrderAmount + priceRevisionAmount + (input.advancePaymentAmount??0) - (input.advanceRecoveryAmount??0) - (input.otherDeductionsAmount??0))
    const retentionAmount = cents(grossAmount * input.retentionPct / 100)
    return { lines, workAmount, changeOrderAmount, priceRevisionAmount, priceRevisionCalculation, revisionFormula, grossAmount, retentionAmount, netAmount: cents(grossAmount - retentionAmount) }
  }

  async mailboxOverview(context: RequestContext, configured: boolean, mailbox = ''): Promise<MailboxOverview> {
    const [messages, sync] = await Promise.all([
      this.pool.query<MailboxMessageRow>('SELECT * FROM mailbox_messages WHERE tenant_id=$1 ORDER BY COALESCE(received_at,sent_at,synchronized_at) DESC LIMIT 500', [context.tenantId]),
      this.pool.query<{last_synchronized_at:string|Date|null;last_error:string|null}>('SELECT last_synchronized_at,last_error FROM mailbox_sync_state WHERE tenant_id=$1', [context.tenantId]),
    ])
    return { configured, mailbox, lastSynchronizedAt:sync.rows[0]?.last_synchronized_at?iso(sync.rows[0].last_synchronized_at):undefined, lastSyncError:sync.rows[0]?.last_error??undefined, messages:messages.rows.map(mapMailboxMessage) }
  }

  async synchronizeMailbox(context: RequestContext, mailbox: string, messages: CentralMailMessage[]) {
    const [organizations, opportunities, projects] = await Promise.all([
      this.pool.query<OrganizationRow>('SELECT * FROM organizations WHERE tenant_id=$1', [context.tenantId]),
      this.pool.query<OpportunityRow>('SELECT * FROM opportunities WHERE tenant_id=$1', [context.tenantId]),
      this.pool.query<ProjectRow>('SELECT * FROM projects WHERE tenant_id=$1', [context.tenantId]),
    ])
    for (const message of messages) {
      const searchable = `${message.subject} ${message.bodyPreview}`.toLocaleLowerCase()
      const project = projects.rows.find(item => searchable.includes(item.number.toLocaleLowerCase()))
      const opportunity = opportunities.rows.find(item => searchable.includes(item.project_number.toLocaleLowerCase()))
      const counterparties = message.direction === 'Inkomend' ? [message.fromAddress] : message.toRecipients.map(item=>item.address)
      const organization = organizations.rows.find(item => {
        const contacts = jsonValue<NonNullable<Organization['contacts']>>(item.contacts ?? [])
        return [item.email,...contacts.map(contact=>contact.email)].some(email=>counterparties.includes(email.trim().toLocaleLowerCase()))
      })
      const existing = await this.pool.query<{id:string}>('SELECT id FROM mailbox_messages WHERE tenant_id=$1 AND (provider_message_id=$2 OR ($3::text IS NOT NULL AND correlation_key=$3)) LIMIT 1', [context.tenantId,message.providerMessageId,message.correlationKey??null])
      const id = existing.rows[0]?.id ?? randomUUID()
      await this.pool.query(`INSERT INTO mailbox_messages (tenant_id,id,provider_message_id,internet_message_id,conversation_id,correlation_key,direction,from_name,from_address,to_recipients,cc_recipients,subject,body_preview,received_at,sent_at,is_read,has_attachments,web_link,organization_id,opportunity_id,project_id,synchronized_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,now())
        ON CONFLICT (tenant_id,id) DO UPDATE SET provider_message_id=EXCLUDED.provider_message_id,internet_message_id=EXCLUDED.internet_message_id,conversation_id=EXCLUDED.conversation_id,direction=EXCLUDED.direction,from_name=EXCLUDED.from_name,from_address=EXCLUDED.from_address,to_recipients=EXCLUDED.to_recipients,cc_recipients=EXCLUDED.cc_recipients,subject=EXCLUDED.subject,body_preview=EXCLUDED.body_preview,received_at=EXCLUDED.received_at,sent_at=EXCLUDED.sent_at,is_read=EXCLUDED.is_read,has_attachments=EXCLUDED.has_attachments,web_link=EXCLUDED.web_link,organization_id=COALESCE(mailbox_messages.organization_id,EXCLUDED.organization_id),opportunity_id=COALESCE(mailbox_messages.opportunity_id,EXCLUDED.opportunity_id),project_id=COALESCE(mailbox_messages.project_id,EXCLUDED.project_id),synchronized_at=now()`,
        [context.tenantId,id,message.providerMessageId,message.internetMessageId??null,message.conversationId??null,message.correlationKey??null,message.direction,message.fromName,message.fromAddress,JSON.stringify(message.toRecipients),JSON.stringify(message.ccRecipients),message.subject,message.bodyPreview,message.receivedAt??null,message.sentAt??null,message.isRead,message.hasAttachments,message.webLink??null,organization?.id??null,opportunity?.id??null,project?.id??null])
    }
    await this.pool.query(`INSERT INTO mailbox_sync_state (tenant_id,mailbox,last_synchronized_at,last_error,updated_at) VALUES ($1,$2,now(),null,now()) ON CONFLICT (tenant_id) DO UPDATE SET mailbox=EXCLUDED.mailbox,last_synchronized_at=now(),last_error=null,updated_at=now()`, [context.tenantId,mailbox])
    return this.mailboxOverview(context,true,mailbox)
  }

  async recordMailboxSyncError(context:RequestContext, mailbox:string, error:string) {
    await this.pool.query(`INSERT INTO mailbox_sync_state (tenant_id,mailbox,last_error,updated_at) VALUES ($1,$2,$3,now()) ON CONFLICT (tenant_id) DO UPDATE SET mailbox=EXCLUDED.mailbox,last_error=EXCLUDED.last_error,updated_at=now()`,[context.tenantId,mailbox,error.slice(0,1000)])
  }

  async recordOutgoingMailboxMessage(context:RequestContext, mailbox:string, providerReference:string, correlationKey:string, input:{to:string[];cc?:string[];subject:string;body:string;organizationId?:string;opportunityId?:string;projectId?:string}) {
    const id=randomUUID(); const now=new Date().toISOString()
    await this.pool.query(`INSERT INTO mailbox_messages (tenant_id,id,provider_message_id,correlation_key,direction,from_name,from_address,to_recipients,cc_recipients,subject,body_preview,sent_at,is_read,has_attachments,organization_id,opportunity_id,project_id,synchronized_at) VALUES ($1,$2,$3,$4,'Uitgaand','BouwFlow',$5,$6,$7,$8,$9,$10,true,false,$11,$12,$13,now())`,
      [context.tenantId,id,providerReference,correlationKey,mailbox,JSON.stringify(input.to.map(address=>({name:'',address}))),JSON.stringify((input.cc??[]).map(address=>({name:'',address}))),input.subject,input.body.slice(0,1000),now,input.organizationId??null,input.opportunityId??null,input.projectId??null])
    return (await this.pool.query<MailboxMessageRow>('SELECT * FROM mailbox_messages WHERE tenant_id=$1 AND id=$2',[context.tenantId,id])).rows.map(mapMailboxMessage)[0]
  }

  async mailboxMessage(context:RequestContext,id:string) {
    const result=await this.pool.query<MailboxMessageRow>('SELECT * FROM mailbox_messages WHERE tenant_id=$1 AND id=$2',[context.tenantId,id])
    if(!result.rowCount)throw new RepositoryError('E-mailbericht niet gevonden',404)
    return mapMailboxMessage(result.rows[0])
  }

  async linkMailboxMessage(context:RequestContext,id:string,input:MailboxLinkInput) {
    const result=await this.pool.query<MailboxMessageRow>('UPDATE mailbox_messages SET organization_id=$3,opportunity_id=$4,project_id=$5 WHERE tenant_id=$1 AND id=$2 RETURNING *',[context.tenantId,id,input.organizationId??null,input.opportunityId??null,input.projectId??null])
    if(!result.rowCount)throw new RepositoryError('E-mailbericht niet gevonden',404)
    return mapMailboxMessage(result.rows[0])
  }

  private async lockProgressStatement(client: SqlClient, tenantId: string, statementId: string) {
    const result = await client.query<ProgressStatementRow>('SELECT * FROM progress_statements WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [tenantId, statementId])
    if (!result.rowCount) throw new RepositoryError('Vorderingsstaat niet gevonden', 404)
    return mapProgressStatement(result.rows[0])
  }

  private async lockSalesInvoice(client: SqlClient, tenantId: string, invoiceId: string) {
    const result = await client.query<SalesInvoiceRow>('SELECT * FROM sales_invoices WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [tenantId, invoiceId])
    if (!result.rowCount) throw new RepositoryError('Verkoopfactuur niet gevonden', 404)
    return mapSalesInvoice(result.rows[0])
  }

  private async lockDocument(client: SqlClient, tenantId: string, documentId: string) {
    const result = await client.query<DocumentRow>('SELECT * FROM documents WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [tenantId, documentId])
    if (!result.rowCount) throw new RepositoryError('Document niet gevonden', 404)
    const [versions, recipients, links] = await Promise.all([
      client.query<DocumentVersionRow>('SELECT * FROM document_versions WHERE tenant_id=$1 AND document_id=$2 ORDER BY revision DESC', [tenantId, documentId]),
      client.query<DocumentRecipientRow>('SELECT * FROM document_recipients WHERE tenant_id=$1 AND document_id=$2 ORDER BY delivered_at DESC', [tenantId, documentId]),
      client.query<DocumentRecordLinkRow>('SELECT * FROM document_record_links WHERE tenant_id=$1 AND document_id=$2 ORDER BY created_at DESC', [tenantId, documentId]),
    ])
    return mapDocument(result.rows[0], versions.rows, recipients.rows, links.rows)
  }

  private async lockProcurementRequest(client: SqlClient, tenantId: string, requestId: string) {
    const result = await client.query<ProcurementRequestRow>('SELECT * FROM procurement_requests WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [tenantId, requestId])
    if (!result.rowCount) throw new RepositoryError('Inkoopdossier niet gevonden', 404)
    return mapProcurementRequest(result.rows[0])
  }

  private async lockPurchaseOrder(client: SqlClient, tenantId: string, orderId: string) {
    const result = await client.query<PurchaseOrderRow>('SELECT * FROM purchase_orders WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [tenantId, orderId])
    if (!result.rowCount) throw new RepositoryError('Bestelbon niet gevonden', 404)
    return mapPurchaseOrder(result.rows[0])
  }

  private async lockChangeOrder(client: SqlClient, tenantId: string, changeOrderId: string) {
    const result = await client.query<ChangeOrderRow>('SELECT * FROM change_orders WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [tenantId, changeOrderId])
    if (!result.rowCount) throw new RepositoryError('Meerwerk niet gevonden', 404)
    return mapChangeOrder(result.rows[0])
  }

  private async transitionChangeOrder(context: RequestContext, changeOrderId: string, expected: ChangeOrder['status'], status: ChangeOrder['status'], timestampColumn: 'executed_at' | 'ready_for_invoice_at', action: string): Promise<ChangeOrder> {
    return this.transaction(async client => {
      const current = await this.lockChangeOrder(client, context.tenantId, changeOrderId)
      if (current.status !== expected) throw new RepositoryError(`Status ${expected} is vereist voor deze stap`, 409)
      const timestamp = new Date().toISOString()
      await client.query(`UPDATE change_orders SET status=$3,${timestampColumn}=$4 WHERE tenant_id=$1 AND id=$2`, [context.tenantId, changeOrderId, status, timestamp])
      const updated: ChangeOrder = { ...current, status, ...(timestampColumn === 'executed_at' ? { executedAt: timestamp } : { readyForInvoiceAt: timestamp }) }
      await this.audit(client, context, 'change_order', changeOrderId, action, current, updated)
      return updated
    })
  }

  private async getCalculation(client: SqlClient, tenantId: string, id: string): Promise<Calculation | undefined> {
    const result = await client.query<CalculationRow>('SELECT * FROM calculations WHERE tenant_id=$1 AND id=$2', [tenantId, id])
    if (!result.rowCount) return undefined
    const chapters = await client.query<BoqChapterRow>('SELECT * FROM boq_chapters WHERE tenant_id=$1 AND calculation_id=$2 ORDER BY sort_order', [tenantId, id])
    const items = await client.query<BoqItemRow>('SELECT * FROM boq_items WHERE tenant_id=$1 AND calculation_id=$2 ORDER BY sort_order', [tenantId, id])
    return mapCalculation(result.rows[0], chapters.rows.map(mapChapter), items.rows.map(mapItem))
  }

  private mapProject(row: ProjectRow): Project {
    const handoverValue = jsonValue(row.handover ?? {}) as Partial<ProjectHandover>
    const handover = { ...emptyHandover(), ...handoverValue, checklist: { ...emptyHandover().checklist, ...handoverValue.checklist } }
    const rawPlanning = { ...emptyPlanning(), ...(jsonValue(row.planning ?? {}) as Partial<ProjectPlanning>) }
    const planning = { ...rawPlanning, activities: rawPlanning.activities.map(activity => ({ ...activity, responsible: activity.responsible ?? '', crewSize: activity.crewSize ?? 0, weatherSensitive: activity.weatherSensitive ?? false, resourceAssignments: activity.resourceAssignments ?? [] })) }
    return { id: row.id, number: row.number, name: row.name, organizationId: row.organization_id, legalEntityId: row.legal_entity_id ?? undefined, branchId: row.branch_id ?? undefined, sourceCalculationId: row.source_calculation_id, contractValue: Number(row.contract_value), costBudget: Number(row.cost_budget), marginPct: Number(row.margin_pct), progress: Number(row.progress), status: row.status, handover, workPackages: jsonValue(row.work_packages ?? []), planning }
  }
}

export class RepositoryError extends Error {
  constructor(message: string, readonly statusCode: number) {
    super(message)
  }
}
