export interface EntraClientConfig {
  clientId: string
  tenantId: string
  apiScope: string
  redirectUri: string
}

export function readEntraClientConfig(environment: Record<string, string | undefined>, origin: string): EntraClientConfig | undefined {
  const clientId = environment.VITE_ENTRA_CLIENT_ID?.trim()
  const tenantId = environment.VITE_ENTRA_TENANT_ID?.trim()
  const apiScope = environment.VITE_ENTRA_API_SCOPE?.trim()
  if (!clientId && !tenantId && !apiScope) return undefined
  if (!clientId || !tenantId || !apiScope) throw new Error('VITE_ENTRA_CLIENT_ID, VITE_ENTRA_TENANT_ID en VITE_ENTRA_API_SCOPE moeten samen worden ingesteld')
  return { clientId, tenantId, apiScope, redirectUri: environment.VITE_ENTRA_REDIRECT_URI?.trim() || origin }
}
