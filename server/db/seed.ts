import type { Pool } from 'pg'
import { DEVELOPMENT_TENANT_ID, DEVELOPMENT_USER_ID } from '../context.js'

export const DEVELOPMENT_LEGAL_ENTITY_ID = '10000000-0000-4000-8200-000000000001'
export const DEVELOPMENT_BRANCH_ID = '10000000-0000-4000-8200-000000000002'
export const DEVELOPMENT_PROJECT_MANAGER_ID = '10000000-0000-4000-8200-000000000003'
export const DEVELOPMENT_FINANCE_USER_ID = '10000000-0000-4000-8200-000000000004'
export const DEVELOPMENT_SERVICE_ENTITY_ID = '10000000-0000-4000-8200-000000000005'
export const DEVELOPMENT_SERVICE_BRANCH_ID = '10000000-0000-4000-8200-000000000006'

const organizations = [
  ['10000000-0000-4000-8000-000000000001', 'Agentschap Wegen en Verkeer', 'Overheid', 'Peter Vrancken', 'peter.vrancken@example.be', 'BE0200000043', 'Koning Albert II-laan 20', '1000', 'Brussel', 'BE', '0200000043', '0208'],
  ['10000000-0000-4000-8000-000000000002', 'Fluvius', 'Nutsbedrijf', 'Annelies Vermeulen', 'annelies.vermeulen@example.be', 'BE0200000142', 'Brusselsesteenweg 199', '9090', 'Melle', 'BE', '0200000142', '0208'],
  ['10000000-0000-4000-8000-000000000003', 'Northgate Logistics', 'Privaat', 'Marc De Smet', 'marc.desmet@example.be', 'BE0200000241', 'Logistieklaan 12', '3600', 'Genk', 'BE', '0200000241', '0208'],
]

const costLibrary = [
  ['10000000-0000-4000-8100-000000000001', 'ARB-001', 'Grondwerker', 'labor', 'uur', 46, 'Interne uurkost 2026'],
  ['10000000-0000-4000-8100-000000000002', 'ARB-002', 'Ploegbaas', 'labor', 'uur', 58, 'Interne uurkost 2026'],
  ['10000000-0000-4000-8100-000000000003', 'MAT-001', 'Steenslag type II', 'material', 'ton', 24.5, 'Raamcontract groeve'],
  ['10000000-0000-4000-8100-000000000004', 'MAT-002', 'Asfalt AB-4C', 'material', 'ton', 91, 'Leveranciersprijs juli 2026'],
  ['10000000-0000-4000-8100-000000000005', 'MCH-001', 'Rupskraan 25 ton', 'equipment', 'uur', 84, 'Intern materieeltarief'],
  ['10000000-0000-4000-8100-000000000006', 'OND-001', 'Markeringen', 'subcontracting', 'm²', 7.5, 'Historische onderaannemersprijs'],
]

export async function seedDevelopmentData(pool: Pick<Pool, 'query'>) {
  await pool.query('INSERT INTO tenants (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING', [DEVELOPMENT_TENANT_ID, 'BouwFlow Demo'])
  await pool.query(`INSERT INTO users (tenant_id, id, display_name, email, role)
    VALUES ($1, $2, $3, $4, $5) ON CONFLICT (tenant_id, id) DO NOTHING`, [DEVELOPMENT_TENANT_ID, DEVELOPMENT_USER_ID, 'Jurgen Bosmans', 'jurgen@example.be', 'Administrator'])
  await pool.query(`INSERT INTO legal_entities (tenant_id,id,name,vat_number,country,currency,active,invoice_prefix,next_invoice_number,default_vat_pct,iban,bic,payment_terms_days,address_line,postal_code,city,country_code,peppol_endpoint_id,peppol_scheme_id)
    VALUES ($1,$2,$3,$4,$5,$6,true,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) ON CONFLICT (tenant_id,id) DO UPDATE SET vat_number=EXCLUDED.vat_number,address_line=EXCLUDED.address_line,postal_code=EXCLUDED.postal_code,city=EXCLUDED.city,country_code=EXCLUDED.country_code,peppol_endpoint_id=EXCLUDED.peppol_endpoint_id,peppol_scheme_id=EXCLUDED.peppol_scheme_id`, [DEVELOPMENT_TENANT_ID, DEVELOPMENT_LEGAL_ENTITY_ID, 'BouwFlow Construct NV', 'BE0123456749', 'België', 'EUR', 'BFC', 1, 21, 'BE68 5390 0754 7034', 'KREDBEBB', 30, 'Industrieweg 42', '3500', 'Hasselt', 'BE', '0123456749', '0208'])
  await pool.query(`INSERT INTO company_branches (tenant_id,id,legal_entity_id,name,address,country)
    VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (tenant_id,id) DO NOTHING`, [DEVELOPMENT_TENANT_ID, DEVELOPMENT_BRANCH_ID, DEVELOPMENT_LEGAL_ENTITY_ID, 'Hasselt', 'Industrieweg 42, 3500 Hasselt', 'België'])
  await pool.query(`INSERT INTO legal_entities (tenant_id,id,name,vat_number,country,currency,active,invoice_prefix,next_invoice_number,default_vat_pct,iban,bic,payment_terms_days,address_line,postal_code,city,country_code,peppol_endpoint_id,peppol_scheme_id)
    VALUES ($1,$2,$3,$4,$5,$6,true,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) ON CONFLICT (tenant_id,id) DO UPDATE SET vat_number=EXCLUDED.vat_number,address_line=EXCLUDED.address_line,postal_code=EXCLUDED.postal_code,city=EXCLUDED.city,country_code=EXCLUDED.country_code,peppol_endpoint_id=EXCLUDED.peppol_endpoint_id,peppol_scheme_id=EXCLUDED.peppol_scheme_id`, [DEVELOPMENT_TENANT_ID, DEVELOPMENT_SERVICE_ENTITY_ID, 'BouwFlow Services NV', 'BE0555666775', 'België', 'EUR', 'BFS', 1, 21, 'BE25 0012 3456 7890', 'GEBABEBB', 30, 'Havenlaan 18', '3600', 'Genk', 'BE', '0555666775', '0208'])
  await pool.query(`INSERT INTO company_branches (tenant_id,id,legal_entity_id,name,address,country)
    VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (tenant_id,id) DO NOTHING`, [DEVELOPMENT_TENANT_ID, DEVELOPMENT_SERVICE_BRANCH_ID, DEVELOPMENT_SERVICE_ENTITY_ID, 'Genk', 'Havenlaan 18, 3600 Genk', 'België'])
  for (const user of [
    [DEVELOPMENT_PROJECT_MANAGER_ID, 'Sofie Peeters', 'sofie@example.be', 'Projectmanager'],
    [DEVELOPMENT_FINANCE_USER_ID, 'Elias Jacobs', 'elias@example.be', 'Financiële administratie'],
  ]) {
    await pool.query(`INSERT INTO users (tenant_id,id,display_name,email,role,all_legal_entities) VALUES ($1,$2,$3,$4,$5,false) ON CONFLICT (tenant_id,id) DO NOTHING`, [DEVELOPMENT_TENANT_ID, ...user])
    await pool.query(`INSERT INTO user_legal_entity_access (tenant_id,user_id,legal_entity_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, [DEVELOPMENT_TENANT_ID, user[0], DEVELOPMENT_LEGAL_ENTITY_ID])
  }
  for (const organization of organizations) {
    await pool.query(`INSERT INTO organizations (tenant_id,id,name,type,contact_name,email,vat_number,address_line,postal_code,city,country_code,peppol_endpoint_id,peppol_scheme_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT (tenant_id,id) DO UPDATE SET vat_number=EXCLUDED.vat_number,address_line=EXCLUDED.address_line,postal_code=EXCLUDED.postal_code,city=EXCLUDED.city,country_code=EXCLUDED.country_code,peppol_endpoint_id=EXCLUDED.peppol_endpoint_id,peppol_scheme_id=EXCLUDED.peppol_scheme_id`, [DEVELOPMENT_TENANT_ID, ...organization])
  }
  for (const item of costLibrary) {
    await pool.query(`INSERT INTO cost_library_items (tenant_id, id, code, name, category, unit, unit_cost, source)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (tenant_id, id) DO NOTHING`, [DEVELOPMENT_TENANT_ID, ...item])
  }
}
