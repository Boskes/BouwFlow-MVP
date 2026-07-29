import { createHash } from 'node:crypto'
import type { Pool, PoolClient } from 'pg'
import type { RequestContext } from '../context.js'
import { buildOosterweelClass8DemoCalculation } from '../../src/class8-demo-calculation.js'

export const BOUWFLOW_DEMO_TENANT_ID = '07ef58e4-80e9-412d-9eae-1402bd8688f9'

const DEMO_LEGAL_ENTITY_ID = '20000000-0000-4000-8200-000000000001'
const DEMO_BRANCH_ID = '20000000-0000-4000-8200-000000000002'
const DEMO_ORGANIZATION_ID = '20000000-0000-4000-8000-000000000001'
const DEMO_OPPORTUNITY_ID = '20000000-0000-4000-8000-000000000002'
const DEMO_CALCULATION_ID = '20000000-0000-4000-8000-000000000003'
const DEMO_PROJECT_ID = '20000000-0000-4000-8000-000000000004'
const DEFAULT_COST_LIBRARY_VERSION_ID = '00000000-0000-4000-8000-000000000102'

const initializedTenants = new Set<string>()

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

  await client.query('UPDATE tenants SET data_revision=data_revision+1 WHERE id=$1', [tenantId])
}

export async function ensureProductionDemoData(pool: Pool, context: RequestContext) {
  if (context.tenantId !== BOUWFLOW_DEMO_TENANT_ID || !context.roles.includes('Administrator')) return false
  if (initializedTenants.has(context.tenantId)) return false

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('SELECT id FROM tenants WHERE id=$1 FOR UPDATE', [context.tenantId])
    const existing = await client.query<{ count: string }>(`SELECT (
      (SELECT count(*) FROM opportunities WHERE tenant_id=$1) +
      (SELECT count(*) FROM calculations WHERE tenant_id=$1) +
      (SELECT count(*) FROM projects WHERE tenant_id=$1)
    )::text AS count`, [context.tenantId])
    const isEmpty = Number(existing.rows[0]?.count ?? 0) === 0
    if (isEmpty) await seedEmptyTenant(client, context.tenantId)
    await client.query('COMMIT')
    initializedTenants.add(context.tenantId)
    return isEmpty
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
