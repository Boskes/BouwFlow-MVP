import { describe, expect, it } from 'vitest'
import { canAccessPage } from './permissions'

describe('rolgebonden modulenavigatie', () => {
  it('geeft een calculator calculatie maar geen HR- of toegangsbeheer', () => {
    expect(canAccessPage('Calculator', 'calculations')).toBe(true)
    expect(canAccessPage('Calculator', 'dossiers')).toBe(true)
    expect(canAccessPage('Calculator', 'hr')).toBe(false)
    expect(canAccessPage('Calculator', 'access')).toBe(false)
  })

  it('beperkt een arbeider tot de operationele werfmodules', () => {
    expect(canAccessPage('Arbeider', 'dashboard')).toBe(true)
    expect(canAccessPage('Arbeider', 'dossiers')).toBe(true)
    expect(canAccessPage('Arbeider', 'site')).toBe(true)
    expect(canAccessPage('Arbeider', 'qhse')).toBe(true)
    expect(canAccessPage('Arbeider', 'cashflow')).toBe(false)
  })

  it('laat een beheerder alle gecontroleerde modules openen', () => {
    expect(canAccessPage('Administrator', 'access')).toBe(true)
    expect(canAccessPage('Administrator', 'entity-finance')).toBe(true)
  })

  it('scheidt externe portalen strikt per externe rol', () => {
    expect(canAccessPage('Klant', 'dashboard')).toBe(true)
    expect(canAccessPage('Klant', 'my-work')).toBe(true)
    expect(canAccessPage('Klant', 'client-portal')).toBe(true)
    expect(canAccessPage('Klant', 'supplier-portal')).toBe(false)
    expect(canAccessPage('Onderaannemer', 'subcontractor-portal')).toBe(true)
    expect(canAccessPage('Onderaannemer', 'client-portal')).toBe(false)
    expect(canAccessPage('Leverancier', 'supplier-portal')).toBe(true)
    expect(canAccessPage('Leverancier', 'subcontractor-portal')).toBe(false)
  })
})
