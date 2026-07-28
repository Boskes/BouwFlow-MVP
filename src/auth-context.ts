import { createContext, useContext } from 'react'

export interface AuthContextValue {
  mode: 'development' | 'entra'
  phase: 'initializing' | 'authenticated' | 'unauthenticated' | 'error'
  accountName: string
  accountUsername?: string
  error?: string
  login: () => Promise<void>
  logout: () => Promise<void>
  getAccessToken: () => Promise<string | undefined>
}

export const developmentAuth: AuthContextValue = {
  mode: 'development', phase: 'authenticated', accountName: 'Jurgen Bosmans', accountUsername: 'Lokale ontwikkelaar',
  login: async () => undefined, logout: async () => undefined, getAccessToken: async () => undefined,
}

export const AuthContext = createContext<AuthContextValue>(developmentAuth)
export const useAuth = () => useContext(AuthContext)
