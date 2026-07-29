import { beforeEach, describe, expect, it } from 'vitest'
import { newDb } from 'pg-mem'
import type { Pool } from 'pg'
import type { RequestContext } from '../context.js'
import { migrate } from './migration.js'
import {
  BOUWFLOW_DEMO_TENANT_ID,
  clearProductionDemoSeedCacheForTests,
  ensureProductionDemoData,
} from './production-demo-seed.js'

const adminContext: RequestContext = {
  tenantId: BOUWFLOW_DEMO_TENANT_ID,
  userId: '30000000-0000-4000-8000-000000000001',
  displayName: 'Test Administrator',
  email: 'admin@example.be',
  roles: ['Administrator'],
}

describe('production demo seed', () => {
  let pool: Pool

  beforeEach(async () => {
    clearProductionDemoSeedCacheForTests()
    const database = newDb({ autoCreateForeignKeyIndices: true })
    const adapter = database.adapters.createPg()
    pool = new adapter.Pool() as unknown as Pool
    await migrate(pool)
    await pool.query('INSERT INTO tenants (id,name) VALUES ($1,$2)', [BOUWFLOW_DEMO_TENANT_ID, 'Bosis'])
  })

  it('vult de lege BouwFlow-tenant met de klasse 8-calculatie en een project', async () => {
    await expect(ensureProductionDemoData(pool, adminContext)).resolves.toBe(true)

    const [calculations, chapters, items, projects, reports, costs, changes, forecasts, pipeline, users, documents, quotes, statements, invoices, orders, certificates, blueprint, tender] = await Promise.all([
      pool.query<{ count: string }>('SELECT count(*)::text AS count FROM calculations WHERE tenant_id=$1', [BOUWFLOW_DEMO_TENANT_ID]),
      pool.query<{ count: string }>('SELECT count(*)::text AS count FROM boq_chapters WHERE tenant_id=$1', [BOUWFLOW_DEMO_TENANT_ID]),
      pool.query<{ count: string }>('SELECT count(*)::text AS count FROM boq_items WHERE tenant_id=$1', [BOUWFLOW_DEMO_TENANT_ID]),
      pool.query<{ count: string }>('SELECT count(*)::text AS count FROM projects WHERE tenant_id=$1', [BOUWFLOW_DEMO_TENANT_ID]),
      pool.query<{ count: string }>('SELECT count(*)::text AS count FROM daily_reports WHERE tenant_id=$1', [BOUWFLOW_DEMO_TENANT_ID]),
      pool.query<{ count: string }>('SELECT count(*)::text AS count FROM project_costs WHERE tenant_id=$1', [BOUWFLOW_DEMO_TENANT_ID]),
      pool.query<{ count: string }>('SELECT count(*)::text AS count FROM change_orders WHERE tenant_id=$1', [BOUWFLOW_DEMO_TENANT_ID]),
      pool.query<{ count: string }>('SELECT count(*)::text AS count FROM project_forecasts WHERE tenant_id=$1', [BOUWFLOW_DEMO_TENANT_ID]),
      pool.query<{ count: string }>('SELECT count(*)::text AS count FROM opportunities WHERE tenant_id=$1', [BOUWFLOW_DEMO_TENANT_ID]),
      pool.query<{ count: string }>("SELECT count(*)::text AS count FROM users WHERE tenant_id=$1 AND email LIKE '%@demo.aifestival.be'", [BOUWFLOW_DEMO_TENANT_ID]),
      pool.query<{ count: string }>('SELECT count(*)::text AS count FROM documents WHERE tenant_id=$1', [BOUWFLOW_DEMO_TENANT_ID]),
      pool.query<{ count: string }>('SELECT count(*)::text AS count FROM quotes WHERE tenant_id=$1', [BOUWFLOW_DEMO_TENANT_ID]),
      pool.query<{ count: string }>('SELECT count(*)::text AS count FROM progress_statements WHERE tenant_id=$1', [BOUWFLOW_DEMO_TENANT_ID]),
      pool.query<{ count: string }>('SELECT count(*)::text AS count FROM sales_invoices WHERE tenant_id=$1', [BOUWFLOW_DEMO_TENANT_ID]),
      pool.query<{ count: string }>('SELECT count(*)::text AS count FROM purchase_orders WHERE tenant_id=$1', [BOUWFLOW_DEMO_TENANT_ID]),
      pool.query<{ count: string }>('SELECT count(*)::text AS count FROM qhse_certificates WHERE tenant_id=$1', [BOUWFLOW_DEMO_TENANT_ID]),
      pool.query<{ employees: unknown; subcontractors: unknown; work_tickets: unknown; project_contracts: unknown }>('SELECT employees,subcontractors,work_tickets,project_contracts FROM blueprint_state WHERE tenant_id=$1', [BOUWFLOW_DEMO_TENANT_ID]),
      pool.query<{ tender: unknown }>('SELECT tender FROM opportunities WHERE tenant_id=$1 AND id=$2', [BOUWFLOW_DEMO_TENANT_ID, '20000000-0000-4000-8000-000000000002']),
    ])

    expect(calculations.rows[0].count).toBe('1')
    expect(chapters.rows[0].count).toBe('180')
    expect(items.rows[0].count).toBe('2000')
    expect(projects.rows[0].count).toBe('1')
    expect(reports.rows[0].count).toBe('3')
    expect(costs.rows[0].count).toBe('7')
    expect(changes.rows[0].count).toBe('2')
    expect(forecasts.rows[0].count).toBe('2')
    expect(pipeline.rows[0].count).toBe('4')
    expect(users.rows[0].count).toBe('10')
    expect(documents.rows[0].count).toBe('5')
    expect(quotes.rows[0].count).toBe('1')
    expect(statements.rows[0].count).toBe('2')
    expect(invoices.rows[0].count).toBe('1')
    expect(orders.rows[0].count).toBe('1')
    expect(certificates.rows[0].count).toBe('2')
    expect(blueprint.rows[0]).toMatchObject({
      employees: expect.arrayContaining([expect.objectContaining({ role: 'Tender manager' }), expect.objectContaining({ role: 'Werfleider' })]),
      subcontractors: [expect.objectContaining({ name: 'Delta Infra NV', progressClaims: expect.any(Array) })],
      work_tickets: expect.arrayContaining([expect.objectContaining({ status: 'Ter ondertekening' })]),
      project_contracts: [expect.objectContaining({ approvalStatus: 'Goedgekeurd' })],
    })
    expect(tender.rows[0].tender).toMatchObject({
      submissionPlan: expect.objectContaining({ ownerEmployeeId: expect.any(String), reviewerEmployeeId: expect.any(String) }),
      requiredDocumentIds: expect.any(Array),
      siteVisits: expect.any(Array),
    })
  }, 15_000)

  it('blijft idempotent na een procesherstart en dupliceert de kerncalculatie niet', async () => {
    await expect(ensureProductionDemoData(pool, adminContext)).resolves.toBe(true)
    clearProductionDemoSeedCacheForTests()

    await expect(ensureProductionDemoData(pool, adminContext)).resolves.toBe(false)

    const [reports, calculations] = await Promise.all([
      pool.query<{ count: string }>('SELECT count(*)::text AS count FROM daily_reports WHERE tenant_id=$1', [BOUWFLOW_DEMO_TENANT_ID]),
      pool.query<{ count: string }>("SELECT count(*)::text AS count FROM calculations WHERE tenant_id=$1 AND number='CAL-DEMO-OWV-RO'", [BOUWFLOW_DEMO_TENANT_ID]),
    ])
    expect(reports.rows[0].count).toBe('3')
    expect(calculations.rows[0].count).toBe('1')
  }, 15_000)

  it('behoudt een bestaande offerteversie en vult de overige demo-omgeving verder aan', async () => {
    await expect(ensureProductionDemoData(pool, adminContext)).resolves.toBe(true)
    await pool.query(
      `UPDATE quotes
          SET id='30000000-0000-4000-8000-000000000088'
        WHERE tenant_id=$1 AND calculation_id='20000000-0000-4000-8000-000000000003' AND version=1`,
      [BOUWFLOW_DEMO_TENANT_ID],
    )
    await pool.query(
      "DELETE FROM users WHERE tenant_id=$1 AND email='tessa.vermeulen@demo.aifestival.be'",
      [BOUWFLOW_DEMO_TENANT_ID],
    )
    clearProductionDemoSeedCacheForTests()

    await expect(ensureProductionDemoData(pool, adminContext)).resolves.toBe(true)

    const [quotes, users] = await Promise.all([
      pool.query<{ id: string }>(
        `SELECT id FROM quotes
          WHERE tenant_id=$1 AND calculation_id='20000000-0000-4000-8000-000000000003' AND version=1`,
        [BOUWFLOW_DEMO_TENANT_ID],
      ),
      pool.query<{ count: string }>(
        "SELECT count(*)::text AS count FROM users WHERE tenant_id=$1 AND email LIKE '%@demo.aifestival.be'",
        [BOUWFLOW_DEMO_TENANT_ID],
      ),
    ])
    expect(quotes.rows).toEqual([{ id: '30000000-0000-4000-8000-000000000088' }])
    expect(users.rows[0].count).toBe('10')
  }, 15_000)

  it('slaat een tenant met bestaande bedrijfsdata volledig over', async () => {
    await pool.query(`INSERT INTO organizations
      (tenant_id,id,name,type,contact_name,email)
      VALUES ($1,'30000000-0000-4000-8000-000000000002','Bestaande klant','Privaat','Test','test@example.be')`, [BOUWFLOW_DEMO_TENANT_ID])
    await pool.query(`INSERT INTO opportunities
      (tenant_id,id,project_number,title,organization_id,location,deadline,estimated_value,probability,stage)
      VALUES ($1,'30000000-0000-4000-8000-000000000003','BESTAAND-001','Bestaand dossier','30000000-0000-4000-8000-000000000002','Gent','2027-01-01',100000,25,'Nieuw')`, [BOUWFLOW_DEMO_TENANT_ID])

    await expect(ensureProductionDemoData(pool, adminContext)).resolves.toBe(false)
    const demo = await pool.query<{ count: string }>("SELECT count(*)::text AS count FROM calculations WHERE tenant_id=$1 AND number='CAL-DEMO-OWV-RO'", [BOUWFLOW_DEMO_TENANT_ID])
    expect(demo.rows[0].count).toBe('0')
  })

  it('doet niets voor andere tenants of niet-beheerders', async () => {
    await expect(ensureProductionDemoData(pool, { ...adminContext, roles: ['Calculator'] })).resolves.toBe(false)
    await expect(ensureProductionDemoData(pool, { ...adminContext, tenantId: '30000000-0000-4000-8000-000000000004' })).resolves.toBe(false)
  })
})
