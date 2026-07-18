import { useMemo, useState } from 'react'
import {
  Building2, Calculator, ClipboardList, FileText, HardHat, LayoutDashboard,
  Search, Settings, Users, Plus, ArrowUpRight, AlertTriangle, CheckCircle2,
  Clock3, Euro, FolderKanban, Menu, X
} from 'lucide-react'
import './App.css'

type Page = 'dashboard' | 'crm' | 'opportunities' | 'calculations' | 'projects'

const nav = [
  { id: 'dashboard' as Page, label: 'Dashboard', icon: LayoutDashboard },
  { id: 'crm' as Page, label: 'CRM & Relaties', icon: Users },
  { id: 'opportunities' as Page, label: 'Opportuniteiten', icon: ClipboardList },
  { id: 'calculations' as Page, label: 'Calculaties', icon: Calculator },
  { id: 'projects' as Page, label: 'Projecten', icon: FolderKanban },
]

const opportunities = [
  { name: 'Herinrichting N72 – fase 2', client: 'Agentschap Wegen en Verkeer', value: 2850000, stage: 'Calculatie', due: '24 jul 2026', chance: 55 },
  { name: 'Nieuw logistiek centrum Genk', client: 'Northgate Logistics', value: 1640000, stage: 'Offerte verstuurd', due: '30 jul 2026', chance: 70 },
  { name: 'Rioleringswerken Beringen', client: 'Fluvius', value: 920000, stage: 'Go/No-Go', due: '5 aug 2026', chance: 35 },
  { name: 'Renovatie schoolcampus Hasselt', client: 'Stad Hasselt', value: 1180000, stage: 'Onderhandeling', due: '18 jul 2026', chance: 80 },
]

const projects = [
  { name: 'Fietssnelweg F74', pm: 'Sofie Janssens', progress: 68, budget: 4100000, margin: 8.4, status: 'Op schema' },
  { name: 'Bedrijvenpark Tessenderlo', pm: 'Tom Peeters', progress: 42, budget: 2350000, margin: 5.9, status: 'Risico' },
  { name: 'Brugrenovatie Albertkanaal', pm: 'Nadia El Amrani', progress: 81, budget: 5200000, margin: 10.1, status: 'Op schema' },
]

const customers = [
  { company: 'Agentschap Wegen en Verkeer', contact: 'Peter Vrancken', type: 'Overheid', open: 2, turnover: '€ 7,2 mln' },
  { company: 'Fluvius', contact: 'Annelies Vermeulen', type: 'Nutsbedrijf', open: 1, turnover: '€ 2,9 mln' },
  { company: 'Northgate Logistics', contact: 'Marc De Smet', type: 'Privaat', open: 1, turnover: '€ 1,6 mln' },
  { company: 'Stad Hasselt', contact: 'Evelien Claes', type: 'Overheid', open: 3, turnover: '€ 4,1 mln' },
]

function money(value: number) {
  return new Intl.NumberFormat('nl-BE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value)
}

function App() {
  const [page, setPage] = useState<Page>('dashboard')
  const [query, setQuery] = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)

  const filteredOpportunities = useMemo(() => opportunities.filter(o => `${o.name} ${o.client}`.toLowerCase().includes(query.toLowerCase())), [query])

  const title = nav.find(n => n.id === page)?.label ?? 'Dashboard'

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-mark"><HardHat size={22} /></div>
          <div><strong>BouwFlow</strong><span>Project ERP</span></div>
          <button className="mobile-close" onClick={() => setMobileOpen(false)}><X size={20}/></button>
        </div>
        <nav>
          {nav.map(item => {
            const Icon = item.icon
            return <button key={item.id} className={page === item.id ? 'active' : ''} onClick={() => { setPage(item.id); setMobileOpen(false) }}>
              <Icon size={19}/><span>{item.label}</span>
            </button>
          })}
        </nav>
        <div className="sidebar-bottom">
          <button><FileText size={19}/>Documenten</button>
          <button><Settings size={19}/>Instellingen</button>
          <div className="user-card"><div className="avatar">JB</div><div><strong>Jurgen Bosmans</strong><span>Administrator</span></div></div>
        </div>
      </aside>

      <main>
        <header className="topbar">
          <button className="menu-button" onClick={() => setMobileOpen(true)}><Menu size={22}/></button>
          <div><p className="eyebrow">Bouw- en infrastructuurbeheer</p><h1>{title}</h1></div>
          <div className="top-actions">
            <div className="search"><Search size={18}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Zoeken..." /></div>
            <button className="primary"><Plus size={18}/>Nieuw</button>
          </div>
        </header>

        <section className="content">
          {page === 'dashboard' && <Dashboard />}
          {page === 'crm' && <CRM />}
          {page === 'opportunities' && <Opportunities items={filteredOpportunities} />}
          {page === 'calculations' && <Calculations />}
          {page === 'projects' && <Projects />}
        </section>
      </main>
    </div>
  )
}

function Dashboard() {
  return <>
    <div className="kpi-grid">
      <Kpi icon={Euro} label="Gewogen pipeline" value="€ 4,82 mln" trend="+12,4% deze maand" />
      <Kpi icon={Building2} label="Actieve projecten" value="12" trend="3 in aanbesteding" />
      <Kpi icon={Calculator} label="Open calculaties" value="7" trend="€ 6,59 mln totaal" />
      <Kpi icon={AlertTriangle} label="Projecten met risico" value="2" trend="Actie vereist" warning />
    </div>

    <div className="grid-two">
      <section className="panel">
        <div className="panel-head"><div><p className="eyebrow">Commercieel</p><h2>Actieve opportuniteiten</h2></div><button>Alles bekijken <ArrowUpRight size={16}/></button></div>
        <div className="table-wrap"><table><thead><tr><th>Project</th><th>Fase</th><th>Waarde</th><th>Kans</th></tr></thead><tbody>
          {opportunities.slice(0,4).map(o => <tr key={o.name}><td><strong>{o.name}</strong><span>{o.client}</span></td><td><Badge text={o.stage}/></td><td>{money(o.value)}</td><td><div className="chance"><span style={{width: `${o.chance}%`}}></span></div><small>{o.chance}%</small></td></tr>)}
        </tbody></table></div>
      </section>

      <section className="panel activity-panel">
        <div className="panel-head"><div><p className="eyebrow">Vandaag</p><h2>Aandachtspunten</h2></div></div>
        <Activity icon={Clock3} title="Deadline offerte schoolcampus" text="Vandaag om 16:00" />
        <Activity icon={AlertTriangle} title="Marge-afwijking Tessenderlo" text="Verwachte marge daalde van 7,2% naar 5,9%" warning />
        <Activity icon={CheckCircle2} title="Vorderingsstaat goedgekeurd" text="Fietssnelweg F74 – € 284.500" />
        <Activity icon={FileText} title="Nieuw plan ontvangen" text="Brugrenovatie – revisie C" />
      </section>
    </div>

    <section className="panel">
      <div className="panel-head"><div><p className="eyebrow">Uitvoering</p><h2>Projectportfolio</h2></div><button>Projecten openen <ArrowUpRight size={16}/></button></div>
      <div className="project-cards">{projects.map(p => <ProjectCard key={p.name} project={p}/>)}</div>
    </section>
  </>
}

function CRM() {
  return <section className="panel"><div className="panel-head"><div><p className="eyebrow">Relatiebeheer</p><h2>Klanten en opdrachtgevers</h2></div><button className="primary"><Plus size={17}/>Relatie toevoegen</button></div>
    <div className="table-wrap"><table><thead><tr><th>Organisatie</th><th>Contactpersoon</th><th>Type</th><th>Open dossiers</th><th>Historische omzet</th></tr></thead><tbody>
      {customers.map(c => <tr key={c.company}><td><strong>{c.company}</strong></td><td>{c.contact}</td><td><Badge text={c.type}/></td><td>{c.open}</td><td>{c.turnover}</td></tr>)}
    </tbody></table></div>
  </section>
}

function Opportunities({items}:{items: typeof opportunities}) {
  return <section className="panel"><div className="panel-head"><div><p className="eyebrow">Pipeline</p><h2>Aanbestedingen en offertes</h2></div><button className="primary"><Plus size={17}/>Nieuwe opportuniteit</button></div>
    <div className="table-wrap"><table><thead><tr><th>Project</th><th>Opdrachtgever</th><th>Fase</th><th>Deadline</th><th>Waarde</th><th>Winkans</th></tr></thead><tbody>
      {items.map(o => <tr key={o.name}><td><strong>{o.name}</strong></td><td>{o.client}</td><td><Badge text={o.stage}/></td><td>{o.due}</td><td>{money(o.value)}</td><td>{o.chance}%</td></tr>)}
    </tbody></table></div>
  </section>
}

function Calculations() {
  const rows = [
    ['CAL-2026-041','Herinrichting N72 – fase 2','€ 2.850.000','In opmaak','24 jul 2026'],
    ['CAL-2026-039','Rioleringswerken Beringen','€ 920.000','Review','5 aug 2026'],
    ['CAL-2026-037','Nieuw logistiek centrum Genk','€ 1.640.000','Goedgekeurd','30 jul 2026'],
  ]
  return <><div className="kpi-grid compact"><Kpi icon={Calculator} label="Totale calculatiewaarde" value="€ 6,59 mln" trend="7 open dossiers"/><Kpi icon={Euro} label="Gemiddelde brutomarge" value="11,8%" trend="Doelstelling 10%"/><Kpi icon={Clock3} label="Eerstvolgende deadline" value="6 dagen" trend="N72 – fase 2"/></div>
    <section className="panel"><div className="panel-head"><div><p className="eyebrow">Kostprijs</p><h2>Calculatiedossiers</h2></div><button className="primary"><Plus size={17}/>Nieuwe calculatie</button></div><div className="table-wrap"><table><thead><tr><th>Nummer</th><th>Project</th><th>Verkoopwaarde</th><th>Status</th><th>Deadline</th></tr></thead><tbody>
      {rows.map(r => <tr key={r[0]}><td><strong>{r[0]}</strong></td><td>{r[1]}</td><td>{r[2]}</td><td><Badge text={r[3]}/></td><td>{r[4]}</td></tr>)}
    </tbody></table></div></section></>
}

function Projects() {
  return <section className="panel"><div className="panel-head"><div><p className="eyebrow">Projectcontrole</p><h2>Lopende projecten</h2></div><button className="primary"><Plus size={17}/>Project toevoegen</button></div><div className="project-cards expanded">{projects.map(p => <ProjectCard key={p.name} project={p}/>)}</div></section>
}

function Kpi({icon:Icon,label,value,trend,warning=false}:any){return <div className={`kpi ${warning?'warning':''}`}><div className="kpi-icon"><Icon size={21}/></div><div><span>{label}</span><strong>{value}</strong><small>{trend}</small></div></div>}
function Badge({text}:{text:string}){return <span className="badge">{text}</span>}
function Activity({icon:Icon,title,text,warning=false}:any){return <div className={`activity ${warning?'warning':''}`}><div><Icon size={18}/></div><p><strong>{title}</strong><span>{text}</span></p></div>}
function ProjectCard({project:p}:{project: typeof projects[number]}){return <article className="project-card"><div className="project-top"><div><span>Project</span><h3>{p.name}</h3></div><Badge text={p.status}/></div><div className="meta"><span>Projectmanager</span><strong>{p.pm}</strong></div><div className="progress-label"><span>Voortgang</span><strong>{p.progress}%</strong></div><div className="progress"><span style={{width:`${p.progress}%`}}></span></div><div className="project-footer"><div><span>Budget</span><strong>{money(p.budget)}</strong></div><div><span>Prognosemarge</span><strong>{p.margin}%</strong></div></div></article>}

export default App
