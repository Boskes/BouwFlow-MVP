import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { InteractionRequiredAuthError, PublicClientApplication, type AccountInfo } from '@azure/msal-browser'
import { AuthContext, developmentAuth, type AuthContextValue } from './auth-context'
import { readEntraClientConfig } from './auth-config'

export function AuthProvider({ children }: { children: ReactNode }) {
  const configResult = useMemo(() => {
    try {
      return { config: readEntraClientConfig(import.meta.env, window.location.origin) }
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Ongeldige Entra ID-configuratie' }
    }
  }, [])
  const [account, setAccount] = useState<AccountInfo>()
  const [phase, setPhase] = useState<AuthContextValue['phase']>(configResult.config ? 'initializing' : configResult.error ? 'error' : 'authenticated')
  const [error, setError] = useState(configResult.error)
  const instance = useRef<PublicClientApplication | undefined>(undefined)

  useEffect(() => {
    const config = configResult.config
    if (!config) return
    let active = true
    const initialize = async () => {
      try {
        const client = new PublicClientApplication({
          auth: { clientId: config.clientId, authority: `https://login.microsoftonline.com/${config.tenantId}`, redirectUri: config.redirectUri, postLogoutRedirectUri: config.redirectUri },
          cache: { cacheLocation: 'sessionStorage' },
        })
        await client.initialize()
        const redirectResult = await client.handleRedirectPromise()
        const selected = redirectResult?.account ?? client.getActiveAccount() ?? client.getAllAccounts()[0]
        if (!active) return
        instance.current = client
        if (selected) {
          client.setActiveAccount(selected)
          setAccount(selected)
          setPhase('authenticated')
        } else {
          setPhase('unauthenticated')
        }
      } catch (initializationError) {
        if (!active) return
        setError(initializationError instanceof Error ? initializationError.message : 'Microsoft-login kon niet worden gestart')
        setPhase('error')
      }
    }
    void initialize()
    return () => { active = false }
  }, [configResult.config])

  const login = useCallback(async () => {
    if (!instance.current || !configResult.config) return
    setError(undefined)
    try {
      await instance.current.loginRedirect({
        scopes: [configResult.config.apiScope],
        prompt: 'select_account',
        domainHint: configResult.config.domainHint,
      })
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Aanmelden is mislukt')
      setPhase('unauthenticated')
    }
  }, [configResult.config])

  const logout = useCallback(async () => {
    if (!instance.current) return
    await instance.current.logoutRedirect({ account })
  }, [account])

  const getAccessToken = useCallback(async () => {
    if (!instance.current || !account || !configResult.config) return undefined
    try {
      return (await instance.current.acquireTokenSilent({ account, scopes: [configResult.config.apiScope] })).accessToken
    } catch (tokenError) {
      if (tokenError instanceof InteractionRequiredAuthError) {
        setError('Je Microsoft-sessie is verlopen. Meld je opnieuw aan.')
        setPhase('unauthenticated')
      }
      throw tokenError
    }
  }, [account, configResult.config])

  const value = useMemo<AuthContextValue>(() => configResult.config ? {
    mode: 'entra', phase, accountName: account?.name ?? 'Microsoft-gebruiker', accountUsername: account?.username, error,
    login, logout, getAccessToken,
  } : configResult.error ? {
    mode: 'entra', phase: 'error', accountName: '', error: configResult.error, login, logout, getAccessToken,
  } : developmentAuth, [account, configResult, error, getAccessToken, login, logout, phase])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
