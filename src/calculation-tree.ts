import { boqItemQuantity, unitCost, type BoqChapter, type BoqItem, type Calculation, type Project, type ProgressStatement } from './domain'

export type CalculationTreeIntegration = 'BIM' | 'LiDAR' | 'Planning' | 'Werkpakket' | 'Vordering'
export type CalculationTreeNodeKind = 'root' | 'chapter' | 'item' | 'ungrouped'

export interface CalculationTreeNode {
  id: string
  kind: CalculationTreeNodeKind
  parentId?: string
  label: string
  code: string
  depth: number
  itemCount: number
  directCost: number
  status: NonNullable<BoqItem['workflowStatus']>
  responsibleUserId?: string
  integrations: CalculationTreeIntegration[]
  chapter?: BoqChapter
  item?: BoqItem
  children: CalculationTreeNode[]
}

export interface CalculationTreeContext {
  project?: Project
  progressStatements?: ProgressStatement[]
}

const statuses: NonNullable<BoqItem['workflowStatus']>[] = ['Niet gestart', 'In bewerking', 'Ter controle', 'Goedgekeurd']

export const itemDirectCost = (item: BoqItem) => boqItemQuantity(item) * unitCost(item)

function itemIntegrations(item: BoqItem, context: CalculationTreeContext): CalculationTreeIntegration[] {
  const integrations = new Set<CalculationTreeIntegration>()
  const notes = item.notes?.toLocaleLowerCase() ?? ''
  if (item.bimElementIds?.length || /\b(bim|ifc|guid|expressid)\b/.test(notes)) integrations.add('BIM')
  if (item.lidarScanIds?.length || /\blidar\b|roomplan|arkit/.test(notes)) integrations.add('LiDAR')
  const workPackage = item.workPackageId
    ? context.project?.workPackages.find(entry => entry.id === item.workPackageId)
    : context.project?.workPackages.find(entry => item.code.startsWith(entry.code))
  if (workPackage) integrations.add('Werkpakket')
  const planningActivity = item.planningActivityId
    ? context.project?.planning.activities.find(entry => entry.id === item.planningActivityId)
    : context.project?.planning.activities.find(entry => workPackage && entry.workPackageId === workPackage.id)
  if (planningActivity) integrations.add('Planning')
  if (workPackage && context.progressStatements?.some(statement => statement.lines.some(line => line.workPackageId === workPackage.id))) integrations.add('Vordering')
  return [...integrations]
}

function aggregate(node: CalculationTreeNode): CalculationTreeNode {
  if (node.kind === 'item') return node
  const children = node.children.map(aggregate)
  const itemCount = children.reduce((sum, child) => sum + child.itemCount, 0)
  const directCost = children.reduce((sum, child) => sum + child.directCost, 0)
  const integrations = [...new Set(children.flatMap(child => child.integrations))]
  const childStatuses = children.map(child => child.status)
  const status = childStatuses.length
    ? statuses[Math.min(...childStatuses.map(childStatus => statuses.indexOf(childStatus)))]
    : node.status
  return { ...node, children, itemCount, directCost, integrations, status }
}

export function buildCalculationTree(calculation: Calculation, context: CalculationTreeContext = {}): CalculationTreeNode {
  const chapters = [...calculation.chapters].sort((left, right) => left.sortOrder - right.sortOrder || left.code.localeCompare(right.code))
  const chapterIds = new Set(chapters.map(chapter => chapter.id))
  const chapterNodes = new Map<string, CalculationTreeNode>(chapters.map(chapter => [chapter.id, {
    id: `chapter:${chapter.id}`,
    kind: 'chapter' as const,
    parentId: chapter.parentChapterId && chapterIds.has(chapter.parentChapterId) ? `chapter:${chapter.parentChapterId}` : 'root',
    label: chapter.name,
    code: chapter.code,
    depth: 1,
    itemCount: 0,
    directCost: 0,
    status: chapter.workflowStatus ?? 'Niet gestart',
    responsibleUserId: chapter.responsibleUserId,
    integrations: [],
    chapter,
    children: [],
  }]))
  const ungrouped: CalculationTreeNode = {
    id: 'ungrouped', kind: 'ungrouped', parentId: 'root', label: 'Zonder hoofdstuk', code: '—', depth: 1,
    itemCount: 0, directCost: 0, status: 'Niet gestart', integrations: [], children: [],
  }
  const items = [...calculation.items].sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0))
  for (const item of items) {
    const parent = item.chapterId ? chapterNodes.get(item.chapterId) : undefined
    const integrations = itemIntegrations(item, context)
    ;(parent ?? ungrouped).children.push({
      id: `item:${item.id}`, kind: 'item', parentId: parent?.id ?? ungrouped.id, label: item.description, code: item.code,
      depth: 2, itemCount: 1, directCost: itemDirectCost(item), status: item.workflowStatus ?? 'Niet gestart',
      responsibleUserId: item.responsibleUserId, integrations, item, children: [],
    })
  }
  const roots: CalculationTreeNode[] = []
  for (const chapter of chapters) {
    const node = chapterNodes.get(chapter.id)!
    const parent = chapter.parentChapterId ? chapterNodes.get(chapter.parentChapterId) : undefined
    if (parent && !chapterHasAncestor(chapter.id, parent.chapter!, chapterNodes)) parent.children.push(node)
    else roots.push(node)
  }
  if (ungrouped.children.length) roots.push(ungrouped)
  const root: CalculationTreeNode = {
    id: 'root', kind: 'root', label: calculation.number, code: calculation.number, depth: 0,
    itemCount: 0, directCost: 0, status: 'Niet gestart', integrations: [], children: roots,
  }
  return setDepths(aggregate(root), 0)
}

function chapterHasAncestor(candidateId: string, parent: BoqChapter, nodes: Map<string, CalculationTreeNode>) {
  const visited = new Set<string>()
  let current: BoqChapter | undefined = parent
  while (current?.parentChapterId) {
    if (current.parentChapterId === candidateId || visited.has(current.parentChapterId)) return true
    visited.add(current.parentChapterId)
    current = nodes.get(current.parentChapterId)?.chapter
  }
  return false
}

function setDepths(node: CalculationTreeNode, depth: number): CalculationTreeNode {
  return { ...node, depth, children: node.children.map(child => setDepths(child, depth + 1)) }
}

export function flattenCalculationTree(root: CalculationTreeNode, expandedIds: ReadonlySet<string>): CalculationTreeNode[] {
  const result: CalculationTreeNode[] = []
  const visit = (node: CalculationTreeNode) => {
    result.push(node)
    if ((node.kind === 'root' || expandedIds.has(node.id))) node.children.forEach(visit)
  }
  visit(root)
  return result
}

export function filterCalculationTree(root: CalculationTreeNode, query: string, status: string, integration: string) {
  const normalized = query.trim().toLocaleLowerCase()
  const visit = (node: CalculationTreeNode): CalculationTreeNode | undefined => {
    const children = node.children.map(visit).filter(Boolean) as CalculationTreeNode[]
    const matchesText = !normalized || `${node.code} ${node.label}`.toLocaleLowerCase().includes(normalized)
    const matchesStatus = !status || node.status === status
    const matchesIntegration = !integration || node.integrations.includes(integration as CalculationTreeIntegration)
    if (node.kind === 'root' || (matchesText && matchesStatus && matchesIntegration) || children.length) return { ...node, children }
    return undefined
  }
  return visit(root) ?? { ...root, children: [] }
}

export function nodeDescendantItemIds(node: CalculationTreeNode): string[] {
  if (node.item) return [node.item.id]
  return node.children.flatMap(nodeDescendantItemIds)
}

export function chapterDescendantIds(chapterId: string, chapters: BoqChapter[]): Set<string> {
  const result = new Set<string>([chapterId])
  let changed = true
  while (changed) {
    changed = false
    for (const chapter of chapters) if (chapter.parentChapterId && result.has(chapter.parentChapterId) && !result.has(chapter.id)) {
      result.add(chapter.id)
      changed = true
    }
  }
  return result
}
