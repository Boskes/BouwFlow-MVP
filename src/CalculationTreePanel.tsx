import { useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent } from 'react'
import { Boxes, CalendarDays, Check, ChevronDown, ChevronRight, CircleUserRound, Ellipsis, FolderKanban, GitCompareArrows, ScanLine, Search, SquareStack, Workflow } from 'lucide-react'
import type { BoqChapter, BoqItem, Calculation, CompanyUser, Project, ProgressStatement } from './domain'
import { buildCalculationTree, filterCalculationTree, flattenCalculationTree, nodeDescendantItemIds, type CalculationTreeIntegration, type CalculationTreeNode } from './calculation-tree'

const money = new Intl.NumberFormat('nl-BE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
const rowHeight = 38
const integrationIcons: Record<CalculationTreeIntegration, typeof Boxes> = { BIM: Boxes, LiDAR: ScanLine, Planning: CalendarDays, Werkpakket: FolderKanban, Vordering: Workflow }
const statuses: NonNullable<BoqItem['workflowStatus']>[] = ['Niet gestart', 'In bewerking', 'Ter controle', 'Goedgekeurd']

interface Props {
  calculation: Calculation
  project?: Project
  progressStatements: ProgressStatement[]
  users: CompanyUser[]
  versionCount: number
  scenarioCount: number
  selectedItemIds: ReadonlySet<string>
  activeNodeId: string
  onActiveNodeChange: (node: CalculationTreeNode) => void
  onSelectionChange: (ids: Set<string>) => void
  onOpenItem: (item: BoqItem) => void
  onAddSubchapter: (parent: BoqChapter) => void
  onUpdateChapter: (chapter: BoqChapter, patch: Partial<BoqChapter>) => void
  onUpdateItem: (item: BoqItem, patch: Partial<BoqItem>) => void
  onMoveItem: (itemId: string, chapterId: string | null) => void
  onMoveChapter: (chapterId: string, parentChapterId: string | null) => void
  onOpenIntegration: (integration: CalculationTreeIntegration) => void
}

export default function CalculationTreePanel(props: Props) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [integration, setIntegration] = useState('')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set(['root', ...props.calculation.chapters.slice(0, props.calculation.items.length > 500 ? 12 : 80).map(chapter => `chapter:${chapter.id}`)]))
  const [scrollTop, setScrollTop] = useState(0)
  const [height, setHeight] = useState(620)
  const viewportRef = useRef<HTMLDivElement>(null)
  const root = useMemo(() => buildCalculationTree(props.calculation, { project: props.project, progressStatements: props.progressStatements }), [props.calculation, props.progressStatements, props.project])
  const filtered = useMemo(() => filterCalculationTree(root, query, status, integration), [integration, query, root, status])
  const effectiveExpanded = useMemo(() => query || status || integration ? new Set(flattenAllIds(filtered)) : expandedIds, [expandedIds, filtered, integration, query, status])
  const nodes = useMemo(() => flattenCalculationTree(filtered, effectiveExpanded), [effectiveExpanded, filtered])
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - 8)
  const count = Math.ceil(height / rowHeight) + 16
  const visibleNodes = nodes.slice(start, start + count)

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(entries => setHeight(entries[0]?.contentRect.height ?? 620))
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [])

  const toggleExpanded = (node: CalculationTreeNode) => setExpandedIds(current => {
    const next = new Set(current)
    if (next.has(node.id)) next.delete(node.id); else next.add(node.id)
    return next
  })
  const toggleSelection = (node: CalculationTreeNode, checked: boolean) => {
    const ids = nodeDescendantItemIds(node)
    const next = new Set(props.selectedItemIds)
    ids.forEach(id => checked ? next.add(id) : next.delete(id))
    props.onSelectionChange(next)
  }
  const activate = (node: CalculationTreeNode) => {
    props.onActiveNodeChange(node)
    if (node.item) document.getElementById(`boq-item-${node.item.id}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = Math.max(0, nodes.findIndex(node => node.id === props.activeNodeId))
    const current = nodes[index] ?? nodes[0]
    if (!current) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      activate(nodes[Math.max(0, Math.min(nodes.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))])
    } else if (event.key === 'ArrowRight' && current.children.length) {
      event.preventDefault(); setExpandedIds(value => new Set(value).add(current.id))
    } else if (event.key === 'ArrowLeft' && current.children.length) {
      event.preventDefault(); setExpandedIds(value => { const next = new Set(value); next.delete(current.id); return next })
    } else if (event.key === 'Enter') {
      event.preventDefault(); if (current.item) props.onOpenItem(current.item); else toggleExpanded(current)
    } else if (event.key === ' ') {
      event.preventDefault(); toggleSelection(current, !nodeDescendantItemIds(current).every(id => props.selectedItemIds.has(id)))
    }
  }
  const expandAll = () => setExpandedIds(new Set(flattenAllIds(root)))

  return <section className="calculation-tree-panel" aria-label="Calculatiestructuur">
    <header className="calculation-tree-header">
      <div><span>Calculatieboom</span><strong>{root.itemCount} posten · {money.format(root.directCost)}</strong><small><GitCompareArrows size={12}/>{props.versionCount} versies · {props.scenarioCount} scenario's</small></div>
      <div><button type="button" onClick={expandAll}>Alles open</button><button type="button" onClick={() => setExpandedIds(new Set(['root']))}>Inklappen</button></div>
    </header>
    <div className="calculation-tree-filters">
      <label><Search size={14}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Zoek code of omschrijving"/></label>
      <select aria-label="Filter op status" value={status} onChange={event => setStatus(event.target.value)}><option value="">Alle statussen</option>{statuses.map(value => <option key={value}>{value}</option>)}</select>
      <select aria-label="Filter op koppeling" value={integration} onChange={event => setIntegration(event.target.value)}><option value="">Alle koppelingen</option>{Object.keys(integrationIcons).map(value => <option key={value}>{value}</option>)}</select>
    </div>
    <div className="calculation-tree-columns"><span>Structuur</span><span>Koppelingen</span><span>Bedrag</span></div>
    <div ref={viewportRef} className="calculation-tree-viewport" role="tree" tabIndex={0} onKeyDown={onKeyDown} onScroll={event => setScrollTop(event.currentTarget.scrollTop)}>
      <div style={{ height: nodes.length * rowHeight, position: 'relative' }}>
        {visibleNodes.map((node, visibleIndex) => <TreeRow
          key={node.id}
          node={node}
          top={(start + visibleIndex) * rowHeight}
          expanded={effectiveExpanded.has(node.id)}
          active={props.activeNodeId === node.id}
          selectedItemIds={props.selectedItemIds}
          users={props.users}
          onActivate={() => activate(node)}
          onToggle={() => toggleExpanded(node)}
          onSelection={checked => toggleSelection(node, checked)}
          onOpenItem={props.onOpenItem}
          onAddSubchapter={props.onAddSubchapter}
          onUpdateChapter={props.onUpdateChapter}
          onUpdateItem={props.onUpdateItem}
          onMoveItem={props.onMoveItem}
          onMoveChapter={props.onMoveChapter}
          onOpenIntegration={props.onOpenIntegration}
        />)}
      </div>
    </div>
    <footer className="calculation-tree-footer"><SquareStack size={14}/><span>{nodes.length} zichtbare regels</span><span>Gebruik ↑ ↓ ← → en Enter</span></footer>
  </section>
}

function TreeRow(props: {
  node: CalculationTreeNode; top: number; expanded: boolean; active: boolean; selectedItemIds: ReadonlySet<string>; users: CompanyUser[]
  onActivate: () => void; onToggle: () => void; onSelection: (checked: boolean) => void; onOpenItem: (item: BoqItem) => void
  onAddSubchapter: (chapter: BoqChapter) => void; onUpdateChapter: (chapter: BoqChapter, patch: Partial<BoqChapter>) => void
  onUpdateItem: (item: BoqItem, patch: Partial<BoqItem>) => void
  onMoveItem: (itemId: string, chapterId: string | null) => void; onMoveChapter: (chapterId: string, parentChapterId: string | null) => void
  onOpenIntegration: (integration: CalculationTreeIntegration) => void
}) {
  const { node } = props
  const itemIds = nodeDescendantItemIds(node)
  const selectedCount = itemIds.filter(id => props.selectedItemIds.has(id)).length
  const checked = itemIds.length > 0 && selectedCount === itemIds.length
  const indeterminate = selectedCount > 0 && !checked
  const user = props.users.find(entry => entry.id === node.responsibleUserId)
  const draggable = node.kind === 'chapter' || node.kind === 'item'
  const drop = (event: DragEvent) => {
    event.preventDefault()
    const itemId = event.dataTransfer.getData('application/x-bouwflow-boq-item')
    const chapterId = event.dataTransfer.getData('application/x-bouwflow-boq-chapter')
    const targetChapterId = node.chapter?.id ?? null
    if (itemId && node.kind !== 'item') props.onMoveItem(itemId, targetChapterId)
    if (chapterId && node.kind !== 'item' && chapterId !== targetChapterId) props.onMoveChapter(chapterId, targetChapterId)
  }
  return <div
    className={`calculation-tree-row ${props.active ? 'active' : ''} kind-${node.kind}`}
    style={{ top: props.top, paddingLeft: 8 + node.depth * 18 }}
    role="treeitem" aria-level={node.depth + 1} aria-selected={props.active} aria-expanded={node.children.length ? props.expanded : undefined}
    draggable={draggable}
    onDragStart={event => { if (node.item) event.dataTransfer.setData('application/x-bouwflow-boq-item', node.item.id); if (node.chapter) event.dataTransfer.setData('application/x-bouwflow-boq-chapter', node.chapter.id) }}
    onDragOver={event => { if (node.kind !== 'item') event.preventDefault() }} onDrop={drop}
  >
    <span className="calculation-tree-main">
      <button type="button" className="tree-chevron" disabled={!node.children.length} onClick={event => { event.stopPropagation(); props.onToggle() }}>{node.children.length ? props.expanded ? <ChevronDown size={14}/> : <ChevronRight size={14}/> : <span/>}</button>
      <input type="checkbox" aria-label={`${node.code} selecteren`} checked={checked} ref={element => { if (element) element.indeterminate = indeterminate }} disabled={!itemIds.length} onChange={event => props.onSelection(event.target.checked)}/>
      <button type="button" className="tree-node-label" title={`${node.code} · ${node.label}`} onClick={props.onActivate}><b>{node.code}</b><span>{node.label}</span>{node.itemCount > 1 && <em>{node.itemCount}</em>}</button>
      {user && <span className="tree-owner" title={`Verantwoordelijke: ${user.displayName}`}><CircleUserRound size={13}/>{initials(user.displayName)}</span>}
      <i className={`tree-status status-${node.status.toLocaleLowerCase().replaceAll(' ', '-')}`} title={node.status}>{node.status === 'Goedgekeurd' ? <Check size={10}/> : null}</i>
    </span>
    <span className="tree-integrations">{node.integrations.slice(0, 4).map(value => { const Icon = integrationIcons[value]; return <button type="button" key={value} title={`${value} openen`} onClick={() => props.onOpenIntegration(value)}><Icon size={12}/>{value}</button> })}</span>
    <strong className="tree-amount">{money.format(node.directCost)}</strong>
    {(node.chapter || node.item) && <details className="tree-context"><summary aria-label="Meer acties"><Ellipsis size={15}/></summary><div>
      {node.chapter && <><button type="button" onClick={() => props.onAddSubchapter(node.chapter!)}>Subhoofdstuk toevoegen</button><button type="button" onClick={() => { const name = window.prompt('Nieuwe hoofdstuknaam', node.chapter!.name); if (name?.trim()) props.onUpdateChapter(node.chapter!, { name: name.trim() }) }}>Naam wijzigen</button><label>Verantwoordelijke<select value={node.chapter.responsibleUserId ?? ''} onChange={event => props.onUpdateChapter(node.chapter!, { responsibleUserId: event.target.value || undefined })}><option value="">Niet toegewezen</option>{props.users.map(entry => <option key={entry.id} value={entry.id}>{entry.displayName}</option>)}</select></label><label>Status<select value={node.chapter.workflowStatus ?? 'Niet gestart'} onChange={event => props.onUpdateChapter(node.chapter!, { workflowStatus: event.target.value as BoqChapter['workflowStatus'] })}>{statuses.map(value => <option key={value}>{value}</option>)}</select></label></>}
      {node.item && <><button type="button" onClick={() => props.onOpenItem(node.item!)}>Postinstellingen openen</button><label>Verantwoordelijke<select value={node.item.responsibleUserId ?? ''} onChange={event => props.onUpdateItem(node.item!, { responsibleUserId: event.target.value || undefined })}><option value="">Via hoofdstuk</option>{props.users.map(entry => <option key={entry.id} value={entry.id}>{entry.displayName}</option>)}</select></label><label>Status<select value={node.item.workflowStatus ?? 'Niet gestart'} onChange={event => props.onUpdateItem(node.item!, { workflowStatus: event.target.value as BoqItem['workflowStatus'] })}>{statuses.map(value => <option key={value}>{value}</option>)}</select></label></>}
    </div></details>}
  </div>
}

function flattenAllIds(root: CalculationTreeNode) {
  const result: string[] = []
  const visit = (node: CalculationTreeNode) => { result.push(node.id); node.children.forEach(visit) }
  visit(root)
  return result
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toLocaleUpperCase()).join('')
}
