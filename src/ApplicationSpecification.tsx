import { useMemo, useState } from 'react'
import {
  Activity, ArrowRight, Boxes, Building2, Calculator, CheckCircle2, ChevronRight,
  CloudCog, Database, FileCheck2, Fingerprint, HardHat,
  KeyRound, Layers3, LockKeyhole, Network, Printer, ScanLine, Search,
  ShieldCheck, ShoppingCart, Smartphone, Users, WifiOff,
} from 'lucide-react'

type DeliveryStatus = 'Actief' | 'Configureerbaar' | 'Simulator' | 'In ontwikkeling'
type SpecItem = { title: string; description: string; capabilities: string[]; status?: DeliveryStatus }
type SpecGroup = { id: string; title: string; subtitle: string; icon: typeof Activity; items: SpecItem[] }

const functionalGroups: SpecGroup[] = [
  {
    id: 'commercial', title: 'Commercieel, tender & calculatie', subtitle: 'Van eerste relatie tot ondertekende offerte en projectopstart.', icon: Calculator,
    items: [
      { title: 'CRM & relaties', description: 'Centraal relatiebeeld voor klanten, opdrachtgevers, studiebureaus, leveranciers en partners.', capabilities: ['Organisaties, contacten, adressen en rollen', 'Activiteiten, relaties en communicatiehistoriek', 'Belgische adresvalidatie en ondernemingsgegevens'] },
      { title: 'Opportuniteiten & tenderbeheer', description: 'Gestructureerde tenderwerkruimte met eigenaarschap, deadlines en besluitvorming.', capabilities: ['Go/no-go en erkenningscontrole', 'Tender- en reviewverantwoordelijke', 'Checklist, plaatsbezoek, vragen en indieningsplan'] },
      { title: 'Calculatie & kostbibliotheek', description: 'Professionele raming voor kleine werken tot klasse-8-projecten.', capabilities: ['Hoofdstukken, posten, samengestelde prijzen en formules', 'Scenario’s, versies, risico, toeslagen en marge', 'Excel-meetstaat, BIM/IFC en LiDAR als hoeveelhedenbron', 'Centrale kostbibliotheken en eenhedenconversie'] },
      { title: 'Offertes', description: 'Versiebeheerde offerteflow vanuit een bevroren calculatiesnapshot.', capabilities: ['Interne goedkeuring en geldigheid', 'Verzenden via centrale Microsoft 365-mailbox', 'Openen, herinneren en digitaal ondertekenen', 'Doorstroming naar project bij gunning'] },
    ],
  },
  {
    id: 'delivery', title: 'Project, planning & werfuitvoering', subtitle: 'Operationele sturing van opstart tot dagelijkse uitvoering.', icon: HardHat,
    items: [
      { title: 'Projectbeheer', description: 'Centraal projectdossier met werkpakketten, budget, contractwaarde en verantwoordelijkheden.', capabilities: ['Projectopstart vanuit gunning', 'Entiteit, vestiging, klant en team', 'Werkpakketten, risico’s en overdracht calculatie-uitvoering'] },
      { title: 'Gantt & capaciteitsplanning', description: '4D-planning met afhankelijkheden, resources en baselinebeheer.', capabilities: ['Activiteiten, mijlpalen en kritieke pad', 'Medewerkers, ploegen, materieel en onderaannemers', 'Conflictdetectie, scenario’s en baselineversies', 'Volledig nieuw venster voor intensief plannen'] },
      { title: 'Werfregistratie', description: 'Dagelijkse digitale bewijsvoering voor prestaties en gebeurtenissen.', capabilities: ['Dagrapporten, arbeid, materiaal en machines', 'Foto’s, locatie, leveringen, vertragingen en problemen', 'Werkbonnen, regiewerk en digitale ondertekening', 'Urenregistratie via mobiel, QR, badge, GPS of import'] },
      { title: 'Checkinatwork', description: 'Belgische aanwezigheidsregistratie als controleerbare werfflow.', capabilities: ['Werkplaatsen, deelnemers en identiteitscontrole', 'Registratie, annulatie, ontvangstbewijs en audit', 'Simulatie- en productieomgeving', 'Rollen voor werf, HR, preventie en onderaannemer'], status: 'Configureerbaar' },
    ],
  },
  {
    id: 'bim', title: 'BIM, 3D/4D/5D & LiDAR', subtitle: 'Modelgebaseerd calculeren, plannen, meten en vorderen.', icon: Layers3,
    items: [
      { title: 'IFC-modelviewer', description: 'Webgebaseerde geometrische weergave van IFC-modellen en modelelementen.', capabilities: ['3D-selectie per discipline, categorie, laag en bouwdeel', 'Objecteigenschappen en hoeveelheden', 'Koppeling aan calculatieposten en werkpakketten', 'WebIFC-geometrie, camerasturing en zichtbaarheid'] },
      { title: '4D-planning', description: 'Modelobjecten gekoppeld aan uitvoeringsfasen en tijd.', capabilities: ['Fasekleuring en tijdlijn', 'Gepland tegenover gebouwd', 'Selectie per werkpakket en verdieping', 'Visuele voortgangscontrole'] },
      { title: '5D-kosten', description: 'Hoeveelheden, eenheidsprijzen en fasewaarde rechtstreeks op BIM-objecten.', capabilities: ['Calculatiebedragen per modelselectie', 'Gekoppelde posten en kostendragers', 'Cumulatieve uitvoering en te vorderen waarde', 'Controleerbare bronverwijzing naar element-ID’s'] },
      { title: 'BIM-vorderingen', description: 'Vordering op basis van gemeten objecten en gecombineerde bewijsvoering.', capabilities: ['3D/4D/5D-selectie en voortgangspercentage', 'Vergelijking met nulmeting en vorige vordering', 'Combinatie met dagrapport, foto, manuele controle en keuring', 'Gecertificeerde meetbewijzen en audittrail'] },
    ],
  },
  {
    id: 'finance', title: 'Financiën, inkoop & projectcontrole', subtitle: 'Van verplichting en vordering tot factuur, betaling en nacalculatie.', icon: ShoppingCart,
    items: [
      { title: 'Inkoop', description: 'Aanvraag-tot-bestelling met leveranciersvergelijking en controle.', capabilities: ['Behoefte, prijsaanvraag en offertes', 'Goedkeuringsniveaus op bedrag en rol', 'Bestelbon, ontvangst en leverafwijking', '3-way match met factuur en projectkost'] },
      { title: 'Vorderingsstaten', description: 'Professionele cumulatieve vorderingsflow met bewijs en inhoudingen.', capabilities: ['Handmatig, meetstaat, dagrapport of BIM', 'Automatische meetbroncontrole', 'Voorschot, recuperatie, inhoudingen en meerwerken', 'Goedkeuring, factuurconcept en klantportaal'] },
      { title: 'Prijsherziening', description: 'Contractgestuurde Belgische prijsherzieningsberekening.', capabilities: ['Formule, basisindex en actuele index', 'Loon-, materiaal- en vaste component', 'Automatisch ophalen en bronregistratie', 'Voorlopige/definitieve berekening met waarschuwingen'], status: 'Configureerbaar' },
      { title: 'Facturatie, cashflow & Peppol', description: 'Verkoopfacturen, betaalopvolging en Belgische e-facturatie.', capabilities: ['UBL-export en EN16931/Peppol-validatie', 'Providerlevering, webhook en statusmonitoring', 'E-mail/Teams-escalaties en acceptatiedossier', 'Cashflowprognose en achterstallige posten'], status: 'Configureerbaar' },
      { title: 'Projectcontrole & nacalculatie', description: 'Budget, verplichtingen, werkelijke kosten en eindprognose.', capabilities: ['Budget versus actual en committed cost', 'Estimate at completion en margeprognose', 'Afwijkingsanalyse per werkpakket/categorie', 'Nacalculatie en terugkoppeling kostbibliotheek'] },
    ],
  },
  {
    id: 'organization', title: 'Organisatie, resources & kwaliteit', subtitle: 'Mensen, materieel, documenten en compliance over projecten heen.', icon: Building2,
    items: [
      { title: 'HR, ploegen & verlof', description: 'Medewerkersdossier met planning en goedkeuringsflow.', capabilities: ['Functie, entiteit, vestiging en certificaten', 'Ploegen, beschikbaarheid en afwezigheden', 'Urencontrole en verantwoordelijke-selectie'] },
      { title: 'Materieel, magazijn & voorraad', description: 'Operationeel beheer van assets en materialen.', capabilities: ['Materieelstatus, onderhoud en keuring', 'Magazijnen, voorraad, telling en bewegingen', 'Projectreservatie en beschikbaarheid'] },
      { title: 'QHSE', description: 'Veiligheid, kwaliteit, gezondheid en milieu met opvolging.', capabilities: ['Attesten en vervalbewaking', 'LMRA, toolbox, inspectie en werkvergunning', 'Incidenten, vaststellingen, eigenaar en deadline', 'Bewijsstukken en afsluitcontrole'] },
      { title: 'Documentbeheer', description: 'Versies, revisies, koppelingen, verspreiding en integriteit.', capabilities: ['Project- en dossierkoppelingen', 'Goedkeuringsworkflow en distributielijst', 'SHA-256-integriteitscontrole', 'As-built- en opleverstructuur'] },
      { title: 'Contract & oplevering', description: 'Contractuele verplichtingen, zekerheden, claims en nazorg.', capabilities: ['Contractversies, clausules en risico’s', 'Voorlopige/definitieve oplevering', 'Opleverpunten, garanties en borgvrijgave', 'Digitaal klantakkoord'] },
    ],
  },
  {
    id: 'collaboration', title: 'Samenwerking, portalen & automatisering', subtitle: 'Rolgerichte werkruimtes en communicatie rond ieder dossier.', icon: Users,
    items: [
      { title: 'Persoonlijke dashboards & Mijn werk', description: 'Iedere gebruiker ziet de juiste KPI’s en acties voor zijn profiel.', capabilities: ['Automatische taken uit alle kernworkflows', 'Lijst, board, kalender en teamweergave', 'SLA, delegatie, herinnering en deep links', 'Direct indienen, goedkeuren en ondertekenen'] },
      { title: 'Centrale e-mail', description: 'Microsoft 365-mailbox geïntegreerd in dossiers.', capabilities: ['Inbox synchroniseren, verzenden en antwoorden', 'Koppelen aan relatie, opportuniteit en project', 'E-mailtabs in relevante werkruimtes', 'Centrale afzender en auditbare correlatie'], status: 'Configureerbaar' },
      { title: 'Externe portalen', description: 'Afgeschermde selfservice voor klant, onderaannemer en leverancier.', capabilities: ['Klant: offertes, vorderingen, wijzigingen en oplevering', 'Onderaannemer: documenten, werkbonnen, attesten en prestaties', 'Leverancier: prijsaanvragen, bestellingen en leveringen', 'Project- en relatiegebonden gegevensscope'] },
      { title: 'AI & integraties', description: 'Controleerbare analyses en koppelingen met externe systemen.', capabilities: ['AI-analyse met bronverwijzingen en goedkeuring', 'ERP-integratiejobs en statusregistratie', 'Idempotente API-mutaties en foutopvolging'], status: 'Configureerbaar' },
    ],
  },
]

const iPhoneSteps = [
  ['1', 'Veilig aanmelden', 'Microsoft Entra ID opent via de systeemaanmelding. OAuth 2.0 Authorization Code met PKCE levert een API-token; refresh tokens blijven uitsluitend in de iOS Keychain.'],
  ['2', 'Context kiezen', 'De gebruiker kiest Calculatie-opname, Nulmeting, Vorderingsopname of As-built en selecteert de toegelaten calculatie of het project.'],
  ['3', 'Ruimte scannen', 'RoomPlan herkent wanden, vloeren, deuren, ramen, openingen en volumes. ARKit sceneReconstruction kan aanvullend een gedetailleerde mesh vastleggen.'],
  ['4', 'Verrijken op de werf', 'Elementen worden benoemd en aangevuld met foto’s, opmerkingen, controlepunten en manuele technieken zoals stopcontacten, lichtpunten, kabels, leidingen en toestellen.'],
  ['5', 'Werken koppelen', 'Per gemeten element worden uit te voeren werken, eenheden en hoeveelheden gekozen uit de BouwFlow-catalogus. Hiermee ontstaat een controleerbaar calculatievoorstel.'],
  ['6', 'Offline veilig bewaren', 'Bij wegvallend bereik bewaart de app metadata en bestanden in Application Support. De wachtrij hervat automatisch; toegangstokens worden nooit mee opgeslagen.'],
  ['7', 'Synchroniseren', 'RoomPlan JSON, USDZ, mesh en foto’s worden via de tenantgebonden API verzonden. Grote bestanden blijven afzonderlijke bewijsartefacten.'],
  ['8', 'Menselijke controle', 'In de webapp controleert een calculator, BIM-coördinator of projectleider herkenning, hoeveelheden, classificatie, bewijs en voorgestelde posten.'],
  ['9', 'Doorstromen', 'Na goedkeuring worden posten aan de calculatie toegevoegd. Bij gunning wordt de opname projectnulmeting; latere scans meten afwijking en voortgang tegen die basislijn.'],
]

const architectureLayers = [
  { icon: Smartphone, title: 'Clients', lines: ['React/Vite webapp', 'Native SwiftUI iPhone-app', 'Klant-, onderaannemer- en leveranciersportaal'] },
  { icon: Network, title: 'API-laag', lines: ['Node.js + TypeScript + Fastify', 'REST, multipart bestanden en webhooks', 'Validatie, autorisatie, ETag en idempotency'] },
  { icon: CloudCog, title: 'Domeindiensten', lines: ['Calculatie, workflow en prijsherziening', 'BIM/LiDAR, Checkinatwork en Peppol', 'Microsoft 365-mail en notificaties'] },
  { icon: Database, title: 'Data & bewijs', lines: ['PostgreSQL per tenant', 'Objectopslag voor documenten en scans', 'Auditlog, versies en SHA-256-digests'] },
]

const tenantRules = [
  ['Identiteit', 'Microsoft Entra ID valideert tenant, gebruiker en API-audience. De webapp en iPhone-app gebruiken dezelfde zakelijke identiteit.'],
  ['Tenantisolatie', 'Iedere tabel en API-query wordt begrensd door tenant_id; data van verschillende organisaties wordt niet samengevoegd.'],
  ['Gebruikerskoppeling', 'Bij de eerste geldige login wordt de Entra-identiteit gekoppeld aan een BouwFlow-gebruiker met status, rol en profiel.'],
  ['Autorisatie', 'Rechten combineren rolcapaciteiten met juridische entiteiten, vestigingen, toegewezen projecten en externe relaties.'],
  ['Externe toegang', 'Klant, onderaannemer en leverancier krijgen uitsluitend hun portaal en expliciet gekoppelde dossiers te zien.'],
  ['Sessiebeveiliging', 'Korte access tokens, stille vernieuwing op web, PKCE op iOS en refresh tokens in de Keychain. Geen wachtwoorden in BouwFlow.'],
  ['Controleerbaarheid', 'Statusovergangen, goedkeuringen, exports en correcties worden met gebruiker en tijdstip geaudit.'],
]

const integrations = [
  ['Microsoft Entra ID', 'SSO, tenant users, rollen en API-scopes', 'Actief'],
  ['Microsoft 365 / Graph', 'Centrale mailbox, dossiermail en meldingen', 'Configureerbaar'],
  ['IFC / buildingSMART', 'Modelimport, geometrie, classificatie en hoeveelheden', 'Actief'],
  ['Apple RoomPlan / ARKit', 'Ruimtescan, USDZ, JSON en LiDAR-mesh', 'Actief'],
  ['Peppol BIS Billing 3.0', 'UBL, validatie, accesspoint en ontvangststatus', 'Configureerbaar'],
  ['Checkinatwork / RSZ', 'Werkplaats- en aanwezigheidsregistratie', 'Configureerbaar'],
  ['Belgische indexbronnen', 'Contractuele prijsherziening en bronbewijs', 'Configureerbaar'],
  ['ERP / boekhouding', 'Integratiejobs en gecontroleerde gegevensuitwisseling', 'In ontwikkeling'],
] as Array<[string, string, DeliveryStatus]>

function Status({ value }: { value: DeliveryStatus }) {
  return <span className={`spec-status status-${value.toLowerCase().replace(/\s+/g, '-')}`}>{value}</span>
}

export default function ApplicationSpecification() {
  const [query, setQuery] = useState('')
  const [activeSection, setActiveSection] = useState('overview')
  const normalized = query.trim().toLowerCase()
  const filteredGroups = useMemo(() => functionalGroups.map(group => ({
    ...group,
    items: group.items.filter(item => !normalized || `${group.title} ${group.subtitle} ${item.title} ${item.description} ${item.capabilities.join(' ')}`.toLowerCase().includes(normalized)),
  })).filter(group => group.items.length), [normalized])
  const featureCount = functionalGroups.reduce((sum, group) => sum + group.items.length, 0)
  const capabilityCount = functionalGroups.flatMap(group => group.items).reduce((sum, item) => sum + item.capabilities.length, 0)
  const sections = [['overview', 'Overzicht'], ['functions', 'Functionaliteiten'], ['iphone', 'iPhone BIM & LiDAR'], ['identity', 'Tenant & aanmelden'], ['architecture', 'Technische structuur'], ['integrations', 'Integraties']]
  const jump = (id: string) => { setActiveSection(id); document.getElementById(`spec-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }

  return <div className="application-specification">
    <section className="spec-hero" id="spec-overview">
      <div><p className="eyebrow">Uitgebreid productspecificatieblad</p><h2>BouwFlow platform & BouwFlow Scan</h2><p>Functioneel en technisch overzicht van de webapplicatie, tenantbeveiliging, portalen en de native iPhone-app voor BIM- en LiDAR-opnames.</p><div className="spec-version"><span>Specificatie 2.0</span><span>Bijgewerkt 5 augustus 2026</span><span>Web + API + iOS</span></div></div>
      <div className="spec-hero-actions"><button className="secondary" onClick={() => window.print()}><Printer size={16}/>Afdrukken / PDF</button><div className="spec-search"><Search size={17}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Zoek functionaliteit of techniek…"/></div></div>
    </section>
    <nav className="spec-section-nav" aria-label="Specificatieonderdelen">{sections.map(([id, label]) => <button key={id} className={activeSection === id ? 'active' : ''} onClick={() => jump(id)}>{label}</button>)}</nav>
    <section className="spec-summary-grid">
      <article><strong>{functionalGroups.length}</strong><span>functionele domeinen</span></article>
      <article><strong>{featureCount}</strong><span>kernfunctionaliteiten</span></article>
      <article><strong>{capabilityCount}+</strong><span>gedocumenteerde mogelijkheden</span></article>
      <article><strong>4</strong><span>iPhone-scanmodi</span></article>
      <article><strong>3D · 4D · 5D</strong><span>BIM-keten</span></article>
      <article><strong>1 tenantmodel</strong><span>web, API en iOS</span></article>
    </section>

    <section className="spec-block" id="spec-functions">
      <header><div><p className="eyebrow">Functioneel landschap</p><h3>Wat kan de applicatie?</h3></div><span>{normalized ? `${filteredGroups.reduce((sum, group) => sum + group.items.length, 0)} resultaten voor “${query}”` : 'Van lead tot nazorg in één dossierketen'}</span></header>
      <div className="spec-groups">{filteredGroups.map(group => { const Icon = group.icon; return <section className="spec-group" key={group.id}><div className="spec-group-head"><i><Icon size={20}/></i><div><h4>{group.title}</h4><p>{group.subtitle}</p></div></div><div className="spec-feature-grid">{group.items.map(item => <article key={item.title}><div><h5>{item.title}</h5><Status value={item.status ?? 'Actief'}/></div><p>{item.description}</p><ul>{item.capabilities.map(capability => <li key={capability}><CheckCircle2 size={13}/><span>{capability}</span></li>)}</ul></article>)}</div></section>})}{!filteredGroups.length && <div className="spec-empty"><Search size={28}/><strong>Geen overeenkomst gevonden</strong><span>Probeer een module, proces, rol of technische term.</span></div>}</div>
    </section>

    <section className="spec-block spec-iphone" id="spec-iphone">
      <header><div><p className="eyebrow">Native iOS-client</p><h3>BouwFlow Scan voor iPhone en iPad</h3></div><Status value="Actief"/></header>
      <div className="iphone-intro"><div className="iphone-device"><Smartphone size={50}/><strong>iPhone Pro / iPad Pro</strong><span>iOS 17+ · LiDAR · camera · RoomPlan · ARKit</span></div><div><h4>Van fysieke ruimte naar calculatie en vordering</h4><p>De mobiele app legt niet alleen geometrie vast. Ze combineert scanresultaten met foto’s, benoemde technieken, uit te voeren werken en menselijke controle. Daardoor blijft LiDAR een meetbron—niet een ongecontroleerde beslissing.</p><div className="scan-mode-grid">{['Calculatie-opname','Nulmeting','Vorderingsopname','As-built'].map((mode, index) => <span key={mode}><b>{index + 1}</b>{mode}</span>)}</div></div></div>
      <div className="iphone-flow">{iPhoneSteps.map(([number, title, description]) => <article key={number}><b>{number}</b><div><h4>{title}</h4><p>{description}</p></div>{number !== '9' && <ChevronRight size={17}/>}</article>)}</div>
      <div className="spec-callouts"><article><ScanLine size={22}/><div><strong>Vastgelegde artefacten</strong><span>RoomPlan JSON, USDZ-model, ARKit-mesh, foto’s, meetpunten, observaties en werktoewijzingen.</span></div></article><article><WifiOff size={22}/><div><strong>Werf zonder bereik</strong><span>Duurzame offline wachtrij, hervatbare upload en geen tokens in scanbestanden of UserDefaults.</span></div></article><article><FileCheck2 size={22}/><div><strong>Bewijscombinatie</strong><span>LiDAR + foto + goedgekeurd dagrapport + manuele bevestiging + keuringsdocument.</span></div></article></div>
    </section>

    <section className="spec-block" id="spec-identity">
      <header><div><p className="eyebrow">Identiteit & autorisatie</p><h3>Aanmelden via tenant users</h3></div><div className="identity-badge"><Fingerprint size={17}/>Microsoft Entra ID</div></header>
      <div className="auth-flow"><article><KeyRound size={22}/><div><strong>1. Microsoft-aanmelding</strong><span>Zakelijke tenantgebruiker meldt aan; BouwFlow bewaart geen Microsoft-wachtwoord.</span></div></article><ArrowRight/><article><ShieldCheck size={22}/><div><strong>2. Tokenvalidatie</strong><span>Tenant, issuer, audience, vervaldatum en API-scope worden aan de servergrens gecontroleerd.</span></div></article><ArrowRight/><article><Users size={22}/><div><strong>3. BouwFlow-profiel</strong><span>Entra-identiteit wordt gekoppeld aan rol, entiteiten, projecten en eventueel externe organisatie.</span></div></article><ArrowRight/><article><LockKeyhole size={22}/><div><strong>4. Databereik</strong><span>Elke pagina, actie en API-query past de toegekende scope opnieuw toe.</span></div></article></div>
      <div className="tenant-rule-grid">{tenantRules.map(([title, description]) => <article key={title}><CheckCircle2 size={16}/><div><strong>{title}</strong><p>{description}</p></div></article>)}</div>
      <div className="auth-comparison"><article><h4>Webapplicatie</h4><ul><li>MSAL browser login en stille tokenvernieuwing</li><li>Bearer access token voor de BouwFlow API</li><li>Veilige afmelding en herauthenticatie bij verlopen sessie</li><li>Admin kan demo-profielen gebruiken zonder hun identiteit over te nemen</li></ul></article><article><h4>iPhone-app</h4><ul><li>Systeembrowser via ASWebAuthenticationSession</li><li>Authorization Code + PKCE S256</li><li>API-scope met delegated access_as_user</li><li>Refresh token uitsluitend in iOS Keychain</li></ul></article></div>
    </section>

    <section className="spec-block" id="spec-architecture">
      <header><div><p className="eyebrow">Technische architectuur</p><h3>Opbouw van het platform</h3></div><span>Multi-tenant · API-first · auditbaar</span></header>
      <div className="architecture-flow">{architectureLayers.map((layer, index) => { const Icon = layer.icon; return <div className="architecture-step" key={layer.title}><article><i><Icon size={23}/></i><h4>{layer.title}</h4>{layer.lines.map(line => <span key={line}>{line}</span>)}</article>{index < architectureLayers.length - 1 && <ArrowRight size={20}/>}</div>})}</div>
      <div className="technical-grid">
        <article><h4>Frontend</h4><dl><div><dt>Web</dt><dd>React 19, TypeScript, Vite</dd></div><div><dt>3D</dt><dd>Three.js, WebIFC, IFC WASM</dd></div><div><dt>Mobiel</dt><dd>SwiftUI, RoomPlan, ARKit</dd></div><div><dt>Offline</dt><dd>Tenantgebonden cache en mobiele uploadwachtrij</dd></div></dl></article>
        <article><h4>Backend</h4><dl><div><dt>Runtime</dt><dd>Node.js 22+, Fastify, TypeScript</dd></div><div><dt>Validatie</dt><dd>Zod-schema’s aan de API-grens</dd></div><div><dt>Database</dt><dd>PostgreSQL met tenantgebonden sleutels</dd></div><div><dt>Bestanden</dt><dd>Objectopslag met metadata en digest</dd></div></dl></article>
        <article><h4>Beveiliging & betrouwbaarheid</h4><dl><div><dt>Identity</dt><dd>Entra ID JWT-validatie</dd></div><div><dt>Scope</dt><dd>Rol + entiteit + project + externe relatie</dd></div><div><dt>Mutaties</dt><dd>Idempotency-Key en revisiecontrole</dd></div><div><dt>Audit</dt><dd>Wie, wat, wanneer en statusovergang</dd></div></dl></article>
        <article><h4>Uitrol</h4><dl><div><dt>Broncode</dt><dd>GitHub · Boskes/BouwFlow-MVP</dd></div><div><dt>Productie</dt><dd>Easyhost VPS · aifestival.be</dd></div><div><dt>Webserver</dt><dd>TLS, reverse proxy en API/frontend</dd></div><div><dt>Release</dt><dd>Test, lint, build en gecontroleerde deploy</dd></div></dl></article>
      </div>
      <div className="data-model-strip"><strong>Kerngegevensmodel</strong>{['Tenant','Gebruiker','Entiteit','Relatie','Opportuniteit','Calculatie','Offerte','Project','Werkpakket','Planning','Dagrapport','Document','BIM-element','LiDAR-opname','Vordering','Factuur'].map(label => <span key={label}>{label}</span>)}</div>
    </section>

    <section className="spec-block" id="spec-integrations">
      <header><div><p className="eyebrow">Koppelingen & standaarden</p><h3>Integratiematrix</h3></div><span>Status is afhankelijk van tenantconfiguratie en providercontracten.</span></header>
      <div className="table-wrap"><table className="spec-integration-table"><thead><tr><th>Technologie / dienst</th><th>Gebruik in BouwFlow</th><th>Status</th></tr></thead><tbody>{integrations.map(([name, use, status]) => <tr key={name}><td><strong>{name}</strong></td><td>{use}</td><td><Status value={status}/></td></tr>)}</tbody></table></div>
      <footer className="spec-footer-note"><Boxes size={18}/><div><strong>Levende specificatie</strong><span>Deze pagina hoort bij de applicatie en evolueert mee met nieuwe modules, integraties en mobiele scanmogelijkheden. “Configureerbaar” betekent dat de softwareflow aanwezig is, maar productiegebruik nog tenantgegevens, certificaten of een extern providercontract kan vereisen.</span></div></footer>
    </section>
  </div>
}
