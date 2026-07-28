import App from './App'
import { useAuth } from './auth-context'

export default function Root() {
  const auth = useAuth()
  if (auth.mode === 'entra' && auth.phase !== 'authenticated') {
    return <div className="auth-shell"><div className="auth-card"><div className="auth-mark">BF</div><p>BouwFlow Project ERP</p><h1>{auth.phase === 'initializing' ? 'Beveiligde werkomgeving laden…' : 'Aanmelden bij BouwFlow'}</h1><span>{auth.error ?? 'Gebruik je zakelijke Microsoft-account om verder te gaan.'}</span>{auth.phase !== 'initializing' && <button onClick={() => { void auth.login() }}>Aanmelden met Microsoft</button>}</div></div>
  }
  return <App />
}
