import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { newDb } from 'pg-mem'
import type { Pool } from 'pg'
import { ensureAuthenticatedIdentity } from './identity.js'
import { migrate } from './migration.js'

describe('Entra first-login-provisioning', () => {
  let pool: Pool

  beforeEach(async () => {
    const database = newDb({ autoCreateForeignKeyIndices: true })
    pool = new (database.adapters.createPg().Pool)() as unknown as Pool
    await migrate(pool)
  })

  afterEach(async () => pool.end())

  it('maakt een tenantgebonden gebruiker aan en werkt profielgegevens bij', async () => {
    const context = { tenantId: '30000000-0000-4000-8000-000000000001', userId: '30000000-0000-4000-8000-000000000002', displayName: 'Entra Gebruiker', email: 'gebruiker@example.be', roles: ['Calculator'] }
    await ensureAuthenticatedIdentity(pool, context, 'Aannemer NV')
    await ensureAuthenticatedIdentity(pool, { ...context, displayName: 'Nieuwe Naam', roles: ['Tender manager'] }, 'Aannemer NV')

    const tenant = await pool.query('SELECT name FROM tenants WHERE id=$1', [context.tenantId])
    const user = await pool.query('SELECT display_name,email,role,all_legal_entities FROM users WHERE tenant_id=$1 AND id=$2', [context.tenantId, context.userId])
    expect(tenant.rows[0].name).toBe('Aannemer NV')
    expect(user.rows[0]).toMatchObject({ display_name: 'Nieuwe Naam', email: 'gebruiker@example.be', role: 'Tender manager', all_legal_entities: false })
  })

  it('geeft alleen een eerste administrator standaard toegang tot alle entiteiten', async () => {
    const context = { tenantId: '30000000-0000-4000-8000-000000000011', userId: '30000000-0000-4000-8000-000000000012', displayName: 'Entra Admin', email: 'admin@example.be', roles: ['Administrator'] }
    await ensureAuthenticatedIdentity(pool, context, 'Aannemer NV')
    const user = await pool.query('SELECT all_legal_entities FROM users WHERE tenant_id=$1 AND id=$2', [context.tenantId, context.userId])
    expect(user.rows[0].all_legal_entities).toBe(true)
  })
})
