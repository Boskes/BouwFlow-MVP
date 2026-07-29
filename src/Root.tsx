import { Component, Suspense, lazy, type ReactNode } from 'react'
import { useAuth } from './auth-context'

const App = lazy(() => import('./App'))

class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (this.state.failed) return <div className="auth-shell"><div className="auth-card"><div className="auth-mark">BF</div><p>BouwFlow Project ERP</p><h1>Scherm kon niet worden geladen</h1><span>De sessiegegevens blijven bewaard. Herlaad de applicatie om verder te gaan.</span><button onClick={() => window.location.reload()}>BouwFlow herladen</button></div></div>
    return this.props.children
  }
}

export default function Root() {
  const auth = useAuth()
  if (auth.mode === 'entra' && auth.phase !== 'authenticated') {
    return <div className="auth-shell"><div className="auth-card"><div className="auth-mark">BF</div><p>BouwFlow Project ERP</p><h1>{auth.phase === 'initializing' ? 'Beveiligde werkomgeving laden…' : 'Aanmelden bij BouwFlow'}</h1><span>{auth.error ?? 'Gebruik je zakelijke Microsoft-account om verder te gaan.'}</span>{auth.phase !== 'initializing' && <button onClick={() => { void auth.login() }}>Aanmelden met Microsoft</button>}</div></div>
  }
  return <AppErrorBoundary><Suspense fallback={<div className="auth-shell"><div className="auth-card"><div className="auth-mark">BF</div><p>BouwFlow Project ERP</p><h1>Werkruimte laden…</h1></div></div>}><App /></Suspense></AppErrorBoundary>
}
