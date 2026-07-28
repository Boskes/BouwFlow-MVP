export interface RequestContext {
  tenantId: string
  userId: string
  displayName: string
  email: string
  roles: string[]
  allLegalEntities?: boolean
  legalEntityIds?: string[]
  allProjects?: boolean
  projectIds?: string[]
  configuredAccess?: boolean
}

export const DEVELOPMENT_TENANT_ID = '00000000-0000-4000-8000-000000000001'
export const DEVELOPMENT_USER_ID = '00000000-0000-4000-8000-000000000002'
