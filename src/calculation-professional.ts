import type { BoqChapter, BoqItem, Calculation } from './domain'
import { boqItemQuantity, unitCost } from './domain'

export interface CalculationChapterSummary {
  chapter: BoqChapter
  items: BoqItem[]
  directCost: number
  completedItems: number
  integrationCount: number
}

export interface CalculationQualityIssue {
  id: string
  severity: 'Blokkerend' | 'Waarschuwing' | 'Aandachtspunt'
  title: string
  detail: string
  itemId?: string
  chapterId?: string
}

export function calculationChapterSummaries(calculation: Calculation): CalculationChapterSummary[] {
  return [...calculation.chapters]
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map(chapter => {
      const items = calculation.items.filter(item => item.chapterId === chapter.id)
      return {
        chapter,
        items,
        directCost: items.reduce((sum, item) => sum + boqItemQuantity(item) * unitCost(item), 0),
        completedItems: items.filter(item => item.workflowStatus === 'Goedgekeurd').length,
        integrationCount: items.filter(item => item.bimElementIds?.length || item.lidarScanIds?.length || item.planningActivityId || item.workPackageId).length,
      }
    })
}

export function calculationQualityIssues(calculation: Calculation): CalculationQualityIssue[] {
  const issues: CalculationQualityIssue[] = []
  calculation.items.forEach(item => {
    const isFinancial = item.postType !== 'Tekstregel' && item.postType !== 'Subtotaal'
    if (isFinancial && unitCost(item) <= 0) issues.push({ id: `price-${item.id}`, severity: 'Blokkerend', title: 'Post zonder kostprijs', detail: `${item.code} · ${item.description}`, itemId: item.id, chapterId: item.chapterId ?? undefined })
    if (isFinancial && boqItemQuantity(item) <= 0) issues.push({ id: `quantity-${item.id}`, severity: 'Blokkerend', title: 'Ongeldige hoeveelheid', detail: `${item.code} heeft geen positieve hoeveelheid.`, itemId: item.id, chapterId: item.chapterId ?? undefined })
    if (!item.responsibleUserId && item.workflowStatus === 'Ter controle') issues.push({ id: `owner-${item.id}`, severity: 'Waarschuwing', title: 'Controle zonder verantwoordelijke', detail: `${item.code} wacht op controle maar heeft geen eigenaar.`, itemId: item.id, chapterId: item.chapterId ?? undefined })
  })
  calculation.chapters.forEach(chapter => {
    if (!chapter.responsibleUserId) issues.push({ id: `chapter-owner-${chapter.id}`, severity: 'Aandachtspunt', title: 'Hoofdstuk niet toegewezen', detail: `${chapter.code} · ${chapter.name}`, chapterId: chapter.id })
  })
  return issues
}
