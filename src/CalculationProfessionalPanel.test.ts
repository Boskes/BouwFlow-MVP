import { describe, expect, it } from 'vitest'
import type { Calculation } from './domain'
import { calculationChapterSummaries, calculationQualityIssues } from './calculation-professional'

const calculation: Calculation = {
  id: 'calculation', number: 'CAL-2026-001', opportunityId: 'opportunity', status: 'Review', overheadPct: 8, riskPct: 3, marginPct: 12,
  updatedAt: '2026-08-06T00:00:00.000Z',
  chapters: [
    { id: 'chapter-a', code: '01', name: 'Ruwbouw', sortOrder: 0, responsibleUserId: 'user-1', workflowStatus: 'In bewerking' },
    { id: 'chapter-b', code: '02', name: 'Technieken', sortOrder: 1, workflowStatus: 'Ter controle' },
  ],
  items: [
    { id: 'item-a', chapterId: 'chapter-a', code: '01.01', description: 'Betonwand', quantity: 10, unit: 'm³', labor: 20, material: 80, equipment: 10, subcontracting: 0, workflowStatus: 'Goedgekeurd', bimElementIds: ['ifc-1'], planningActivityId: 'activity-1' },
    { id: 'item-b', chapterId: 'chapter-b', code: '02.01', description: 'Stopcontact', quantity: 0, unit: 'st', labor: 0, material: 0, equipment: 0, subcontracting: 0, workflowStatus: 'Ter controle' },
  ],
}

describe('professional calculation workspaces', () => {
  it('summarizes chapters for the package board and review cockpit', () => {
    const summaries = calculationChapterSummaries(calculation)
    expect(summaries).toHaveLength(2)
    expect(summaries[0]).toMatchObject({ directCost: 1100, completedItems: 1, integrationCount: 1 })
    expect(summaries[1].directCost).toBe(0)
  })

  it('detects blocking and ownership issues before formal review', () => {
    const issues = calculationQualityIssues(calculation)
    expect(issues.some(issue => issue.id === 'price-item-b' && issue.severity === 'Blokkerend')).toBe(true)
    expect(issues.some(issue => issue.id === 'quantity-item-b' && issue.severity === 'Blokkerend')).toBe(true)
    expect(issues.some(issue => issue.id === 'owner-item-b' && issue.severity === 'Waarschuwing')).toBe(true)
    expect(issues.some(issue => issue.id === 'chapter-owner-chapter-b')).toBe(true)
  })
})
