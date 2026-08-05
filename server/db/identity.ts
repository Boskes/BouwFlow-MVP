import type { Pool } from 'pg'
import type { RequestContext } from '../context.js'
import { AuthenticationError } from '../auth.js'

interface IdentityRow { id:string; role:string; roles:string[]|string; status:string; entra_object_id:string|null }

function storedRoles(value:string[]|string|undefined,primary:string){
  let roles:string[]=[]
  try{roles=Array.isArray(value)?value:typeof value==='string'?JSON.parse(value) as string[]:[] }catch{roles=[]}
  return [...new Set([primary,...roles.filter(role=>typeof role==='string'&&role.trim())])]
}

async function configuredIdentity(pool:Pick<Pool,'query'>,context:RequestContext){
  const result=await pool.query<IdentityRow>(`SELECT id,role,roles,status,entra_object_id FROM users WHERE tenant_id=$1 AND (entra_object_id=$2 OR lower(email)=lower($3)) ORDER BY CASE WHEN entra_object_id=$2 THEN 0 ELSE 1 END LIMIT 1`,[context.tenantId,context.userId,context.email])
  const profile=result.rows[0]
  if(!profile)return undefined
  if(profile.status==='Geblokkeerd')throw new AuthenticationError('Deze BouwFlow-account is geblokkeerd')
  const primaryRole=profile.entra_object_id===context.userId?(context.roles[0]??profile.role):profile.role
  const roles=profile.entra_object_id===context.userId?[...new Set([primaryRole,...context.roles,...storedRoles(profile.roles,profile.role)])]:storedRoles(profile.roles,primaryRole)
  await pool.query('UPDATE users SET entra_object_id=$3,display_name=$4,email=$5,role=$6,roles=$7,status=CASE WHEN status=\'Uitgenodigd\' THEN \'Actief\' ELSE status END WHERE tenant_id=$1 AND id=$2',[context.tenantId,profile.id,context.userId,context.displayName,context.email,primaryRole,JSON.stringify(roles)])
  context.userId=profile.id
  context.roles=roles
  context.configuredAccess=true
  return profile
}

export async function ensureAuthenticatedIdentity(pool: Pick<Pool, 'query'>, context: RequestContext, tenantName = 'BouwFlow organisatie') {
  await pool.query('INSERT INTO tenants (id,name) VALUES ($1,$2) ON CONFLICT (id) DO NOTHING', [context.tenantId, tenantName])
  if(await configuredIdentity(pool,context))return
  const initialAllLegalEntities = context.roles.some(role => role === 'Administrator' || role === 'Directie')
  await pool.query(`INSERT INTO users (tenant_id,id,entra_object_id,display_name,email,role,roles,all_legal_entities,status,all_projects)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'Actief',true)
    ON CONFLICT (tenant_id,id) DO UPDATE SET entra_object_id=EXCLUDED.entra_object_id,display_name=EXCLUDED.display_name,email=EXCLUDED.email`,
  [context.tenantId, context.userId, context.userId, context.displayName, context.email, context.roles[0] ?? 'Gebruiker',JSON.stringify(context.roles), initialAllLegalEntities])
}

/** Registers a development portal identity without changing an existing internal account. */
export async function ensureExternalPortalIdentity(pool: Pick<Pool, 'query'>, context: RequestContext, tenantName = 'BouwFlow organisatie') {
  await pool.query('INSERT INTO tenants (id,name) VALUES ($1,$2) ON CONFLICT (id) DO NOTHING', [context.tenantId, tenantName])
  if(await configuredIdentity(pool,context))return
  await pool.query(`INSERT INTO users (tenant_id,id,entra_object_id,display_name,email,role,roles,all_legal_entities,status,all_projects)
    VALUES ($1,$2,$3,$4,$5,$6,$7,false,'Actief',false)
    ON CONFLICT (tenant_id,id) DO NOTHING`,
  [context.tenantId, context.userId, context.userId, context.displayName, context.email, context.roles[0] ?? 'Gebruiker',JSON.stringify(context.roles)])
}

export async function loadCompanyAccessScope(pool: Pick<Pool, 'query'>, context: RequestContext) {
  const user = await pool.query<{ all_legal_entities: boolean; all_projects:boolean; role:string; roles:string[]|string; status:string }>('SELECT all_legal_entities,all_projects,role,roles,status FROM users WHERE tenant_id=$1 AND id=$2', [context.tenantId, context.userId])
  if (!user.rowCount) {
    context.allLegalEntities = true
    context.legalEntityIds = []
    return
  }
  context.allLegalEntities = user.rows[0].all_legal_entities
  context.allProjects=user.rows[0].all_projects
  if(context.configuredAccess)context.roles=storedRoles(user.rows[0].roles,user.rows[0].role)
  const access = context.allLegalEntities ? { rows: [] as Array<{ legal_entity_id: string }> } : await pool.query<{ legal_entity_id: string }>('SELECT legal_entity_id FROM user_legal_entity_access WHERE tenant_id=$1 AND user_id=$2', [context.tenantId, context.userId])
  context.legalEntityIds = access.rows.map(row => row.legal_entity_id)
  const projects=context.allProjects?{rows:[] as Array<{project_id:string}>}:await pool.query<{project_id:string}>('SELECT project_id FROM user_project_access WHERE tenant_id=$1 AND user_id=$2',[context.tenantId,context.userId])
  context.projectIds=projects.rows.map(row=>row.project_id)
}
