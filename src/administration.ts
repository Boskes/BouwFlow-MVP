import type { Page, WorkflowDefinition } from './domain.js'

export type AccessCapability =
  | 'records.create'
  | 'records.edit'
  | 'records.approve'
  | 'documents.manage'
  | 'daily-reports.create'
  | 'daily-reports.submit'
  | 'daily-reports.sign'
  | 'users.manage'
  | 'workflows.manage'
  | 'portals.manage'

export interface RoleDefinition {
  name: string
  audience: 'Intern' | 'Klantportaal' | 'Onderaannemersportaal' | 'Leveranciersportaal'
  description: string
  capabilities: AccessCapability[]
}

const standard = (name: string, description: string, capabilities: AccessCapability[] = ['records.create', 'records.edit']): RoleDefinition => ({ name, audience: 'Intern', description, capabilities })

export const roleDefinitions: RoleDefinition[] = [
  standard('Administrator', 'Volledig functioneel beheer, gebruikers, workflows en alle dossieracties.', ['records.create','records.edit','records.approve','documents.manage','daily-reports.create','daily-reports.submit','daily-reports.sign','users.manage','workflows.manage','portals.manage']),
  standard('Directie', 'Organisatiebrede inzage en formele goedkeuringen.', ['records.edit','records.approve','documents.manage','users.manage','workflows.manage','portals.manage']),
  standard('Commercieel medewerker', 'CRM, opportuniteiten, offertes en commerciële opvolging.'),
  standard('Calculator', 'Calculaties, kostbibliotheken, scenario’s en offertes.'),
  standard('Tender manager', 'Aanbestedingen, Go/No-Go, offertes en indiening.', ['records.create','records.edit','records.approve','documents.manage']),
  standard('Projectdirecteur', 'Projectportefeuille, budget, contracten en goedkeuringen.', ['records.create','records.edit','records.approve','documents.manage','portals.manage']),
  standard('Projectmanager', 'Projectuitvoering, budget, planning, wijzigingen en dossiers.', ['records.create','records.edit','records.approve','documents.manage','daily-reports.sign','portals.manage']),
  standard('Werkvoorbereider', 'Projectvoorbereiding, planning, inkoop en documenten.', ['records.create','records.edit','documents.manage','daily-reports.create']),
  standard('Planner', 'Project-, ploeg-, materieel- en capaciteitsplanning.'),
  standard('Werfleider', 'Werfregistratie, dagrapporten, uren, foto’s en meerwerken.', ['records.create','records.edit','documents.manage','daily-reports.create','daily-reports.submit']),
  standard('Ploegbaas', 'Dagelijkse ploegregistraties, uren, voortgang en werfmeldingen.', ['records.create','records.edit','daily-reports.create','daily-reports.submit']),
  standard('Arbeider', 'Eigen uren, toegewezen werfinformatie en veiligheidsmeldingen.', ['records.create']),
  standard('Aankoper', 'Leveranciers, prijsaanvragen, bestellingen en contractprijzen.', ['records.create','records.edit','records.approve','documents.manage','portals.manage']),
  standard('Magazijnier', 'Voorraad, ontvangsten, uitgiftes en reservaties.'),
  standard('Financiële administratie', 'Vorderingen, facturen, betalingen en financiële opvolging.', ['records.create','records.edit','records.approve','documents.manage']),
  standard('HR', 'Medewerkers, afwezigheden, functies en personeelsbeschikbaarheid.', ['records.create','records.edit','records.approve']),
  standard('Preventieadviseur', 'QHSE, attesten, controles, incidenten en corrigerende acties.', ['records.create','records.edit','records.approve','documents.manage']),
  standard('Kwaliteitsverantwoordelijke', 'Kwaliteitscontroles, documenten en oplevering.', ['records.create','records.edit','records.approve','documents.manage']),
  { name:'Klant', audience:'Klantportaal', description:'Alleen toegewezen klantdossiers, documenten en goedkeuringen.', capabilities:['records.approve'] },
  { name:'Onderaannemer', audience:'Onderaannemersportaal', description:'Alleen eigen projecten, documenten, medewerkers en prestaties.', capabilities:['records.create','records.edit','documents.manage'] },
  { name:'Leverancier', audience:'Leveranciersportaal', description:'Alleen eigen prijsaanvragen, bestellingen en leveringen.', capabilities:['records.create','records.edit'] },
]

export const roleDefinition = (role: string | undefined) => roleDefinitions.find((item) => item.name === role)
export const canPerform = (role: string | undefined, capability: AccessCapability) => Boolean(roleDefinition(role)?.capabilities.includes(capability))

export const pageLabels: Record<Page, string> = {
  'my-work':'Mijn werk',
  dashboard:'Dashboard', dossiers:'Dossiers', crm:'CRM & Relaties', opportunities:'Opportuniteiten', calculations:'Calculaties', 'cost-library':'Kostbibliotheek', projects:'Projecten', planning:'Planning', hr:'HR & Verlof', resources:'Materieel & Voorraad', site:'Werf', changes:'Meerwerken', financial:'Vorderingen', control:'Projectcontrole', procurement:'Inkoop', cashflow:'Cashflow', 'post-calculation':'Nacalculatie', documents:'Documenten', mailbox:'E-mail', qhse:'QHSE', subcontractors:'Onderaannemers', consortia:'THV & Combinaties', integrations:'ERP-integraties', ai:'AI-assistent', closeout:'Contract & Oplevering', 'client-portal':'Klantportaal', 'subcontractor-portal':'Onderaannemersportaal', 'supplier-portal':'Leveranciersportaal', company:'Bedrijfsstructuur', access:'Instellingen & Beheer', 'entity-finance':'Financiële entiteiten', 'notification-settings':'Peppol-meldingen',
}

const workflow = (id: string, name: string, dossierType: WorkflowDefinition['dossierType'], steps: Array<[string,string,number?]>): WorkflowDefinition => ({
  id, name, dossierType, active:true, updatedAt:new Date().toISOString(),
  steps:steps.map(([label,ownerRole,slaHours],index)=>({id:`${id}-${index+1}`,label,ownerRole,slaHours,required:true})),
})

export const defaultWorkflowDefinitions: WorkflowDefinition[] = [
  workflow('workflow-opportunity','Commerciële tenderflow','opportunity', [['Nieuw','Commercieel medewerker',48],['Gekwalificeerd','Tender manager',72],['Go/No-Go','Directie',48],['Calculatie','Calculator',240],['Offerte verstuurd','Tender manager',24],['Onderhandeling','Commercieel medewerker',168],['Gewonnen','Projectdirecteur']]),
  workflow('workflow-document','Documentgoedkeuring','document', [['Concept','Documentverantwoordelijke',72],['Ter goedkeuring','Projectmanager',48],['Goedgekeurd','Projectmanager']]),
  workflow('workflow-contract','Contractgoedkeuring','contract', [['Concept','Projectmanager',120],['Ter goedkeuring','Projectdirecteur',72],['Goedgekeurd','Projectdirecteur']]),
  workflow('workflow-daily-report','Dagrapport werf','daily-report', [['Concept','Werfleider',12],['Ingediend','Projectmanager',24],['Ondertekend','Opdrachtgever']]),
  workflow('workflow-change-order','Meerwerk en klantgoedkeuring','change-order', [['Vastgesteld','Werfleider',24],['Berekend','Projectmanager',48],['Ter goedkeuring','Opdrachtgever',120],['Goedgekeurd','Projectmanager',24],['Klaar voor facturatie','Financiële administratie',72]]),
  workflow('workflow-progress','Vorderingsstaat','progress-statement', [['Concept','Projectmanager',120],['Ingediend','Opdrachtgever',120],['Goedgekeurd','Financiële administratie',72],['Gefactureerd','Financiële administratie']]),
  workflow('workflow-absence','Verlof en afwezigheid','employee-absence', [['Aangevraagd','HR',48],['Goedgekeurd','HR']]),
  workflow('workflow-time-entry','Tijdsregistratie','time-entry', [['Concept','Medewerker',24],['Ingediend','Projectmanager',48],['Goedgekeurd','Projectmanager']]),
  workflow('workflow-claim','Claim en termijnverlenging','project-claim', [['Concept','Projectmanager',120],['Intern goedgekeurd','Projectdirecteur',72],['Ingediend','Opdrachtgever',240],['Aanvaard','Opdrachtgever']]),
  workflow('workflow-qhse','QHSE-controle','qhse-inspection', [['Open','Preventieadviseur',48],['In behandeling','Werfleider',72],['Gesloten','Preventieadviseur']]),
]

export const workflowFor = (definitions: WorkflowDefinition[] | undefined, dossierType: string) => definitions?.find((item)=>item.active&&item.dossierType===dossierType) ?? defaultWorkflowDefinitions.find((item)=>item.dossierType===dossierType)
