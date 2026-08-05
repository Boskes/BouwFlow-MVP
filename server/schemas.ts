import { z } from 'zod'

export const uuidParams = z.object({ id: z.uuid() })

export const workReminderSchema = z.object({
  taskId: z.string().trim().min(1).max(250),
  title: z.string().trim().min(3).max(250),
  message: z.string().trim().min(3).max(5_000),
  channel: z.enum(['E-mail', 'Teams']),
  destination: z.string().trim().min(2).max(500),
}).strict()

export const isValidBelgianEnterpriseNumber = (value: string) => {
  const digits = value.replace(/\D/g, '')
  return /^[01]\d{9}$/.test(digits) && 97 - (Number(digits.slice(0, 8)) % 97) === Number(digits.slice(8))
}

const peppolIdentityFields = {
  addressLine: z.string().trim().max(300),
  postalCode: z.string().trim().max(20),
  city: z.string().trim().max(150),
  countryCode: z.string().trim().length(2).transform(value => value.toUpperCase()),
  peppolEndpointId: z.string().trim().max(100),
  peppolSchemeId: z.string().trim().regex(/^\d{4}$/),
}

const validatePeppolIdentity = (value: { peppolEndpointId: string; peppolSchemeId: string }, context: z.RefinementCtx) => {
  if (value.peppolSchemeId === '0208' && value.peppolEndpointId && !isValidBelgianEnterpriseNumber(value.peppolEndpointId)) {
    context.addIssue({ code: 'custom', message: 'Een Belgisch Peppol-endpoint moet een geldig ondernemingsnummer van 10 cijfers zijn', path: ['peppolEndpointId'] })
  }
}

export const opportunitySchema = z.object({
  title: z.string().trim().min(3).max(200),
  organizationId: z.uuid(),
  legalEntityId: z.uuid().optional(),
  branchId: z.uuid().optional(),
  location: z.string().trim().min(2).max(150),
  deadline: z.iso.date(),
  estimatedValue: z.number().nonnegative().max(1_000_000_000),
  probability: z.number().int().min(0).max(100),
  recognition: z.string().trim().max(50).default(''),
})

export const tenderDossierSchema = z.object({
  procedureType: z.enum(['Openbaar','Niet-openbaar','Onderhandeling','Privaat']),
  publicationDate: z.iso.date().optional(), submissionDeadline: z.iso.datetime(), executionPeriod: z.string().trim().max(500),
  recognitionClass: z.string().trim().max(100), recognitionCategory: z.string().trim().max(100),
  selectionConditions: z.array(z.string().trim().min(2).max(1000)).max(100),
  awardCriteria: z.array(z.object({ id:z.uuid(), criterion:z.string().trim().min(2).max(500), weightPct:z.number().min(0).max(100) })).max(50),
  requiredDocumentIds: z.array(z.uuid()).max(500),
  questions: z.array(z.object({ id:z.uuid(), question:z.string().trim().min(2).max(2000), askedOn:z.iso.date(), answer:z.string().trim().max(5000).optional(), answeredOn:z.iso.date().optional(), status:z.enum(['Open','Beantwoord']) })).max(500),
  siteVisits: z.array(z.object({ id:z.uuid(), scheduledAt:z.iso.datetime(), location:z.string().trim().min(2).max(500), mandatory:z.boolean(), attendees:z.array(z.string().trim().min(2).max(200)).max(200), notes:z.string().trim().max(3000), completedAt:z.iso.datetime().optional() })).max(100),
  competitors: z.array(z.string().trim().min(2).max(200)).max(200), deadlineWarningDays: z.array(z.number().int().min(0).max(365)).max(20),
  approvedBy: z.string().trim().min(2).max(200).optional(), approvedAt:z.iso.datetime().optional(), updatedAt:z.iso.datetime(),
}).superRefine((value,context)=>{const total=value.awardCriteria.reduce((sum,item)=>sum+item.weightPct,0);if(value.awardCriteria.length&&Math.abs(total-100)>0.01)context.addIssue({code:'custom',message:'Gunningscriteria moeten samen 100% zijn',path:['awardCriteria']})})

export const projectDetailsSchema = z.object({
  name: z.string().trim().min(3).max(200),
  organizationId: z.uuid(),
  progress: z.number().min(0).max(100),
  status: z.enum(['Opstart', 'Op schema', 'Risico']),
}).strict()

const goNoGoScoreSchema = z.number().int().min(1).max(5)
export const opportunityGoNoGoSchema = z.object({
  decision: z.enum(['Go', 'No-Go']),
  scores: z.object({
    capacity: goNoGoScoreSchema,
    financialRisk: goNoGoScoreSchema,
    recognition: goNoGoScoreSchema,
    technicalFeasibility: goNoGoScoreSchema,
    expectedMargin: goNoGoScoreSchema,
    competition: goNoGoScoreSchema,
    strategicValue: goNoGoScoreSchema,
    resources: goNoGoScoreSchema,
    subcontractors: goNoGoScoreSchema,
    contractRisk: goNoGoScoreSchema,
  }).strict(),
  notes: z.string().trim().min(3).max(2_000),
  assessedBy: z.string().trim().min(2).max(200),
}).strict()

export const legalEntitySchema = z.object({
  name: z.string().trim().min(2).max(200),
  vatNumber: z.string().trim().min(5).max(40),
  country: z.string().trim().min(2).max(100),
  currency: z.string().trim().length(3).transform(value => value.toUpperCase()),
  active: z.boolean(),
  invoicePrefix: z.string().trim().min(1).max(12).transform(value => value.toUpperCase()).optional(),
  nextInvoiceNumber: z.number().int().min(1).max(999_999_999).optional(),
  defaultVatPct: z.number().min(0).max(100).optional(),
  iban: z.string().trim().max(50).optional(),
  bic: z.string().trim().max(20).optional(),
  paymentTermsDays: z.number().int().min(0).max(365).optional(),
  addressLine: peppolIdentityFields.addressLine.optional(),
  postalCode: peppolIdentityFields.postalCode.optional(),
  city: peppolIdentityFields.city.optional(),
  countryCode: peppolIdentityFields.countryCode.optional(),
  peppolEndpointId: peppolIdentityFields.peppolEndpointId.optional(),
  peppolSchemeId: peppolIdentityFields.peppolSchemeId.optional(),
})

export const legalEntityFinancialSchema = z.object({
  vatNumber: z.string().trim().min(5).max(40),
  invoicePrefix: z.string().trim().min(1).max(12).transform(value => value.toUpperCase()),
  nextInvoiceNumber: z.number().int().min(1).max(999_999_999),
  defaultVatPct: z.number().min(0).max(100),
  iban: z.string().trim().max(50),
  bic: z.string().trim().max(20),
  paymentTermsDays: z.number().int().min(0).max(365),
  ...peppolIdentityFields,
}).superRefine(validatePeppolIdentity)

export const organizationBillingSchema = z.object({
  vatNumber: z.string().trim().max(40),
  ...peppolIdentityFields,
}).superRefine(validatePeppolIdentity)

const organizationRoleSchema = z.enum(['Prospect','Klant','Opdrachtgever','Architect','Studiebureau','Hoofdaannemer','Onderaannemer','Leverancier','Vastgoedontwikkelaar','Intercommunale','Gemeente','Overheidsdienst','Nutsmaatschappij','Partner','Consultant','Verzekeraar','Financier'])
const organizationContactSchema = z.object({
  id: z.uuid(), firstName: z.string().trim().min(1).max(100), lastName: z.string().trim().max(100),
  jobTitle: z.string().trim().max(150), department: z.string().trim().max(150), email: z.email().max(320),
  phone: z.string().trim().max(50), mobile: z.string().trim().max(50), isPrimary: z.boolean(), active: z.boolean(),
})
const organizationAddressSchema = z.object({
  id: z.uuid(),
  type: z.enum(['Bezoekadres', 'Maatschappelijke zetel', 'Facturatieadres', 'Leveringsadres', 'Correspondentieadres', 'Werfadres', 'Ander']),
  label: z.string().trim().max(150),
  addressLine: peppolIdentityFields.addressLine,
  postalCode: peppolIdentityFields.postalCode,
  city: peppolIdentityFields.city,
  countryCode: peppolIdentityFields.countryCode,
  isPrimary: z.boolean(),
  notes: z.string().trim().max(1000),
})

export const crmActivitySchema = z.object({
  type:z.enum(['Telefoongesprek','E-mail','Afspraak','Bezoek','Taak','Notitie']), subject:z.string().trim().min(2).max(500),
  startsAt:z.iso.datetime(), endsAt:z.iso.datetime().optional(), contactId:z.uuid().optional(), ownerEmployeeId:z.uuid().optional(),
  status:z.enum(['Gepland','Voltooid','Geannuleerd']), notes:z.string().trim().max(3000), createdBy:z.string().trim().min(2).max(200),
}).refine(value=>!value.endsAt||value.endsAt>=value.startsAt,{message:'Eindtijd ligt voor de starttijd',path:['endsAt']})

export const organizationRelationSchema = z.object({
  relatedOrganizationId:z.uuid(), type:z.enum(['Moederbedrijf','Dochterbedrijf','Partner','Combinatie','Opdrachtgever','Architect','Studiebureau','Hoofdaannemer','Onderaannemer','Leverancier']), notes:z.string().trim().max(1000),
})

export const organizationSchema = z.object({
  name: z.string().trim().min(2).max(200),
  type: z.enum(['Overheid', 'Privaat', 'Nutsbedrijf']),
  contactName: z.string().trim().min(2).max(200),
  email: z.email().max(320),
  vatNumber: z.string().trim().max(40).default(''),
  addressLine: peppolIdentityFields.addressLine.default(''),
  postalCode: peppolIdentityFields.postalCode.default(''),
  city: peppolIdentityFields.city.default(''),
  countryCode: peppolIdentityFields.countryCode.default('BE'),
  peppolEndpointId: peppolIdentityFields.peppolEndpointId.default(''),
  peppolSchemeId: peppolIdentityFields.peppolSchemeId.default('0208'),
  roles: z.array(organizationRoleSchema).min(1).max(17).default(['Prospect']),
  contacts: z.array(organizationContactSchema).max(100).default([]),
  addresses: z.array(organizationAddressSchema).max(100).default([]),
}).superRefine((value, context) => {
  validatePeppolIdentity(value, context)
  if (value.addresses.length && value.addresses.filter(address => address.isPrimary).length !== 1) context.addIssue({ code: 'custom', message: 'Duid precies één primair adres aan', path: ['addresses'] })
  if (value.contacts.length && value.contacts.filter(contact => contact.isPrimary).length !== 1) context.addIssue({ code: 'custom', message: 'Duid precies één primair contact aan', path: ['contacts'] })
})

export const assetSchema = z.object({
  code: z.string().trim().min(2).max(50), name: z.string().trim().min(2).max(200),
  category: z.enum(['Machine', 'Vrachtwagen', 'Bestelwagen', 'Gereedschap', 'Container', 'Keetwagen', 'Meetapparatuur']),
  status: z.enum(['Beschikbaar', 'Ingezet', 'Onderhoud', 'Defect', 'Buiten dienst']), location: z.string().trim().max(200),
  hourlyRate: z.number().nonnegative().max(100_000), projectId: z.uuid().optional(), inspectionExpiresOn: z.iso.date().optional(), maintenanceDueOn: z.iso.date().optional(),
  insurer: z.string().trim().max(200).optional(), insurancePolicyNumber: z.string().trim().max(100).optional(), insuranceExpiresOn: z.iso.date().optional(),
  mileage: z.number().nonnegative().max(100_000_000), operatingHours: z.number().nonnegative().max(10_000_000),
})

export const warehouseSchema = z.object({ name: z.string().trim().min(2).max(200), location: z.string().trim().min(2).max(250) })
export const inventoryItemSchema = z.object({ sku: z.string().trim().min(2).max(80), name: z.string().trim().min(2).max(200), unit: z.string().trim().min(1).max(30), minimumStock: z.number().nonnegative().max(1_000_000_000), maximumStock: z.number().nonnegative().max(1_000_000_000),defaultPurchasePrice:z.number().nonnegative().max(1_000_000_000).optional(),lotTracking:z.boolean().optional(),serialTracking:z.boolean().optional() }).refine(value => value.maximumStock >= value.minimumStock, { message: 'Maximumvoorraad moet minstens de minimumvoorraad zijn', path: ['maximumStock'] })
export const stockMovementSchema = z.object({ inventoryItemId: z.uuid(), warehouseId: z.uuid(), projectId: z.uuid().optional(), type: z.enum(['Ontvangst', 'Uitgifte', 'Retour', 'Correctie', 'Reservatie', 'Vrijgave']), quantity: z.number().positive().max(1_000_000_000), reference: z.string().trim().min(2).max(200), performedBy: z.string().trim().min(2).max(200),lotNumber:z.string().trim().max(100).optional(),serialNumbers:z.array(z.string().trim().min(1).max(100)).max(1000).optional(),scanCode:z.string().trim().max(200).optional() })
export const inventoryCountSchema=z.object({warehouseId:z.uuid(),countedQuantity:z.number().min(0).max(1_000_000_000),countedBy:z.string().trim().min(2).max(200),notes:z.string().trim().max(1_000),lotNumber:z.string().trim().max(100).optional()}).strict()

export const employeeSchema = z.object({ employeeNumber: z.string().trim().min(2).max(50), firstName: z.string().trim().min(2).max(100), lastName: z.string().trim().min(2).max(100), email: z.email().max(320), role: z.string().trim().min(2).max(150), legalEntityId: z.uuid(), branchId: z.uuid().optional(), employmentPct: z.number().int().min(1).max(100), weeklyHours: z.number().positive().max(80), annualLeaveHours: z.number().nonnegative().max(1000), hireDate: z.iso.date(), endDate: z.iso.date().optional(), skills: z.array(z.string().trim().min(2).max(100)).max(100), active: z.boolean() }).refine(value => !value.endDate || value.endDate >= value.hireDate, { message: 'Einddatum ligt voor de startdatum', path: ['endDate'] })
export const employeeCrewSchema = z.object({ name:z.string().trim().min(2).max(150), legalEntityId:z.uuid(), branchId:z.uuid().optional(), leaderEmployeeId:z.uuid(), memberEmployeeIds:z.array(z.uuid()).min(1).max(100), active:z.boolean() })
export const employeeAbsenceSchema = z.object({ employeeId: z.uuid(), type: z.enum(['Verlof','Ziekte','Opleiding','Feestdag','Tijdelijke werkloosheid','Andere']), startDate: z.iso.date(), endDate: z.iso.date(), hours: z.number().positive().max(1000), reason: z.string().trim().max(1000), requestedBy: z.string().trim().min(2).max(200) }).refine(value => value.endDate >= value.startDate, { message: 'Einddatum ligt voor de startdatum', path: ['endDate'] })
export const employeeAbsenceDecisionSchema = z.object({ status: z.enum(['Goedgekeurd','Geweigerd']), decidedBy: z.string().trim().min(2).max(200) })

export const subcontractorSchema = z.object({ organizationId: z.uuid().optional(), name: z.string().trim().min(2).max(200), vatNumber: z.string().trim().min(5).max(40), contactName: z.string().trim().min(2).max(200), email: z.email(), insuranceExpiresOn: z.iso.date().optional(), vcaExpiresOn: z.iso.date().optional(), hourlyRate: z.number().nonnegative().max(100_000), projectIds: z.array(z.uuid()).max(100) })

export const subcontractorOperationSchema=z.discriminatedUnion('kind',[
  z.object({kind:z.literal('employee'),value:z.object({name:z.string().trim().min(2).max(200),role:z.string().trim().min(2).max(100),certificate:z.string().trim().min(2).max(200),certificateExpiresOn:z.iso.date().optional()})}),
  z.object({kind:z.literal('agreement'),value:z.object({number:z.string().trim().min(2).max(100),projectId:z.uuid(),title:z.string().trim().min(3).max(300),contractValue:z.number().positive(),retentionPct:z.number().min(0).max(100),penaltyPerDay:z.number().min(0),startDate:z.iso.date(),endDate:z.iso.date(),status:z.enum(['Concept','Actief','Afgesloten']),documentIds:z.array(z.uuid()).max(100)}).refine(value=>value.endDate>=value.startDate,{message:'Einddatum moet na startdatum liggen',path:['endDate']})}),
  z.object({kind:z.literal('progress'),value:z.object({projectId:z.uuid(),periodEnd:z.iso.date(),grossAmount:z.number().positive(),penaltyAmount:z.number().min(0),notes:z.string().trim().max(2_000)})}),
  z.object({kind:z.literal('evaluation'),value:z.object({projectId:z.uuid(),date:z.iso.date(),quality:z.number().int().min(1).max(5),safety:z.number().int().min(1).max(5),planning:z.number().int().min(1).max(5),administration:z.number().int().min(1).max(5),notes:z.string().trim().max(2_000),evaluatedBy:z.string().trim().min(2).max(150)})}),
  z.object({kind:z.literal('documents'),value:z.object({documentIds:z.array(z.uuid()).max(200)})}),
])
export const subcontractorProgressDecisionSchema=z.object({status:z.enum(['Goedgekeurd','Afgewezen'])}).strict()
export const qhseEventSchema = z.object({ projectId: z.uuid(), eventDate: z.iso.date(), type: z.enum(['Incident','Bijna-ongeval','Milieumelding','LMRA','Toolboxmeeting','Werkvergunning','PBM-uitgifte']), title: z.string().trim().min(3).max(200), description: z.string().trim().min(3).max(3000), severity: z.enum(['Laag','Middel','Hoog','Kritiek']), reporter: z.string().trim().min(2).max(200), responsible: z.string().trim().min(2).max(200), dueDate: z.iso.date().optional(), correctiveAction: z.string().trim().max(3000), participants: z.array(z.string().trim().min(2).max(200)).max(200) })
export const jointVentureSchema = z.object({ name: z.string().trim().min(2).max(200), type: z.enum(['THV','Combinatie','Gezamenlijk project']), projectId: z.uuid().optional(), country: z.string().trim().min(2).max(100), currency: z.string().trim().length(3).transform(value => value.toUpperCase()), vatRule: z.string().trim().min(2).max(500), members: z.array(z.object({ legalEntityId: z.uuid(), sharePct: z.number().positive().max(100), lead: z.boolean() })).min(2).max(20) }).superRefine((value, context) => { const total = value.members.reduce((sum, item) => sum + item.sharePct, 0); if (Math.abs(total - 100) > 0.01) context.addIssue({ code:'custom', message:'Deelnemingspercentages moeten samen 100% zijn', path:['members'] }); if (value.members.filter(item => item.lead).length !== 1) context.addIssue({ code:'custom', message:'Duid precies één leidende entiteit aan', path:['members'] }) })
export const integrationConnectionSchema = z.object({ name: z.string().trim().min(2).max(200), provider: z.enum(['Exact Online','Business Central','Dynamics 365','Odoo','SAP','Generieke REST','CSV/SFTP']), legalEntityId: z.uuid(), endpoint: z.string().trim().max(500) })
export const integrationJobSchema = z.object({ connectionId: z.uuid(), entityType: z.enum(['Verkoopfactuur','Leveranciersfactuur','Klant','Project','Uren']), entityId: z.string().trim().min(1).max(200), direction: z.enum(['Export','Import']) })
export const aiAnalysisSchema = z.object({ type: z.enum(['Besteksamenvatting','Contractrisico','Ontbrekende documenten','Projectvraag','Claimbrief']), question: z.string().trim().min(3).max(3000), createdBy: z.string().trim().min(2).max(200) })
export const aiApprovalSchema = z.object({ approvedBy: z.string().trim().min(2).max(200) })
const contractObligationSchema = z.object({ id: z.uuid(), title: z.string().trim().min(2).max(300), dueDate: z.iso.date(), owner: z.string().trim().min(2).max(200), sourceDocumentId: z.uuid().optional(), status: z.enum(['Open','Voltooid','Te laat']), completedAt: z.iso.datetime().optional() })
const contractRiskSchema = z.object({ id: z.uuid(), description: z.string().trim().min(3).max(1000), impact: z.enum(['Laag','Middel','Hoog']), mitigation: z.string().trim().max(1000), owner: z.string().trim().min(2).max(200), status: z.enum(['Open','Beheerst','Gesloten']) })
const contractSecuritySchema = z.object({ id:z.uuid(), type:z.enum(['Borgstelling','Bankgarantie','Verzekering']), reference:z.string().trim().min(2).max(200), issuer:z.string().trim().min(2).max(200), amount:z.number().nonnegative().max(1_000_000_000), expiresOn:z.iso.date().optional(), status:z.enum(['Actief','Vrijgave aangevraagd','Vrijgegeven','Vervallen']) })
const contractCorrespondenceSchema = z.object({ id:z.uuid(), date:z.iso.date(), type:z.enum(['Brief','E-mail','Verslag','Ingebrekestelling','Termijnmelding']), subject:z.string().trim().min(2).max(500), sender:z.string().trim().min(2).max(200), recipient:z.string().trim().min(2).max(200), documentId:z.uuid().optional() })
const contractClaimSchema = z.object({ id:z.uuid(), number:z.string().trim().min(2).max(100), title:z.string().trim().min(2).max(500), amount:z.number().min(-1_000_000_000).max(1_000_000_000), scheduleImpactDays:z.number().int().min(-3650).max(3650), status:z.enum(['Concept','Ingediend','In behandeling','Aanvaard','Afgewezen']), submittedAt:z.iso.datetime().optional() })
export const priceRevisionClauseSchema=z.object({
  enabled:z.boolean(),formulaType:z.literal('I-2021 en S'),laborWeightPct:z.number().min(0).max(100),materialWeightPct:z.number().min(0).max(100),fixedWeightPct:z.number().min(0).max(100),
  laborCategory:z.enum(['A','B','C','D']),employerSize:z.enum(['Minder dan 10','10 tot 20','Meer dan 20']),baseDate:z.iso.date(),baseMaterialPeriod:z.string().regex(/^\d{4}-\d{2}$/),
  valuationDateRule:z.enum(['Waarderingsdatum','Einde vorderingsperiode']),availabilityPolicy:z.enum(['Laatste officiële index','Voorlopig met correctie','Exacte periode vereist']),applicationBase:z.enum(['Werken','Werken en meerwerken']),sourceClauseReference:z.string().trim().min(2).max(500),
}).refine(value=>Math.abs(value.laborWeightPct+value.materialWeightPct+value.fixedWeightPct-100)<.001,{message:'De formulegewichten moeten samen 100% zijn',path:['fixedWeightPct']})
const projectContractBaseSchema = z.object({ title: z.string().trim().min(2).max(300), signedOn: z.iso.date(), executionStart: z.iso.date(), executionEnd: z.iso.date(), paymentTerms: z.string().trim().min(2).max(500), retentionPct: z.number().min(0).max(100), penaltyPerDay: z.number().nonnegative().max(10_000_000), priceRevision: z.string().trim().max(1000), priceRevisionClause:priceRevisionClauseSchema.optional(), contractNumber:z.string().trim().max(100).optional(), contractType:z.enum(['Openbare opdracht','Private aanneming','Onderaanneming','THV']).optional(), clientOrganizationId:z.uuid().optional(), contractValue:z.number().nonnegative().max(10_000_000_000).optional(), currency:z.string().trim().length(3).optional(), documentIds:z.array(z.uuid()).max(500).optional(), securities:z.array(contractSecuritySchema).max(100).optional(), correspondence:z.array(contractCorrespondenceSchema).max(1000).optional(), claims:z.array(contractClaimSchema).max(500).optional(), obligations: z.array(contractObligationSchema).max(200), risks: z.array(contractRiskSchema).max(200) })
export const projectContractSchema = projectContractBaseSchema.refine(value => value.executionEnd >= value.executionStart, { message:'Uitvoeringseinde ligt voor de start', path:['executionEnd'] })
export const projectContractUpdateSchema = projectContractBaseSchema.partial().extend({ status:z.enum(['Concept','Actief','Afgesloten']).optional() })
export const projectCloseoutSchema = z.object({ status: z.enum(['Voorbereiding','Voorlopig opgeleverd','Definitief opgeleverd','Nazorg']), provisionalAcceptanceOn: z.iso.date().optional(), definitiveAcceptanceOn: z.iso.date().optional(), guaranteeUntil: z.iso.date().optional(), bondReleaseStatus: z.enum(['Niet aangevraagd','Aangevraagd','Vrijgegeven']), asBuiltComplete: z.boolean(), maintenanceFileComplete: z.boolean(), acceptanceDocumentIds:z.array(z.uuid()).max(500).optional(), asBuiltDocumentIds:z.array(z.uuid()).max(500).optional(), maintenanceDocumentIds:z.array(z.uuid()).max(500).optional(), guaranteeDocumentIds:z.array(z.uuid()).max(500).optional(), bondAmount:z.number().nonnegative().max(1_000_000_000).optional(), bondReleasedAmount:z.number().nonnegative().max(1_000_000_000).optional(), customerSignedBy:z.string().trim().min(2).max(200).optional(), customerSignedAt:z.iso.datetime().optional() })
export const closeoutItemSchema = z.object({ description: z.string().trim().min(3).max(1000), responsible: z.string().trim().min(2).max(200), dueDate: z.iso.date(), location:z.string().trim().max(300).optional(), workPackageId:z.uuid().optional(), photoIds:z.array(z.uuid()).max(100).optional() })
export const serviceRequestSchema = z.object({ title: z.string().trim().min(3).max(300), description: z.string().trim().min(3).max(3000), reportedAt: z.iso.date() })

export const intercompanyChargeSchema = z.object({
  fromLegalEntityId: z.uuid(),
  toLegalEntityId: z.uuid(),
  projectId: z.uuid().optional(),
  description: z.string().trim().min(3).max(500),
  baseAmount: z.number().positive().max(1_000_000_000),
  markupPct: z.number().min(0).max(100),
}).refine(value => value.fromLegalEntityId !== value.toLegalEntityId, { message: 'Verzendende en ontvangende entiteit moeten verschillen', path: ['toLegalEntityId'] })

export const companyBranchSchema = z.object({
  name: z.string().trim().min(2).max(150),
  address: z.string().trim().min(3).max(300),
  country: z.string().trim().min(2).max(100),
})

export const projectCompanyAssignmentSchema = z.object({
  legalEntityId: z.uuid(),
  branchId: z.uuid().optional(),
})

export const companyUserAccessSchema = z.object({
  allLegalEntities: z.boolean(),
  legalEntityIds: z.array(z.uuid()).max(100),
  allProjects: z.boolean().default(true),
  projectIds: z.array(z.uuid()).max(500).default([]),
}).superRefine((value, context) => {
  if (!value.allLegalEntities && !value.legalEntityIds.length) context.addIssue({ code: 'custom', message: 'Selecteer minstens één juridische entiteit' })
  if (!value.allProjects && !value.projectIds.length) context.addIssue({ code:'custom', message:'Selecteer minstens één project' })
})

const companyRoleSchema = z.enum(['Administrator','Directie','Commercieel medewerker','Calculator','Tender manager','Projectdirecteur','Projectmanager','Werkvoorbereider','Planner','Werfleider','Ploegbaas','Arbeider','Aankoper','Magazijnier','Financiële administratie','HR','Preventieadviseur','Kwaliteitsverantwoordelijke','Klant','Onderaannemer','Leverancier'])

export const companyUserProfileSchema = z.object({
  displayName:z.string().trim().min(2).max(200), email:z.email().max(320), role:companyRoleSchema, roles:z.array(companyRoleSchema).min(1).max(8).optional(),
  status:z.enum(['Uitgenodigd','Actief','Geblokkeerd']), employeeId:z.uuid().optional(), organizationId:z.uuid().optional(), subcontractorId:z.uuid().optional(), supplierId:z.uuid().optional(),
  allLegalEntities:z.boolean(), legalEntityIds:z.array(z.uuid()).max(100), allProjects:z.boolean(), projectIds:z.array(z.uuid()).max(500),
}).superRefine((value,context)=>{
  if(value.roles&&!value.roles.includes(value.role))context.addIssue({code:'custom',message:'De primaire rol moet ook bij de dashboardrollen staan',path:['roles']})
  if(!value.allLegalEntities&&!value.legalEntityIds.length)context.addIssue({code:'custom',message:'Selecteer minstens één juridische entiteit',path:['legalEntityIds']})
  if(!value.allProjects&&!value.projectIds.length)context.addIssue({code:'custom',message:'Selecteer minstens één project',path:['projectIds']})
  if(value.role==='Klant'&&!value.organizationId)context.addIssue({code:'custom',message:'Koppel de klantaccount aan een relatie',path:['organizationId']})
  if(value.role==='Onderaannemer'&&!value.subcontractorId)context.addIssue({code:'custom',message:'Koppel de account aan een onderaannemer',path:['subcontractorId']})
  if(value.role==='Leverancier'&&!value.supplierId)context.addIssue({code:'custom',message:'Koppel de account aan een leverancier',path:['supplierId']})
})

const workflowStepSchema=z.object({id:z.string().trim().min(1).max(100),label:z.string().trim().min(2).max(120),ownerRole:z.string().trim().min(2).max(100),slaHours:z.number().int().positive().max(8760).optional(),required:z.boolean()})
export const workflowDefinitionSchema=z.object({name:z.string().trim().min(2).max(150),dossierType:z.enum(['opportunity','document','contract','daily-report','change-order','progress-statement','employee-absence','time-entry','project-claim','qhse-inspection']),active:z.boolean(),steps:z.array(workflowStepSchema).min(2).max(20)})
export const workflowCorrectionSchema=z.object({
  dossierType:z.enum(['opportunity','document','contract','daily-report','change-order','progress-statement','employee-absence','time-entry','project-claim','qhse-inspection']),
  recordId:z.uuid(),
  targetStatus:z.string().trim().min(2).max(100),
  reason:z.string().trim().min(10).max(2_000),
})

export const calculationPatchSchema = z.object({
  overheadPct: z.number().min(0).max(100).optional(),
  riskPct: z.number().min(0).max(100).optional(),
  marginPct: z.number().min(0).max(99).optional(),
  siteOverheadPct: z.number().min(0).max(100).optional(),
  escalationPct: z.number().min(-50).max(100).optional(),
  discountPct: z.number().min(0).max(100).optional(),
  roundingStep: z.number().min(0).max(1_000_000).optional(),
}).refine(value => Object.keys(value).length > 0, 'Minstens één wijziging is verplicht')

const boqFormulaFieldSchema = z.enum(['quantity','labor','material','equipment','subcontracting','wastePct','itemRiskPct','markupPct','baseUnitCost'])
const boqFormulaTokenSchema = z.discriminatedUnion('kind',[
  z.object({id:z.uuid(),kind:z.literal('field'),field:boqFormulaFieldSchema}),
  z.object({id:z.uuid(),kind:z.literal('variable'),variableId:z.uuid()}),
  z.object({id:z.uuid(),kind:z.literal('number'),value:z.number().finite().min(-1_000_000_000).max(1_000_000_000)}),
  z.object({id:z.uuid(),kind:z.literal('operator'),operator:z.enum(['+','-','*','/','%','^','(',')'])}),
])
const boqFormulaSchema = z.object({id:z.uuid(),label:z.string().trim().min(1).max(100),tokens:z.array(boqFormulaTokenSchema).min(1).max(100),updatedAt:z.iso.datetime()})
const boqFormulaMapSchema = z.object({quantity:boqFormulaSchema,labor:boqFormulaSchema,material:boqFormulaSchema,equipment:boqFormulaSchema,subcontracting:boqFormulaSchema,wastePct:boqFormulaSchema,itemRiskPct:boqFormulaSchema,markupPct:boqFormulaSchema}).partial()
const boqVariableSchema = z.object({id:z.uuid(),name:z.string().trim().min(1).max(80),value:z.number().finite().min(-1_000_000_000).max(1_000_000_000),unit:z.string().trim().max(20)})
const boqPriceAdjustmentSchema = z.object({id:z.uuid(),label:z.string().trim().min(1).max(100),type:z.enum(['Markup','Markdown']),basis:z.enum(['Directe kost','Arbeid','Materiaal','Materieel','Onderaanneming']),percentage:z.number().min(0).max(1000),active:z.boolean()})

export const boqItemSchema = z.object({
  chapterId: z.uuid().nullable().optional(),
  code: z.string().trim().min(1).max(50),
  description: z.string().trim().min(2).max(500),
  quantity: z.number().nonnegative().max(1_000_000_000),
  unit: z.string().trim().min(1).max(20),
  labor: z.number().nonnegative().max(1_000_000),
  material: z.number().nonnegative().max(1_000_000),
  equipment: z.number().nonnegative().max(1_000_000),
  subcontracting: z.number().nonnegative().max(1_000_000),
  postType: z.enum(['Meetstaatpost','Samengestelde post','Percentagepost','Stelpost','Optiepost','Tekstregel','Subtotaal']).optional(),
  sortOrder: z.number().int().nonnegative().optional(),
  quantityType: z.enum(['Forfaitair', 'Vermoedelijk', 'Verrekenbaar', 'Optioneel']).optional(),
  wastePct: z.number().min(0).max(1000).optional(),
  itemRiskPct: z.number().min(0).max(1000).optional(),
  markupPct: z.number().min(-100).max(1000).optional(),
  notes: z.string().max(2000).optional(),
  variables: z.array(boqVariableSchema).max(50).optional(),
  formulas: boqFormulaMapSchema.optional(),
  priceAdjustments: z.array(boqPriceAdjustmentSchema).max(50).optional(),
  responsibleUserId: z.uuid().optional(),
  workflowStatus: z.enum(['Niet gestart','In bewerking','Ter controle','Goedgekeurd']).optional(),
  workPackageId: z.uuid().optional(),
  planningActivityId: z.uuid().optional(),
  bimElementIds: z.array(z.string().trim().min(1).max(200)).max(500).optional(),
  lidarScanIds: z.array(z.uuid()).max(100).optional(),
})

export const boqItemPatchSchema = boqItemSchema.partial().refine(
  value => Object.keys(value).length > 0,
  'Minstens één wijziging is verplicht',
)

export const chapterSchema = z.object({
  code: z.string().trim().min(1).max(50),
  name: z.string().trim().min(2).max(200),
  parentChapterId: z.uuid().nullable().optional(),
  responsibleUserId: z.uuid().optional(),
  workflowStatus: z.enum(['Niet gestart','In bewerking','Ter controle','Goedgekeurd']).optional(),
})

export const calculationVersionSchema = z.object({
  label: z.string().trim().min(2).max(150),
  reason: z.string().trim().max(500).default(''),
})

export const costLibraryItemSchema = z.object({
  libraryVersionId: z.uuid().optional(),
  code: z.string().trim().min(2).max(50),
  name: z.string().trim().min(2).max(200),
  category: z.enum(['labor', 'material', 'equipment', 'subcontracting']),
  unit: z.string().trim().min(1).max(20),
  unitCost: z.number().nonnegative().max(1_000_000),
  source: z.string().trim().max(250).default(''),
})

export const costLibrarySchema = z.object({
  name: z.string().trim().min(2).max(150),
  description: z.string().trim().max(500).default(''),
  legalEntityId: z.uuid().optional(),
  branchId: z.uuid().optional(),
}).refine(value => !value.branchId || Boolean(value.legalEntityId), { message: 'Een vestigingsbibliotheek vereist een juridische entiteit', path: ['legalEntityId'] })

export const costLibraryPatchSchema = z.object({ active: z.boolean().optional(), legalEntityId: z.uuid().nullable().optional(), branchId: z.uuid().nullable().optional() }).strict().refine(value => Object.keys(value).length > 0, 'Minstens één wijziging is verplicht')

export const unitSchema = z.object({
  code: z.string().trim().min(1).max(20),
  name: z.string().trim().min(2).max(100),
  category: z.enum(['Lengte', 'Oppervlakte', 'Volume', 'Massa', 'Tijd', 'Aantal', 'Globaal', 'Overig']),
  active: z.boolean().default(true),
}).strict()
export const unitPatchSchema = unitSchema.partial().refine(value => Object.keys(value).length > 0, 'Minstens één wijziging is verplicht')
export const unitConversionSchema = z.object({ fromUnitId: z.uuid(), toUnitId: z.uuid(), factor: z.number().positive().max(1_000_000_000) }).strict().refine(value => value.fromUnitId !== value.toUnitId, { message: 'Bron- en doeleenheid moeten verschillen', path: ['toUnitId'] })
export const bulkCostUpdateSchema = z.object({ itemIds: z.array(z.uuid()).min(1).max(5000), libraryId: z.uuid() }).strict()
export const bulkPriceAdjustmentSchema = z.object({ itemIds: z.array(z.uuid()).min(1).max(5000), adjustment: boqPriceAdjustmentSchema }).strict()

export const costLibraryVersionSchema = z.object({
  label: z.string().trim().min(2).max(150),
  effectiveFrom: z.iso.date(),
  cloneFromVersionId: z.uuid().optional(),
})

export const calculationStructureSchema = z.object({
  chapters: z.array(z.object({
    id: z.uuid(),
    sortOrder: z.number().int().nonnegative(),
    code: z.string().trim().min(1).max(50).optional(),
    name: z.string().trim().min(2).max(200).optional(),
    parentChapterId: z.uuid().nullable().optional(),
    responsibleUserId: z.uuid().nullable().optional(),
    workflowStatus: z.enum(['Niet gestart','In bewerking','Ter controle','Goedgekeurd']).optional(),
  })).max(1000),
  items: z.array(z.object({ id: z.uuid(), chapterId: z.uuid().nullable().optional(), sortOrder: z.number().int().nonnegative() })).max(20_000),
})

const calculationTemplateItemSchema = boqItemSchema.omit({ chapterId: true, sortOrder: true }).extend({ id: z.never().optional() })
export const calculationTemplateSchema = z.object({
  id: z.string().trim().min(2).max(100),
  name: z.string().trim().min(2).max(150),
  description: z.string().trim().max(500),
  discipline: z.string().trim().min(2).max(100),
  recognitionClass: z.literal('Klasse 8'),
  version: z.number().int().positive(),
  chapters: z.array(z.object({ code: z.string().trim().min(1).max(50), name: z.string().trim().min(2).max(200), items: z.array(calculationTemplateItemSchema).max(1000) })).max(200),
})

export const costLibraryItemPatchSchema = costLibraryItemSchema.partial().refine(
  value => Object.keys(value).length > 0,
  'Minstens één wijziging is verplicht',
)

export const applyCostSchema = z.object({
  factor: z.number().positive().max(1_000_000),
})

export const calculationScenarioSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).default(''),
  laborAdjustmentPct: z.number().min(-100).max(1_000),
  materialAdjustmentPct: z.number().min(-100).max(1_000),
  equipmentAdjustmentPct: z.number().min(-100).max(1_000),
  subcontractingAdjustmentPct: z.number().min(-100).max(1_000),
  overheadPct: z.number().min(0).max(100),
  riskPct: z.number().min(0).max(100),
  marginPct: z.number().min(0).max(99),
})

export const calculationScenarioPatchSchema = calculationScenarioSchema.partial().refine(
  value => Object.keys(value).length > 0,
  'Minstens één wijziging is verplicht',
)

export const quoteContentSchema = z.object({
  subject: z.string().trim().max(200).default(''),
  introduction: z.string().trim().max(2_000).default('Wij danken u voor uw aanvraag. Hierbij bezorgen wij u onze prijsopgave voor de beschreven werken.'),
  executionTerm: z.string().trim().max(250).default('In onderling overleg, volgens de projectplanning.'),
  paymentTerms: z.string().trim().max(250).default('Maandelijkse vorderingsstaten, betaalbaar binnen 30 dagen.'),
  validityDays: z.number().int().min(1).max(365).default(30),
  priceRevision: z.string().trim().max(500).default('Prijzen zijn herzienbaar volgens de contractueel overeengekomen formule.'),
  exclusions: z.array(z.string().trim().min(1).max(300)).max(20).default([]),
  notes: z.string().trim().max(2_000).default(''),
})
export const quoteApprovalSchema = z.object({ approvedBy:z.string().trim().min(2).max(200) })
export const quoteSendSchema = z.object({ sentTo:z.email(), sentBy:z.string().trim().min(2).max(200) })
export const quoteReminderSchema = z.object({ sentBy:z.string().trim().min(2).max(200) })
export const quoteSignatureSchema = z.object({ signedBy:z.string().trim().min(2).max(200) })
export const quoteLossSchema = z.object({ reason:z.string().trim().min(2).max(1000), recordedBy:z.string().trim().min(2).max(200) })

const handoverChecklistSchema = z.object({
  scopeReviewed: z.boolean(),
  budgetReviewed: z.boolean(),
  contractReviewed: z.boolean(),
  documentsTransferred: z.boolean(),
  risksReviewed: z.boolean(),
  kickoffPlanned: z.boolean(),
})

const projectWorkPackageSchema = z.object({
  id: z.uuid(),
  code: z.string().trim().min(1).max(50),
  name: z.string().trim().min(2).max(200),
  budget: z.number().nonnegative().max(1_000_000_000),
  plannedHours: z.number().nonnegative().max(10_000_000),
  status: z.enum(['Niet gestart', 'Klaar voor planning']),
})

export const projectStartupSchema = z.object({
  handover: z.object({
    status: z.enum(['Concept', 'Klaar voor overdracht', 'Aanvaard']),
    projectManager: z.string().trim().max(150),
    projectManagerEmployeeId: z.uuid().optional(),
    plannedStart: z.union([z.iso.date(), z.literal('')]),
    plannedEnd: z.union([z.iso.date(), z.literal('')]),
    notes: z.string().trim().max(2_000),
    risks: z.array(z.string().trim().min(1).max(300)).max(30),
    checklist: handoverChecklistSchema,
  }),
  workPackages: z.array(projectWorkPackageSchema).min(1).max(500),
}).refine(value => value.handover.status === 'Concept' || (
  Boolean(value.handover.projectManager) && Boolean(value.handover.plannedStart) && Boolean(value.handover.plannedEnd)
), { message: 'Verantwoordelijke en projectdata zijn verplicht voor overdracht' }).refine(value => !value.handover.plannedStart || !value.handover.plannedEnd || value.handover.plannedEnd >= value.handover.plannedStart, {
  message: 'De geplande einddatum moet op of na de startdatum liggen',
}).refine(value => value.handover.status !== 'Aanvaard' || Object.values(value.handover.checklist).every(Boolean), {
  message: 'Alle overdrachtscontroles moeten voltooid zijn voor aanvaarding',
})

const planningActivitySchema = z.object({
  id: z.uuid(),
  workPackageId: z.uuid().optional(),
  name: z.string().trim().min(2).max(200),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  progress: z.number().min(0).max(100),
  predecessorIds: z.array(z.uuid()).max(20),
  dependencies: z.array(z.object({
    predecessorId: z.uuid(),
    type: z.enum(['FS', 'SS', 'FF', 'SF']),
    lagDays: z.number().int().min(-365).max(365),
  })).max(20).optional(),
  milestone: z.boolean(),
  responsible: z.string().trim().max(200).default(''),
  responsibleEmployeeId: z.uuid().optional(),
  crewSize: z.number().int().min(0).max(500).default(0),
  weatherSensitive: z.boolean().default(false),
  resourceAssignments: z.array(z.object({
    id: z.uuid(),
    employeeId: z.uuid().optional(),
    crewId: z.uuid().optional(),
    resourceType: z.enum(['Medewerker', 'Ploeg', 'Materieel', 'Onderaannemer']),
    resourceName: z.string().trim().min(2).max(200),
    allocationPct: z.number().int().min(1).max(100),
    certificateExpiresOn: z.iso.date().optional(),
  })).max(20).default([]),
  baselineStartDate: z.iso.date().optional(),
  baselineEndDate: z.iso.date().optional(),
})

const planningScenarioSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500),
  createdAt: z.iso.datetime(),
  createdBy: z.string().trim().min(2).max(200),
  activities: z.array(planningActivitySchema).min(1).max(500),
})

export const projectBaselineSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  reason: z.string().trim().min(2).max(500).optional(),
  approvalStatus: z.enum(['Concept', 'Ter goedkeuring', 'Goedgekeurd']).optional(),
})

export const projectPlanningSchema = z.object({
  activities: z.array(planningActivitySchema).min(1).max(500),
  scenarios: z.array(planningScenarioSchema).max(20).optional(),
  selectedScenarioId: z.uuid().optional(),
}).superRefine((value, context) => {
  const activities = new Map(value.activities.map(activity => [activity.id, activity]))
  const dependenciesFor = (activity: typeof value.activities[number]) => activity.dependencies?.length ? activity.dependencies : activity.predecessorIds.map(predecessorId => ({ predecessorId, type: 'FS' as const, lagDays: 0 }))
  const addDays = (date: string, days: number) => { const value = new Date(`${date}T00:00:00Z`); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10) }
  if (activities.size !== value.activities.length) context.addIssue({ code: 'custom', message: 'Activiteit-ID’s moeten uniek zijn', path: ['activities'] })
  for (const [index, activity] of value.activities.entries()) {
    if (activity.endDate < activity.startDate) context.addIssue({ code: 'custom', message: 'Einddatum ligt voor de startdatum', path: ['activities', index, 'endDate'] })
    if (activity.milestone && activity.endDate !== activity.startDate) context.addIssue({ code: 'custom', message: 'Een mijlpaal heeft dezelfde start- en einddatum', path: ['activities', index, 'endDate'] })
    const dependencies = dependenciesFor(activity)
    if (new Set(dependencies.map(item => item.predecessorId)).size !== dependencies.length) context.addIssue({ code: 'custom', message: 'Een voorganger mag slechts eenmaal gekoppeld zijn', path: ['activities', index, 'dependencies'] })
    for (const dependency of dependencies) {
      const predecessor = activities.get(dependency.predecessorId)
      if (!predecessor || dependency.predecessorId === activity.id) context.addIssue({ code: 'custom', message: 'Ongeldige voorganger', path: ['activities', index, 'dependencies'] })
      else {
        const valid = dependency.type === 'SS' ? addDays(predecessor.startDate, dependency.lagDays) <= activity.startDate
          : dependency.type === 'FF' ? addDays(predecessor.endDate, dependency.lagDays) <= activity.endDate
          : dependency.type === 'SF' ? addDays(predecessor.startDate, dependency.lagDays) <= activity.endDate
          : addDays(predecessor.endDate, dependency.lagDays) <= activity.startDate
        if (!valid) context.addIssue({ code: 'custom', message: `Afhankelijkheid ${dependency.type} met vertraging wordt niet gerespecteerd`, path: ['activities', index, 'startDate'] })
      }
    }
  }
  const visiting = new Set<string>()
  const visited = new Set<string>()
  const hasCycle = (id: string): boolean => {
    if (visiting.has(id)) return true
    if (visited.has(id)) return false
    visiting.add(id)
    const activity = activities.get(id)
    if (activity && dependenciesFor(activity).some(dependency => hasCycle(dependency.predecessorId))) return true
    visiting.delete(id)
    visited.add(id)
    return false
  }
  if (value.activities.some(activity => hasCycle(activity.id))) context.addIssue({ code: 'custom', message: 'De planning bevat een cyclische afhankelijkheid', path: ['activities'] })
})

const dailyLaborEntrySchema = z.object({
  id: z.uuid(),
  employeeId: z.uuid().optional(),
  employeeName: z.string().trim().min(2).max(150),
  role: z.string().trim().max(100),
  hours: z.number().min(0).max(24),
  overtimeHours: z.number().min(0).max(24),
}).refine(value => value.hours + value.overtimeHours <= 24, { message: 'De totale dagprestatie mag maximaal 24 uur bedragen' })

const dailyResourceEntrySchema = z.object({
  id: z.uuid(),
  description: z.string().trim().min(2).max(200),
  quantity: z.number().positive().max(1_000_000_000),
  unit: z.string().trim().min(1).max(20),
})

const dailyProductionEntrySchema = z.object({
  id: z.uuid(),
  workPackageId: z.uuid(),
  boqItemId: z.uuid(),
  description: z.string().trim().min(2).max(300),
  quantity: z.number().positive().max(1_000_000_000),
  unit: z.string().trim().min(1).max(20),
})

export const dailyReportSchema = z.object({
  date: z.iso.date(),
  workPackageId: z.uuid().optional(),
  weather: z.enum(['Droog', 'Regen', 'Wind', 'Vorst', 'Hitte', 'Wisselvallig']),
  temperature: z.number().min(-50).max(60),
  activities: z.string().trim().max(5_000),
  laborEntries: z.array(dailyLaborEntrySchema).max(200),
  subcontractors: z.array(z.string().trim().min(1).max(200)).max(100),
  materials: z.array(dailyResourceEntrySchema).max(200),
  machines: z.array(dailyResourceEntrySchema).max(200),
  productionEntries: z.array(dailyProductionEntrySchema).max(2_000).default([]),
  deliveries: z.string().trim().max(2_000),
  delays: z.string().trim().max(2_000),
  problems: z.string().trim().max(2_000),
  visitors: z.string().trim().max(1_000),
  notes: z.string().trim().max(3_000),
})

export const dailyReportSignSchema = z.object({ signedBy: z.string().trim().min(2).max(150) })

export const sitePhotoSchema = z.object({
  workPackageId: z.uuid().optional(),
  caption: z.string().trim().max(500).default(''),
  location: z.string().trim().max(200).default(''),
  takenAt: z.iso.datetime({ offset: true }),
})

const documentCategories = ['Bestek', 'Meetstaat', 'Plan', 'Technische fiche', 'Vergunning', 'Veiligheid', 'Contract', 'Verslag', 'As-built', 'Oplevering', 'Overig'] as const

export const documentUploadSchema = z.object({
  title: z.string().trim().min(2).max(250),
  category: z.enum(documentCategories),
  notes: z.string().trim().max(2_000),
  uploadedBy: z.string().trim().min(2).max(150),
})

export const documentMetadataSchema = z.object({
  title: z.string().trim().min(2).max(250),
  category: z.enum(documentCategories),
})

export const documentRevisionSchema = z.object({
  notes: z.string().trim().max(2_000),
  uploadedBy: z.string().trim().min(2).max(150),
})

export const documentApprovalSchema = z.object({ approvedBy: z.string().trim().min(2).max(150) })

export const documentDistributionSchema = z.object({
  recipients: z.array(z.object({ name: z.string().trim().min(2).max(150), email: z.email() })).min(1).max(100),
}).refine(value => new Set(value.recipients.map(recipient => recipient.email.toLowerCase())).size === value.recipients.length, { message: 'Een ontvanger kan maar één keer worden toegevoegd', path: ['recipients'] })

export const documentRecordLinkSchema = z.object({
  type: z.enum(['Relatie', 'Opportuniteit', 'Calculatie', 'Offerte', 'Contract', 'Werkpakket', 'Meetstaatpost', 'Dagrapport', 'Meerwerk', 'Claim', 'Inkoop', 'Onderaannemer', 'Opleverpunt', 'QHSE']),
  recordId: z.string().trim().min(1).max(150),
  label: z.string().trim().min(2).max(300),
  createdBy: z.string().trim().min(2).max(150),
})

export const qhseCertificateSchema = z.object({
  holderType: z.enum(['Medewerker', 'Materieel', 'Onderaannemer']),
  holderId: z.uuid().optional(),
  holderName: z.string().trim().min(2).max(150),
  certificateType: z.string().trim().min(2).max(150),
  certificateNumber: z.string().trim().min(2).max(100),
  issuedOn: z.iso.date().optional(),
  expiresOn: z.iso.date(),
  documentId: z.uuid().optional(),
}).refine(value => !value.issuedOn || value.expiresOn >= value.issuedOn, { message: 'De vervaldatum moet na de uitgiftedatum liggen', path: ['expiresOn'] })

const qhseFindingSchema = z.object({
  id: z.uuid(),
  description: z.string().trim().min(3).max(500),
  severity: z.enum(['Laag', 'Middel', 'Hoog']),
  responsible: z.string().trim().min(2).max(150),
  dueDate: z.iso.date(),
})

export const qhseInspectionSchema = z.object({
  inspectionDate: z.iso.date(),
  type: z.enum(['Toolboxmeeting', 'LMRA', 'Veiligheidsinspectie', 'Werkvergunning', 'Materieelinspectie']),
  inspector: z.string().trim().min(2).max(150),
  location: z.string().trim().min(2).max(150),
  notes: z.string().trim().max(5_000),
  findings: z.array(qhseFindingSchema).max(100),
})

export const qhseFindingParams = z.object({ id: z.uuid(), findingId: z.uuid() })

const changeOrderCostsSchema = z.object({
  labor: z.number().min(0).max(1_000_000_000),
  material: z.number().min(0).max(1_000_000_000),
  equipment: z.number().min(0).max(1_000_000_000),
  transport: z.number().min(0).max(1_000_000_000),
  subcontracting: z.number().min(0).max(1_000_000_000),
  other: z.number().min(0).max(1_000_000_000),
})

export const changeOrderSchema = z.object({
  dailyReportId: z.uuid().optional(),
  workPackageId: z.uuid().optional(),
  date: z.iso.date(),
  cause: z.string().trim().min(2).max(200),
  description: z.string().trim().min(5).max(5_000),
  initiator: z.string().trim().min(2).max(150),
  responsibleParty: z.string().trim().min(2).max(150),
  scheduleImpactDays: z.number().int().min(-3650).max(3650),
  costs: changeOrderCostsSchema,
  photoIds: z.array(z.uuid()).max(100),
})

export const changeOrderApprovalSchema = z.object({ approvedBy: z.string().trim().min(2).max(150) })

export const progressStatementSchema = z.object({
  periodStart: z.iso.date(),
  periodEnd: z.iso.date(),
  lines: z.array(z.object({
    workPackageId: z.uuid(),
    cumulativeProgressPct: z.number().min(0).max(100),
    measurementMethod: z.enum(['Handmatig','Meetstaat','Dagrapporten','BIM']).optional(),
    measuredQuantity: z.number().nonnegative().max(1_000_000_000).optional(),
    unit: z.string().trim().max(20).optional(),
    comment: z.string().trim().max(1_000).optional(),
    evidenceDocumentIds: z.array(z.uuid()).max(100).optional(),
    bimEvidence: z.object({
      modelId: z.string().trim().min(1).max(150), modelName: z.string().trim().min(1).max(250), modelVersion: z.string().trim().min(1).max(100),
      discipline: z.enum(['Architectuur','Structuur','Technieken','Infrastructuur','Multidisciplinair']),
      elementIds: z.array(z.string().trim().min(1).max(100)).min(1).max(20_000), elementCount: z.number().int().positive().max(20_000),
      measuredQuantity: z.number().nonnegative().max(1_000_000_000), verifiedQuantity: z.number().nonnegative().max(1_000_000_000),
      unit: z.enum(['m²','m³','m','st']), completionPct: z.number().min(0).max(100), measuredAt: z.iso.datetime(), measuredBy: z.string().trim().min(2).max(150),
      status: z.enum(['Concept','Gecontroleerd']), clashFree: z.boolean(), notes: z.string().trim().max(1_000),
      lidarEvidence: z.object({
        scanSessionId:z.string().trim().min(1).max(150),captureMode:z.enum(['RoomPlan','ARKit mesh','Gecombineerd']),deviceName:z.string().trim().min(1).max(150),
        registrationRmsMm:z.number().nonnegative().max(10_000),confidencePct:z.number().min(0).max(100),artifactIds:z.array(z.string().trim().min(1).max(150)).max(500),bcfTopicIds:z.array(z.string().trim().min(1).max(150)).max(500),
      }).optional(),
    }).optional(),
    meetstaatEvidence: z.object({
      sourceCalculationId: z.uuid(),
      measurements: z.array(z.object({ boqItemId:z.uuid(), cumulativeQuantity:z.number().nonnegative().max(1_000_000_000) })).min(1).max(20_000),
      itemCount: z.number().int().positive().max(20_000), completionPct:z.number().min(0).max(100),
      measuredAt:z.iso.datetime(), measuredBy:z.string().trim().min(2).max(150),
    }).optional(),
    dailyReportEvidence: z.object({
      sourceCalculationId:z.uuid(), reportIds:z.array(z.uuid()).max(20_000), productionEntryIds:z.array(z.uuid()).max(50_000),
      reportCount:z.number().int().nonnegative().max(20_000), productionEntryCount:z.number().int().nonnegative().max(50_000),
      completionPct:z.number().min(0).max(100), approvedThrough:z.iso.date(), calculatedAt:z.iso.datetime(),
    }).optional(),
  })).min(1).max(500),
  changeOrderIds: z.array(z.uuid()).max(500),
  priceRevisionAmount: z.number().min(-1_000_000_000).max(1_000_000_000),
  retentionPct: z.number().min(0).max(100),
  notes: z.string().trim().max(3_000),
  valuationDate: z.iso.date().optional(),
  dueDate: z.iso.date().optional(),
  certificateReference: z.string().trim().max(100).optional(),
  preparedBy: z.string().trim().max(150).optional(),
  revisionFormula: z.string().trim().max(500).optional(),
  advancePaymentAmount: z.number().min(-1_000_000_000).max(1_000_000_000).optional(),
  advanceRecoveryAmount: z.number().nonnegative().max(1_000_000_000).optional(),
  otherDeductionsAmount: z.number().nonnegative().max(1_000_000_000).optional(),
  evidenceDocumentIds: z.array(z.uuid()).max(500).optional(),
  qualityChecklist: z.object({ measurementsVerified:z.boolean(), evidenceComplete:z.boolean(), changesApproved:z.boolean(), bimModelValidated:z.boolean() }).optional(),
}).refine(value => value.periodEnd >= value.periodStart, { message: 'Het periode-einde moet op of na de startdatum liggen', path: ['periodEnd'] })
  .refine(value => !value.dueDate || value.dueDate >= (value.valuationDate ?? value.periodEnd), { message: 'De betaaldatum moet op of na de waarderingsdatum liggen', path: ['dueDate'] })

export const progressStatementApprovalSchema = z.object({ approvedBy: z.string().trim().min(2).max(150) })

const lidarVectorSchema=z.object({x:z.number().finite().min(-1_000_000).max(1_000_000),y:z.number().finite().min(-1_000_000).max(1_000_000),z:z.number().finite().min(-1_000_000).max(1_000_000)})
export const lidarControlPointSchema=z.object({id:z.string().trim().min(1).max(100),label:z.string().trim().min(1).max(150),bim:lidarVectorSchema,scan:lidarVectorSchema,verified:z.boolean()})
export const lidarObservationSchema=z.object({
  id:z.string().trim().min(1).max(150),ifcGuid:z.string().trim().min(1).max(150),label:z.string().trim().min(1).max(250),category:z.string().trim().min(1).max(100),workPackageId:z.uuid(),
  plannedQuantity:z.number().nonnegative().max(1_000_000_000),observedQuantity:z.number().nonnegative().max(1_000_000_000),unit:z.enum(['m\u00b2','m\u00b3','m','st']),measurementRule:z.enum(['Oppervlakte','Volume','Lengte','Aanwezigheid','Foto en controle']),
  surfaceCoveragePct:z.number().min(0).max(100),visibilityPct:z.number().min(0).max(100),confidencePct:z.number().min(0).max(100),deviationMm:z.number().min(-100_000).max(100_000),photoEvidenceCount:z.number().int().nonnegative().max(10_000),dailyReportIds:z.array(z.uuid()).max(1_000).optional(),inspectionDocumentIds:z.array(z.uuid()).max(1_000).optional(),manuallyConfirmed:z.boolean().optional(),detected:z.boolean(),
})
export const lidarSurveyElementSchema=z.object({
  id:z.string().trim().min(1).max(150),roomId:z.string().trim().min(1).max(150),roomName:z.string().trim().min(1).max(200),kind:z.enum(['Ruimte','Wand','Vloer','Plafond','Deur','Raam','Kolom','Trap','Dak','Stopcontact','Schakelaar','Lichtpunt','Elektrisch bord','Datapunt','Detector','Leiding','Afvoer','Ventilatiekanaal','Sanitair toestel','Verwarmingstoestel','Technische installatie','Buitenobject','Vrij element']),label:z.string().trim().min(1).max(250),sourceElementId:z.string().trim().max(150).optional(),
  areaM2:z.number().nonnegative().max(1_000_000).optional(),netAreaM2:z.number().nonnegative().max(1_000_000).optional(),lengthM:z.number().nonnegative().max(1_000_000).optional(),volumeM3:z.number().nonnegative().max(1_000_000).optional(),count:z.number().nonnegative().max(1_000_000).optional(),confidencePct:z.number().min(0).max(100),photoArtifactIds:z.array(z.string().trim().min(1).max(150)).max(1_000).default([]),
})
export const lidarWorkAssignmentSchema=z.object({
  id:z.string().trim().min(1).max(150),catalogCode:z.string().trim().min(2).max(50),elementIds:z.array(z.string().trim().min(1).max(150)).min(1).max(10_000),description:z.string().trim().max(500).optional(),quantityOverride:z.number().positive().max(1_000_000_000).optional(),wastePct:z.number().min(0).max(1_000).optional(),notes:z.string().trim().max(2_000).optional(),photoArtifactIds:z.array(z.string().trim().min(1).max(150)).max(1_000).default([]),dailyReportIds:z.array(z.uuid()).max(1_000).default([]),inspectionDocumentIds:z.array(z.uuid()).max(1_000).default([]),manuallyConfirmed:z.boolean().default(false),
})
export const lidarScanSchema=z.object({
  modelId:z.string().trim().min(1).max(150),modelName:z.string().trim().min(1).max(250),modelVersion:z.string().trim().min(1).max(100),zone:z.string().trim().min(1).max(200),storey:z.string().trim().min(1).max(150),
  deviceName:z.string().trim().min(1).max(150),deviceSupportsLidar:z.boolean(),captureMode:z.enum(['RoomPlan','ARKit mesh','Gecombineerd']),capturedBy:z.string().trim().min(2).max(150),capturedAt:z.iso.datetime(),notes:z.string().trim().max(2_000),
  purpose:z.enum(['Calculatie-opname','Nulmeting','Vorderingsopname','As-built']).optional(),baselineScanId:z.uuid().optional(),controlPoints:z.array(lidarControlPointSchema).max(100).default([]),observations:z.array(lidarObservationSchema).max(50_000).default([]),surveyElements:z.array(lidarSurveyElementSchema).max(50_000).default([]),workAssignments:z.array(lidarWorkAssignmentSchema).max(20_000).default([]),
})
export const lidarRegistrationSchema=z.object({controlPoints:z.array(lidarControlPointSchema).min(3).max(100),registeredBy:z.string().trim().min(2).max(150)})
export const lidarAnalysisSchema=z.object({observations:z.array(lidarObservationSchema).min(1).max(50_000)})
export const lidarApprovalSchema=z.object({approvedBy:z.string().trim().min(2).max(150)})
export const lidarBcfSchema=z.object({title:z.string().trim().min(3).max(250),description:z.string().trim().min(3).max(5_000),priority:z.enum(['Laag','Normaal','Hoog','Kritiek']),ifcGuids:z.array(z.string().trim().min(1).max(150)).min(1).max(5_000),viewpoint:z.object({camera:lidarVectorSchema,direction:lidarVectorSchema,snapshotArtifactId:z.string().trim().min(1).max(150).optional()}),assignedTo:z.string().trim().max(150).optional(),dueDate:z.iso.date().optional(),createdBy:z.string().trim().min(2).max(150)})
export const lidarAsBuiltSchema=z.object({createdBy:z.string().trim().min(2).max(150)})
export const lidarArtifactSchema=z.object({kind:z.enum(['RoomPlan JSON','USDZ','Mesh','Puntenwolk','Foto','Dieptekaart']),capturedAt:z.iso.datetime()})
export const lidarCalculationProposalSchema=z.object({elements:z.array(lidarSurveyElementSchema).min(1).max(50_000),assignments:z.array(lidarWorkAssignmentSchema).min(1).max(20_000)})
export const lidarCalculationApprovalSchema=z.object({approvedBy:z.string().trim().min(2).max(150)})

export const peppolAcceptanceReleaseSchema = z.object({
  releasedBy: z.string().trim().min(2).max(150),
  notes: z.string().trim().min(5).max(1_000),
}).strict()

export const salesInvoiceSchema = z.object({
  invoiceDate: z.iso.date(),
  dueDate: z.iso.date().optional(),
  vatPct: z.number().min(0).max(100).optional(),
}).refine(value => !value.dueDate || value.dueDate >= value.invoiceDate, { message: 'De vervaldatum moet op of na de factuurdatum liggen', path: ['dueDate'] })

export const salesInvoiceIssueSchema = z.object({ issuedBy: z.string().trim().min(2).max(150) })

export const paymentRegistrationSchema = z.object({
  paymentDate: z.iso.date(),
  amount: z.number().positive().max(1_000_000_000),
  reference: z.string().trim().min(1).max(100),
})

export const peppolNotificationSettingsSchema = z.object({
  emailRecipients: z.array(z.email()).max(20),
  teamsTargets: z.array(z.string().trim().min(1).max(200)).max(20),
  criticalSlaMinutes: z.number().int().min(1).max(1440),
}).strict()

export const peppolNotificationTestSchema = z.object({
  channel: z.enum(['E-mail', 'Teams']),
  destination: z.string().trim().min(1).max(320),
}).strict()

export const projectCostSchema = z.object({
  workPackageId: z.uuid().optional(),
  date: z.iso.date(),
  type: z.enum(['Verplichting', 'Werkelijke kost']),
  category: z.enum(['labor', 'material', 'equipment', 'transport', 'subcontracting', 'other']),
  description: z.string().trim().min(3).max(500),
  supplier: z.string().trim().max(200),
  amount: z.number().positive().max(1_000_000_000),
  reference: z.string().trim().max(100),
  recognition: z.enum(['Boeking', 'Overlopende kost', 'Onderhanden werk']).optional(),
  sourceDocumentId: z.uuid().optional(),
})

export const commitmentSettlementSchema = z.object({
  date: z.iso.date(),
  amount: z.number().positive().max(1_000_000_000),
  description: z.string().trim().min(3).max(500),
  reference: z.string().trim().max(100),
})

export const projectForecastSchema = z.object({
  lines: z.array(z.object({ workPackageId: z.uuid(), remainingCost: z.number().min(0).max(1_000_000_000) })).min(1).max(500),
  notes: z.string().trim().max(3_000),
})

export const postCalculationFeedbackSchema = z.object({
  boqItemId: z.uuid(),
  category: z.enum(['labor', 'material', 'equipment', 'subcontracting']),
})

export const supplierSchema = z.object({
  organizationId: z.uuid().optional(),
  name: z.string().trim().min(2).max(200),
  vatNumber: z.string().trim().max(30),
  contactName: z.string().trim().max(150),
  email: z.email().or(z.literal('')),
  paymentTerms: z.string().trim().max(200),
})

const procurementItemSchema = z.object({
  id: z.uuid(),
  description: z.string().trim().min(2).max(300),
  quantity: z.number().positive().max(1_000_000_000),
  unit: z.string().trim().min(1).max(20),
  targetUnitPrice: z.number().min(0).max(1_000_000_000),
})

export const procurementRequestSchema = z.object({
  workPackageId: z.uuid().optional(),
  invitedSupplierIds: z.array(z.uuid()).min(1, 'Selecteer minstens één leverancier').max(100),
  category: z.enum(['labor', 'material', 'equipment', 'transport', 'subcontracting', 'other']),
  requestedBy: z.string().trim().min(2).max(150),
  neededBy: z.iso.date(),
  description: z.string().trim().min(3).max(1_000),
  items: z.array(procurementItemSchema).min(1).max(200),
})

export const supplierQuoteSchema = z.object({
  supplierId: z.uuid(),
  amount: z.number().positive().max(1_000_000_000),
  leadTimeDays: z.number().int().min(0).max(3650),
  validityDate: z.iso.date(),
  notes: z.string().trim().max(1_000),
})

export const supplierFrameworkAgreementSchema = z.object({
  number: z.string().trim().min(2).max(100),
  title: z.string().trim().min(3).max(300),
  category: z.enum(['labor', 'material', 'equipment', 'transport', 'subcontracting', 'other']),
  startsOn: z.iso.date(),
  endsOn: z.iso.date(),
  ceilingAmount: z.number().positive().max(1_000_000_000),
  documentIds: z.array(z.uuid()).max(50),
})

export const purchaseReceiptSchema = z.object({
  receivedAt: z.iso.date(),
  deliveryReference: z.string().trim().min(1).max(100),
  receivedBy: z.string().trim().min(2).max(150),
  notes: z.string().trim().max(1_000),
  lines: z.array(z.object({ procurementItemId:z.uuid(), quantity:z.number().positive().max(1_000_000_000) })).min(1).max(200).optional(),
})

export const purchaseInvoiceMatchSchema = z.object({
  invoiceNumber: z.string().trim().min(1).max(100),
  invoiceDate: z.iso.date(),
  dueDate: z.iso.date(),
  amount: z.number().positive().max(1_000_000_000),
  lines: z.array(z.object({ procurementItemId:z.uuid(), quantity:z.number().positive().max(1_000_000_000), unitPrice:z.number().min(0).max(1_000_000_000) })).min(1).max(200).optional(),
}).refine(value => value.dueDate >= value.invoiceDate, { message: 'De vervaldatum moet op of na de factuurdatum liggen', path: ['dueDate'] })
  .refine(value => !value.lines || new Set(value.lines.map(line => line.procurementItemId)).size === value.lines.length, { message: 'Een factuurlijn kan maar eenmaal voorkomen', path: ['lines'] })

export const purchaseDeviationApprovalSchema = z.object({ reason: z.string().trim().min(5).max(1_000) })

export const workTicketSchema = z.object({
  projectId: z.uuid(),
  subcontractorId: z.uuid().optional(),
  dailyReportId: z.uuid().optional(),
  type: z.enum(['Regiewerk', 'Meerwerk', 'Machine-uren', 'Wachttijd', 'Herstelling']),
  date: z.iso.date(),
  description: z.string().trim().min(5).max(3_000),
  lines: z.array(z.object({
    id: z.uuid(),
    category: z.enum(['Arbeid', 'Materiaal', 'Materieel', 'Transport', 'Wachttijd', 'Herstelling']),
    description: z.string().trim().min(2).max(500),
    quantity: z.number().positive().max(1_000_000),
    unit: z.string().trim().min(1).max(20),
    unitPrice: z.number().min(0).max(1_000_000),
  })).min(1).max(100),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  createdBy: z.string().trim().min(2).max(150),
}).strict()

export const workTicketSignatureSchema = z.object({ signedBy: z.string().trim().min(2).max(150) }).strict()

export const timeEntrySchema = z.object({
  employeeId: z.uuid(), projectId: z.uuid(), workPackageId: z.uuid().optional(), date: z.iso.date(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  breakMinutes: z.number().int().min(0).max(720), regularHours: z.number().min(0).max(24), overtimeHours: z.number().min(0).max(24),
  travelHours: z.number().min(0).max(24), nightHours: z.number().min(0).max(24), weekendHours: z.number().min(0).max(24),
  source: z.enum(['Mobiel', 'QR', 'Badge', 'GPS', 'Manueel', 'Import']),
  latitude: z.number().min(-90).max(90).optional(), longitude: z.number().min(-180).max(180).optional(), correctionReason: z.string().trim().max(1_000).optional(),
}).strict()

export const timeEntryDecisionSchema = z.object({ decision: z.enum(['Goedgekeurd', 'Geweigerd']), reason: z.string().trim().max(1_000).optional() }).strict()

export const checkinatworkSiteSchema = z.object({
  projectId: z.uuid(), declarationNumber: z.string().trim().max(100), workPlaceId: z.string().trim().max(100), declarantCompanyNumber: z.string().trim().max(20),
  applicability: z.enum(['Te beoordelen','Verplicht','Niet verplicht','Be\u00ebindigd']), applicabilityReason: z.string().trim().max(1_000), thresholdAmount: z.number().min(0).max(1_000_000_000),
  startDate: z.iso.date(), plannedEndDate: z.iso.date().optional(), provisionalAcceptanceOn: z.iso.date().optional(), address: z.string().trim().min(2).max(300),
  latitude: z.number().min(-90).max(90).optional(), longitude: z.number().min(-180).max(180).optional(), geofenceRadiusMeters: z.number().int().min(10).max(10_000).optional(),
  environment: z.enum(['Simulatie','Productie']), active: z.boolean(),
}).strict()

export const checkinatworkParticipantSchema = z.object({
  projectId: z.uuid(), employeeId: z.uuid().optional(), subcontractorId: z.uuid().optional(), displayName: z.string().trim().min(2).max(200), employerName: z.string().trim().min(2).max(200), employerCompanyNumber: z.string().trim().max(20).optional(),
  participantType: z.enum(['Werknemer','Zelfstandige','Interim','Onderaannemer','Architect','Veiligheidsco\u00f6rdinator']), identifierType: z.enum(['INSZ','Limosa']), identifier: z.string().trim().min(11).max(30), limosaExpiresOn: z.iso.date().optional(), active: z.boolean(),
}).strict().superRefine((value, context) => {
  const digits = value.identifier.replace(/\D/g, '')
  const expected = value.identifierType === 'INSZ' ? 11 : 17
  if (digits.length !== expected) context.addIssue({ code:'custom', message:`${value.identifierType} moet ${expected} cijfers bevatten`, path:['identifier'] })
})

export const checkinatworkRegistrationSchema = z.object({ siteId:z.uuid(), participantId:z.uuid(), registrationDate:z.iso.date(), source:z.enum(['Mobiel','QR','Badge','Kiosk','Planning','Manueel','Import']), latitude:z.number().min(-90).max(90).optional(), longitude:z.number().min(-180).max(180).optional() }).strict()
export const checkinatworkCancellationSchema = z.object({ reason:z.enum(['HOLIDAY','DISEASE','PLANNING','C32A']) }).strict()

export const projectClaimSchema = z.object({
  projectId: z.uuid(), changeOrderId: z.uuid().optional(),
  type: z.enum(['Financiële claim', 'Termijnverlenging', 'Schadeclaim', 'Contractmelding']),
  cause: z.string().trim().min(3).max(500), description: z.string().trim().min(5).max(5_000),
  amount: z.number().min(0).max(1_000_000_000), extensionDays: z.number().int().min(0).max(3_650),
  responsibleParty: z.string().trim().min(2).max(200), documentIds: z.array(z.uuid()).max(100), createdBy: z.string().trim().min(2).max(150),
}).superRefine((value, context) => {
  if (value.type === 'Termijnverlenging' && value.extensionDays < 1) context.addIssue({ code: 'custom', message: 'Termijnverlenging vereist minstens één dag', path: ['extensionDays'] })
  if (value.type !== 'Termijnverlenging' && value.amount <= 0) context.addIssue({ code: 'custom', message: 'Een financiële claim vereist een positief bedrag', path: ['amount'] })
})

export const projectClaimTransitionSchema = z.object({ action: z.enum(['approve', 'submit', 'accept', 'reject']), notes: z.string().trim().max(2_000).optional() }).strict()

export const assetOperationalSchema = z.discriminatedUnion('kind', [
  z.object({kind:z.literal('maintenance'),value:z.object({title:z.string().trim().min(3).max(300),scheduledOn:z.iso.date(),completedOn:z.iso.date().optional(),supplier:z.string().trim().max(200),cost:z.number().min(0),status:z.enum(['Gepland','In uitvoering','Voltooid']),notes:z.string().trim().max(1_000)})}),
  z.object({kind:z.literal('damage'),value:z.object({reportedOn:z.iso.date(),description:z.string().trim().min(5).max(2_000),reportedBy:z.string().trim().min(2).max(150),insurerReference:z.string().trim().max(100).optional(),estimatedCost:z.number().min(0),status:z.enum(['Open','In behandeling','Hersteld'])})}),
  z.object({kind:z.literal('fuel'),value:z.object({date:z.iso.date(),quantity:z.number().positive(),unitPrice:z.number().min(0),mileage:z.number().min(0).optional(),operatingHours:z.number().min(0).optional(),provider:z.string().trim().min(2).max(150)})}),
  z.object({kind:z.literal('reservation'),value:z.object({projectId:z.uuid(),startDate:z.iso.date(),endDate:z.iso.date(),requestedBy:z.string().trim().min(2).max(150),status:z.enum(['Gepland','Bevestigd','Geannuleerd'])}).refine(value=>value.endDate>=value.startDate,{message:'Einddatum moet na startdatum liggen',path:['endDate']})}),
])
