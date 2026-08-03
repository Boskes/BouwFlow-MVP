import { createHash } from 'node:crypto'
import type { PoolClient } from 'pg'
import { defaultWorkflowDefinitions } from '../../src/administration.js'
import { FAMILY_HOME_MODEL_ID, buildFamilyHomeBimCalculation, buildFamilyHomeBimProgressStatement, buildFamilyHomeBimProject } from '../../src/family-home-bim.js'
import { BOSMANS_TAVERNIERS_MODEL_ID, buildBosmansTaverniersCalculation, buildBosmansTaverniersProgressStatement, buildBosmansTaverniersProject } from '../../src/bosmans-taverniers-bim.js'
import type { ObjectStorage } from '../storage.js'

const DEMO_LEGAL_ENTITY_ID = '20000000-0000-4000-8200-000000000001'
const DEMO_BRANCH_ID = '20000000-0000-4000-8200-000000000002'
const DEMO_ORGANIZATION_ID = '20000000-0000-4000-8000-000000000001'
const DEMO_OPPORTUNITY_ID = '20000000-0000-4000-8000-000000000002'
const DEMO_CALCULATION_ID = '20000000-0000-4000-8000-000000000003'
const DEMO_PROJECT_ID = '20000000-0000-4000-8000-000000000004'

function id(scope: string, value: string) {
  const hex = createHash('sha256').update(`bouwflow:${scope}:${value}`).digest('hex').slice(0, 32).split('')
  hex[12] = '4'
  hex[16] = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16)
  const compact = hex.join('')
  return `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20)}`
}

const userIds = {
  tenderOwner: id('demo-user', 'tessa-tender'),
  tenderReviewer: id('demo-user', 'david-projectdirecteur'),
  calculator: id('demo-user', 'noor-calculator'),
  projectManager: id('demo-user', 'lena-projectmanager'),
  siteManager: id('demo-user', 'wouter-werfleider'),
  purchaser: id('demo-user', 'amina-aankoper'),
  finance: id('demo-user', 'elise-finance'),
  client: id('demo-user', 'marie-client'),
  subcontractor: id('demo-user', 'omar-subcontractor'),
  supplier: id('demo-user', 'nora-supplier'),
}

const employeeIds = {
  tenderOwner: id('employee', 'tessa-tender'),
  tenderReviewer: id('employee', 'david-projectdirecteur'),
  calculator: id('employee', 'noor-calculator'),
  projectManager: id('employee', 'lena-projectmanager'),
  siteManager: id('employee', 'wouter-werfleider'),
  purchaser: id('employee', 'amina-aankoper'),
  finance: id('employee', 'elise-finance'),
  foreman: id('employee', 'milan-ploegbaas'),
  worker: id('employee', 'yassin-arbeider'),
  prevention: id('employee', 'maaike-preventie'),
}

const subcontractorId = id('subcontractor', 'delta-infra')
const supplierId = id('supplier', 'steelworks')
const supplierRequestId = id('procurement', 'oosterweel-ready-mix')
const purchaseOrderId = id('purchase-order', 'oosterweel-ready-mix')
const commitmentCostId = id('cost', 'oosterweel-ready-mix')
const documentIds = {
  tender: id('document', 'oosterweel-bestek'),
  plan: id('document', 'oosterweel-uitvoeringsplan'),
  safety: id('document', 'oosterweel-vgp'),
  contract: id('document', 'oosterweel-contract'),
  report: id('document', 'oosterweel-weekverslag'),
}

type JsonRecord = { id: string; [key: string]: unknown }

function mergeById<T extends JsonRecord>(current: T[], additions: T[]) {
  const result = new Map(current.map(item => [item.id, item]))
  for (const item of additions) if (!result.has(item.id)) result.set(item.id, item)
  return [...result.values()]
}

function jsonArray(value: unknown): JsonRecord[] {
  if (!value) return []
  const parsed = typeof value === 'string' ? JSON.parse(value) as unknown : value
  return Array.isArray(parsed)
    ? parsed.filter((item): item is JsonRecord => Boolean(item && typeof item === 'object' && 'id' in item && typeof item.id === 'string'))
    : []
}

async function putDemoObject(storage: ObjectStorage | undefined, key: string, content: string) {
  if (!storage) return
  try {
    await storage.get(key)
  } catch {
    try {
      await storage.put(key, Buffer.from(content, 'utf8'))
    } catch {
      await storage.get(key)
    }
  }
}

async function seedUsers(client: PoolClient, tenantId: string) {
  const users = [
    [userIds.tenderOwner, 'Tessa Vermeulen', 'tessa.vermeulen@demo.aifestival.be', 'Tender manager', employeeIds.tenderOwner, null, null, null, false, false],
    [userIds.tenderReviewer, 'David Peeters', 'david.peeters@demo.aifestival.be', 'Projectdirecteur', employeeIds.tenderReviewer, null, null, null, true, true],
    [userIds.calculator, 'Noor Claes', 'noor.claes@demo.aifestival.be', 'Calculator', employeeIds.calculator, null, null, null, false, false],
    [userIds.projectManager, 'Lena Vermeulen', 'lena.vermeulen@demo.aifestival.be', 'Projectmanager', employeeIds.projectManager, null, null, null, false, false],
    [userIds.siteManager, 'Wouter Peeters', 'wouter.peeters@demo.aifestival.be', 'Werfleider', employeeIds.siteManager, null, null, null, false, false],
    [userIds.purchaser, 'Amina El Idrissi', 'amina.elidrissi@demo.aifestival.be', 'Aankoper', employeeIds.purchaser, null, null, null, false, false],
    [userIds.finance, 'Elise Martens', 'elise.martens@demo.aifestival.be', 'Financiële administratie', employeeIds.finance, null, null, null, true, true],
    [userIds.client, 'Marie De Clerck', 'marie.declerck@demo.aifestival.be', 'Klant', null, DEMO_ORGANIZATION_ID, null, null, false, false],
    [userIds.subcontractor, 'Omar Benali', 'omar.benali@demo.aifestival.be', 'Onderaannemer', null, null, subcontractorId, null, false, false],
    [userIds.supplier, 'Nora De Wilde', 'nora.dewilde@demo.aifestival.be', 'Leverancier', null, null, null, supplierId, false, false],
  ] as const

  for (const user of users) {
    await client.query(
      `INSERT INTO users
        (tenant_id,id,display_name,email,role,employee_id,organization_id,subcontractor_id,supplier_id,all_legal_entities,all_projects,status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'Actief')
       ON CONFLICT (tenant_id,id) DO NOTHING`,
      [tenantId, ...user],
    )
    if (!user[8]) await client.query(
      'INSERT INTO user_legal_entity_access (tenant_id,user_id,legal_entity_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
      [tenantId, user[0], DEMO_LEGAL_ENTITY_ID],
    )
    if (!user[9]) await client.query(
      'INSERT INTO user_project_access (tenant_id,user_id,project_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
      [tenantId, user[0], DEMO_PROJECT_ID],
    )
  }
}

async function seedTenderAndPlanning(client: PoolClient, tenantId: string) {
  const tender = {
    procedureType: 'Openbaar',
    publicationDate: '2026-07-01',
    submissionDeadline: '2027-12-31T16:00:00.000Z',
    executionPeriod: '84 kalendermaanden',
    recognitionClass: 'Klasse 8',
    recognitionCategory: 'C',
    selectionConditions: [
      'Erkenning klasse 8 categorie C',
      'Gemiddelde jaaromzet infrastructuurwerken ≥ € 150 miljoen',
      'Minstens drie referenties van complexe klasse 8-projecten',
      'VCA** en ISO 9001 geldig op indieningsdatum',
    ],
    awardCriteria: [
      { id: id('award', 'price'), criterion: 'Prijs', weightPct: 60 },
      { id: id('award', 'quality'), criterion: 'Plan van aanpak, fasering en hinderbeperking', weightPct: 40 },
    ],
    requiredDocumentIds: [documentIds.tender, documentIds.plan, documentIds.safety],
    questions: [
      { id: id('tender-question', 'utilities'), question: 'Welke nutsverleggingen zijn vóór de start door de opdrachtgever uitgevoerd?', answer: 'De interfaces zijn opgenomen in raakvlakkenregister versie 3.2.', askedOn: '2026-07-18', answeredOn: '2026-07-24', status: 'Beantwoord' },
      { id: id('tender-question', 'night-work'), question: 'Welke nachtvensters zijn beschikbaar voor de verkeersomlegging?', askedOn: '2026-07-25', status: 'Open' },
    ],
    siteVisits: [
      { id: id('site-visit', 'oosterweel-1'), scheduledAt: '2026-08-12T08:30:00.000Z', location: 'Lantis projectkantoor Rechteroever', mandatory: true, attendees: ['Tessa Vermeulen', 'Noor Claes', 'Lena Vermeulen'], notes: 'PBM en identiteitskaart verplicht.' },
    ],
    competitors: ['BESIX', 'Jan De Nul', 'TM ROCO'],
    deadlineWarningDays: [60, 30, 14, 7, 2],
    approvedBy: 'David Peeters',
    approvedAt: '2026-08-20T14:00:00.000Z',
    submissionPlan: {
      ownerEmployeeId: employeeIds.tenderOwner,
      reviewerEmployeeId: employeeIds.tenderReviewer,
      internalReviewAt: '2027-12-10T09:00:00.000Z',
      finalizationAt: '2027-12-22T09:00:00.000Z',
      submissionAt: '2027-12-29T10:00:00.000Z',
      reminderDays: [60, 30, 14, 7, 2, 1],
      status: 'Gepland',
      checklist: [
        { id: id('tender-check', 'conditions'), label: 'Selectievoorwaarden gecontroleerd', required: true, completed: true, completedAt: '2026-08-20T09:00:00.000Z', completedBy: 'Tessa Vermeulen' },
        { id: id('tender-check', 'documents'), label: 'Verplichte documenten gekoppeld', required: true, completed: true, completedAt: '2026-08-20T10:00:00.000Z', completedBy: 'Tessa Vermeulen' },
        { id: id('tender-check', 'questions'), label: 'Open vragen beantwoord', required: true, completed: false },
        { id: id('tender-check', 'calculation'), label: 'Calculatie intern goedgekeurd', required: true, completed: false },
        { id: id('tender-check', 'signature'), label: 'Offertedocument ondertekend', required: true, completed: false },
        { id: id('tender-check', 'channel'), label: 'Digitaal indieningskanaal getest', required: true, completed: false },
      ],
      notes: 'Wekelijkse tenderstand-up op dinsdag; reviewer sluit aan vanaf 30 dagen voor deadline.',
      updatedAt: '2026-08-20T14:00:00.000Z',
    },
    updatedAt: '2026-08-20T14:00:00.000Z',
  }
  await client.query('UPDATE opportunities SET tender=$3,updated_at=now() WHERE tenant_id=$1 AND id=$2', [tenantId, DEMO_OPPORTUNITY_ID, JSON.stringify(tender)])

  const activities = [
    ['werf-inrichting', 'Werfinrichting en verkeersmaatregelen', '2026-09-01', '2026-10-15', 100, []],
    ['nuts-detectie', 'Proefsleuven en nutsdetectie', '2026-09-15', '2026-11-15', 68, ['werf-inrichting']],
    ['bouwkuip', 'Bouwkuip Rechteroever fase 1', '2026-11-16', '2027-08-31', 22, ['nuts-detectie']],
    ['tunnelbak', 'Constructie tunnelbak fase 1', '2027-09-01', '2029-06-30', 0, ['bouwkuip']],
    ['installaties', 'Technische installaties en energievoorziening', '2029-03-01', '2031-09-30', 0, ['tunnelbak']],
    ['wegenis', 'Aansluitende wegenis en knooppunten', '2030-01-15', '2032-08-31', 0, ['tunnelbak']],
    ['testen', 'Integrale testen en indienststelling', '2032-09-01', '2033-06-30', 0, ['installaties', 'wegenis']],
    ['oplevering', 'Voorlopige oplevering', '2033-12-15', '2033-12-15', 0, ['testen']],
  ].map(([key, name, startDate, endDate, progress, predecessors], index) => ({
    id: id('planning-activity', String(key)),
    workPackageId: id('work-package', String(Math.min(index + 1, 12))),
    name,
    startDate,
    endDate,
    progress,
    predecessorIds: (predecessors as string[]).map(value => id('planning-activity', value)),
    dependencies: (predecessors as string[]).map(value => ({ predecessorId: id('planning-activity', value), type: 'FS', lagDays: 0 })),
    milestone: key === 'oplevering',
    responsible: index < 3 ? 'Wouter Peeters' : 'Lena Vermeulen',
    responsibleEmployeeId: index < 3 ? employeeIds.siteManager : employeeIds.projectManager,
    crewSize: key === 'oplevering' ? 0 : 12 + index * 4,
    weatherSensitive: ['werf-inrichting', 'nuts-detectie', 'bouwkuip', 'wegenis'].includes(String(key)),
    resourceAssignments: [{ id: id('planning-resource', String(key)), resourceType: index < 3 ? 'Ploeg' : 'Materieel', resourceName: index < 3 ? 'Ploeg Rechteroever' : 'Rupskraan 35t', allocationPct: 100 }],
    baselineStartDate: startDate,
    baselineEndDate: endDate,
  }))
  const project = await client.query<{ handover: Record<string, unknown> | string }>('SELECT handover FROM projects WHERE tenant_id=$1 AND id=$2', [tenantId, DEMO_PROJECT_ID])
  const currentHandover = typeof project.rows[0]?.handover === 'string' ? JSON.parse(project.rows[0].handover) as Record<string, unknown> : project.rows[0]?.handover ?? {}
  await client.query(
    'UPDATE projects SET planning=$3,handover=$4 WHERE tenant_id=$1 AND id=$2',
    [
      tenantId,
      DEMO_PROJECT_ID,
      JSON.stringify({ status: 'Baseline', baselineVersion: 1, activities, updatedAt: '2026-09-30T16:00:00.000Z', baselineHistory: [{ id: id('baseline', 'v1'), version: 1, name: 'Contractbaseline', reason: 'Goedgekeurde initiële uitvoeringsplanning', approvalStatus: 'Goedgekeurd', createdAt: '2026-08-20T15:00:00.000Z', createdBy: 'David Peeters', activities: activities.map(item => ({ activityId: item.id, startDate: item.startDate, endDate: item.endDate })) }], scenarios: [] }),
      JSON.stringify({ ...currentHandover, projectManager: 'Lena Vermeulen', projectManagerEmployeeId: employeeIds.projectManager }),
    ],
  )
}

async function seedDocuments(client: PoolClient, tenantId: string, storage?: ObjectStorage) {
  const records = [
    [documentIds.tender, 'Bestek en administratieve bepalingen', 'Contract', 'Goedgekeurd', 'bestek.txt', 'Definitief bestek met selectie- en uitvoeringsvoorwaarden.'],
    [documentIds.plan, 'Uitvoeringsplan Rechteroever', 'Plan', 'Goedgekeurd', 'uitvoeringsplan.txt', 'Faseringsplan, raakvlakken en tijdelijke verkeersmaatregelen.'],
    [documentIds.safety, 'Veiligheids- en gezondheidsplan', 'Veiligheid', 'Goedgekeurd', 'vgp.txt', 'Projectspecifiek veiligheids- en gezondheidsplan.'],
    [documentIds.contract, 'Getekende aannemingsovereenkomst', 'Contract', 'Goedgekeurd', 'contract.txt', 'Getekende overeenkomst en contractuele bijlagen.'],
    [documentIds.report, 'Weekverslag uitvoering week 38', 'Verslag', 'Concept', 'weekverslag.txt', 'Voortgang, beslissingen, risico’s en acties van het projectteam.'],
  ] as const

  for (const [documentId, title, category, status, fileName, content] of records) {
    const versionId = id('document-version', documentId)
    const storageKey = `${tenantId}/demo/${documentId}/${fileName}`
    await client.query(
      `INSERT INTO documents (tenant_id,id,project_id,legal_entity_id,title,category,status,current_version_id,approved_by,approved_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (tenant_id,id) DO NOTHING`,
      [tenantId, documentId, DEMO_PROJECT_ID, DEMO_LEGAL_ENTITY_ID, title, category, status, versionId, status === 'Goedgekeurd' ? 'David Peeters' : null, status === 'Goedgekeurd' ? '2026-09-20T10:00:00.000Z' : null],
    )
    await client.query(
      `INSERT INTO document_versions (tenant_id,id,document_id,revision,revision_label,storage_key,file_name,mime_type,size_bytes,content_digest,notes,uploaded_by,created_at)
       VALUES ($1,$2,$3,1,'A',$4,$5,'text/plain',$6,$7,$8,'Tessa Vermeulen','2026-09-19T09:00:00.000Z')
       ON CONFLICT (tenant_id,id) DO NOTHING`,
      [tenantId, versionId, documentId, storageKey, fileName, Buffer.byteLength(content), createHash('sha256').update(content).digest('hex'), 'Volledig demodocument voor ketentesten.'],
    )
    await putDemoObject(storage, storageKey, content)
  }

  const links = [
    [documentIds.tender, 'Opportuniteit', DEMO_OPPORTUNITY_ID, 'Oosterweel tenderdossier'],
    [documentIds.plan, 'Opportuniteit', DEMO_OPPORTUNITY_ID, 'Oosterweel tenderdossier'],
    [documentIds.safety, 'Onderaannemer', subcontractorId, 'Delta Infra NV'],
    [documentIds.contract, 'Project', DEMO_PROJECT_ID, 'Oosterweelverbinding'],
  ]
  for (const [documentId, linkType, recordId, label] of links) await client.query(
    `INSERT INTO document_record_links (tenant_id,id,document_id,link_type,record_id,label,created_by)
     VALUES ($1,$2,$3,$4,$5,$6,'Tessa Vermeulen') ON CONFLICT DO NOTHING`,
    [tenantId, id('document-link', `${documentId}:${linkType}:${recordId}`), documentId, linkType, recordId, label],
  )

  const photoId = id('site-photo', 'oosterweel-zone-a')
  const photoKey = `${tenantId}/demo/photos/${photoId}.txt`
  const photoContent = 'BouwFlow demo-werfbeeld: bouwkuip zone A, referentie-inmeting 16 september 2026.'
  await client.query(
    `INSERT INTO site_photos (tenant_id,id,project_id,daily_report_id,work_package_id,storage_key,file_name,mime_type,size_bytes,caption,location,taken_at)
     VALUES ($1,$2,$3,$4,$5,$6,'bouwkuip-zone-a.txt','text/plain',$7,'Bouwkuip zone A na referentie-inmeting','Rechteroever zone A','2026-09-16T14:25:00.000Z')
     ON CONFLICT (tenant_id,id) DO NOTHING`,
    [tenantId, photoId, DEMO_PROJECT_ID, id('daily-report', 'oosterweel-20260916'), id('work-package', '3'), photoKey, Buffer.byteLength(photoContent)],
  )
  await putDemoObject(storage, photoKey, photoContent)
}

async function seedCommercialAndFinancialFlow(client: PoolClient, tenantId: string) {
  await client.query(
    `INSERT INTO quotes (tenant_id,id,number,calculation_id,version,total,content,snapshot,workflow,created_at)
     VALUES ($1,$2,'OFF-OWV-2026-01',$3,1,875000000,$4,$5,$6,'2026-08-25T09:00:00.000Z')
     ON CONFLICT DO NOTHING`,
    [
      tenantId,
      id('quote', 'oosterweel-v1'),
      DEMO_CALCULATION_ID,
      JSON.stringify({ subject: 'Offerte Oosterweelverbinding Rechteroever', introduction: 'Integrale klasse 8-aanbieding voor ontwerp, uitvoering en indienststelling.', executionTerm: '84 kalendermaanden', paymentTerms: 'Maandelijkse vorderingsstaten, 30 dagen', validityDays: 180, validUntil: '2027-02-21', priceRevision: 'Volgens contractuele indexeringsformule', exclusions: ['Archeologische vondsten buiten referentiedossier'], notes: 'Volledige demo-offerte voor klantgoedkeuring.' }),
      JSON.stringify({ supplierName: 'Bosis BE', clientName: 'Lantis', clientContact: 'Marie De Clerck', projectTitle: 'Oosterweelverbinding - Rechteroever', projectNumber: 'OWV-RO-DEMO', location: 'Antwerpen - Rechteroever', lines: [{ code: '01', description: 'Voorbereidende werken en fasering', quantity: 1, unit: 'GP', unitPrice: 125000000, total: 125000000 }, { code: '02', description: 'Tunnel- en infrastructuurwerken', quantity: 1, unit: 'GP', unitPrice: 750000000, total: 750000000 }], directCost: 650000000, overheadPct: 8, riskPct: 3, marginPct: 10, total: 875000000 }),
      JSON.stringify({ status: 'Verzonden', validUntil: '2027-02-21', events: [{ id: id('quote-event', 'created'), type: 'Aangemaakt', at: '2026-08-25T09:00:00.000Z', actor: 'Noor Claes' }, { id: id('quote-event', 'sent'), type: 'Verzonden', at: '2026-08-26T10:00:00.000Z', actor: 'Tessa Vermeulen' }] }),
    ],
  )

  const statement1 = id('progress-statement', 'oosterweel-2026-09')
  const statement2 = id('progress-statement', 'oosterweel-2026-10')
  const tunnelBimEvidence = { modelId:'tunnel-class8',modelName:'RingTunnel-Zuid-IFC43.ifc',modelVersion:'AFC-TUN-34 · 2026-10-31',discipline:'Infrastructuur',elementIds:Array.from({length:36},(_,index)=>`tseg-${String(index+1).padStart(3,'0')}`),elementCount:36,measuredQuantity:11842.5,verifiedQuantity:2605.35,unit:'m³',completionPct:22,measuredAt:'2026-10-31T07:45:00.000Z',measuredBy:'Lena Vermeulen',status:'Gecontroleerd',clashFree:true,notes:'Tunnelmoten gekoppeld aan landmeetkundige as-built controle en AFC-model.' }
  const progressLines = [
    { workPackageId:id('work-package','1'),workPackageCode:'WP-01',workPackageName:'Voorbereidende werken',contractValue:52000000,previousCumulative:0,currentPeriod:6240000,cumulativeProgressPct:12,cumulativeValue:6240000,measurementMethod:'Dagrapporten',comment:'Dagrapporten, foto’s en hoeveelhedenregister gecontroleerd.' },
    { workPackageId:id('work-package','2'),workPackageCode:'WP-02',workPackageName:'Nutsverleggingen en interfaces',contractValue:68000000,previousCumulative:0,currentPeriod:4760000,cumulativeProgressPct:7,cumulativeValue:4760000,measurementMethod:'Meetstaat',measuredQuantity:1840,unit:'m' },
    { workPackageId:id('work-package','3'),workPackageCode:'WP-03',workPackageName:'Bouwkuipen en grondwerken',contractValue:112000000,previousCumulative:0,currentPeriod:24640000,cumulativeProgressPct:22,cumulativeValue:24640000,measurementMethod:'BIM',measuredQuantity:2605.35,unit:'m³',bimEvidence:tunnelBimEvidence,comment:'36 IFC4.3-elementen als gecontroleerd meetbewijs.' },
    { workPackageId:id('work-package','4'),workPackageCode:'WP-04',workPackageName:'Tunnelbak en kunstwerken',contractValue:238000000,previousCumulative:0,currentPeriod:7140000,cumulativeProgressPct:3,cumulativeValue:7140000,measurementMethod:'BIM',measuredQuantity:3150,unit:'m³',bimEvidence:{...tunnelBimEvidence,elementIds:tunnelBimEvidence.elementIds.slice(0,10),elementCount:10,measuredQuantity:105000,verifiedQuantity:3150,completionPct:3,notes:'Eerste tien tunnelmoten vrijgegeven na beton- en maatcontrole.'} },
  ]
  const progressDetails = { valuationDate:'2026-10-31',dueDate:'2026-12-07',certificateReference:'CERT-OWV-2026-10-02',preparedBy:'Lena Vermeulen',revisionFormula:'Contractuele formule I-2021 · index oktober 2026',advancePaymentAmount:0,advanceRecoveryAmount:350000,otherDeductionsAmount:25000,evidenceDocumentIds:[documentIds.report,documentIds.plan],qualityChecklist:{measurementsVerified:true,evidenceComplete:true,changesApproved:true,bimModelValidated:true} }
  await client.query(
    `INSERT INTO progress_statements
      (tenant_id,id,number,project_id,period_start,period_end,lines,change_order_ids,work_amount,change_order_amount,price_revision_amount,gross_amount,retention_pct,retention_amount,net_amount,status,notes,submitted_at,approved_by,approved_at,details)
     VALUES
      ($1,$2,'VS-OWV-2026-09',$4,'2026-09-01','2026-09-30',$5,$6,6240000,425000,185000,6850000,5,342500,6507500,'Ingediend','Eerste professionele vorderingsstaat voor klantgoedkeuring.','2026-10-03T09:00:00.000Z',NULL,NULL,$7),
      ($1,$3,'VS-OWV-2026-10',$4,'2026-10-01','2026-10-31',$5,'[]',8120000,190000,225000,8535000,5,426750,8108250,'Goedgekeurd','Goedgekeurde vorderingsstaat met BIM-meetbewijs.','2026-11-03T09:00:00.000Z','Marie De Clerck','2026-11-06T14:00:00.000Z',$7)
     ON CONFLICT (tenant_id,id) DO UPDATE SET
       lines=EXCLUDED.lines,details=EXCLUDED.details,notes=EXCLUDED.notes,
       price_revision_amount=EXCLUDED.price_revision_amount,retention_pct=EXCLUDED.retention_pct`,
    [tenantId, statement1, statement2, DEMO_PROJECT_ID, JSON.stringify(progressLines), JSON.stringify([id('change', 'oosterweel-cables')]), JSON.stringify(progressDetails)],
  )
  const invoiceId = id('sales-invoice', 'oosterweel-2026-10')
  await client.query(
    `INSERT INTO sales_invoices
      (tenant_id,id,number,legal_entity_id,project_id,progress_statement_id,invoice_date,due_date,subtotal,vat_pct,vat_amount,total,status,issued_at,issued_by,created_at)
     VALUES ($1,$2,'BF-2026-0001',$3,$4,$5,'2026-11-07','2026-12-07',8108250,21,1702732.50,9810982.50,'Openstaand','2026-11-07T10:00:00.000Z','Elise Martens','2026-11-07T09:00:00.000Z')
     ON CONFLICT (tenant_id,id) DO NOTHING`,
    [tenantId, invoiceId, DEMO_LEGAL_ENTITY_ID, DEMO_PROJECT_ID, statement2],
  )
  await client.query('UPDATE progress_statements SET invoice_id=$3,status=\'Factuurconcept\' WHERE tenant_id=$1 AND id=$2', [tenantId, statement2, invoiceId])

  await client.query(
    `INSERT INTO project_costs (tenant_id,id,project_id,work_package_id,cost_date,type,category,description,supplier,amount,reference,recognition,status,created_at)
     VALUES ($1,$2,$3,$4,'2026-10-01','Verplichting','material','Stortklaar beton tunnelbak fase 1','SteelWorks Belgium NV',1485000,'PO-OWV-0020','Verplichting','Open','2026-10-01T10:00:00.000Z')
     ON CONFLICT (tenant_id,id) DO NOTHING`,
    [tenantId, commitmentCostId, DEMO_PROJECT_ID, id('work-package', '4')],
  )
  const procurementItemId = id('procurement-item', 'ready-mix')
  const supplierQuoteId = id('supplier-quote', 'ready-mix')
  await client.query(
    `INSERT INTO procurement_requests
      (tenant_id,id,number,project_id,work_package_id,invited_supplier_ids,category,requested_by,needed_by,description,items,status,quotes,selected_quote_id,purchase_order_id,approval,created_at)
     VALUES ($1,$2,'INK-OWV-0002',$3,$4,$5,'material','Amina El Idrissi','2026-11-15','Stortklaar beton tunnelbak fase 1',$6,'Besteld',$7,$8,$9,$10,'2026-09-28T09:00:00.000Z')
     ON CONFLICT (tenant_id,id) DO NOTHING`,
    [tenantId, supplierRequestId, DEMO_PROJECT_ID, id('work-package', '4'), JSON.stringify([supplierId]), JSON.stringify([{ id: procurementItemId, description: 'Beton C35/45 EE4', quantity: 15000, unit: 'm³', targetUnitPrice: 102 }]), JSON.stringify([{ id: supplierQuoteId, supplierId, amount: 1485000, leadTimeDays: 14, validityDate: '2026-10-31', notes: 'Afroep per stortfase.' }]), supplierQuoteId, purchaseOrderId, JSON.stringify({ status: 'Goedgekeurd', requiredRole: 'Projectdirecteur', amount: 1485000, approvedBy: 'David Peeters', approvedAt: '2026-10-01T08:30:00.000Z' })],
  )
  await client.query(
    `INSERT INTO purchase_orders
      (tenant_id,id,number,procurement_request_id,project_id,supplier_id,order_date,expected_delivery_date,amount,status,commitment_cost_id,lines,receipts,created_at)
     VALUES ($1,$2,'PO-OWV-0020',$3,$4,$5,'2026-10-01','2026-11-15',1485000,'Besteld',$6,$7,'[]','2026-10-01T10:00:00.000Z')
     ON CONFLICT (tenant_id,id) DO NOTHING`,
    [tenantId, purchaseOrderId, supplierRequestId, DEMO_PROJECT_ID, supplierId, commitmentCostId, JSON.stringify([{ procurementItemId, description: 'Beton C35/45 EE4', unit: 'm³', orderedQuantity: 15000, receivedQuantity: 0, invoicedQuantity: 0, unitPrice: 99 }])],
  )
}

async function seedBlueprintAndOperations(client: PoolClient, tenantId: string) {
  const employeeSeeds: Array<[string, string, string, string, string, string, string[]]> = [
    [employeeIds.tenderOwner, 'BF-0101', 'Tessa', 'Vermeulen', 'tessa.vermeulen@demo.aifestival.be', 'Tender manager', ['Aanbestedingen', 'e-Procurement', 'Contractanalyse']],
    [employeeIds.tenderReviewer, 'BF-0102', 'David', 'Peeters', 'david.peeters@demo.aifestival.be', 'Projectdirecteur', ['Klasse 8', 'Directie', 'Risicobeheer']],
    [employeeIds.calculator, 'BF-0103', 'Noor', 'Claes', 'noor.claes@demo.aifestival.be', 'Calculator', ['Calculatie', 'Meetstaat', 'Prijsanalyse']],
    [employeeIds.projectManager, 'BF-0104', 'Lena', 'Vermeulen', 'lena.vermeulen@demo.aifestival.be', 'Projectmanager', ['Projectbeheersing', 'Planning', 'Contract']],
    [employeeIds.siteManager, 'BF-0105', 'Wouter', 'Peeters', 'wouter.peeters@demo.aifestival.be', 'Werfleider', ['Werfopvolging', 'VCA VOL', 'Dagrapporten']],
    [employeeIds.purchaser, 'BF-0106', 'Amina', 'El Idrissi', 'amina.elidrissi@demo.aifestival.be', 'Aankoper', ['Inkoop', 'Raamcontracten']],
    [employeeIds.finance, 'BF-0107', 'Elise', 'Martens', 'elise.martens@demo.aifestival.be', 'Financiële administratie', ['Vorderingsstaten', 'Peppol']],
    [employeeIds.foreman, 'BF-0108', 'Milan', 'Jacobs', 'milan.jacobs@demo.aifestival.be', 'Ploegbaas', ['Grondwerken', 'VCA VOL']],
    [employeeIds.worker, 'BF-0109', 'Yassin', 'El Amrani', 'yassin.elamrani@demo.aifestival.be', 'Arbeider', ['Bekisting', 'VCA Basis']],
    [employeeIds.prevention, 'BF-0110', 'Maaike', 'De Smet', 'maaike.desmet@demo.aifestival.be', 'Preventieadviseur', ['Preventie niveau 1', 'LMRA']],
  ]
  const employees = employeeSeeds.map(([employeeId, employeeNumber, firstName, lastName, email, role, skills]) => ({ id: employeeId, employeeNumber, firstName, lastName, email, role, legalEntityId: DEMO_LEGAL_ENTITY_ID, branchId: DEMO_BRANCH_ID, employmentPct: 100, weeklyHours: 40, annualLeaveHours: 160, hireDate: '2022-01-03', skills, active: true, createdAt: '2026-01-01T09:00:00.000Z' }))

  const subcontractors = [{
    id: subcontractorId,
    name: 'Delta Infra NV',
    vatNumber: 'BE0788123456',
    contactName: 'Omar Benali',
    email: 'omar.benali@demo.aifestival.be',
    status: 'Goedgekeurd',
    insuranceExpiresOn: '2028-12-31',
    vcaExpiresOn: '2028-06-30',
    hourlyRate: 72,
    projectIds: [DEMO_PROJECT_ID],
    documentsComplete: true,
    employees: [{ id: id('sub-employee', 'hamza'), name: 'Hamza Aït Said', role: 'Kraanman', certificate: 'Machinist mobiele kraan', certificateExpiresOn: '2028-04-30' }, { id: id('sub-employee', 'ines'), name: 'Ines Jacobs', role: 'Ploegverantwoordelijke', certificate: 'VCA VOL', certificateExpiresOn: '2028-09-30' }],
    agreements: [{ id: id('sub-agreement', 'delta-owv'), number: 'OA-OWV-0007', projectId: DEMO_PROJECT_ID, title: 'Nutsdetectie, proefsleuven en tijdelijke omleggingen', contractValue: 6150000, retentionPct: 5, penaltyPerDay: 2500, startDate: '2026-09-01', endDate: '2027-06-30', status: 'Actief', documentIds: [documentIds.safety] }],
    progressClaims: [{ id: id('sub-progress', 'delta-2026-09'), number: 'OVS-001', projectId: DEMO_PROJECT_ID, periodEnd: '2026-09-30', grossAmount: 385000, retentionAmount: 19250, penaltyAmount: 0, netAmount: 365750, status: 'Ingediend', notes: 'Proefsleuven zones A en B uitgevoerd.', submittedAt: '2026-10-02T09:00:00.000Z' }],
    evaluations: [{ id: id('sub-evaluation', 'delta-1'), projectId: DEMO_PROJECT_ID, date: '2026-09-30', quality: 4, safety: 5, planning: 4, administration: 4, notes: 'Veilige en kwalitatieve opstart.', evaluatedBy: 'Wouter Peeters' }],
    documentIds: [documentIds.safety],
    portalInvitedAt: '2026-08-25T09:00:00.000Z',
    portalLastAccessAt: '2026-09-30T16:00:00.000Z',
    createdAt: '2026-08-01T09:00:00.000Z',
  }]
  const workTickets = [
    { id: id('work-ticket', 'delta-regie'), number: 'WB-OWV-0001', projectId: DEMO_PROJECT_ID, subcontractorId, dailyReportId: id('daily-report', 'oosterweel-20260915'), type: 'Regiewerk', date: '2026-09-15', description: 'Bijkomende lokalisatie mantelbuizen zone B', lines: [{ id: id('ticket-line', 'delta-labor'), category: 'Arbeid', description: 'Ploeg nutsdetectie', quantity: 16, unit: 'u', unitPrice: 72 }], total: 1152, status: 'Ter ondertekening', createdBy: 'Wouter Peeters', createdAt: '2026-09-15T17:30:00.000Z', submittedAt: '2026-09-15T17:40:00.000Z' },
    { id: id('work-ticket', 'client-extra'), number: 'WB-OWV-0002', projectId: DEMO_PROJECT_ID, dailyReportId: id('daily-report', 'oosterweel-20260916'), type: 'Meerwerk', date: '2026-09-16', description: 'Extra drainageproef opdrachtgever', lines: [{ id: id('ticket-line', 'client-equipment'), category: 'Materieel', description: 'Mobiele pompinstallatie', quantity: 8, unit: 'u', unitPrice: 145 }], total: 1160, status: 'Ter ondertekening', createdBy: 'Wouter Peeters', createdAt: '2026-09-16T17:20:00.000Z', submittedAt: '2026-09-16T17:30:00.000Z' },
  ]
  const blueprint = await client.query<Record<string, unknown>>('SELECT * FROM blueprint_state WHERE tenant_id=$1', [tenantId])
  const current = blueprint.rows[0]
  const merged = {
    subcontractors: mergeById(jsonArray(current?.subcontractors as never), subcontractors),
    qhseEvents: mergeById(jsonArray(current?.qhse_events as never), [{ id: id('qhse-event', 'near-miss'), projectId: DEMO_PROJECT_ID, eventDate: '2026-09-17', type: 'Bijna-ongeval', title: 'Achteruitrijdende dumper nabij looproute', description: 'Geen letsel; spotter stond buiten zichtlijn.', severity: 'Hoog', reporter: 'Wouter Peeters', responsible: 'Maaike De Smet', dueDate: '2026-09-19', correctiveAction: 'Looproute verlegd en verplichte spotterbriefing ingevoerd.', participants: ['Wouter Peeters', 'Maaike De Smet', 'Milan Jacobs'], status: 'In behandeling', createdAt: '2026-09-17T11:00:00.000Z' }]),
    jointVentures: mergeById(jsonArray(current?.joint_ventures as never), [{ id: id('joint-venture', 'bouwflow-owv'), name: 'THV BouwFlow Rechteroever', type: 'THV', projectId: DEMO_PROJECT_ID, country: 'België', currency: 'EUR', vatRule: 'Medecontractant', members: [{ legalEntityId: DEMO_LEGAL_ENTITY_ID, sharePct: 100, lead: true }], status: 'Actief', createdAt: '2026-08-01T09:00:00.000Z' }]),
    integrationConnections: mergeById(jsonArray(current?.integration_connections as never), []),
    integrationJobs: mergeById(jsonArray(current?.integration_jobs as never), []),
    aiAnalyses: mergeById(jsonArray(current?.ai_analyses as never), [{ id: id('ai-analysis', 'contract-risk'), projectId: DEMO_PROJECT_ID, type: 'Contractrisico', question: 'Welke termijn- en raakvlakrisico’s vragen onmiddellijke opvolging?', answer: 'Prioriteit ligt bij nutsraakvlakken, verkeersfasering, staalindex en tijdige vrijgave van werkzones.', sources: [{ documentId: documentIds.tender, title: 'Bestek en administratieve bepalingen', excerpt: 'Uitvoeringstermijnen, raakvlakverplichtingen, prijsherziening en vrijgave van werkzones.' }], status: 'Goedgekeurd', createdBy: 'Lena Vermeulen', createdAt: '2026-09-20T09:00:00.000Z', approvedBy: 'David Peeters', approvedAt: '2026-09-20T11:00:00.000Z' }]),
    projectContracts: mergeById(jsonArray(current?.project_contracts as never), [{ id: id('project-contract', 'oosterweel'), projectId: DEMO_PROJECT_ID, title: 'Aannemingsovereenkomst Oosterweel Rechteroever', signedOn: '2026-08-15', executionStart: '2026-09-01', executionEnd: '2033-12-31', paymentTerms: '30 dagen na goedgekeurde vorderingsstaat', retentionPct: 5, penaltyPerDay: 125000, priceRevision: 'Contractuele indexeringsformule infrastructuurwerken', contractNumber: 'CTR-OWV-RO-2026', contractType: 'Openbare opdracht', clientOrganizationId: DEMO_ORGANIZATION_ID, contractValue: 875000000, currency: 'EUR', documentIds: [documentIds.contract], securities: [{ id: id('contract-security', 'guarantee'), type: 'Bankgarantie', reference: 'BG-OWV-2026-001', issuer: 'KBC Bank', amount: 43750000, expiresOn: '2034-06-30', status: 'Actief' }], correspondence: [{ id: id('contract-mail', 'start-order'), date: '2026-08-20', type: 'Brief', subject: 'Startbevel 1 september 2026', sender: 'Lantis', recipient: 'Bosis BE', documentId: documentIds.contract }], claims: [], versions: [{ id: id('contract-version', '1'), version: 1, changeSummary: 'Getekende contractbasis', createdBy: 'David Peeters', createdAt: '2026-08-15T14:00:00.000Z' }], approvalStatus: 'Goedgekeurd', submittedBy: 'Lena Vermeulen', submittedAt: '2026-08-14T09:00:00.000Z', approvedBy: 'David Peeters', approvedAt: '2026-08-15T09:00:00.000Z', status: 'Actief', obligations: [{ id: id('obligation', 'permits'), title: 'Vergunningen en werkzonevrijgave bevestigen', dueDate: '2026-09-01', owner: 'Lena Vermeulen', sourceDocumentId: documentIds.contract, status: 'Voltooid', completedAt: '2026-08-29T10:00:00.000Z' }, { id: id('obligation', 'interface'), title: 'Maandelijks raakvlakkenregister actualiseren', dueDate: '2026-10-31', owner: 'Lena Vermeulen', status: 'Open' }], risks: [{ id: id('contract-risk', 'utilities'), description: 'Onvolledige informatie over bestaande nutsleidingen', impact: 'Hoog', mitigation: 'Proefsleuven en wekelijkse raakvlaksessie', owner: 'Lena Vermeulen', status: 'Open' }], createdAt: '2026-08-15T09:00:00.000Z' }]),
    projectCloseouts: mergeById(jsonArray(current?.project_closeouts as never), [{ id: id('project-closeout', 'oosterweel'), projectId: DEMO_PROJECT_ID, status: 'Voorbereiding', bondReleaseStatus: 'Niet aangevraagd', asBuiltComplete: false, maintenanceFileComplete: false, acceptanceDocumentIds: [documentIds.report], asBuiltDocumentIds: [documentIds.plan], maintenanceDocumentIds: [], guaranteeDocumentIds: [documentIds.contract], bondAmount: 43750000, bondReleasedAmount: 0, items: [{ id: id('closeout-item', 'demo'), description: 'Voorbeeld opleverpunt: markering technische ruimte', responsible: 'Wouter Peeters', dueDate: '2033-11-30', status: 'Open', location: 'Tunnelkoker zone A' }], serviceRequests: [{ id: id('service-request', 'demo'), title: 'Voorbeeld servicemelding', description: 'Testmelding voor de nazorgflow.', reportedAt: '2034-01-15', status: 'Nieuw' }], createdAt: '2026-09-01T09:00:00.000Z' }]),
    employees: mergeById(jsonArray(current?.employees as never), employees),
    employeeAbsences: mergeById(jsonArray(current?.employee_absences as never), [{ id: id('absence', 'milan-training'), employeeId: employeeIds.foreman, type: 'Opleiding', startDate: '2026-10-12', endDate: '2026-10-13', hours: 16, reason: 'Opleiding veilig hijsen', status: 'Aangevraagd', requestedBy: 'Milan Jacobs', requestedAt: '2026-09-25T09:00:00.000Z' }]),
    employeeCrews: mergeById(jsonArray(current?.employee_crews as never), [{ id: id('crew', 'rechteroever'), name: 'Ploeg Rechteroever', legalEntityId: DEMO_LEGAL_ENTITY_ID, branchId: DEMO_BRANCH_ID, leaderEmployeeId: employeeIds.foreman, memberEmployeeIds: [employeeIds.foreman, employeeIds.worker], active: true, createdAt: '2026-08-20T09:00:00.000Z' }]),
    workTickets: mergeById(jsonArray(current?.work_tickets as never), workTickets),
    timeEntries: mergeById(jsonArray(current?.time_entries as never), [{ id: id('time-entry', 'yassin-20260916'), employeeId: employeeIds.worker, projectId: DEMO_PROJECT_ID, workPackageId: id('work-package', '3'), date: '2026-09-16', startTime: '06:30', endTime: '16:00', breakMinutes: 30, regularHours: 8, overtimeHours: 1, travelHours: 0.5, nightHours: 0, weekendHours: 0, source: 'Mobiel', status: 'Ingediend', createdAt: '2026-09-16T16:05:00.000Z' }]),
    projectClaims: mergeById(jsonArray(current?.project_claims as never), [{ id: id('project-claim', 'utilities'), number: 'CL-OWV-0001', title: 'Termijnverlenging nutsleidingen', projectId: DEMO_PROJECT_ID, changeOrderId: id('change', 'oosterweel-cables'), type: 'Termijnverlenging', cause: 'Niet-gekarteerde nutsleidingen', description: 'Verlenging wegens bijkomende detectie en tijdelijke omlegging.', amount: 425000, extensionDays: 8, responsibleParty: 'Opdrachtgever', documentIds: [documentIds.report], status: 'Ingediend', createdBy: 'Lena Vermeulen', createdAt: '2026-09-18T09:00:00.000Z', submittedAt: '2026-09-20T09:00:00.000Z' }]),
    workflowDefinitions: jsonArray(current?.workflow_definitions as never).length ? jsonArray(current?.workflow_definitions as never) : defaultWorkflowDefinitions,
  }
  const demoContract=merged.projectContracts.find(item=>item.id===id('project-contract','oosterweel'))
  if(demoContract&&!demoContract.priceRevisionClause){
    demoContract.priceRevision='p = P × [0,40 × (s/S) + 0,40 × (i-2021/I-2021) + 0,20]'
    demoContract.priceRevisionClause={enabled:true,formulaType:'I-2021 en S',laborWeightPct:40,materialWeightPct:40,fixedWeightPct:20,laborCategory:'A',employerSize:'Meer dan 20',baseDate:'2026-08-15',baseMaterialPeriod:'2026-06',valuationDateRule:'Waarderingsdatum',availabilityPolicy:'Voorlopig met correctie',applicationBase:'Werken en meerwerken',sourceClauseReference:'Bijzonder bestek Oosterweel Rechteroever · art. 14.2'}
  }
  await client.query(
    `INSERT INTO blueprint_state
      (tenant_id,subcontractors,qhse_events,joint_ventures,integration_connections,integration_jobs,ai_analyses,project_contracts,project_closeouts,employees,employee_absences,employee_crews,work_tickets,time_entries,project_claims,workflow_definitions,updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,now())
     ON CONFLICT (tenant_id) DO UPDATE SET subcontractors=EXCLUDED.subcontractors,qhse_events=EXCLUDED.qhse_events,joint_ventures=EXCLUDED.joint_ventures,integration_connections=EXCLUDED.integration_connections,integration_jobs=EXCLUDED.integration_jobs,ai_analyses=EXCLUDED.ai_analyses,project_contracts=EXCLUDED.project_contracts,project_closeouts=EXCLUDED.project_closeouts,employees=EXCLUDED.employees,employee_absences=EXCLUDED.employee_absences,employee_crews=EXCLUDED.employee_crews,work_tickets=EXCLUDED.work_tickets,time_entries=EXCLUDED.time_entries,project_claims=EXCLUDED.project_claims,workflow_definitions=EXCLUDED.workflow_definitions,updated_at=now()`,
    [tenantId, JSON.stringify(merged.subcontractors), JSON.stringify(merged.qhseEvents), JSON.stringify(merged.jointVentures), JSON.stringify(merged.integrationConnections), JSON.stringify(merged.integrationJobs), JSON.stringify(merged.aiAnalyses), JSON.stringify(merged.projectContracts), JSON.stringify(merged.projectCloseouts), JSON.stringify(merged.employees), JSON.stringify(merged.employeeAbsences), JSON.stringify(merged.employeeCrews), JSON.stringify(merged.workTickets), JSON.stringify(merged.timeEntries), JSON.stringify(merged.projectClaims), JSON.stringify(merged.workflowDefinitions)],
  )

  const checkinatwork = await client.query<Record<string, unknown>>('SELECT * FROM checkinatwork_state WHERE tenant_id=$1', [tenantId])
  const checkinatworkCurrent = checkinatwork.rows[0]
  const checkinatworkSiteId = id('checkinatwork-site', 'oosterweel-rechteroever')
  const checkinatworkParticipants = [
    { id:id('checkinatwork-participant','wouter'), projectId:DEMO_PROJECT_ID, employeeId:employeeIds.siteManager, displayName:'Wouter Peeters', employerName:'Bosis BE', employerCompanyNumber:'0502635588', participantType:'Werknemer', identifierType:'INSZ', identifierLast4:'1842', secureIdentityReference:'sim:wouter-peeters', identityVerified:true, active:true, createdAt:'2026-08-25T09:00:00.000Z' },
    { id:id('checkinatwork-participant','yassin'), projectId:DEMO_PROJECT_ID, employeeId:employeeIds.worker, displayName:'Yassin Benali', employerName:'Bosis BE', employerCompanyNumber:'0502635588', participantType:'Werknemer', identifierType:'INSZ', identifierLast4:'6207', secureIdentityReference:'sim:yassin-benali', identityVerified:true, active:true, createdAt:'2026-08-25T09:00:00.000Z' },
    { id:id('checkinatwork-participant','omar'), projectId:DEMO_PROJECT_ID, subcontractorId, displayName:'Omar El Amrani', employerName:'Delta Infra BV', employerCompanyNumber:'0745123987', participantType:'Onderaannemer', identifierType:'Limosa', identifierLast4:'8060', secureIdentityReference:'sim:omar-limosa', identityVerified:true, limosaExpiresOn:'2027-03-31', active:true, createdAt:'2026-08-25T09:00:00.000Z' },
  ]
  const checkinatworkRegistrations = [
    { id:id('checkinatwork-registration','wouter-20260916'), siteId:checkinatworkSiteId, projectId:DEMO_PROJECT_ID, participantId:id('checkinatwork-participant','wouter'), registrationDate:'2026-09-16', source:'Badge', status:'Officieel bevestigd', clientReference:`bouwflow:${checkinatworkSiteId}:wouter:2026-09-16`, providerRegistrationId:'SIM-OWV-0001', receiptNumber:'CAW-SIM-OWV-20260916-001', submittedAt:'2026-09-16T05:52:00.000Z', confirmedAt:'2026-09-16T05:52:01.000Z', simulation:true, createdBy:'Wouter Peeters', createdAt:'2026-09-16T05:52:00.000Z' },
    { id:id('checkinatwork-registration','yassin-20260916'), siteId:checkinatworkSiteId, projectId:DEMO_PROJECT_ID, participantId:id('checkinatwork-participant','yassin'), registrationDate:'2026-09-16', source:'QR', status:'Officieel bevestigd', clientReference:`bouwflow:${checkinatworkSiteId}:yassin:2026-09-16`, providerRegistrationId:'SIM-OWV-0002', receiptNumber:'CAW-SIM-OWV-20260916-002', submittedAt:'2026-09-16T05:58:00.000Z', confirmedAt:'2026-09-16T05:58:01.000Z', simulation:true, createdBy:'Yassin Benali', createdAt:'2026-09-16T05:58:00.000Z' },
  ]
  const checkinatworkSites = mergeById(jsonArray(checkinatworkCurrent?.sites as never), [{ id:checkinatworkSiteId, projectId:DEMO_PROJECT_ID, declarationNumber:'30BIS-OWV-RO-2026', workPlaceId:'1Y1000OWVDEMO', declarantCompanyNumber:'0502635588', applicability:'Verplicht', applicabilityReason:'Klasse 8-project boven de wettelijke drempel.', thresholdAmount:500000, startDate:'2026-09-01', plannedEndDate:'2033-12-31', address:'Oosterweelverbinding Rechteroever, Antwerpen', latitude:51.2411, longitude:4.3844, geofenceRadiusMeters:750, environment:'Simulatie', active:true, createdAt:'2026-08-20T09:00:00.000Z', updatedAt:'2026-09-16T06:00:00.000Z' }])
  const mergedCheckinatworkParticipants = mergeById(jsonArray(checkinatworkCurrent?.participants as never), checkinatworkParticipants)
  const mergedCheckinatworkRegistrations = mergeById(jsonArray(checkinatworkCurrent?.registrations as never), checkinatworkRegistrations)
  const checkinatworkAuditEvents = mergeById(jsonArray(checkinatworkCurrent?.audit_events as never), checkinatworkRegistrations.map((registration,index)=>({ id:id('checkinatwork-audit',`confirmed-${index}`), projectId:DEMO_PROJECT_ID, siteId:checkinatworkSiteId, participantId:registration.participantId, registrationId:registration.id, action:'REGISTRATION_CONFIRMED', detail:`Ontvangstnummer ${registration.receiptNumber}`, actor:'BouwFlow RSZ-simulator', at:registration.confirmedAt })))
  await client.query(`INSERT INTO checkinatwork_state (tenant_id,sites,participants,registrations,audit_events,updated_at) VALUES ($1,$2,$3,$4,$5,now()) ON CONFLICT (tenant_id) DO UPDATE SET sites=EXCLUDED.sites,participants=EXCLUDED.participants,registrations=EXCLUDED.registrations,audit_events=EXCLUDED.audit_events,updated_at=now()`, [tenantId,JSON.stringify(checkinatworkSites),JSON.stringify(mergedCheckinatworkParticipants),JSON.stringify(mergedCheckinatworkRegistrations),JSON.stringify(checkinatworkAuditEvents)])

  const operations = await client.query<Record<string, unknown>>('SELECT * FROM operations_state WHERE tenant_id=$1', [tenantId])
  const operationRow = operations.rows[0]
  const warehouseId = id('warehouse', 'heusden-zolder')
  const inventoryItemId = id('inventory', 'drainage-pipe')
  const assets = mergeById(jsonArray(operationRow?.assets as never), [{ id: id('asset', 'excavator-35t'), code: 'MCH-OWV-035', name: 'Rupskraan 35 ton', category: 'Machine', status: 'Ingezet', location: 'Oosterweel zone A', hourlyRate: 118, projectId: DEMO_PROJECT_ID, inspectionExpiresOn: '2027-06-30', maintenanceDueOn: '2026-11-15', insurer: 'AG Insurance', insurancePolicyNumber: 'AG-MAT-2026-8891', insuranceExpiresOn: '2027-12-31', mileage: 0, operatingHours: 2840, maintenanceOrders: [{ id: id('maintenance', 'excavator'), title: '500-urenonderhoud', scheduledOn: '2026-11-15', supplier: 'Machine Service NV', cost: 2850, status: 'Gepland', notes: 'Filters en hydrauliekcontrole.' }], damageReports: [], fuelEntries: [{ id: id('fuel', 'excavator-1'), date: '2026-09-16', quantity: 285, unitPrice: 1.52, operatingHours: 2831, provider: 'Werftank' }], reservations: [{ id: id('reservation', 'excavator-owv'), projectId: DEMO_PROJECT_ID, startDate: '2026-09-01', endDate: '2027-03-31', requestedBy: 'Wouter Peeters', status: 'Bevestigd' }] }])
  const warehouses = mergeById(jsonArray(operationRow?.warehouses as never), [{ id: warehouseId, name: 'Centraal magazijn Heusden-Zolder', location: 'Koedrieshof 8, 3550 Heusden-Zolder' }])
  const inventoryItems = mergeById(jsonArray(operationRow?.inventory_items as never), [{ id: inventoryItemId, sku: 'MAT-DRAIN-250', name: 'Drainagebuis PEHD Ø250', unit: 'm', minimumStock: 250, maximumStock: 2500, defaultPurchasePrice: 28.5, stocks: [{ warehouseId, quantity: 1840, reserved: 640 }], lotTracking: true, serialTracking: false, lots: [{ lotNumber: 'LOT-PEHD-2026-09', warehouseId, quantity: 1840 }], counts: [] }])
  const stockMovements = mergeById(jsonArray(operationRow?.stock_movements as never), [{ id: id('stock-movement', 'drainage-reservation'), inventoryItemId, warehouseId, projectId: DEMO_PROJECT_ID, type: 'Reservatie', quantity: 640, reference: 'PRJ-OWV-RO-DEMO', performedBy: 'Amina El Idrissi', lotNumber: 'LOT-PEHD-2026-09', createdAt: '2026-09-10T09:00:00.000Z' }])
  await client.query(
    `INSERT INTO operations_state (tenant_id,assets,warehouses,inventory_items,stock_movements,updated_at)
     VALUES ($1,$2,$3,$4,$5,now())
     ON CONFLICT (tenant_id) DO UPDATE SET assets=EXCLUDED.assets,warehouses=EXCLUDED.warehouses,inventory_items=EXCLUDED.inventory_items,stock_movements=EXCLUDED.stock_movements,updated_at=now()`,
    [tenantId, JSON.stringify(assets), JSON.stringify(warehouses), JSON.stringify(inventoryItems), JSON.stringify(stockMovements)],
  )
}

async function seedFamilyHomeBimDemo(client: PoolClient, tenantId: string) {
  const organizationId = id('family-home', 'organization')
  const opportunityId = id('family-home', 'opportunity')
  const calculationId = id('family-home', 'calculation')
  const projectId = id('family-home', 'project')
  const statementId = id('family-home', 'progress-2027-01')
  const existingProject = await client.query('SELECT id FROM projects WHERE tenant_id=$1 AND id=$2',[tenantId,projectId])
  const calculation = buildFamilyHomeBimCalculation()
  const project = buildFamilyHomeBimProject()
  const statement = buildFamilyHomeBimProgressStatement()
  const workPackageIds = new Map(project.workPackages.map(item=>[item.code,id('family-home-work-package',item.code)]))
  const chapterIds = new Map(calculation.chapters.map(item=>[item.code,id('family-home-chapter',item.code)]))
  const activityIds = new Map(project.planning.activities.map(item=>[item.id,id('family-home-activity',item.id)]))
  const planning = {
    ...project.planning,
    activities:project.planning.activities.map(activity=>({
      ...activity,
      id:activityIds.get(activity.id),
      workPackageId:project.workPackages.find(item=>item.id===activity.workPackageId)?.code ? workPackageIds.get(project.workPackages.find(item=>item.id===activity.workPackageId)!.code) : undefined,
      predecessorIds:activity.predecessorIds.map(value=>activityIds.get(value)!).filter(Boolean),
      dependencies:activity.dependencies?.map(dependency=>({...dependency,predecessorId:activityIds.get(dependency.predecessorId)!})).filter(dependency=>Boolean(dependency.predecessorId)),
    })),
  }
  const workPackages = project.workPackages.map(item=>({...item,id:workPackageIds.get(item.code)!}))

  await client.query(
    `INSERT INTO organizations
      (tenant_id,id,name,type,contact_name,email,vat_number,address_line,postal_code,city,country_code,peppol_endpoint_id,peppol_scheme_id,roles,contacts)
     VALUES ($1,$2,'Familie Vermeiren','Privaat','Tom en Sarah Vermeiren','familie.vermeiren@demo.aifestival.be','','Bosveldlaan 18','3550','Heusden-Zolder','BE','','0208','["Klant","Opdrachtgever"]',$3)
     ON CONFLICT (tenant_id,id) DO NOTHING`,
    [tenantId,organizationId,JSON.stringify([{id:id('family-home','contact'),name:'Tom en Sarah Vermeiren',role:'Bouwheer',email:'familie.vermeiren@demo.aifestival.be',phone:'+32 470 12 34 56',primary:true}])],
  )
  await client.query(
    `INSERT INTO opportunities
      (tenant_id,id,project_number,title,organization_id,legal_entity_id,branch_id,location,deadline,estimated_value,probability,stage,recognition,tender)
     VALUES ($1,$2,'OPP-WONING-BIM-001','Gezinswoning Bosveld · BIM 3D/4D/5D',$3,$4,$5,'Heusden-Zolder','2026-08-21',535000,100,'Gewonnen','Private woningbouw',$6)
     ON CONFLICT (tenant_id,id) DO NOTHING`,
    [tenantId,opportunityId,organizationId,DEMO_LEGAL_ENTITY_ID,DEMO_BRANCH_ID,JSON.stringify({status:'Ingediend',deadline:'2026-08-21',recognition:'Private woningbouw',notes:'Volledig BIM-demoproject met objectgebaseerde 3D-calculatie, 4D-planning en 5D-kostenopvolging.',documents:[],questions:[]})],
  )
  await client.query(
    `INSERT INTO calculations
      (tenant_id,id,number,opportunity_id,status,overhead_pct,risk_pct,margin_pct,site_overhead_pct,escalation_pct,discount_pct,rounding_step,updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     ON CONFLICT (tenant_id,id) DO NOTHING`,
    [tenantId,calculationId,calculation.number,opportunityId,calculation.status,calculation.overheadPct,calculation.riskPct,calculation.marginPct,calculation.siteOverheadPct,calculation.escalationPct,calculation.discountPct,calculation.roundingStep,calculation.updatedAt],
  )
  for(const chapter of calculation.chapters) await client.query(
    `INSERT INTO boq_chapters (tenant_id,id,calculation_id,code,name,sort_order)
     VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (tenant_id,id) DO NOTHING`,
    [tenantId,chapterIds.get(chapter.code),calculationId,chapter.code,chapter.name,chapter.sortOrder],
  )
  for(const item of calculation.items) await client.query(
    `INSERT INTO boq_items
      (tenant_id,id,calculation_id,chapter_id,code,description,quantity,unit,labor,material,equipment,subcontracting,cost_applications,advanced,sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'{}',$13,$14)
     ON CONFLICT (tenant_id,id) DO NOTHING`,
    [tenantId,id('family-home-boq',item.id),calculationId,item.chapterId?chapterIds.get(calculation.chapters.find(chapter=>chapter.id===item.chapterId)?.code??''):null,item.code,item.description,item.quantity,item.unit,item.labor,item.material,item.equipment,item.subcontracting,JSON.stringify({postType:item.postType,quantityType:item.quantityType,wastePct:item.wastePct??0,itemRiskPct:item.itemRiskPct??0,markupPct:item.markupPct??0,notes:item.notes??'',variables:[],formulas:{},priceAdjustments:[]}),item.sortOrder??0],
  )
  const inserted = await client.query(
    `INSERT INTO projects
      (tenant_id,id,number,name,organization_id,legal_entity_id,branch_id,source_calculation_id,contract_value,cost_budget,margin_pct,progress,status,handover,work_packages,planning)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     ON CONFLICT (tenant_id,id) DO UPDATE SET planning=EXCLUDED.planning,work_packages=EXCLUDED.work_packages,progress=EXCLUDED.progress
     RETURNING id`,
    [tenantId,projectId,project.number,project.name,organizationId,DEMO_LEGAL_ENTITY_ID,DEMO_BRANCH_ID,calculationId,project.contractValue,project.costBudget,project.marginPct,project.progress,project.status,JSON.stringify(project.handover),JSON.stringify(workPackages),JSON.stringify(planning)],
  )
  const progressLines = statement.lines.map(line=>({
    ...line,
    workPackageId:workPackageIds.get(line.workPackageCode)!,
    ...(line.bimEvidence?{bimEvidence:{...line.bimEvidence,modelId:FAMILY_HOME_MODEL_ID}}:{}),
  }))
  const details = { valuationDate:statement.valuationDate,dueDate:statement.dueDate,certificateReference:statement.certificateReference,preparedBy:statement.preparedBy,revisionFormula:statement.revisionFormula,advancePaymentAmount:statement.advancePaymentAmount,advanceRecoveryAmount:statement.advanceRecoveryAmount,otherDeductionsAmount:statement.otherDeductionsAmount,evidenceDocumentIds:statement.evidenceDocumentIds,qualityChecklist:statement.qualityChecklist }
  await client.query(
    `INSERT INTO progress_statements
      (tenant_id,id,number,project_id,period_start,period_end,lines,change_order_ids,work_amount,change_order_amount,price_revision_amount,gross_amount,retention_pct,retention_amount,net_amount,status,notes,created_at,submitted_at,approved_by,approved_at,details)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'[]',$8,0,0,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
     ON CONFLICT (tenant_id,id) DO UPDATE SET lines=EXCLUDED.lines,details=EXCLUDED.details,work_amount=EXCLUDED.work_amount,gross_amount=EXCLUDED.gross_amount,retention_amount=EXCLUDED.retention_amount,net_amount=EXCLUDED.net_amount`,
    [tenantId,statementId,statement.number,projectId,statement.periodStart,statement.periodEnd,JSON.stringify(progressLines),statement.workAmount,statement.retentionPct,statement.retentionAmount,statement.netAmount,statement.status,statement.notes,statement.createdAt,statement.submittedAt,statement.approvedBy,statement.approvedAt,JSON.stringify(details)],
  )
  await client.query(
    `INSERT INTO user_project_access (tenant_id,user_id,project_id)
     SELECT tenant_id,id,$2 FROM users WHERE tenant_id=$1 AND all_projects=false
     ON CONFLICT DO NOTHING`,
    [tenantId,projectId],
  )
  return !existingProject.rowCount && Boolean(inserted.rowCount)
}

async function seedBosmansTaverniersBimProject(client: PoolClient, tenantId: string) {
  const organizationId=id('bosmans-taverniers','organization')
  const opportunityId=id('bosmans-taverniers','opportunity')
  const calculationId=id('bosmans-taverniers','calculation')
  const projectId=id('bosmans-taverniers','project')
  const statementId=id('bosmans-taverniers','progress-concept')
  const existingProject=await client.query('SELECT id FROM projects WHERE tenant_id=$1 AND id=$2',[tenantId,projectId])
  const calculation=buildBosmansTaverniersCalculation()
  const project=buildBosmansTaverniersProject()
  const statement=buildBosmansTaverniersProgressStatement()
  const workPackageIds=new Map(project.workPackages.map(item=>[item.code,id('bosmans-taverniers-work-package',item.code)]))
  const chapterIds=new Map(calculation.chapters.map(item=>[item.code,id('bosmans-taverniers-chapter',item.code)]))
  const activityIds=new Map(project.planning.activities.map(item=>[item.id,id('bosmans-taverniers-activity',item.id)]))
  const planning={...project.planning,activities:project.planning.activities.map(activity=>({...activity,id:activityIds.get(activity.id),workPackageId:project.workPackages.find(item=>item.id===activity.workPackageId)?.code?workPackageIds.get(project.workPackages.find(item=>item.id===activity.workPackageId)!.code):undefined,predecessorIds:activity.predecessorIds.map(value=>activityIds.get(value)!).filter(Boolean),dependencies:activity.dependencies?.map(dependency=>({...dependency,predecessorId:activityIds.get(dependency.predecessorId)!})).filter(dependency=>Boolean(dependency.predecessorId))}))}
  const workPackages=project.workPackages.map(item=>({...item,id:workPackageIds.get(item.code)!}))
  await client.query(
    `INSERT INTO organizations (tenant_id,id,name,type,contact_name,email,vat_number,address_line,postal_code,city,country_code,peppol_endpoint_id,peppol_scheme_id,roles,contacts)
     VALUES ($1,$2,'Familie Bosmans-Taverniers','Privaat','Jurgen Bosmans','jurgen.bosmans@bosis.be','','','3550','Heusden-Zolder','BE','','0208','["Klant","Opdrachtgever"]',$3)
     ON CONFLICT (tenant_id,id) DO UPDATE SET name=EXCLUDED.name,contact_name=EXCLUDED.contact_name,email=EXCLUDED.email,contacts=EXCLUDED.contacts`,
    [tenantId,organizationId,JSON.stringify([{id:id('bosmans-taverniers','contact'),name:'Jurgen Bosmans',role:'Bouwheer',email:'jurgen.bosmans@bosis.be',phone:'+32 478 73 01 51',primary:true}])],
  )
  await client.query(
    `INSERT INTO opportunities (tenant_id,id,project_number,title,organization_id,legal_entity_id,branch_id,location,deadline,estimated_value,probability,stage,recognition,tender)
     VALUES ($1,$2,'OPP-BT-BA-001','Woning Bosmans-Taverniers · DWG + meetstaat',$3,$4,$5,'Bolderberg, Heusden-Zolder','2026-08-31',313890.6276,100,'Gewonnen','Private woningbouw',$6)
     ON CONFLICT (tenant_id,id) DO UPDATE SET title=EXCLUDED.title,estimated_value=EXCLUDED.estimated_value,tender=EXCLUDED.tender`,
    [tenantId,opportunityId,organizationId,DEMO_LEGAL_ENTITY_ID,DEMO_BRANCH_ID,JSON.stringify({status:'Gepland',deadline:'2026-08-31',recognition:'Private woningbouw',notes:'Echt project gekoppeld aan BosmansTaverniers.DWG en Bosmans-Taverniers MS BA.xlsx.',documents:[],questions:[]})],
  )
  await client.query(
    `INSERT INTO calculations (tenant_id,id,number,opportunity_id,status,overhead_pct,risk_pct,margin_pct,site_overhead_pct,escalation_pct,discount_pct,rounding_step,updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     ON CONFLICT (tenant_id,id) DO UPDATE SET number=EXCLUDED.number,status=EXCLUDED.status,updated_at=EXCLUDED.updated_at`,
    [tenantId,calculationId,calculation.number,opportunityId,calculation.status,calculation.overheadPct,calculation.riskPct,calculation.marginPct,calculation.siteOverheadPct,calculation.escalationPct,calculation.discountPct,calculation.roundingStep,calculation.updatedAt],
  )
  for(const chapter of calculation.chapters) await client.query(
    `INSERT INTO boq_chapters (tenant_id,id,calculation_id,code,name,sort_order) VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (tenant_id,id) DO UPDATE SET code=EXCLUDED.code,name=EXCLUDED.name,sort_order=EXCLUDED.sort_order`,
    [tenantId,chapterIds.get(chapter.code),calculationId,chapter.code,chapter.name,chapter.sortOrder],
  )
  for(const item of calculation.items) await client.query(
    `INSERT INTO boq_items (tenant_id,id,calculation_id,chapter_id,code,description,quantity,unit,labor,material,equipment,subcontracting,cost_applications,advanced,sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'{}',$13,$14)
     ON CONFLICT (tenant_id,id) DO UPDATE SET chapter_id=EXCLUDED.chapter_id,code=EXCLUDED.code,description=EXCLUDED.description,quantity=EXCLUDED.quantity,unit=EXCLUDED.unit,labor=EXCLUDED.labor,material=EXCLUDED.material,equipment=EXCLUDED.equipment,subcontracting=EXCLUDED.subcontracting,advanced=EXCLUDED.advanced,sort_order=EXCLUDED.sort_order`,
    [tenantId,id('bosmans-taverniers-boq',item.id),calculationId,item.chapterId?chapterIds.get(calculation.chapters.find(chapter=>chapter.id===item.chapterId)?.code??''):null,item.code,item.description,item.quantity,item.unit,item.labor,item.material,item.equipment,item.subcontracting,JSON.stringify({postType:item.postType,quantityType:item.quantityType,wastePct:item.wastePct??0,itemRiskPct:item.itemRiskPct??0,markupPct:item.markupPct??0,notes:item.notes??'',variables:[],formulas:{},priceAdjustments:item.priceAdjustments??[]}),item.sortOrder??0],
  )
  const inserted=await client.query(
    `INSERT INTO projects (tenant_id,id,number,name,organization_id,legal_entity_id,branch_id,source_calculation_id,contract_value,cost_budget,margin_pct,progress,status,handover,work_packages,planning)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     ON CONFLICT (tenant_id,id) DO UPDATE SET name=EXCLUDED.name,contract_value=EXCLUDED.contract_value,cost_budget=EXCLUDED.cost_budget,handover=EXCLUDED.handover,planning=EXCLUDED.planning,work_packages=EXCLUDED.work_packages,progress=EXCLUDED.progress
     RETURNING id`,
    [tenantId,projectId,project.number,project.name,organizationId,DEMO_LEGAL_ENTITY_ID,DEMO_BRANCH_ID,calculationId,project.contractValue,project.costBudget,project.marginPct,project.progress,project.status,JSON.stringify(project.handover),JSON.stringify(workPackages),JSON.stringify(planning)],
  )
  const progressLines=statement.lines.map(line=>({...line,workPackageId:workPackageIds.get(line.workPackageCode)!,...(line.bimEvidence?{bimEvidence:{...line.bimEvidence,modelId:BOSMANS_TAVERNIERS_MODEL_ID}}:{})}))
  const details={valuationDate:statement.valuationDate,dueDate:statement.dueDate,certificateReference:statement.certificateReference,preparedBy:statement.preparedBy,revisionFormula:statement.revisionFormula,advancePaymentAmount:statement.advancePaymentAmount,advanceRecoveryAmount:statement.advanceRecoveryAmount,otherDeductionsAmount:statement.otherDeductionsAmount,evidenceDocumentIds:statement.evidenceDocumentIds,qualityChecklist:statement.qualityChecklist}
  await client.query(
    `INSERT INTO progress_statements (tenant_id,id,number,project_id,period_start,period_end,lines,change_order_ids,work_amount,change_order_amount,price_revision_amount,gross_amount,retention_pct,retention_amount,net_amount,status,notes,created_at,details)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'[]',0,0,0,0,$8,0,0,$9,$10,$11,$12)
     ON CONFLICT (tenant_id,id) DO UPDATE SET lines=EXCLUDED.lines,details=EXCLUDED.details,notes=EXCLUDED.notes`,
    [tenantId,statementId,statement.number,projectId,statement.periodStart,statement.periodEnd,JSON.stringify(progressLines),statement.retentionPct,statement.status,statement.notes,statement.createdAt,JSON.stringify(details)],
  )
  await client.query(`INSERT INTO user_project_access (tenant_id,user_id,project_id) SELECT tenant_id,id,$2 FROM users WHERE tenant_id=$1 AND all_projects=false ON CONFLICT DO NOTHING`,[tenantId,projectId])
  return !existingProject.rowCount&&Boolean(inserted.rowCount)
}

export async function seedFullProductionDemo(client: PoolClient, tenantId: string, storage?: ObjectStorage) {
  const project = await client.query('SELECT id FROM projects WHERE tenant_id=$1 AND id=$2', [tenantId, DEMO_PROJECT_ID])
  if (!project.rowCount) return false
  const marker = await client.query('SELECT id FROM users WHERE tenant_id=$1 AND id=$2', [tenantId, userIds.tenderOwner])
  if (marker.rowCount) {
    const familyHomeCreated = await seedFamilyHomeBimDemo(client, tenantId)
    const bosmansTaverniersCreated = await seedBosmansTaverniersBimProject(client, tenantId)
    const progressUpgrade = await client.query<{ professional: boolean }>(
      `SELECT COALESCE(details->>'certificateReference','')='CERT-OWV-2026-10-02' AS professional
         FROM progress_statements WHERE tenant_id=$1 AND id=$2`,
      [tenantId, id('progress-statement', 'oosterweel-2026-10')],
    )
    if (progressUpgrade.rows[0]?.professional) return familyHomeCreated || bosmansTaverniersCreated
    await seedCommercialAndFinancialFlow(client, tenantId)
    return true
  }

  await seedUsers(client, tenantId)
  await seedFamilyHomeBimDemo(client, tenantId)
  await seedBosmansTaverniersBimProject(client, tenantId)
  await client.query(
    `UPDATE organizations
        SET contact_name='Marie De Clerck',
            email='marie.declerck@demo.aifestival.be',
            contacts=$3,
            roles='["Opdrachtgever","Klant"]'::jsonb
      WHERE tenant_id=$1 AND id=$2`,
    [tenantId, DEMO_ORGANIZATION_ID, JSON.stringify([{ id: id('organization-contact', 'marie'), name: 'Marie De Clerck', role: 'Projectdirecteur opdrachtgever', email: 'marie.declerck@demo.aifestival.be', phone: '+32 3 000 00 01', primary: true }])],
  )
  await client.query('UPDATE suppliers SET email=$3,contact_name=$4 WHERE tenant_id=$1 AND id=$2', [tenantId, supplierId, 'nora.dewilde@demo.aifestival.be', 'Nora De Wilde'])
  await seedDocuments(client, tenantId, storage)
  await seedTenderAndPlanning(client, tenantId)
  await seedCommercialAndFinancialFlow(client, tenantId)
  await client.query(
    `INSERT INTO qhse_certificates (tenant_id,id,project_id,holder_type,holder_id,holder_name,certificate_type,certificate_number,issued_on,expires_on,document_id)
     VALUES
      ($1,$2,$3,'Onderaannemer',$4,'Delta Infra NV','VCA**','VCA-DELTA-2026','2026-01-01','2028-06-30',$5),
      ($1,$6,$3,'Materieel',$7,'Rupskraan 35 ton','Jaarlijkse keuring','KEUR-MCH-035-2026','2026-06-30','2027-06-30',NULL)
     ON CONFLICT (tenant_id,id) DO NOTHING`,
    [tenantId, id('qhse-certificate', 'delta-vca'), DEMO_PROJECT_ID, subcontractorId, documentIds.safety, id('qhse-certificate', 'excavator'), id('asset', 'excavator-35t')],
  )
  await seedBlueprintAndOperations(client, tenantId)
  return true
}

export const productionDemoUserIds = userIds
