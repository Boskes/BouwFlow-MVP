import { boqItemQuantity, unitCost, type BoqItem, type Calculation, type DailyProductionEntry, type DailyReport, type DailyReportProgressEvidence, type MeetstaatProgressEvidence, type Project, type ProjectWorkPackage, type QuantityProgressMeasurement } from './domain.js'

const normalizedCode = (value: string) => value.trim().toLocaleLowerCase().replace(/\d+/g, part => String(Number(part))).replace(/[^a-z0-9]+/g, '')

export function workPackageBoqItems(calculation: Calculation | undefined, workPackage: ProjectWorkPackage): BoqItem[] {
  if (!calculation) return []
  const chapter = calculation.chapters.find(item => normalizedCode(item.code) === normalizedCode(workPackage.code))
  const chapterItems = chapter ? calculation.items.filter(item => item.chapterId === chapter.id) : []
  const fallbackItems = calculation.items.filter(item => {
    const code = item.code.trim().toLocaleLowerCase()
    const prefix = workPackage.code.trim().toLocaleLowerCase()
    return code === prefix || code.startsWith(`${prefix}.`) || code.startsWith(`${prefix}-`)
  })
  const items = chapterItems.length ? chapterItems : fallbackItems
  return items.filter(item => item.postType !== 'Tekstregel' && item.postType !== 'Subtotaal' && boqItemQuantity(item) > 0)
}

export function quantityProgress(calculation: Calculation | undefined, workPackage: ProjectWorkPackage, measurements: QuantityProgressMeasurement[]) {
  const items = workPackageBoqItems(calculation, workPackage)
  const quantities = new Map(measurements.map(item => [item.boqItemId, Math.max(0, item.cumulativeQuantity)]))
  const weighted = items.map(item => {
    const contractQuantity = boqItemQuantity(item)
    const measuredQuantity = quantities.get(item.id) ?? 0
    const ratio = Math.min(1, measuredQuantity / contractQuantity)
    const calculatedValue = contractQuantity * unitCost(item)
    return { item, contractQuantity, measuredQuantity, ratio, weight: calculatedValue > 0 ? calculatedValue : 1 }
  })
  const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0)
  const completionPct = totalWeight ? weighted.reduce((sum, item) => sum + item.weight * item.ratio, 0) / totalWeight * 100 : 0
  return { items: weighted, completionPct: Math.round(completionPct * 10_000) / 10_000 }
}

export function buildMeetstaatEvidence(calculation: Calculation, workPackage: ProjectWorkPackage, measurements: QuantityProgressMeasurement[], measuredBy: string, measuredAt = new Date().toISOString()): MeetstaatProgressEvidence {
  const result = quantityProgress(calculation, workPackage, measurements)
  return {
    sourceCalculationId: calculation.id,
    measurements: result.items.map(item => ({ boqItemId: item.item.id, cumulativeQuantity: item.measuredQuantity })),
    itemCount: result.items.length,
    completionPct: result.completionPct,
    measuredAt,
    measuredBy,
  }
}

export function approvedDailyProduction(reports: DailyReport[], projectId: string, workPackageId: string, approvedThrough: string) {
  const eligibleReports = reports
    .filter(report => report.projectId === projectId && report.status === 'Ondertekend' && report.date <= approvedThrough)
    .filter(report => report.workPackageId === workPackageId || (report.productionEntries ?? []).some(entry => entry.workPackageId === workPackageId))
    .sort((a, b) => a.date.localeCompare(b.date))
  const entries = eligibleReports.flatMap(report => (report.productionEntries ?? []).filter(entry => entry.workPackageId === workPackageId))
  return { reports: eligibleReports, entries }
}

export function aggregateProductionEntries(entries: DailyProductionEntry[]): QuantityProgressMeasurement[] {
  const totals = new Map<string, number>()
  entries.forEach(entry => totals.set(entry.boqItemId, (totals.get(entry.boqItemId) ?? 0) + entry.quantity))
  return [...totals].map(([boqItemId, cumulativeQuantity]) => ({ boqItemId, cumulativeQuantity }))
}

export function buildDailyReportEvidence(calculation: Calculation, project: Project, workPackage: ProjectWorkPackage, reports: DailyReport[], approvedThrough: string, calculatedAt = new Date().toISOString()): DailyReportProgressEvidence {
  const approved = approvedDailyProduction(reports, project.id, workPackage.id, approvedThrough)
  const progress = quantityProgress(calculation, workPackage, aggregateProductionEntries(approved.entries))
  return {
    sourceCalculationId: calculation.id,
    reportIds: approved.reports.map(report => report.id),
    productionEntryIds: approved.entries.map(entry => entry.id),
    reportCount: approved.reports.length,
    productionEntryCount: approved.entries.length,
    completionPct: progress.completionPct,
    approvedThrough,
    calculatedAt,
  }
}
