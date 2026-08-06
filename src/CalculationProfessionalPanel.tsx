import { useMemo, useState } from 'react'
import { AlertTriangle, ArrowLeft, ArrowRight, Boxes, CalendarDays, CheckCircle2, CircleUserRound, FolderKanban, GitCompareArrows, History, ScanLine, ShieldCheck } from 'lucide-react'
import type { BoqChapter, BoqItem, Calculation, CompanyUser, Project, ProgressStatement } from './domain'
import { boqItemQuantity, directCost, grossMargin, sellingTotal, unitCost } from './domain'
import { calculationChapterSummaries, calculationQualityIssues } from './calculation-professional'

export type CalculationWorkspaceMode = 'explorer' | 'packages' | 'focus' | 'bim' | 'review'
type WorkflowStatus = NonNullable<BoqItem['workflowStatus']>

const money = new Intl.NumberFormat('nl-BE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
const number = new Intl.NumberFormat('nl-BE', { maximumFractionDigits: 2 })
const statuses: WorkflowStatus[] = ['Niet gestart', 'In bewerking', 'Ter controle', 'Goedgekeurd']

interface Props {
  mode: Exclude<CalculationWorkspaceMode, 'explorer'>
  calculation: Calculation
  project?: Project
  progressStatements: ProgressStatement[]
  users: CompanyUser[]
  versionCount: number
  scenarioCount: number
  initialChapterId?: string
  onOpenItem: (item: BoqItem) => void
  onUpdateItem: (item: BoqItem, patch: Partial<BoqItem>) => void
  onUpdateChapter: (chapter: BoqChapter, patch: Partial<BoqChapter>) => void
  onFocusChapter: (chapterId: string) => void
  onOpenBim: () => void
  onOpenLidar: () => void
  onCaptureVersion: () => void
  onCompareVersions: () => void
}

export default function CalculationProfessionalPanel(props: Props) {
  if (props.mode === 'packages') return <WorkPackageBoard {...props}/>
  if (props.mode === 'focus') return <FocusMode {...props}/>
  if (props.mode === 'bim') return <BimFiveDMode {...props}/>
  return <ReviewCockpit {...props}/>
}

function WorkPackageBoard(props: Props) {
  const summaries = useMemo(() => calculationChapterSummaries(props.calculation), [props.calculation])
  return <section className="calculation-professional-body package-board" aria-label="Calculatie per werkpakket">
    <header className="professional-mode-intro"><div><span>Tenderflow en samenwerking</span><h3>Werkpakketbord</h3><p>Verdeel hoofdstukken over het team en volg ze van voorbereiding tot goedkeuring.</p></div><strong>{summaries.length} pakketten · {money.format(directCost(props.calculation))}</strong></header>
    <div className="package-board-grid">
      {statuses.map(status => {
        const packages = summaries.filter(summary => (summary.chapter.workflowStatus ?? 'Niet gestart') === status)
        return <section className="package-column" key={status} aria-label={status}>
          <header><span>{status}</span><b>{packages.length}</b></header>
          <div>{packages.map(summary => {
            const owner = props.users.find(user => user.id === summary.chapter.responsibleUserId)
            const completion = summary.items.length ? Math.round(summary.completedItems / summary.items.length * 100) : 0
            return <article className="package-card" key={summary.chapter.id}>
              <button type="button" className="package-card-title" onClick={() => props.onFocusChapter(summary.chapter.id)}><span>{summary.chapter.code}</span><strong>{summary.chapter.name}</strong></button>
              <div className="package-card-owner"><CircleUserRound size={14}/><span>{owner?.displayName ?? 'Niet toegewezen'}</span></div>
              <div className="package-card-progress"><span style={{ width: `${completion}%` }}/></div>
              <div className="package-card-metrics"><span>{summary.items.length} posten</span><span>{summary.integrationCount} gekoppeld</span><strong>{money.format(summary.directCost)}</strong></div>
              <label>Status<select value={summary.chapter.workflowStatus ?? 'Niet gestart'} onChange={event => props.onUpdateChapter(summary.chapter, { workflowStatus: event.target.value as WorkflowStatus })}>{statuses.map(value => <option key={value}>{value}</option>)}</select></label>
            </article>
          })}{!packages.length && <div className="package-column-empty">Geen pakketten</div>}</div>
        </section>
      })}
    </div>
  </section>
}

function FocusMode(props: Props) {
  const chapters = useMemo(() => {
    const ordered = [...props.calculation.chapters].sort((left, right) => left.sortOrder - right.sortOrder)
    const withPosts = ordered.filter(chapter => props.calculation.items.some(item => item.chapterId === chapter.id))
    return withPosts.length ? withPosts : ordered
  }, [props.calculation.chapters, props.calculation.items])
  const preferredChapterId = props.initialChapterId && chapters.some(chapter => chapter.id === props.initialChapterId) ? props.initialChapterId : chapters[0]?.id
  const [chapterId, setChapterId] = useState(preferredChapterId ?? '')
  const activeIndex = Math.max(0, chapters.findIndex(chapter => chapter.id === chapterId))
  const chapter = chapters[activeIndex]
  const items = useMemo(() => props.calculation.items.filter(item => item.chapterId === chapter?.id).sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0)), [chapter?.id, props.calculation.items])
  const chapterDirectCost = items.reduce((sum, item) => sum + boqItemQuantity(item) * unitCost(item), 0)
  const approval = items.length ? Math.round(items.filter(item => item.workflowStatus === 'Goedgekeurd').length / items.length * 100) : 0
  const issues = items.filter(item => unitCost(item) <= 0 || boqItemQuantity(item) <= 0 || (item.workflowStatus === 'Ter controle' && !item.responsibleUserId))
  const go = (offset: number) => { const next = chapters[activeIndex + offset]; if (next) setChapterId(next.id) }
  if (!chapter) return <div className="calculation-professional-empty">Voeg eerst een hoofdstuk toe om de focusmodus te gebruiken.</div>
  return <section className="calculation-professional-body focus-workspace" aria-label="Calculatie focusmodus">
    <header className="professional-mode-intro"><div><span>Snel en gecontroleerd begroten</span><h3>Focusmodus</h3><p>Werk één hoofdstuk volledig af. Wijzigingen worden automatisch opgeslagen wanneer je een veld verlaat.</p></div><div className="focus-nav"><button type="button" disabled={activeIndex === 0} onClick={() => go(-1)}><ArrowLeft size={15}/>Vorige</button><select aria-label="Hoofdstuk kiezen" value={chapter.id} onChange={event => setChapterId(event.target.value)}>{chapters.map(item => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select><button type="button" disabled={activeIndex === chapters.length - 1} onClick={() => go(1)}>Volgende<ArrowRight size={15}/></button></div></header>
    <div className="focus-layout">
      <section className="focus-sheet"><header><span>Post</span><span>Omschrijving</span><span>Hoeveelheid</span><span>Eenheid</span><span>Eenheidskost</span><span>Status</span><span/></header>{items.map(item => <div className={unitCost(item) <= 0 ? 'focus-row has-issue' : 'focus-row'} key={item.id}>
        <b>{item.code}</b>
        <input aria-label={`Omschrijving ${item.code}`} defaultValue={item.description} onBlur={event => { if (event.target.value !== item.description) props.onUpdateItem(item, { description: event.target.value }) }}/>
        <input aria-label={`Hoeveelheid ${item.code}`} type="number" min="0" step="0.01" defaultValue={boqItemQuantity(item)} onBlur={event => { const value = Number(event.target.value); if (value !== boqItemQuantity(item)) props.onUpdateItem(item, { quantity: value }) }}/>
        <input aria-label={`Eenheid ${item.code}`} defaultValue={item.unit} onBlur={event => { if (event.target.value !== item.unit) props.onUpdateItem(item, { unit: event.target.value }) }}/>
        <strong>{money.format(unitCost(item))}</strong>
        <select aria-label={`Status ${item.code}`} value={item.workflowStatus ?? 'Niet gestart'} onChange={event => props.onUpdateItem(item, { workflowStatus: event.target.value as WorkflowStatus })}>{statuses.map(value => <option key={value}>{value}</option>)}</select>
        <button type="button" onClick={() => props.onOpenItem(item)}>Details</button>
      </div>)}{!items.length && <div className="calculation-professional-empty">Dit hoofdstuk bevat nog geen posten.</div>}</section>
      <aside className="focus-summary"><header><span>{chapter.code}</span><strong>{chapter.name}</strong></header><dl><div><dt>Directe kost</dt><dd>{money.format(chapterDirectCost)}</dd></div><div><dt>Posten</dt><dd>{items.length}</dd></div><div><dt>Goedgekeurd</dt><dd>{approval}%</dd></div><div><dt>Controles nodig</dt><dd>{issues.length}</dd></div></dl>{issues.length > 0 ? <div className="focus-warning"><AlertTriangle size={16}/><span>{issues.length} post{issues.length === 1 ? '' : 'en'} vragen nog aandacht.</span></div> : <div className="focus-complete"><CheckCircle2 size={16}/><span>Dit hoofdstuk is calculatief volledig.</span></div>}</aside>
    </div>
  </section>
}

function BimFiveDMode(props: Props) {
  const bimItems = props.calculation.items.filter(item => item.bimElementIds?.length)
  const lidarItems = props.calculation.items.filter(item => item.lidarScanIds?.length)
  const plannedItems = props.calculation.items.filter(item => item.planningActivityId)
  const workPackageItems = props.calculation.items.filter(item => item.workPackageId)
  const linkedCost = bimItems.reduce((sum, item) => sum + boqItemQuantity(item) * unitCost(item), 0)
  const progressCount = props.progressStatements.length
  const groups = calculationChapterSummaries(props.calculation).filter(summary => summary.items.some(item => item.bimElementIds?.length)).slice(0, 8)
  return <section className="calculation-professional-body bim-five-d" aria-label="BIM 5D calculatie">
    <header className="professional-mode-intro"><div><span>Modelgestuurde calculatie</span><h3>BIM 3D · 4D · 5D</h3><p>Van modelelement en LiDAR-meting naar hoeveelheid, planning, kost en vordering.</p></div><div className="professional-actions"><button type="button" onClick={props.onOpenLidar}><ScanLine size={16}/>LiDAR-opname</button><button className="primary-action" type="button" onClick={props.onOpenBim}><Boxes size={16}/>BIM-werkruimte openen</button></div></header>
    <div className="bim-five-d-layout">
      <section className="bim-link-visual"><div className="bim-link-stage"><span>3D</span><strong>{bimItems.reduce((sum, item) => sum + (item.bimElementIds?.length ?? 0), 0)}</strong><small>modelelementen</small></div><ArrowRight/><div className="bim-link-stage"><span>4D</span><strong>{plannedItems.length}</strong><small>geplande posten</small></div><ArrowRight/><div className="bim-link-stage"><span>5D</span><strong>{money.format(linkedCost)}</strong><small>gekoppelde kost</small></div><ArrowRight/><div className="bim-link-stage"><span>Vordering</span><strong>{progressCount}</strong><small>vorderingsstaten</small></div></section>
      <aside className="bim-link-summary"><header><strong>Dekkingsgraad</strong><span>{props.calculation.items.length} calculatieposten</span></header><dl><div><dt><Boxes size={14}/>BIM</dt><dd>{bimItems.length}</dd></div><div><dt><ScanLine size={14}/>LiDAR</dt><dd>{lidarItems.length}</dd></div><div><dt><CalendarDays size={14}/>Planning</dt><dd>{plannedItems.length}</dd></div><div><dt><FolderKanban size={14}/>Werkpakket</dt><dd>{workPackageItems.length}</dd></div></dl></aside>
    </div>
    <section className="bim-chapter-links"><header><span>Gekoppelde hoofdstukken</span><strong>Model → meetstaat</strong></header>{groups.map(summary => <button type="button" key={summary.chapter.id} onClick={() => props.onFocusChapter(summary.chapter.id)}><span><b>{summary.chapter.code}</b><strong>{summary.chapter.name}</strong><small>{summary.integrationCount} gekoppelde posten</small></span><em>{money.format(summary.directCost)}</em><ArrowRight size={15}/></button>)}{!groups.length && <div className="calculation-professional-empty">Open de BIM-werkruimte om modelelementen aan calculatieposten te koppelen.</div>}</section>
  </section>
}

function ReviewCockpit(props: Props) {
  const issues = calculationQualityIssues(props.calculation)
  const summaries = calculationChapterSummaries(props.calculation).sort((left, right) => right.directCost - left.directCost)
  const maximum = Math.max(1, ...summaries.map(summary => summary.directCost))
  const approved = props.calculation.items.filter(item => item.workflowStatus === 'Goedgekeurd').length
  const approvedPct = props.calculation.items.length ? Math.round(approved / props.calculation.items.length * 100) : 0
  return <section className="calculation-professional-body review-cockpit" aria-label="Calculatie reviewcockpit">
    <header className="professional-mode-intro"><div><span>Controle en akkoord</span><h3>Reviewcockpit</h3><p>Controleer prijsdekking, verantwoordelijkheid, risico en versies vóór de offerte.</p></div><div className="professional-actions"><button type="button" disabled={!props.versionCount} onClick={props.onCompareVersions}><GitCompareArrows size={16}/>Versies vergelijken</button><button className="primary-action" type="button" onClick={props.onCaptureVersion}><History size={16}/>Versie vastleggen</button></div></header>
    <div className="review-kpis"><article><span>Verkoopwaarde</span><strong>{money.format(sellingTotal(props.calculation))}</strong><small>{money.format(directCost(props.calculation))} directe kost</small></article><article><span>Brutomarge</span><strong>{money.format(grossMargin(props.calculation))}</strong><small>{number.format(props.calculation.marginPct)}% doelmarge</small></article><article><span>Goedkeuringsgraad</span><strong>{approvedPct}%</strong><small>{approved} van {props.calculation.items.length} posten</small></article><article className={issues.some(issue => issue.severity === 'Blokkerend') ? 'risk' : 'ready'}><span>Reviewstatus</span><strong>{issues.filter(issue => issue.severity === 'Blokkerend').length} blokkeringen</strong><small>{issues.length} aandachtspunten totaal</small></article></div>
    <div className="review-layout"><section className="review-cost-distribution"><header><strong>Kostenverdeling per hoofdstuk</strong><span>{summaries.length} hoofdstukken</span></header>{summaries.slice(0, 12).map(summary => <button type="button" key={summary.chapter.id} onClick={() => props.onFocusChapter(summary.chapter.id)}><span>{summary.chapter.code} · {summary.chapter.name}</span><i><em style={{ width: `${Math.max(2, summary.directCost / maximum * 100)}%` }}/></i><strong>{money.format(summary.directCost)}</strong></button>)}</section><aside className="review-issues"><header><strong>Aandachtspunten</strong><span>{props.versionCount} versies · {props.scenarioCount} scenario's</span></header>{issues.slice(0, 10).map(issue => <button type="button" className={`severity-${issue.severity.toLocaleLowerCase()}`} key={issue.id} onClick={() => { const item = props.calculation.items.find(candidate => candidate.id === issue.itemId); if (item) props.onOpenItem(item); else if (issue.chapterId) props.onFocusChapter(issue.chapterId) }}><AlertTriangle size={15}/><span><strong>{issue.title}</strong><small>{issue.detail}</small></span></button>)}{!issues.length && <div className="review-ready"><ShieldCheck size={24}/><strong>Klaar voor formele review</strong><span>Alle automatische calculatiecontroles zijn geslaagd.</span></div>}</aside></div>
  </section>
}
