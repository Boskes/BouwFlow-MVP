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

    const [calculations, chapters, items, projects] = await Promise.all([
      pool.query<{ count: string }>('SELECT count(*)::text AS count FROM calculations WHERE tenant_id=$1', [BOUWFLOW_DEMO_TENANT_ID]),
      pool.query<{ count: string }>('SELECT count(*)::text AS count FROM boq_chapters WHERE tenant_id=$1', [BOUWFLOW_DEMO_TENANT_ID]),
      pool.query<{ count: string }>('SELECT count(*)::text AS count FROM boq_items WHERE tenant_id=$1', [BOUWFLOW_DEMO_TENANT_ID]),
      pool.query<{ count: string }>('SELECT count(*)::text AS count FROM projects WHERE tenant_id=$1', [BOUWFLOW_DEMO_TENANT_ID]),
    ])

    expect(calculations.rows[0].count).toBe('1')
    expect(chapters.rows[0].count).toBe('180')
    expect(items.rows[0].count).toBe('2000')
    expect(projects.rows[0].count).toBe('1')
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
