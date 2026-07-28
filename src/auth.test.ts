import { describe, expect, it } from 'vitest'
import { readEntraClientConfig } from './auth-config'

describe('Entra clientconfiguratie', () => {
  it('laat lokale ontwikkelmodus toe zonder Entra-variabelen', () => {
    expect(readEntraClientConfig({}, 'http://localhost:5173')).toBeUndefined()
  })

  it('bouwt een tenantgebonden configuratie', () => {
    expect(readEntraClientConfig({
      VITE_ENTRA_CLIENT_ID: 'spa-client',
      VITE_ENTRA_TENANT_ID: 'tenant-id',
      VITE_ENTRA_API_SCOPE: 'api://bouwflow-api/access_as_user',
    }, 'https://bouwflow.example')).toEqual({
      clientId: 'spa-client', tenantId: 'tenant-id', apiScope: 'api://bouwflow-api/access_as_user', redirectUri: 'https://bouwflow.example',
    })
  })

  it('weigert een gedeeltelijke beveiligingsconfiguratie', () => {
    expect(() => readEntraClientConfig({ VITE_ENTRA_CLIENT_ID: 'spa-client' }, 'https://bouwflow.example')).toThrow(/moeten samen/)
  })
})
