import type { Page } from './domain'

const allInternalRoles = [
  'Administrator', 'Directie', 'Commercieel medewerker', 'Calculator', 'Tender manager',
  'Projectdirecteur', 'Projectmanager', 'Werkvoorbereider', 'Planner', 'Werfleider',
  'Ploegbaas', 'Arbeider', 'Aankoper', 'Magazijnier', 'Financiële administratie',
  'HR', 'Preventieadviseur', 'Kwaliteitsverantwoordelijke',
] as const

const roles = (...values: string[]) => new Set(values)
const operations = ['Administrator', 'Directie', 'Projectdirecteur', 'Projectmanager', 'Werkvoorbereider', 'Planner', 'Werfleider']
const financial = ['Administrator', 'Directie', 'Projectdirecteur', 'Projectmanager', 'Aankoper', 'Financiële administratie']

export const pageRoleAccess: Record<Page, ReadonlySet<string>> = {
  dashboard: roles(...allInternalRoles),
  dossiers: roles(...allInternalRoles),
  crm: roles('Administrator', 'Directie', 'Commercieel medewerker', 'Tender manager', 'Calculator', 'Projectdirecteur'),
  opportunities: roles('Administrator', 'Directie', 'Commercieel medewerker', 'Tender manager', 'Calculator', 'Projectdirecteur'),
  calculations: roles('Administrator', 'Directie', 'Commercieel medewerker', 'Tender manager', 'Calculator', 'Projectdirecteur'),
  'cost-library': roles('Administrator', 'Directie', 'Calculator', 'Aankoper'),
  projects: roles(...operations, 'Calculator', 'Financiële administratie', 'Preventieadviseur', 'Kwaliteitsverantwoordelijke'),
  planning: roles(...operations, 'Ploegbaas'),
  hr: roles('Administrator', 'Directie', 'HR', 'Planner', 'Projectdirecteur', 'Projectmanager', 'Werfleider'),
  resources: roles('Administrator', 'Directie', 'Projectdirecteur', 'Projectmanager', 'Planner', 'Werfleider', 'Aankoper', 'Magazijnier'),
  site: roles('Administrator', 'Directie', 'Projectdirecteur', 'Projectmanager', 'Werkvoorbereider', 'Werfleider', 'Ploegbaas', 'Arbeider'),
  changes: roles('Administrator', 'Directie', 'Projectdirecteur', 'Projectmanager', 'Werkvoorbereider', 'Werfleider', 'Ploegbaas', 'Financiële administratie'),
  financial: roles(...financial),
  control: roles(...financial, 'Calculator'),
  procurement: roles(...financial, 'Werkvoorbereider', 'Magazijnier'),
  cashflow: roles('Administrator', 'Directie', 'Projectdirecteur', 'Projectmanager', 'Financiële administratie'),
  'post-calculation': roles('Administrator', 'Directie', 'Calculator', 'Projectdirecteur', 'Projectmanager', 'Financiële administratie'),
  documents: roles(...operations, 'Calculator', 'Ploegbaas', 'Preventieadviseur', 'Kwaliteitsverantwoordelijke', 'Financiële administratie'),
  qhse: roles('Administrator', 'Directie', 'Projectdirecteur', 'Projectmanager', 'Werkvoorbereider', 'Werfleider', 'Ploegbaas', 'Arbeider', 'Preventieadviseur', 'Kwaliteitsverantwoordelijke'),
  subcontractors: roles('Administrator', 'Directie', 'Projectdirecteur', 'Projectmanager', 'Werkvoorbereider', 'Werfleider', 'Aankoper', 'Preventieadviseur'),
  consortia: roles('Administrator', 'Directie', 'Projectdirecteur', 'Financiële administratie'),
  integrations: roles('Administrator', 'Directie', 'Financiële administratie'),
  ai: roles('Administrator', 'Directie', 'Calculator', 'Projectdirecteur', 'Projectmanager', 'Werkvoorbereider'),
  closeout: roles('Administrator', 'Directie', 'Projectdirecteur', 'Projectmanager', 'Werkvoorbereider', 'Werfleider', 'Kwaliteitsverantwoordelijke'),
  'client-portal': roles('Administrator', 'Directie', 'Projectdirecteur', 'Projectmanager', 'Klant'),
  'subcontractor-portal': roles('Administrator', 'Directie', 'Projectdirecteur', 'Projectmanager', 'Werkvoorbereider', 'Aankoper', 'Onderaannemer'),
  'supplier-portal': roles('Administrator', 'Directie', 'Aankoper', 'Leverancier'),
  company: roles('Administrator', 'Directie', 'Financiële administratie'),
  access: roles('Administrator', 'Directie'),
  'entity-finance': roles('Administrator', 'Directie', 'Financiële administratie'),
  'notification-settings': roles('Administrator', 'Directie', 'Financiële administratie'),
}

export function canAccessPage(role: string | undefined, page: Page) {
  if (!role) return true
  return pageRoleAccess[page].has(role)
}
