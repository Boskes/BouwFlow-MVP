import { describe, expect, it } from 'vitest'
import { autoSchedulePlanningActivities, boqPriceBreakdown, bulkBoqPriceAdjustmentPreview, cashFlowEntries, cashFlowPeriods, class8CalculationTemplates, compareCalculationSnapshots, costLibraryMatchesScope, criticalPathActivityIds, criticalPathAnalysis, effectiveBoqValues, normalizeTenderDossier, peppolOperations, planningConflicts, planningTimelineRange, postCalculationAnalysis, qhseAlerts, qhseCertificateStatus, sellingTotal, unitConversionFactor, unitCost, type BoqItem, type BouwFlowState, type Calculation, type CostLibrary, type PeppolDelivery, type Project, type SalesInvoice } from './domain'

const project = { id: 'project-1', number: 'PRJ-001', name: 'Testwerf' } as Project

const state: BouwFlowState = {
  workflowDefinitions: [],
  workflowCorrections: [],
  units: [],
  unitConversions: [],
  currentUserId: '', companyUsers: [], legalEntities: [], companyBranches: [],
  organizations: [], opportunities: [], calculations: [], calculationVersions: [], calculationScenarios: [], costLibraries: [], costLibraryVersions: [], costLibrary: [], quotes: [],
  projects: [project], dailyReports: [], sitePhotos: [], changeOrders: [], progressStatements: [], projectCosts: [], projectForecasts: [], procurementRequests: [], documents: [], qhseCertificates: [], qhseInspections: [],
  suppliers: [{ id: 'supplier-1', name: 'Testleverancier', vatNumber: '', contactName: '', email: '', paymentTerms: '30 dagen', rating: 0, createdAt: '2027-01-01T00:00:00.000Z' }],
  salesInvoices: [{ id: 'invoice-1', number: 'VF-001', projectId: project.id, progressStatementId: 'statement-1', invoiceDate: '2027-02-01', dueDate: '2027-03-10', subtotal: 1000, vatPct: 21, vatAmount: 210, total: 1210, status: 'Openstaand', createdAt: '2027-02-01T00:00:00.000Z' }], peppolValidationReports: [], peppolDeliveries: [], peppolAcceptanceRuns: [], peppolAlerts: [], peppolNotifications: [], peppolNotificationSettings: { emailRecipients: [], teamsTargets: [], criticalSlaMinutes: 15, connectorConfigured: false, connectorProvider: 'Niet geconfigureerd', connectorChannels: [], integrationChecks: [], productionGate: { released: false } },
  intercompanyCharges: [],
  assets: [], warehouses: [], inventoryItems: [], stockMovements: [],
  subcontractors: [], qhseEvents: [], jointVentures: [], integrationConnections: [], integrationJobs: [], aiAnalyses: [], projectContracts: [], projectCloseouts: [], employees: [], employeeAbsences: [], employeeCrews: [], workTickets: [], timeEntries: [], projectClaims: [],
  checkinatworkSites: [], checkinatworkParticipants: [], checkinatworkRegistrations: [], checkinatworkAuditEvents: [], checkinatworkIntegrationStatus: { simulationAvailable: true, productionConfigured: false, productionEnabled: false, provider: 'Test', protocol: 'PresenceRegistration v1.11' },
  purchaseOrders: [
    { id: 'order-1', number: 'BB-001', procurementRequestId: 'request-1', projectId: project.id, supplierId: 'supplier-1', orderDate: '2027-02-01', expectedDeliveryDate: '2027-02-15', amount: 5600, status: 'Factuur gecontroleerd', commitmentCostId: 'cost-1', invoiceNumber: 'LF-001', invoiceDate: '2027-02-16', invoiceDueDate: '2027-03-18', invoiceAmount: 5700, createdAt: '2027-02-01T00:00:00.000Z' },
    { id: 'order-2', number: 'BB-002', procurementRequestId: 'request-2', projectId: project.id, supplierId: 'supplier-1', orderDate: '2027-03-01', expectedDeliveryDate: '2027-04-01', amount: 1000, status: 'Besteld', commitmentCostId: 'cost-2', createdAt: '2027-03-01T00:00:00.000Z' },
  ],
}

describe('tenderdossiers', () => {
  it('maakt oudere gedeeltelijke tenderdata veilig voor alle schermen', () => {
    const tender = normalizeTenderDossier({
      questions: [],
    })

    expect(tender.procedureType).toBe('Openbaar')
    expect(tender.selectionConditions).toEqual([])
    expect(tender.awardCriteria).toEqual([])
    expect(tender.requiredDocumentIds).toEqual([])
    expect(tender.questions).toEqual([])
    expect(tender.siteVisits).toEqual([])
    expect(tender.competitors).toEqual([])
    expect(tender.deadlineWarningDays).toEqual([30, 14, 7, 2])
  })

  it('neemt document-ID’s over uit de oude documents-eigenschap', () => {
    const tender = normalizeTenderDossier({
      documents: ['bestek-1', 123, 'plan-2'],
    } as never)

    expect(tender.requiredDocumentIds).toEqual(['bestek-1', 'plan-2'])
  })
})

describe('eenheden en conversies', () => {
  const units = [
    { id: 'm', code: 'm', name: 'Meter', category: 'Lengte' as const, active: true, createdAt: '2027-01-01' },
    { id: 'km', code: 'km', name: 'Kilometer', category: 'Lengte' as const, active: true, createdAt: '2027-01-01' },
  ]
  const conversions = [{ id: 'km-m', fromUnitId: 'km', toUnitId: 'm', factor: 1000, createdAt: '2027-01-01' }]

  it('past directe en omgekeerde conversies toe', () => {
    expect(unitConversionFactor('km', 'm', units, conversions)).toBe(1000)
    expect(unitConversionFactor('m', 'km', units, conversions)).toBe(0.001)
    expect(unitConversionFactor('m', 'm', units, conversions)).toBe(1)
  })
})

describe('scope van kostenbibliotheken', () => {
  const base = { id: 'lib', name: 'Test', description: '', active: true, createdAt: '2027-01-01' } satisfies CostLibrary

  it('combineert globale, entiteits- en vestigingsbibliotheken zonder scopelekken', () => {
    expect(costLibraryMatchesScope(base, 'entity-a', 'branch-a')).toBe(true)
    expect(costLibraryMatchesScope({ ...base, legalEntityId: 'entity-a' }, 'entity-a', 'branch-b')).toBe(true)
    expect(costLibraryMatchesScope({ ...base, legalEntityId: 'entity-a' }, 'entity-b', 'branch-b')).toBe(false)
    expect(costLibraryMatchesScope({ ...base, legalEntityId: 'entity-a', branchId: 'branch-a' }, 'entity-a', 'branch-a')).toBe(true)
    expect(costLibraryMatchesScope({ ...base, legalEntityId: 'entity-a', branchId: 'branch-a' }, 'entity-a', 'branch-b')).toBe(false)
    expect(costLibraryMatchesScope({ ...base, legalEntityId: 'entity-a', branchId: 'branch-a' }, 'entity-a')).toBe(false)
  })
})

describe('geavanceerde klasse-8-calculatie', () => {
  it('berekent materiaalverlies, postrisico, opslag en commerciële prijsstappen', () => {
    const calculation = { id: 'calc-advanced', number: 'CAL-ADV', opportunityId: 'opp-1', status: 'In opmaak', overheadPct: 8, riskPct: 3, marginPct: 10, siteOverheadPct: 5, escalationPct: 2, discountPct: 1, roundingStep: 50, chapters: [], items: [{ id: 'item-advanced', code: '01.01', description: 'Complexe post', quantity: 10, unit: 'st', labor: 10, material: 20, equipment: 5, subcontracting: 0, wastePct: 10, itemRiskPct: 4, markupPct: 6 }], updatedAt: '2027-01-01' } satisfies Calculation

    expect(unitCost(calculation.items[0])).toBeCloseTo(40.7, 4)
    expect(sellingTotal(calculation)).toBe(550)
  })

  it('levert meerdere versieerbare klasse-8-sjablonen met unieke postcodes', () => {
    expect(class8CalculationTemplates).toHaveLength(3)
    for (const template of class8CalculationTemplates) {
      expect(template.recognitionClass).toBe('Klasse 8')
      expect(template.chapters.length).toBeGreaterThanOrEqual(4)
      const codes = template.chapters.flatMap(chapter => chapter.items.map(item => item.code))
      expect(new Set(codes).size).toBe(codes.length)
    }
  })
})

describe('calculatieversies vergelijken', () => {
  const base = { id:'calc-version',number:'CAL-V',opportunityId:'opp-1',status:'In opmaak',overheadPct:5,riskPct:2,marginPct:8,chapters:[{id:'chapter-a',code:'01',name:'Ruwbouw',sortOrder:0}],items:[
    {id:'old-a',chapterId:'chapter-a',code:'01.01',description:'Betonwand',quantity:10,unit:'m²',labor:20,material:80,equipment:0,subcontracting:0},
    {id:'old-b',chapterId:'chapter-a',code:'01.02',description:'Te verwijderen',quantity:2,unit:'st',labor:50,material:0,equipment:0,subcontracting:0},
  ],updatedAt:'2027-01-01'} satisfies Calculation

  it('onderscheidt toegevoegde, verwijderde en gewijzigde posten en rekent delta’s door', () => {
    const current = { ...structuredClone(base), overheadPct:7, chapters:[...base.chapters,{id:'chapter-b',code:'02',name:'Afwerking',sortOrder:1}], items:[
      {...base.items[0],id:'new-a',chapterId:'chapter-b',quantity:12,material:90},
      {id:'new-c',chapterId:'chapter-b',code:'02.01',description:'Nieuwe deur',quantity:1,unit:'st',labor:100,material:400,equipment:0,subcontracting:0},
    ], updatedAt:'2027-02-01' } satisfies Calculation
    const comparison = compareCalculationSnapshots(base,current)

    expect(comparison).toMatchObject({ added:1,removed:1,changed:1,unchanged:0 })
    expect(comparison.rows.find(row=>row.code==='01.01')).toMatchObject({status:'Gewijzigd',changedFields:expect.arrayContaining(['Hoofdstuk','Hoeveelheid','Eenheidsprijs'])})
    expect(comparison.rows.find(row=>row.code==='01.02')?.status).toBe('Verwijderd')
    expect(comparison.rows.find(row=>row.code==='02.01')?.status).toBe('Toegevoegd')
    expect(comparison.pricingChanges).toContainEqual({field:'overheadPct',label:'Algemene kosten',before:5,after:7,difference:2})
    expect(comparison.directCostDifference).toBe(720)
    expect(comparison.sellingTotalDifference).toBeGreaterThan(comparison.directCostDifference)
  })

  it('rapporteert identieke momentopnames als gelijk', () => {
    const comparison = compareCalculationSnapshots(base,structuredClone(base))
    expect(comparison).toMatchObject({added:0,removed:0,changed:0,unchanged:2,directCostDifference:0,sellingTotalDifference:0,pricingChanges:[]})
    expect(comparison.rows.every(row=>row.status==='Gelijk')).toBe(true)
  })
})

describe('portfolioplanning', () => {
  const activity = (id: string, startDate: string, endDate: string, predecessorIds: string[] = []) => ({ id, name: id, startDate, endDate, progress: 0, predecessorIds, milestone: false, responsible: 'Planner', crewSize: 2, weatherSensitive: false, resourceAssignments: [{ id: `${id}-resource`, resourceType: 'Materieel' as const, resourceName: 'Rupskraan 25t', allocationPct: 100 }] })

  it('gebruikt projectdatums voor een Gantt zonder activiteiten', () => {
    expect(planningTimelineRange([], '2026-09-01', '2033-12-31', '2026-07-29')).toEqual({
      startDate: '2026-09-01',
      endDate: '2033-12-31',
    })
  })

  it('valt bij ontbrekende of ongeldige projectdatums veilig terug op vandaag', () => {
    expect(planningTimelineRange([], '', 'ongeldig', '2026-07-29')).toEqual({
      startDate: '2026-07-29',
      endDate: '2026-07-29',
    })
  })

  it('detecteert dubbele resourceboekingen over projecten heen', () => {
    const projects = [
      { id: 'p1', planning: { status: 'Concept', baselineVersion: 0, updatedAt: '', activities: [activity('a1', '2027-04-01', '2027-04-05')] } },
      { id: 'p2', planning: { status: 'Concept', baselineVersion: 0, updatedAt: '', activities: [activity('a2', '2027-04-03', '2027-04-07')] } },
    ] as Project[]

    expect(planningConflicts(projects)).toEqual([expect.objectContaining({ resourceName: 'Rupskraan 25t', severity: 'Kritiek', projectIds: ['p1', 'p2'], startDate: '2027-04-03', endDate: '2027-04-05' })])
  })

  it('groepeert alle gelijktijdige boekingen in een bewerkbaar capaciteitsconflict', () => {
    const projects = [
      { id: 'p1', number: 'PRJ-001', name: 'Project Noord', planning: { status: 'Concept', baselineVersion: 0, updatedAt: '', activities: [{ ...activity('a1', '2027-04-01', '2027-04-10'), resourceAssignments: [{ id: 'r1', resourceType: 'Materieel' as const, resourceName: 'Rupskraan 25t', allocationPct: 100 }] }] } },
      { id: 'p2', number: 'PRJ-002', name: 'Project Zuid', planning: { status: 'Concept', baselineVersion: 0, updatedAt: '', activities: [{ ...activity('a2', '2027-04-03', '2027-04-08'), resourceAssignments: [{ id: 'r2', resourceType: 'Materieel' as const, resourceName: 'Rupskraan 25t', allocationPct: 50 }] }] } },
      { id: 'p3', number: 'PRJ-003', name: 'Project West', planning: { status: 'Concept', baselineVersion: 0, updatedAt: '', activities: [{ ...activity('a3', '2027-04-05', '2027-04-06'), resourceAssignments: [{ id: 'r3', resourceType: 'Materieel' as const, resourceName: 'Rupskraan 25t', allocationPct: 75 }] }] } },
    ] as Project[]

    const conflicts = planningConflicts(projects)
    const peak = conflicts.find(conflict => conflict.startDate === '2027-04-05' && conflict.endDate === '2027-04-06')

    expect(peak).toMatchObject({ totalAllocationPct: 225, capacityPct: 100, projectIds: ['p1', 'p2', 'p3'], activityIds: ['a1', 'a2', 'a3'] })
    expect(peak?.usages).toEqual([
      expect.objectContaining({ projectNumber: 'PRJ-001', projectName: 'Project Noord', activityName: 'a1', assignmentId: 'r1', allocationPct: 100 }),
      expect.objectContaining({ projectNumber: 'PRJ-002', projectName: 'Project Zuid', activityName: 'a2', assignmentId: 'r2', allocationPct: 50 }),
      expect.objectContaining({ projectNumber: 'PRJ-003', projectName: 'Project West', activityName: 'a3', assignmentId: 'r3', allocationPct: 75 }),
    ])
  })

  it('neemt goedgekeurd verlof en het arbeidsregime mee in de projectcapaciteit', () => {
    const employee = { id:'employee-1', employeeNumber:'MW-001', firstName:'Jan', lastName:'Peeters', email:'jan@example.be', role:'Grondwerker', legalEntityId:'entity-1', employmentPct:80, weeklyHours:32, annualLeaveHours:128, hireDate:'2020-01-01', skills:[], active:true, createdAt:'2020-01-01T00:00:00.000Z' }
    const crew = { id:'crew-1', name:'Ploeg Noord', legalEntityId:'entity-1', leaderEmployeeId:employee.id, memberEmployeeIds:[employee.id], active:true, createdAt:'2027-01-01T00:00:00.000Z' }
    const employeeActivity = { ...activity('employee-activity', '2027-04-01', '2027-04-10'), responsible:'Jan Peeters', responsibleEmployeeId:employee.id, resourceAssignments:[{ id:'assignment-1', employeeId:employee.id, resourceType:'Medewerker' as const, resourceName:'Jan Peeters', allocationPct:100 },{ id:'assignment-2', crewId:crew.id, resourceType:'Ploeg' as const, resourceName:'Ploeg Noord', allocationPct:100 }] }
    const projects = [{ id:'p1', planning:{ status:'Concept', baselineVersion:0, updatedAt:'', activities:[employeeActivity] } }] as Project[]
    const absences = [{ id:'absence-1', employeeId:employee.id, type:'Verlof' as const, startDate:'2027-04-03', endDate:'2027-04-05', hours:24, reason:'Jaarlijks verlof', status:'Goedgekeurd' as const, requestedBy:'Jan Peeters', requestedAt:'2027-03-01T00:00:00.000Z', decidedBy:'HR', decidedAt:'2027-03-02T00:00:00.000Z' }]

    expect(planningConflicts(projects,[employee],absences,[crew])).toEqual(expect.arrayContaining([
      expect.objectContaining({ id:'absence:absence-1:employee-activity', severity:'Kritiek', startDate:'2027-04-03', endDate:'2027-04-05' }),
      expect.objectContaining({ id:'employment:employee-1:employee-activity', severity:'Waarschuwing' }),
      expect.objectContaining({ id:'crew-absence:crew-1:absence-1:employee-activity', resourceType:'Ploeg', severity:'Kritiek' }),
      expect.objectContaining({ id:'responsible-absence:absence-1:employee-activity', resourceType:'Medewerker', severity:'Kritiek' }),
    ]))
  })

  it('leidt het kritieke pad af via de voorgangers van de eindmijlpaal', () => {
    const first = activity('a1', '2027-04-01', '2027-04-02')
    const second = activity('a2', '2027-04-03', '2027-04-05', ['a1'])
    const parallel = activity('a3', '2027-04-01', '2027-04-02')
    const milestone = { ...activity('m1', '2027-04-05', '2027-04-05', ['a2']), milestone: true }
    expect([...criticalPathActivityIds({ status: 'Concept', baselineVersion: 0, updatedAt: '', activities: [first, second, parallel, milestone] })]).toEqual(expect.arrayContaining(['a1', 'a2', 'm1']))
    expect(criticalPathActivityIds({ status: 'Concept', baselineVersion: 0, updatedAt: '', activities: [first, second, parallel, milestone] }).has('a3')).toBe(false)
  })

  it('berekent CPM-speling over parallelle paden en plant afhankelijkheden automatisch door', () => {
    const start = activity('start', '2027-04-01', '2027-04-02')
    const long = { ...activity('long', '2027-04-10', '2027-04-13', ['start']), dependencies: [{ predecessorId: 'start', type: 'FS' as const, lagDays: 1 }] }
    const short = { ...activity('short', '2027-04-10', '2027-04-10', ['start']), dependencies: [{ predecessorId: 'start', type: 'SS' as const, lagDays: 0 }] }
    const end = { ...activity('end', '2027-04-20', '2027-04-20', ['long', 'short']), milestone: true, dependencies: [{ predecessorId: 'long', type: 'FS' as const, lagDays: 0 }, { predecessorId: 'short', type: 'FS' as const, lagDays: 0 }] }
    const planning = { status: 'Concept' as const, baselineVersion: 0, updatedAt: '', activities: [start, long, short, end] }
    const analysis = criticalPathAnalysis(planning)

    expect(analysis.hasCycle).toBe(false)
    expect(analysis.criticalActivityIds).toEqual(new Set(['start', 'long', 'end']))
    expect(analysis.metrics.get('short')?.totalFloatDays).toBe(6)
    expect(analysis.projectDurationDays).toBe(7)
    expect(autoSchedulePlanningActivities(planning.activities, '2027-04-01').map(item => ({ id: item.id, start: item.startDate, end: item.endDate }))).toEqual([
      { id: 'start', start: '2027-04-01', end: '2027-04-02' },
      { id: 'long', start: '2027-04-04', end: '2027-04-07' },
      { id: 'short', start: '2027-04-01', end: '2027-04-01' },
      { id: 'end', start: '2027-04-08', end: '2027-04-08' },
    ])
  })

  it('blokkeert CPM-analyse wanneer afhankelijkheden een cyclus vormen', () => {
    const first = { ...activity('a1', '2027-04-01', '2027-04-02', ['a2']) }
    const second = { ...activity('a2', '2027-04-03', '2027-04-04', ['a1']) }
    expect(criticalPathAnalysis({ status: 'Concept', baselineVersion: 0, updatedAt: '', activities: [first, second] }).hasCycle).toBe(true)
  })
})

describe('cashflowberekening', () => {
  it('leidt openstaande, achterstallige en verwachte kasstromen af uit brongegevens', () => {
    const entries = cashFlowEntries(state, undefined, '2027-03-20')

    expect(entries).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceId: 'invoice-1', direction: 'In', amount: 1210, status: 'Achterstallig', date: '2027-03-10' }),
      expect.objectContaining({ sourceId: 'order-1', direction: 'Uit', amount: 5700, status: 'Achterstallig', date: '2027-03-18' }),
      expect.objectContaining({ sourceId: 'order-2', direction: 'Uit', amount: 1000, status: 'Verwacht', date: '2027-05-01' }),
    ]))
  })

  it('groepeert de kasstromen per maand zonder een apart financieel grootboek', () => {
    const periods = cashFlowPeriods(cashFlowEntries(state, undefined, '2027-03-20'))

    expect(periods).toEqual([
      { month: '2027-03', incoming: 1210, outgoing: 5700, net: -4490 },
      { month: '2027-05', incoming: 0, outgoing: 1000, net: -1000 },
    ])
  })
})

describe('Peppol-operatiebewaking', () => {
  it('toont alleen uitgegeven facturen en markeert mislukte of vastgelopen leveringen', () => {
    const invoice = state.salesInvoices[0]
    const invoices: SalesInvoice[] = [invoice, { ...invoice, id: 'invoice-2', number: 'VF-002' }, { ...invoice, id: 'invoice-3', number: 'VF-003' }, { ...invoice, id: 'invoice-concept', number: 'VF-004', status: 'Concept' }]
    const delivery = (id: string, invoiceId: string, status: PeppolDelivery['status'], updatedAt: string): PeppolDelivery => ({ id, invoiceId, validationReportId: 'validation-1', status, provider: 'Test AP', providerReference: `AP-${id}`, idempotencyKey: `key-${id}`, attempts: 1, message: status, events: [], requestedAt: updatedAt, updatedAt })
    const operations = peppolOperations(invoices, [
      delivery('delivery-old', invoice.id, 'Fout', '2027-03-20T09:00:00.000Z'),
      delivery('delivery-current', invoice.id, 'Geaccepteerd', '2027-03-20T10:00:00.000Z'),
      delivery('delivery-delivered', 'invoice-2', 'Afgeleverd', '2027-03-20T10:20:00.000Z'),
      delivery('delivery-rejected', 'invoice-3', 'Geweigerd', '2027-03-20T10:25:00.000Z'),
    ], '2027-03-20T11:00:00.000Z')

    expect(operations).toHaveLength(3)
    expect(operations.find(item => item.invoiceId === invoice.id)).toMatchObject({ status: 'Geaccepteerd', stale: true, needsAttention: true, delivery: { id: 'delivery-current' } })
    expect(operations.find(item => item.invoiceId === 'invoice-2')).toMatchObject({ status: 'Afgeleverd', stale: false, needsAttention: false })
    expect(operations.find(item => item.invoiceId === 'invoice-3')).toMatchObject({ status: 'Geweigerd', needsAttention: true })
  })
})

describe('nacalculatie', () => {
  it('verdeelt werkelijke kosten gewogen terug naar de oorspronkelijke meetstaatpost', () => {
    const postState: BouwFlowState = {
      ...state,
      projects: [{ ...project, sourceCalculationId: 'calculation-1', costBudget: 1000, progress: 75, workPackages: [{ id: 'wp-1', code: '01', name: 'Grondwerken', budget: 1000, plannedHours: 0, status: 'Klaar voor planning' }] }],
      calculations: [{ id: 'calculation-1', number: 'CAL-001', opportunityId: 'opportunity-1', status: 'Offerte', overheadPct: 0, riskPct: 0, marginPct: 10, chapters: [{ id: 'chapter-1', code: '01', name: 'Grondwerken', sortOrder: 0 }], items: [{ id: 'boq-1', chapterId: 'chapter-1', code: '01.01', description: 'Uitgraving', quantity: 100, unit: 'm³', labor: 5, material: 5, equipment: 0, subcontracting: 0 }], updatedAt: '2027-01-01T00:00:00.000Z' }],
      projectCosts: [
        { id: 'cost-labor', projectId: project.id, workPackageId: 'wp-1', date: '2027-02-01', type: 'Werkelijke kost', category: 'labor', description: 'Ploeguren', supplier: '', amount: 600, reference: 'UREN', status: 'Geboekt', createdAt: '2027-02-01T00:00:00.000Z' },
        { id: 'cost-material', projectId: project.id, workPackageId: 'wp-1', date: '2027-02-01', type: 'Werkelijke kost', category: 'material', description: 'Materiaal', supplier: 'Leverancier', amount: 100, reference: 'LF-1', status: 'Geboekt', createdAt: '2027-02-01T00:00:00.000Z' },
      ],
    }

    const analysis = postCalculationAnalysis(postState, project.id)

    expect(analysis).toMatchObject({ planned: 1000, actual: 700, variance: 300, completionPct: 75 })
    expect(analysis?.workPackages[0]).toMatchObject({ planned: 1000, actual: 700, variance: 300 })
    expect(analysis?.itemInsights).toEqual(expect.arrayContaining([
      expect.objectContaining({ boqItemId: 'boq-1', category: 'labor', plannedUnitCost: 5, actualUnitCost: 6, allocatedActualCost: 600 }),
      expect.objectContaining({ boqItemId: 'boq-1', category: 'material', plannedUnitCost: 5, actualUnitCost: 1, allocatedActualCost: 100 }),
    ]))
  })
})

describe('geavanceerde calculatieformules',()=>{
  it('berekent afhankelijke velden en opeenvolgende markups en markdowns veilig',()=>{
    const item:BoqItem={id:'post-1',code:'01.01',description:'Formulepost',quantity:1,unit:'mÂ²',labor:0,material:100,equipment:0,subcontracting:0,variables:[{id:'var-length',name:'Lengte',value:2,unit:'m'},{id:'var-width',name:'Breedte',value:3,unit:'m'}],formulas:{quantity:{id:'formula-quantity',label:'Oppervlakte',updatedAt:'2027-01-01T00:00:00.000Z',tokens:[{id:'t1',kind:'variable',variableId:'var-length'},{id:'t2',kind:'operator',operator:'*'},{id:'t3',kind:'variable',variableId:'var-width'}]},labor:{id:'formula-labor',label:'Arbeid per mÂ²',updatedAt:'2027-01-01T00:00:00.000Z',tokens:[{id:'t4',kind:'field',field:'quantity'},{id:'t5',kind:'operator',operator:'*'},{id:'t6',kind:'number',value:10}]}},priceAdjustments:[{id:'adjustment-1',label:'Complexiteit',type:'Markup',basis:'Directe kost',percentage:10,active:true},{id:'adjustment-2',label:'CommerciÃ«le korting',type:'Markdown',basis:'Directe kost',percentage:5,active:true}]}
    expect(effectiveBoqValues(item)).toMatchObject({values:{quantity:6,labor:60},errors:{}})
    expect(unitCost(item)).toBeCloseTo(167.2)
    expect(boqPriceBreakdown(item).adjustments.map(rule=>rule.amount)).toEqual([16,-8.8])
  })

  it('blokkeert cirkelverwijzingen en valt terug op de handmatige waarden',()=>{
    const item:BoqItem={id:'post-2',code:'01.02',description:'Cirkel',quantity:2,unit:'st',labor:5,material:0,equipment:0,subcontracting:0,formulas:{quantity:{id:'f1',label:'Q',updatedAt:'2027-01-01T00:00:00.000Z',tokens:[{id:'a',kind:'field',field:'labor'}]},labor:{id:'f2',label:'L',updatedAt:'2027-01-01T00:00:00.000Z',tokens:[{id:'b',kind:'field',field:'quantity'}]}}}
    const result=effectiveBoqValues(item)
    expect(result.values).toMatchObject({quantity:2,labor:5})
    expect(result.errors.quantity).toContain('Cirkelverwijzing')
    expect(result.errors.labor).toContain('Cirkelverwijzing')
  })

  it('toont en verwerkt een bulkopslag alleen op de gekozen prijsdragende posten',()=>{
    const calculation={id:'calc-bulk',number:'CAL-BULK',opportunityId:'opp-1',status:'In opmaak',overheadPct:0,riskPct:0,marginPct:0,chapters:[],items:[
      {id:'post-a',code:'01.01',description:'Post A',quantity:2,unit:'st',labor:50,material:50,equipment:0,subcontracting:0},
      {id:'post-b',code:'01.02',description:'Post B',quantity:1,unit:'st',labor:100,material:0,equipment:0,subcontracting:0},
      {id:'text',code:'T',description:'Tekst',quantity:1,unit:'st',labor:0,material:0,equipment:0,subcontracting:0,postType:'Tekstregel' as const},
    ],updatedAt:'2027-01-01'} satisfies Calculation
    const preview=bulkBoqPriceAdjustmentPreview(calculation,['post-a','text'],{id:'bulk-1',label:'Werfrisico',type:'Markup',basis:'Directe kost',percentage:10,active:true})
    expect(preview).toMatchObject({selectedItems:2,affectedItems:1,skippedItems:1,beforeDirectCost:300,afterDirectCost:320,directCostImpact:20})
    expect(preview.updatedCalculation.items.find(item=>item.id==='post-a')?.priceAdjustments).toHaveLength(1)
    expect(preview.updatedCalculation.items.find(item=>item.id==='post-b')?.priceAdjustments).toBeUndefined()
    expect(preview.updatedCalculation.items.find(item=>item.id==='text')?.priceAdjustments).toBeUndefined()
  })
})

describe('QHSE-bewaking', () => {
  it('classificeert attesten op basis van hun vervaldatum', () => {
    const base = { id: 'cert-1', projectId: project.id, holderType: 'Medewerker' as const, holderName: 'Jan Peeters', certificateType: 'VCA', certificateNumber: 'VCA-1', createdAt: '2027-01-01T00:00:00.000Z' }
    expect(qhseCertificateStatus({ ...base, expiresOn: '2027-03-01' }, '2027-03-02')).toBe('Vervallen')
    expect(qhseCertificateStatus({ ...base, expiresOn: '2027-03-20' }, '2027-03-02')).toBe('Verloopt binnenkort')
    expect(qhseCertificateStatus({ ...base, expiresOn: '2028-03-20' }, '2027-03-02')).toBe('Geldig')
  })

  it('combineert vervallen attesten en laattijdige vaststellingen in een waarschuwingsoverzicht', () => {
    const alertState: BouwFlowState = {
      ...state,
      qhseCertificates: [{ id: 'cert-1', projectId: project.id, holderType: 'Materieel', holderName: 'Rupskraan 25 ton', certificateType: 'Keuring hijstoestel', certificateNumber: 'K-1', expiresOn: '2027-03-01', createdAt: '2027-01-01T00:00:00.000Z' }],
      qhseInspections: [{ id: 'inspection-1', projectId: project.id, inspectionDate: '2027-03-01', type: 'Veiligheidsinspectie', inspector: 'Els', location: 'Zone A', notes: '', findings: [{ id: 'finding-1', description: 'Sleuf afschermen', severity: 'Hoog', responsible: 'Jan', dueDate: '2027-03-02' }], status: 'Open', createdAt: '2027-03-01T00:00:00.000Z' }],
    }
    expect(qhseAlerts(alertState, project.id, '2027-03-03')).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceType: 'certificate', severity: 'Kritiek' }),
      expect.objectContaining({ sourceType: 'finding', sourceId: 'finding-1', severity: 'Kritiek' }),
    ]))
  })
})
