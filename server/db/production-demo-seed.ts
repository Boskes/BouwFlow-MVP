import { createHash } from 'node:crypto'
import type { Pool, PoolClient } from 'pg'
import type { RequestContext } from '../context.js'
import { AuthorizationError } from '../auth.js'
import type { ObjectStorage } from '../storage.js'
import { buildOosterweelClass8DemoCalculation } from '../../src/class8-demo-calculation.js'
import { seedFullProductionDemo } from './production-demo-full-seed.js'

export const BOUWFLOW_DEMO_TENANT_ID = '07ef58e4-80e9-412d-9eae-1402bd8688f9'
export const BOUWFLOW_DEMO_EMAIL_DOMAIN = '@demo.aifestival.be'

const DEMO_LEGAL_ENTITY_ID = '20000000-0000-4000-8200-000000000001'
const DEMO_BRANCH_ID = '20000000-0000-4000-8200-000000000002'
const DEMO_ORGANIZATION_ID = '20000000-0000-4000-8000-000000000001'
const DEMO_OPPORTUNITY_ID = '20000000-0000-4000-8000-000000000002'
const DEMO_CALCULATION_ID = '20000000-0000-4000-8000-000000000003'
const DEMO_PROJECT_ID = '20000000-0000-4000-8000-000000000004'
const DEMO_RESOURCE_CONFLICT_PROJECT_ID = '20000000-0000-4000-8000-000000000011'
const DEFAULT_COST_LIBRARY_VERSION_ID = '00000000-0000-4000-8000-000000000102'
const DEMO_EXPANSION_REPORT_ID = '20000000-0000-4000-8000-000000000010'

const initializedTenants = new Set<string>()

interface DemoUserRow {
  id: string
  display_name: string
  email: string
  role: string
  status: string
}

export async function applyProductionDemoUser(
  pool: Pick<Pool, 'query'>,
  context: RequestContext,
  requestedUserId: string | undefined,
) {
  if (!requestedUserId) return false
  if (context.tenantId !== BOUWFLOW_DEMO_TENANT_ID || !context.roles.includes('Administrator')) {
    throw new AuthorizationError('Alleen een BouwFlow-demo-administrator kan een testsessie starten')
  }
  const result = await pool.query<DemoUserRow>(
    `SELECT id,display_name,email,role,status
       FROM users
      WHERE tenant_id=$1 AND id=$2 AND lower(email) LIKE $3
      LIMIT 1`,
    [context.tenantId, requestedUserId, `%${BOUWFLOW_DEMO_EMAIL_DOMAIN}`],
  )
  const target = result.rows[0]
  if (!target || target.status !== 'Actief' || target.role === 'Administrator') {
    throw new AuthorizationError('Deze demogebruiker is niet beschikbaar voor een testsessie')
  }
  context.userId = target.id
  context.displayName = target.display_name
  context.email = target.email
  context.roles = [target.role]
  context.configuredAccess = true
  return true
}

function deterministicUuid(scope: string, value: string) {
  const hex = createHash('sha256').update(`bouwflow:${scope}:${value}`).digest('hex').slice(0, 32).split('')
  hex[12] = '4'
  hex[16] = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16)
  const compact = hex.join('')
  return `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20)}`
}

async function insertRows(client: PoolClient, table: string, columns: string[], rows: unknown[][]) {
  const chunkSize = 200
  for (let offset = 0; offset < rows.length; offset += chunkSize) {
    const chunk = rows.slice(offset, offset + chunkSize)
    const values: unknown[] = []
    const placeholders = chunk.map(row => {
      const start = values.length
      values.push(...row)
      return `(${row.map((_, index) => `$${start + index + 1}`).join(',')})`
    })
    await client.query(
      `INSERT INTO ${table} (${columns.join(',')}) VALUES ${placeholders.join(',')} ON CONFLICT (tenant_id,id) DO NOTHING`,
      values,
    )
  }
}

function projectDemoData() {
  const calculation = buildOosterweelClass8DemoCalculation()
  const chapterIds = new Map(calculation.chapters.map(chapter => [chapter.id, deterministicUuid('chapter', chapter.id)]))
  const chapterSections = new Map(calculation.chapters.map(chapter => [chapter.id, Math.floor(chapter.sortOrder / 15)]))
  const sectionBudgets = Array.from({ length: 12 }, () => 0)

  for (const item of calculation.items) {
    const material = item.material * (1 + (item.wastePct ?? 0) / 100)
    const directCost = item.quantity * (item.labor + material + item.equipment + item.subcontracting)
      * (1 + ((item.itemRiskPct ?? 0) + (item.markupPct ?? 0)) / 100)
    sectionBudgets[item.chapterId ? chapterSections.get(item.chapterId) ?? 0 : 0] += directCost
  }

  const workPackages = sectionBudgets.map((budget, index) => ({
    id: deterministicUuid('work-package', String(index + 1)),
    code: `WP-${String(index + 1).padStart(2, '0')}`,
    name: calculation.chapters[index * 15]?.name.split(' · ')[0] ?? `Werkpakket ${index + 1}`,
    budget: Math.round(budget * 100) / 100,
    plannedHours: 24_000 + index * 1_250,
    status: index < 2 ? 'Klaar voor planning' : 'Niet gestart',
  }))

  return { calculation, chapterIds, workPackages }
}

async function seedDemoCalculationVersions(client: PoolClient, tenantId: string) {
  const calculationExists = await client.query<{ id: string }>('SELECT id FROM calculations WHERE tenant_id=$1 AND id=$2', [tenantId, DEMO_CALCULATION_ID])
  if (!calculationExists.rowCount) return false

  const { calculation, chapterIds } = projectDemoData()
  const snapshot = {
    ...structuredClone(calculation),
    id:DEMO_CALCULATION_ID,
    opportunityId:DEMO_OPPORTUNITY_ID,
    chapters:calculation.chapters.map(chapter=>({...chapter,id:chapterIds.get(chapter.id)!})),
    items:calculation.items.map(item=>({...item,id:deterministicUuid('item',item.id),chapterId:item.chapterId?chapterIds.get(item.chapterId):null})),
  }
  const tenderBasis = {
    ...structuredClone(snapshot),
    status:'Review' as const,
    overheadPct:6.5,
    riskPct:7.5,
    marginPct:8,
    items:snapshot.items.slice(0,-1).map((item,index)=>index<3?{...item,quantity:Number((item.quantity*.96).toFixed(3)),material:Number((item.material*.95).toFixed(3))}:item),
    updatedAt:'2026-07-14T15:30:00.000Z',
  }
  const submission = {
    ...structuredClone(snapshot),
    status:'Offerte' as const,
    overheadPct:7,
    riskPct:7,
    marginPct:8.25,
    items:snapshot.items.filter((_,index)=>index!==snapshot.items.length-2).map((item,index)=>index<4?{...item,material:Number((item.material*.98).toFixed(3)),notes:`${item.notes??''}${item.notes?' ':''}Prijs afgestemd op leveranciersronde 2.`}:item),
    updatedAt:'2026-07-25T11:00:00.000Z',
  }
  const versions = [
    [deterministicUuid('calculation-version','oosterweel-v1'),1,'Tenderbasis','Scopecontrole na eerste leveranciersronde',tenderBasis,deterministicUuid('demo-user','david-projectdirecteur'),'2026-07-14T15:30:00.000Z'],
    [deterministicUuid('calculation-version','oosterweel-v2'),2,'Inschrijvingsversie','Definitieve prijsoptimalisatie vóór indiening',submission,deterministicUuid('demo-user','noor-calculator'),'2026-07-25T11:00:00.000Z'],
  ]
  let inserted = false
  for (const [id,version,label,reason,versionSnapshot,createdBy,createdAt] of versions) {
    const result = await client.query(`INSERT INTO calculation_versions (tenant_id,id,calculation_id,version,label,reason,snapshot,created_by,created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING RETURNING id`, [tenantId,id,DEMO_CALCULATION_ID,version,label,reason,JSON.stringify(versionSnapshot),createdBy,createdAt])
    inserted = inserted || Boolean(result.rowCount)
  }
  return inserted
}

async function seedEmptyTenant(client: PoolClient, tenantId: string) {
  const existingEntity = await client.query<{ id: string }>(
    'SELECT id FROM legal_entities WHERE tenant_id=$1 ORDER BY created_at LIMIT 1',
    [tenantId],
  )
  let legalEntityId = existingEntity.rows[0]?.id
  if (!legalEntityId) {
    const inserted = await client.query<{ id: string }>(`INSERT INTO legal_entities
      (tenant_id,id,name,vat_number,country,currency,active,invoice_prefix,next_invoice_number,default_vat_pct,payment_terms_days,address_line,postal_code,city,country_code)
      VALUES ($1,$2,'Bosis BE','BE0502635588','Belgie','EUR',true,'BF',1,21,30,'Koedrieshof 8','3550','Heusden-Zolder','BE')
      RETURNING id`, [tenantId, DEMO_LEGAL_ENTITY_ID])
    legalEntityId = inserted.rows[0].id
  }

  const existingBranch = await client.query<{ id: string }>(
    'SELECT id FROM company_branches WHERE tenant_id=$1 AND legal_entity_id=$2 ORDER BY created_at LIMIT 1',
    [tenantId, legalEntityId],
  )
  let branchId = existingBranch.rows[0]?.id
  if (!branchId) {
    const inserted = await client.query<{ id: string }>(`INSERT INTO company_branches
      (tenant_id,id,legal_entity_id,name,address,country)
      VALUES ($1,$2,$3,'Heusden-Zolder','Koedrieshof 8, 3550 Heusden-Zolder','Belgie')
      RETURNING id`, [tenantId, DEMO_BRANCH_ID, legalEntityId])
    branchId = inserted.rows[0].id
  }

  await client.query(`INSERT INTO organizations
    (tenant_id,id,name,type,contact_name,email,vat_number,address_line,postal_code,city,country_code,peppol_endpoint_id,peppol_scheme_id,roles)
    VALUES ($1,$2,'Lantis','Overheid','Projectteam Rechteroever','info@lantis.be','BE0679761031','Sint-Pietersvliet 7','2000','Antwerpen','BE','0679761031','0208','["Opdrachtgever"]')
    ON CONFLICT (tenant_id,id) DO NOTHING`, [tenantId, DEMO_ORGANIZATION_ID])

  await client.query(`INSERT INTO opportunities
    (tenant_id,id,project_number,title,organization_id,legal_entity_id,branch_id,location,deadline,estimated_value,probability,stage,recognition,tender)
    VALUES ($1,$2,'OWV-RO-DEMO','Oosterweelverbinding - Rechteroever (klasse 8 demo)', $3,$4,$5,'Antwerpen - Rechteroever','2027-12-31',875000000,100,'Gewonnen','C - Klasse 8',$6)
    ON CONFLICT (tenant_id,id) DO NOTHING`, [
    tenantId,
    DEMO_OPPORTUNITY_ID,
    DEMO_ORGANIZATION_ID,
    legalEntityId,
    branchId,
    JSON.stringify({
      status: 'Ingediend',
      deadline: '2027-12-31',
      recognition: 'C - Klasse 8',
      notes: 'Deterministische BouwFlow-demodata op basis van publiek beschreven projectonderdelen; geen officiele aanbestedingsprijzen.',
      documents: [],
      questions: [],
    }),
  ])

  const { calculation, chapterIds, workPackages } = projectDemoData()
  await client.query(`INSERT INTO calculations
    (tenant_id,id,number,opportunity_id,status,overhead_pct,risk_pct,margin_pct,site_overhead_pct,escalation_pct,discount_pct,rounding_step,updated_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
    ON CONFLICT (tenant_id,id) DO NOTHING`, [
    tenantId,
    DEMO_CALCULATION_ID,
    calculation.number,
    DEMO_OPPORTUNITY_ID,
    calculation.status,
    calculation.overheadPct,
    calculation.riskPct,
    calculation.marginPct,
    calculation.siteOverheadPct,
    calculation.escalationPct,
    calculation.discountPct,
    calculation.roundingStep,
    calculation.updatedAt,
  ])

  await insertRows(client, 'boq_chapters', ['tenant_id', 'id', 'calculation_id', 'code', 'name', 'sort_order'], calculation.chapters.map(chapter => [
    tenantId,
    chapterIds.get(chapter.id),
    DEMO_CALCULATION_ID,
    chapter.code,
    chapter.name,
    chapter.sortOrder,
  ]))

  await insertRows(client, 'boq_items', [
    'tenant_id', 'id', 'calculation_id', 'chapter_id', 'code', 'description', 'quantity', 'unit',
    'labor', 'material', 'equipment', 'subcontracting', 'cost_applications', 'advanced', 'sort_order',
  ], calculation.items.map(item => [
    tenantId,
    deterministicUuid('item', item.id),
    DEMO_CALCULATION_ID,
    item.chapterId ? chapterIds.get(item.chapterId) : null,
    item.code,
    item.description,
    item.quantity,
    item.unit,
    item.labor,
    item.material,
    item.equipment,
    item.subcontracting,
    JSON.stringify(item.costApplications ?? {}),
    JSON.stringify({
      postType: item.postType ?? 'Meetstaatpost',
      quantityType: item.quantityType ?? 'Vermoedelijk',
      wastePct: item.wastePct ?? 0,
      itemRiskPct: item.itemRiskPct ?? 0,
      markupPct: item.markupPct ?? 0,
      notes: item.notes ?? '',
      variables: item.variables ?? [],
      formulas: item.formulas ?? {},
      priceAdjustments: item.priceAdjustments ?? [],
    }),
    item.sortOrder,
  ]))

  const libraryItems = [
    ['21000000-0000-4000-8100-000000000001', 'ARB-001', 'Grondwerker', 'labor', 'uur', 46, 'Interne uurkost 2026'],
    ['21000000-0000-4000-8100-000000000002', 'ARB-002', 'Ploegbaas', 'labor', 'uur', 58, 'Interne uurkost 2026'],
    ['21000000-0000-4000-8100-000000000003', 'MAT-001', 'Steenslag type II', 'material', 'ton', 24.5, 'Raamcontract groeve'],
    ['21000000-0000-4000-8100-000000000004', 'MAT-002', 'Asfalt AB-4C', 'material', 'ton', 91, 'Marktprijs 2026'],
    ['21000000-0000-4000-8100-000000000005', 'MCH-001', 'Rupskraan 25 ton', 'equipment', 'uur', 84, 'Intern materieeltarief'],
    ['21000000-0000-4000-8100-000000000006', 'OND-001', 'Wegmarkeringen', 'subcontracting', 'm2', 7.5, 'Historische onderaannemersprijs'],
  ]
  await insertRows(client, 'cost_library_items', [
    'tenant_id', 'id', 'library_version_id', 'code', 'name', 'category', 'unit', 'unit_cost', 'source',
  ], libraryItems.map(item => [tenantId, item[0], DEFAULT_COST_LIBRARY_VERSION_ID, ...item.slice(1)]))

  await client.query(`INSERT INTO projects
    (tenant_id,id,number,name,organization_id,legal_entity_id,branch_id,source_calculation_id,contract_value,cost_budget,margin_pct,progress,status,handover,work_packages,planning)
    VALUES ($1,$2,'PRJ-OWV-RO-DEMO','Oosterweelverbinding - Rechteroever',$3,$4,$5,$6,875000000,650000000,8.5,7.5,'Op schema',$7,$8,$9)
    ON CONFLICT (tenant_id,id) DO NOTHING`, [
    tenantId,
    DEMO_PROJECT_ID,
    DEMO_ORGANIZATION_ID,
    legalEntityId,
    branchId,
    DEMO_CALCULATION_ID,
    JSON.stringify({
      status: 'Aanvaard',
      projectManager: 'BouwFlow demoteam',
      plannedStart: '2026-09-01',
      plannedEnd: '2033-12-31',
      notes: 'Demo-project voor BouwFlow. Bedragen en hoeveelheden zijn realistische aannames, geen officiele projectdata.',
      risks: ['Fasering en verkeershinder', 'Ondergrondse raakvlakken', 'Prijs- en planningsrisico'],
      checklist: {
        scopeReviewed: true,
        budgetReviewed: true,
        contractReviewed: true,
        documentsTransferred: true,
        risksReviewed: true,
        kickoffPlanned: true,
      },
      acceptedAt: '2026-08-15T09:00:00.000Z',
    }),
    JSON.stringify(workPackages),
    JSON.stringify({
      status: 'Baseline',
      baselineVersion: 1,
      activities: [],
      updatedAt: '2026-08-15T09:00:00.000Z',
      baselineHistory: [],
      scenarios: [],
    }),
  ])

}

/**
 * Adds operational records to the fixed demo project.  This is deliberately a
 * separate, idempotent upgrade: tenants that already received the first
 * Oosterweel calculation can safely receive richer demo data after a release.
 */
async function seedDemoProjectExpansion(client: PoolClient, tenantId: string) {
  const demoProject = await client.query<{ id: string }>(
    'SELECT id FROM projects WHERE tenant_id=$1 AND id=$2',
    [tenantId, DEMO_PROJECT_ID],
  )
  if (!demoProject.rowCount) return false

  const alreadyExpanded = await client.query<{ id: string }>(
    'SELECT id FROM daily_reports WHERE tenant_id=$1 AND id=$2',
    [tenantId, DEMO_EXPANSION_REPORT_ID],
  )
  if (alreadyExpanded.rowCount) return false

  const { workPackages } = projectDemoData()
  const packageId = (index: number) => workPackages[index]?.id ?? deterministicUuid('work-package', String(index + 1))
  const publicAuthorityId = deterministicUuid('organization', 'stad-antwerpen')
  const utilityAuthorityId = deterministicUuid('organization', 'aquafin')
  const portAuthorityId = deterministicUuid('organization', 'port-antwerp-bruges')

  await insertRows(client, 'organizations', [
    'tenant_id', 'id', 'name', 'type', 'contact_name', 'email', 'vat_number', 'address_line', 'postal_code', 'city', 'country_code', 'roles',
  ], [
    [tenantId, publicAuthorityId, 'Stad Antwerpen', 'Overheid', 'Team Stadsontwikkeling', 'stadsontwikkeling@example.demo', 'BE0207722470', 'Grote Markt 1', '2000', 'Antwerpen', 'BE', JSON.stringify(['Opdrachtgever'])],
    [tenantId, utilityAuthorityId, 'Aquafin', 'Nutsbedrijf', 'Afdeling Projecten', 'projecten@aquafin.example.demo', 'BE0440052604', 'Dijkstraat 8', '2630', 'Aartselaar', 'BE', JSON.stringify(['Opdrachtgever'])],
    [tenantId, portAuthorityId, 'Port of Antwerp-Bruges', 'Privaat', 'Infrastructuurcel', 'infrastructuur@port.example.demo', 'BE0248061311', 'Zaha Hadidplein 1', '2030', 'Antwerpen', 'BE', JSON.stringify(['Opdrachtgever'])],
  ])

  await insertRows(client, 'opportunities', [
    'tenant_id', 'id', 'project_number', 'title', 'organization_id', 'legal_entity_id', 'branch_id', 'location', 'deadline', 'estimated_value', 'probability', 'stage', 'recognition', 'tender',
  ], [
    [tenantId, deterministicUuid('opportunity', 'antwerp-quays'), 'ANT-KAAI-DEMO', 'Herinrichting kaaizone Noord', publicAuthorityId, DEMO_LEGAL_ENTITY_ID, DEMO_BRANCH_ID, 'Antwerpen', '2026-10-14', 48_500_000, 45, 'Go/No-Go', 'C - Klasse 7', JSON.stringify({ status: 'In opmaak', questions: [], documents: [], notes: 'Demo-tender met lopende Go/No-Go beoordeling.' })],
    [tenantId, deterministicUuid('opportunity', 'aquafin-collector'), 'AQF-COL-DEMO', 'Collector en pompstation Zuidrand', utilityAuthorityId, DEMO_LEGAL_ENTITY_ID, DEMO_BRANCH_ID, 'Kontich', '2026-11-05', 31_800_000, 30, 'Gekwalificeerd', 'C - Klasse 6', JSON.stringify({ status: 'Kwalificatie', questions: [], documents: [], notes: 'Demo-tender met selectievoorwaarden en capaciteitscheck.' })],
    [tenantId, deterministicUuid('opportunity', 'port-rail'), 'POA-RAIL-DEMO', 'Spoorontsluiting containerterminal', portAuthorityId, DEMO_LEGAL_ENTITY_ID, DEMO_BRANCH_ID, 'Antwerpen-Noord', '2026-12-02', 76_200_000, 15, 'Nieuw', 'C - Klasse 7', JSON.stringify({ status: 'Prospect', questions: [], documents: [], notes: 'Nieuw commercieel dossier in demonstratiepipeline.' })],
  ])

  await insertRows(client, 'daily_reports', [
    'tenant_id', 'id', 'project_id', 'report_date', 'work_package_id', 'weather', 'temperature', 'activities', 'labor_entries', 'subcontractors', 'materials', 'machines', 'deliveries', 'delays', 'problems', 'visitors', 'notes', 'status', 'created_at', 'submitted_at', 'signed_by', 'signed_at',
  ], [
    [tenantId, DEMO_EXPANSION_REPORT_ID, DEMO_PROJECT_ID, '2026-09-14', packageId(0), 'Droog', 19, 'Opstart fasering Rechteroever, veiligheidsbriefing en referentie-inmeting.', JSON.stringify([{ id: deterministicUuid('labor', 'r1-1'), employeeName: 'Lena Vermeulen', role: 'Projectmanager', hours: 9, overtimeHours: 0 }, { id: deterministicUuid('labor', 'r1-2'), employeeName: 'Wouter Peeters', role: 'Werfleider', hours: 10, overtimeHours: 1 }]), JSON.stringify(['Delta Infra NV']), JSON.stringify([{ id: deterministicUuid('material', 'r1-1'), description: 'Signalisatie en werfinrichting', quantity: 1, unit: 'lot' }]), JSON.stringify([{ id: deterministicUuid('machine', 'r1-1'), description: 'Totaalstation', quantity: 1, unit: 'dag' }]), 'Werfkeet, signalisatie en meetmateriaal geleverd.', '', 'Kruising met bestaande datakabels gemeld voor verificatie.', 'Lantis en veiligheidscoordinator.', 'Startvergadering uitgevoerd; fasering versie 1.0 gedeeld.', 'Ondertekend', '2026-09-14T16:30:00.000Z', '2026-09-14T17:00:00.000Z', 'Projectteam Lantis', '2026-09-15T08:20:00.000Z'],
    [tenantId, deterministicUuid('daily-report', 'oosterweel-20260915'), DEMO_PROJECT_ID, '2026-09-15', packageId(1), 'Wisselvallig', 17, 'Vrijmaken werkzone en proefputten ter hoogte van de toekomstige tunneltoerit.', JSON.stringify([{ id: deterministicUuid('labor', 'r2-1'), employeeName: 'Wouter Peeters', role: 'Werfleider', hours: 10, overtimeHours: 0 }, { id: deterministicUuid('labor', 'r2-2'), employeeName: 'Milan Jacobs', role: 'Grondwerker', hours: 9, overtimeHours: 1 }]), JSON.stringify(['Delta Infra NV']), JSON.stringify([{ id: deterministicUuid('material', 'r2-1'), description: 'Rijplaten staal', quantity: 42, unit: 'st' }]), JSON.stringify([{ id: deterministicUuid('machine', 'r2-1'), description: 'Rupskraan 35 ton', quantity: 9, unit: 'uur' }]), 'Rijplaten en tijdelijke afwatering geleverd.', '35 minuten werkonderbreking door regen.', 'Twee niet-gemarkeerde mantelbuizen aangetroffen.', 'Nutscoordinator en landmeter.', 'Proefputten digitaal ingemeten; raakvlakfiche opgesteld.', 'Ingediend', '2026-09-15T17:15:00.000Z', '2026-09-15T17:30:00.000Z', null, null],
    [tenantId, deterministicUuid('daily-report', 'oosterweel-20260916'), DEMO_PROJECT_ID, '2026-09-16', packageId(2), 'Droog', 21, 'Aanleg tijdelijke drainage en voorbereiding bouwkuip zone A.', JSON.stringify([{ id: deterministicUuid('labor', 'r3-1'), employeeName: 'Lena Vermeulen', role: 'Projectmanager', hours: 8, overtimeHours: 0 }, { id: deterministicUuid('labor', 'r3-2'), employeeName: 'Milan Jacobs', role: 'Grondwerker', hours: 10, overtimeHours: 0 }]), JSON.stringify(['Delta Infra NV']), JSON.stringify([{ id: deterministicUuid('material', 'r3-1'), description: 'Drainagebuis PEHD', quantity: 640, unit: 'm' }]), JSON.stringify([{ id: deterministicUuid('machine', 'r3-1'), description: 'Graafmachine 25 ton', quantity: 10, unit: 'uur' }]), 'Drainagebuizen en filtermateriaal geleverd.', '', '', 'Controlelaboratorium.', 'Kwaliteitscontrole op bedding ingepland voor volgende werkdag.', 'Concept', '2026-09-16T16:50:00.000Z', null, null, null],
  ])

  await insertRows(client, 'project_costs', [
    'tenant_id', 'id', 'project_id', 'work_package_id', 'cost_date', 'type', 'category', 'description', 'supplier', 'amount', 'reference', 'recognition', 'status', 'created_at',
  ], [
    [tenantId, deterministicUuid('cost', 'oosterweel-labor-01'), DEMO_PROJECT_ID, packageId(0), '2026-09-14', 'Werkelijke kost', 'labor', 'Projectleiding en werfvoorbereiding september', 'Eigen personeel', 184_600, 'UREN-OWV-001', 'Boeking', 'Geboekt', '2026-09-14T18:00:00.000Z'],
    [tenantId, deterministicUuid('cost', 'oosterweel-equipment-01'), DEMO_PROJECT_ID, packageId(1), '2026-09-15', 'Werkelijke kost', 'equipment', 'Graafmaterieel en meetploeg', 'Bosis materieeldienst', 96_800, 'MAT-OWV-014', 'Boeking', 'Geboekt', '2026-09-15T18:00:00.000Z'],
    [tenantId, deterministicUuid('cost', 'oosterweel-material-01'), DEMO_PROJECT_ID, packageId(2), '2026-09-16', 'Werkelijke kost', 'material', 'Tijdelijke drainage en filtermateriaal', 'Hydroline NV', 224_500, 'LV-2026-4481', 'Boeking', 'Geboekt', '2026-09-16T18:00:00.000Z'],
    [tenantId, deterministicUuid('cost', 'oosterweel-subcontract-01'), DEMO_PROJECT_ID, packageId(3), '2026-09-18', 'Verplichting', 'subcontracting', 'Nutsdetectie en proefsleuven', 'Delta Infra NV', 615_000, 'PO-OWV-0007', 'Verplichting', 'Open', '2026-09-18T12:00:00.000Z'],
    [tenantId, deterministicUuid('cost', 'oosterweel-material-02'), DEMO_PROJECT_ID, packageId(4), '2026-09-22', 'Verplichting', 'material', 'Damwandprofielen eerste tranche', 'SteelWorks Belgium', 2_460_000, 'PO-OWV-0011', 'Verplichting', 'Open', '2026-09-22T12:00:00.000Z'],
    [tenantId, deterministicUuid('cost', 'oosterweel-labor-02'), DEMO_PROJECT_ID, packageId(5), '2026-09-25', 'Werkelijke kost', 'labor', 'Bouwkuip ploeguren week 39', 'Eigen personeel', 312_400, 'UREN-OWV-002', 'Boeking', 'Geboekt', '2026-09-25T18:00:00.000Z'],
  ])

  await insertRows(client, 'change_orders', [
    'tenant_id', 'id', 'number', 'project_id', 'daily_report_id', 'work_package_id', 'change_date', 'cause', 'description', 'initiator', 'responsible_party', 'schedule_impact_days', 'costs', 'total', 'photo_ids', 'status', 'created_at', 'calculated_at', 'submitted_at', 'approved_by', 'approved_at', 'executed_at', 'ready_for_invoice_at',
  ], [
    [tenantId, deterministicUuid('change', 'oosterweel-cables'), 'MW-OWV-001', DEMO_PROJECT_ID, deterministicUuid('daily-report', 'oosterweel-20260915'), packageId(1), '2026-09-15', 'Onvoorziene bestaande toestand', 'Lokalisatie, bescherming en tijdelijke omlegging van niet-gemarkeerde mantelbuizen.', 'Werfleiding', 'Opdrachtgever', 4, JSON.stringify({ labor: 86_000, material: 142_000, equipment: 44_000, transport: 18_000, subcontracting: 125_000, other: 10_000 }), 425_000, JSON.stringify([]), 'Ter goedkeuring', '2026-09-15T17:45:00.000Z', '2026-09-16T09:00:00.000Z', '2026-09-16T15:00:00.000Z', null, null, null, null],
    [tenantId, deterministicUuid('change', 'oosterweel-drainage'), 'MW-OWV-002', DEMO_PROJECT_ID, deterministicUuid('daily-report', 'oosterweel-20260916'), packageId(2), '2026-09-16', 'Technische optimalisatie', 'Extra drainagecapaciteit om de bouwkuip in fasering 1 droog te houden.', 'Studiebureau', 'Opdrachtgever', 1, JSON.stringify({ labor: 35_000, material: 98_000, equipment: 27_000, transport: 8_000, subcontracting: 22_000, other: 0 }), 190_000, JSON.stringify([]), 'Goedgekeurd', '2026-09-16T17:20:00.000Z', '2026-09-17T09:00:00.000Z', '2026-09-17T13:00:00.000Z', 'Projectteam Lantis', '2026-09-18T11:00:00.000Z', null, null],
  ])

  await insertRows(client, 'project_forecasts', [
    'tenant_id', 'id', 'project_id', 'version', 'lines', 'actual_costs', 'open_commitments', 'remaining_cost', 'estimate_at_completion', 'expected_revenue', 'expected_margin', 'expected_margin_pct', 'notes', 'status', 'created_by', 'approved_by', 'approved_at', 'created_at',
  ], [
    [tenantId, deterministicUuid('forecast', 'oosterweel-v1'), DEMO_PROJECT_ID, 1, JSON.stringify(workPackages.map((item, index) => ({ workPackageId: item.id, workPackageCode: item.code, workPackageName: item.name, openCommitments: index < 5 ? item.budget * 0.05 : 0, remainingCost: item.budget * 0.88 }))), 1_153_300, 3_075_000, 646_920_000, 651_148_300, 875_000_000, 223_851_700, 25.58, 'Eerste maandrapport na opstart; voorbehoud voor nutsrisico en staalprijzen.', 'Goedgekeurd', 'Lena Vermeulen', 'Directie BouwFlow', '2026-09-30T10:00:00.000Z', '2026-09-30T09:00:00.000Z'],
    [tenantId, deterministicUuid('forecast', 'oosterweel-v2'), DEMO_PROJECT_ID, 2, JSON.stringify(workPackages.map((item, index) => ({ workPackageId: item.id, workPackageCode: item.code, workPackageName: item.name, openCommitments: index < 6 ? item.budget * 0.07 : 0, remainingCost: item.budget * 0.89 }))), 1_153_300, 4_460_000, 649_780_000, 655_393_300, 875_000_000, 219_606_700, 25.1, 'Forecast met geactualiseerde damwandofferte en onzekerheid op raakvlakken.', 'Ter goedkeuring', 'Lena Vermeulen', null, null, '2026-10-15T09:00:00.000Z'],
  ])

  await insertRows(client, 'suppliers', [
    'tenant_id', 'id', 'name', 'vat_number', 'contact_name', 'email', 'payment_terms', 'rating', 'framework_agreements',
  ], [
    [tenantId, deterministicUuid('supplier', 'steelworks'), 'SteelWorks Belgium NV', 'BE0712345678', 'Nora De Wilde', 'nora.dewilde@steelworks.example.demo', '30 dagen einde maand', 4.4, JSON.stringify([])],
    [tenantId, deterministicUuid('supplier', 'hydroline'), 'Hydroline NV', 'BE0666777888', 'Karim El Mansouri', 'karim@hydroline.example.demo', '30 dagen', 4.1, JSON.stringify([])],
  ])

  await insertRows(client, 'procurement_requests', [
    'tenant_id', 'id', 'number', 'project_id', 'work_package_id', 'invited_supplier_ids', 'category', 'requested_by', 'needed_by', 'description', 'items', 'status', 'quotes', 'approval', 'created_at',
  ], [
    [tenantId, deterministicUuid('procurement', 'oosterweel-damwand'), 'INK-OWV-0001', DEMO_PROJECT_ID, packageId(4), JSON.stringify([deterministicUuid('supplier', 'steelworks')]), 'material', 'Lena Vermeulen', '2026-10-20', 'Damwandprofielen en hoekstukken bouwkuip fase 1', JSON.stringify([{ id: deterministicUuid('procurement-item', 'damwand-1'), description: 'Damwandprofiel AZ 26-700', quantity: 2_400, unit: 'ton', targetUnitPrice: 1_025 }, { id: deterministicUuid('procurement-item', 'damwand-2'), description: 'Hoekstukken en koppelingen', quantity: 1, unit: 'lot', targetUnitPrice: 85_000 }]), 'Vergelijken', JSON.stringify([{ id: deterministicUuid('supplier-quote', 'damwand-1'), supplierId: deterministicUuid('supplier', 'steelworks'), amount: 2_545_000, leadTimeDays: 42, validityDate: '2026-10-10', notes: 'Levering per fasering; staalindex herzienbaar.' }]), JSON.stringify({ status: 'Te beoordelen', requiredRole: 'Directie', amount: 2_545_000 }), '2026-09-22T09:00:00.000Z'],
  ])

  await insertRows(client, 'qhse_inspections', [
    'tenant_id', 'id', 'project_id', 'inspection_date', 'inspection_type', 'inspector', 'location', 'notes', 'findings', 'status', 'created_at', 'closed_at',
  ], [
    [tenantId, deterministicUuid('qhse', 'oosterweel-safety'), DEMO_PROJECT_ID, '2026-09-15', 'Veiligheidsrondgang', 'Maaike De Smet', 'Zone A - Rechteroever', 'Opstartcontrole bouwplaats en tijdelijke verkeersmaatregelen.', JSON.stringify([{ id: deterministicUuid('finding', 'safety-1'), description: 'Aanvullende afscherming langs fietsomleiding vereist.', severity: 'Hoog', responsible: 'Werfleiding', dueDate: '2026-09-18' }, { id: deterministicUuid('finding', 'safety-2'), description: 'Noodnummer op werfkeet actualiseren.', severity: 'Laag', responsible: 'Projectsecretariaat', dueDate: '2026-09-16', resolvedAt: '2026-09-16T10:00:00.000Z' }]), 'Open', '2026-09-15T15:00:00.000Z', null],
    [tenantId, deterministicUuid('qhse', 'oosterweel-quality'), DEMO_PROJECT_ID, '2026-09-18', 'Kwaliteitscontrole', 'Maaike De Smet', 'Bouwkuip zone A', 'Controle van bedding en drainageproefvak.', JSON.stringify([{ id: deterministicUuid('finding', 'quality-1'), description: 'Drainageproef voldoet aan debietseis.', severity: 'Laag', responsible: 'Kwaliteitsdienst', dueDate: '2026-09-18', resolvedAt: '2026-09-18T15:00:00.000Z' }]), 'Gesloten', '2026-09-18T16:00:00.000Z', '2026-09-18T16:15:00.000Z'],
  ])

  return true
}

async function seedDailyProductionUpgrade(client: PoolClient, tenantId: string) {
  const { calculation, workPackages } = projectDemoData()
  const workPackage = workPackages[0]
  const chapter = calculation.chapters.find(item => Number(item.code) === Number(workPackage?.code))
  const item = calculation.items.find(candidate => candidate.chapterId === chapter?.id && candidate.postType !== 'Tekstregel' && candidate.postType !== 'Subtotaal')
  if (!workPackage || !item) return false
  const productionEntry = {
    id: deterministicUuid('production-entry', 'oosterweel-20260914-1'),
    workPackageId: workPackage.id,
    boqItemId: deterministicUuid('item', item.id),
    description: item.description,
    quantity: Math.max(1, Math.round(item.quantity * .08 * 100) / 100),
    unit: item.unit,
  }
  const updated = await client.query(
    `UPDATE daily_reports SET production_entries=$3
      WHERE tenant_id=$1 AND id=$2 AND production_entries='[]'::jsonb`,
    [tenantId, DEMO_EXPANSION_REPORT_ID, JSON.stringify([productionEntry])],
  )
  return Boolean(updated.rowCount)
}

async function seedResourceConflictProject(client: PoolClient, tenantId: string) {
  const primaryProject = await client.query<{ id: string }>(
    'SELECT id FROM projects WHERE tenant_id=$1 AND id=$2',
    [tenantId, DEMO_PROJECT_ID],
  )
  if (!primaryProject.rowCount) return false
  const existingProject = await client.query<{ id: string }>(
    'SELECT id FROM projects WHERE tenant_id=$1 AND id=$2',
    [tenantId, DEMO_RESOURCE_CONFLICT_PROJECT_ID],
  )
  if (existingProject.rowCount) {
    await client.query(
      `INSERT INTO user_project_access (tenant_id,user_id,project_id)
       SELECT tenant_id,id,$2 FROM users WHERE tenant_id=$1 AND all_projects=false
       ON CONFLICT DO NOTHING`,
      [tenantId, DEMO_RESOURCE_CONFLICT_PROJECT_ID],
    )
    return false
  }

  const workPackageId = deterministicUuid('work-package', 'ring-noord-capacity')
  const crewId = deterministicUuid('crew', 'rechteroever')
  const opportunityId = deterministicUuid('opportunity', 'ring-noord-capacity')
  const calculationId = deterministicUuid('calculation', 'ring-noord-capacity')
  const activities = [
    {
      id: deterministicUuid('planning-activity', 'ring-noord-crew-conflict'),
      workPackageId,
      name: 'Voorbereidende grondwerken noordelijke ring',
      startDate: '2026-09-05',
      endDate: '2026-09-12',
      progress: 35,
      predecessorIds: [],
      dependencies: [],
      milestone: false,
      responsible: 'Wouter Peeters',
      crewSize: 8,
      weatherSensitive: true,
      resourceAssignments: [{ id: deterministicUuid('planning-resource', 'ring-noord-crew'), crewId, resourceType: 'Ploeg', resourceName: 'Ploeg Rechteroever', allocationPct: 100 }],
      baselineStartDate: '2026-09-05',
      baselineEndDate: '2026-09-12',
    },
    {
      id: deterministicUuid('planning-activity', 'ring-noord-crane-conflict'),
      workPackageId,
      name: 'Tijdelijke bouwweg en grondverzet',
      startDate: '2028-01-15',
      endDate: '2028-02-15',
      progress: 0,
      predecessorIds: [],
      dependencies: [],
      milestone: false,
      responsible: 'Lena Vermeulen',
      crewSize: 6,
      weatherSensitive: true,
      resourceAssignments: [{ id: deterministicUuid('planning-resource', 'ring-noord-crane'), resourceType: 'Materieel', resourceName: 'Rupskraan 35t', allocationPct: 100 }],
      baselineStartDate: '2028-01-15',
      baselineEndDate: '2028-02-15',
    },
  ]
  await client.query(
    `INSERT INTO opportunities
      (tenant_id,id,project_number,title,organization_id,legal_entity_id,branch_id,location,deadline,estimated_value,probability,stage,recognition,tender)
     VALUES ($1,$2,'RING-CAP-DEMO','Ringverbinding Noord - capaciteitstest',$3,$4,$5,'Antwerpen-Noord','2026-08-20',48500000,100,'Gewonnen','C - Klasse 7',$6)
     ON CONFLICT (tenant_id,id) DO NOTHING`,
    [tenantId, opportunityId, DEMO_ORGANIZATION_ID, DEMO_LEGAL_ENTITY_ID, DEMO_BRANCH_ID, JSON.stringify({ status: 'Gegund', notes: 'Proefdossier voor cross-project resourceplanning.' })],
  )
  await client.query(
    `INSERT INTO calculations
      (tenant_id,id,number,opportunity_id,status,overhead_pct,risk_pct,margin_pct,site_overhead_pct,escalation_pct,discount_pct,rounding_step,updated_at)
     VALUES ($1,$2,'CAL-RING-CAP-DEMO',$3,'Goedgekeurd',8,3,6.8,5,0,0,1000,'2026-08-20T09:00:00.000Z')
     ON CONFLICT (tenant_id,id) DO NOTHING`,
    [tenantId, calculationId, opportunityId],
  )
  const inserted = await client.query(
    `INSERT INTO projects
      (tenant_id,id,number,name,organization_id,legal_entity_id,branch_id,source_calculation_id,contract_value,cost_budget,margin_pct,progress,status,handover,work_packages,planning)
     VALUES ($1,$2,'PRJ-RING-NOORD-DEMO','Ringverbinding Noord - capaciteitstest',$3,$4,$5,$6,48500000,45200000,6.8,12,'Risico',$7,$8,$9)
     ON CONFLICT (tenant_id,id) DO NOTHING
     RETURNING id`,
    [
      tenantId,
      DEMO_RESOURCE_CONFLICT_PROJECT_ID,
      DEMO_ORGANIZATION_ID,
      DEMO_LEGAL_ENTITY_ID,
      DEMO_BRANCH_ID,
      calculationId,
      JSON.stringify({
        status: 'Aanvaard',
        projectManager: 'Lena Vermeulen',
        plannedStart: '2026-09-05',
        plannedEnd: '2028-04-30',
        notes: 'Productieproefproject voor het testen van resourceconflicten over meerdere projectplanningen.',
        risks: ['Ploeg Rechteroever is gelijktijdig op Oosterweel ingepland', 'Rupskraan 35t heeft een overlappende reservering'],
        checklist: { scopeReviewed: true, budgetReviewed: true, contractReviewed: true, documentsTransferred: true, risksReviewed: true, kickoffPlanned: true },
        acceptedAt: '2026-08-20T09:00:00.000Z',
      }),
      JSON.stringify([{ id: workPackageId, code: '1', name: 'Grondwerken en tijdelijke infrastructuur', budget: 12_800_000, plannedHours: 28_400, status: 'Klaar voor planning' }]),
      JSON.stringify({ status: 'Baseline', baselineVersion: 1, activities, updatedAt: '2026-08-20T09:00:00.000Z', baselineHistory: [], scenarios: [] }),
    ],
  )
  await client.query(
    `INSERT INTO user_project_access (tenant_id,user_id,project_id)
     SELECT tenant_id,id,$2 FROM users WHERE tenant_id=$1 AND all_projects=false
     ON CONFLICT DO NOTHING`,
    [tenantId, DEMO_RESOURCE_CONFLICT_PROJECT_ID],
  )
  return Boolean(inserted.rowCount)
}

export async function ensureProductionDemoData(pool: Pool, context: RequestContext, storage?: ObjectStorage) {
  if (context.tenantId !== BOUWFLOW_DEMO_TENANT_ID || !context.roles.includes('Administrator')) return false
  if (initializedTenants.has(context.tenantId)) return false

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(
      `INSERT INTO tenants (id,name)
       VALUES ($1,'BouwFlow Demo')
       ON CONFLICT (id) DO NOTHING`,
      [context.tenantId],
    )
    await client.query('SELECT id FROM tenants WHERE id=$1 FOR UPDATE', [context.tenantId])
    const existing = await client.query<{ count: string }>(`SELECT (
      (SELECT count(*) FROM opportunities WHERE tenant_id=$1) +
      (SELECT count(*) FROM calculations WHERE tenant_id=$1) +
      (SELECT count(*) FROM projects WHERE tenant_id=$1)
    )::text AS count`, [context.tenantId])
    const isEmpty = Number(existing.rows[0]?.count ?? 0) === 0
    if (isEmpty) await seedEmptyTenant(client, context.tenantId)
    const expanded = await seedDemoProjectExpansion(client, context.tenantId)
    const dailyProduction = await seedDailyProductionUpgrade(client, context.tenantId)
    const fullEnvironment = await seedFullProductionDemo(client, context.tenantId, storage)
    const resourceConflictProject = await seedResourceConflictProject(client, context.tenantId)
    const calculationVersions = await seedDemoCalculationVersions(client, context.tenantId)
    if (isEmpty || expanded || dailyProduction || fullEnvironment || resourceConflictProject || calculationVersions) await client.query('UPDATE tenants SET data_revision=data_revision+1 WHERE id=$1', [context.tenantId])
    await client.query('COMMIT')
    initializedTenants.add(context.tenantId)
    return isEmpty || expanded || dailyProduction || fullEnvironment || resourceConflictProject || calculationVersions
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export function clearProductionDemoSeedCacheForTests() {
  initializedTenants.clear()
}
